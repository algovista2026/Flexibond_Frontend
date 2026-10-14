// ────────────────────────────────────────────────────────────────────────────
// Accounting · Tally API (Test) — added 2026-10-14.
//
// The receivables book built from what the Tally vendor PUSHES to /api/tally/v1/<source>/… —
// the same outstandings / ledger / PDF / WhatsApp views as Accounting 2 (pages/Accounting2.jsx
// AccountingBook), plus a panel that shows every push, what was rejected and why, and the checks
// only the API can make (Tally's own closing balances, Bills Receivable bill for bill).
// Backend: routes/accountingTallyApi.js + utils/tallyStore.js. Contract: API/TALLY/TALLY_API.md.
// ────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { FiZap, FiCheckCircle, FiAlertTriangle, FiRefreshCw, FiClock } from 'react-icons/fi';
import { AccountingBook } from './Accounting2';
import {
  getAccountingTallySources, getAccountingTallyOutstandings, getAccountingTallyLedger, getAccountingTallyStatus,
} from '../services/api';
import { money2, fmtDate } from '../utils/accountingFormat';
import './Accounting.css';

const API_BASE = 'https://flexibond-backend-1.onrender.com/api/tally/v1';
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—');

const ApiBanner = ({ data }) => (
  <div className="acc-source-banner acc-api-banner">
    <FiZap />
    <span>
      <strong>Tally push API · test</strong> · {data?.companyName || 'waiting for Tally'}
      {data?.asOf && <> · as on {fmtDate(data.asOf)}{data.api?.asOfFrom === 'today' ? ' (today — no as_of sent)' : ''}</>}.
      {' '}Built live from what Tally has sent; refresh to see a new push.
    </span>
  </div>
);

const Check = ({ ok, children }) => (
  <div className={`acc-recon-line ${ok ? '' : 'warn'}`}>{ok ? <FiCheckCircle className="acc-ok" /> : <FiAlertTriangle className="acc-warn" />} {children}</div>
);

// Status + checks + push log. `data` = the outstandings payload (api, recon); the push log is its own call.
const ApiPanel = ({ data }) => {
  const source = data.tallySource;
  const [st, setSt] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    getAccountingTallyStatus(source).then(r => { if (live) setSt(r.data); }).catch(() => {});
    return () => { live = false; };
  }, [source, tick]);

  const a = data.api || {};
  const r = data.recon || {};
  const br = r.billsReceivable;
  const credits = (r.unadjustedCredits || []).reduce((s, c) => s + c.amount, 0);

  return (
    <div className="acc-recon">
      <div className="acc-table-head">
        <div><h3>Tally API · Push Status &amp; Checks</h3><p>Source <span className="mono">{source}</span> · what Tally has sent and how it reconciles</p></div>
        <button className="acc-btn" onClick={() => setTick(t => t + 1)}><FiRefreshCw /> Refresh log</button>
      </div>

      {data.empty && (
        <div className="acc-api-empty">
          <FiClock />
          <div>
            <strong>Waiting for Tally — no party ledgers have been pushed yet.</strong>
            <p>The book appears here as soon as the <span className="mono">ledgers</span> and <span className="mono">vouchers</span> feeds arrive:</p>
            {['ledgers', 'vouchers', 'bills'].map(f => <div key={f} className="mono acc-api-url">POST {API_BASE}/{source}/{f}</div>)}
            <p className="muted">Rejected pushes are listed in the log below with the reason.</p>
          </div>
        </div>
      )}

      <div className="acc-recon-grid">
        <div className="acc-recon-card">
          <div className="acc-recon-title"><FiZap /> What we hold</div>
          <div className="acc-recon-big">{st ? st.counts.vouchers : a.counts?.vouchers ?? '—'} <span className="acc-recon-unit">vouchers</span></div>
          <div className="acc-recon-line">{st ? st.counts.ledgers : a.counts?.ledgers} ledgers · {st ? st.counts.debtorLedgers : a.counts?.debtorLedgers} under Sundry Debtors</div>
          {st?.counts.cancelledVouchers > 0 && <div className="acc-recon-line muted">{st.counts.cancelledVouchers} cancelled vouchers (kept, not counted)</div>}
          <div className="acc-recon-line">Bills Receivable snapshot: {st?.counts.billsAsOf ? `as on ${fmtDate(st.counts.billsAsOf)}` : 'not sent (optional)'}</div>
          {st && ['ledgers', 'vouchers', 'bills'].map(f => <div key={f} className="acc-recon-line muted">Last {f} push: {when(st.lastPush[f])}</div>)}
        </div>

        {!data.empty && (
          <div className="acc-recon-card">
            <div className="acc-recon-title">Checks against Tally's own figures</div>
            {a.closingChecked > 0
              ? <Check ok={!a.closingDiffs.length}>Closing balances: {a.closingChecked - a.closingDiffs.length} / {a.closingChecked} parties match Tally{a.closingDiffs.length ? '' : ' ✓'}</Check>
              : <div className="acc-recon-line muted">Closing balances: not sent on the ledgers, so not checked</div>}
            {a.closingDiffs.slice(0, 6).map(d => <div key={d.party} className="acc-recon-line muted">{d.party}: Tally {money2(d.tally)} · ours {money2(d.ours)}</div>)}
            {br
              ? <Check ok={br.mismatches === 0}>Pending bills vs Bills Receivable: {br.mismatches === 0 ? `all ${br.count} match bill for bill ✓` : `${br.mismatches} differ`}</Check>
              : <div className="acc-recon-line muted">Bills Receivable: not sent, so not checked</div>}
            {(br?.mismatchList || []).slice(0, 6).map(m => <div key={`${m.party}|${m.ref}`} className="acc-recon-line muted">{m.party} {m.ref}: Tally {money2(m.tally)} · ours {money2(m.ours)}</div>)}
            <Check ok={!a.unknownLedgerCount}>{a.unknownLedgerCount ? `${a.unknownLedgerCount} bill-wise ledger(s) used in vouchers but not sent as Sundry Debtors masters: ${a.unknownLedgers.join(', ')}` : 'Every bill-wise ledger in the vouchers has its master'}</Check>
            {credits > 0 && <div className="acc-recon-line">Unadjusted credits {money2(credits)} — receipts / credit notes not set against a bill</div>}
          </div>
        )}

        {!data.empty && (
          <div className="acc-recon-card">
            <div className="acc-recon-title">Kuber link (by bill number)</div>
            <div className="acc-recon-big">{r.kuberLinked}</div>
            <div className="acc-recon-line">Tally sales / credit notes found in Kuber {a.kuberBranch ? `(branch ${a.kuberBranch})` : `(any ${a.company} branch)`}</div>
            {r.amountMismatches?.length
              ? r.amountMismatches.slice(0, 6).map(m => <div key={m.vchNo} className="acc-recon-line warn">{m.vchNo} · {m.party}: Tally {money2(m.tally)} vs Kuber {money2(m.kuber)}</div>)
              : r.kuberLinked > 0 && <Check ok>Amounts identical on every linked bill</Check>}
          </div>
        )}
      </div>

      <div className="acc-table-head"><div><h3>Push Log</h3><p>Last 25 pushes to this source, newest first (IST)</p></div></div>
      <div className="data-table-wrapper acc-table-wrap">
        <table className="data-table acc-table">
          <thead>
            <tr><th>Received</th><th>Feed</th><th>Batch</th><th>Mode</th><th className="num">Records</th><th className="num">Accepted</th><th className="num">Rejected</th><th>First errors</th></tr>
          </thead>
          <tbody>
            {(st?.pushes || []).map((p, i) => (
              <tr key={i} className={p.rejected || p.envelopeErrors ? 'acc-push-bad' : ''}>
                <td>{when(p.receivedAt)}{p.dryRun && <span className="acc-badge">dry run</span>}</td>
                <td className="mono">{p.feed}</td>
                <td className="mono">{p.envelope?.batch_id || '—'}</td>
                <td>{p.envelope?.sync_mode || '—'}</td>
                <td className="num">{p.received ?? '—'}</td>
                <td className="num">{p.accepted ?? 0}</td>
                <td className="num">{p.rejected ?? 0}</td>
                <td className="acc-push-err">
                  {(p.envelopeErrors || []).join(' · ')}
                  {(p.errorsSample || []).slice(0, 2).map(e => `#${e.index} ${e.key || ''}: ${e.errors[0]}`).join(' · ')}
                </td>
              </tr>
            ))}
            {st && !st.pushes.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Nothing pushed yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AccountingTally = () => {
  const [sources, setSources] = useState(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getAccountingTallySources()
      .then((r) => { setSources(r.data.sources); setSource(s => s || (r.data.sources[0] && r.data.sources[0].key) || ''); })
      .catch(err => setError(err.response?.data?.message || 'Could not load Tally sources'));
  }, []);

  const cfg = useMemo(() => {
    const s = (sources || []).find(x => x.key === source);
    return {
      title: 'Accounting · Tally API',
      subtitle: `${s ? s.label : 'Test'} — receivables built from Tally pushes`,
      exportTitle: `Accounting_TallyAPI_${source}`,
      filePrefix: `TallyAPI_${source}`,
      ledgerPlace: s ? s.label : 'Tally API',
      fetchOutstandings: (params) => getAccountingTallyOutstandings(source, params),
      fetchLedger: (name) => getAccountingTallyLedger(source, name),
      Banner: ApiBanner,
      Panel: ApiPanel,
      unlinked: { label: 'not in Kuber', title: 'No Kuber bill with this number' },
      headerExtra: sources && sources.length > 1 ? (
        <select className="acc-source-pick" value={source} onChange={e => setSource(e.target.value)}>
          {sources.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
      ) : null,
    };
  }, [sources, source]);

  if (error) return <div className="page-content"><div className="acc-empty">{error}</div></div>;
  if (!sources) return <div className="page-content"><div className="acc-empty">Loading…</div></div>;
  if (!source) return <div className="page-content"><div className="acc-empty">No Tally source is set up for your login.</div></div>;
  return <AccountingBook key={source} cfg={cfg} />;
};

export default AccountingTally;
