import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import { FiUserCheck, FiUsers, FiSearch } from 'react-icons/fi';
import ChartCard from '../components/ChartCard';
import AIInsightButton from '../components/AIInsightButton';
import ExportControls from '../components/ExportControls';
import GlobalSearch from '../components/GlobalSearch';
import NotificationPanel from '../components/NotificationPanel';
import FilterBar from '../components/FilterBar';
import { getSalespersonList, getSalespersonComparison, getSalespersonPerformance, getFilters } from '../services/api';
import { formatINRShort, formatShort } from '../utils/numberFormat';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

import { KPISkeleton, ChartSkeleton, TableSkeleton, Skeleton } from '../components/Skeleton';

const Comparison = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const [loading, setLoading] = useState(true);
  const [allSP, setAllSP] = useState([]);
  const [selected, setSelected] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [spDetails, setSpDetails] = useState({});
  const [metric, setMetric] = useState('revenue');
  const [trendGroupBy, setTrendGroupBy] = useState('day');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', category: [], state: [], grade: [], zone: [], format: '',
    product: '', thickness: '', dimensions: '', city: ''
  });
  const [filterOptions, setFilterOptions] = useState({});

  useEffect(() => {
    fetchSPList();
    fetchOptions();
  }, [filters]);

  const fetchOptions = async () => {
    try {
      const res = await getFilters();
      setFilterOptions(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSPList = async () => {
    try {
      setLoading(true);
      const res = await getSalespersonList(filters);
      const list = res.data.data;
      setAllSP(list);
      // Auto-select top 3
      if (selected.length === 0) {
        const top = list.slice(0, 3).map(s => s._id);
        setSelected(top);
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
    }
  }, [selected, trendGroupBy, filters]);

  const fetchComparison = async () => {
    try {
      const [compRes, ...detailsRes] = await Promise.all([
        getSalespersonComparison({ ...filters, groupBy: trendGroupBy }),
        ...selected.map(name => getSalespersonPerformance(name, filters).catch(() => null))
      ]);

      setComparisonData(compRes.data.data.filter(d => selected.includes(d._id)));

      const details = {};
      selected.forEach((name, i) => {
        if (detailsRes[i]?.data?.data) {
          details[name] = detailsRes[i].data.data;
        }
      });
      setSpDetails(details);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSP = (name) => {
    if (selected.includes(name)) {
      setSelected(selected.filter(s => s !== name));
    } else if (selected.length < 8) {
      setSelected([...selected, name]);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val || 0);
  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Quantity';
  const axisFmt = (v) => metric === 'revenue' ? formatINRShort(v) : formatShort(v);
  const metricScale = { ticks: { callback: v => axisFmt(v) } };
  const metricTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${metric === 'revenue' ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}` } };

  const filteredSP = allSP.filter(s => s._id.toLowerCase().includes(search.toLowerCase()));

  // Revenue comparison bar chart
  const revenueCompData = {
    labels: comparisonData.map(d => d._id),
    datasets: [{
      label: metricLabel,
      data: comparisonData.map(d => metric === 'revenue' ? d.totalRevenue : d.totalQty),
      backgroundColor: comparisonData.map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 6
    }]
  };

  // Trend line chart (overlaid)
  const allPeriods = [...new Set(comparisonData.flatMap(d => (d.periodData || []).map(m => m.period)))].sort();
  const trendCompData = {
    labels: allPeriods,
    datasets: comparisonData.map((sp, i) => ({
      label: sp._id,
      data: allPeriods.map(period => {
        const m = (sp.periodData || []).find(md => md.period === period);
        return m ? (metric === 'revenue' ? m.revenue : m.qty) : 0;
      }),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 3
    }))
  };

  // Top products comparison (from details)
  const allProducts = {};
  selected.forEach(name => {
    const d = spDetails[name];
    if (d?.topProducts) {
      d.topProducts.forEach(p => {
        if (!allProducts[p._id]) allProducts[p._id] = {};
        allProducts[p._id][name] = metric === 'revenue' ? p.totalAmount : p.totalQty;
      });
    }
  });
  const topProductLabels = Object.keys(allProducts).slice(0, 10);
  const productCompData = {
    labels: topProductLabels.map(l => l.length > 20 ? l.substring(0, 18) + '...' : l),
    datasets: selected.map((name, i) => ({
      label: name,
      data: topProductLabels.map(p => allProducts[p]?.[name] || 0),
      backgroundColor: COLORS[i % COLORS.length],
      borderRadius: 4
    }))
  };

  // City breakdown comparison
  const allCities = {};
  selected.forEach(name => {
    const d = spDetails[name];
    if (d?.cityBreakdown) {
      d.cityBreakdown.forEach(c => {
        if (!allCities[c._id]) allCities[c._id] = {};
        allCities[c._id][name] = metric === 'revenue' ? c.totalRevenue : (c.totalQty || 0);
      });
    }
  });
  const topCityLabels = Object.keys(allCities).slice(0, 10);
  const cityCompData = {
    labels: topCityLabels,
    datasets: selected.map((name, i) => ({
      label: name,
      data: topCityLabels.map(c => allCities[c]?.[name] || 0),
      backgroundColor: COLORS[i % COLORS.length],
      borderRadius: 4
    }))
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Salesperson Comparison</h1>
          <p>Compare performance metrics across multiple salespersons side-by-side</p>
        </div>
        <div className="page-controls">
          <GlobalSearch onSearchSelect={(res) => {
            if (res.salesperson) {
              if (!selected.includes(res.salesperson)) {
                if (selected.length >= 8) {
                  return alert('You can compare a maximum of 8 salespersons.');
                }
                setSelected([...selected, res.salesperson]);
              }
            } else {
              setFilters(prev => ({ ...prev, ...res }));
            }
          }} />
          <ExportControls pageTitle="Salesperson_Comparison" />
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
            setFilters({
              startDate: '', endDate: '', category: [], state: [], grade: [], zone: [], format: '',
              product: '', thickness: '', dimensions: '', city: ''
            });
          } else {
            setFilters(prev => ({ ...prev, ...newFilters }));
          }
        }} 
        hideSalesperson={true}
      />

      {/* AI Insight — above selector, shown only when salespersons are selected */}
      {selected.length > 0 && (
        <AIInsightButton
          contextData={comparisonData}
          contextType="Salespersons Side-by-Side Comparison"
          title="Generate AI Comparison Analysis"
          isBanner={true}
        />
      )}

      <div className="data-table-wrapper" style={{ marginBottom: '20px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
            <FiUserCheck style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Select Salespersons to Compare ({selected.length}/8)
          </h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Quick-add dropdown */}
            <select
              value=""
              onChange={(e) => { if (e.target.value) toggleSP(e.target.value); }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', maxWidth: '200px' }}
            >
              <option value="">+ Add salesperson…</option>
              {allSP
                .filter(sp => !selected.includes(sp._id))
                .map((sp, i) => (
                  <option key={i} value={sp._id} disabled={selected.length >= 8}>{sp._id}</option>
                ))}
            </select>
            <div style={{ position: 'relative', flex: '1 1 160px', maxWidth: '220px' }}>
              <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '6px 12px 6px 32px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
          {loading && allSP.length === 0 ? (
            [1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} style={{ width: '100px', height: '32px', borderRadius: '20px' }} />)
          ) : (
            filteredSP.map((sp, i) => {
              const isSelected = selected.includes(sp._id);
              const colorIdx = selected.indexOf(sp._id);
              return (
                <button
                  key={i}
                  onClick={() => toggleSP(sp._id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: isSelected ? `2px solid ${COLORS[colorIdx % COLORS.length]}` : '1px solid var(--border-color)',
                    background: isSelected ? `${COLORS[colorIdx % COLORS.length]}15` : 'var(--bg-card)',
                    color: isSelected ? COLORS[colorIdx % COLORS.length] : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {sp._id}
                </button>
              );
            })
          )}
        </div>
      </div>

      {selected.length === 0 ? (
        <div className="no-data" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '60px 20px', textAlign: 'center' }}>
          <FiUsers style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>Select Salespersons</h3>
          <p>Click on the names above to start comparing</p>
        </div>
      ) : (
        <>
          {/* Summary Comparison Table */}
          <div className="data-table-wrapper" style={{ marginBottom: '20px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Performance Summary</h3>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>Salesperson</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Revenue</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Quantity</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Orders</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Avg Order</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Customers</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Cities</th>
                    <th style={{ whiteSpace: 'nowrap' }}>States</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((sp, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: COLORS[i % COLORS.length] }}>{sp._id}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(sp.totalRevenue)}</td>
                      <td>{formatNumber(sp.totalQty)}</td>
                      <td>{formatNumber(sp.totalOrders)}</td>
                      <td>{formatCurrency(sp.avgOrderValue)}</td>
                      <td>{formatNumber(sp.uniqueCustomers)}</td>
                      <td>{formatNumber(sp.uniqueCities)}</td>
                      <td>{formatNumber(sp.uniqueStates)}</td>
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
                <ChartSkeleton fullWidth />
              </>
            ) : (
              <>
                <ChartCard title={`${metricLabel} Comparison`} aiContext={comparisonData} aiType="Salesperson Performance Comparison">
                  <Bar
                    data={revenueCompData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: metricTooltip },
                      scales: { y: metricScale }
                    }}
                  />
                </ChartCard>

                <ChartCard 
                  title={`${metricLabel} Trend`}
                  aiContext={comparisonData}
                  aiType="Salesperson Performance Trends"
                  extra={
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => setTrendGroupBy('day')} 
                        style={{
                          padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: trendGroupBy === 'day' ? 'var(--primary-600)' : 'var(--bg-card)',
                          color: trendGroupBy === 'day' ? '#fff' : 'var(--text-primary)',
                          cursor: 'pointer', fontWeight: 500
                        }}
                      >Days</button>
                      <button 
                        onClick={() => setTrendGroupBy('month')} 
                        style={{
                          padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: trendGroupBy === 'month' ? 'var(--primary-600)' : 'var(--bg-card)',
                          color: trendGroupBy === 'month' ? '#fff' : 'var(--text-primary)',
                          cursor: 'pointer', fontWeight: 500
                        }}
                      >Months</button>
                    </div>
                  }
                >
                  <Line
                    data={trendCompData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: metricTooltip },
                      scales: { y: metricScale }
                    }}
                  />
                </ChartCard>

                <ChartCard title={`Top Products by ${metricLabel}`} aiContext={spDetails} aiType="Top Products Comparison Across Salespersons" fullWidth>
                  <Bar
                    data={productCompData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: metricTooltip },
                      scales: {
                        y: metricScale,
                        x: {
                          ticks: {
                            callback: function(value) {
                              const label = this.getLabelForValue(value);
                              return label && label.length > 14 ? label.substring(0, 12) + '...' : label;
                            },
                            font: { size: 9 }
                          }
                        }
                      }
                    }}
                  />
                </ChartCard>

                <ChartCard title={`City-wise ${metricLabel}`} aiContext={spDetails} aiType="City Sales Breakdown Across Salespersons" fullWidth>
                  <Bar
                    data={cityCompData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: metricTooltip },
                      scales: { y: metricScale }
                    }}
                  />
                </ChartCard>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Comparison;
