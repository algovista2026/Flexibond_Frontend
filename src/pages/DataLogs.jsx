import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiDownloadCloud, FiDatabase, FiCheck } from 'react-icons/fi';
import { getDataLogs, triggerDataSync } from '../services/api';
import { branchLabel, companyOfBranch } from '../utils/branchConfig';

const COMPANY_ACCENTS = { UFPL: '#ec4899', UCPL: '#f59e0b', FDL: '#10b981' };
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const relTime = (d) => {
  if (!d) return 'never';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' };

function Kpi({ label, value, sub }) {
  return (
    <div style={card}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontSize: '1.55rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

export default function DataLogs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getDataLogs();
      setData(res.data.data);
    } catch (e) {
      toast.error('Failed to load data logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // auto-refresh every 60s
    return () => clearInterval(t);
  }, [load]);

  // The rebuild runs detached on the server and returns immediately (a long rebuild used to blow the
  // 60 s HTTP timeout and show "Import failed" even though it had succeeded). So we just start it,
  // then poll /summary until `rebuildRunning` clears and report the outcome from there.
  const runSync = async () => {
    setSyncing(true);
    try {
      const res = await triggerDataSync();
      const r = res.data.data || {};
      if (r.started === false) toast.info('A rebuild is already running — this page will update when it finishes.');
      else toast.info('Import started — this page updates automatically when it finishes.');

      for (let i = 0; i < 60; i++) {                 // poll up to ~5 minutes
        await new Promise((s) => setTimeout(s, 5000));
        const fresh = await getDataLogs();
        setData(fresh.data.data);
        if (!fresh.data.data?.totals?.rebuildRunning) {
          toast.success(`Import complete — ${n(fresh.data.data?.totals?.invoices)} invoices / `
            + `${n(fresh.data.data?.totals?.items)} line items in the dashboards.`);
          return;
        }
      }
      toast.info('Still rebuilding — leave this page open, it will refresh on its own.');
    } catch (e) {
      toast.error('Could not start the import: ' + (e.response?.data?.message || e.message));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="page-content"><p>Loading data logs…</p></div>;
  if (!data) return <div className="page-content"><p>No data available.</p></div>;

  const { branches = [], days = [], totals = {} } = data;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Data Logs</h1>
          <p>Kuber data arrivals per branch. Data syncs automatically; use “Import Data Now” to rebuild immediately.</p>
        </div>
        <div className="page-controls" style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} title="Refresh"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
            <FiRefreshCw size={15} /> Refresh
          </button>
          <button onClick={runSync} disabled={syncing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--primary-600)', color: '#fff', cursor: syncing ? 'wait' : 'pointer', fontWeight: 600, opacity: syncing ? 0.7 : 1 }}>
            <FiDownloadCloud size={15} className={syncing ? 'spin' : ''} /> {syncing ? 'Importing…' : 'Import Data Now'}
          </button>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <Kpi label="Branches Live" value={n(totals.branchesLive)} sub="pushing data" />
        <Kpi label="Invoices" value={n(totals.invoices)} sub="in dashboards" />
        <Kpi label="Line Items" value={n(totals.items)} />
        <Kpi label="Sales Entries Rcvd" value={n(totals.entries)} sub="incl. re-sends" />
        <Kpi label="Products Rcvd" value={n(totals.products)} />
        <Kpi label="Accounts Rcvd" value={n(totals.accounts)} />
        <Kpi label="Total Pushes" value={n(totals.pushes)} />
        <Kpi label="Last Rebuild" value={relTime(totals.lastSync)} sub={totals.lastSync ? new Date(totals.lastSync).toLocaleString('en-IN') : ''} />
      </div>

      {/* Per-branch table */}
      <div style={{ ...card, padding: 0, marginBottom: '18px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)' }}>
          <FiDatabase /> <h3 style={{ margin: 0, fontSize: '1rem' }}>By Branch (URL)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 16px' }}>Branch</th>
                <th style={{ padding: '10px' }}>Company</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Invoices</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Products</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Accounts</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Pushes</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Date &amp; Time Received (Latest)</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => {
                const accent = COMPANY_ACCENTS[String(b.company).toUpperCase()] || '#6366f1';
                return (
                  <tr key={b.branch} style={{ borderTop: '1px solid var(--border-color)', fontSize: '0.88rem' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: accent, marginRight: '8px' }} />
                      {branchLabel(b.branch)}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.78rem', marginLeft: '6px' }}>{b.branch}</span>
                    </td>
                    <td style={{ padding: '10px', color: accent, fontWeight: 600 }}>{b.company || '—'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{n(b.invoices)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{n(b.products)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{n(b.accounts)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{n(b.pushes)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {b.lastReceived ? new Date(b.lastReceived).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calendar: a tick per day each branch sent data */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)' }}>
          <FiCheck /> <h3 style={{ margin: 0, fontSize: '1rem' }}>Arrivals Calendar</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>· ✓ = sales data received that day (hover for count)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 16px', textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Branch</th>
                {days.map((d) => (
                  <th key={d} style={{ padding: '8px 6px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{d.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.branch} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 600, fontSize: '0.85rem', position: 'sticky', left: 0, background: 'var(--bg-card)', whiteSpace: 'nowrap' }}>{branchLabel(b.branch)}</td>
                  {days.map((d) => {
                    const cnt = b.byDay?.[d] || 0;
                    return (
                      <td key={d} style={{ padding: '6px', textAlign: 'center' }} title={cnt ? `${cnt} sales entries on ${d}` : `no data on ${d}`}>
                        {cnt ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700, fontSize: '0.72rem' }}>
                            <FiCheck size={14} />
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', width: '26px', height: '26px', borderRadius: '6px', background: 'var(--bg-hover, rgba(0,0,0,0.04))' }} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
