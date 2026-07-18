import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiMenu } from 'react-icons/fi';

import { getProfile } from './services/api';
import Sidebar from './components/Sidebar';
import NotificationPanel from './components/NotificationPanel';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Products from './pages/Products';
import Salesperson from './pages/Salesperson';
import Geographic from './pages/Geographic';
import Comparison from './pages/Comparison';
import Clients from './pages/Clients';
import ProductComparison from './pages/ProductComparison';
import AdminPanel from './pages/AdminPanel';
import LogsPanel from './pages/LogsPanel';
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
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const isAdmin = user.role === 'admin';
  const perms = user.permissions || [];
  
  if (isAdmin || perms.includes(permission)) {
    return children;
  }
  return <Navigate to="/no-access" replace />;
};

// Default Route Calculator
const DefaultRedirect = () => {
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  if (!user || !user.role) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/dashboard" replace />;
  
  const perms = user.permissions || [];
  if (perms.includes('overview')) return <Navigate to="/dashboard" replace />;
  if (perms.includes('products')) return <Navigate to="/products" replace />;
  if (perms.includes('salesperson')) return <Navigate to="/salesperson" replace />;
  if (perms.includes('comparison')) return <Navigate to="/comparison" replace />;
  if (perms.includes('financials')) return <Navigate to="/financial" replace />;
  if (perms.includes('channel')) return <Navigate to="/channel" replace />;
  if (perms.includes('upload')) return <Navigate to="/upload" replace />;

  return <Navigate to="/no-access" replace />;
};

// Auth Guard component
const PrivateRoute = () => {
  const token = localStorage.getItem('flexibond_token');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('flexibond_user') || '{}'));
  
  useEffect(() => {
    if (!token) return;
    
    // Refresh user profile/permissions periodically/on-navigation
    getProfile()
      .then(res => {
        if (res.data && res.data.user) {
          localStorage.setItem('flexibond_user', JSON.stringify(res.data.user));
          setUser(res.data.user);
        }
      })
      .catch(err => {
        console.error('Session validation failed:', err);
      });
  }, [token]);

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
          <Route path="/geographic" element={<ProtectedView permission="salesperson"><Geographic /></ProtectedView>} />
          <Route path="/comparison" element={<ProtectedView permission="comparison"><Comparison /></ProtectedView>} />
          <Route path="/clients" element={<ProtectedView permission="clients"><Clients /></ProtectedView>} />
          <Route path="/product-comparison" element={<ProtectedView permission="products"><ProductComparison /></ProtectedView>} />
          <Route path="/upload" element={<ProtectedView permission="upload"><Upload /></ProtectedView>} />
          <Route path="/financial" element={<ProtectedView permission="financials"><Financial /></ProtectedView>} />
          <Route path="/channel" element={<ProtectedView permission="channel"><Channel /></ProtectedView>} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/logs" element={<LogsPanel />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
