import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

/**
 * Lightweight multi-select dropdown (checkbox list) styled to match FilterBar.
 *
 * Props:
 *  - label:     placeholder shown when nothing is selected (e.g. "All Salespersons")
 *  - options:   string[] of selectable values
 *  - selected:  string[] currently-selected values (tolerates a bare string too)
 *  - onChange:  (nextArray) => void
 */
const MultiSelect = ({ label, options = [], selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Normalise: FilterBar/GlobalSearch may hand us a string, undefined, or array
  const sel = Array.isArray(selected) ? selected : (selected ? [selected] : []);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (val) => {
    if (sel.includes(val)) onChange(sel.filter(v => v !== val));
    else onChange([...sel, val]);
  };

  const display = sel.length === 0
    ? label
    : sel.length === 1
      ? sel[0]
      : `${sel.length} selected`;

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '150px' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={sel.length > 1 ? sel.join(', ') : undefined}
        style={{
          height: '42px', width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '6px', padding: '0 12px',
          borderRadius: '8px', border: '1px solid var(--border-color)',
          background: sel.length ? 'var(--primary-50, #eff6ff)' : '#fff',
          color: sel.length ? 'var(--primary-600)' : 'var(--text-primary)',
          fontWeight: sel.length ? 600 : 400, cursor: 'pointer', fontSize: '0.9rem',
          whiteSpace: 'nowrap', overflow: 'hidden'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{display}</span>
        <FiChevronDown size={16} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
            width: 'max(100%, 220px)', maxHeight: '280px', overflowY: 'auto',
            background: '#fff', border: '1px solid var(--border-color)',
            borderRadius: '8px', boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.12))',
            padding: '8px'
          }}
        >
          <input
            type="text"
            autoFocus
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', marginBottom: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.85rem' }}
          />
          {sel.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              style={{ width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Clear selection
            </button>
          )}
          {filtered.length === 0 && (
            <div style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No matches</div>
          )}
          {filtered.map(opt => {
            const isSel = sel.includes(opt);
            return (
              <div
                key={opt}
                onClick={() => toggle(opt)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', background: isSel ? 'var(--primary-50, #eff6ff)' : 'transparent' }}
              >
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${isSel ? 'var(--primary-600)' : 'var(--border-color)'}`, background: isSel ? 'var(--primary-600)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isSel && <FiCheck size={12} color="#fff" />}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
