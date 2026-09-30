// ────────────────────────────────────────────────────────────────────────────
// Accounting — receivables module (DEMO skeleton, added 2026-10-01).
//
// Two views, modelled on the two Kuber reports the client sent (Accounting/*.pdf):
//   • Group Outstandings — every client with pending bills, split into ageing buckets
//     (< 30 · 30–45 · 45–60 · 60–90 · > 90 days), plus KPIs + receivables charts.
//   • Ledger Account (?client=NAME) — one client's vouchers with Dr/Cr, running balance, closing
//     balance, and a bill-wise pending list.
//
// ⚠️ Client names are real; every bill, receipt and balance is SIMULATED server-side
// (utils/accountingDemo.js) until Kuber pushes receipts. The banner says so on both views.
// ────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { FiArrowLeft, FiSearch, FiDownload, FiInfo } from 'react-icons/fi';
import ChartCard from '../components/ChartCard';
import ExportControls from '../components/ExportControls';
import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';
import { getAccountingOutstandings, getAccountingLedger } from '../services/api';
import { formatINR, formatINRShort } from '../utils/numberFormat';
import { isGlobalAdmin } from '../utils/roles';
import './Accounting.css';

// Ageing colours run green → red so the eye reads risk left to right.
const BUCKET_COLORS = { b0: '#10b981', b30: '#84cc16', b45: '#f59e0b', b60: '#f97316', b90: '#ef4444' };
const BUCKET_KEYS = ['b0', 'b30', 'b45', 'b60', 'b90'];
const BUCKET_LABELS = { b0: '< 30 days', b30: '30 to 45 days', b45: '45 to 60 days', b60: '60 to 90 days', b90: '> 90 days' };

const amt2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Kuber style: "20,47,644.00 Dr" / "8,23,738.00 Cr"; blank for zero.
const drCr = (v) => {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  if (!n) return '';
  return `${amt2.format(Math.abs(n))} ${n > 0 ? 'Dr' : 'Cr'}`;
};
const money2 = (v) => (v ? amt2.format(v) : '');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "20-Apr-26", as Kuber prints it (en-GB would give "Sept").
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getUTCDate()}-${MONTHS[x.getUTCMonth()]}-${String(x.getUTCFullYear()).slice(2)}`;
};
const monthLabel = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return `${MONTHS[mo - 1]} ${String(y).slice(2)}`;
};
const moneyAxis = { ticks: { callback: (v) => formatINRShort(v) } };
const moneyTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label || ctx.label}: ${formatINR(ctx.raw)}` } };
// LOCAL calendar date — toISOString() is UTC and reads as yesterday before 05:30 IST.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const downloadSheet = (rows, sheet, file) => {
  if (!window.XLSX) return;
  const ws = window.XLSX.utils.json_to_sheet(rows);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, sheet);
  window.XLSX.writeFile(wb, file);
};

const DemoBanner = () => (
  <div className="acc-demo-banner">
    <FiInfo />
    <span><strong>Demo data.</strong> Client names are real; bills, receipts and balances are simulated for presentation until Kuber sends accounting data.</span>
  </div>
);

// Horizontal stacked-by-bucket bar (Top debtors). Plain builder, not a component (see CLAUDE.md).
const bucketStack = (rows, labelKey) => ({
  labels: rows.map(r => r[labelKey]),
  datasets: BUCKET_KEYS.map(k => ({
    label: BUCKET_LABELS[k],
    data: rows.map(r => Math.max(0, r[k] || 0)),
    backgroundColor: BUCKET_COLORS[k],
    borderRadius: 3,
    stack: 'a',
  })),
});

/* ═════════════════════════════ Outstandings view ═════════════════════════════ */
const Outstandings = ({ onOpen }) => {
  const user = JSON.parse(sessionStorage.getItem('flexibond_user') || '{}');
  const globalAdmin = isGlobalAdmin(user);

  const [company, setCompany] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [asOf, setAsOf] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getAccountingOutstandings({ company: company || undefined, salesperson: salesperson || undefined, asOf })
      .then(res => { if (live) setData(res.data); })
      .catch(err => console.error('Outstandings load failed', err))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [company, salesperson, asOf]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const list = q ? data.rows.filter(r => r.name.toLowerCase().includes(q) || (r.city || '').toLowerCase().includes(q)) : data.rows;
    return [...list].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * sort.dir;
    });
  }, [data, search, sort]);

  const shownTotal = useMemo(() => rows.reduce((t, r) => {
    ['total', ...BUCKET_KEYS].forEach(k => { t[k] += r[k]; });
    return t;
  }, { total: 0, b0: 0, b30: 0, b45: 0, b60: 0, b90: 0 }), [rows]);

  const toggleSort = (key) => setSort(s => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'name' ? 1 : -1 }));
  const arrow = (key) => (sort.key === key ? (sort.dir > 0 ? ' ▲' : ' ▼') : '');

  const k = data?.kpis;
  // A client can owe more than one company; tag the label so two "ACTIZO MARKETING" bars differ.
  const topDebtors = data ? [...data.rows].sort((a, b) => b.total - a.total).slice(0, 10)
    .map(r => ({ ...r, label: !company && globalAdmin ? `${r.name} (${r.company})` : r.name })) : [];

  const exportTable = () => downloadSheet(
    rows.map(r => ({
      Particulars: r.name, City: r.city, Salesperson: r.salesperson, 'Pending Bills': r.total,
      '< 30 days': r.b0, '30 to 45 days': r.b30, '45 to 60 days': r.b45, '60 to 90 days': r.b60, '> 90 days': r.b90,
    })),
    'Group Outstandings', `Group_Outstandings_${asOf}.xlsx`,
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Accounting</h1>
          <p>Receivables — group outstandings, ageing and client ledgers</p>
        </div>
        <div className="page-controls">
          <ExportControls pageTitle="Accounting_Outstandings" />
        </div>
      </div>

      <DemoBanner />

      <div className="filter-bar acc-controls">
        {globalAdmin && (
          <select value={company} onChange={e => { setCompany(e.target.value); setSalesperson(''); }}>
            <option value="">All Companies</option>
            {['UFPL', 'UCPL', 'FDL'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={salesperson} onChange={e => setSalesperson(e.target.value)}>
          <option value="">All Groups (Salesperson)</option>
          {(data?.salespeople || []).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="acc-asof">
          As on
          <input type="date" value={asOf} max={todayISO()} onChange={e => setAsOf(e.target.value || todayISO())} />
        </label>
      </div>

      {loading && !data ? <KPISkeleton /> : k && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Total Outstanding</div>
            <div className="kpi-value">{formatINR(k.totalOutstanding)}</div>
            <div className="kpi-sub">{k.clientsWithDues} clients with dues</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Overdue</div>
            <div className="kpi-value" style={{ color: 'var(--warning)' }}>{formatINR(k.overdue)}</div>
            <div className="kpi-sub">Past each client's credit period</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Above 90 Days</div>
            <div className="kpi-value" style={{ color: 'var(--danger)' }}>{formatINR(k.over90)}</div>
            <div className="kpi-sub">{k.totalOutstanding ? ((k.over90 / k.totalOutstanding) * 100).toFixed(1) : 0}% of outstanding</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Collected (FY to date)</div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>{formatINR(k.collected)}</div>
            <div className="kpi-sub">of {formatINR(k.billed)} billed</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Collection Efficiency</div>
            <div className="kpi-value">{k.collectionEfficiency}%</div>
            <div className="acc-progress"><div style={{ width: `${Math.min(100, k.collectionEfficiency)}%` }} /></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">DSO</div>
            <div className="kpi-value">{k.dso} days</div>
            <div className="kpi-sub">Days sales outstanding</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Avg. Days to Pay</div>
            <div className="kpi-value">{k.avgDaysToPay != null ? `${k.avgDaysToPay} days` : '—'}</div>
            <div className="kpi-sub">Bill date → final receipt</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Clients with Dues</div>
            <div className="kpi-value">{k.clientsWithDues}</div>
            <div className="kpi-sub">{data.rows.filter(r => r.b90 > 0).length} with bills above 90 days</div>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="charts-grid"><ChartSkeleton /><ChartSkeleton /></div>
      ) : data && (
        <div className="charts-grid">
          <ChartCard title="Ageing Analysis">
            <Bar
              data={{
                labels: BUCKET_KEYS.map(b => BUCKET_LABELS[b]),
                datasets: [{ label: 'Outstanding', data: BUCKET_KEYS.map(b => data.grand[b]), backgroundColor: BUCKET_KEYS.map(b => BUCKET_COLORS[b]), borderRadius: 6 }],
              }}
              options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: moneyTooltip }, scales: { y: moneyAxis } }}
            />
          </ChartCard>

          <ChartCard title="Ageing Mix">
            <div className="donut-container">
              <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
                <Doughnut
                  data={{
                    labels: BUCKET_KEYS.map(b => BUCKET_LABELS[b]),
                    datasets: [{ data: BUCKET_KEYS.map(b => Math.max(0, data.grand[b])), backgroundColor: BUCKET_KEYS.map(b => BUCKET_COLORS[b]), borderWidth: 0 }],
                  }}
                  options={{ maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: moneyTooltip } }}
                />
              </div>
              <div className="acc-legend">
                {BUCKET_KEYS.map(b => {
                  const pos = BUCKET_KEYS.reduce((a, x) => a + Math.max(0, data.grand[x]), 0);
                  return (
                    <div key={b} className="acc-legend-row">
                      <span><i style={{ background: BUCKET_COLORS[b] }} />{BUCKET_LABELS[b]}</span>
                      <strong>{pos ? ((Math.max(0, data.grand[b]) / pos) * 100).toFixed(1) : 0}%</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Billed vs Collected (Monthly)" fullWidth>
            <Bar
              data={{
                labels: data.monthly.map(m => monthLabel(m.month)),
                datasets: [
                  { type: 'line', label: 'Outstanding (closing)', data: data.monthly.map(m => m.closing), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true, tension: 0.35, pointRadius: 3, yAxisID: 'y', order: 0 },
                  { label: 'Billed', data: data.monthly.map(m => m.billed), backgroundColor: '#3b82f6', borderRadius: 4, order: 1 },
                  { label: 'Collected', data: data.monthly.map(m => m.collected), backgroundColor: '#10b981', borderRadius: 4, order: 1 },
                ],
              }}
              options={{ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { percentBar: false, tooltip: moneyTooltip, legend: { position: 'bottom' } }, scales: { y: moneyAxis } }}
            />
          </ChartCard>

          <ChartCard title="Top 10 Debtors (by Ageing)">
            <Bar
              data={bucketStack(topDebtors, 'label')}
              options={{
                indexAxis: 'y', maintainAspectRatio: false,
                plugins: { tooltip: moneyTooltip, legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                scales: { x: { stacked: true, ticks: { ...moneyAxis.ticks, maxTicksLimit: 6 } }, y: { stacked: true, ticks: { callback(v) { const l = this.getLabelForValue(v); return l.length > 28 ? `${l.slice(0, 27)}…` : l; } } } },
                onClick: (_, els) => { if (els.length) { const r = topDebtors[els[0].index]; onOpen(r.name, r.company, asOf); } },
              }}
            />
          </ChartCard>

          <ChartCard title="Outstanding by Group (Salesperson)">
            <Bar
              data={{
                labels: data.bySalesperson.map(r => r.name),
                datasets: [
                  { label: 'Within 90 days', data: data.bySalesperson.map(r => r.outstanding - r.over90), backgroundColor: '#6366f1', borderRadius: 3, stack: 'a' },
                  { label: '> 90 days', data: data.bySalesperson.map(r => r.over90), backgroundColor: '#ef4444', borderRadius: 3, stack: 'a' },
                ],
              }}
              options={{
                indexAxis: 'y', maintainAspectRatio: false,
                plugins: { tooltip: moneyTooltip, legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                scales: { x: { stacked: true, ticks: { ...moneyAxis.ticks, maxTicksLimit: 6 } }, y: { stacked: true } },
                onClick: (_, els) => { if (els.length) setSalesperson(data.bySalesperson[els[0].index].name); },
              }}
            />
          </ChartCard>
        </div>
      )}

      {/* Group Outstandings — the Kuber report, column for column. */}
      <div className="acc-table-head">
        <div>
          <h3>{data?.companyName || 'Group Outstandings'}</h3>
          <p>{salesperson || 'All groups'} · Group Outstandings · {data ? `${fmtDate(data.periodStart)} to ${fmtDate(data.asOf)}` : ''}</p>
        </div>
        <div className="acc-table-tools">
          <div className="acc-search">
            <FiSearch />
            <input placeholder="Search client or city…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="acc-btn" onClick={exportTable} disabled={!rows.length}><FiDownload /> Excel</button>
        </div>
      </div>

      {loading && !data ? <TableSkeleton /> : (
        <div className="data-table-wrapper acc-table-wrap">
          <table className="data-table acc-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')} className="acc-sort">Particulars{arrow('name')}</th>
                <th onClick={() => toggleSort('total')} className="acc-sort num">Pending Bills{arrow('total')}</th>
                {BUCKET_KEYS.map(b => (
                  <th key={b} onClick={() => toggleSort(b)} className="acc-sort num">
                    <i className="acc-dot" style={{ background: BUCKET_COLORS[b] }} />{BUCKET_LABELS[b]}{arrow(b)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${r.company}|${r.name}`} className="acc-row" onClick={() => onOpen(r.name, r.company, asOf)}>
                  <td>
                    <div className="acc-client">{r.name}</div>
                    <div className="acc-client-sub">{[!company && globalAdmin ? r.company : null, r.city, r.salesperson].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="num strong">{drCr(r.total)}</td>
                  {BUCKET_KEYS.map(b => (
                    <td key={b} className={`num ${r[b] < 0 ? 'acc-cr' : ''}`} style={r[b] > 0 ? { background: `${BUCKET_COLORS[b]}${r[b] > 2500000 ? '26' : '12'}` } : undefined}>
                      {drCr(r[b])}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>No clients with pending bills.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td>Grand Total{search ? ` (${rows.length} shown)` : ''}</td>
                  <td className="num">{drCr(shownTotal.total)}</td>
                  {BUCKET_KEYS.map(b => <td key={b} className="num">{drCr(shownTotal[b])}</td>)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  );
};

/* ═════════════════════════════ Ledger view ═════════════════════════════ */
const Ledger = ({ name, company, asOf, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [billFilter, setBillFilter] = useState('pending');

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    getAccountingLedger(name, { asOf, company: company || undefined })
      .then(res => { if (live) setData(res.data); })
      .catch(err => { if (live) setError(err.response?.data?.message || 'Could not load ledger'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [name, company, asOf]);

  const bills = useMemo(() => {
    if (!data) return [];
    return billFilter === 'pending' ? data.bills.filter(b => b.pending > 0) : data.bills;
  }, [data, billFilter]);

  if (error) {
    return (
      <>
        <button className="acc-back" onClick={onBack}><FiArrowLeft /> Back to outstandings</button>
        <div className="acc-empty">{error}</div>
      </>
    );
  }

  const c = data?.client;
  const t = data?.totals;

  const exportLedger = () => downloadSheet(
    data.entries.map(e => ({
      Date: fmtDate(e.date), Particulars: `${e.side} ${e.particulars}`, 'Vch Type': e.vchType, 'Vch No.': e.vchNo,
      Debit: e.debit || '', Credit: e.credit || '', Balance: drCr(e.balance),
    })),
    'Ledger', `Ledger_${name.replace(/[^\w]+/g, '_')}_${asOf}.xlsx`,
  );

  return (
    <>
      <div className="page-header">
        <div>
          <button className="acc-back" onClick={onBack}><FiArrowLeft /> Back to outstandings</button>
          <h1>{name}</h1>
          <p>Ledger Account{c ? ` · ${[c.city, c.state].filter(Boolean).join(', ')}` : ''}</p>
        </div>
        <div className="page-controls">
          <ExportControls pageTitle={`Ledger_${name}`} />
        </div>
      </div>

      <DemoBanner />

      {loading && !data ? <KPISkeleton /> : data && (
        <>
          {/* Letterhead, as on the Kuber ledger print. */}
          <div className="acc-letterhead">
            <div className="acc-lh-co">{data.companyName}</div>
            <div className="acc-lh-client">{c.name}</div>
            <div className="acc-lh-meta">Ledger Account · {[c.city, c.state].filter(Boolean).join(', ')}{c.gstin ? ` · GSTIN ${c.gstin}` : ''}</div>
            <div className="acc-lh-meta">{fmtDate(data.periodStart)} to {fmtDate(data.asOf)} · Salesperson {c.salesperson || '—'} · Credit terms {c.creditDays} days</div>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Closing Balance</div>
              <div className="kpi-value" style={{ color: t.closing > 0 ? 'var(--danger)' : 'var(--success)' }}>{drCr(t.closing) || '₹0 (settled)'}</div>
              <div className="kpi-sub">{t.pendingBills} of {t.totalBills} bills pending</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Billed (Debit)</div>
              <div className="kpi-value">{formatINR(t.debit)}</div>
              <div className="kpi-sub">FY to date</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Received (Credit)</div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>{formatINR(t.received)}</div>
              <div className="kpi-sub">{t.debit ? ((t.received / t.debit) * 100).toFixed(1) : 0}% of billed{t.credit > t.received ? ` · ${formatINR(t.credit - t.received)} returns` : ''}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Overdue</div>
              <div className="kpi-value" style={{ color: t.overdue ? 'var(--warning)' : undefined }}>{formatINR(t.overdue)}</div>
              <div className="kpi-sub">Beyond {c.creditDays}-day terms</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Oldest Pending Bill</div>
              <div className="kpi-value">{t.pendingBills ? `${t.oldestDays} days` : '—'}</div>
              <div className="kpi-sub">Age as on {fmtDate(data.asOf)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg. Days to Pay</div>
              <div className="kpi-value">{t.avgDaysToPay != null ? `${t.avgDaysToPay} days` : '—'}</div>
              <div className="kpi-sub">On fully settled bills</div>
            </div>
          </div>

          <div className="charts-grid">
            <ChartCard title="Ageing of Pending Bills">
              <Bar
                data={{
                  labels: BUCKET_KEYS.map(b => BUCKET_LABELS[b]),
                  datasets: [{ label: 'Pending', data: BUCKET_KEYS.map(b => data.ageing[b]), backgroundColor: BUCKET_KEYS.map(b => BUCKET_COLORS[b]), borderRadius: 6 }],
                }}
                options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: moneyTooltip }, scales: { y: moneyAxis } }}
              />
            </ChartCard>
            <ChartCard title="Billed vs Received · Running Balance">
              <Bar
                data={{
                  labels: data.monthly.map(m => monthLabel(m.month)),
                  datasets: [
                    { type: 'line', label: 'Balance', data: data.monthly.map(m => m.closing), borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.35, pointRadius: 3, order: 0 },
                    { label: 'Billed', data: data.monthly.map(m => m.billed), backgroundColor: '#3b82f6', borderRadius: 4, order: 1 },
                    { label: 'Received', data: data.monthly.map(m => m.collected), backgroundColor: '#10b981', borderRadius: 4, order: 1 },
                  ],
                }}
                options={{ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { percentBar: false, tooltip: moneyTooltip, legend: { position: 'bottom' } }, scales: { y: moneyAxis } }}
              />
            </ChartCard>
          </div>

          {/* Bill-wise status */}
          <div className="acc-table-head">
            <div>
              <h3>Bill-wise Status</h3>
              <p>Each sales bill against what has been received on it</p>
            </div>
            <div className="acc-seg">
              <button className={billFilter === 'pending' ? 'on' : ''} onClick={() => setBillFilter('pending')}>Pending</button>
              <button className={billFilter === 'all' ? 'on' : ''} onClick={() => setBillFilter('all')}>All bills</button>
            </div>
          </div>
          <div className="data-table-wrapper acc-table-wrap" style={{ marginBottom: 28 }}>
            <table className="data-table acc-table">
              <thead>
                <tr>
                  <th>Bill Date</th><th>Ref. No.</th><th className="num">Bill Amount</th><th className="num">Received</th>
                  <th className="num">Pending</th><th>Due On</th><th className="num">Overdue</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(b => (
                  <tr key={b.vchNo}>
                    <td>{fmtDate(b.date)}</td>
                    <td className="mono">{b.vchNo}</td>
                    <td className="num">{money2(b.amount)}</td>
                    <td className="num">{money2(b.received)}</td>
                    <td className="num strong">{money2(b.pending)}</td>
                    <td>{fmtDate(b.dueDate)}</td>
                    <td className="num">{b.overdueDays ? `${b.overdueDays} d` : ''}</td>
                    <td><span className={`acc-status s-${b.status.replace(/\s/g, '').toLowerCase()}`}>{b.status}</span></td>
                  </tr>
                ))}
                {!bills.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No pending bills — account is settled.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Ledger — Kuber layout + a running balance column. */}
          <div className="acc-table-head">
            <div>
              <h3>Ledger Account</h3>
              <p>{fmtDate(data.periodStart)} to {fmtDate(data.asOf)}</p>
            </div>
            <button className="acc-btn" onClick={exportLedger}><FiDownload /> Excel</button>
          </div>
          <div className="data-table-wrapper acc-table-wrap">
            <table className="data-table acc-table acc-ledger">
              <thead>
                <tr>
                  <th>Date</th><th>Particulars</th><th>Vch Type</th><th>Vch No.</th>
                  <th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e, i) => (
                  <tr key={i}>
                    <td>{fmtDate(e.date)}</td>
                    <td>
                      <span className="acc-side">{e.side}</span> <strong>{e.particulars}</strong>
                      {(e.againstRef || e.narration) && <div className="acc-client-sub">{e.againstRef ? `Agst Ref ${e.againstRef}` : e.narration}</div>}
                    </td>
                    <td className="acc-vch">{e.vchType}</td>
                    <td className="mono">{e.vchNo}</td>
                    <td className="num">{money2(e.debit)}</td>
                    <td className="num">{money2(e.credit)}</td>
                    <td className="num muted">{drCr(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} />
                  <td className="num">{money2(t.debit)}</td>
                  <td className="num">{money2(t.credit)}</td>
                  <td />
                </tr>
                <tr className="acc-closing">
                  <td><span className="acc-side">{t.closing >= 0 ? 'Dr' : 'Cr'}</span></td>
                  <td colSpan={3}><strong>Closing Balance</strong></td>
                  <td className="num">{t.closing < 0 ? money2(-t.closing) : ''}</td>
                  <td className="num">{t.closing > 0 ? money2(t.closing) : ''}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={4} />
                  <td className="num">{money2(Math.max(t.debit, t.credit))}</td>
                  <td className="num">{money2(Math.max(t.debit, t.credit))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
      {loading && !data && <TableSkeleton />}
    </>
  );
};

/* ═════════════════════════════ Page ═════════════════════════════ */
const Accounting = () => {
  const [params, setParams] = useSearchParams();
  const client = params.get('client');
  // company + asOf travel with the client so the ledger is built from the SAME book the
  // outstandings row came from (a client can hold a ledger with more than one company).
  const company = params.get('company') || '';
  const asOf = params.get('asOf') || todayISO();

  const open = (name, co, date) => {
    setParams({ client: name, ...(co ? { company: co } : {}), ...(date ? { asOf: date } : {}) });
    window.scrollTo({ top: 0 });
  };
  const back = () => { setParams({}); window.scrollTo({ top: 0 }); };

  return (
    <div className="page-content accounting-page">
      {client ? <Ledger key={`${company}|${client}`} name={client} company={company} asOf={asOf} onBack={back} /> : <Outstandings onOpen={open} />}
    </div>
  );
};

export default Accounting;
