import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { FiDollarSign, FiPercent, FiFileText, FiTrendingUp, FiChevronLeft, FiChevronRight, FiSearch, FiX, FiDownload } from 'react-icons/fi';
import ChartCard from '../components/ChartCard';
import AIInsightButton from '../components/AIInsightButton';
import ExportControls from '../components/ExportControls';
import NotificationPanel from '../components/NotificationPanel';
import {
  getFinancialSummary, getFinancialTaxTrend,
  getFinancialStateWiseTax, getFinancialGSTTypeSplit,
  getFinancialInvoices, getFinancialInvoicesAll, getFinancialFilters
} from '../services/api';

import { formatINRShort } from '../utils/numberFormat';

const COLORS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f59e0b'];

import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';

const Financial = () => {
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');

  const [filterOptions, setFilterOptions] = useState({ salespersons: [], states: [], gstTypes: [] });
  const [filters, setFilters] = useState({ startDate: '', endDate: '', salesperson: '', state: '', gstType: '' });
  const [appliedFilters, setAppliedFilters] = useState({});

  const [summary, setSummary] = useState(null);
  const [taxTrend, setTaxTrend] = useState([]);
  const [stateWiseTax, setStateWiseTax] = useState([]);
  const [gstTypeSplit, setGstTypeSplit] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceTotalPages, setInvoiceTotalPages] = useState(1);
  const [tableSearch, setTableSearch] = useState('');
  const [trendGroupBy, setTrendGroupBy] = useState('day');
  const searchDebounceRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const formatCurrency = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
  const formatNumber = (v) => new Intl.NumberFormat('en-IN').format(v || 0);
  const moneyScaleY = { ticks: { callback: v => formatINRShort(v) } };
  const moneyTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${formatCurrency(ctx.raw)}` } };

  useEffect(() => {
    getFinancialFilters().then(r => setFilterOptions(r.data.data)).catch(() => {});
  }, []);

  const fetchAll = useCallback(async (params = appliedFilters) => {
    setLoading(true);
    try {
      const [sumRes, stateRes, gstRes] = await Promise.all([
        getFinancialSummary(params),
        getFinancialStateWiseTax(params),
        getFinancialGSTTypeSplit(params)
      ]);
      setSummary(sumRes.data.data);
      setStateWiseTax(stateRes.data.data);
      setGstTypeSplit(gstRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  const fetchTrend = useCallback(async (params = appliedFilters, groupBy = trendGroupBy) => {
    try {
      const res = await getFinancialTaxTrend({ ...params, groupBy });
      setTaxTrend(res.data.data);
    } catch (err) { console.error(err); }
  }, [appliedFilters, trendGroupBy]);

  const fetchInvoices = useCallback(async (page = 1, params = appliedFilters, search = tableSearch) => {
    setTableLoading(true);
    try {
      const res = await getFinancialInvoices({ ...params, page, limit: 50, ...(search ? { search } : {}) });
      setInvoices(res.data.data);
      setInvoiceTotal(res.data.total);
      setInvoiceTotalPages(res.data.totalPages);
      setInvoicePage(page);
    } catch (err) { console.error(err); }
    finally { setTableLoading(false); }
  }, [appliedFilters, tableSearch]);

  const handleTableSearch = (value) => {
    setTableSearch(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchInvoices(1, appliedFilters, value);
    }, 400);
  };

  // Download the ENTIRE filtered invoice register (all pages) as Excel or PDF.
  const buildExportRows = (rows) => rows.map(inv => ({
    'Date': new Date(inv.date).toLocaleDateString('en-IN'),
    'Invoice No': inv.invoiceNo,
    'CR/DR': inv.crDr || '',
    'Customer': inv.customerName || '',
    'City': inv.city || '',
    'State': inv.state || '',
    'GST Type': inv.gstType || '',
    'Salesperson': inv.salesperson || '',
    'Assessable': inv.assessableAmount || 0,
    'CGST': inv.cgst || 0,
    'SGST': inv.sgst || 0,
    'IGST': inv.igst || 0,
    'Cess': inv.gstCess || 0,
    'Bill Amount': inv.billAmount || 0
  }));

  const downloadInvoices = async (format) => {
    try {
      setDownloading(true);
      const res = await getFinancialInvoicesAll({ ...appliedFilters, ...(tableSearch ? { search: tableSearch } : {}) });
      const rows = res.data.data || [];
      if (rows.length === 0) { alert('No invoices to download.'); return; }
      const stamp = new Date().toISOString().split('T')[0];
      const exportRows = buildExportRows(rows);

      if (format === 'excel') {
        const XLSX = window.XLSX;
        if (!XLSX) { alert('Excel library failed to load. Check your connection and retry.'); return; }
        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Invoice Register');
        XLSX.writeFile(wb, `Invoice_Register_${stamp}.xlsx`);
      } else {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) { alert('PDF library failed to load. Check your connection and retry.'); return; }
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        if (typeof doc.autoTable !== 'function') { alert('PDF table plugin failed to load.'); return; }
        const headers = Object.keys(exportRows[0]);
        const money = new Set(['Assessable', 'CGST', 'SGST', 'IGST', 'Cess', 'Bill Amount']);
        const body = exportRows.map(r => headers.map(h => (money.has(h) ? formatCurrency(r[h]) : r[h])));
        doc.setFontSize(13);
        doc.text('Invoice Register', 40, 30);
        doc.setFontSize(9);
        doc.text(`${rows.length} invoices · Generated ${stamp}`, 40, 44);
        doc.autoTable({
          head: [headers],
          body,
          startY: 54,
          styles: { fontSize: 7, cellPadding: 3 },
          headStyles: { fillColor: [37, 99, 235] }
        });
        doc.save(`Invoice_Register_${stamp}.pdf`);
      }
    } catch (err) {
      console.error('Invoice download error:', err);
      alert('Failed to download invoices.');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchTrend();
    fetchInvoices(1);
  }, []);

  useEffect(() => {
    fetchTrend(appliedFilters, trendGroupBy);
  }, [trendGroupBy]);

  const applyFilters = () => {
    const params = {};
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.salesperson) params.salesperson = filters.salesperson;
    if (filters.state) params.state = filters.state;
    if (filters.gstType) params.gstType = filters.gstType;
    setAppliedFilters(params);
    fetchAll(params);
    fetchTrend(params, trendGroupBy);
    fetchInvoices(1, params);
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', salesperson: '', state: '', gstType: '' });
    setAppliedFilters({});
    fetchAll({});
    fetchTrend({}, trendGroupBy);
    fetchInvoices(1, {});
  };

  // --- Chart Data ---

  // Doughnut: tax component breakdown
  const doughnutData = {
    labels: ['CGST', 'SGST', 'IGST', 'GST Cess'],
    datasets: [{
      data: summary ? [summary.totalCGST, summary.totalSGST, summary.totalIGST, summary.totalCess] : [0, 0, 0, 0],
      backgroundColor: COLORS.slice(0, 4),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  // Line: tax trend
  const trendLabels = taxTrend.map(t => t._id);
  const trendLineData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'CGST',
        data: taxTrend.map(t => t.cgst),
        borderColor: COLORS[0],
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3
      },
      {
        label: 'SGST',
        data: taxTrend.map(t => t.sgst),
        borderColor: COLORS[1],
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3
      },
      {
        label: 'IGST',
        data: taxTrend.map(t => t.igst),
        borderColor: COLORS[2],
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3
      }
    ]
  };

  // Bar: state-wise tax
  const stateBarData = {
    labels: stateWiseTax.map(s => s._id),
    datasets: [{
      label: 'Total Tax',
      data: stateWiseTax.map(s => s.totalTax),
      backgroundColor: COLORS[0],
      borderRadius: 5
    }]
  };

  // Bar: GST type split. "Regular" (registered) is relabelled B2B, "Unregistered" B2C.
  const gstTypeLabel = (t) => {
    const s = String(t || '').toLowerCase();
    if (s.includes('regular')) return 'B2B';
    if (s.includes('unregist')) return 'B2C';
    return t;
  };
  const gstTypeBarData = {
    labels: gstTypeSplit.map(g => gstTypeLabel(g._id)),
    datasets: [
      {
        label: 'Assessable Value',
        data: gstTypeSplit.map(g => g.totalAssessable),
        backgroundColor: COLORS[0],
        borderRadius: 5
      },
      {
        label: 'Tax',
        data: gstTypeSplit.map(g => g.totalTax),
        backgroundColor: COLORS[2],
        borderRadius: 5
      }
    ]
  };


  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Financial Overview</h1>
          <p>Tax collections, assessable values, and invoice-level financial details</p>
        </div>
        <div className="page-controls">
          <ExportControls pageTitle="Financials_Overview" />
          {user.role === 'admin' && <NotificationPanel />}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: '24px' }}>
        <input
          type="date"
          value={filters.startDate}
          onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
          style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', background: '#fff' }}
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
          style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', background: '#fff' }}
        />
        <select
          value={filters.salesperson}
          onChange={e => setFilters(f => ({ ...f, salesperson: e.target.value }))}
          style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', background: '#fff' }}
        >
          <option value="">All Salespersons</option>
          {filterOptions.salespersons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filters.state}
          onChange={e => setFilters(f => ({ ...f, state: e.target.value }))}
          style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', background: '#fff' }}
        >
          <option value="">All States</option>
          {filterOptions.states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filters.gstType}
          onChange={e => setFilters(f => ({ ...f, gstType: e.target.value }))}
          style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', background: '#fff' }}
        >
          <option value="">All GST Types</option>
          {filterOptions.gstTypes.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button className="btn-primary" onClick={applyFilters} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--primary-500)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
          Apply
        </button>
        <button onClick={clearFilters} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}>
          Clear
        </button>
      </div>

      {/* AI Banner — above KPIs */}
      {summary && (
        <AIInsightButton
          contextData={summary}
          contextType="Financial Summary — Tax Collections and Invoice Overview"
          title="Generate AI Financial Analysis"
          isBanner={true}
        />
      )}

      {/* KPI Cards */}
      {loading && !summary ? (
        <KPISkeleton />
      ) : summary && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon green"><FiDollarSign /></div>
            <div className="kpi-label">Total Bill Amount</div>
            <div className="kpi-value">{formatCurrency(summary.totalBill)}</div>
            <div className="kpi-sub">Incl. taxes & other charges</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon blue"><FiDollarSign /></div>
            <div className="kpi-label">Assessable Values</div>
            <div className="kpi-value">{formatCurrency(summary.totalAssessable)}</div>
            <div className="kpi-sub">{formatNumber(summary.invoiceCount)} invoices</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon blue"><FiFileText /></div>
            <div className="kpi-label">CGST</div>
            <div className="kpi-value">{formatCurrency(summary.totalCGST)}</div>
            <div className="kpi-sub">Intra-state</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green"><FiFileText /></div>
            <div className="kpi-label">SGST</div>
            <div className="kpi-value">{formatCurrency(summary.totalSGST)}</div>
            <div className="kpi-sub">Intra-state</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange"><FiFileText /></div>
            <div className="kpi-label">IGST</div>
            <div className="kpi-value">{formatCurrency(summary.totalIGST)}</div>
            <div className="kpi-sub">Inter-state</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange"><FiTrendingUp /></div>
            <div className="kpi-label">Total Tax Collected</div>
            <div className="kpi-value">{formatCurrency(summary.totalTax)}</div>
            <div className="kpi-sub">CGST + SGST + IGST + Cess</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon red"><FiPercent /></div>
            <div className="kpi-label">Effective Tax Rate</div>
            <div className="kpi-value">{summary.effectiveTaxRate}%</div>
            <div className="kpi-sub">Tax / Assessable Value</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green"><FiFileText /></div>
            <div className="kpi-label">Credit Notes</div>
            <div className="kpi-value">{formatNumber(summary.creditNotes)}</div>
            <div className="kpi-sub">CR entries</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon red"><FiFileText /></div>
            <div className="kpi-label">Debit Note</div>
            <div className="kpi-value">{formatNumber(summary.debitNotes)}</div>
            <div className="kpi-sub">DR entries</div>
          </div>
        </div>
      )}

      <div className="charts-grid" style={{ marginBottom: '24px' }}>
        {loading && !summary ? (
          <ChartSkeleton />
        ) : summary && (
          <ChartCard
            title="Tax Component Breakdown"
            aiContext={summary}
            aiType="Tax Component Breakdown (CGST, SGST, IGST, Cess)"
          >
            <div className="donut-container">
              <div style={{ flex: '1', minWidth: 0, height: '100%' }}>
                <Doughnut
                  data={doughnutData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`
                        }
                      }
                    },
                    cutout: '60%'
                  }}
                />
              </div>
              <div 
                style={{ 
                  flex: '0 0 160px', 
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflowY: 'auto',
                  maxHeight: '100%',
                  msOverflowStyle: 'thin',
                  scrollbarWidth: 'thin'
                }}
                onWheel={(e) => e.stopPropagation()}
              >
                {doughnutData.labels.map((label, i) => {
                  const val = doughnutData.datasets[0].data[i];
                  const total = doughnutData.datasets[0].data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: doughnutData.datasets[0].backgroundColor[i] }} />
                        <span style={{ fontWeight: 500 }}>{label}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        )}

      </div>

      <div className="charts-grid" style={{ marginBottom: '24px' }}>
        {loading && stateWiseTax.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <ChartCard
            title="State-wise Tax Collection"
            aiContext={stateWiseTax}
            aiType="State-wise GST Tax Collections"
          >
            <Bar
              data={stateBarData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: moneyTooltip },
                scales: {
                  y: moneyScaleY,
                  x: { ticks: { font: { size: 9 } } }
                }
              }}
            />
          </ChartCard>
        )}

        {loading && gstTypeSplit.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <ChartCard
            title="GST Type Split"
            aiContext={gstTypeSplit}
            aiType="GST Type Split — Intra vs Inter State"
          >
            <Bar
              data={gstTypeBarData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTooltip },
                scales: { y: moneyScaleY }
              }}
            />
          </ChartCard>
        )}
      </div>

      {/* Invoice Table — scrolls both ways inside its container, never affects page width */}
      <div className="data-table-wrapper" style={{ marginBottom: '8px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, whiteSpace: 'nowrap' }}>
            Invoice Register
            <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              {formatNumber(invoiceTotal)} total
            </span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {/* Search box */}
            <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: '280px', minWidth: '140px' }}>
              <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search invoice, customer, city…"
                value={tableSearch}
                onChange={e => handleTableSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 32px 7px 32px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.83rem', color: 'var(--text-primary)', background: 'var(--bg-light)', outline: 'none', boxSizing: 'border-box' }}
              />
              {tableSearch && (
                <button
                  onClick={() => handleTableSearch('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                ><FiX size={14} /></button>
              )}
            </div>
            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => { if (invoicePage > 1) fetchInvoices(invoicePage - 1); }}
                disabled={invoicePage <= 1 || tableLoading}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: invoicePage <= 1 ? 'not-allowed' : 'pointer', opacity: invoicePage <= 1 ? 0.4 : 1 }}
              ><FiChevronLeft /></button>
              <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {invoicePage} / {invoiceTotalPages}
              </span>
              <button
                onClick={() => { if (invoicePage < invoiceTotalPages) fetchInvoices(invoicePage + 1); }}
                disabled={invoicePage >= invoiceTotalPages || tableLoading}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: invoicePage >= invoiceTotalPages ? 'not-allowed' : 'pointer', opacity: invoicePage >= invoiceTotalPages ? 0.4 : 1 }}
              ><FiChevronRight /></button>
            </div>
            {/* Download all pages (respects current filters + search) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => downloadInvoices('excel')}
                disabled={downloading}
                title="Download entire filtered register as Excel"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600, cursor: downloading ? 'not-allowed' : 'pointer' }}
              >
                <FiDownload size={14} /> Excel
              </button>
              <button
                onClick={() => downloadInvoices('pdf')}
                disabled={downloading}
                title="Download entire filtered register as PDF"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600, cursor: downloading ? 'not-allowed' : 'pointer' }}
              >
                <FiFileText size={14} /> {downloading ? 'Preparing…' : 'PDF'}
              </button>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '500px', WebkitOverflowScrolling: 'touch' }}>
          {tableLoading ? (
            <TableSkeleton />
          ) : (
            <table className="data-table" style={{ minWidth: '1100px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-light)' }}>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Date</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Invoice No</th>
                  <th style={{ whiteSpace: 'nowrap' }}>CR/DR</th>
                  <th>Customer</th>
                  <th style={{ whiteSpace: 'nowrap' }}>City</th>
                  <th style={{ whiteSpace: 'nowrap' }}>State</th>
                  <th style={{ whiteSpace: 'nowrap' }}>GST Type</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Salesperson</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Assessable</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>CGST</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>SGST</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>IGST</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Cess</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Bill Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={14} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No invoices found</td></tr>
                ) : invoices.map((inv, i) => (
                  <tr key={inv._id || i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{inv.invoiceNo}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {inv.crDr && (
                        <span style={{
                          padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600,
                          background: /cr/i.test(inv.crDr) ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color: /cr/i.test(inv.crDr) ? 'var(--success)' : 'var(--danger)'
                        }}>{inv.crDr}</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.customerName}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{inv.city || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{inv.state || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{inv.gstType || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{inv.salesperson || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{formatCurrency(inv.assessableAmount)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right', color: 'var(--primary-600)' }}>{formatCurrency(inv.cgst)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(inv.sgst)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right', color: inv.igst > 0 ? '#f97316' : 'var(--text-muted)' }}>{formatCurrency(inv.igst)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{formatCurrency(inv.gstCess)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(inv.billAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Financial;
