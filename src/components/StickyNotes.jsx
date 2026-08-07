import React, { useState, useEffect, useCallback } from 'react';
import { FiMessageSquare, FiThumbsUp, FiThumbsDown, FiChevronRight } from 'react-icons/fi';
import { getMyNotes, reactToNote } from '../services/api';

// Right-edge sticky notes for the logged-in account (2026-08-08). Admins write these from User
// Management; the recipient sees them read-only here and can only react 👍 / 👎. Collapsed to a
// small tab on the right; hover (or tap) to expand the panel. Renders nothing if there are none.
const StickyNotes = () => {
  const [notes, setNotes] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyNotes();
      setNotes(res.data?.data || []);
    } catch {
      /* silently ignore — notes are a non-critical overlay */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // pick up newly-sent notes
    return () => clearInterval(t);
  }, [load]);

  const react = async (id, current, value) => {
    const next = current === value ? 'none' : value; // click again to clear
    // optimistic
    setNotes(prev => prev.map(n => (n._id === id ? { ...n, reaction: next } : n)));
    try {
      await reactToNote(id, next);
    } catch {
      load(); // revert to server truth on failure
    }
  };

  if (!loaded || notes.length === 0) return null;

  const unreacted = notes.filter(n => n.reaction === 'none').length;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        position: 'fixed', top: '50%', right: 0, transform: 'translateY(-50%)',
        zIndex: 1200, display: 'flex', alignItems: 'stretch'
      }}
    >
      {/* Expanded panel (slides in on hover) */}
      {expanded && (
        <div
          style={{
            width: 'min(340px, 86vw)', maxHeight: '70vh', overflowY: 'auto',
            background: '#fffdf5', border: '1px solid #f2e6b8',
            borderRadius: '12px 0 0 12px', boxShadow: '-6px 0 24px rgba(0,0,0,0.14)',
            padding: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--text-primary)' }}>
            <FiMessageSquare size={16} color="#b7962f" />
            <strong style={{ fontSize: '0.9rem' }}>Notes from Admin</strong>
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{notes.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notes.map(n => (
              <div
                key={n._id}
                style={{
                  background: '#fff', border: '1px solid #f0e6c6', borderRadius: '10px',
                  padding: '10px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {n.message}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {n.createdBy || 'admin'} · {fmtDate(n.createdAt)}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => react(n._id, n.reaction, 'up')}
                      title="Thumbs up"
                      style={reactBtn(n.reaction === 'up', '#16a34a', '#dcfce7')}
                    >
                      <FiThumbsUp size={14} />
                    </button>
                    <button
                      onClick={() => react(n._id, n.reaction, 'down')}
                      title="Thumbs down"
                      style={reactBtn(n.reaction === 'down', '#dc2626', '#fee2e2')}
                    >
                      <FiThumbsDown size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed tab (always visible) */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '4px', padding: '12px 8px', cursor: 'pointer',
          background: 'linear-gradient(135deg, #fde68a, #fcd34d)', color: '#78350f',
          borderRadius: expanded ? '0' : '12px 0 0 12px', boxShadow: '-3px 0 12px rgba(0,0,0,0.12)',
          position: 'relative', minWidth: '40px'
        }}
      >
        {expanded ? <FiChevronRight size={16} /> : <FiMessageSquare size={18} />}
        <span style={{ fontSize: '0.7rem', fontWeight: 700, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>NOTES</span>
        {!expanded && unreacted > 0 && (
          <span
            style={{
              position: 'absolute', top: '-6px', left: '-6px', minWidth: '18px', height: '18px',
              padding: '0 4px', borderRadius: '9px', background: '#dc2626', color: '#fff',
              fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }}
          >
            {unreacted}
          </span>
        )}
      </div>
    </div>
  );
};

const reactBtn = (active, color, bg) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '28px', height: '28px', borderRadius: '7px', cursor: 'pointer',
  border: `1px solid ${active ? color : 'var(--border-color)'}`,
  background: active ? bg : '#fff', color: active ? color : 'var(--text-muted)',
  transition: 'all 0.12s ease'
});

export default StickyNotes;
