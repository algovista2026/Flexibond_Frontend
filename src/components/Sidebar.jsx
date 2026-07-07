import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FiHome, FiUploadCloud, FiUsers, FiLogOut, FiBox, FiBarChart2, FiDollarSign, FiGitBranch, FiMap, FiLayers } from 'react-icons/fi';
import NotificationPanel from './NotificationPanel';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, user: propUser }) => {
  const navigate = useNavigate();
  const localUser = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const user = propUser || localUser;

  const handleLogout = () => {
    localStorage.removeItem('flexibond_token');
    localStorage.removeItem('flexibond_user');
    if (onClose) onClose();
    navigate('/login');
  };

  const isAdmin = user.role === 'admin';
  const permissions = user.permissions || ['overview', 'products', 'salesperson', 'comparison', 'upload', 'financials', 'channel'];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h2>Flexibond</h2>
        <p>Analytics Hub</p>
      </div>

      <nav className="sidebar-nav">
        {(isAdmin || permissions.includes('overview')) && (
          <NavLink to="/dashboard" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiHome className="nav-icon" />
            <span>Dashboard</span>
          </NavLink>
        )}
        {(isAdmin || permissions.includes('products')) && (
          <>
            <NavLink to="/products" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FiBox className="nav-icon" />
              <span>Products</span>
            </NavLink>
            <NavLink to="/product-comparison" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FiLayers className="nav-icon" />
              <span>Product Comparison</span>
            </NavLink>
          </>
        )}
        {(isAdmin || permissions.includes('salesperson')) && (
          <NavLink to="/salesperson" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiUsers className="nav-icon" />
            <span>Salesperson</span>
          </NavLink>
        )}
        {(isAdmin || permissions.includes('comparison')) && (
          <NavLink to="/comparison" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiBarChart2 className="nav-icon" />
            <span>Salesperson Comparison</span>
          </NavLink>
        )}
        {(isAdmin || permissions.includes('salesperson')) && (
          <NavLink to="/geographic" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiMap className="nav-icon" />
            <span>Geographic</span>
          </NavLink>
        )}
        {(isAdmin || permissions.includes('financials')) && (
          <NavLink to="/financial" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiDollarSign className="nav-icon" />
            <span>Financials</span>
          </NavLink>
        )}
        {(isAdmin || permissions.includes('channel')) && (
          <NavLink to="/channel" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiGitBranch className="nav-icon" />
            <span>Channel</span>
          </NavLink>
        )}
        
        {/* Admin and Upload Access */}
        {(isAdmin || permissions.includes('upload')) && (
          <NavLink to="/upload" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiUploadCloud className="nav-icon" />
            <span>Data Upload</span>
          </NavLink>
        )}

        {isAdmin && (
          <>
            <div style={{ padding: '16px 20px 8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin Only</div>
            <NavLink to="/admin" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FiUsers className="nav-icon" />
              <span>User Management</span>
            </NavLink>
            <NavLink to="/logs" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FiBarChart2 className="nav-icon" />
              <span>System Logs</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="avatar">{user.username ? user.username.charAt(0).toUpperCase() : 'U'}</div>
          <div className="details">
            <span className="name">{user.username || 'User'}</span>
            <span className="role">{user.role || 'Admin'}</span>
          </div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
