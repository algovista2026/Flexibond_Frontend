import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import { getSalespersonList, getSalespersonPerformance, getFilters, setSalespersonTarget } from '../services/api';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import ChartCard from '../components/ChartCard';
import { FiUsers, FiTarget, FiEdit2 } from 'react-icons/fi';
import AIInsightButton from '../components/AIInsightButton';
import ExportControls from '../components/ExportControls';
import GlobalSearch from '../components/GlobalSearch';
import NotificationPanel from '../components/NotificationPanel';
import { averageLinePlugin } from '../utils/averageLinePlugin';
import { targetLinePlugin } from '../utils/targetLinePlugin';

import { KPISkeleton, ChartSkeleton, TableSkeleton, Skeleton } from '../components/Skeleton';
import { formatINRShort, formatShort, formatCount } from '../utils/numberFormat';

const SalespersonListSkeleton = () => (
  <div className="sp-list-scroll-area">
    {[1, 2, 3, 4, 5, 6].map(i => (
      <div key={i} style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
        <Skeleton style={{ height: '24px', width: '60%', marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <Skeleton style={{ height: '16px', width: '40%' }} />
          <Skeleton style={{ height: '16px', width: '30%' }} />
        </div>
      </div>
    ))}
  </div>
);

const Salesperson = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const [list, setList] = useState([]);
  const [selectedSP, setSelectedSP] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [metric, setMetric] = useState('revenue');
  const [trendGroupBy, setTrendGroupBy] = useState('day');
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', category: [], state: [], grade: [], zone: [], colour: [], format: '',
    product: '', thickness: [], dimensions: '', city: ''
  });
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetForm, setTargetForm] = useState({ amount: '', mode: 'monthly' });
  const [targetSaving, setTargetSaving] = useState(false);
  const [filterOptions, setFilterOptions] = useState({});

  useEffect(() => {
    fetchList();
    fetchOptions();
  }, [metric, filters]);

  useEffect(() => {
    if (selectedSP) {
      handleSelectSP(selectedSP);
    }
  }, [trendGroupBy, filters]);

  const fetchOptions = async () => {
    try {
      const res = await getFilters();
      setFilterOptions(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await getSalespersonList({ 
        ...filters,
        sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty' 
      });
      setList(res.data.data);
      if (res.data.data.length > 0 && !selectedSP) {
        handleSelectSP(res.data.data[0]._id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSP = async (name) => {
    try {
      setSelectedSP(name);
      setDetailsLoading(true);
      const res = await getSalespersonPerformance(name, { 
        ...filters,
        sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty',
        groupBy: trendGroupBy 
      });
      setDetails(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  const axisFmt = (v) => metric === 'revenue' ? formatINRShort(v) : formatShort(v);
  const metricScaleY = { ticks: { callback: v => axisFmt(v) } };
  const metricTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${metric === 'revenue' ? formatCurrency(ctx.raw) : formatCount(ctx.raw) + ' units'}` } };

  const isAdmin = user.role === 'admin';
  const target = details?.target || null;

  // Per-period target value for the trend target line (revenue metric only). The stored
  // figure is a monthly target; scale it to the current trend grouping.
  const targetLineValue = () => {
    if (!target || metric !== 'revenue') return null;
    const m = target.monthlyTarget;
    switch (trendGroupBy) {
      case 'month': return m;
      case 'quarter': return m * 3;
      case 'halfyear': return m * 6;
      case 'day': return m / 30; // approximate daily target
      default: return m;
    }
  };

  const openTargetModal = () => {
    setTargetForm({ amount: target ? String(target.amount) : '', mode: target ? target.mode : 'monthly' });
    setShowTargetModal(true);
  };

  const saveTarget = async () => {
    const amt = Number(targetForm.amount);
    if (!isFinite(amt) || amt < 0) return;
    try {
      setTargetSaving(true);
      await setSalespersonTarget({ salesperson: selectedSP, mode: targetForm.mode, amount: amt });
      setShowTargetModal(false);
      await handleSelectSP(selectedSP); // refresh target + charts
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to save target');
    } finally {
      setTargetSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Salesperson Analytics</h1>
          <p>Analyze performance, top customers, and product focus across the sales team.</p>
        </div>
        <div className="page-controls">
          <GlobalSearch onSearchSelect={(res) => {
            setFilters(prev => ({ ...prev, ...res }));
            if (res.salesperson) {
              setSelectedSP(res.salesperson);
            }
          }} />
          <ExportControls pageTitle="Salesperson_Performance" />
          {user.role === 'admin' && <NotificationPanel />}

          <div className="metric-toggle">
            <button 
              onClick={() => setMetric('revenue')} 
              style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: metric === 'revenue' ? '#fff' : 'transparent', boxShadow: metric === 'revenue' ? 'var(--shadow-sm)' : 'none', fontWeight: 600, cursor: 'pointer', color: metric === 'revenue' ? 'var(--primary-600)' : 'var(--text-secondary)' }}>
              Revenue
            </button>
            <button 
              onClick={() => setMetric('qty')} 
              style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: metric === 'qty' ? '#fff' : 'transparent', boxShadow: metric === 'qty' ? 'var(--shadow-sm)' : 'none', fontWeight: 600, cursor: 'pointer', color: metric === 'qty' ? 'var(--primary-600)' : 'var(--text-secondary)' }}>
              Quantity
            </button>
          </div>
        </div>
      </div>

      <FilterBar 
        filters={filters} 
        options={filterOptions} 
        onFilterChange={(newFilters, clear) => {
          if (clear) {
            setFilters({
              startDate: '', endDate: '', category: [], state: [], grade: [], zone: [], colour: [], format: '',
              product: '', thickness: [], dimensions: '', city: ''
            });
          } else {
            setFilters(prev => ({ ...prev, ...newFilters }));
          }
        }} 
        hideSalesperson={true}
      />

      <div className="salesperson-layout">
        {/* Left Sidebar - List */}
        <div className="salesperson-list-container">
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-light)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Leaderboard</h3>
          </div>
          {loading ? (
            <SalespersonListSkeleton />
          ) : (
            <div className="sp-list-scroll-area">
              {list.map((sp, idx) => (
                <div 
                  key={sp._id} 
                  className={`sp-card ${selectedSP === sp._id ? 'active' : ''}`}
                  onClick={() => handleSelectSP(sp._id)}
                  style={{ marginBottom: '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <div className={`rank-badge ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'default'}`}>
                      {idx + 1}
                    </div>
                    <div className="sp-name" style={{ margin: 0, flex: 1 }}>{sp._id}</div>
                  </div>
                  <div className="sp-stats">
                    <div>
                      <div className="sp-stat-label">Revenue</div>
                      <div className="sp-stat-value" style={{ color: 'var(--primary-600)' }}>{formatCurrency(sp.totalRevenue)}</div>
                    </div>
                    <div>
                      <div className="sp-stat-label">Orders</div>
                      <div className="sp-stat-value">{sp.totalOrders}</div>
                    </div>
                  </div>
                </div>
              ))}
              {list.length === 0 && (
                <div className="no-data">
                  <FiUsers className="no-data-icon" />
                  <p>No salespersons found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Content - Details */}
        <div className="salesperson-details-container">
          {detailsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <Skeleton style={{ height: '60px', width: '100%' }} />
              <KPISkeleton />
              <ChartSkeleton fullWidth />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
            </div>
          ) : details ? (
            <>
              {/* Top Stats */}
              <div style={{ marginBottom: '24px' }}>
                <AIInsightButton
                  contextData={{ salesperson: selectedSP, stats: details.stats }}
                  contextType={`Salesperson ${selectedSP} Performance Overview`}
                  title={`Generate AI Insights for ${selectedSP}`}
                  isBanner={true}
                />
              </div>

              {/* Target Achievement Tracker */}
              <div style={{ marginBottom: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-50, #eff6ff)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiTarget size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Sales Target{target ? ` (FY ${target.fiscalYear})` : ''}
                    </div>
                    {target ? (
                      <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        <span style={{ fontWeight: 700 }}>{formatCurrency(target.monthlyTarget)}</span>
                        <span style={{ color: 'var(--text-muted)' }}> /month · Annual {formatCurrency(target.annualTarget)} · {target.mode}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No target set for this salesperson</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  {target && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Achieved (current view)</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-600)' }}>
                        {formatCurrency(details.stats.totalRevenue)}
                        <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
                          ({target.annualTarget > 0 ? Math.round((details.stats.totalRevenue / target.annualTarget) * 100) : 0}% of annual)
                        </span>
                      </div>
                    </div>
                  )}
                  {isAdmin && (
                    <button
                      onClick={openTargetModal}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      <FiEdit2 size={14} /> {target ? 'Edit Target' : 'Set Target'}
                    </button>
                  )}
                </div>
              </div>

              {showTargetModal && (
                <div
                  onClick={() => setShowTargetModal(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: 'var(--shadow-md, 0 10px 30px rgba(0,0,0,0.2))' }}
                  >
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px' }}>Set Target — {selectedSP}</h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
                      Applies to the current fiscal year (April–March). Yearly targets are divided by 12 for the monthly target line.
                    </p>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      {['monthly', 'yearly'].map(m => (
                        <button
                          key={m}
                          onClick={() => setTargetForm(f => ({ ...f, mode: m }))}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: targetForm.mode === m ? 'var(--primary-600)' : 'var(--bg-light, #fff)', color: targetForm.mode === m ? '#fff' : 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {targetForm.mode === 'yearly' ? 'Annual target (₹)' : 'Monthly target (₹)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={targetForm.amount}
                      onChange={(e) => setTargetForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="e.g. 500000"
                      autoFocus
                      style={{ width: '100%', padding: '10px 12px', margin: '6px 0 20px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        onClick={() => setShowTargetModal(false)}
                        style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveTarget}
                        disabled={targetSaving || targetForm.amount === ''}
                        style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--primary-600)', color: '#fff', cursor: targetSaving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (targetSaving || targetForm.amount === '') ? 0.6 : 1 }}
                      >
                        {targetSaving ? 'Saving…' : 'Save Target'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-label">Total Revenue</div>
                  <div className="kpi-value">{formatCurrency(details.stats.totalRevenue)}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Orders</div>
                  <div className="kpi-value">{details.stats.totalOrders}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Customers</div>
                  <div className="kpi-value">{details.stats.uniqueCustomers}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Avg Order</div>
                  <div className="kpi-value">{formatCurrency(details.stats.avgOrderValue)}</div>
                </div>
              </div>

              {/* Charts */}
              <div className="charts-grid">
                {/* Revenue Trend Chart */}
                <ChartCard 
                  title={`${metric === 'revenue' ? 'Revenue' : 'Quantity'} Trend`} 
                  aiContext={details.revenueTrend}
                  aiType={`Performance Trend for ${selectedSP}`}
                  fullWidth 
                  extra={
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[
                        { k: 'day', label: 'Days' },
                        { k: 'month', label: 'Months' },
                        { k: 'quarter', label: 'Quarterly' },
                        { k: 'halfyear', label: 'Half-Yearly' }
                      ].map(({ k, label }) => (
                        <button
                          key={k}
                          onClick={() => setTrendGroupBy(k)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: trendGroupBy === k ? 'var(--primary-600)' : 'var(--bg-card)',
                            color: trendGroupBy === k ? '#fff' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <Line
                    data={{
                      labels: details.revenueTrend.map(d => d._id),
                      datasets: [{
                        label: metric === 'revenue' ? 'Revenue' : 'Quantity',
                        data: details.revenueTrend.map(d => metric === 'revenue' ? d.revenue : d.qty),
                        borderColor: 'var(--primary-500)',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                      }]
                    }}
                    plugins={[averageLinePlugin, targetLinePlugin]}
                    options={{
                      maintainAspectRatio: false,
                      plugins: {
                        averageLine: { formatter: (v) => metric === 'revenue' ? formatCurrency(v) : `${Math.round(v)}` },
                        targetLine: targetLineValue() ? { value: targetLineValue(), label: 'Target', formatter: (v) => formatCurrency(v) } : false,
                        tooltip: metricTooltip
                      },
                      scales: { y: metricScaleY }
                    }}
                  />
                </ChartCard>

                <ChartCard title="Top Products Sold" aiContext={details.topProducts} aiType={`Products Sold by ${selectedSP}`}>
                  <Bar 
                    data={{
                      labels: details.topProducts.map(p => p._id),
                      datasets: [{
                        label: metric === 'revenue' ? 'Revenue' : 'Quantity',
                        data: details.topProducts.map(p => metric === 'revenue' ? p.totalAmount : p.totalQty),
                        backgroundColor: 'var(--primary-500)',
                      }]
                    }}
                    options={{ 
                      maintainAspectRatio: false,
                      indexAxis: 'y',
                      plugins: { legend: { display: false }, tooltip: metricTooltip },
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

                <ChartCard title={filters.category ? `Products in ${filters.category}` : "Category Breakdown"} aiContext={details.categoryBreakdown} aiType={`Category Performance for ${selectedSP}`}>
                  <div className="donut-container">
                    <div style={{ flex: '1', minWidth: 0, height: '100%' }}>
                      <Doughnut 
                        data={{
                          labels: details.categoryBreakdown.map(c => c._id),
                          datasets: [{
                            label: metric === 'revenue' ? 'Revenue' : 'Quantity',
                            data: details.categoryBreakdown.map(c => metric === 'revenue' ? c.totalAmount : c.totalQty),
                            backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'],
                            borderWidth: 0,
                            cutout: '70%'
                          }]
                        }}
                        options={{ 
                          maintainAspectRatio: false, 
                          plugins: { 
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (ctx) => {
                                  const val = ctx.raw;
                                  return metric === 'revenue' ? formatCurrency(val) : `${val} units`;
                                }
                              }
                            }
                          } 
                        }}
                      />
                    </div>
                    <div className="custom-legend">
                      {details.categoryBreakdown.map((item, idx) => {
                        const total = details.categoryBreakdown.reduce((sum, c) => sum + (metric === 'revenue' ? c.totalAmount : c.totalQty), 0);
                        const percentage = ((metric === 'revenue' ? item.totalAmount : item.totalQty) / total * 100).toFixed(1);
                        const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
                        return (
                          <div key={idx} className="legend-item">
                            <div className="legend-label">
                              <div className="legend-dot" style={{ backgroundColor: colors[idx % colors.length] }} />
                              <span>{item._id}</span>
                            </div>
                            <span className="legend-percentage">{percentage}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </ChartCard>

                <ChartCard title="City Breakdown" aiContext={details.cityBreakdown} aiType={`Sales Breakdown by City for ${selectedSP}`}>
                  <Doughnut 
                    data={{
                      labels: details.cityBreakdown.map(c => c._id),
                      datasets: [{
                        label: metric === 'revenue' ? 'Revenue' : 'Quantity',
                        data: details.cityBreakdown.map(c => metric === 'revenue' ? c.totalRevenue : c.totalQty),
                        backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
                        borderWidth: 0
                      }]
                    }}
                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                  />
                </ChartCard>

                {details.zoneBreakdown && details.zoneBreakdown.length > 0 && (
                  <ChartCard title={`${metric === 'revenue' ? 'Revenue' : 'Quantity'} by Zone`} aiContext={details.zoneBreakdown} aiType={`Zone-wise sales for ${selectedSP}`}>
                    <Bar
                      data={{
                        labels: details.zoneBreakdown.map(z => z._id),
                        datasets: [{
                          label: metric === 'revenue' ? 'Revenue' : 'Quantity',
                          data: details.zoneBreakdown.map(z => metric === 'revenue' ? z.totalRevenue : z.totalQty),
                          backgroundColor: '#8b5cf6',
                          borderRadius: 4
                        }]
                      }}
                      plugins={[averageLinePlugin]}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          averageLine: { formatter: (v) => metric === 'revenue' ? formatCurrency(v) : `${Math.round(v)}` },
                          tooltip: metricTooltip
                        },
                        scales: { y: metricScaleY }
                      }}
                    />
                  </ChartCard>
                )}

                {details.gradeBreakdown && details.gradeBreakdown.length > 0 && (
                  <ChartCard title={`Grade-wise ${metric === 'revenue' ? 'Revenue' : 'Quantity'}`} aiContext={details.gradeBreakdown} aiType={`Grade split for ${selectedSP}`}>
                    <Pie
                      data={{
                        labels: details.gradeBreakdown.map(g => g._id),
                        datasets: [{
                          label: metric === 'revenue' ? 'Revenue' : 'Quantity',
                          data: details.gradeBreakdown.map(g => metric === 'revenue' ? g.totalAmount : g.totalQty),
                          backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
                          borderWidth: 2,
                          borderColor: '#fff'
                        }]
                      }}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
                          tooltip: {
                            callbacks: {
                              label: (ctx) => {
                                const val = ctx.raw || 0;
                                const total = ctx.dataset.data.reduce((a, b, i) => a + (ctx.chart.getDataVisibility(i) ? b : 0), 0);
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                return ` ${ctx.label}: ${metric === 'revenue' ? formatCurrency(val) : `${val} units`} (${pct}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </ChartCard>
                )}
              </div>

              {/* Top Customers Table */}
              <div className="data-table-wrapper" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Top Customers for {details.salesperson}</h3>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>City</th>
                      <th>Orders</th>
                      <th>Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.topCustomers.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{c._id}</td>
                        <td>{c.city}</td>
                        <td>{c.totalOrders}</td>
                        <td style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{formatCurrency(c.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Average selling rate per product for this salesperson */}
              <div className="data-table-wrapper" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Average Selling Rate by Product</h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Weighted avg. rate (pre-tax) at which {details.salesperson} sold each product
                  </span>
                </div>
                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                      <tr>
                        <th>Product</th>
                        <th style={{ textAlign: 'right' }}>Qty Sold</th>
                        <th style={{ textAlign: 'right' }}>Avg. Rate</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(details.productRates || []).map((p, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{p._id}</td>
                          <td style={{ textAlign: 'right' }}>{formatCount(p.totalQty)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.avgRate)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--primary-600)' }}>{formatCurrency(p.totalRevenue)}</td>
                        </tr>
                      ))}
                      {(!details.productRates || details.productRates.length === 0) && (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No product data available</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="no-data" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <FiUsers className="no-data-icon" />
              <h3>Select a Salesperson</h3>
              <p>Click on a salesperson from the list to view detailed analytics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Salesperson;
