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
import ScrollColumnChart from '../components/ScrollColumnChart';
import ScrollRowChart from '../components/ScrollRowChart';
import {
  getTopProducts,
  getCategoryBreakdown,
  getColourAnalysis,
  getSizeAnalysis,
  getFilters,
  getGradeBreakdown,
  getGroupBreakdown,
  getZoneAnalysis,
  getMasterBreakdown
} from '../services/api';

import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';
import { formatINRShort, formatShort, ratePerFoot } from '../utils/numberFormat';
import { seedFilters, setGlobalFilters, clearGlobalFilters } from '../utils/globalFilters';
import { mergeFilterOptions } from '../utils/filterOptionsCache';
import { PALETTES, ACCENTS, pieColors } from '../utils/chartPalettes';
import { th } from '../utils/thHeader';

const Products = () => {
  const location = useLocation();
  const user = JSON.parse(sessionStorage.getItem('flexibond_user') || '{}');
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('revenue');
  const [sortOrder, setSortOrder] = useState(-1); // -1 for Top, 1 for Bottom
  const [filters, setFilters] = useState(seedFilters({
    startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], group: [],
    format: '', product: '', thickness: [], dimensions: '', group1: [], master: [], company: [], branch: [],
    colour: [], batch: []
  }));
  const [filterOptions, setFilterOptions] = useState({});
  const [data, setData] = useState({
    products: null,
    allProducts: null,
    categories: null,
    colours: null,
    thickness: null,
    dimensions: null,
    zones: null,
    grades: null,
    groups: null,
    masters: null
  });
  // Search box for the full "All Products" table (client-side filter over allProducts).
  const [tableSearch, setTableSearch] = useState('');
  // Drill-down pie: which group is expanded, and its per-product distribution.
  const [drillGroup, setDrillGroup] = useState(null);
  const [drillData, setDrillData] = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);
  // Colour → Category drill-down: which colour is expanded + its per-category distribution.
  const [drillColour, setDrillColour] = useState(null);
  const [colourDrillData, setColourDrillData] = useState(null);
  const [colourDrillLoading, setColourDrillLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const sortBy = metric === 'revenue' ? 'totalAmount' : 'totalQty';
      const [productsRes, allProductsRes, catRes, colourRes, sizeRes, zoneRes, gradeRes, groupRes, masterRes, filtersRes] = await Promise.all([
        getTopProducts({ ...filters, limit: 15, sortBy, sortOrder }),
        getTopProducts({ ...filters, limit: 'all', sortBy, sortOrder }),
        getCategoryBreakdown({ ...filters, sortBy }),
        getColourAnalysis({ ...filters, limit: 15, sortBy }),
        getSizeAnalysis({ ...filters, sortBy }),
        getZoneAnalysis(filters),
        getGradeBreakdown(filters),
        getGroupBreakdown(filters),
        getMasterBreakdown(filters),
        getFilters(filters)
      ]);

      setData({
        products: productsRes.data.data,
        allProducts: allProductsRes.data.data,
        categories: catRes.data.data,
        colours: colourRes.data.data,
        thickness: sizeRes.data.data.thickness,
        dimensions: sizeRes.data.data.dimensions,
        zones: zoneRes.data.data?.zones || [],
        grades: gradeRes.data.data || [],
        groups: groupRes.data.data || [],
        masters: masterRes.data.data || []
      });
      // Any filter/metric change invalidates the open drill-downs.
      setDrillGroup(null);
      setDrillData(null);
      setDrillColour(null);
      setColourDrillData(null);
      setFilterOptions(mergeFilterOptions(filtersRes.data.data));
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
      const reset = {
        startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], group: [],
        format: '', product: '', thickness: [], dimensions: '', group1: [], master: [], company: [], branch: [],
        colour: [], batch: []
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

  // Drill into a colour bar → fetch the Category (group) distribution WITHIN that colour by
  // adding the colour to the filter set and reusing the group-breakdown aggregation.
  const handleColourDrill = async (colour) => {
    if (colour == null || colour === '') return;
    if (colour === drillColour) { setDrillColour(null); setColourDrillData(null); return; } // toggle off
    setDrillColour(colour);
    setColourDrillLoading(true);
    try {
      const res = await getGroupBreakdown({ ...filters, colour: [colour] });
      setColourDrillData(res.data.data || []);
    } catch (error) {
      console.error('Error fetching colour drill-down:', error);
      setColourDrillData([]);
    } finally {
      setColourDrillLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val || 0);
  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Quantity';
  // Single-bracket title suffix (Title Case brackets, client request 2026-07-27).
  const titleTag = metric === 'revenue' ? ' (Revenue Excl. Taxes)' : ' (Quantity)';
  const axisFmt = (v) => metric === 'revenue' ? formatINRShort(v) : formatShort(v);
  const valScale = { ticks: { callback: v => axisFmt(v) } };
  const metricTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${metric === 'revenue' ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}` } };

  // KPI summaries — unique-product count reflects the full filtered set, not just the top 15.
  const totalProducts = data.allProducts?.length ?? (data.products?.length || 0);
  const totalCategories = data.categories?.length || 0;
  const totalColours = data.colours?.length || 0;
  const topProduct = data.products?.[0] || null;
  // Total Quantity Sold — sum of qty across the full filtered product set (TotQty).
  const totalQtySold = (data.allProducts || []).reduce((s, p) => s + (p.totalQty || 0), 0);
  // Total revenue (excl. taxes) across the full filtered product set — same source as the table's
  // Revenue (Excl. Taxes) column, so the KPI and the table always agree.
  const totalRevenueExcl = (data.allProducts || []).reduce((s, p) => s + (p.totalAmount || 0), 0);
  // Top-product name can be very long — scale the KPI value font to fit on one/two lines.
  const topProductName = topProduct ? String(topProduct._id) : 'N/A';
  const topProductFont = topProductName.length > 34 ? '0.82rem'
    : topProductName.length > 24 ? '1rem'
    : topProductName.length > 16 ? '1.2rem' : '1.5rem';

  // Full products table (all filtered products) with a client-side search.
  const tableProducts = (data.allProducts || []).filter(p =>
    !tableSearch.trim() ||
    String(p._id).toLowerCase().includes(tableSearch.trim().toLowerCase()) ||
    String(p.category || '').toLowerCase().includes(tableSearch.trim().toLowerCase())
  );

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

  // Master-wise pie (ACP / PVC-WPC / SOFFIT …) — the headline product classification.
  const masterChartData = {
    labels: data.masters?.map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.masters?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: pieColors('master', (data.masters || []).length),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  // Sub-Category doughnut — BLUE palette (reserved for sub-categories, client favourite).
  const catChartData = {
    labels: data.categories?.map(d => d._id || 'Unknown') || [],
    datasets: [{
      label: metricLabel,
      data: data.categories?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: pieColors('subcategory', (data.categories || []).length),
      borderWidth: 0
    }]
  };

  const coloursChartData = {
    labels: data.colours?.map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.colours?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: ACCENTS.colour,
      borderRadius: 4
    }]
  };

  const zoneChartData = {
    labels: data.zones?.map(z => z._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.zones?.map(z => metric === 'revenue' ? z.totalRevenue : z.totalQty) || [],
      backgroundColor: ACCENTS.zone,
      borderRadius: 4
    }]
  };

  const gradeChartData = {
    labels: data.grades?.map(g => g._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.grades?.map(g => metric === 'revenue' ? g.totalAmount : g.totalQty) || [],
      backgroundColor: pieColors('pastelAlt', (data.grades || []).length),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  // Category distribution pie (FB / FM / FN / Base …, field `group`) — muted palette (trial). Drill in.
  const groupChartData = {
    labels: data.groups?.map(g => g._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.groups?.map(g => metric === 'revenue' ? g.totalAmount : g.totalQty) || [],
      backgroundColor: pieColors('pastel', (data.groups || []).length),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };
  const groupDrillChartData = {
    labels: drillData?.map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: drillData?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: pieColors('pastel', (drillData || []).length),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };
  // Colour drill-down: Category (group) distribution within the selected colour — matches the
  // Category-wise Distribution pie's palette (`pastel`) instead of the old grey shades.
  const colourDrillChartData = {
    labels: colourDrillData?.map(d => d._id || '—') || [],
    datasets: [{
      label: metricLabel,
      data: colourDrillData?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: pieColors('pastel', (colourDrillData || []).length),
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
      backgroundColor: ACCENTS.dimension,
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

      <FilterBar showBatch filters={filters} options={filterOptions} onFilterChange={handleFilterChange} showGroup />

      {data.products && (
        <div style={{ marginBottom: '24px' }}>
          <AIInsightButton 
            contextData={{ totalProducts, totalCategories, totalColours, totalRevenueExcl, topProduct: topProduct?._id, sortOrder: sortOrder === -1 ? 'Top' : 'Bottom' }}
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
          {/* Top Product — font scales to the (sometimes very long) product name, full name on hover. */}
          <div className="kpi-card">
            <div className="kpi-label">{sortOrder === -1 ? 'Top Product' : 'Bottom Product'}</div>
            <div className="kpi-value" style={{ fontSize: topProductFont, lineHeight: 1.2, wordBreak: 'break-word' }} title={topProductName}>{topProductName}</div>
          </div>
          <KPICard title="Unique Products" value={formatNumber(totalProducts)} />
          <KPICard title="Total Quantity Sold" value={formatNumber(totalQtySold)} subtext="TotQty across filtered products" />
          <KPICard title="Sub-Categories" value={formatNumber(totalCategories)} />
          <KPICard title="Revenue (Excl. Taxes)" value={formatCurrency(totalRevenueExcl)} subtext="Across filtered products" />
        </div>
      )}

      <div className="charts-grid">
        {loading && !data.products ? (
          <ChartSkeleton fullWidth />
        ) : (
          <ChartCard 
            title={`${sortOrder === -1 ? 'Top' : 'Bottom'} Products${titleTag}`}
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

        {/* (1,2) Master-wise pie — headline product classification. Added 2026-08-03; the rest of
            the grid shifts down one cell so it starts below Top Products. */}
        {loading && !data.masters ? (
          <ChartSkeleton />
        ) : (data.masters && data.masters.length > 0) ? (
          <ChartCard title={`Master-wise${titleTag}`} aiContext={data.masters} aiType="Master-wise Distribution">
            <Pie
              data={masterChartData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
                  tooltip: piePctTooltip,
                  percentBar: false
                }
              }}
            />
          </ChartCard>
        ) : null}

        {/* (2,2) Sub-Category doughnut — BLUE palette (reserved). Enlarged, scrollable legend
            with full name on hover so long sub-category names aren't cut off. */}
        {loading && !data.categories ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`${filters.category?.length ? `Sub-categories in ${filters.category.join(', ')}` : "Sub-categories in"}${titleTag}`} aiContext={data.categories} aiType="Product Sub-Categories">
            <div className="donut-container">
              <div style={{ flex: '1 1 55%', minWidth: 0, height: '100%' }}>
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
              <div className="custom-legend" style={{ flex: '0 0 42%', maxHeight: '100%', overflowY: 'auto', paddingRight: '6px' }}>
                {(data.categories || []).map((cat, i) => {
                  const val = metric === 'revenue' ? cat.totalAmount : cat.totalQty;
                  const total = (data.categories || []).reduce((acc, c) => acc + (metric === 'revenue' ? c.totalAmount : c.totalQty), 0);
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  const color = PALETTES.subcategory[i % PALETTES.subcategory.length];
                  return (
                    <div key={i} className="legend-item" title={cat._id || 'Unknown'}>
                      <div className="legend-label">
                        <div className="legend-dot" style={{ background: color }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat._id || 'Unknown'}</span>
                      </div>
                      <span className="legend-percentage">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        )}

        {/* (2,2) Grade-wise pie */}
        {loading && !data.grades ? (
          <ChartSkeleton />
        ) : (data.grades && data.grades.length > 0) ? (
          <ChartCard title={`Grade-wise Distribution${titleTag}`} aiContext={data.grades} aiType="Grade-wise Revenue Distribution">
            <Doughnut
              data={gradeChartData}
              options={{
                maintainAspectRatio: false,
                cutout: '35%',
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

        {/* (1,3) Category (group) drill-down pie — emerald palette. */}
        {loading && !data.groups ? (
          <ChartSkeleton />
        ) : (data.groups && data.groups.length > 0) ? (
          <div style={{ gridColumn: drillGroup ? '1 / -1' : 'auto', display: 'grid', gridTemplateColumns: drillGroup ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: '20px' }}>
            <ChartCard
              title={`Category-wise Distribution${titleTag}`}
              aiContext={data.groups}
              aiType="Category-wise Distribution"
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
                  title={`${drillGroup} — Product Distribution${titleTag}`}
                  aiContext={drillData}
                  aiType={`Products within category ${drillGroup}`}
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
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>No products in this category.</p>
                  )}
                </ChartCard>
              )
            )}
          </div>
        ) : null}

        {/* (2,3) By Zone */}
        {loading && !data.zones ? (
          <ChartSkeleton />
        ) : (data.zones && data.zones.length > 0) ? (
          <ChartCard title={`By Zone${titleTag}`} aiContext={data.zones} aiType="Zone-wise Revenue">
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

        {/* (1,4) Thickness Preference — purple bars (reserved), horizontal scroll. */}
        {loading && !data.thickness ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`Thickness/Section${titleTag}`} aiContext={data.thickness} aiType="Thickness Analysis">
            {/* Horizontally scrollable with a FROZEN y-axis so bars stay readable when scrolled. */}
            <ScrollColumnChart
              labels={data.thickness?.map(d => d.label) || []}
              values={data.thickness?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || []}
              label={metricLabel}
              color="#8b5cf6"
              yFmt={axisFmt}
              valueFmt={(v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(v)}
            />
          </ChartCard>
        )}

        {/* (2,4) Colour Breakdown — teal bars. Click a colour to drill into its Category mix. */}
        {loading && !data.colours ? (
          <ChartSkeleton />
        ) : (
          <div style={{ gridColumn: drillColour ? '1 / -1' : 'auto', display: 'grid', gridTemplateColumns: drillColour ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: '20px' }}>
            <ChartCard
              title={`Colour Breakdown${titleTag}`}
              aiContext={data.colours}
              aiType="Colour Breakdown"
              extra={<span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Click a bar to drill in</span>}
            >
              <Bar
                data={coloursChartData}
                options={{
                  maintainAspectRatio: false,
                  indexAxis: 'y',
                  onClick: (_evt, elements) => {
                    if (elements && elements.length > 0) {
                      handleColourDrill(data.colours[elements[0].index]?._id);
                    }
                  },
                  onHover: (evt, elements) => {
                    evt.native.target.style.cursor = elements && elements.length ? 'pointer' : 'default';
                  },
                  plugins: { legend: { display: false }, tooltip: metricTooltip },
                  scales: { x: { ticks: { callback: v => axisFmt(v) } } }
                }}
              />
            </ChartCard>

            {drillColour && (
              colourDrillLoading ? (
                <ChartSkeleton />
              ) : (
                <ChartCard
                  title={`Colour ${drillColour} — Category-wise${titleTag}`}
                  aiContext={colourDrillData}
                  aiType={`Categories within colour ${drillColour}`}
                  extra={
                    <button
                      onClick={() => { setDrillColour(null); setColourDrillData(null); }}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      ✕ Close
                    </button>
                  }
                >
                  {(colourDrillData && colourDrillData.length > 0) ? (
                    <Pie
                      data={colourDrillChartData}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } },
                          tooltip: piePctTooltip
                        }
                      }}
                    />
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>No categories for this colour.</p>
                  )}
                </ChartCard>
              )
            )}
          </div>
        )}

        {/* (1,5) Dimensions Preference — orange bars, vertical scroll. */}
        {loading && !data.dimensions ? (
          <ChartSkeleton />
        ) : (data.dimensions && data.dimensions.length > 0) ? (
          <ChartCard title={`Dimensions Preference${titleTag}`} aiContext={data.dimensions} aiType="Size Dimensions Preference">
            {/* Vertically scrollable — many dimension rows crowd the y-axis. Absolute-fill the
                card body and give each row a fixed height so the content reliably overflows. */}
            <ScrollRowChart
              labels={data.dimensions.map(d => d.label)}
              values={data.dimensions.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty)}
              label={metricLabel}
              color={ACCENTS.dimension}
              valueFmt={(v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(v)}
              xFmt={axisFmt}
              barHeight={34}
            />
          </ChartCard>
        ) : null}

        {loading && !data.allProducts ? (
          <TableSkeleton />
        ) : (
          <div className="data-table-wrapper" style={{ gridColumn: '1 / -1' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                All Products {data.allProducts ? `(${tableProducts.length}${tableSearch.trim() ? ` of ${data.allProducts.length}` : ''})` : ''}
              </h3>
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search products…"
                style={{ height: '38px', minWidth: '220px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
              />
            </div>
            <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
              {/* Fixed layout + colgroup so the extra Category / dual-revenue columns fit without
                  a horizontal scrollbar; headers wrap (taller header row), long names ellipsise. */}
              <table className="data-table" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '20%' }} />{/* Product Name */}
                  <col style={{ width: '11%' }} />{/* Category */}
                  <col style={{ width: '13%' }} />{/* Sub-Category */}
                  <col style={{ width: '8%' }} />{/* Quantity */}
                  <col style={{ width: '12%' }} />{/* Avg Rate */}
                  <col style={{ width: '12%' }} />{/* Avg Rate / Sq.Ft */}
                  <col style={{ width: '12%' }} />{/* Revenue excl */}
                  <col style={{ width: '12%' }} />{/* Revenue incl */}
                </colgroup>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Product Name</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Category</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Sub-Category</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>Quantity</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>{th('Avg. Rate (Excl. Taxes)')}</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>{th('Avg. Rate / Sq.Ft (Excl. Taxes)')}</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>{th('Revenue (Excl. Taxes)')}</th>
                    <th style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}>{th('Revenue (Incl. Taxes)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableProducts.map((p, i) => {
                    const clip = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, ...clip }} title={p._id}>{p._id}</td>
                        <td style={clip} title={p.group || '—'}>{p.group || '—'}</td>
                        <td style={clip} title={p.category || '—'}>{p.category || '—'}</td>
                        <td>{formatNumber(p.totalQty)}</td>
                        <td>{formatCurrency(p.avgRate)}</td>
                        <td>{ratePerFoot(p.avgRate, p.master)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--primary-600)', ...clip }}>{formatCurrency(p.totalAmount)}</td>
                        <td style={{ fontWeight: 600, ...clip }}>{formatCurrency(p.totalAmountIncl)}</td>
                      </tr>
                    );
                  })}
                  {tableProducts.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                      {tableSearch.trim() ? 'No products match your search.' : 'No products for the current filters.'}
                    </td></tr>
                  )}
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
