import React, { useState } from 'react';
import { FiZap, FiX, FiRefreshCw } from 'react-icons/fi';
import { getAIInsights } from '../services/api';
import { renderInsightsText } from '../utils/aiUtils.jsx';
import { enrichForAI } from '../utils/numberFormat';

const AIInsightButton = ({ contextData, contextType, title = 'Generate Insights', isBanner = false, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAIInsights(enrichForAI(contextData), contextType);
      setInsights(res.data.data);
      if (onToggle) {
        onToggle(true, res.data.data);
      } else {
        setIsOpen(true);
      }
    } catch (err) {
      setError('Failed to fetch AI insights. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (e) => {
    if (e) e.stopPropagation();
    if (onToggle && insights) {
      onToggle(!isOpen, insights);
      setIsOpen(!isOpen);
      return;
    }
    
    if (!isOpen && !insights) {
      fetchInsights();
    } else {
      setIsOpen(!isOpen);
      if (onToggle) onToggle(!isOpen, insights);
    }
  };

  if (isBanner) {
    return (
      <div style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', borderRadius: '12px', border: '1px solid #99f6e4', overflow: 'hidden' }}>
        <div 
          onClick={handleToggle}
          style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#0f766e', fontWeight: 600 }}>
            <FiZap size={20} className={loading ? 'spin-pulse' : ''} />
            <span>{title}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#0f766e' }}>
            {loading ? 'Analyzing Data...' : isOpen ? 'Hide Insights' : 'Show Insights'}
          </div>
        </div>
        
        {isOpen && (
          <div style={{ padding: '0 24px 20px 24px', borderTop: '1px solid rgba(153, 246, 228, 0.5)' }}>
            {error ? (
              <div style={{ color: '#ef4444', paddingTop: '16px', fontSize: '0.9rem' }}>{error}</div>
            ) : (
              <div style={{ paddingTop: '16px', color: '#115e59', fontSize: '0.95rem', lineHeight: '1.6' }}>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {renderInsightsText(insights)}
                </ul>
                <button 
                  onClick={(e) => { e.stopPropagation(); fetchInsights(); }}
                  style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#0f766e', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, padding: 0 }}
                >
                  <FiRefreshCw size={14} /> Regenerate
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={handleToggle}
        title={title}
        style={{
          background: 'var(--primary-50)',
          color: 'var(--primary-600)',
          border: 'none',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-100)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary-50)'}
      >
        <FiZap className={loading ? 'spin-pulse' : ''} size={16} />
      </button>

      {isOpen && !onToggle && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          width: '320px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05)',
          border: '1px solid var(--border-color)',
          zIndex: 100,
          overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiZap color="var(--primary-500)" /> AI Insights
            </span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <FiX />
            </button>
          </div>
          <div style={{ padding: '16px', maxHeight: '300px', overflowY: 'auto', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {error ? (
              <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {renderInsightsText(insights)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsightButton;
