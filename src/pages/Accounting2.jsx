// ────────────────────────────────────────────────────────────────────────────
// Accounting 2 — REAL Tally receivables for the GUWAHATI branch (added 2026-10-01).
//
// Same two views as Accounting (Group Outstandings → Ledger Account), but on the client's own
// Tally exports instead of simulated data, plus a Tally ↔ Kuber reconciliation panel. Parties are
// shown by their TALLY name; the Kuber spelling is noted where it differs. Ageing = 30-Sep-26 −
// bill date (no due dates, client rule). Backend: routes/accounting2.js + utils/accountingTally.js.
// ────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { FiArrowLeft, FiSearch, FiDownload, FiCheckCircle, FiAlertTriangle, FiLink } from 'react-icons/fi';
import ChartCard from '../components/ChartCard';
import ExportControls from '../components/ExportControls';
import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';
import { getAccounting2Outstandings, getAccounting2Ledger } from '../services/api';
import { formatINR } from '../utils/numberFormat';
import {
  BUCKET_COLORS, BUCKET_KEYS, BUCKET_LABELS, drCr, money2, fmtDate, monthLabel,
  moneyAxis, moneyTooltip, downloadSheet, bucketStack,
} from '../utils/accountingFormat';
import './Accounting.css';

const SourceBanner = ({ data }) => (
  <div className="acc-source-banner">
    <FiCheckCircle />
    <span>
      <strong>Live Tally data</strong> · {data?.companyName || 'Guwahati'} · as on {fmtDate(data?.asOf)}.
      {' '}Bills are linked to Kuber sales by bill number; party names follow Tally.
    </span>
  </div>
);

const comboOptions = { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { percentBar: false, tooltip: moneyTooltip, legend: { position: 'bottom' } }, scales: { y: moneyAxis } };
const ageingBar = (values) => ({
  labels: BUCKET_KEYS.map(b => BUCKET_LABELS[b]),
  datasets: [{ label: 'Outstanding', data: BUCKET_KEYS.map(b => values[b]), backgroundColor: BUCKET_KEYS.map(b => BUCKET_COLORS[b]), borderRadius: 6 }],
});
const monthlyCombo = (monthly, collectedLabel) => ({
  labels: monthly.map(m => monthLabel(m.month)),
  datasets: [
    { type: 'line', label: 'Outstanding (closing)', data: monthly.map(m => m.closing), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true, tension: 0.35, pointRadius: 3, order: 0 },
    { label: 'Billed', data: monthly.map(m => m.billed), backgroundColor: '#3b82f6', borderRadius: 4, order: 1 },
    { label: collectedLabel, data: monthly.map(m => m.collected), backgroundColor: '#10b981', borderRadius: 4, order: 1 },
  ],
});

/* ═════════════════════════════ Reconciliation panel ═════════════════════════════ */
const Reconciliation = ({ recon }) => {
  const credits = recon.unadjustedCredits.reduce((a, c) => a + c.amount, 0);
  return (
    <div className="acc-recon">
      <div className="acc-table-head"><div><h3>Tally ↔ Kuber Reconciliation</h3><p>How the accounting book lines up with the sales feed</p></div></div>
      <div className="acc-recon-grid">
        <div className="acc-recon-card ok">
          <div className="acc-recon-title"><FiLink /> Bills linked by bill number</div>
          <div className="acc-recon-big">{recon.kuberLinked} / {recon.kuberBills - recon.kuberOnly.length}</div>
          <p>Every real Kuber bill (Aug–Sep) is in Tally{recon.amountMismatches.length ? '' : ', with identical amounts'}.
            {' '}{recon.tallyOnlyBeforeFeed} older Tally bills predate the Kuber feed (starts 1-Aug-26).</p>
          {recon.amountMismatches.map(m => <div key={m.vchNo} className="acc-recon-line warn">{m.vchNo} · {m.party}: Tally {money2(m.tally)} vs Kuber {money2(m.kuber)}</div>)}
          <div className="acc-recon-line">Pending bills match Tally's Bills Receivable report {recon.billsReceivable.mismatches === 0 ? 'bill for bill ✓' : `except ${recon.billsReceivable.mismatches}`}</div>
        </div>

        <div className="acc-recon-card">
          <div className="acc-recon-title">Name differences (merged)</div>
          {recon.nameDiffs.map(n => (
            <div key={n.tally} className="acc-recon-line"><strong>{n.tally}</strong> <span className="muted">= Kuber “{n.kuber}”</span></div>
          ))}
          {recon.noKuberMatch.map(n => (
            <div key={n} className="acc-recon-line muted">{n} — no Kuber sales in the feed window (older bills only)</div>
          ))}
          <p className="acc-recon-note">Punctuation and case differences (e.g. “B.K.Creative” / “B.K CREATIVE”) are matched automatically.</p>
        </div>

        <div className="acc-recon-card">
          <div className="acc-recon-title">Salesperson conflicts</div>
          {recon.salespersonConflicts.length ? recon.salespersonConflicts.map(s => (
            <div key={s.party} className="acc-recon-line"><strong>{s.party}</strong>: Tally {s.tally} · Kuber <strong>{s.kuber}</strong> (used)</div>
          )) : <div className="acc-recon-line muted">None</div>}
          <p className="acc-recon-note">Groups follow Kuber's salesperson.</p>
        </div>

        <div className="acc-recon-card warn">
          <div className="acc-recon-title"><FiAlertTriangle /> Flagged</div>
          {recon.kuberOnly.map(k => (
            <div key={k.invoiceNo} className="acc-recon-line">
              <strong>{k.invoiceNo}</strong> · {k.party} · {money2(k.amount)} · {fmtDate(k.date)} — in Kuber, not in Tally.
              {k.note && <div className="muted">{k.note}</div>}
            </div>
          ))}
          <div className="acc-recon-line">
            Unadjusted credits <strong>{money2(credits)}</strong>: {recon.unadjustedCredits.map(c => `${c.party} ${c.ref} (${money2(c.amount)})`).join(' · ')}.
            <div className="muted">Not set against any bill, so Tally's Bills Receivable prints {money2(recon.billsReceivable.total)} while the ledgers net to {money2(recon.ledgerTotal)}.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═════════════════════════════ Outstandings view ═════════════════════════════ */
const Outstandings = ({ onOpen }) => {
  const [salesperson, setSalesperson] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    getAccounting2Outstandings({ salesperson: salesperson || undefined })
      .then(res => { if (live) { setData(res.data); setError(''); } })
      .catch(err => { if (live) setError(err.response?.data?.message || 'Could not load Tally data'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [salesperson]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const list = q ? data.rows.filter(r => [r.name, r.kuberName, r.city].some(v => (v || '').toLowerCase().includes(q))) : data.rows;
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
  const topDebtors = data ? [...data.rows].filter(r => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10) : [];

  const exportTable = () => downloadSheet(
    rows.map(r => ({
      Particulars: r.name, 'Kuber name': r.kuberName || '', City: r.city, Salesperson: r.salesperson, 'Pending Bills': r.total,
      '< 30 days': r.b0, '30 to 45 days': r.b30, '45 to 60 days': r.b45, '60 to 90 days': r.b60, '> 90 days': r.b90,
    })),
    'Group Outstandings', 'Guwahati_Group_Outstandings_30-Sep-26.xlsx',
  );

  if (error) return <div className="acc-empty">{error}</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Accounting 2 · Guwahati</h1>
          <p>Receivables from Tally — group outstandings, ageing and party ledgers</p>
        </div>
        <div className="page-controls">
          <ExportControls pageTitle="Accounting2_Guwahati" />
        </div>
      </div>

      <SourceBanner data={data} />

      <div className="filter-bar acc-controls">
        <select value={salesperson} onChange={e => setSalesperson(e.target.value)}>
          <option value="">All Groups (Salesperson)</option>
          {(data?.salespeople || []).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="acc-asof">Ageing as on <strong>{fmtDate(data?.asOf)}</strong> · from bill date</span>
      </div>

      {loading && !data ? <KPISkeleton /> : k && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Total Outstanding</div>
            <div className="kpi-value">{formatINR(k.totalOutstanding)}</div>
            <div className="kpi-sub">{k.clientsWithDues} of {k.parties} parties with dues · net of credits</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Pending Bills</div>
            <div className="kpi-value">{formatINR(k.grossPending)}</div>
            <div className="kpi-sub">{k.pendingBillCount} bills · as per Tally Bills Receivable</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">60 Days &amp; Above</div>
            <div className="kpi-value" style={{ color: k.over60 ? 'var(--danger)' : undefined }}>{formatINR(k.over60)}</div>
            <div className="kpi-sub">{k.totalOutstanding ? ((k.over60 / k.totalOutstanding) * 100).toFixed(1) : 0}% of outstanding</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Received</div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>{formatINR(k.received)}</div>
            <div className="kpi-sub">of {formatINR(k.billed)} billed (FY to date)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Collection Efficiency</div>
            <div className="kpi-value">{k.collectionEfficiency}%</div>
            <div className="acc-progress"><div style={{ width: `${Math.min(100, k.collectionEfficiency)}%` }} /></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Avg. Age of Pending</div>
            <div className="kpi-value">{k.weightedAge} days</div>
            <div className="kpi-sub">Weighted by pending amount</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Avg. Days to Pay</div>
            <div className="kpi-value">{k.avgDaysToPay != null ? `${k.avgDaysToPay} days` : '—'}</div>
            <div className="kpi-sub">Bill date → final receipt, settled bills</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">DSO</div>
            <div className="kpi-value">{k.dso} days</div>
            <div className="kpi-sub">Days sales outstanding</div>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="charts-grid"><ChartSkeleton /><ChartSkeleton /></div>
      ) : data && (
        <div className="charts-grid">
          <ChartCard title="Ageing Analysis">
            <Bar data={ageingBar(data.grand)} options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: moneyTooltip }, scales: { y: moneyAxis } }} />
          </ChartCard>

          <ChartCard title="Ageing Mix">
            <div className="donut-container">
              <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
                <Doughnut
                  data={{ labels: BUCKET_KEYS.map(b => BUCKET_LABELS[b]), datasets: [{ data: BUCKET_KEYS.map(b => Math.max(0, data.grand[b])), backgroundColor: BUCKET_KEYS.map(b => BUCKET_COLORS[b]), borderWidth: 0 }] }}
                  options={{ maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: moneyTooltip } }}
                />
              </div>
              <div className="acc-legend">
                {BUCKET_KEYS.map((b) => {
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

          <ChartCard title="Billed vs Received (Monthly)" fullWidth>
            <Bar data={monthlyCombo(data.monthly, 'Received')} options={comboOptions} />
          </ChartCard>

          <ChartCard title="Top 10 Debtors (by Ageing)">
            <Bar
              data={bucketStack(topDebtors, 'name')}
              options={{
                indexAxis: 'y', maintainAspectRatio: false,
                plugins: { tooltip: moneyTooltip, legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                scales: { x: { stacked: true, ticks: { ...moneyAxis.ticks, maxTicksLimit: 6 } }, y: { stacked: true, ticks: { callback(v) { const l = this.getLabelForValue(v); return l.length > 28 ? `${l.slice(0, 27)}…` : l; } } } },
                onClick: (_, els) => { if (els.length) onOpen(topDebtors[els[0].index].name); },
              }}
            />
          </ChartCard>

          <ChartCard title="Outstanding by Group (Salesperson)">
            <Bar
              data={{
                labels: data.bySalesperson.map(r => r.name),
                datasets: [
                  { label: 'Within 60 days', data: data.bySalesperson.map(r => r.outstanding - r.over60), backgroundColor: '#6366f1', borderRadius: 3, stack: 'a' },
                  { label: '60 days & above', data: data.bySalesperson.map(r => r.over60), backgroundColor: '#f97316', borderRadius: 3, stack: 'a' },
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

      <div className="acc-table-head">
        <div>
          <h3>{data?.companyName || 'Group Outstandings'}</h3>
          <p>{salesperson || 'All groups'} · Group Outstandings · {data?.period}</p>
        </div>
        <div className="acc-table-tools">
          <div className="acc-search">
            <FiSearch />
            <input placeholder="Search party, Kuber name or city…" value={search} onChange={e => setSearch(e.target.value)} />
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
                <tr key={r.name} className="acc-row" onClick={() => onOpen(r.name)}>
                  <td>
                    <div className="acc-client">{r.name}</div>
                    <div className="acc-client-sub">
                      {[r.city, r.salesperson].filter(Boolean).join(' · ')}
                      {r.nameDiffers && <span className="acc-badge" title="Spelled differently in Kuber">Kuber: {r.kuberName}</span>}
                    </div>
                  </td>
                  <td className="num strong">{drCr(r.total)}</td>
                  {BUCKET_KEYS.map(b => (
                    <td key={b} className={`num ${r[b] < 0 ? 'acc-cr' : ''}`} style={r[b] > 0 ? { background: `${BUCKET_COLORS[b]}${r[b] > 500000 ? '26' : '12'}` } : undefined}>
                      {drCr(r[b])}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>No parties with pending bills.</td></tr>}
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

      {data && <Reconciliation recon={data.recon} />}
    </>
  );
};

/* ═════════════════════════════ Ledger view ═════════════════════════════ */
const Ledger = ({ name, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [billFilter, setBillFilter] = useState('pending');

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    getAccounting2Ledger(name)
      .then(res => { if (live) setData(res.data); })
      .catch(err => { if (live) setError(err.response?.data?.message || 'Could not load ledger'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [name]);

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
    data.entries.flatMap(e => [
      { Date: fmtDate(e.date), Particulars: `${e.side} ${e.particulars}`, 'Vch Type': e.vchType, 'Vch No.': e.vchNo, Debit: e.debit || '', Credit: e.credit || '', Balance: drCr(e.balance) },
      ...e.allocations.map(a => ({ Date: '', Particulars: `   ${a.type} ${a.ref}`, 'Vch Type': a.terms, 'Vch No.': '', Debit: a.side === 'Dr' ? a.amount : '', Credit: a.side === 'Cr' ? a.amount : '', Balance: '' })),
    ]),
    'Ledger', `Ledger_${name.replace(/[^\w]+/g, '_')}_30-Sep-26.xlsx`,
  );

  return (
    <>
      <div className="page-header">
        <div>
          <button className="acc-back" onClick={onBack}><FiArrowLeft /> Back to outstandings</button>
          <h1>{name}</h1>
          <p>Ledger Account · Guwahati{c?.city ? ` · ${c.city}` : ''}</p>
        </div>
        <div className="page-controls"><ExportControls pageTitle={`Ledger_${name}`} /></div>
      </div>

      <SourceBanner data={data} />

      {loading && !data ? <KPISkeleton /> : data && (
        <>
          <div className="acc-letterhead">
            <div className="acc-lh-co">{data.companyName}</div>
            <div className="acc-lh-meta">{data.companyAddress}</div>
            <div className="acc-lh-client">{c.name}</div>
            <div className="acc-lh-meta">Ledger Account{c.address ? ` · ${c.address}` : ''}</div>
            {c.contact && <div className="acc-lh-meta">{c.contact}</div>}
            <div className="acc-lh-meta">
              {data.period} · Salesperson <strong>{c.salesperson}</strong>
              {c.kuberSalesperson && c.tallySalesperson && c.tallySalesperson.toUpperCase() !== c.kuberSalesperson.toUpperCase() && <> (Tally: {c.tallySalesperson})</>}
              {c.nameDiffers && <> · Kuber name “{c.kuberName}”</>}
              {!c.kuberName && <> · no Kuber sales in the feed window</>}
            </div>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Closing Balance</div>
              <div className="kpi-value" style={{ color: t.closing > 0 ? 'var(--danger)' : 'var(--success)' }}>{drCr(t.closing) || 'Nil (settled)'}</div>
              <div className="kpi-sub">{t.pendingBills} of {t.totalBills} bills pending</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Billed</div>
              <div className="kpi-value">{formatINR(t.billed)}</div>
              <div className="kpi-sub">FY to date</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Received</div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>{formatINR(t.received)}</div>
              <div className="kpi-sub">{t.billed ? ((t.received / t.billed) * 100).toFixed(1) : 0}% of billed</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Oldest Pending Bill</div>
              <div className="kpi-value">{t.pendingBills && t.closing > 0 ? `${t.oldestDays} days` : '—'}</div>
              <div className="kpi-sub">{t.pendingBills && t.closing <= 0 ? 'Open bill is covered by an unadjusted credit' : `Since bill date, as on ${fmtDate(data.asOf)}`}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg. Days to Pay</div>
              <div className="kpi-value">{t.avgDaysToPay != null ? `${t.avgDaysToPay} days` : '—'}</div>
              <div className="kpi-sub">On fully settled bills</div>
            </div>
            {data.credits.length > 0 && (
              <div className="kpi-card">
                <div className="kpi-label">Unadjusted Credit</div>
                <div className="kpi-value acc-cr">{formatINR(data.credits.reduce((a, x) => a + x.amount, 0))}</div>
                <div className="kpi-sub">Not set against any bill in Tally</div>
              </div>
            )}
          </div>

          <div className="charts-grid">
            <ChartCard title="Ageing of Pending Bills">
              {Math.abs(data.ageing.total) < 0.5 && BUCKET_KEYS.every(b => Math.abs(data.ageing[b]) < 0.5)
                ? <div className="acc-empty">Nothing outstanding — every bill is settled.</div>
                : <Bar data={ageingBar(data.ageing)} options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: moneyTooltip }, scales: { y: moneyAxis } }} />}
            </ChartCard>
            <ChartCard title="Billed vs Received · Running Balance">
              <Bar data={monthlyCombo(data.monthly, 'Received')} options={comboOptions} />
            </ChartCard>
          </div>

          <div className="acc-table-head">
            <div><h3>Bill-wise Status</h3><p>Each bill reference against what has been received or adjusted on it (receipts, credit notes, write-offs)</p></div>
            <div className="acc-seg">
              <button className={billFilter === 'pending' ? 'on' : ''} onClick={() => setBillFilter('pending')}>Pending</button>
              <button className={billFilter === 'all' ? 'on' : ''} onClick={() => setBillFilter('all')}>All bills</button>
            </div>
          </div>
          <div className="data-table-wrapper acc-table-wrap">
            <table className="data-table acc-table">
              <thead>
                <tr>
                  <th>Bill Date</th><th>Ref. No.</th><th className="num">Bill Amount</th><th className="num">Received</th>
                  <th className="num">Pending</th><th className="num">Age</th><th>Status</th><th>Kuber</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(b => (
                  <tr key={b.ref}>
                    <td>{fmtDate(b.date)}</td>
                    <td className="mono">{b.ref}</td>
                    <td className="num">{money2(b.amount)}</td>
                    <td className="num">{money2(b.received)}</td>
                    <td className="num strong">{money2(b.pending)}</td>
                    <td className="num">{b.pending > 0 && <span title={BUCKET_LABELS[b.bucket]}><i className="acc-dot" style={{ background: BUCKET_COLORS[b.bucket] }} />{b.ageDays} d</span>}</td>
                    <td><span className={`acc-status s-${b.status.replace(/\s/g, '').toLowerCase()}`}>{b.status}</span></td>
                    <td>{b.inKuber ? <span className="acc-kuber ok" title="Same bill number and amount in Kuber">✓ linked</span> : <span className="acc-kuber" title="Before the Kuber feed started (1-Aug-26)">pre-feed</span>}</td>
                  </tr>
                ))}
                {!bills.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No pending bills — account is settled.</td></tr>}
              </tbody>
            </table>
          </div>

          {data.credits.length > 0 && (
            <>
              <div className="acc-table-head"><div><h3>Unadjusted Credits</h3><p>Receipts / credit notes Tally holds against no bill — they reduce the balance but not any bill</p></div></div>
              <div className="data-table-wrapper acc-table-wrap">
                <table className="data-table acc-table">
                  <thead><tr><th>Date</th><th>Ref. No.</th><th className="num">Amount</th><th className="num">Age</th></tr></thead>
                  <tbody>
                    {data.credits.map(x => (
                      <tr key={x.ref}><td>{fmtDate(x.date)}</td><td className="mono">{x.ref}</td><td className="num acc-cr">{money2(x.amount)} Cr</td><td className="num">{x.ageDays} d</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="acc-table-head">
            <div><h3>Ledger Account</h3><p>{data.period} · bill allocations shown under each voucher, as in Tally</p></div>
            <button className="acc-btn" onClick={exportLedger}><FiDownload /> Excel</button>
          </div>
          <div className="data-table-wrapper acc-table-wrap">
            <table className="data-table acc-table acc-ledger">
              <thead>
                <tr>
                  <th>Date</th><th>Particulars</th><th>Voucher</th>
                  <th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e, i) => (
                  <tr key={i}>
                    <td>{fmtDate(e.date)}</td>
                    <td>
                      <span className="acc-side">{e.side}</span> <strong>{e.particulars}</strong>
                      {e.kuber?.invoiceNo && <span className={`acc-kuber ${e.kuber.ok ? 'ok' : 'bad'}`} title={`Kuber ${e.kuber.invoiceNo} · ${money2(e.kuber.amount)}`}>{e.kuber.ok ? '✓ Kuber' : '≠ Kuber'}</span>}
                      {e.allocations.map((a, j) => (
                        <div key={j} className="acc-alloc">
                          {a.type} <span className="mono">{a.ref}</span>{a.terms ? ` · ${a.terms}` : ''} · {money2(a.amount)} {a.side}
                        </div>
                      ))}
                    </td>
                    <td><div className="acc-vch">{e.vchType}</div><div className="mono acc-vchno">{e.vchNo}</div></td>
                    <td className="num">{money2(e.debit)}</td>
                    <td className="num">{money2(e.credit)}</td>
                    <td className="num muted">{drCr(e.balance) || 'Nil'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} /><td className="num">{money2(t.debit)}</td><td className="num">{money2(t.credit)}</td><td /></tr>
                {Math.abs(t.closing) >= 0.5 && (
                  <tr className="acc-closing">
                    <td><span className="acc-side">{t.closing >= 0 ? 'Dr' : 'Cr'}</span></td>
                    <td colSpan={2}><strong>Closing Balance</strong></td>
                    <td className="num">{t.closing < 0 ? money2(-t.closing) : ''}</td>
                    <td className="num">{t.closing > 0 ? money2(t.closing) : ''}</td>
                    <td />
                  </tr>
                )}
                <tr><td colSpan={3} /><td className="num">{money2(Math.max(t.debit, t.credit))}</td><td className="num">{money2(Math.max(t.debit, t.credit))}</td><td /></tr>
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
const Accounting2 = () => {
  const [params, setParams] = useSearchParams();
  const client = params.get('client');
  const open = (name) => { setParams({ client: name }); window.scrollTo({ top: 0 }); };
  const back = () => { setParams({}); window.scrollTo({ top: 0 }); };
  return (
    <div className="page-content accounting-page">
      {client ? <Ledger key={client} name={client} onBack={back} /> : <Outstandings onOpen={open} />}
    </div>
  );
};

export default Accounting2;
