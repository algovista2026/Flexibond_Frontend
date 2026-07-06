import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { FiDollarSign, FiShoppingCart, FiUsers, FiPackage, FiTrendingUp } from 'react-icons/fi';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import FilterBar from '../components/FilterBar';
import AIInsightButton from '../components/AIInsightButton';
import ExportControls from '../components/ExportControls';
import GlobalSearch from '../components/GlobalSearch';
import NotificationPanel from '../components/NotificationPanel';
import { averageLinePlugin } from '../utils/averageLinePlugin';
import {
  getDashboardSummary,
  getRevenueTrend,
  getTopProducts,
  getTopCustomers,
  getGeographic,
  getSalespersonList,
  getFilters
} from '../services/api';

import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';

const Dashboard = () => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
    format: '', product: '', thickness: '', dimensions: ''
  });
  const [metric, setMetric] = useState('revenue');
  const [trendGroupBy, setTrendGroupBy] = useState('day');
  const [filterOptions, setFilterOptions] = useState({});
  const [data, setData] = useState({
    summary: null,
    trend: null,
    products: null,
    customers: null,
    geo: null,
    salespersons: null
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        summaryRes, trendRes, productsRes,
        customersRes, geoRes, spRes, filtersRes
      ] = await Promise.all([
        getDashboardSummary(filters),
        getRevenueTrend({ ...filters, groupBy: trendGroupBy }),
        getTopProducts({ ...filters, limit: 10, sortBy: metric === 'revenue' ? 'totalAmount' : 'totalQty' }),
        getTopCustomers({ ...filters, limit: 20, sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty' }),
        getGeographic({ ...filters, groupBy: 'state', sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty' }),
        getSalespersonList({ ...filters, sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty' }),
        getFilters()
      ]);

      setData({
        summary: summaryRes.data.data,
        trend: trendRes.data.data,
        products: productsRes.data.data,
        customers: customersRes.data.data,
        geo: geoRes.data.data,
        salespersons: spRes.data.data
      });
      setFilterOptions(filtersRes.data.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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

  useEffect(() => {
    fetchData();
  }, [filters, trendGroupBy, metric]);

  const handleFilterChange = (newFilters, clear = false) => {
    if (clear) {
      setFilters({
        startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
        format: '', product: '', thickness: '', dimensions: ''
      });
    } else {
      setFilters(prev => ({ ...prev, ...newFilters }));
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val || 0);
  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Quantity';

  // Chart Configs
  const trendChartData = {
    labels: data.trend?.map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.trend?.map(d => metric === 'revenue' ? d.revenue : d.qty) || [],
      borderColor: 'var(--primary-500)',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4
    }]
  };

  const productsChartData = {
    labels: data.products?.map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.products?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: 'var(--primary-400)',
      borderRadius: 4
    }]
  };

  // Salesperson donut (replaces category breakdown)
  const spChartData = {
    labels: data.salespersons?.slice(0, 8).map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.salespersons?.slice(0, 8).map(d => metric === 'revenue' ? d.totalRevenue : d.totalQty) || [],
      backgroundColor: [
        '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'
      ],
      borderWidth: 0
    }]
  };

  const geoChartData = {
    labels: data.geo?.map(d => d._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.geo?.map(d => metric === 'revenue' ? d.totalRevenue : d.totalQty) || [],
      backgroundColor: '#f59e0b',
      borderRadius: 4
    }]
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Dashboard Overview</h1>
          <p>Key performance indicators and analytics for Flexibond</p>
        </div>
        <div className="page-controls">
          <GlobalSearch onSearchSelect={(res) => setFilters(prev => ({ ...prev, ...res }))} />
          <ExportControls pageTitle="Overview_Dashboard" />
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

      <FilterBar filters={filters} options={filterOptions} onFilterChange={handleFilterChange} />

      {data.summary && (
        <div style={{ marginBottom: '24px' }}>
          <AIInsightButton 
            contextData={data.summary} 
            contextType="Dashboard Overall KPI Summary" 
            title="Generate AI Executive Summary" 
            isBanner={true} 
          />
        </div>
      )}

      {loading && !data.summary ? (
        <KPISkeleton />
      ) : data.summary && (
        <div className="kpi-grid">
          <KPICard
            title="Total Revenue"
            value={formatCurrency(data.summary.totalRevenue)}
            icon={<FiDollarSign />}
            color="blue"
          />
          <KPICard
            title="Total Orders"
            value={formatNumber(data.summary.totalOrders)}
            icon={<FiShoppingCart />}
            color="green"
          />
          <KPICard
            title="Avg Order Value"
            value={formatCurrency(data.summary.avgOrderValue)}
            icon={<FiTrendingUp />}
            color="orange"
          />
          <KPICard
            title="Unique Customers"
            value={formatNumber(data.summary.uniqueCustomers)}
            icon={<FiUsers />}
            color="red"
          />
          <KPICard
            title="Quantity Sold"
            value={formatNumber(data.summary.totalQty)}
            icon={<FiPackage />}
            color="blue"
          />
        </div>
      )}

      <div className="charts-grid">
        {loading && !data.trend ? (
          <ChartSkeleton fullWidth />
        ) : (
          <ChartCard 
            title={`${metricLabel} Trend`} 
            aiContext={data.trend}
            aiType="Revenue Trend Data"
            fullWidth 
            extra={
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setTrendGroupBy('day')} 
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: trendGroupBy === 'day' ? 'var(--primary-600)' : 'var(--bg-card)',
                    color: trendGroupBy === 'day' ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Days
                </button>
                <button 
                  onClick={() => setTrendGroupBy('month')} 
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: trendGroupBy === 'month' ? 'var(--primary-600)' : 'var(--bg-card)',
                    color: trendGroupBy === 'month' ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Months
                </button>
              </div>
            }
          >
            <Line
              data={trendChartData}
              plugins={[averageLinePlugin]}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  averageLine: { formatter: (v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(Math.round(v)) }
                }
              }}
            />
          </ChartCard>
        )}
        
        {loading && !data.products ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`Top Products (${metricLabel})`} aiContext={data.products} aiType="Top Products Comparison">
            <Bar
              data={productsChartData}
              plugins={[averageLinePlugin]}
              options={{
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                  legend: { display: false },
                  averageLine: { formatter: (v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(Math.round(v)) }
                },
                scales: {
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

        {loading && !data.salespersons ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`Salesperson ${metricLabel}`} aiContext={data.salespersons} aiType="Salesperson Performance">
            <div className="donut-container">
              <div style={{ flex: '1', minWidth: 0, height: '100%' }}>
                <Doughnut 
                  data={spChartData} 
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
              <div className="custom-legend">
                {(spChartData.labels || []).map((label, i) => {
                  const val = spChartData.datasets[0].data[i];
                  const total = spChartData.datasets[0].data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  const color = spChartData.datasets[0].backgroundColor[i % spChartData.datasets[0].backgroundColor.length];
                  return (
                    <div key={i} className="legend-item">
                      <div className="legend-label">
                        <div className="legend-dot" style={{ background: color }} />
                        <span>{label}</span>
                      </div>
                      <span className="legend-percentage">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        )}

        {loading && !data.geo ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`${metricLabel} by State`} aiContext={data.geo} aiType="Geographic Breakdown">
            <Bar
              data={geoChartData}
              plugins={[averageLinePlugin]}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  averageLine: { formatter: (v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(Math.round(v)) }
                }
              }}
            />
          </ChartCard>
        )}

        {loading && !data.customers ? (
          <TableSkeleton />
        ) : (
          <div className="data-table-wrapper" style={{ gridColumn: '1 / -1' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Top Customers</h3>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                  <tr>
                    <th>Customer Name</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Salesperson</th>
                    <th>Orders</th>
                    <th>{metricLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers?.map((cust, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{cust._id}</td>
                      <td>{cust.city}</td>
                      <td>{cust.state}</td>
                      <td>{cust.salesperson}</td>
                      <td>{cust.totalOrders}</td>
                      <td style={{ fontWeight: 600 }}>
                        {metric === 'revenue' ? formatCurrency(cust.totalRevenue) : formatNumber(cust.totalQty)}
                      </td>
                    </tr>
                  ))}
                  {(!data.customers || data.customers.length === 0) && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>No customer data available</td></tr>
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

export default Dashboard;
