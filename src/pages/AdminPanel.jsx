import React, { useState, useEffect } from 'react';
import { 
  adminGetUsers, adminCreateUser, adminDeleteUser, adminUpdateUser, adminReset2FA,
  getPendingDevices, getAllDevices, approveDevice, revokeDevice,
  setup2FA, activate2FA, disable2FA 
} from '../services/api';
import { 
  FiUserPlus, FiTrash2, FiShield, FiCheckSquare, FiSquare, FiEdit2, 
  FiEye, FiEyeOff, FiLock, FiSmartphone, FiMonitor, FiCheck, FiX, FiRefreshCw 
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
  const [role, setRole] = useState('viewer');
  const [permissions, setPermissions] = useState(['overview', 'products', 'salesperson', 'comparison', 'financials', 'channel', 'upload']);

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

  useEffect(() => {
    fetchUsers();
    if (user.role === 'admin') {
      fetchSecurityData();
    }
  }, []);

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

    try {
      if (isEditMode) {
        await adminUpdateUser(editingUserId, { role, permissions, password: password.trim() ? password : undefined });
        toast.success('User updated successfully');
      } else {
        await adminCreateUser({ username, password, role, permissions });
        toast.success('User created successfully');
      }
      
      // Reset State
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setRole('viewer');
      setPermissions(['overview', 'products', 'salesperson', 'comparison', 'financials', 'channel', 'upload']);
      setIsEditMode(false);
      setEditingUserId(null);
      fetchUsers();
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
    setRole(userObj.role);
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
    setRole('viewer');
    setPermissions(['overview', 'products', 'salesperson', 'comparison', 'upload']);
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
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>System Role</label>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', outline: 'none' }}
                >
                  <option value="viewer">Viewer (Restricted)</option>
                  <option value="admin">Administrator (Full access)</option>
                </select>
              </div>

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

              {role === 'viewer' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Module Access Permissions</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', background: 'var(--bg-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {availableModules.map(mod => (
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
                {users.map(u => (
                  <div 
                    key={u._id} 
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{u.username}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: u.role === 'admin' ? '#fee2e2' : '#dbeafe', color: u.role === 'admin' ? '#ef4444' : '#2563eb', fontWeight: 600 }}>{u.role}</span>
                        {u.role === 'viewer' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Perms: {(u.permissions || []).join(', ') || 'None'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
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
                ))}
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
    </div>
  );
};

export default AdminPanel;
