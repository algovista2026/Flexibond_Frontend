import React from 'react';
import { formatCount, toIndianWords } from '../utils/numberFormat';

/**
 * Amount input for target modals (company turnover + salesperson).
 * QoL: quick-pick preset chips, live Indian comma-grouping shown IN the field as you type,
 * and a spelled-out amount below (e.g. "10,00,000  ·  10 Lakh rupees").
 *
 * Value is the raw digit string (e.g. "1000000"); the parent stores/saves that.
 *
 * Props:
 *  - value:    raw digit string
 *  - onChange: (digitString) => void
 *  - presets:  [{ label, value }]  e.g. { label: '10L', value: 1000000 }
 *  - label:    field label text
 */
const TargetAmountInput = ({ value, onChange, presets = [], label = 'Target amount (₹)' }) => {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  const num = digits ? Number(digits) : 0;

  const handleInput = (e) => {
    onChange(e.target.value.replace(/[^\d]/g, ''));
  };

  return (
    <div>
      {presets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {presets.map(p => {
            const active = num === p.value;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(String(p.value))}
                style={{ padding: '5px 12px', borderRadius: '999px', border: `1px solid ${active ? 'var(--primary-600)' : 'var(--border-color)'}`, background: active ? 'var(--primary-600)' : 'var(--bg-light, #f8fafc)', color: active ? '#fff' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={digits ? formatCount(num) : ''}
        onChange={handleInput}
        placeholder="e.g. 10,00,000"
        autoFocus
        style={{ width: '100%', padding: '10px 12px', margin: '6px 0 6px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.95rem', boxSizing: 'border-box' }}
      />
      <div style={{ minHeight: '18px', fontSize: '0.82rem', color: num > 0 ? 'var(--primary-600)' : 'var(--text-muted)', fontWeight: 600, marginBottom: '14px' }}>
        {num > 0 ? `₹${formatCount(num)}  ·  ${toIndianWords(num)}` : 'Enter or pick an amount'}
      </div>
    </div>
  );
};

export const SALESPERSON_TARGET_PRESETS = [
  { label: '5L', value: 500000 },
  { label: '10L', value: 1000000 },
  { label: '15L', value: 1500000 },
  { label: '25L', value: 2500000 },
  { label: '50L', value: 5000000 }
];

export const TURNOVER_TARGET_PRESETS = [
  { label: '1Cr', value: 10000000 },
  { label: '2Cr', value: 20000000 },
  { label: '5Cr', value: 50000000 },
  { label: '10Cr', value: 100000000 }
];

export default TargetAmountInput;
