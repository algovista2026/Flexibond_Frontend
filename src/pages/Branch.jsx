import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { FiMapPin, FiEdit2, FiX } from 'react-icons/fi';
import ChartCard from '../components/ChartCard';
import FilterBar from '../components/FilterBar';
import NotificationPanel from '../components/NotificationPanel';
import ScrollColumnChart from '../components/ScrollColumnChart';
import TargetAmountInput, { TURNOVER_TARGET_PRESETS } from '../components/TargetAmountInput';
import {
  getDashboardSummary,
  getRevenueTrend,
  getTopProducts,
  getTopCustomers,
  getMasterBreakdown,
  getGroupBreakdown,
  getCategoryBreakdown,
  getGradeBreakdown,
  getZoneAnalysis,
  getSizeAnalysis,
  getColourAnalysis,
  getSalespersonList,
  getFilters,
  getBranchPerformance,
  setBranchTarget,
} from '../services/api';
import { formatINR, formatINRShort, formatShort } from '../utils/numberFormat';
import { PALETTES, ACCENTS, pieColors } from '../utils/chartPalettes';
import { ALL_BRANCHES, branchLabel, branchAccent } from '../utils/branchConfig';
import { seedFilters, setGlobalFilters, clearGlobalFilters } from '../utils/globalFilters';
import { mergeFilterOptions } from '../utils/filterOptionsCache';
import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';

const EMPTY_FILTERS = {
  startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
  colour: [], thickness: [], format: '', product: '', dimensions: '', group: [], group1: [],
  master: [], company: [], branch: [],
};

const Branch = () => {
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const isAdmin = user.role === 'admin';

  // Company-scoped accounts only see branches within their own company.
  const scopeCompanies = user.scopeType === 'company'
    ? (Array.isArray(user.companies) && user.companies.length ? user.companies : (user.company ? [user.company] : []))
      .map(c => String(c).toUpperCase())
    : null;
  const knownBranches = scopeCompanies
    ? ALL_BRANCHES.filter(b => scopeCompanies.includes(String(b.company).toUpperCase()))
    : ALL_BRANCHES;

  const [filters, setFilters] = useState(seedFilters({ ...EMPTY_FILTERS }));
  const [filterOptions, setFilterOptions] = useState({});
  const [metric, setMetric] = useState('revenue');
  const [trendGroupBy, setTrendGroupBy] = useState('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [perf, setPerf] = useState({ fiscalYear: '', map: {} }); // branch -> { revenue, target }
  const [tableSearch, setTableSearch] = useState('');

  // Target editing (admin).
  const [targetModal, setTargetModal] = useState(null);
  const [targetForm, setTargetForm] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);

  const selectedBranches = filters.branch || [];

  const handleFilterChange = (newFilters, clear = false) => {
    if (clear) {
      clearGlobalFilters();
      setFilters({ ...EMPTY_FILTERS });
    } else {
      setFilters(prev => {
        const next = { ...prev, ...newFilters };
        setGlobalFilters(next);
        return next;
      });
    }
  };

  const toggleBranch = (value) => {
    const set = new Set(selectedBranches);
    set.has(value) ? set.delete(value) : set.add(value);
    handleFilterChange({ branch: [...set] });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const sortBy = metric === 'revenue' ? 'totalAmount' : 'totalQty';
      const spSort = metric === 'revenue' ? 'totalRevenue' : 'totalQty';
      const [
        summaryRes, trendRes, masterRes, productsRes, allProductsRes, spRes, catRes,
        gradeRes, groupRes, zoneRes, sizeRes, colourRes, customersRes, filtersRes, perfRes
      ] = await Promise.all([
        getDashboardSummary(filters),
        getRevenueTrend({ ...filters, groupBy: trendGroupBy }),
        getMasterBreakdown(filters),
        getTopProducts({ ...filters, limit: 10, sortBy }),
        getTopProducts({ ...filters, limit: 'all', sortBy }),
        getSalespersonList({ ...filters, sortBy: spSort }),
        getCategoryBreakdown({ ...filters, sortBy }),
        getGradeBreakdown(filters),
        getGroupBreakdown(filters),
        getZoneAnalysis(filters),
        getSizeAnalysis({ ...filters, sortBy }),
        getColourAnalysis({ ...filters, limit: 15, sortBy }),
        getTopCustomers({ ...filters, limit: 20, sortBy: spSort }),
        getFilters(filters),
        getBranchPerformance(filters),
      ]);
      setData({
        summary: summaryRes.data.data,
        trend: trendRes.data.data || [],
        masters: masterRes.data.data || [],
        products: productsRes.data.data || [],
        allProducts: allProductsRes.data.data || [],
        salespersons: spRes.data.data || [],
        categories: catRes.data.data || [],
        grades: gradeRes.data.data || [],
        groups: groupRes.data.data || [],
        zones: zoneRes.data.data?.zones || [],
        thickness: sizeRes.data.data?.thickness || [],
        dimensions: sizeRes.data.data?.dimensions || [],
        colours: colourRes.data.data || [],
        customers: customersRes.data.data || [],
      });
      setFilterOptions(mergeFilterOptions(filtersRes.data.data));
      const pd = perfRes.data.data || { fiscalYear: '', rows: [] };
      const map = {};
      (pd.rows || []).forEach(r => { map[r.branch] = r; });
      setPerf({ fiscalYear: pd.fiscalYear, map });
    } catch (err) {
      console.error('Branch analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, metric, trendGroupBy]);

  // ── Target modal ─────────────────────────────────────────────────────────
  const openTargetModal = (branch) => {
    const cur = perf.map[branch]?.target;
    setTargetForm(cur ? String(cur) : '');
    setTargetModal({ branch });
  };
  const saveTarget = async () => {
    if (!targetModal) return;
    const amt = Number(targetForm);
    if (!Number.isFinite(amt) || amt < 0) return;
    try {
      setTargetSaving(true);
      await setBranchTarget({ branch: targetModal.branch, amount: amt, mode: 'yearly' });
      setTargetModal(null);
      await fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to save target');
    } finally {
      setTargetSaving(false);
    }
  };

  // Formatting helpers.
  const formatCurrency = (v) => formatINR(v || 0);
  const formatNumber = (v) => new Intl.NumberFormat('en-IN').format(v || 0);
  const axisFmt = (v) => (metric === 'revenue' ? formatINRShort(v) : formatShort(v));
  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Quantity';
  const titleTag = metric === 'revenue' ? ' (Revenue Excl. Taxes)' : ' (Quantity)';
  const valScale = { ticks: { callback: (v) => axisFmt(v) } };
  const metricTooltip = {
    callbacks: {
      label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${metric === 'revenue' ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}`,
    },
  };
  const piePctTooltip = {
    callbacks: {
      label: (ctx) => {
        const val = ctx.raw || 0;
        const total = ctx.dataset.data.reduce((a, b, i) => a + (ctx.chart.getDataVisibility(i) ? b : 0), 0);
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
        return ` ${ctx.label}: ${metric === 'revenue' ? formatCurrency(val) : formatNumber(val)} (${pct}%)`;
      },
    },
  };

  // ── Chart configs ──────────────────────────────────────────────────────────
  const trendData = {
    labels: data?.trend?.map(d => d._id) || [],
    datasets: metric === 'revenue'
      ? [
          { label: 'Excl. Taxes', data: data?.trend?.map(d => d.revenueExcl) || [], borderColor: 'var(--primary-500)', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 2, fill: true, tension: 0.4 },
          { label: 'Incl. Taxes', data: data?.trend?.map(d => d.revenue) || [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 2, fill: false, tension: 0.4, borderDash: [6, 4] },
        ]
      : [{ label: 'Quantity', data: data?.trend?.map(d => d.qty) || [], borderColor: 'var(--primary-500)', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 2, fill: true, tension: 0.4 }],
  };

  const dimVal = (d) => (metric === 'revenue' ? d.totalAmount : d.totalQty);
  const masterData = {
    labels: data?.masters?.map(d => d._id) || [],
    datasets: [{ data: data?.masters?.map(dimVal) || [], backgroundColor: pieColors('master', data?.masters?.length || 0), borderWidth: 2, borderColor: '#fff' }],
  };
  const productData = {
    labels: data?.products?.map(d => d._id) || [],
    // Match the Products page's Top Products bars exactly (same 'var(--primary-400)' fill).
    datasets: [{ label: metricLabel, data: data?.products?.map(dimVal) || [], backgroundColor: 'var(--primary-400)', borderRadius: 4 }],
  };
  const spRows = (data?.salespersons || []).slice(0, 15);
  const salesmanData = {
    labels: spRows.map(s => s._id),
    datasets: [{ label: metricLabel, data: spRows.map(s => metric === 'revenue' ? s.totalRevenue : s.totalQty), backgroundColor: '#6366f1', borderRadius: 4 }],
  };
  const subCatData = {
    labels: data?.categories?.map(d => d._id || 'Unknown') || [],
    datasets: [{ label: metricLabel, data: data?.categories?.map(dimVal) || [], backgroundColor: pieColors('subcategory', data?.categories?.length || 0), borderWidth: 0 }],
  };
  const gradeData = {
    labels: data?.grades?.map(d => d._id) || [],
    datasets: [{ label: metricLabel, data: data?.grades?.map(dimVal) || [], backgroundColor: pieColors('pastelAlt', data?.grades?.length || 0), borderWidth: 2, borderColor: '#fff' }],
  };
  const groupData = {
    labels: data?.groups?.map(d => d._id) || [],
    datasets: [{ label: metricLabel, data: data?.groups?.map(dimVal) || [], backgroundColor: pieColors('pastel', data?.groups?.length || 0), borderWidth: 2, borderColor: '#fff' }],
  };
  const zoneData = {
    labels: data?.zones?.map(z => z._id) || [],
    datasets: [{ label: metricLabel, data: data?.zones?.map(z => metric === 'revenue' ? z.totalRevenue : z.totalQty) || [], backgroundColor: ACCENTS.zone, borderRadius: 4 }],
  };
  const colourData = {
    labels: data?.colours?.map(d => d._id) || [],
    datasets: [{ label: metricLabel, data: data?.colours?.map(dimVal) || [], backgroundColor: ACCENTS.colour, borderRadius: 4 }],
  };
  const dimensionData = {
    labels: data?.dimensions?.map(d => d.label) || [],
    datasets: [{ label: metricLabel, data: data?.dimensions?.map(dimVal) || [], backgroundColor: ACCENTS.dimension, borderRadius: 4 }],
  };

  const s = data?.summary;

  // Branch cards ordered by revenue (highest first); company-accent colours.
  const orderedBranches = [...knownBranches].sort(
    (a, b) => (perf.map[b.value]?.revenue || 0) - (perf.map[a.value]?.revenue || 0)
  );

  // Full products table (all filtered products) with a client-side search.
  const tableProducts = (data?.allProducts || []).filter(p =>
    !tableSearch.trim() ||
    String(p._id).toLowerCase().includes(tableSearch.trim().toLowerCase()) ||
    String(p.category || '').toLowerCase().includes(tableSearch.trim().toLowerCase())
  );

  const clip = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Branch Analytics</h1>
          <p>An extensive dashboard for each branch. Pick one or more branches; each shows its own target.</p>
        </div>
        {isAdmin && <NotificationPanel />}
      </div>

      {/* Full standard filter stack (Branch is chosen via the strip below → dropdown hidden here). */}
      <FilterBar filters={filters} options={filterOptions} onFilterChange={handleFilterChange} hideBranch />

      {/* Branch selection strip — horizontal cards (like the Salesperson leaderboard), ordered by
          revenue, tinted with each branch's company accent, each with its target + achieved + bar. */}
      <div className="sp-leaderboard-strip">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <h3 className="sp-strip-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiMapPin /> Branches {perf.fiscalYear ? <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.82rem' }}>· Target FY {perf.fiscalYear}</span> : null}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedBranches.length > 0 && (
              <button onClick={() => handleFilterChange({ branch: [] })} style={{ background: 'transparent', border: 'none', color: 'var(--primary-600)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <FiX size={13} /> All branches
              </button>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[['revenue', 'Revenue'], ['qty', 'Quantity']].map(([m, label]) => (
                <button key={m} onClick={() => setMetric(m)} style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: metric === m ? 'var(--primary-600)' : 'var(--bg-card)', color: metric === m ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="sp-strip-cards">
          {orderedBranches.map((b) => {
            const row = perf.map[b.value] || { revenue: 0, target: 0 };
            const target = row.target || 0;
            const achieved = row.revenue || 0;
            const pct = target > 0 ? Math.min((achieved / target) * 100, 100) : 0;
            const active = selectedBranches.includes(b.value);
            const accent = branchAccent(b.value);
            return (
              <div
                key={b.value}
                className="sp-card branch-card"
                onClick={() => toggleBranch(b.value)}
                style={{ borderTop: `4px solid ${accent}`, boxShadow: active ? `0 0 0 2px ${accent}` : undefined, borderColor: active ? accent : undefined }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                  <div className="sp-name" style={{ margin: 0 }}>{b.label}</div>
                  {isAdmin && (
                    <button title="Set target" onClick={(e) => { e.stopPropagation(); openTargetModal(b.value); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                      <FiEdit2 size={14} />
                    </button>
                  )}
                </div>
                <div className="sp-stat-label">Achieved</div>
                <div className="sp-stat-value" style={{ color: accent, marginBottom: '6px' }}>{formatCurrency(achieved)}</div>
                <div className="sp-stat-label">Target</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: target > 0 ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: '8px' }}>
                  {target > 0 ? formatCurrency(target) : 'Not set'}
                </div>
                <div style={{ height: '8px', background: 'var(--bg-light, #eef2f7)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: accent, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {target > 0 ? `${Math.round((achieved / target) * 100)}% of target` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading || !data ? (
        <>
          <KPISkeleton />
          <ChartSkeleton fullWidth />
        </>
      ) : (
        <>
          {/* KPI cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Total Revenue (Excl. Taxes)</div>
              <div className="kpi-value">{formatCurrency(s?.totalRevenueExclTax)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Revenue (Incl. Taxes)</div>
              <div className="kpi-value">{formatCurrency(s?.totalRevenue)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Quantity Sold</div>
              <div className="kpi-value">{formatNumber(s?.totalQty)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Unique Customers</div>
              <div className="kpi-value">{formatNumber(s?.uniqueCustomers)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Top State</div>
              <div className="kpi-value" style={{ fontSize: '1.3rem' }}>{s?.topState || 'N/A'}</div>
              <div className="kpi-sub">{formatCurrency(s?.topStateRevenue)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Top Zone</div>
              <div className="kpi-value" style={{ fontSize: '1.3rem' }}>{s?.topZone || 'N/A'}</div>
              <div className="kpi-sub">{formatCurrency(s?.topZoneRevenue)}</div>
            </div>
          </div>

          <div className="charts-grid">
            {/* (Row 1, full width) Revenue Trend */}
            <ChartCard
              title={`Revenue Trend${titleTag}`}
              fullWidth
              aiContext={data.trend}
              aiType="Branch Revenue Trend"
              extra={
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[['day', 'Day'], ['month', 'Month'], ['quarter', 'Quarter']].map(([gb, label]) => (
                    <button key={gb} onClick={() => setTrendGroupBy(gb)} style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: trendGroupBy === gb ? 'var(--primary-600)' : 'var(--bg-card)', color: trendGroupBy === gb ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>{label}</button>
                  ))}
                </div>
              }
            >
              <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: metric === 'revenue' }, tooltip: metricTooltip }, scales: { y: valScale } }} />
            </ChartCard>

            {/* Master-wise */}
            <ChartCard title={`Master-wise${titleTag}`} aiContext={data.masters} aiType="Branch Master Distribution">
              <Pie data={masterData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: piePctTooltip, percentBar: false } }} />
            </ChartCard>

            {/* Top Products (half width) */}
            <ChartCard title={`Top Products${titleTag}`} aiContext={data.products} aiType="Branch Top Products">
              <Bar data={productData} options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: metricTooltip }, scales: { x: valScale, y: { ticks: { font: { size: 10 }, callback: function (v) { const l = this.getLabelForValue(v); return l && l.length > 18 ? l.slice(0, 16) + '…' : l; } } } } }} />
            </ChartCard>

            {/* Salesman-wise revenue */}
            <ChartCard title={`Salesperson${titleTag}`} aiContext={data.salespersons} aiType="Branch Salesperson Revenue">
              <Bar data={salesmanData} options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: metricTooltip }, scales: { x: valScale, y: { ticks: { font: { size: 10 }, autoSkip: false } } } }} />
            </ChartCard>

            {/* Sub-Category (blue doughnut) */}
            {(data.categories && data.categories.length > 0) && (
              <ChartCard title={`Sub-Category-wise${titleTag}`} aiContext={data.categories} aiType="Branch Sub-Category Distribution">
                <Doughnut data={subCatData} options={{ maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } }, tooltip: piePctTooltip, percentBar: false } }} />
              </ChartCard>
            )}

            {/* Grade-wise */}
            {(data.grades && data.grades.length > 0) && (
              <ChartCard title={`Grade-wise${titleTag}`} aiContext={data.grades} aiType="Branch Grade Distribution">
                <Doughnut data={gradeData} options={{ maintainAspectRatio: false, cutout: '35%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } }, tooltip: piePctTooltip, percentBar: false } }} />
              </ChartCard>
            )}

            {/* Category-wise (group) */}
            {(data.groups && data.groups.length > 0) && (
              <ChartCard title={`Category-wise${titleTag}`} aiContext={data.groups} aiType="Branch Category Distribution">
                <Pie data={groupData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } }, tooltip: piePctTooltip, percentBar: false } }} />
              </ChartCard>
            )}

            {/* By Zone */}
            {(data.zones && data.zones.length > 0) && (
              <ChartCard title={`By Zone${titleTag}`} aiContext={data.zones} aiType="Branch Zone-wise Revenue">
                <Bar data={zoneData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: metricTooltip }, scales: { y: valScale } }} />
              </ChartCard>
            )}

            {/* Thickness / Section — column chart with frozen y-axis */}
            {(data.thickness && data.thickness.length > 0) && (
              <ChartCard title={`Thickness/Section${titleTag}`} aiContext={data.thickness} aiType="Branch Thickness Analysis">
                <ScrollColumnChart
                  labels={data.thickness.map(d => d.label)}
                  values={data.thickness.map(dimVal)}
                  label={metricLabel}
                  color="#8b5cf6"
                  yFmt={axisFmt}
                  valueFmt={(v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(v)}
                />
              </ChartCard>
            )}

            {/* Colour */}
            {(data.colours && data.colours.length > 0) && (
              <ChartCard title={`Colour${titleTag}`} aiContext={data.colours} aiType="Branch Colour Breakdown">
                <Bar data={colourData} options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: metricTooltip }, scales: { x: valScale } }} />
              </ChartCard>
            )}

            {/* Dimensions — vertical scroll */}
            {(data.dimensions && data.dimensions.length > 0) && (
              <ChartCard title={`Dimensions${titleTag}`} aiContext={data.dimensions} aiType="Branch Dimensions Preference">
                <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                  <div style={{ width: '100%', height: `${Math.max(data.dimensions.length * 34, 260)}px` }}>
                    <Bar data={dimensionData} options={{ maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: metricTooltip }, scales: { x: valScale, y: { ticks: { autoSkip: false, font: { size: 10 } } } } }} />
                  </div>
                </div>
              </ChartCard>
            )}
          </div>

          {/* Table 1 — Top Customers (scrollable, ~10 rows). */}
          <div className="chart-card" style={{ padding: '24px', marginTop: '8px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 0 }}>Top Customers</h3>
            <div style={{ maxHeight: '440px', overflowY: 'auto', overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Customer</th>
                    <th style={{ textAlign: 'left' }}>City</th>
                    <th style={{ textAlign: 'left' }}>State</th>
                    <th style={{ textAlign: 'left' }}>Zone</th>
                    <th style={{ textAlign: 'right' }}>Orders</th>
                    <th style={{ textAlign: 'right' }}>Rev (Excl.)</th>
                    <th style={{ textAlign: 'right' }}>Rev (Incl.)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No customer data for this selection.</td></tr>
                  ) : (
                    data.customers.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{c._id}</td>
                        <td>{c.city || '—'}</td>
                        <td>{c.state || '—'}</td>
                        <td>{c.zone || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(c.totalOrders)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(c.totalRevenue)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(c.totalRevenueIncl)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2 — All Products (like the Products page), scrollable ~10 rows. */}
          <div className="data-table-wrapper" style={{ marginTop: '20px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                All Products {data.allProducts ? `(${tableProducts.length}${tableSearch.trim() ? ` of ${data.allProducts.length}` : ''})` : ''}
              </h3>
              <input type="text" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Search products…" style={{ height: '38px', minWidth: '220px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }} />
            </div>
            <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
              <table className="data-table" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '26%' }} /><col style={{ width: '12%' }} /><col style={{ width: '14%' }} />
                  <col style={{ width: '10%' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} />
                </colgroup>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Product Name</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Category</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Sub-Category</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Quantity</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Avg. Rate (Excl. Taxes)</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Revenue (Excl. Taxes)</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Revenue (Incl. Taxes)</th>
                  </tr>
                </thead>
                <tbody>
                  {tableProducts.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500, ...clip }} title={p._id}>{p._id}</td>
                      <td style={clip} title={p.group || '—'}>{p.group || '—'}</td>
                      <td style={clip} title={p.category || '—'}>{p.category || '—'}</td>
                      <td>{formatNumber(p.totalQty)}</td>
                      <td>{formatCurrency(p.avgRate)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary-600)', ...clip }}>{formatCurrency(p.totalAmount)}</td>
                      <td style={{ fontWeight: 600, ...clip }}>{formatCurrency(p.totalAmountIncl)}</td>
                    </tr>
                  ))}
                  {tableProducts.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                      {tableSearch.trim() ? 'No products match your search.' : 'No products for the current selection.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Admin branch-target modal */}
      {targetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setTargetModal(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Set Target · {branchLabel(targetModal.branch)}</h3>
              <button onClick={() => setTargetModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><FiX size={18} /></button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0 }}>Annual target for FY {perf.fiscalYear} (revenue excl. taxes).</p>
            <TargetAmountInput value={targetForm} onChange={setTargetForm} presets={TURNOVER_TARGET_PRESETS} label="Annual target (₹)" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setTargetModal(null)} className="btn-secondary" style={{ padding: '9px 16px' }}>Cancel</button>
              <button onClick={saveTarget} disabled={targetSaving} className="btn-primary" style={{ padding: '9px 16px' }}>{targetSaving ? 'Saving…' : 'Save Target'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Branch;
