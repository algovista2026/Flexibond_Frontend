import React, { useState, useEffect } from 'react';
import {
  adminGetUsers, adminCreateUser, adminDeleteUser, adminUpdateUser, adminReset2FA,
  getPendingDevices, getAllDevices, approveDevice, revokeDevice,
  setup2FA, activate2FA, disable2FA,
  getSalespersonNames, getScopedProgress, setScopedTarget
} from '../services/api';
import {
  FiUserPlus, FiTrash2, FiShield, FiCheckSquare, FiSquare, FiEdit2,
  FiEye, FiEyeOff, FiLock, FiSmartphone, FiMonitor, FiCheck, FiX, FiRefreshCw,
  FiTarget, FiBriefcase, FiMapPin
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import NotificationPanel from '../components/NotificationPanel';

const AdminPanel = () => {
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  
  // 2FA & Device state
  const [allDevices, setAllDevices] = useState([]);
  const [pendingDevices, setPendingDevices] = useState([]);
  const [qrCode, setQrCode] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);

  // Edit mode tracking
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  // User form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Account type drives role + scope. 'viewer'/'admin' = unrestricted; 'company'/'zonal' = scoped.
  const [accountType, setAccountType] = useState('viewer');
  const [company, setCompany] = useState('');
  const [zone, setZone] = useState('');
  const [selectedSalespeople, setSelectedSalespeople] = useState([]);
  const [spNames, setSpNames] = useState([]);
  const [spNamesLoading, setSpNamesLoading] = useState(false);
  const [permissions, setPermissions] = useState(['overview', 'products', 'salesperson', 'comparison', 'financials', 'channel', 'upload']);

  // Per-scoped-account target progress (userId -> { target, achieved, pct, hasTarget }).
  const [scopeProgress, setScopeProgress] = useState({});
  // Target modal
  const [targetModalUser, setTargetModalUser] = useState(null);
  const [targetAmount, setTargetAmount] = useState('');
  const [targetMode, setTargetMode] = useState('yearly');
  const [targetSaving, setTargetSaving] = useState(false);

  const COMPANY_OPTIONS = ['UFLP', 'UCPL', 'UFPL', 'FDL'];
  const ZONE_OPTIONS = ['West Zone', 'East Zone', 'North Zone', 'South Zone', 'Central Zone'];
  const DEFAULT_PERMS = ['overview', 'products', 'salesperson', 'comparison', 'financials', 'channel', 'upload'];
  // Scoped accounts can't hold Invoice-level sections (mirrors the backend enforcement).
  const SCOPED_PERMS = ['overview', 'products', 'salesperson', 'comparison', 'clients'];
  const fmtINR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

  const availableModules = [
    { id: 'overview', label: 'Dashboard Overview' },
    { id: 'products', label: 'Product Analytics' },
    { id: 'salesperson', label: 'Salesperson Performance' },
    { id: 'comparison', label: 'Salesperson Comparison' },
    { id: 'clients', label: 'Client Analytics' },
    { id: 'financials', label: 'Financials (Tax & GST)' },
    { id: 'channel', label: 'Channel (B2B vs B2C)' },
    { id: 'upload', label: 'Data Upload Area' },
  ];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminGetUsers();
      if (res.data && res.data.users) {
        setUsers(res.data.users);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityData = async () => {
    try {
      const [pendingRes, allRes, meRes] = await Promise.all([
        getPendingDevices(),
        getAllDevices(),
        adminGetUsers() // We'll just reuse this to find current user status
      ]);
      setPendingDevices(pendingRes.data.devices);
      setAllDevices(allRes.data.devices);
      const me = meRes.data.users.find(u => u._id === user.id);
      setCurrentUserData(me);
    } catch (err) {
      console.error('Security data fetch failed');
    }
  };

  const fetchScopeProgress = async () => {
    try {
      const res = await getScopedProgress();
      const map = {};
      (res.data?.data?.progress || []).forEach(r => { map[r.userId] = r; });
      setScopeProgress(map);
    } catch (err) {
      console.error('scope progress fetch failed');
    }
  };

  useEffect(() => {
    fetchUsers();
    if (user.role === 'admin') {
      fetchSecurityData();
      fetchScopeProgress();
    }
  }, []);

  // Load the salesperson pick-list for zonal-head accounts, filtered by the chosen zone
  // (a picking aid — only salespeople with ≥1 order in that zone are offered).
  useEffect(() => {
    if (accountType !== 'zonal') return;
    setSpNamesLoading(true);
    getSalespersonNames(zone ? { zone } : {})
      .then(res => setSpNames(res.data?.data || []))
      .catch(() => setSpNames([]))
      .finally(() => setSpNamesLoading(false));
  }, [accountType, zone]);

  const handleTogglePerm = (modId) => {
    if (permissions.includes(modId)) {
      setPermissions(permissions.filter(p => p !== modId));
    } else {
      setPermissions([...permissions, modId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username) {
      return toast.warning('Please enter a username');
    }
    if (!isEditMode && !password) {
      return toast.warning('Please enter a password');
    }
    if (password && password !== confirmPassword) {
      return toast.warning('Passwords do not match!');
    }

    // Scope validation + payload
    if (accountType === 'company' && !company) {
      return toast.warning('Select a company for a company-scoped account');
    }
    if (accountType === 'zonal' && selectedSalespeople.length === 0) {
      return toast.warning('Select at least one salesperson for a zonal-head account');
    }
    const submitRole = accountType === 'admin' ? 'admin' : 'viewer';
    const scopePayload =
      accountType === 'company' ? { scopeType: 'company', company }
      : accountType === 'zonal' ? { scopeType: 'zonal', salespeople: selectedSalespeople, zone }
      : { scopeType: 'none' };

    try {
      if (isEditMode) {
        await adminUpdateUser(editingUserId, { role: submitRole, permissions, password: password.trim() ? password : undefined, ...scopePayload });
        toast.success('User updated successfully');
      } else {
        await adminCreateUser({ username, password, role: submitRole, permissions, ...scopePayload });
        toast.success('User created successfully');
      }

      // Reset State
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setAccountType('viewer');
      setCompany('');
      setZone('');
      setSelectedSalespeople([]);
      setPermissions(DEFAULT_PERMS);
      setIsEditMode(false);
      setEditingUserId(null);
      fetchUsers();
      if (user.role === 'admin') fetchScopeProgress();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    }
  };

  const handleEditClick = (userObj) => {
    setIsEditMode(true);
    setEditingUserId(userObj._id);
    setUsername(userObj.username);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    const at = userObj.role === 'admin'
      ? 'admin'
      : (userObj.scopeType && userObj.scopeType !== 'none' ? userObj.scopeType : 'viewer');
    setAccountType(at);
    setCompany(userObj.company || '');
    setZone(userObj.zone || '');
    setSelectedSalespeople(userObj.salespeople || []);
    setPermissions(userObj.permissions || []);
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAccountType('viewer');
    setCompany('');
    setZone('');
    setSelectedSalespeople([]);
    setPermissions(DEFAULT_PERMS);
  };

  const toggleSalesperson = (name) => {
    setSelectedSalespeople(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // ---- Scoped-account target modal ----
  const openTargetModal = (u) => {
    const prog = scopeProgress[u._id];
    setTargetModalUser(u);
    setTargetAmount(prog && prog.hasTarget ? String(prog.target) : '');
    setTargetMode('yearly');
  };

  const saveScopedTarget = async () => {
    if (!targetModalUser) return;
    const amt = Number(targetAmount);
    if (!isFinite(amt) || amt < 0) return toast.warning('Enter a valid target amount');
    try {
      setTargetSaving(true);
      await setScopedTarget(targetModalUser._id, { amount: amt, mode: targetMode });
      toast.success('Target saved');
      setTargetModalUser(null);
      fetchScopeProgress();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save target');
    } finally {
      setTargetSaving(false);
    }
  };

  const handleReset2FA = async (userId) => {
    if (!window.confirm('Are you sure you want to disable 2FA for this user? They will be able to log in with just their password.')) return;
    try {
      await adminReset2FA(userId);
      toast.success('2FA has been disabled for the user');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to reset 2FA');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === user._id) {
      toast.error('You cannot delete your own admin account while logged in.');
      return;
    }
    if (!window.confirm('Are you sure you want to remove this user?')) return;
    try {
      await adminDeleteUser(userId);
      toast.success('User removed');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleApproveDevice = async (id) => {
    try {
      await approveDevice(id);
      toast.success('Device approved');
      fetchSecurityData();
    } catch (err) {
      toast.error('Approval failed');
    }
  };

  const handleRevokeDevice = async (id) => {
    if (!window.confirm('Revoke access for this device?')) return;
    try {
      await revokeDevice(id);
      toast.success('Access revoked');
      fetchSecurityData();
    } catch (err) {
      toast.error('Revocation failed');
    }
  };

  const handleSetup2FA = async () => {
    try {
      const res = await setup2FA();
      setQrCode(res.data.qrCode);
      setShow2FASetup(true);
    } catch (err) {
      toast.error('Failed to initiate 2FA setup');
    }
  };

  const handleActivate2FA = async () => {
    try {
      await activate2FA(twoFactorCode);
      toast.success('2FA activated successfully!');
      setShow2FASetup(false);
      fetchSecurityData();
    } catch (err) {
      toast.error('Invalid code. Please try again.');
    }
  };

  const handleDisable2FA = async () => {
    if (!window.confirm('Disable 2FA? This will make your account less secure.')) return;
    try {
      await disable2FA();
      toast.success('2FA disabled');
      fetchSecurityData();
    } catch (err) {
      toast.error('Failed to disable 2FA');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>{activeTab === 'users' ? 'User Management' : 'Security Center'}</h1>
          <p>{activeTab === 'users' 
            ? 'Create credentials and grant permissions strictly for analytics modules' 
            : 'Manage device approvals and multi-factor authentication'}</p>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div className="tab-switcher" style={{ display: 'flex', background: 'var(--bg-light)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button 
              className={activeTab === 'users' ? 'active' : ''} 
              onClick={() => setActiveTab('users')}
              style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, background: activeTab === 'users' ? '#fff' : 'transparent', boxShadow: activeTab === 'users' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', color: activeTab === 'users' ? 'var(--primary-600)' : 'var(--text-secondary)' }}
            >
              Users
            </button>
            <button 
              className={activeTab === 'security' ? 'active' : ''} 
              onClick={() => setActiveTab('security')}
              style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, background: activeTab === 'security' ? '#fff' : 'transparent', boxShadow: activeTab === 'security' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', color: activeTab === 'security' ? 'var(--primary-600)' : 'var(--text-secondary)' }}
            >
              Security
            </button>
          </div>
          {user.role === 'admin' && <NotificationPanel />}
        </div>
      </div>

      {activeTab === 'users' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '20px' }}>
          {/* ... (Existing User Form and List) */}
          <div className="chart-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-600)', margin: 0 }}>
                {isEditMode ? <FiEdit2 /> : <FiUserPlus />} {isEditMode ? 'Edit Portal User' : 'Add New User'}
              </h3>
              {isEditMode && (
                <button 
                  type="button" 
                  onClick={cancelEdit}
                  style={{ background: 'var(--primary-100)', color: 'var(--primary-600)', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiUserPlus /> Switch to Create Form
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isEditMode}
                  placeholder="e.g. jignesh_view"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', background: isEditMode ? 'var(--bg-light)' : '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    {isEditMode ? 'New Password' : 'Password'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isEditMode ? 'Leave blank' : 'Enter password'}
                      style={{ width: '100%', padding: '10px 12px', paddingRight: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                    />
                    <span 
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      style={{ width: '100%', padding: '10px 12px', paddingRight: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                    />
                    <span 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Account Type</label>
                <select
                  value={accountType}
                  onChange={(e) => {
                    const at = e.target.value;
                    setAccountType(at);
                    // Scoped accounts get the restricted permission default.
                    if (at === 'company' || at === 'zonal') setPermissions(SCOPED_PERMS);
                    else if (at === 'viewer') setPermissions(DEFAULT_PERMS);
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', outline: 'none' }}
                >
                  <option value="viewer">Viewer (sees all data)</option>
                  <option value="admin">Administrator (full access)</option>
                  <option value="company">Company (one company only)</option>
                  <option value="zonal">Zonal Head (selected salespeople)</option>
                </select>
              </div>

              {/* Company-scoped: pick which of the daughter companies this account sees. */}
              {accountType === 'company' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    <FiBriefcase size={14} /> Company
                  </label>
                  <select
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', outline: 'none' }}
                  >
                    <option value="">— Select company —</option>
                    {COMPANY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    This account will only ever see <strong>{company || '…'}</strong> data across the whole app.
                  </p>
                </div>
              )}

              {/* Zonal head: zone is just a filter to narrow the salesperson pick-list; the
                  actual scope is the chosen salespeople (all their data, any zone). */}
              {accountType === 'zonal' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <FiMapPin size={14} /> Zone (pick-list filter — optional)
                    </label>
                    <select
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', outline: 'none' }}
                    >
                      <option value="">All zones</option>
                      {ZONE_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Choosing a zone shows only salespeople with ≥1 order there. The account still sees
                      <strong> all data</strong> for whomever you pick (not limited by zone).
                    </p>
                  </div>
                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <span>Salespeople in this account</span>
                      <span style={{ color: 'var(--primary-600)' }}>{selectedSalespeople.length} selected</span>
                    </label>
                    <div style={{ maxHeight: '220px', overflowY: 'auto', background: 'var(--bg-light)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      {spNamesLoading ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px' }}>Loading salespeople…</p>
                      ) : spNames.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px' }}>No salespeople found for this zone.</p>
                      ) : (
                        spNames.map(name => (
                          <div
                            key={name}
                            onClick={() => toggleSalesperson(name)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '5px 4px' }}
                          >
                            {selectedSalespeople.includes(name)
                              ? <FiCheckSquare color="var(--primary-600)" size={16} />
                              : <FiSquare color="var(--text-muted)" size={16} />}
                            <span>{name}</span>
                          </div>
                        ))
                      )}
                      {/* Keep any already-picked names that aren't in the current zone list visible. */}
                      {selectedSalespeople.filter(n => !spNames.includes(n)).map(name => (
                        <div
                          key={name}
                          onClick={() => toggleSalesperson(name)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '5px 4px', opacity: 0.8 }}
                        >
                          <FiCheckSquare color="var(--primary-600)" size={16} />
                          <span>{name} <em style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>(other zone)</em></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, var(--primary-500), var(--primary-600))', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  {isEditMode ? <FiEdit2 /> : <FiUserPlus />} {isEditMode ? 'Update User' : 'Save User'}
                </button>
                {isEditMode && (
                  <button 
                    type="button"
                    onClick={cancelEdit}
                    style={{ padding: '12px 16px', background: 'var(--bg-light)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {accountType !== 'admin' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Module Access Permissions</label>
                  {(accountType === 'company' || accountType === 'zonal') && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Financials, Channel and Data Upload are unavailable for scoped accounts.
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', background: 'var(--bg-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {availableModules
                      .filter(mod => !((accountType === 'company' || accountType === 'zonal') && ['financials', 'channel', 'upload'].includes(mod.id)))
                      .map(mod => (
                      <div 
                        key={mod.id} 
                        onClick={() => handleTogglePerm(mod.id)} 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        {permissions.includes(mod.id) ? (
                          <FiCheckSquare color="var(--primary-600)" size={16} />
                        ) : (
                          <FiSquare color="var(--text-muted)" size={16} />
                        )}
                        <span>{mod.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>

          <div className="chart-card" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-600)' }}>
              <FiShield /> Configured Portal Users
            </h3>

            {loading ? (
              <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading portal users...</p>
            ) : users.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No alternative users registered yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {users.map(u => {
                  const isScoped = u.scopeType === 'company' || u.scopeType === 'zonal';
                  const prog = scopeProgress[u._id];
                  const scopeLabel = u.scopeType === 'company'
                    ? `Company · ${u.company || '—'}`
                    : u.scopeType === 'zonal'
                      ? `Zonal Head · ${(u.salespeople || []).length} salespeople${u.zone ? ` · ${u.zone}` : ''}`
                      : null;
                  return (
                  <div
                    key={u._id}
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 18px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{u.username}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: u.role === 'admin' ? '#fee2e2' : '#dbeafe', color: u.role === 'admin' ? '#ef4444' : '#2563eb', fontWeight: 600 }}>{u.role}</span>
                        {scopeLabel && (
                          <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>{scopeLabel}</span>
                        )}
                        {u.role === 'viewer' && !isScoped && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Perms: {(u.permissions || []).join(', ') || 'None'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isScoped && (
                        <button
                          onClick={() => openTargetModal(u)}
                          style={{ padding: '8px', background: 'transparent', border: 'none', color: '#d97706', cursor: 'pointer', borderRadius: '6px' }}
                          title="Set / edit target"
                        >
                          <FiTarget size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditClick(u)}
                        style={{ padding: '8px', background: 'transparent', border: 'none', color: 'var(--primary-600)', cursor: 'pointer', borderRadius: '6px' }}
                      >
                        <FiEdit2 size={16} />
                      </button>
                      {u.isTwoFactorEnabled && (
                        <button
                          onClick={() => handleReset2FA(u._id)}
                          style={{ padding: '8px', background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer', borderRadius: '6px', position: 'relative' }}
                          title="Reset 2FA"
                        >
                          <FiShield size={16} />
                          <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', border: '2px solid #fff' }}></span>
                        </button>
                      )}
                      {u.username !== 'flexibond' && u._id !== user._id && (
                        <button
                          onClick={() => handleDeleteUser(u._id)}
                          style={{ padding: '8px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: '6px' }}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                    </div>

                    {/* Target progress bar for scoped accounts */}
                    {isScoped && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span>
                            {prog && prog.hasTarget
                              ? `${fmtINR(prog.achieved)} of ${fmtINR(prog.target)} (incl. GST)`
                              : 'No target set'}
                          </span>
                          {prog && prog.hasTarget && <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{prog.pct}%</span>}
                        </div>
                        <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(prog?.pct || 0, 100)}%`, background: (prog?.pct || 0) >= 100 ? '#22c55e' : 'linear-gradient(90deg, var(--primary-400), var(--primary-600))', borderRadius: '3px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginTop: '20px' }}>
          
          {/* 2FA Card */}
          <div className="chart-card" style={{ padding: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-600)', marginBottom: '15px' }}>
              <FiLock /> Two-Factor Authentication
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
              Add an extra layer of security to your account by requiring a 6-digit code from your phone whenever you log in.
            </p>

            {currentUserData?.isTwoFactorEnabled ? (
              <div style={{ padding: '15px', background: 'var(--success-light)', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#22c55e', color: '#fff', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                    <FiCheck size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#166534' }}>2FA is Enabled</div>
                    <div style={{ fontSize: '0.8rem', color: '#166534' }}>Your account is secure.</div>
                  </div>
                </div>
                <button onClick={handleDisable2FA} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Disable</button>
              </div>
            ) : (
              <div>
                {show2FASetup ? (
                  <div style={{ textAlign: 'center', background: 'var(--bg-light)', padding: '20px', borderRadius: '10px' }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '15px' }}>Scan this QR code with Google Authenticator or Authy</p>
                    <img src={qrCode} alt="QR Code" style={{ width: '180px', height: '180px', marginBottom: '15px', borderRadius: '8px', border: '4px solid #fff' }} />
                    <div className="form-group">
                      <input 
                        type="text" 
                        placeholder="Enter 6-digit code" 
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                        maxLength="6"
                        style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', padding: '10px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '15px' }}>
                      <button onClick={handleActivate2FA} className="btn-security" style={{ flex: 1 }}>
                        <FiCheck /> Activate Now
                      </button>
                      <button onClick={() => setShow2FASetup(false)} style={{ flex: 1, background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '20px', background: 'var(--primary-50)', borderRadius: '12px', border: '1px dashed var(--primary-200)', textAlign: 'center' }}>
                    <FiSmartphone size={32} style={{ color: 'var(--primary-500)', marginBottom: '12px', opacity: 0.8 }} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--primary-700)', marginBottom: '15px', fontWeight: 500 }}>
                      Protect your account with mobile-based 2FA.
                    </p>
                    <button onClick={handleSetup2FA} className="btn-security">
                      <FiLock /> Enable 2FA Now
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Device Management Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Pending Requests */}
            <div className="chart-card" style={{ padding: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', marginBottom: '15px' }}>
                <FiRefreshCw /> Pending Requests
              </h3>
              {pendingDevices.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No pending requests.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingDevices.map(device => (
                    <div key={device._id} style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{device.deviceName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#92400e' }}>User: {device.userId?.username}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => handleApproveDevice(device._id)} style={{ padding: '6px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><FiCheck size={14} /></button>
                        <button onClick={() => handleRevokeDevice(device._id)} style={{ padding: '6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><FiX size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trusted Devices List */}
            <div className="chart-card" style={{ padding: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-600)', marginBottom: '15px' }}>
                <FiMonitor /> Trusted Devices
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '15px' }}>
                These devices have permanent access. You can revoke them at any time.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {allDevices.filter(d => d.isApproved).map(device => (
                  <div key={device._id} style={{ padding: '15px', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-light)' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ padding: '8px', background: 'var(--primary-100)', color: 'var(--primary-600)', borderRadius: '6px' }}>
                        {device.deviceType === 'mobile' ? <FiSmartphone size={18} /> : <FiMonitor size={18} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary-700)', fontSize: '0.95rem' }}>{device.userId?.username || 'Unknown User'}</span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>— {device.deviceName}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', background: 'var(--bg-light)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{device.ipAddress}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Last used: {new Date(device.lastUsed).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRevokeDevice(device._id)} 
                      style={{ padding: '8px', borderRadius: '6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Revoke Access"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                ))}
                {allDevices.filter(d => d.isApproved).length === 0 && (
                  <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No trusted devices yet.</p>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Scoped-account target modal */}
      {targetModalUser && (
        <div
          onClick={() => !targetSaving && setTargetModalUser(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '420px', maxWidth: '92vw', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d97706', marginBottom: '4px' }}>
              <FiTarget /> Set Target
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px', textTransform: 'capitalize' }}>
              {targetModalUser.username} · {targetModalUser.scopeType === 'company' ? `Company ${targetModalUser.company || ''}` : 'Zonal Head'}
            </p>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Target Mode</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['yearly', 'monthly'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTargetMode(m)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${targetMode === m ? 'var(--primary-500)' : 'var(--border-color)'}`, background: targetMode === m ? 'var(--primary-50)' : '#fff', color: targetMode === m ? 'var(--primary-700)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                >
                  {m}
                </button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {targetMode === 'yearly' ? 'Annual target (₹)' : 'Monthly target (₹)'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 10000000"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            {targetAmount && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                {fmtINR(Number(targetAmount))} {targetMode === 'monthly' ? '/ month' : '/ year'}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
              <button
                onClick={saveScopedTarget}
                disabled={targetSaving}
                style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: targetSaving ? 'default' : 'pointer', opacity: targetSaving ? 0.7 : 1 }}
              >
                {targetSaving ? 'Saving…' : 'Save Target'}
              </button>
              <button
                onClick={() => setTargetModalUser(null)}
                disabled={targetSaving}
                style={{ padding: '11px 16px', background: 'var(--bg-light)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
