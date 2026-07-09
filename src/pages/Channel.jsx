import React, { useState, useEffect, useCallback } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { FiTrendingUp, FiUsers, FiShoppingBag, FiDollarSign } from 'react-icons/fi';
import ChartCard from '../components/ChartCard';
import AIInsightButton from '../components/AIInsightButton';
import ExportControls from '../components/ExportControls';
import NotificationPanel from '../components/NotificationPanel';
import {
  getChannelSummary, getChannelTrend, getChannelTopCustomers,
  getChannelStateBreakdown, getChannelProductBreakdown, getChannelCategoryBreakdown
} from '../services/api';

const B2B_COLOR = '#2563eb';
const B2C_COLOR = '#10b981';

import { KPISkeleton, ChartSkeleton, TableSkeleton, Skeleton } from '../components/Skeleton';
import { formatINRShort } from '../utils/numberFormat';

const Channel = () => {
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');

  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [applied, setApplied] = useState({});

  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [customers, setCustomers] = useState({ b2b: [], b2c: [] });
  const [stateData, setStateData] = useState([]);
  const [products, setProducts] = useState({ b2b: [], b2c: [] });
  const [categories, setCategories] = useState([]);
  const [trendGroupBy, setTrendGroupBy] = useState('day');
  const [custTab, setCustTab] = useState('b2b');
  const [loading, setLoading] = useState(true);

  const formatCurrency = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
  const formatNumber = (v) => new Intl.NumberFormat('en-IN').format(v || 0);

  const fetchAll = useCallback(async (params = applied) => {
    setLoading(true);
    try {
      const [sumRes, custRes, stateRes, prodRes, catRes] = await Promise.all([
        getChannelSummary(params),
        getChannelTopCustomers(params),
        getChannelStateBreakdown(params),
        getChannelProductBreakdown(params),
        getChannelCategoryBreakdown(params)
      ]);
      setSummary(sumRes.data.data);
      setCustomers(custRes.data.data);
      setStateData(stateRes.data.data);
      setProducts(prodRes.data.data);
      setCategories(catRes.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [applied]);

  const fetchTrend = useCallback(async (params = applied, groupBy = trendGroupBy) => {
    try {
      const res = await getChannelTrend({ ...params, groupBy });
      setTrend(res.data.data);
    } catch (err) { console.error(err); }
  }, [applied, trendGroupBy]);

  useEffect(() => { fetchAll(); fetchTrend(); }, []);
  useEffect(() => { fetchTrend(applied, trendGroupBy); }, [trendGroupBy]);

  const applyFilters = () => {
    const p = {};
    if (filters.startDate) p.startDate = filters.startDate;
    if (filters.endDate) p.endDate = filters.endDate;
    setApplied(p);
    fetchAll(p);
    fetchTrend(p, trendGroupBy);
  };
  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '' });
    setApplied({});
    fetchAll({});
    fetchTrend({}, trendGroupBy);
  };

  // ---- Chart data ----

  const doughnutData = {
    labels: ['B2B (Company)', 'B2C (Direct)'],
    datasets: [{
      data: summary ? [summary.b2b.revenue, summary.b2c.revenue] : [0, 0],
      backgroundColor: [B2B_COLOR, B2C_COLOR],
      borderWidth: 2, borderColor: '#fff'
    }]
  };

  const trendLineData = {
    labels: trend.map(t => t.period),
    datasets: [
      { label: 'B2B Revenue', data: trend.map(t => t.b2bRevenue), borderColor: B2B_COLOR, backgroundColor: `${B2B_COLOR}15`, borderWidth: 2, tension: 0.4, pointRadius: 3, fill: true },
      { label: 'B2C Revenue', data: trend.map(t => t.b2cRevenue), borderColor: B2C_COLOR, backgroundColor: `${B2C_COLOR}15`, borderWidth: 2, tension: 0.4, pointRadius: 3, fill: true }
    ]
  };

  const stateBarData = {
    labels: stateData.map(s => s.state),
    datasets: [
      { label: 'B2B', data: stateData.map(s => s.b2bRevenue), backgroundColor: B2B_COLOR, borderRadius: 4 },
      { label: 'B2C', data: stateData.map(s => s.b2cRevenue), backgroundColor: B2C_COLOR, borderRadius: 4 }
    ]
  };

  const topN = 10;
  const allProdLabels = [...new Set([...products.b2b.map(p => p._id), ...products.b2c.map(p => p._id)])].slice(0, topN);
  const b2bProdMap = Object.fromEntries(products.b2b.map(p => [p._id, p.revenue]));
  const b2cProdMap = Object.fromEntries(products.b2c.map(p => [p._id, p.revenue]));
  const productBarData = {
    labels: allProdLabels.map(l => l && l.length > 22 ? l.slice(0, 20) + '…' : l),
    datasets: [
      { label: 'B2B', data: allProdLabels.map(l => b2bProdMap[l] || 0), backgroundColor: B2B_COLOR, borderRadius: 4 },
      { label: 'B2C', data: allProdLabels.map(l => b2cProdMap[l] || 0), backgroundColor: B2C_COLOR, borderRadius: 4 }
    ]
  };

  const categoryBarData = {
    labels: categories.map(c => c.category),
    datasets: [
      { label: 'B2B', data: categories.map(c => c.b2bRevenue), backgroundColor: B2B_COLOR, borderRadius: 4 },
      { label: 'B2C', data: categories.map(c => c.b2cRevenue), backgroundColor: B2C_COLOR, borderRadius: 4 }
    ]
  };

  const chartYTicks = { ticks: { callback: v => formatINRShort(v) } };
  const moneyTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${formatCurrency(ctx.raw)}` } };


  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Channel Analytics</h1>
          <p>B2B (Company) vs B2C (Direct) performance comparison</p>
        </div>
        <div className="page-controls">
          <ExportControls pageTitle="Channel_Analytics" />
          {user.role === 'admin' && <NotificationPanel />}
        </div>
      </div>

      {/* Date Filters */}
      <div className="filter-bar" style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>From</label>
        <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
          style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', background: '#fff' }} />
        <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>To</label>
        <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
          style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', background: '#fff' }} />
        {/* Master Product — placeholder, no behaviour yet */}
        <button type="button" title="Master Product (coming soon)"
          style={{ padding: '8px 14px', border: '1px dashed var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-light, #f8fafc)', cursor: 'not-allowed', whiteSpace: 'nowrap' }}>
          Master Product
        </button>
        <button onClick={applyFilters} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--primary-500)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Apply</button>
        <button onClick={clearFilters} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}>Clear</button>
      </div>

      {/* AI Banner */}
      {summary && (
        <AIInsightButton
          contextData={{ summary, trend: trend.slice(-6) }}
          contextType="B2B vs B2C Channel Performance Comparison"
          title="Generate AI Channel Analysis"
          isBanner={true}
        />
      )}

      {/* Channel Overview Cards */}
      {loading && !summary ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <Skeleton style={{ height: '240px', borderRadius: 'var(--radius-md)' }} />
          <Skeleton style={{ height: '240px', borderRadius: 'var(--radius-md)' }} />
        </div>
      ) : summary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* B2B Card */}
          <div style={{ background: 'var(--bg-card)', border: `2px solid ${B2B_COLOR}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ background: B2B_COLOR, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em' }}>B2B — COMPANY</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', marginTop: '2px' }}>Corporate / Bulk orders</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '10px', display: 'flex' }}>
                <FiShoppingBag size={22} color="#fff" />
              </div>
            </div>
            <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: 'Revenue', value: formatCurrency(summary.b2b.revenue), icon: <FiDollarSign size={14} /> },
                { label: 'Revenue Share', value: `${summary.b2b.share}%`, icon: <FiTrendingUp size={14} /> },
                { label: 'Orders', value: formatNumber(summary.b2b.orders), icon: <FiShoppingBag size={14} /> },
                { label: 'Customers', value: formatNumber(summary.b2b.customers), icon: <FiUsers size={14} /> },
                { label: 'Avg Order Value', value: formatCurrency(summary.b2b.avgOrder), icon: <FiDollarSign size={14} /> },
                { label: 'Total Qty', value: formatNumber(summary.b2b.qty), icon: <FiShoppingBag size={14} /> },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                    <span style={{ color: B2B_COLOR }}>{item.icon}</span>{item.label}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* B2C Card */}
          <div style={{ background: 'var(--bg-card)', border: `2px solid ${B2C_COLOR}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ background: B2C_COLOR, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em' }}>B2C — DIRECT</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', marginTop: '2px' }}>Individual salesperson orders</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '10px', display: 'flex' }}>
                <FiUsers size={22} color="#fff" />
              </div>
            </div>
            <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: 'Revenue', value: formatCurrency(summary.b2c.revenue), icon: <FiDollarSign size={14} /> },
                { label: 'Revenue Share', value: `${summary.b2c.share}%`, icon: <FiTrendingUp size={14} /> },
                { label: 'Orders', value: formatNumber(summary.b2c.orders), icon: <FiShoppingBag size={14} /> },
                { label: 'Customers', value: formatNumber(summary.b2c.customers), icon: <FiUsers size={14} /> },
                { label: 'Avg Order Value', value: formatCurrency(summary.b2c.avgOrder), icon: <FiDollarSign size={14} /> },
                { label: 'Total Qty', value: formatNumber(summary.b2c.qty), icon: <FiShoppingBag size={14} /> },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                    <span style={{ color: B2C_COLOR }}>{item.icon}</span>{item.label}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="charts-grid" style={{ marginBottom: '24px' }}>
        {loading && !summary ? (
          <ChartSkeleton />
        ) : summary && (
          <ChartCard title="Revenue Channel Split" aiContext={summary} aiType="B2B vs B2C Revenue Share">
            <div className="donut-container">
              <div style={{ flex: '1', minWidth: 0, height: '100%' }}>
                <Doughnut data={doughnutData} options={{
                  maintainAspectRatio: false,
                  cutout: '60%',
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } }
                  }
                }} />
              </div>
              <div 
                style={{ 
                  flex: '0 0 160px', 
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflowY: 'auto',
                  maxHeight: '100%',
                  msOverflowStyle: 'thin',
                  scrollbarWidth: 'thin'
                }}
                onWheel={(e) => e.stopPropagation()}
              >
                {doughnutData.labels.map((label, i) => {
                  const val = doughnutData.datasets[0].data[i];
                  const total = doughnutData.datasets[0].data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: doughnutData.datasets[0].backgroundColor[i] }} />
                        <span style={{ fontWeight: 500 }}>{label.split(' ')[0]}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        )}

        {loading && trend.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <ChartCard
            title="Revenue Trend by Channel"
            aiContext={trend}
            aiType="B2B vs B2C Revenue Trend Over Time"
            extra={
              <div style={{ display: 'flex', gap: '6px' }}>
                {['month', 'day'].map(g => (
                  <button key={g} onClick={() => setTrendGroupBy(g)} style={{
                    padding: '5px 12px', fontSize: '0.8rem', borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: trendGroupBy === g ? 'var(--primary-600)' : 'var(--bg-card)',
                    color: trendGroupBy === g ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer', fontWeight: 500
                  }}>{g === 'month' ? 'Monthly' : 'Daily'}</button>
                ))}
              </div>
            }
          >
            <Line data={trendLineData} options={{
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTooltip },
              scales: { y: chartYTicks }
            }} />
          </ChartCard>
        )}
      </div>

      {/* State Breakdown + Category Breakdown */}
      <div className="charts-grid" style={{ marginBottom: '24px' }}>
        {loading && stateData.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title="State-wise Revenue by Channel" aiContext={stateData} aiType="State-wise B2B vs B2C Revenue Breakdown">
            <Bar data={stateBarData} options={{
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTooltip },
              scales: { y: chartYTicks, x: { ticks: { font: { size: 9 } } } }
            }} />
          </ChartCard>
        )}

        {loading && categories.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title="Category Revenue by Channel" aiContext={categories} aiType="Product Category B2B vs B2C Revenue">
            <Bar data={categoryBarData} options={{
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTooltip },
              scales: { y: chartYTicks }
            }} />
          </ChartCard>
        )}
      </div>

      {/* Top Products */}
      <div className="charts-grid" style={{ marginBottom: '24px' }}>
        <ChartCard title="Top Products by Channel" aiContext={products} aiType="Top Products Comparison B2B vs B2C" fullWidth>
          <Bar data={productBarData} options={{
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTooltip },
            scales: {
              y: chartYTicks,
              x: { ticks: { font: { size: 9 }, callback: function(val) { const l = this.getLabelForValue(val); return l && l.length > 18 ? l.slice(0,16)+'…' : l; } } }
            }
          }} />
        </ChartCard>
      </div>

      {/* Top Customers */}
      <div className="data-table-wrapper">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, marginRight: '24px' }}>Top Customers</h3>
          <div style={{ display: 'flex', gap: '0', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            {['b2b', 'b2c'].map(tab => (
              <button key={tab} onClick={() => setCustTab(tab)} style={{
                padding: '7px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                background: custTab === tab ? (tab === 'b2b' ? B2B_COLOR : B2C_COLOR) : 'var(--bg-card)',
                color: custTab === tab ? '#fff' : 'var(--text-secondary)'
              }}>
                {tab === 'b2b' ? 'B2B — Company' : 'B2C — Direct'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '420px', WebkitOverflowScrolling: 'touch' }}>
          {loading && (customers[custTab] || []).length === 0 ? (
            <TableSkeleton />
          ) : (
            <table className="data-table" style={{ minWidth: '550px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-light)' }}>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>#</th>
                  <th>Customer</th>
                  <th style={{ whiteSpace: 'nowrap' }}>City</th>
                  <th style={{ whiteSpace: 'nowrap' }}>State</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Revenue</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Orders</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {(customers[custTab] || []).length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No data</td></tr>
                ) : (customers[custTab] || []).map((c, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c._id}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.city || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.state || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 700, color: custTab === 'b2b' ? B2B_COLOR : B2C_COLOR }}>{formatCurrency(c.revenue)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{formatNumber(c.orders)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{formatNumber(c.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Channel;
