import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiMenu } from 'react-icons/fi';

import { getProfile } from './services/api';
import { clearGlobalFilters } from './utils/globalFilters';
import { MANUAL_UPLOAD_ENABLED } from './config';
import Sidebar from './components/Sidebar';
import StickyNotes from './components/StickyNotes';
import NotificationPanel from './components/NotificationPanel';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Products from './pages/Products';
import Salesperson from './pages/Salesperson';
import Geographic from './pages/Geographic';
import Comparison from './pages/Comparison';
import Clients from './pages/Clients';
import Branch from './pages/Branch';
import ProductComparison from './pages/ProductComparison';
import AdminPanel from './pages/AdminPanel';
import LogsPanel from './pages/LogsPanel';
import DataLogs from './pages/DataLogs';
import SalespersonChange from './pages/SalespersonChange';
import Financial from './pages/Financial';
import Channel from './pages/Channel';

// No Access Page Component
const NoAccessPage = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '20px' }}>
    <h1 style={{ color: 'var(--text-primary)', textAlign: 'center', fontSize: '2.5rem', fontWeight: 700 }}>Contact Admin for Access</h1>
    <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px', fontSize: '1.1rem' }}>You currently have no active permissions assigned.</p>
  </div>
);

// Protected View Wrapper
const ProtectedView = ({ permission, children }) => {
  const user = JSON.parse(sessionStorage.getItem('flexibond_user') || '{}');
  // Both admin tiers bypass module permissions; their DATA is still bounded by their scope.
  const isAdmin = user.role === 'admin' || user.role === 'companyadmin';
  const perms = user.permissions || [];

  // Company accounts always get the VIEW-ONLY Upload section (2026-08-06), even without the perm.
  const companyUpload = permission === 'upload' && user.scopeType === 'company';

  if (isAdmin || perms.includes(permission) || companyUpload) {
    return children;
  }
  return <Navigate to="/no-access" replace />;
};

// Default Route Calculator
const DefaultRedirect = () => {
  const user = JSON.parse(sessionStorage.getItem('flexibond_user') || '{}');
  if (!user || !user.role) return <Navigate to="/login" replace />;
  if (user.role === 'admin' || user.role === 'companyadmin') return <Navigate to="/dashboard" replace />;

  const perms = user.permissions || [];
  if (perms.includes('overview')) return <Navigate to="/dashboard" replace />;
  if (perms.includes('products')) return <Navigate to="/products" replace />;
  if (perms.includes('salesperson')) return <Navigate to="/salesperson" replace />;
  if (perms.includes('comparison')) return <Navigate to="/comparison" replace />;
  if (perms.includes('financials')) return <Navigate to="/financial" replace />;
  if (perms.includes('channel')) return <Navigate to="/channel" replace />;
  if (MANUAL_UPLOAD_ENABLED && perms.includes('upload')) return <Navigate to="/upload" replace />;

  return <Navigate to="/no-access" replace />;
};

// Auth Guard component
const PrivateRoute = () => {
  const token = sessionStorage.getItem('flexibond_token');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('flexibond_user') || '{}'));

  useEffect(() => {
    if (!token) return;

    // Refresh user profile/permissions periodically/on-navigation
    getProfile()
      .then(res => {
        if (res.data && res.data.user) {
          sessionStorage.setItem('flexibond_user', JSON.stringify(res.data.user));
          setUser(res.data.user);
        }
      })
      .catch(err => {
        console.error('Session validation failed:', err);
      });
  }, [token]);

  // Admin inactivity auto-logout (2026-08-06): an admin session ends after 1 minute with no
  // mouse / keyboard / touch / scroll activity, then bounces to the login screen. Only admin
  // accounts (e.g. the master "flexibond" login) are affected; viewers/scoped stay logged in.
  useEffect(() => {
    // Both admin tiers hold master controls, so both get the idle auto-logout.
    if (!token || !(user.role === 'admin' || user.role === 'companyadmin')) return;
    const IDLE_MS = 600 * 1000;
    let timer;
    const logout = () => {
      sessionStorage.removeItem('flexibond_token');
      sessionStorage.removeItem('flexibond_user');
      clearGlobalFilters();
      window.location.assign('/login?reason=idle');
    };
    const reset = () => { clearTimeout(timer); timer = setTimeout(logout, IDLE_MS); };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [token, user.role]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isSidebarOpen]);

  return (
    <div className={`app-layout ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      <header className="mobile-header">
        <button className="menu-toggle" onClick={toggleSidebar}>
          <FiMenu />
        </button>
        <div className="mobile-logo">Flexibond</div>
      </header>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={user} />

      {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>}

      <main className="main-content">
        <Outlet />
      </main>

      {/* Right-edge sticky notes from admin (self-hides when the account has none). */}
      <StickyNotes />
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<PrivateRoute />}>
          <Route path="/" element={<DefaultRedirect />} />
          <Route path="/no-access" element={<NoAccessPage />} />
          <Route path="/dashboard" element={<ProtectedView permission="overview"><Dashboard /></ProtectedView>} />
          <Route path="/products" element={<ProtectedView permission="products"><Products /></ProtectedView>} />
          <Route path="/salesperson" element={<ProtectedView permission="salesperson"><Salesperson /></ProtectedView>} />
          <Route path="/geographic" element={<ProtectedView permission="geographic"><Geographic /></ProtectedView>} />
          <Route path="/comparison" element={<ProtectedView permission="comparison"><Comparison /></ProtectedView>} />
          <Route path="/clients" element={<ProtectedView permission="clients"><Clients /></ProtectedView>} />
          <Route path="/branch" element={<ProtectedView permission="branch"><Branch /></ProtectedView>} />
          <Route path="/product-comparison" element={<ProtectedView permission="products"><ProductComparison /></ProtectedView>} />
          <Route path="/upload" element={MANUAL_UPLOAD_ENABLED ? <ProtectedView permission="upload"><Upload /></ProtectedView> : <Navigate to="/no-access" replace />} />
          <Route path="/financial" element={<ProtectedView permission="financials"><Financial /></ProtectedView>} />
          <Route path="/channel" element={<ProtectedView permission="channel"><Channel /></ProtectedView>} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/logs" element={<LogsPanel />} />
          <Route path="/data-logs" element={<DataLogs />} />
          <Route path="/salesperson-change" element={<SalespersonChange />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
