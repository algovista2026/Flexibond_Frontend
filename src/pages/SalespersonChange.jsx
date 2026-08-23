import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import { FiSearch, FiRefreshCw, FiUserCheck, FiRotateCcw, FiChevronDown, FiAlertTriangle } from 'react-icons/fi';
import {
  spChangeGetSalespeople, spChangeLookupInvoice, spChangeApply, spChangeHistory, spChangeUndo,
} from '../services/api';

/**
 * Salesperson Change (admin) — re-assign ONE invoice to a different salesperson.
 *
 * Flow: type an invoice no → look it up → confirm it's the right bill → pick the replacement from a
 * searchable dropdown → apply. Every change is logged in the table below and can be undone.
 *
 * The change is stored as an OVERRIDE server-side, because the dashboards' invoice collections are
 * rebuilt from the Kuber captures every ~10 minutes — see routes/salespersonChange.js.
 */
const SalespersonChange = () => {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState('');

  const [salespeople, setSalespeople] = useState([]);
  const [target, setTarget] = useState('');
  const [applying, setApplying] = useState(false);

  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  const fmtINR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  useEffect(() => {
    spChangeGetSalespeople()
      .then(res => setSalespeople(res.data.data || []))
      .catch(() => setSalespeople([]));
    loadHistory();
  }, []);

  const loadHistory = () => {
    setHistLoading(true);
    spChangeHistory()
      .then(res => setHistory(res.data.data || []))
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false));
  };

  const lookup = async (e) => {
    e?.preventDefault();
    const q = invoiceNo.trim();
    if (!q) return;
    setLooking(true); setNotFound(''); setInvoice(null); setTarget('');
    try {
      const res = await spChangeLookupInvoice(q);
      setInvoice(res.data.data);
    } catch (err) {
      setNotFound(err.response?.data?.message || 'Lookup failed');
    } finally {
      setLooking(false);
    }
  };

  const apply = async () => {
    if (!invoice || !target) return;
    setApplying(true);
    try {
      const res = await spChangeApply(invoice.invoiceNo, target);
      toast.success(res.data.message || 'Salesperson updated');
      // Re-lookup so the card shows the new owner (and its own change history).
      const fresh = await spChangeLookupInvoice(invoice.invoiceNo);
      setInvoice(fresh.data.data);
      setTarget('');
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update salesperson');
    } finally {
      setApplying(false);
    }
  };

  const undo = async (row) => {
    if (!window.confirm(`Undo this change?\n\n${row.invoiceNo} would go back to ${row.fromSalesperson || '(unassigned)'}.`)) return;
    try {
      const res = await spChangeUndo(row._id);
      toast.success(res.data.message || 'Change undone');
      loadHistory();
      if (invoice && invoice.invoiceNo === row.invoiceNo) {
        const fresh = await spChangeLookupInvoice(invoice.invoiceNo);
        setInvoice(fresh.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not undo');
    }
  };

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' };
  const labelSty = { display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '6px' };
  const inputSty = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '0.92rem', color: 'var(--text-primary)' };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Salesperson Change</h1>
          <p>Re-assign a single invoice to a different salesperson. Nothing else on the invoice is touched.</p>
        </div>
        <div className="page-controls">
          <button onClick={loadHistory} title="Refresh history"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
            <FiRefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Step 1: find the invoice ─────────────────────────────────────── */}
      <div style={{ ...card, padding: '22px', marginBottom: '20px' }}>
        <form onSubmit={lookup} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <label style={labelSty}>Invoice Number</label>
            <input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="e.g. UFPL/G/1234"
              style={inputSty}
            />
          </div>
          <button type="submit" disabled={looking || !invoiceNo.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'var(--primary-600)', color: '#fff', fontWeight: 600, cursor: looking || !invoiceNo.trim() ? 'not-allowed' : 'pointer', opacity: looking || !invoiceNo.trim() ? 0.6 : 1 }}>
            <FiSearch size={15} /> {looking ? 'Searching…' : 'Find Invoice'}
          </button>
        </form>

        {notFound && (
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.88rem' }}>
            <FiAlertTriangle size={15} /> {notFound}
          </div>
        )}
      </div>

      {/* ── Step 2: confirm + re-assign ──────────────────────────────────── */}
      {invoice && (
        <div style={{ ...card, padding: '22px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Invoice {invoice.invoiceNo}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '22px' }}>
            <Field label="Date" value={fmtDate(invoice.date)} />
            <Field label="Customer" value={invoice.customerName || '—'} />
            <Field label="Current Salesperson" value={invoice.salesperson || '(unassigned)'} strong />
            <Field label="Branch" value={invoice.branch || '—'} />
            <Field label="Revenue (Excl. Taxes)" value={fmtINR(invoice.assessableAmount)} />
            <Field label="Line Items" value={invoice.lineCount} />
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: '18px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <label style={labelSty}>Change Salesperson To</label>
              <SalespersonPicker
                options={salespeople}
                value={target}
                onChange={setTarget}
                exclude={invoice.salesperson}
              />
            </div>
            <button onClick={apply} disabled={!target || applying}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: !target || applying ? 'var(--border-color)' : '#059669', color: !target || applying ? 'var(--text-muted)' : '#fff', fontWeight: 600, cursor: !target || applying ? 'not-allowed' : 'pointer' }}>
              <FiUserCheck size={15} /> {applying ? 'Applying…' : 'Apply Change'}
            </button>
          </div>

          {target && (
            <p style={{ margin: '14px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>{invoice.salesperson || '(unassigned)'}</strong> → <strong style={{ color: '#059669' }}>{target}</strong>
              {' '}· moves {fmtINR(invoice.assessableAmount)} and {invoice.lineCount} line item{invoice.lineCount === 1 ? '' : 's'}.
            </p>
          )}

          {invoice.history?.length > 0 && (
            <p style={{ margin: '14px 0 0', fontSize: '0.82rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiAlertTriangle size={14} /> This invoice has already been re-assigned {invoice.history.length} time{invoice.history.length === 1 ? '' : 's'}.
            </p>
          )}
        </div>
      )}

      {/* ── Step 3: audit log ────────────────────────────────────────────── */}
      <div className="data-table-wrapper" style={card}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
            Previous Changes {history.length ? `(${history.length})` : ''}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Every re-assignment made, newest first. Undo puts the invoice back to whatever Kuber sent.
          </p>
        </div>
        <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th>Invoice No</th>
                <th>Customer</th>
                <th>From</th>
                <th>To</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Changed By</th>
                <th>Changed At</th>
                <th style={{ textAlign: 'right' }}>Undo</th>
              </tr>
            </thead>
            <tbody>
              {histLoading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Loading…</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No salesperson changes yet.</td></tr>
              ) : history.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontWeight: 600 }}>{r.invoiceNo}</td>
                  <td>{r.customerName || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.fromSalesperson || '(unassigned)'}</td>
                  <td style={{ fontWeight: 600, color: '#059669' }}>{r.toSalesperson}</td>
                  <td style={{ textAlign: 'right' }}>{fmtINR(r.invoiceAmount)}</td>
                  <td>{r.changedBy || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.changedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => undo(r)} title="Undo this change"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                      <FiRotateCcw size={13} /> Undo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, strong }) => (
  <div>
    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: strong ? '1rem' : '0.92rem', fontWeight: strong ? 700 : 500, color: strong ? 'var(--primary-600)' : 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</div>
  </div>
);

/** Searchable single-select dropdown for the replacement salesperson. */
const SalespersonPicker = ({ options, value, onChange, exclude }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (options || [])
      .filter(n => !exclude || n.toLowerCase() !== String(exclude).toLowerCase())
      .filter(n => !term || n.toLowerCase().includes(term));
  }, [options, q, exclude]);

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', fontSize: '0.92rem', color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: value ? 600 : 400 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || 'Select salesperson…'}</span>
        <FiChevronDown size={15} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 40, background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search salesperson…"
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.86rem' }} />
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {list.length === 0 ? (
              <div style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>No match</div>
            ) : list.map(n => (
              <div key={n} onClick={() => { onChange(n); setOpen(false); setQ(''); }}
                style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '0.88rem', background: n === value ? 'var(--primary-50, #eff6ff)' : 'transparent', fontWeight: n === value ? 600 : 400 }}
                onMouseEnter={(e) => { if (n !== value) e.currentTarget.style.background = 'var(--bg-hover, #f8fafc)'; }}
                onMouseLeave={(e) => { if (n !== value) e.currentTarget.style.background = 'transparent'; }}>
                {n}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalespersonChange;
