import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiFileText, FiCheckCircle, FiXCircle, FiTrash2, FiClock } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { uploadFile, getUploadHistory, deleteUpload, purgeAllData, API_BASE_URL } from '../services/api';
import NotificationPanel from '../components/NotificationPanel';
import { BRANCH_GROUPS, branchLabel } from '../utils/branchConfig';

import { TableSkeleton } from '../components/Skeleton';

const Upload = () => {
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const isAdmin = user.role === 'admin';
  const permissions = user.permissions || ['overview', 'products', 'salesperson', 'comparison', 'upload'];
  // Company accounts get a VIEW-ONLY Upload section (2026-08-06): history only, no upload / delete /
  // purge, and the history is limited server-side to their own company's branches.
  const viewOnly = user.scopeType === 'company';

  if (!isAdmin && !permissions.includes('upload') && !viewOnly) {
    return (
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <FiXCircle size={48} color="var(--danger)" />
        <h2 style={{ color: 'var(--text-primary)' }}>Access Restricted</h2>
        <p style={{ color: 'var(--text-secondary)' }}>You do not have permission to access the Data Upload area.</p>
      </div>
    );
  }

  const [file, setFile] = useState(null);
  // Optional branch tag for the file being uploaded ('' = legacy / no branch).
  const [branch, setBranch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [logs, setLogs] = useState([]);
  const [sessionId, setSessionId] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await getUploadHistory();
      if (res.data && res.data.uploads) {
        setHistory(res.data.uploads);
      }
    } catch (err) {
      toast.error('Failed to load upload history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handlePurgeAll = async (type, label) => {
    const confirmed = window.confirm(
      `⚠️ DANGER: This will permanently delete ALL ${label} records from the database, including any records not tracked in the history below.\n\nThis cannot be undone. Type OK to continue.`
    );
    if (!confirmed) return;
    try {
      const res = await purgeAllData(type);
      toast.success(res.data.message);
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Purge failed');
    }
  };

  const handleDeleteUpload = async (uploadId) => {
    if (!window.confirm('Are you sure you want to delete this upload? ALL associated records will be permanently removed!')) {
      return;
    }
    try {
      const res = await deleteUpload(uploadId);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchHistory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Deletion failed');
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    disabled: uploading
  });

  const handleUpload = async () => {
    if (!file) return;

    const newSessionId = `up_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setSessionId(newSessionId);
    setLogs([]);
    setResult(null);

    // Setup SSE connection for logs
    const eventSource = new EventSource(`${API_BASE_URL}/upload/events/${newSessionId}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogs(prev => [...prev, data]);
      
      // Auto-scroll logic could be added here if needed
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    try {
      setUploading(true);
      setProgress(10);
      
      const res = await uploadFile(file, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setProgress(Math.min(percentCompleted / 2, 50));
      }, newSessionId, branch);

      if (res.data.success) {
        setProgress(100);
        setResult(res.data.result);
        toast.success(res.data.message);
        setFile(null);
        setBranch('');
        fetchHistory();
      }
    } catch (err) {
      setProgress(0);
      setResult({
        error: true,
        message: err.response?.data?.message || 'Upload failed',
        details: err.response?.data?.existingUpload
      });
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setTimeout(() => eventSource.close(), 2000); // Close after a short delay
    }
  };

  useEffect(() => {
    if (logs.length > 0) {
      const el = document.getElementById('log-end');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Helper for log colors
  const getLogColor = (type) => {
    switch(type) {
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'success': return '#10b981';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Data Upload</h1>
          <p>{viewOnly
            ? 'View the upload history for your company\'s branches. This section is read-only for your account.'
            : 'Upload Excel or PDF files containing sales, inventory, or billing data.'}</p>
        </div>
        {isAdmin && <NotificationPanel />}
      </div>

      {!viewOnly && (
      <div
        {...getRootProps()}
        className={`upload-zone ${isDragActive ? 'active' : ''} ${uploading ? 'disabled' : ''}`}
        style={uploading ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
      >
        <input {...getInputProps()} />
        <FiUploadCloud className="upload-icon" />
        {isDragActive ? (
          <h3>Drop the file here...</h3>
        ) : (
          <h3>Drag & drop a file here, or click to select</h3>
        )}
        <p>Supports .xlsx, .xls, and .pdf files (Max 50MB)</p>
      </div>
      )}

      {!viewOnly && file && !uploading && !result && (
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FiFileText style={{ fontSize: '1.5rem', color: 'var(--primary-500)' }} />
            <div>
              <div style={{ fontWeight: 600 }}>{file.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          </div>

          {/* Branch selector — tag this file to the branch it came from (Company › Branch).
              Leave as "No branch" for old-style uploads that don't belong to a branch. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Branch (optional)
            </label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              style={{ minWidth: '240px', height: '42px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-light)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
            >
              <option value="">No branch (legacy / all-company upload)</option>
              {BRANCH_GROUPS.map((g) => (
                <optgroup key={g.company} label={g.label}>
                  {g.branches.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <button className="filter-bar btn-primary" onClick={handleUpload} style={{ margin: 0 }}>
            Upload{branch ? ` · ${branchLabel(branch)}` : ''} & Process
          </button>
        </div>
      )}

      {uploading && (
        <div style={{ marginTop: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
            <span>Processing {file?.name}...</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: '8px', background: 'var(--primary-100)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary-500)', transition: 'width 0.3s ease' }}></div>
          </div>
          
          <div className="progress-steps">
            <div className={`progress-step ${progress >= 10 ? 'done' : 'active'}`}>
              <div className="step-circle">1</div>
              <span>Uploading</span>
            </div>
            <div className={`progress-step ${progress >= 50 ? 'done' : progress >= 10 ? 'active' : ''}`}>
              <div className="step-circle">2</div>
              <span>Parsing</span>
            </div>
            <div className={`progress-step ${progress >= 100 ? 'done' : progress >= 50 ? 'active' : ''}`}>
              <div className="step-circle">3</div>
              <span>Classifying & Saving</span>
            </div>
          </div>
        </div>
      )}

      {/* Live Log Terminal - Shown during upload OR if logs exist */}
      {(uploading || logs.length > 0) && (
        <div style={{ marginTop: '24px', background: '#0f172a', borderRadius: '12px', padding: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }}></div>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '8px', fontFamily: 'monospace' }}>upload-log.cmd</span>
            </div>
            {!uploading && (
              <button 
                onClick={() => setLogs([])}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Clear & Close Logs
              </button>
            )}
          </div>
          <div style={{ height: '200px', overflowY: 'auto', fontFamily: '"Fira Code", monospace', fontSize: '0.85rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {logs.length === 0 && <div style={{ color: '#64748b' }}>Initializing live log stream...</div>}
            {logs.map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px' }}>
                <span style={{ color: '#475569', minWidth: '85px' }}>[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                <span style={{ color: getLogColor(log.type) }}>{log.message}</span>
              </div>
            ))}
            <div id="log-end"></div>
          </div>
        </div>
      )}

      {result && !result.error && (
        <div style={{ marginTop: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--success)', marginBottom: '16px' }}>
            <FiCheckCircle size={24} />
            <h3 style={{ margin: 0 }}>Upload Completed Successfully</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Detected Data Type: <strong>{result.dataType.replace(/_/g, ' ').toUpperCase()}</strong></p>
          
          <div className="result-cards">
            <div className="result-card total">
              <div className="rc-value">{result.totalRecords}</div>
              <div className="rc-label">Total Records Found</div>
            </div>
            <div className="result-card inserted">
              <div className="rc-value">{result.inserted}</div>
              <div className="rc-label">Records Inserted</div>
            </div>
            <div className="result-card duplicates">
              <div className="rc-value">{result.duplicates}</div>
              <div className="rc-label">Duplicates Skipped</div>
            </div>
            <div className="result-card errors">
              <div className="rc-value">{result.errors}</div>
              <div className="rc-label">Errors</div>
            </div>
          </div>

          {result.duplicateRows && result.duplicateRows.length > 0 && (
            <div style={{ marginTop: '30px', padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ color: 'var(--warning)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Skipped Duplicates Log
              </h4>
              <div style={{ maxHeight: '250px', overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '400px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-light)', zIndex: 5 }}>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>Row / Sr.No</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>Identifier</th>
                      <th style={{ padding: '10px' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.duplicateRows.map((dup, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{dup.srNo || idx + 1}</td>
                        <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{dup.identifier}</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{dup.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.errorMessages && result.errorMessages.length > 0 && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ color: 'var(--danger)', marginBottom: '10px' }}>Error Details:</h4>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', paddingLeft: '20px' }}>
                {result.errorMessages.map((msg, i) => <li key={i}>{msg}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {result && result.error && (
        <div style={{ marginTop: '30px', padding: '20px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', marginBottom: '16px' }}>
            <FiXCircle size={24} />
            <h3 style={{ margin: 0 }}>Upload Failed</h3>
          </div>
          <p style={{ color: 'var(--danger)' }}>{result.message}</p>
          
          {result.details && (
            <div style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <p><strong>File Name:</strong> {result.details.fileName}</p>
              <p><strong>Upload Date:</strong> {new Date(result.details.uploadDate).toLocaleString()}</p>
              <p><strong>Data Type:</strong> {result.details.dataType}</p>
              <p><strong>Records:</strong> {result.details.insertedCount}</p>
            </div>
          )}
        </div>
      )}
      {/* Upload History & Rollback UI */}
      <div className="chart-card" style={{ padding: '24px', marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-600)' }}>
            <FiClock /> Upload & Rollback History
          </h3>
          {isAdmin && (
            <button
              onClick={() => handlePurgeAll('invoices', 'Invoice & Invoice Item')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--danger)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
            >
              <FiTrash2 size={14} /> Purge All Invoice Data
            </button>
          )}
        </div>
        
        {loadingHistory && history.length === 0 ? (
          <TableSkeleton />
        ) : history.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>No previous uploads recorded.</p>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 16px' }}>File Name</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Data Type</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Branch</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Date Uploaded</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Records</th>
                  {!viewOnly && <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item._id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.87rem' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.fileName}</td>
                    <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.dataType?.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.branch ? branchLabel(item.branch) : '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(item.uploadDate || item.createdAt).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{item.insertedCount}</td>
                    {!viewOnly && (
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteUpload(item._id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '8px', borderRadius: '4px' }}
                        title="Delete Upload Data"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;
