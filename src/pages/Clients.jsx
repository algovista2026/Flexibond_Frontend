import React, { useState, useEffect } from 'react';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import FilterBar from '../components/FilterBar';
import ExportControls from '../components/ExportControls';
import ScrollColumnChart from '../components/ScrollColumnChart';
import ScrollRowChart from '../components/ScrollRowChart';
import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';
import { getFilters, getClients, getClientOrders, getClientAnalysis } from '../services/api';
import { formatINRShort, formatShort, ratePerFoot } from '../utils/numberFormat';
import { seedFilters, setGlobalFilters, clearGlobalFilters } from '../utils/globalFilters';
import { mergeFilterOptions } from '../utils/filterOptionsCache';
import { PALETTES, ACCENTS, pieColors } from '../utils/chartPalettes';
import { th } from '../utils/thHeader';

const Clients = () => {
  const [filters, setFilters] = useState(seedFilters({
    startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], group: [],
    colour: [], batch: [], thickness: [], format: '', product: '', dimensions: '', group1: [], master: [], company: [], branch: []
  }));
  const [filterOptions, setFilterOptions] = useState({});
  const [metric, setMetric] = useState('revenue');

  const [clients, setClients] = useState(null);
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(true);

  const [selected, setSelected] = useState([]);          // array of client names (multi-select)
  const [orders, setOrders] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null); // null = cumulative
  const [detailLoading, setDetailLoading] = useState(false);

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val || 0);
  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Quantity';
  // Single-bracket title suffix (Title Case brackets, client request 2026-07-27).
  const titleTag = metric === 'revenue' ? ' (Revenue Excl. Taxes)' : ' (Quantity)';
  const axisFmt = (v) => metric === 'revenue' ? formatINRShort(v) : formatShort(v);
  const metricVal = (row) => metric === 'revenue' ? (row.revenue ?? row.totalAmount) : (row.qty ?? row.totalQty);

  // Filter options — cascaded: re-fetched with the current filters so each dropdown only
  // offers values that still return rows (e.g. Master trims the others).
  useEffect(() => {
    getFilters(filters).then(res => setFilterOptions(mergeFilterOptions(res.data.data))).catch(() => {});
  }, [filters]);

  useEffect(() => {
    setListLoading(true);
    getClients(filters)
      .then(res => setClients(res.data.data || []))
      .catch(() => setClients([]))
      .finally(() => setListLoading(false));
  }, [filters]);

  // Orders list for all selected clients (aggregated) via the ?names= list. Deliberately NOT
  // keyed on `selectedInvoice` — picking an order only re-scopes the analytics above, the order
  // list itself is unchanged, so refetching it just made the table re-render for nothing.
  useEffect(() => {
    if (!selected.length) { setOrders(null); return; }
    let cancelled = false;
    getClientOrders(selected[0], { ...filters, names: selected })
      .then(res => { if (!cancelled) setOrders(res.data.data || []); })
      .catch(() => { if (!cancelled) setOrders([]); });
    return () => { cancelled = true; };
  }, [selected, filters]);

  // Analytics — cumulative across the selection, or scoped to one order via ?invoiceNo=.
  // `detailLoading` is cleared in the same tick as the data (NOT in a `.finally`, which is a
  // separate microtask and therefore a separate React commit + repaint).
  useEffect(() => {
    if (!selected.length) { setAnalysis(null); setDetailLoading(false); return; }
    let cancelled = false;
    setDetailLoading(true);
    const params = { ...filters, names: selected };
    if (selectedInvoice) params.invoiceNo = selectedInvoice;
    getClientAnalysis(selected[0], params)
      .then(res => { if (!cancelled) { setAnalysis(res.data.data || null); setDetailLoading(false); } })
      .catch(() => { if (!cancelled) { setAnalysis(null); setDetailLoading(false); } });
    return () => { cancelled = true; };
  }, [selected, selectedInvoice, filters]);

  const handleFilterChange = (newFilters, clear = false) => {
    if (clear) {
      const reset = {
        startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], group: [],
        colour: [], batch: [], thickness: [], format: '', product: '', dimensions: '', group1: [], master: [], company: [], branch: []
      };
      clearGlobalFilters(); // filters are universal — clearing here clears them everywhere.
      setFilters(reset);
    } else {
      setFilters(prev => {
        const next = { ...prev, ...newFilters };
        setGlobalFilters(next); // persist so the whole filter set carries across pages.
        return next;
      });
    }
  };

  // Toggle a client in/out of the multi-selection.
  const toggleClient = (name) => {
    setSelectedInvoice(null);
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const visibleClients = (clients || []).filter(c =>
    !search.trim() || String(c._id).toLowerCase().includes(search.trim().toLowerCase())
  );

  // ---- Chart data builders (respect the metric toggle) ----
  const pieData = (rows, paletteKey) => ({
    labels: (rows || []).map(r => r._id || '—'),
    datasets: [{
      label: metricLabel,
      data: (rows || []).map(metricVal),
      backgroundColor: pieColors(paletteKey, (rows || []).length),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  });

  const productBarData = {
    labels: (analysis?.byProduct || []).map(r => r._id || '—'),
    datasets: [{
      label: metricLabel,
      data: (analysis?.byProduct || []).map(metricVal),
      backgroundColor: ACCENTS.product,
      borderRadius: 4
    }]
  };

  const barData = (rows, color) => ({
    labels: (rows || []).map(r => r._id || '—'),
    datasets: [{
      label: metricLabel,
      data: (rows || []).map(metricVal),
      backgroundColor: color,
      borderRadius: 4
    }]
  });

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

  // Shared prop bundles for the two wrapper charts. These used to be inline `ScrollBar` /
  // `VColumnBar` COMPONENTS declared here in the render body — a fresh component *type* on every
  // render, which made React unmount + remount the Chart.js canvases on every state change. That
  // is what made the page flicker twice per order click (blank → old data → blank → new data):
  // clicking a row commits twice (selection + loaded data) and each commit rebuilt the canvas.
  // Passing plain prop objects to a stable component keeps the same canvas and just updates it.
  const rowChartProps = (rows, color) => ({
    labels: (rows || []).map(r => r._id || '—'),
    values: (rows || []).map(metricVal),
    label: metricLabel,
    color,
    valueFmt: (v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(v),
    xFmt: axisFmt,
  });

  const columnChartProps = (rows, color) => ({
    labels: (rows || []).map(r => r._id || '—'),
    values: (rows || []).map(metricVal),
    label: metricLabel,
    color,
    yFmt: axisFmt,
    valueFmt: (v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(v),
  });

  const totals = analysis?.totals || { revenue: 0, revenueIncl: 0, qty: 0, orderCount: 0, productCount: 0 };
  const fav = analysis?.favSalesman;
  const rates = analysis?.productRates || [];
  const multi = selected.length > 1;
  const detailTitle = selected.length === 1 ? selected[0] : `${selected.length} clients selected`;

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

      <FilterBar showBatch filters={filters} options={filterOptions} onFilterChange={handleFilterChange} showGroup />

      {/* Horizontal client selector strip (like the Salesperson leaderboard) — multi-select. */}
      <div className="sp-leaderboard-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Clients {clients ? `(${visibleClients.length})` : ''}</h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            style={{ height: '38px', minWidth: '220px', flex: '0 1 300px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
          />
          {selected.length > 0 && (
            <button
              onClick={() => { setSelected([]); setSelectedInvoice(null); }}
              style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Clear all ({selected.length})
            </button>
          )}
        </div>

        {/* Selected clients as removable chips (like the applied-filters bar) so it's easy to
            see + drop individual selections. */}
        {selected.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            {selected.map(name => (
              <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 6px 5px 12px', borderRadius: '16px', background: 'var(--primary-50, #eff6ff)', border: '1px solid var(--primary-200, #bfdbfe)', color: 'var(--primary-700, #1d4ed8)', fontSize: '0.8rem', fontWeight: 600, maxWidth: '260px' }} title={name}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <button
                  onClick={() => toggleClient(name)}
                  aria-label={`Remove ${name}`}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {listLoading ? (
          <TableSkeleton />
        ) : (
          <div className="sp-strip-cards" style={{ paddingBottom: '14px' }}>
            {visibleClients.map((c) => (
              <div
                key={c._id}
                className={`sp-card ${selected.includes(c._id) ? 'active' : ''}`}
                onClick={() => toggleClient(c._id)}
                style={{ width: '210px', minHeight: '112px' }}
              >
                <div className="sp-name" style={{ margin: '0 0 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c._id}>{c._id}</div>
                <div className="sp-stats">
                  <div>
                    <div className="sp-stat-label">Revenue</div>
                    <div className="sp-stat-value" style={{ color: 'var(--primary-600)' }}>{formatCurrency(c.revenue)}</div>
                  </div>
                  <div>
                    <div className="sp-stat-label">Orders</div>
                    <div className="sp-stat-value">{c.orderCount}</div>
                  </div>
                </div>
              </div>
            ))}
            {visibleClients.length === 0 && (
              <p style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No clients match.</p>
            )}
          </div>
        )}
      </div>

      {/* ---- Detail (full width, below the strip) ---- */}
      {selected.length === 0 ? (
        <div className="chart-card" style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>Select one or more clients</h3>
          <p>Pick clients from the strip above to see their orders and analytics (multi-select supported).</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }} title={selected.join(', ')}>{detailTitle}</h2>
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
              <KPICard title="Total Revenue (Excl. Taxes)" value={formatCurrency(totals.revenue)} subtext={selectedInvoice ? 'This order' : 'All orders'} />
              <KPICard title="Total Revenue (Incl. Taxes)" value={formatCurrency(totals.revenueIncl)} subtext={selectedInvoice ? 'This order' : 'All orders'} />
              <KPICard title="Total Orders" value={formatNumber(totals.orderCount)} subtext="Distinct invoices" />
              <KPICard title="Favourite Salesperson" value={fav ? fav._id : '—'} subtext={fav ? `${formatCurrency(fav.revenue)} · ${fav.orderCount} orders` : 'No data'} />
              <KPICard title="Unique Products" value={formatNumber(totals.productCount)} subtext={`Qty ${formatNumber(totals.qty)}`} />
            </div>
          )}

          <div className="charts-grid">
            {/* (Row 1, full width) Product-wise revenue */}
            {detailLoading && !analysis ? <ChartSkeleton fullWidth /> : (analysis?.byProduct?.length > 0) && (
              <ChartCard title={`Product-wise${titleTag}`} fullWidth aiContext={analysis.byProduct} aiType="Client product mix">
                <Bar
                  data={productBarData}
                  options={{
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false }, tooltip: barTooltip },
                    scales: {
                      x: { ticks: { callback: v => axisFmt(v) } },
                      y: {
                        ticks: {
                          callback: function(value) {
                            const label = this.getLabelForValue(value);
                            return label && label.length > 18 ? label.substring(0, 16) + '...' : label;
                          },
                          font: { size: 10 }
                        }
                      }
                    }
                  }}
                />
              </ChartCard>
            )}

            {/* (1,2) Master */}
            {(analysis?.byMaster?.length > 0) && (
              <ChartCard title={`Master-wise${titleTag}`} aiContext={analysis.byMaster} aiType="Client Master mix">
                <Pie data={pieData(analysis.byMaster, 'master')} options={pieOptions} />
              </ChartCard>
            )}

            {/* (2,2) Category (field `group`) — emerald */}
            {(analysis?.byGroup?.length > 0) && (
              <ChartCard title={`Category-wise${titleTag}`} aiContext={analysis.byGroup} aiType="Client category mix">
                <Pie data={pieData(analysis.byGroup, 'pastel')} options={pieOptions} />
              </ChartCard>
            )}

            {/* (1,3) Sub-Category (field `category`) — BLUE doughnut, replicates the Products
                page's "Sub-categories in" donut (side legend + full name on hover). */}
            {(analysis?.bySubcategory?.length > 0) && (
              <ChartCard title={`Sub-Category-wise${titleTag}`} aiContext={analysis.bySubcategory} aiType="Client sub-category mix">
                <div className="donut-container">
                  <div style={{ flex: '1 1 55%', minWidth: 0, height: '100%' }}>
                    <Doughnut
                      data={pieData(analysis.bySubcategory, 'subcategory')}
                      options={{
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (ctx) => {
                                const val = ctx.raw || 0;
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                return ` ${ctx.label}: ${metric === 'revenue' ? formatCurrency(val) : formatNumber(val)} (${pct}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="custom-legend" style={{ flex: '0 0 42%', maxHeight: '100%', overflowY: 'auto', paddingRight: '6px' }}>
                    {(analysis.bySubcategory || []).map((c, i) => {
                      const val = metricVal(c);
                      const total = (analysis.bySubcategory || []).reduce((acc, r) => acc + metricVal(r), 0);
                      const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                      const color = PALETTES.subcategory[i % PALETTES.subcategory.length];
                      return (
                        <div key={i} className="legend-item" title={c._id || '—'}>
                          <div className="legend-label">
                            <div className="legend-dot" style={{ background: color }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c._id || '—'}</span>
                          </div>
                          <span className="legend-percentage">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ChartCard>
            )}

            {/* (2,3) Grade */}
            {(analysis?.byGrade?.length > 0) && (
              <ChartCard title={`Grade-wise${titleTag}`} aiContext={analysis.byGrade} aiType="Client grade mix">
                <Doughnut data={pieData(analysis.byGrade, 'pastelAlt')} options={{ ...pieOptions, cutout: '35%' }} />
              </ChartCard>
            )}

            {/* (1,4) Colour preference — teal horizontal rows, fills the card */}
            {(analysis?.byColour?.length > 0) && (
              <ChartCard title={`Colour Breakdown${titleTag}`} aiContext={analysis.byColour} aiType="Client colour preference">
                <ScrollRowChart {...rowChartProps(analysis.byColour, ACCENTS.colour)} />
              </ChartCard>
            )}

            {/* (2,4) Thickness / Section — purple vertical columns. */}
            {(analysis?.byThickness?.length > 0) && (
              <ChartCard title={`Thickness/Section${titleTag}`} aiContext={analysis.byThickness} aiType="Client thickness preference">
                <ScrollColumnChart {...columnChartProps(analysis.byThickness, ACCENTS.thickness)} />
              </ChartCard>
            )}

            {/* (1,5) Dimension preference — orange bars, fills the card */}
            {(analysis?.byDimension?.length > 0) && (
              <ChartCard title={`Dimensions Preference${titleTag}`} aiContext={analysis.byDimension} aiType="Client dimension preference">
                <ScrollRowChart {...rowChartProps(analysis.byDimension, ACCENTS.dimension)} />
              </ChartCard>
            )}
          </div>

          {/* Orders table — non-scrollable horizontally (fixed layout). */}
          <div className="data-table-wrapper" style={{ marginTop: '24px' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Orders {orders ? `(${orders.length})` : ''}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {selectedInvoice
                    ? <>Showing analytics for order <strong>{selectedInvoice}</strong>. Click it again or use “Show all orders”.</>
                    : "Click an order to see just that order's analytics above."}
                </p>
              </div>
              {selectedInvoice && (
                <button
                  onClick={() => setSelectedInvoice(null)}
                  style={{ flexShrink: 0, border: '1px solid var(--border-color)', borderRadius: '8px', background: '#fff', color: 'var(--primary-600)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', padding: '7px 14px', whiteSpace: 'nowrap' }}
                >
                  ✕ Show all orders
                </button>
              )}
            </div>
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {/* `!orders` (not `detailLoading && !orders`) — the orders fetch has its own effect
                  now and doesn't drive `detailLoading`, so key the skeleton off the data itself. */}
              {!orders ? (
                <div style={{ padding: '18px' }}><TableSkeleton /></div>
              ) : (
                <table className="data-table" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    {multi && <col style={{ width: '20%' }} />}
                    <col style={{ width: multi ? '14%' : '20%' }} />{/* Invoice */}
                    <col style={{ width: multi ? '12%' : '14%' }} />{/* Date */}
                    <col style={{ width: multi ? '16%' : '20%' }} />{/* Salesperson */}
                    <col style={{ width: multi ? '10%' : '12%' }} />{/* Qty */}
                    <col style={{ width: multi ? '14%' : '17%' }} />{/* Rev excl */}
                    <col style={{ width: multi ? '14%' : '17%' }} />{/* Rev incl */}
                  </colgroup>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      {multi && <th>Client</th>}
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Salesperson</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th>{th('Revenue (Excl. Taxes)')}</th>
                      <th>{th('Revenue (Incl. Taxes)')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orders || []).map((o) => {
                      const clip = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
                      return (
                        <tr
                          key={o._id}
                          onClick={() => setSelectedInvoice(sel => sel === o._id ? null : o._id)}
                          style={{ cursor: 'pointer', background: selectedInvoice === o._id ? 'var(--primary-50, #eff6ff)' : 'transparent' }}
                        >
                          {multi && <td style={clip} title={o.customerName}>{o.customerName || '—'}</td>}
                          <td style={{ fontWeight: 600, color: selectedInvoice === o._id ? 'var(--primary-600)' : 'inherit', ...clip }}>{o._id}</td>
                          <td>{o.date ? new Date(o.date).toLocaleDateString('en-IN') : '—'}</td>
                          <td style={clip} title={o.salesperson}>{o.salesperson || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(o.qty)}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary-600)', ...clip }}>{formatCurrency(o.revenue)}</td>
                          <td style={{ fontWeight: 600, ...clip }}>{formatCurrency(o.revenueIncl)}</td>
                        </tr>
                      );
                    })}
                    {orders && orders.length === 0 && (
                      <tr><td colSpan={multi ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>No orders for the current filters.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Average selling rate per product (mirrors the Salesperson table). */}
          <div className="data-table-wrapper" style={{ marginTop: '24px' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Average Selling Rate by Product</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Weighted avg. rate (pre-tax) at which this client bought each product</span>
            </div>
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table className="data-table" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '26%' }} />{/* Product */}
                  <col style={{ width: '12%' }} />{/* Qty Sold */}
                  <col style={{ width: '16%' }} />{/* Avg Rate */}
                  <col style={{ width: '16%' }} />{/* Avg Rate / Sq.Ft */}
                  <col style={{ width: '15%' }} />{/* Revenue excl */}
                  <col style={{ width: '15%' }} />{/* Revenue incl */}
                </colgroup>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Qty Sold</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'normal' }}>{th('Avg. Rate (Excl. Taxes)')}</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'normal' }}>{th('Avg. Rate / Sq.Ft (Excl. Taxes)')}</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'normal' }}>{th('Revenue (Excl. Taxes)')}</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'normal' }}>{th('Revenue (Incl. Taxes)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p._id}>{p._id}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(p.totalQty)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.avgRate)}</td>
                      <td style={{ textAlign: 'right' }}>{ratePerFoot(p.avgRate, p.master)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--primary-600)' }}>{formatCurrency(p.totalRevenue)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(p.totalRevenueIncl)}</td>
                    </tr>
                  ))}
                  {rates.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No product data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Clients;
