import React, { useState, useEffect } from 'react';
import { FiList, FiRefreshCw, FiCalendar, FiClock, FiActivity } from 'react-icons/fi';
import { adminGetLogs } from '../services/api';
import { toast } from 'react-toastify';
import NotificationPanel from '../components/NotificationPanel';

const LogsPanel = () => {
  const user = JSON.parse(sessionStorage.getItem('flexibond_user') || '{}');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await adminGetLogs();
      if (res.data && res.data.logs) {
        setLogs(res.data.logs);
      }
    } catch (err) {
      toast.error('Failed to load system access logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatTimestamp = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'User Login': return '#10b981';
      case 'Login Attempt': return '#ef4444';
      case 'Data Upload': return '#3b82f6';
      case 'User Created': return '#8b5cf6';
      case 'User Deleted': return '#f59e0b';
      default: return 'var(--text-secondary)';
    }
  };

  const filteredLogs = logs.filter(log => 
    (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.details || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>System Logs</h1>
          <p>Real-time audit trails of logins, updates, and uploads.</p>
        </div>
        <div className="page-controls">
          <button
            onClick={fetchLogs}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            <FiRefreshCw className={loading ? 'spin' : ''} /> Refresh Logs
          </button>
          {user.role === 'admin' && <NotificationPanel />}
        </div>
      </div>

      <div className="chart-card" style={{ padding: '24px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-600)' }}>
            <FiActivity /> Operational Activity Stream
          </h3>
          <div style={{ flex: 1, minWidth: 0, maxWidth: '300px' }}>
            <input
              type="text"
              placeholder="Search logs by action, user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-light)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Fetching stream audit data...</p>
        ) : logs.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No audit traces found yet.</p>
        ) : filteredLogs.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No matching logs found for "{searchTerm}".</p>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Action</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Username</th>
                  <th style={{ padding: '12px 16px' }}>Details</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>IP / Source</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => (
                  <tr
                    key={log._id || i}
                    style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.87rem', background: i % 2 === 0 ? 'transparent' : 'var(--bg-light)' }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: getActionColor(log.action), whiteSpace: 'nowrap' }}>
                      {log.action}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {log.username}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.details}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {log.ip || 'Unknown'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(log.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
};

export default LogsPanel;
