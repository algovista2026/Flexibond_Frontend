import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiX } from 'react-icons/fi';
import { formatINRShort } from '../utils/numberFormat';

// ────────────────────────────────────────────────────────────────────────────
// RevenueRangeFilter — a From/To revenue band for the Client Analytics list (added 2026-09-24).
//
// Two dropdown buttons plus a Clear. Either side may be left OPEN, which is the point of the
// control: leaving "To" open reads "₹2 L and above", leaving "From" open reads "₹2 L and below".
// Each side offers presets or a custom amount.
//
// ⚠️ `null` means UNBOUNDED on that side and is NOT interchangeable with 0. Real clients carry
// NEGATIVE revenue (net sales returns — the lowest live value is −₹8,446), so defaulting the lower
// bound to 0 would quietly drop them from "no minimum". Callers must pass null through to the API
// as an absent parameter, never as a 0.
//
// ⚠️ The parent sends these to the server rather than filtering the fetched array — the list is
// capped at the top 500 clients by revenue and there are 794, so a browser-side filter would only
// ever search the richest 500. See routes/clients.js for the full reasoning.
// ────────────────────────────────────────────────────────────────────────────

// Presets in rupees, ascending. Six, client-chosen 2026-09-24 — the bands they actually sort
// accounts into. Anything off this ladder goes through the Custom field.
const PRESETS = [1000000, 2500000, 5000000, 7500000, 10000000, 12500000];

const ACCENT = '#0ea5e9';

// A single From/To dropdown.
const Side = ({ side, value, onPick }) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const wrapRef = useRef(null);

  // Close on outside click / Escape. Without the Escape branch the popover is a keyboard trap on
  // desktop, and without the pointerdown branch it stays open behind the other side's popover.
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
  const label = value === null || value === undefined ? openLabel : formatINRShort(value);
  const active = value !== null && value !== undefined;

  const pick = (v) => { onPick(v); setCustom(''); setOpen(false); };
  const applyCustom = () => {
    const n = Number(String(custom).replace(/[,\s₹]/g, ''));
    if (!Number.isFinite(n) || String(custom).trim() === '') return;
    pick(n);
  };

  return (
    <div className="rev-range-side" ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={`${isFrom ? 'Minimum' : 'Maximum'} revenue (Excl. Taxes)`}
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
            // Matches the button it hangs from (now 300px) rather than a fixed 232px, which
            // looked detached under the wider control. The min keeps the 2-col preset grid
            // readable if the button is ever narrowed again.
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, width: '100%', minWidth: '232px',
            background: '#fff', border: '1px solid var(--border-color)', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '10px',
          }}
        >
          {/* The open-ended option first — it is the one that makes "and above" / "and below" work,
              so it should not be buried under the presets. */}
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
              {isFrom ? 'Include everything below the "To" value' : 'Everything from the "From" value and above'}
            </span>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
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
                {formatINRShort(v)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="number"
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustom(); } }}
              placeholder="Custom ₹"
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

const RevenueRangeFilter = ({ min, max, onChange }) => {
  const isSet = min !== null || max !== null;
  // ⚠️ Compared with `!= null` so a legitimate 0 bound is respected on both sides.
  const inverted = min !== null && max !== null && min > max;

  return (
    <div className="rev-range" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span className="rev-range-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        Revenue
      </span>
      <Side side="from" value={min} onPick={(v) => onChange({ min: v, max })} />
      <Side side="to" value={max} onPick={(v) => onChange({ min, max: v })} />
      {isSet && (
        <button
          type="button"
          onClick={() => onChange({ min: null, max: null })}
          title="Clear the revenue range"
          style={{
            height: '38px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0 12px',
            borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff',
            color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <FiX size={14} /> Clear
        </button>
      )}
      {/* A reversed band returns nothing, which looks identical to "no matching clients". Say so. */}
      {inverted && (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', whiteSpace: 'nowrap' }}>
          From is above To
        </span>
      )}
    </div>
  );
};

export default RevenueRangeFilter;
