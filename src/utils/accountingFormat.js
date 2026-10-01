// ────────────────────────────────────────────────────────────────────────────
// utils/accountingFormat.js — shared by Accounting (demo) and Accounting 2 (Tally, Guwahati).
// Kuber/Tally print conventions: "20,47,644.00 Dr", "20-Apr-26"; ageing bucket keys b0…b90.
// ────────────────────────────────────────────────────────────────────────────
import { formatINR, formatINRShort } from './numberFormat';

// Ageing colours run green → red so the eye reads risk left to right.
export const BUCKET_COLORS = { b0: '#10b981', b30: '#84cc16', b45: '#f59e0b', b60: '#f97316', b90: '#ef4444' };
export const BUCKET_KEYS = ['b0', 'b30', 'b45', 'b60', 'b90'];
export const BUCKET_LABELS = { b0: '< 30 days', b30: '30 to 45 days', b45: '45 to 60 days', b60: '60 to 90 days', b90: '> 90 days' };

const amt2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Kuber style: "20,47,644.00 Dr" / "8,23,738.00 Cr"; blank for zero.
export const drCr = (v) => {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  if (!n) return '';
  return `${amt2.format(Math.abs(n))} ${n > 0 ? 'Dr' : 'Cr'}`;
};
export const money2 = (v) => (v ? amt2.format(v) : '');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "20-Apr-26", as Kuber prints it (en-GB would give "Sept").
export const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getUTCDate()}-${MONTHS[x.getUTCMonth()]}-${String(x.getUTCFullYear()).slice(2)}`;
};
export const monthLabel = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return `${MONTHS[mo - 1]} ${String(y).slice(2)}`;
};
export const moneyAxis = { ticks: { callback: (v) => formatINRShort(v) } };
export const moneyTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label || ctx.label}: ${formatINR(ctx.raw)}` } };
// LOCAL calendar date — toISOString() is UTC and reads as yesterday before 05:30 IST.
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const downloadSheet = (rows, sheet, file) => {
  if (!window.XLSX) return;
  const ws = window.XLSX.utils.json_to_sheet(rows);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, sheet);
  window.XLSX.writeFile(wb, file);
};

// Horizontal stacked-by-bucket bar (Top debtors). Plain builder, not a component (see CLAUDE.md).
export const bucketStack = (rows, labelKey) => ({
  labels: rows.map(r => r[labelKey]),
  datasets: BUCKET_KEYS.map(k => ({
    label: BUCKET_LABELS[k],
    data: rows.map(r => Math.max(0, r[k] || 0)),
    backgroundColor: BUCKET_COLORS[k],
    borderRadius: 3,
    stack: 'a',
  })),
});
