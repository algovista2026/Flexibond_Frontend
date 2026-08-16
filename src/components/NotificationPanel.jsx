import React, { useState, useEffect, useRef } from 'react';
import { FiBell } from 'react-icons/fi';
import { adminGetLogs } from '../services/api';

const NotificationPanel = ({ isDark = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapperRef = useRef(null);

  const fetchRecentLogs = async () => {
    try {
      const user = JSON.parse(sessionStorage.getItem('flexibond_user') || '{}');
      if (user.role !== 'admin') return;

      const res = await adminGetLogs();
      if (res.data && res.data.logs) {
        const freshLogs = res.data.logs.slice(0, 10);
        
        if (logs.length > 0) {
          const latestStoredTime = new Date(logs[0].timestamp).getTime();
          const newItems = freshLogs.filter(l => new Date(l.timestamp).getTime() > latestStoredTime);
          if (newItems.length > 0) {
            setUnreadCount(prev => prev + newItems.length);
          }
        }
        setLogs(freshLogs);
      }
    } catch (err) {
      console.error('Error in notification polling:', err);
    }
  };

  useEffect(() => {
    fetchRecentLogs();
    const interval = setInterval(fetchRecentLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setUnreadCount(0);
  };

  const user = JSON.parse(sessionStorage.getItem('flexibond_user') || '{}');
  if (user.role !== 'admin') return null;

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button 
        onClick={toggleDropdown}
        style={{
          background: isDark ? 'transparent' : 'var(--bg-card)',
          border: isDark ? 'none' : '1px solid var(--border-color)',
          padding: isDark ? '6px' : '10px',
          borderRadius: '10px',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDark ? 'none' : 'var(--shadow-sm)'
        }}
      >
        <FiBell size={isDark ? 22 : 18} color={isDark ? '#fff' : 'var(--text-primary)'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '50%'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: isDark ? 'auto' : 0,
          left: isDark ? 0 : 'auto',
          width: '320px',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          border: '1px solid var(--border-color)',
          zIndex: 9999,
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-700)' }}>
            System Notifications (Live)
          </div>

          {logs.length === 0 ? (
            <p style={{ padding: '20px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No system activity tracked yet.
            </p>
          ) : (
            logs.map((log, index) => (
              <div 
                key={log._id || index} 
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: index < logs.length - 1 ? '1px solid var(--border-color)' : 'none',
                  fontSize: '0.8rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{log.action}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 600 }}>By: {log.username}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>{log.details}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
