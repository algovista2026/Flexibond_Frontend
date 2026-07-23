import React, { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { FiBox, FiSearch, FiPackage } from 'react-icons/fi';
import ChartCard from '../components/ChartCard';
import AIInsightButton from '../components/AIInsightButton';
import ExportControls from '../components/ExportControls';
import GlobalSearch from '../components/GlobalSearch';
import NotificationPanel from '../components/NotificationPanel';
import FilterBar from '../components/FilterBar';
import { getTopProducts, getProductComparison, getFilters } from '../services/api';
import { formatINRShort, formatShort } from '../utils/numberFormat';
import { getGlobalMaster, setGlobalMaster } from '../utils/globalFilters';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

import { ChartSkeleton, Skeleton } from '../components/Skeleton';

const shorten = (l, n = 20) => (l && l.length > n ? l.substring(0, n - 2) + '…' : l);

const ProductComparison = () => {
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [metric, setMetric] = useState('revenue');
  const [trendGroupBy, setTrendGroupBy] = useState('month');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], format: '',
    product: '', thickness: [], dimensions: '', city: '', group: [], group1: [], master: getGlobalMaster()
  });
  const [filterOptions, setFilterOptions] = useState({});

  useEffect(() => {
    fetchProductList();
    fetchOptions();
  }, [filters]);

  const fetchOptions = async () => {
    try {
      const res = await getFilters(filters);
      setFilterOptions(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProductList = async () => {
    try {
      setLoading(true);
      const res = await getTopProducts({ ...filters, limit: 50, sortBy: 'totalAmount' });
      const list = res.data.data || [];
      setAllProducts(list);
      if (selected.length === 0 && list.length > 0) {
        setSelected(list.slice(0, 3).map(p => p._id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected.length > 0) {
      fetchComparison();
    } else {
      setComparisonData([]);
    }
  }, [selected, trendGroupBy, filters]);

  const fetchComparison = async () => {
    try {
      const res = await getProductComparison({ ...filters, products: selected, groupBy: trendGroupBy });
      // Preserve selection order
      const byId = {};
      (res.data.data || []).forEach(d => { byId[d._id] = d; });
      setComparisonData(selected.map(name => byId[name]).filter(Boolean));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleProduct = (name) => {
    if (selected.includes(name)) {
      setSelected(selected.filter(s => s !== name));
    } else if (selected.length < 8) {
      setSelected([...selected, name]);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val || 0);
  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Quantity';
  const mVal = (d) => metric === 'revenue' ? d.totalRevenue : d.totalQty;
  const axisFmt = (v) => metric === 'revenue' ? formatINRShort(v) : formatShort(v);
  const metricScale = { ticks: { callback: v => axisFmt(v) } };
  const metricTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${metric === 'revenue' ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}` } };
  const currencyScale = { ticks: { callback: v => formatINRShort(v) } };
  const currencyTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${formatCurrency(ctx.raw)}` } };

  const filteredProducts = allProducts.filter(p => p._id.toLowerCase().includes(search.toLowerCase()));

  // Totals comparison bar
  const totalsData = {
    labels: comparisonData.map(d => shorten(d._id)),
    datasets: [{
      label: metricLabel,
      data: comparisonData.map(mVal),
      backgroundColor: comparisonData.map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 6
    }]
  };

  // Trend overlay line
  const allPeriods = [...new Set(comparisonData.flatMap(d => (d.periodData || []).map(m => m.period)))].sort();
  const trendData = {
    labels: allPeriods,
    datasets: comparisonData.map((p, i) => ({
      label: shorten(p._id, 16),
      data: allPeriods.map(period => {
        const m = (p.periodData || []).find(md => md.period === period);
        return m ? (metric === 'revenue' ? m.revenue : m.qty) : 0;
      }),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 3
    }))
  };

  // Avg rate comparison
  const rateData = {
    labels: comparisonData.map(d => shorten(d._id)),
    datasets: [{
      label: 'Avg Rate (₹)',
      data: comparisonData.map(d => Math.round(d.avgRate || 0)),
      backgroundColor: comparisonData.map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 6
    }]
  };

  // State-wise breakdown (grouped by state, one dataset per product)
  const allStates = {};
  comparisonData.forEach(p => {
    (p.states || []).forEach(s => {
      if (!allStates[s.state]) allStates[s.state] = {};
      allStates[s.state][p._id] = metric === 'revenue' ? s.revenue : s.qty;
    });
  });
  const stateLabels = Object.keys(allStates).slice(0, 12);
  const stateData = {
    labels: stateLabels,
    datasets: comparisonData.map((p, i) => ({
      label: shorten(p._id, 16),
      data: stateLabels.map(st => allStates[st]?.[p._id] || 0),
      backgroundColor: COLORS[i % COLORS.length],
      borderRadius: 4
    }))
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Product Comparison</h1>
          <p>Compare performance metrics across multiple products side-by-side</p>
        </div>
        <div className="page-controls">
          <GlobalSearch onSearchSelect={(res) => setFilters(prev => ({ ...prev, ...res }))} />
          <ExportControls pageTitle="Product_Comparison" />
          {user.role === 'admin' && <NotificationPanel />}

          <div className="metric-toggle">
            <button onClick={() => setMetric('revenue')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: metric === 'revenue' ? '#fff' : 'transparent', boxShadow: metric === 'revenue' ? 'var(--shadow-sm)' : 'none', fontWeight: 600, cursor: 'pointer', color: metric === 'revenue' ? 'var(--primary-600)' : 'var(--text-secondary)' }}>Revenue</button>
            <button onClick={() => setMetric('qty')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: metric === 'qty' ? '#fff' : 'transparent', boxShadow: metric === 'qty' ? 'var(--shadow-sm)' : 'none', fontWeight: 600, cursor: 'pointer', color: metric === 'qty' ? 'var(--primary-600)' : 'var(--text-secondary)' }}>Quantity</button>
          </div>
        </div>
      </div>

      <FilterBar
        filters={filters}
        options={filterOptions}
        onFilterChange={(newFilters, clear) => {
          if (clear) {
            setGlobalMaster([]); // Master is universal — clearing here clears it everywhere.
            setFilters({
              startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], format: '',
              product: '', thickness: [], dimensions: '', city: '', group: [], group1: [], master: []
            });
          } else {
            if ('master' in newFilters) setGlobalMaster(newFilters.master);
            setFilters(prev => ({ ...prev, ...newFilters }));
          }
        }}
      />

      {selected.length > 0 && (
        <AIInsightButton
          contextData={comparisonData}
          contextType="Products Side-by-Side Comparison"
          title="Generate AI Comparison Analysis"
          isBanner={true}
        />
      )}

      {/* Product selector */}
      <div className="data-table-wrapper" style={{ marginBottom: '20px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
            <FiBox style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Select Products to Compare ({selected.length}/8)
          </h3>
          <div style={{ position: 'relative', flex: '1 1 160px', maxWidth: '260px' }}>
            <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 12px 6px 32px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
          {loading && allProducts.length === 0 ? (
            [1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} style={{ width: '120px', height: '32px', borderRadius: '20px' }} />)
          ) : (
            filteredProducts.map((p, i) => {
              const isSelected = selected.includes(p._id);
              const colorIdx = selected.indexOf(p._id);
              return (
                <button
                  key={i}
                  onClick={() => toggleProduct(p._id)}
                  title={p._id}
                  style={{
                    padding: '6px 14px', borderRadius: '20px',
                    border: isSelected ? `2px solid ${COLORS[colorIdx % COLORS.length]}` : '1px solid var(--border-color)',
                    background: isSelected ? `${COLORS[colorIdx % COLORS.length]}15` : 'var(--bg-card)',
                    color: isSelected ? COLORS[colorIdx % COLORS.length] : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: isSelected ? 600 : 400, fontSize: '0.8rem',
                    transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                  }}
                >
                  {shorten(p._id, 28)}
                </button>
              );
            })
          )}
          {!loading && filteredProducts.length === 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No products match your search / filters.</span>
          )}
        </div>
      </div>

      {selected.length === 0 ? (
        <div className="no-data" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '60px 20px', textAlign: 'center' }}>
          <FiPackage style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>Select Products</h3>
          <p>Click on the products above to start comparing</p>
        </div>
      ) : (
        <>
          {/* Summary table */}
          <div className="data-table-wrapper" style={{ marginBottom: '20px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Performance Summary</h3>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="data-table" style={{ minWidth: '620px' }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>Product</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Category</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Revenue</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Quantity</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Orders</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Avg Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: COLORS[i % COLORS.length] }}>{p._id}</td>
                      <td>{p.categoryCode || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(p.totalRevenue)}</td>
                      <td>{formatNumber(p.totalQty)}</td>
                      <td>{formatNumber(p.totalOrders)}</td>
                      <td>{formatCurrency(p.avgRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="charts-grid">
            {comparisonData.length === 0 ? (
              <>
                <ChartSkeleton />
                <ChartSkeleton />
                <ChartSkeleton fullWidth />
              </>
            ) : (
              <>
                <ChartCard title={`${metricLabel} Comparison`} aiContext={comparisonData} aiType="Product Performance Comparison">
                  <Bar data={totalsData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: metricTooltip }, scales: { y: metricScale } }} />
                </ChartCard>

                <ChartCard
                  title={`${metricLabel} Trend`}
                  aiContext={comparisonData}
                  aiType="Product Performance Trends"
                  extra={
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setTrendGroupBy('day')} style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: trendGroupBy === 'day' ? 'var(--primary-600)' : 'var(--bg-card)', color: trendGroupBy === 'day' ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>Days</button>
                      <button onClick={() => setTrendGroupBy('month')} style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: trendGroupBy === 'month' ? 'var(--primary-600)' : 'var(--bg-card)', color: trendGroupBy === 'month' ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>Months</button>
                    </div>
                  }
                >
                  <Line data={trendData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: metricTooltip }, scales: { y: metricScale } }} />
                </ChartCard>

                <ChartCard title="Average Rate (₹) Comparison" aiContext={comparisonData} aiType="Product Average Rate Comparison">
                  <Bar data={rateData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: currencyTooltip }, scales: { y: currencyScale } }} />
                </ChartCard>

                <ChartCard title={`State-wise ${metricLabel}`} aiContext={comparisonData} aiType="Product State Breakdown Comparison" fullWidth>
                  <Bar data={stateData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: metricTooltip }, scales: { y: metricScale } }} />
                </ChartCard>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductComparison;
