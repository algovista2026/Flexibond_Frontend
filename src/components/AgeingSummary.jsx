import React from 'react';
import { BUCKET_COLORS, BUCKET_KEYS, BUCKET_LABELS, money2 } from '../utils/accountingFormat';

// ────────────────────────────────────────────────────────────────────────────
// AgeingSummary — the "details of the page" box on both Accounting pages + their ledgers
// (added 2026-10-09). One line per ageing bucket: colour RECTANGLE · bucket · amount pending ·
// % of the total · bills (· clients). Styled after the Dashboard per-company target table.
//
// `amounts`  bucket → net amount (b0…b90 + total), as the page's Grand Total row shows it.
// `bills`    flat list of pending bills `{ age, amount, bucket, client? }` — for the counts.
// `showClients` adds the Clients column (outstandings pages; meaningless on a single ledger).
// The % is of the NET total, so a bucket that holds an unadjusted credit can read slightly
// differently from its bills alone — the amounts are exactly the table's, which is the point.
// ────────────────────────────────────────────────────────────────────────────
const AgeingSummary = ({ title = 'Ageing Summary', subtitle, amounts, bills = [], showClients = false }) => {
  const total = amounts?.total || 0;
  const count = (k) => bills.filter(b => b.bucket === k).length;
  const clients = (k) => new Set(bills.filter(b => b.bucket === k).map(b => b.client)).size;

  return (
    <div className="chart-card acc-summary">
      <div className="acc-summary-head">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <table className="acc-summary-table">
        <thead>
          <tr>
            <th>Ageing</th>
            <th className="num">Pending</th>
            <th className="num">%</th>
            <th className="num">Bills</th>
            {showClients && <th className="num">Clients</th>}
          </tr>
        </thead>
        <tbody>
          {BUCKET_KEYS.map((k) => {
            const v = amounts?.[k] || 0;
            const pct = total ? (v / total) * 100 : 0;
            return (
              <tr key={k} className={Math.abs(v) < 0.5 ? 'is-empty' : ''}>
                <td><span className="acc-rect" style={{ background: BUCKET_COLORS[k] }} />{BUCKET_LABELS[k]}</td>
                <td className="num">{v < 0 ? `${money2(-v)} Cr` : money2(v) || '—'}</td>
                <td className="num strong">{Math.abs(v) < 0.5 ? '—' : `${pct.toFixed(1)}%`}</td>
                <td className="num">{count(k) || '—'}</td>
                {showClients && <td className="num">{clients(k) || '—'}</td>}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td><span className="acc-rect acc-rect-total" />Total</td>
            <td className="num">{money2(total) || '—'}</td>
            <td className="num">{total ? '100%' : '—'}</td>
            <td className="num">{bills.length || '—'}</td>
            {showClients && <td className="num">{new Set(bills.map(b => b.client)).size || '—'}</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default AgeingSummary;
