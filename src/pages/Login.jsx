import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, verify2FA } from '../services/api';
import { clearGlobalFilters } from '../utils/globalFilters';
import { toast } from 'react-toastify';
import { FiEye, FiEyeOff } from 'react-icons/fi';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [devicePending, setDevicePending] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState('');
  const [deviceNickname, setDeviceNickname] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('flexibond_token');
    if (token) {
      navigate('/');
      return;
    }
    // Redirected here by the admin inactivity auto-logout → explain why.
    if (new URLSearchParams(window.location.search).get('reason') === 'idle') {
      toast.info('You were logged out due to inactivity.');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }

    try {
      setLoading(true);
      const res = await login(username, password, deviceNickname);
      
      if (res.data.requires2FA) {
        setDevicePending(false); // Hide device pending screen if 2FA is needed
        setRequires2FA(true);
        setTempToken(res.data.tempToken);
        toast.info('Please enter your 2FA code');
        return;
      }

      if (res.data.success) {
        setDevicePending(false); // Hide device pending screen on success
        handleSuccess(res.data);
      }
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.message === 'DEVICE_PENDING') {
        setDevicePending(true);
        setDeviceMessage(err.response.data.details);
      } else {
        toast.error(err.response?.data?.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    if (!twoFactorToken) return;

    try {
      setLoading(true);
      const res = await verify2FA(twoFactorToken, tempToken);
      if (res.data.success) {
        handleSuccess(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid 2FA code');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (data) => {
    localStorage.setItem('flexibond_token', data.token);
    localStorage.setItem('flexibond_user', JSON.stringify(data.user));
    clearGlobalFilters(); // start every fresh login on a clean, unfiltered dashboard
    toast.success('Login successful!');
    
    const user = data.user;
    let defaultRoute = '/dashboard';
    
    if (user.role === 'viewer') {
      const perms = user.permissions || [];
      if (perms.includes('overview')) defaultRoute = '/dashboard';
      else if (perms.includes('products')) defaultRoute = '/products';
      else if (perms.includes('salesperson')) defaultRoute = '/salesperson';
      else if (perms.includes('comparison')) defaultRoute = '/comparison';
      else if (perms.includes('financials')) defaultRoute = '/financial';
      else if (perms.includes('channel')) defaultRoute = '/channel';
      else if (perms.includes('upload')) defaultRoute = '/upload';
      else defaultRoute = '/no-access';
    }
    
    navigate(defaultRoute);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo-section">
          <img src="/flexibond-logo.png" alt="Flexibond — An Attachment" className="login-logo" />
        </div>

        {devicePending ? (
          <div className="device-pending-ui" style={{ textAlign: 'center', padding: '20px' }}>
            <div className="warning-icon" style={{ fontSize: '48px', marginBottom: '15px' }}>🔒</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Device Approval Required</h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              {deviceMessage}
            </p>
            
            {/* Show Nickname input ONLY if device is not named yet or we want to allow updating */}
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Device Nickname
              </label>
              <input
                type="text"
                value={deviceNickname}
                onChange={(e) => setDeviceNickname(e.target.value)}
                placeholder="e.g. Flexibond Office PC HP"
                style={{ marginTop: '5px' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                Give this device a name to help the Admin identify and approve it.
              </p>
            </div>

            <button 
              className="btn-login" 
              onClick={handleLogin}
              disabled={loading || !deviceNickname}
              style={{ width: '100%', padding: '12px', background: 'var(--primary-600)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              {loading ? 'Processing...' : (deviceMessage.includes('pending') ? 'Refresh / Check Approval' : 'Request Access')}
            </button>
            
            <button 
              type="button" 
              className="btn-text" 
              style={{ width: '100%', marginTop: '15px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
              onClick={() => {
                setDevicePending(false);
                setLoading(false);
              }}
            >
              Back to Login
            </button>
          </div>
        ) : requires2FA ? (
          <form onSubmit={handle2FAVerify}>
            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Two-Factor Authentication</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>
            <div className="form-group">
              <label>Verification Code</label>
              <input
                type="text"
                value={twoFactorToken}
                onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
                autoFocus
              />
            </div>
            <button type="submit" className="btn-login" disabled={loading} style={{ marginTop: '10px' }}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button 
              type="button" 
              className="btn-text" 
              style={{ width: '100%', marginTop: '15px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setRequires2FA(false)}
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '30px' }}>
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
