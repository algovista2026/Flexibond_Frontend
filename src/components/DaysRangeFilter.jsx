import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiX } from 'react-icons/fi';

// ────────────────────────────────────────────────────────────────────────────
// DaysRangeFilter — a From/To bill-AGE band for the two Accounting pages (added 2026-10-09).
// Modelled on RevenueRangeFilter (Client Analytics): two dropdowns + Clear, either side may be
// left OPEN ("30 days and above" / "up to 30 days"), presets or a custom number.
//
// Semantics (the caller applies it): a client matches when AT LEAST ONE of its pending bills is
// aged within the band, inclusive. Age = days since bill date as on the page's as-on date.
// ⚠️ `null` = unbounded on that side, and is not the same as 0 — 0 days is a real age (billed today).
// ────────────────────────────────────────────────────────────────────────────

const PRESETS = [0, 15, 30, 45, 60, 90];
const ACCENT = '#0ea5e9';
const daysLabel = (v) => `${v} day${v === 1 ? '' : 's'}`;

const Side = ({ side, value, onPick }) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const isFrom = side === 'from';
  const openLabel = isFrom ? 'No minimum' : 'No maximum';
  const active = value !== null && value !== undefined;
  const label = active ? daysLabel(value) : openLabel;

  const pick = (v) => { onPick(v); setCustom(''); setOpen(false); };
  const applyCustom = () => {
    const n = Math.floor(Number(String(custom).trim()));
    if (String(custom).trim() === '' || !Number.isFinite(n) || n < 0) return;
    pick(n);
  };

  return (
    <div className="rev-range-side days-range-side" ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={`${isFrom ? 'Minimum' : 'Maximum'} age of a pending bill`}
        style={{
          height: '38px', width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '8px', padding: '0 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
          whiteSpace: 'nowrap', background: '#fff',
          border: `1px solid ${active ? ACCENT : 'var(--border-color)'}`,
          color: active ? ACCENT : 'var(--text-secondary)',
        }}
      >
        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'baseline', overflow: 'hidden' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.78rem' }}>{isFrom ? 'From' : 'To'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </span>
        <FiChevronDown size={14} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div
          className="rev-range-pop"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, width: '100%', minWidth: '232px',
            background: '#fff', border: '1px solid var(--border-color)', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '10px',
          }}
        >
          <button
            type="button"
            onClick={() => pick(null)}
            style={{
              width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: '8px', borderRadius: '7px',
              cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              border: `1px solid ${!active ? ACCENT : 'var(--border-color)'}`,
              background: !active ? 'rgba(14,165,233,0.08)' : '#fff',
              color: !active ? ACCENT : 'var(--text-secondary)',
            }}
          >
            {openLabel}
            <span style={{ display: 'block', fontWeight: 500, fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {isFrom ? 'Every bill up to the "To" age' : 'Every bill from the "From" age and older'}
            </span>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
            {PRESETS.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => pick(v)}
                style={{
                  padding: '6px 4px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                  border: `1px solid ${value === v ? ACCENT : 'var(--border-color)'}`,
                  background: value === v ? ACCENT : '#fff',
                  color: value === v ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {v} d
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustom(); } }}
              placeholder="Custom days"
              style={{ flex: 1, minWidth: 0, height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
            <button
              type="button"
              onClick={applyCustom}
              style={{ padding: '0 12px', height: '32px', borderRadius: '6px', border: 'none', background: ACCENT, color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DaysRangeFilter = ({ min, max, onChange }) => {
  const isSet = min !== null || max !== null;
  const inverted = min !== null && max !== null && min > max;
  return (
    <div className="rev-range days-range" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span className="rev-range-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        Bill age
      </span>
      <Side side="from" value={min} onPick={(v) => onChange({ min: v, max })} />
      <Side side="to" value={max} onPick={(v) => onChange({ min, max: v })} />
      {isSet && (
        <button
          type="button"
          onClick={() => onChange({ min: null, max: null })}
          title="Clear the bill-age range"
          style={{
            height: '38px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0 12px',
            borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff',
            color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <FiX size={14} /> Clear
        </button>
      )}
      {inverted && (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', whiteSpace: 'nowrap' }}>From is above To</span>
      )}
    </div>
  );
};

// Shared matcher so both pages apply the band identically (inclusive, null = open).
export const ageInRange = (age, min, max) => (min === null || age >= min) && (max === null || age <= max);

export default DaysRangeFilter;
