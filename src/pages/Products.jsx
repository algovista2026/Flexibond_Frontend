import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';
import { FiBox, FiLayers, FiGrid, FiDroplet, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import FilterBar from '../components/FilterBar';
import AIInsightButton from '../components/AIInsightButton';
import ExportControls from '../components/ExportControls';
import GlobalSearch from '../components/GlobalSearch';
import NotificationPanel from '../components/NotificationPanel';
import {
  getTopProducts,
  getCategoryBreakdown,
  getColourAnalysis,
  getSizeAnalysis,
  getFilters,
  getGradeBreakdown,
  getGroupBreakdown,
  getZoneAnalysis
} from '../services/api';

import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';
import { formatINRShort, formatShort } from '../utils/numberFormat';

const Products = () => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('revenue');
  const [sortOrder, setSortOrder] = useState(-1); // -1 for Top, 1 for Bottom
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], group: [],
    format: '', product: '', thickness: '', dimensions: '', group1: [], master: []
  });
  const [filterOptions, setFilterOptions] = useState({});
  const [data, setData] = useState({
    products: null,
    categories: null,
    colours: null,
    thickness: null,
    dimensions: null,
    zones: null,
    grades: null,
    groups: null
  });
  // Drill-down pie: which group is expanded, and its per-product distribution.
  const [drillGroup, setDrillGroup] = useState(null);
  const [drillData, setDrillData] = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const sortBy = metric === 'revenue' ? 'totalAmount' : 'totalQty';
      const [productsRes, catRes, colourRes, sizeRes, zoneRes, gradeRes, groupRes, filtersRes] = await Promise.all([
        getTopProducts({ ...filters, limit: 15, sortBy, sortOrder }),
        getCategoryBreakdown({ ...filters, sortBy }),
        getColourAnalysis({ ...filters, limit: 15, sortBy }),
        getSizeAnalysis({ ...filters, sortBy }),
        getZoneAnalysis(filters),
        getGradeBreakdown(filters),
        getGroupBreakdown(filters),
        getFilters()
      ]);

      setData({
        products: productsRes.data.data,
        categories: catRes.data.data,
        colours: colourRes.data.data,
        thickness: sizeRes.data.data.thickness,
        dimensions: sizeRes.data.data.dimensions,
        zones: zoneRes.data.data?.zones || [],
        grades: gradeRes.data.data || [],
        groups: groupRes.data.data || []
      });
      // Any filter/metric change invalidates the open drill-down.
      setDrillGroup(null);
      setDrillData(null);
      setFilterOptions(filtersRes.data.data);
    } catch (error) {
      console.error('Error fetching product data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Pick up filters from navigation state (Global Search redirection)
    if (location.state?.filters) {
      setFilters(prev => ({ ...prev, ...location.state.filters }));
      // Clear state so it doesn't re-apply on every render
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => { fetchData(); }, [filters, metric, sortOrder]);

  const handleFilterChange = (newFilters, clear = false) => {
    if (clear) {
      setFilters({
        startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], group: [],
        format: '', product: '', thickness: '', dimensions: '', group1: [], master: []
      });
    } else {
      setFilters(prev => ({ ...prev, ...newFilters }));
    }
  };

  // Drill into a group slice → fetch that group's per-product distribution for the 2nd pie.
  const handleGroupDrill = async (group) => {
    if (!group) return;
    if (group === drillGroup) { setDrillGroup(null); setDrillData(null); return; } // toggle off
    setDrillGroup(group);
    setDrillLoading(true);
    try {
      const res = await getGroupBreakdown({ ...filters, drillGroup: group });
      setDrillData(res.data.data || []);
    } catch (error) {
      console.error('Error fetching group drill-down:', error);
      setDrillData([]);
    } finally {
      setDrillLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val || 0);
  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Quantity';
  const axisFmt = (v) => metric === 'revenue' ? formatINRShort(v) : formatShort(v);
  const valScale = { ticks: { callback: v => axisFmt(v) } };
  const metricTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${metric === 'revenue' ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}` } };

  // KPI summaries
  const totalProducts = data.products?.length || 0;
  const totalCategories = data.categories?.length || 0;
  const totalColours = data.colours?.length || 0;
  const topProduct = data.products?.[0] || null;

  // Chart data
  const productsChartData = {
    labels: data.products?.map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.products?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: 'var(--primary-400)',
      borderRadius: 4
    }]
  };

  const catChartData = {
    labels: data.categories?.map(d => d._id || 'Unknown') || [],
    datasets: [{
      label: metricLabel,
      data: data.categories?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: [
        '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe',
        '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe',
        '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'
      ],
      borderWidth: 0
    }]
  };

  const coloursChartData = {
    labels: data.colours?.map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.colours?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: '#10b981',
      borderRadius: 4
    }]
  };

  const zoneChartData = {
    labels: data.zones?.map(z => z._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.zones?.map(z => metric === 'revenue' ? z.totalRevenue : z.totalQty) || [],
      backgroundColor: '#0ea5e9',
      borderRadius: 4
    }]
  };

  const GRADE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const gradeChartData = {
    labels: data.grades?.map(g => g._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.grades?.map(g => metric === 'revenue' ? g.totalAmount : g.totalQty) || [],
      backgroundColor: (data.grades || []).map((_, i) => GRADE_COLORS[i % GRADE_COLORS.length]),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  // Group distribution pie (FB / FM / FN / Base …) — click a slice to drill down.
  const GROUP_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
  const groupChartData = {
    labels: data.groups?.map(g => g._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.groups?.map(g => metric === 'revenue' ? g.totalAmount : g.totalQty) || [],
      backgroundColor: (data.groups || []).map((_, i) => GROUP_COLORS[i % GROUP_COLORS.length]),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };
  const groupDrillChartData = {
    labels: drillData?.map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: drillData?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: (drillData || []).map((_, i) => GROUP_COLORS[i % GROUP_COLORS.length]),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };
  const piePctTooltip = {
    callbacks: {
      label: (ctx) => {
        const val = ctx.raw || 0;
        const total = ctx.dataset.data.reduce((a, b, i) => a + (ctx.chart.getDataVisibility(i) ? b : 0), 0);
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
        return ` ${ctx.label}: ${metric === 'revenue' ? formatCurrency(val) : formatNumber(val)} (${pct}%)`;
      }
    }
  };

  const thicknessChartData = {
    labels: data.thickness?.map(d => d.label) || [],
    datasets: [{
      label: metricLabel,
      data: data.thickness?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: '#8b5cf6',
      borderRadius: 4
    }]
  };

  const dimensionsChartData = {
    labels: data.dimensions?.map(d => d.label) || [],
    datasets: [{
      label: metricLabel,
      data: data.dimensions?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: '#ec4899',
      borderRadius: 4
    }]
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Product Analytics</h1>
          <p>Detailed breakdown of products, categories, colours, and dimensions</p>
        </div>
        <div className="page-controls">
          <GlobalSearch onSearchSelect={(res) => setFilters(prev => ({ ...prev, ...res }))} />
          <ExportControls pageTitle="Product_Analytics" />
          {user.role === 'admin' && <NotificationPanel />}

          <div className="metric-toggle">
            <button onClick={() => setMetric('revenue')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: metric === 'revenue' ? '#fff' : 'transparent', boxShadow: metric === 'revenue' ? 'var(--shadow-sm)' : 'none', fontWeight: 600, cursor: 'pointer', color: metric === 'revenue' ? 'var(--primary-600)' : 'var(--text-secondary)' }}>Revenue</button>
            <button onClick={() => setMetric('qty')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: metric === 'qty' ? '#fff' : 'transparent', boxShadow: metric === 'qty' ? 'var(--shadow-sm)' : 'none', fontWeight: 600, cursor: 'pointer', color: metric === 'qty' ? 'var(--primary-600)' : 'var(--text-secondary)' }}>Quantity</button>
          </div>
        </div>
      </div>

      <FilterBar filters={filters} options={filterOptions} onFilterChange={handleFilterChange} showGroup />

      {data.products && (
        <div style={{ marginBottom: '24px' }}>
          <AIInsightButton 
            contextData={{ totalProducts, totalCategories, totalColours, topProduct: topProduct?._id, sortOrder: sortOrder === -1 ? 'Top' : 'Bottom' }} 
            contextType="Products Dashboard Overview" 
            title={`Generate AI ${sortOrder === -1 ? 'Top' : 'Bottom'} Products Summary`} 
            isBanner={true} 
          />
        </div>
      )}

      {loading && !data.products ? (
        <KPISkeleton />
      ) : (
        <div className="kpi-grid">
          <KPICard title={sortOrder === -1 ? "Top Product" : "Bottom Product"} value={topProduct ? topProduct._id.substring(0, 20) : 'N/A'} icon={<FiBox />} color="blue" />
          <KPICard title="Unique Products" value={formatNumber(totalProducts)} icon={<FiGrid />} color="green" />
          <KPICard title="Categories" value={formatNumber(totalCategories)} icon={<FiLayers />} color="orange" />
          <KPICard title="Colour Variants" value={formatNumber(totalColours)} icon={<FiDroplet />} color="red" />
        </div>
      )}

      <div className="charts-grid">
        {loading && !data.products ? (
          <ChartSkeleton fullWidth />
        ) : (
          <ChartCard 
            title={`${sortOrder === -1 ? 'Top' : 'Bottom'} Products (${metricLabel})`} 
            aiContext={data.products} 
            aiType={`${sortOrder === -1 ? 'Top' : 'Bottom'} Products`} 
            fullWidth
            extra={
              <button 
                onClick={() => setSortOrder(sortOrder === -1 ? 1 : -1)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: '#fff',
                  color: sortOrder === -1 ? 'var(--primary-600)' : '#f59e0b',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {sortOrder === -1 ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
                {sortOrder === -1 ? 'Top 15' : 'Bottom 15'}
              </button>
            }
          >
            <Bar
              data={productsChartData}
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
        )}

        {loading && !data.categories ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={filters.category ? `Products in ${filters.category}` : "Category Breakdown"} aiContext={data.categories} aiType="Product Categories">
            <div className="donut-container">
              <div style={{ flex: '1', minWidth: 0, height: '100%' }}>
                <Doughnut
                  data={catChartData}
                  options={{
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return ` ${label}: ${metric === 'revenue' ? formatCurrency(value) : formatNumber(value)} (${percentage}%)`;
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
              <div className="custom-legend">
                {(data.categories || []).map((cat, i) => {
                  const val = metric === 'revenue' ? cat.totalAmount : cat.totalQty;
                  const total = (data.categories || []).reduce((acc, c) => acc + (metric === 'revenue' ? c.totalAmount : c.totalQty), 0);
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  const colors = [
                    '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe',
                    '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe',
                    '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'
                  ];
                  const color = colors[i % colors.length];
                  return (
                    <div key={i} className="legend-item">
                      <div className="legend-label">
                        <div className="legend-dot" style={{ background: color }} />
                        <span>{cat._id || 'Unknown'}</span>
                      </div>
                      <span className="legend-percentage">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        )}

        {loading && !data.colours ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`Colour Breakdown (${metricLabel})`} aiContext={data.colours} aiType="Color Variants Breakdown">
            <Bar
              data={coloursChartData}
              options={{
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false }, tooltip: metricTooltip },
                scales: { x: { ticks: { callback: v => axisFmt(v) } } }
              }}
            />
          </ChartCard>
        )}

        {loading && !data.zones ? (
          <ChartSkeleton />
        ) : (data.zones && data.zones.length > 0) ? (
          <ChartCard title={`${metricLabel} by Zone`} aiContext={data.zones} aiType="Zone-wise Revenue">
            <Bar
              data={zoneChartData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: metricTooltip },
                scales: { y: valScale }
              }}
            />
          </ChartCard>
        ) : null}

        {loading && !data.grades ? (
          <ChartSkeleton />
        ) : (data.grades && data.grades.length > 0) ? (
          <ChartCard title={`Grade-wise ${metricLabel} Distribution`} aiContext={data.grades} aiType="Grade-wise Revenue Distribution">
            <Pie
              data={gradeChartData}
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
                        return ` ${ctx.label}: ${metric === 'revenue' ? formatCurrency(val) : formatNumber(val)} (${pct}%)`;
                      }
                    }
                  }
                }
              }}
            />
          </ChartCard>
        ) : null}

        {loading && !data.groups ? (
          <ChartSkeleton />
        ) : (data.groups && data.groups.length > 0) ? (
          <div style={{ gridColumn: drillGroup ? '1 / -1' : 'auto', display: 'grid', gridTemplateColumns: drillGroup ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: '20px' }}>
            <ChartCard
              title={`Group-wise ${metricLabel} Distribution`}
              aiContext={data.groups}
              aiType="Group-wise Distribution"
              extra={<span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Click a slice to drill in</span>}
            >
              <Pie
                data={groupChartData}
                options={{
                  maintainAspectRatio: false,
                  onClick: (_evt, elements) => {
                    if (elements && elements.length > 0) {
                      handleGroupDrill(data.groups[elements[0].index]?._id);
                    }
                  },
                  onHover: (evt, elements) => {
                    evt.native.target.style.cursor = elements && elements.length ? 'pointer' : 'default';
                  },
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
                    tooltip: piePctTooltip
                  }
                }}
              />
            </ChartCard>

            {drillGroup && (
              drillLoading ? (
                <ChartSkeleton />
              ) : (
                <ChartCard
                  title={`${drillGroup} — Product Distribution`}
                  aiContext={drillData}
                  aiType={`Products within group ${drillGroup}`}
                  extra={
                    <button
                      onClick={() => { setDrillGroup(null); setDrillData(null); }}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      ✕ Close
                    </button>
                  }
                >
                  {(drillData && drillData.length > 0) ? (
                    <Pie
                      data={groupDrillChartData}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } },
                          tooltip: piePctTooltip
                        }
                      }}
                    />
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>No products in this group.</p>
                  )}
                </ChartCard>
              )
            )}
          </div>
        ) : null}

        {loading && !data.thickness ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`Thickness Preference (${metricLabel})`} aiContext={data.thickness} aiType="Thickness Analysis">
            <Bar
              data={thicknessChartData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: metricTooltip },
                scales: { y: valScale }
              }}
            />
          </ChartCard>
        )}

        {loading && !data.dimensions ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`Dimensions Preference (${metricLabel})`} aiContext={data.dimensions} aiType="Size Dimensions Preference">
            <Bar
              data={dimensionsChartData}
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
        )}

        {loading && !data.products ? (
          <TableSkeleton />
        ) : (
          <div className="data-table-wrapper" style={{ gridColumn: '1 / -1' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>All Products</h3>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Revenue</th>
                    <th>Avg Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products?.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{p._id}</td>
                      <td>{p.categoryCode || '—'}</td>
                      <td>{formatNumber(p.totalQty)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{formatCurrency(p.totalAmount)}</td>
                      <td>{formatCurrency(p.avgRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
