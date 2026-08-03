import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { FiMapPin, FiX } from 'react-icons/fi';
import ChartCard from '../components/ChartCard';
import FilterBar from '../components/FilterBar';
import NotificationPanel from '../components/NotificationPanel';
import {
  getDashboardSummary,
  getRevenueTrend,
  getTopProducts,
  getTopCustomers,
  getGeographic,
  getMasterBreakdown,
  getGroupBreakdown,
  getFilters,
} from '../services/api';
import { formatINR, formatINRShort, formatShort } from '../utils/numberFormat';
import { ACCENTS, pieColors } from '../utils/chartPalettes';
import { BRANCH_GROUPS, branchLabel } from '../utils/branchConfig';
import { seedFilters, setGlobalFilters, clearGlobalFilters } from '../utils/globalFilters';
import { mergeFilterOptions } from '../utils/filterOptionsCache';
import { KPISkeleton, ChartSkeleton } from '../components/Skeleton';

// The FilterBar filter set (matches the other analytics pages) + a page-local `branch` array.
const EMPTY_FILTERS = {
  startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
  colour: [], thickness: [], format: '', product: '', dimensions: '', group: [], group1: [],
  master: [], company: [], branch: [],
};

const Branch = () => {
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');

  // Company-scoped accounts only get to pick branches within their own company.
  const scopeCompanies = user.scopeType === 'company'
    ? (Array.isArray(user.companies) && user.companies.length ? user.companies : (user.company ? [user.company] : []))
      .map(c => String(c).toUpperCase())
    : null;
  const groups = scopeCompanies
    ? BRANCH_GROUPS.filter(g => scopeCompanies.includes(String(g.company).toUpperCase()))
    : BRANCH_GROUPS;

  const [filters, setFilters] = useState(seedFilters({ ...EMPTY_FILTERS }));
  const [filterOptions, setFilterOptions] = useState({});
  const [metric, setMetric] = useState('revenue');
  const [trendGroupBy, setTrendGroupBy] = useState('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const selectedBranches = filters.branch || [];

  const handleFilterChange = (newFilters, clear = false) => {
    if (clear) {
      clearGlobalFilters();
      setFilters({ ...EMPTY_FILTERS });
    } else {
      setFilters(prev => {
        const next = { ...prev, ...newFilters };
        setGlobalFilters(next); // persist the universal keys across pages (branch stays local)
        return next;
      });
    }
  };

  // ── Branch/company selection helpers ──────────────────────────────────────
  const setBranches = (vals) => handleFilterChange({ branch: vals });
  const toggleBranch = (value) => {
    const set = new Set(selectedBranches);
    set.has(value) ? set.delete(value) : set.add(value);
    setBranches([...set]);
  };
  const companyBranchValues = (g) => g.branches.map(b => b.value);
  const isCompanyFull = (g) => {
    const vals = companyBranchValues(g);
    return vals.length > 0 && vals.every(v => selectedBranches.includes(v));
  };
  const toggleCompany = (g) => {
    const vals = companyBranchValues(g);
    const set = new Set(selectedBranches);
    if (isCompanyFull(g)) vals.forEach(v => set.delete(v));
    else vals.forEach(v => set.add(v));
    setBranches([...set]);
  };
  const clearBranches = () => setBranches([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, trendRes, productsRes, customersRes, geoRes, masterRes, groupRes, filtersRes] = await Promise.all([
        getDashboardSummary(filters),
        getRevenueTrend({ ...filters, groupBy: trendGroupBy }),
        getTopProducts({ ...filters, limit: 10, sortBy: metric === 'revenue' ? 'totalAmount' : 'totalQty' }),
        getTopCustomers({ ...filters, limit: 15, sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty' }),
        getGeographic({ ...filters, groupBy: 'state', sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty' }),
        getMasterBreakdown(filters),
        getGroupBreakdown(filters),
        getFilters(filters),
      ]);
      setData({
        summary: summaryRes.data.data,
        trend: trendRes.data.data || [],
        products: productsRes.data.data || [],
        customers: customersRes.data.data || [],
        geo: geoRes.data.data || [],
        masters: masterRes.data.data || [],
        groups: groupRes.data.data || [],
      });
      setFilterOptions(mergeFilterOptions(filtersRes.data.data));
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

  // Formatting helpers (Indian notation), metric-aware.
  const formatCurrency = (v) => formatINR(v || 0);
  const formatNumber = (v) => new Intl.NumberFormat('en-IN').format(v || 0);
  const axisFmt = (v) => (metric === 'revenue' ? formatINRShort(v) : formatShort(v));
  const metricLabel = metric === 'revenue' ? 'Revenue (Excl. Taxes)' : 'Quantity';
  const titleTag = metric === 'revenue' ? ' (Revenue Excl. Taxes)' : ' (Quantity)';

  const metricScale = { ticks: { callback: (v) => axisFmt(v) } };
  const categoryScale = { ticks: { autoSkip: false, maxRotation: 90, minRotation: 0, font: { size: 11 } } };
  const metricTooltip = {
    callbacks: {
      label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${metric === 'revenue' ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}`,
    },
  };
  const pieTooltip = {
    callbacks: {
      label: (ctx) => {
        const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
        const pct = ((ctx.raw / total) * 100).toFixed(1);
        const val = metric === 'revenue' ? formatCurrency(ctx.raw) : formatNumber(ctx.raw);
        return ` ${ctx.label}: ${val} (${pct}%)`;
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
    datasets: [{ data: data?.masters?.map(dimVal) || [], backgroundColor: pieColors('master', data?.masters?.length || 0), borderWidth: 1, borderColor: '#fff' }],
  };
  const groupData = {
    labels: data?.groups?.map(d => d._id) || [],
    datasets: [{ data: data?.groups?.map(dimVal) || [], backgroundColor: pieColors('pastel', data?.groups?.length || 0), borderWidth: 1, borderColor: '#fff' }],
  };
  const productData = {
    labels: data?.products?.map(d => d._id) || [],
    datasets: [{ label: metricLabel, data: data?.products?.map(dimVal) || [], backgroundColor: ACCENTS.product, borderRadius: 4 }],
  };

  const geoVal = (d) => (metric === 'revenue' ? d.totalRevenue : d.totalQty);
  const geoRows = (data?.geo || []).filter(d => d._id).slice(0, 15);
  const geoData = {
    labels: geoRows.map(d => d._id),
    datasets: [{ label: metricLabel, data: geoRows.map(geoVal), backgroundColor: ACCENTS.zone, borderRadius: 4 }],
  };

  const s = data?.summary;
  const selectionSummary = selectedBranches.length === 0
    ? 'All Branches (combined)'
    : selectedBranches.map(branchLabel).join(', ');

  // A "chip" toggle button used for both company (whole-company) and branch selection.
  const chipStyle = (active) => ({
    padding: '6px 12px', fontSize: '0.82rem', borderRadius: '16px', cursor: 'pointer', fontWeight: 600,
    border: `1px solid ${active ? 'var(--primary-600)' : 'var(--border-color)'}`,
    background: active ? 'var(--primary-600)' : 'var(--bg-card)',
    color: active ? '#fff' : 'var(--text-primary)',
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Branch Analytics</h1>
          <p>Performance by branch. Pick one or more branches, or a whole company.</p>
        </div>
        {user.role === 'admin' && <NotificationPanel />}
      </div>

      {/* Branch / company selection — supports whole-company and multi-branch. */}
      <div className="chart-card" style={{ padding: '18px 22px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-600)', fontWeight: 700 }}>
            <FiMapPin /> Branch Selection
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[['revenue', 'Revenue'], ['quantity', 'Quantity']].map(([m, label]) => (
              <button key={m} onClick={() => setMetric(m)} style={chipStyle(metric === m)}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <button onClick={clearBranches} style={chipStyle(selectedBranches.length === 0)}>All Branches</button>
        </div>

        {groups.map((g) => (
          <div key={g.company} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => toggleCompany(g)} style={{ ...chipStyle(isCompanyFull(g)), borderStyle: 'dashed' }}>
                {g.label} · Whole company
              </button>
              {g.branches.map((b) => (
                <button key={b.value} onClick={() => toggleBranch(b.value)} style={chipStyle(selectedBranches.includes(b.value))}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing: <strong style={{ color: 'var(--text-primary)' }}>{selectionSummary}</strong>
          {selectedBranches.length > 0 && (
            <button onClick={clearBranches} style={{ marginLeft: '10px', background: 'transparent', border: 'none', color: 'var(--primary-600)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <FiX size={13} /> clear
            </button>
          )}
        </div>
      </div>

      {/* The full standard filter stack (same as every other section). */}
      <FilterBar filters={filters} options={filterOptions} onFilterChange={handleFilterChange} />

      {loading || !data ? (
        <>
          <KPISkeleton />
          <ChartSkeleton />
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
            <ChartCard
              title={`Revenue Trend${titleTag}`}
              fullWidth
              aiContext={data.trend}
              aiType="Branch Revenue Trend"
              extra={
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[['day', 'Day'], ['month', 'Month'], ['quarter', 'Quarter']].map(([gb, label]) => (
                    <button
                      key={gb}
                      onClick={() => setTrendGroupBy(gb)}
                      style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: trendGroupBy === gb ? 'var(--primary-600)' : 'var(--bg-card)', color: trendGroupBy === gb ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              <Line
                data={trendData}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: metric === 'revenue' }, tooltip: metricTooltip }, scales: { y: metricScale } }}
              />
            </ChartCard>

            <ChartCard title={`Master-wise${titleTag}`} aiContext={data.masters} aiType="Branch Master Distribution">
              <Pie data={masterData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: pieTooltip, percentBar: false } }} />
            </ChartCard>

            <ChartCard title={`Category-wise${titleTag}`} aiContext={data.groups} aiType="Branch Category Distribution">
              <Pie data={groupData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: pieTooltip, percentBar: false } }} />
            </ChartCard>

            <ChartCard title={`Top Products${titleTag}`} aiContext={data.products} aiType="Branch Top Products">
              <Bar
                data={productData}
                options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: metricTooltip }, scales: { x: metricScale } }}
              />
            </ChartCard>

            <ChartCard title={`By State${titleTag}`} aiContext={data.geo} aiType="Branch Geographic Breakdown">
              <Bar
                data={geoData}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: metricTooltip }, scales: { x: categoryScale, y: metricScale } }}
              />
            </ChartCard>
          </div>

          <div className="chart-card" style={{ padding: '24px', marginTop: '8px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 0 }}>Top Customers</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
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
        </>
      )}
    </div>
  );
};

export default Branch;
