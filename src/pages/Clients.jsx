import React, { useState, useEffect } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import FilterBar from '../components/FilterBar';
import ExportControls from '../components/ExportControls';
import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';
import { getFilters, getClients, getClientOrders, getClientAnalysis } from '../services/api';
import { formatINRShort, formatShort } from '../utils/numberFormat';
import { getGlobalMaster, setGlobalMaster } from '../utils/globalFilters';

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];

const Clients = () => {
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], group: [],
    colour: [], thickness: [], format: '', product: '', dimensions: '', group1: [], master: getGlobalMaster()
  });
  const [filterOptions, setFilterOptions] = useState({});
  const [metric, setMetric] = useState('revenue');

  const [clients, setClients] = useState(null);
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(true);

  const [selected, setSelected] = useState(null);        // client name
  const [orders, setOrders] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null); // null = cumulative
  const [detailLoading, setDetailLoading] = useState(false);

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val || 0);
  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Quantity';
  const axisFmt = (v) => metric === 'revenue' ? formatINRShort(v) : formatShort(v);
  const metricVal = (row) => metric === 'revenue' ? (row.revenue ?? row.totalAmount) : (row.qty ?? row.totalQty);

  // Filter options — cascaded: re-fetched with the current filters so each dropdown only
  // offers values that still return rows (e.g. Master trims the others).
  useEffect(() => {
    getFilters(filters).then(res => setFilterOptions(res.data.data)).catch(() => {});
  }, [filters]);

  useEffect(() => {
    setListLoading(true);
    getClients(filters)
      .then(res => setClients(res.data.data || []))
      .catch(() => setClients([]))
      .finally(() => setListLoading(false));
  }, [filters]);

  // When a client is selected (or filters/invoice change), pull orders + analysis.
  useEffect(() => {
    if (!selected) { setOrders(null); setAnalysis(null); return; }
    setDetailLoading(true);
    const analysisParams = selectedInvoice ? { ...filters, invoiceNo: selectedInvoice } : filters;
    Promise.all([
      getClientOrders(selected, filters),
      getClientAnalysis(selected, analysisParams)
    ])
      .then(([ordRes, anRes]) => {
        setOrders(ordRes.data.data || []);
        setAnalysis(anRes.data.data || null);
      })
      .catch(() => { setOrders([]); setAnalysis(null); })
      .finally(() => setDetailLoading(false));
  }, [selected, selectedInvoice, filters]);

  const handleFilterChange = (newFilters, clear = false) => {
    if (clear) {
      setGlobalMaster([]); // Master is universal — clearing here clears it everywhere.
      setFilters({
        startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], group: [],
        colour: [], thickness: [], format: '', product: '', dimensions: '', group1: [], master: []
      });
    } else {
      if ('master' in newFilters) setGlobalMaster(newFilters.master);
      setFilters(prev => ({ ...prev, ...newFilters }));
    }
  };

  const selectClient = (name) => {
    setSelected(name);
    setSelectedInvoice(null);
  };

  const visibleClients = (clients || []).filter(c =>
    !search.trim() || String(c._id).toLowerCase().includes(search.trim().toLowerCase())
  );

  // ---- Chart data builders (respect the metric toggle) ----
  const pieData = (rows) => ({
    labels: (rows || []).map(r => r._id || '—'),
    datasets: [{
      label: metricLabel,
      data: (rows || []).map(metricVal),
      backgroundColor: (rows || []).map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  });

  const productBarData = {
    labels: (analysis?.byProduct || []).map(r => r._id || '—'),
    datasets: [{
      label: metricLabel,
      data: (analysis?.byProduct || []).map(metricVal),
      backgroundColor: '#2563eb',
      borderRadius: 4
    }]
  };

  const pieOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.raw || 0;
            const total = ctx.dataset.data.reduce((a, b, i) => a + (ctx.chart.getDataVisibility(i) ? b : 0), 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            return ` ${ctx.label}: ${metric === 'revenue' ? formatCurrency(val) : formatNumber(val)} (${pct}%)`;
          }
        }
      }
    }
  };
  const barTooltip = { callbacks: { label: (ctx) => ` ${metric === 'revenue' ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}` } };

  const totals = analysis?.totals || { revenue: 0, qty: 0, orderCount: 0, productCount: 0 };
  const fav = analysis?.favSalesman;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Client Analytics</h1>
          <p>Account-wise analysis — orders, revenue, favourite salesperson, and product mix per client</p>
        </div>
        <div className="page-controls">
          <div className="metric-toggle">
            <button onClick={() => setMetric('revenue')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: metric === 'revenue' ? '#fff' : 'transparent', boxShadow: metric === 'revenue' ? 'var(--shadow-sm)' : 'none', fontWeight: 600, cursor: 'pointer', color: metric === 'revenue' ? 'var(--primary-600)' : 'var(--text-secondary)' }}>Revenue</button>
            <button onClick={() => setMetric('qty')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: metric === 'qty' ? '#fff' : 'transparent', boxShadow: metric === 'qty' ? 'var(--shadow-sm)' : 'none', fontWeight: 600, cursor: 'pointer', color: metric === 'qty' ? 'var(--primary-600)' : 'var(--text-secondary)' }}>Quantity</button>
          </div>
          <ExportControls pageTitle="Client_Analytics" />
        </div>
      </div>

      <FilterBar filters={filters} options={filterOptions} onFilterChange={handleFilterChange} showGroup />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '20px', alignItems: 'start' }}>
        {/* ---- Left: client list ---- */}
        <div className="data-table-wrapper" style={{ position: 'sticky', top: '16px' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 10px' }}>
              Clients {clients ? `(${visibleClients.length})` : ''}
            </h3>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
            />
          </div>
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {listLoading ? (
              <div style={{ padding: '18px' }}><TableSkeleton /></div>
            ) : visibleClients.length === 0 ? (
              <p style={{ padding: '18px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No clients match.</p>
            ) : visibleClients.map((c) => (
              <button
                key={c._id}
                onClick={() => selectClient(c._id)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', textAlign: 'left',
                  padding: '12px 18px', border: 'none', borderBottom: '1px solid var(--border-color)',
                  background: selected === c._id ? 'var(--primary-50, #eff6ff)' : 'transparent',
                  cursor: 'pointer', borderLeft: selected === c._id ? '3px solid var(--primary-600)' : '3px solid transparent'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{c._id}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {formatCurrency(c.revenue)} · {c.orderCount} order{c.orderCount === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- Right: detail ---- */}
        <div style={{ minWidth: 0 }}>
          {!selected ? (
            <div className="chart-card" style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
              <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>Select a client</h3>
              <p>Pick a client from the list to see their orders and analytics.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{selected}</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selectedInvoice ? (
                    <>
                      Viewing order <strong>{selectedInvoice}</strong>
                      <button
                        onClick={() => setSelectedInvoice(null)}
                        style={{ border: '1px solid var(--border-color)', borderRadius: '6px', background: '#fff', color: 'var(--primary-600)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', padding: '4px 10px' }}
                      >
                        ← All orders (cumulative)
                      </button>
                    </>
                  ) : <>Cumulative across all orders</>}
                </span>
              </div>

              {detailLoading && !analysis ? (
                <KPISkeleton />
              ) : (
                <div className="kpi-grid" style={{ marginBottom: '24px' }}>
                  <KPICard title={metric === 'revenue' ? 'Total Revenue (Incl. Tax)' : 'Total Quantity'} value={metric === 'revenue' ? formatCurrency(totals.revenue) : formatNumber(totals.qty)} subtext={selectedInvoice ? 'This order' : 'All orders'} />
                  <KPICard title="Total Orders" value={formatNumber(totals.orderCount)} subtext="Distinct invoices" />
                  <KPICard title="Favourite Salesperson" value={fav ? fav._id : '—'} subtext={fav ? `${formatCurrency(fav.revenue)} · ${fav.orderCount} orders` : 'No data'} />
                  <KPICard title="Unique Products" value={formatNumber(totals.productCount)} subtext={metric === 'revenue' ? `Qty ${formatNumber(totals.qty)}` : formatCurrency(totals.revenue)} />
                </div>
              )}

              <div className="charts-grid">
                {/* Product-wise */}
                {detailLoading && !analysis ? <ChartSkeleton /> : (analysis?.byProduct?.length > 0) && (
                  <ChartCard title={`Product-wise ${metricLabel}`} fullWidth aiContext={analysis.byProduct} aiType="Client product mix">
                    <Bar
                      data={productBarData}
                      options={{
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: { legend: { display: false }, tooltip: barTooltip },
                        scales: { x: { ticks: { callback: v => axisFmt(v) } }, y: { ticks: { font: { size: 10 } } } }
                      }}
                    />
                  </ChartCard>
                )}

                {/* Grade */}
                {(analysis?.byGrade?.length > 0) && (
                  <ChartCard title={`Grade-wise ${metricLabel}`} aiContext={analysis.byGrade} aiType="Client grade mix">
                    <Pie data={pieData(analysis.byGrade)} options={pieOptions} />
                  </ChartCard>
                )}

                {/* Group */}
                {(analysis?.byGroup?.length > 0) && (
                  <ChartCard title={`Group-wise ${metricLabel}`} aiContext={analysis.byGroup} aiType="Client group mix">
                    <Pie data={pieData(analysis.byGroup)} options={pieOptions} />
                  </ChartCard>
                )}

                {/* Group 1 */}
                {(analysis?.byGroup1?.length > 0) && (
                  <ChartCard title={`Group 1 ${metricLabel}`} aiContext={analysis.byGroup1} aiType="Client Group 1 mix">
                    <Pie data={pieData(analysis.byGroup1)} options={pieOptions} />
                  </ChartCard>
                )}

                {/* Master */}
                {(analysis?.byMaster?.length > 0) && (
                  <ChartCard title={`Master ${metricLabel}`} aiContext={analysis.byMaster} aiType="Client Master mix">
                    <Pie data={pieData(analysis.byMaster)} options={pieOptions} />
                  </ChartCard>
                )}
              </div>

              {/* Orders table */}
              <div className="data-table-wrapper" style={{ marginTop: '24px' }}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Orders {orders ? `(${orders.length})` : ''}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Click an order to see just that order's analytics above.</p>
                </div>
                <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  {detailLoading && !orders ? (
                    <div style={{ padding: '18px' }}><TableSkeleton /></div>
                  ) : (
                    <table className="data-table">
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th>Invoice No</th><th>Date</th><th>Salesperson</th><th>Lines</th><th>Quantity</th><th>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orders || []).map((o) => (
                          <tr
                            key={o._id}
                            onClick={() => setSelectedInvoice(o._id)}
                            style={{ cursor: 'pointer', background: selectedInvoice === o._id ? 'var(--primary-50, #eff6ff)' : 'transparent' }}
                          >
                            <td style={{ fontWeight: 600, color: selectedInvoice === o._id ? 'var(--primary-600)' : 'inherit' }}>{o._id}</td>
                            <td>{o.date ? new Date(o.date).toLocaleDateString('en-IN') : '—'}</td>
                            <td>{o.salesperson || '—'}</td>
                            <td>{formatNumber(o.lineCount)}</td>
                            <td>{formatNumber(o.qty)}</td>
                            <td style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{formatCurrency(o.revenue)}</td>
                          </tr>
                        ))}
                        {orders && orders.length === 0 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>No orders for the current filters.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Clients;
