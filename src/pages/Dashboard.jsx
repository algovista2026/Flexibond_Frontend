import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';
import ChartCard from '../components/ChartCard';
import FilterBar from '../components/FilterBar';
import TargetAmountInput, { TURNOVER_TARGET_PRESETS } from '../components/TargetAmountInput';
import AIInsightButton from '../components/AIInsightButton';
import ExportControls from '../components/ExportControls';
import GlobalSearch from '../components/GlobalSearch';
import NotificationPanel from '../components/NotificationPanel';
import ScrollColumnChart from '../components/ScrollColumnChart';
import { averageLinePlugin } from '../utils/averageLinePlugin';
import { formatINRShort, formatShort } from '../utils/numberFormat';
import {
  getDashboardSummary,
  getRevenueTrend,
  getTopProducts,
  getTopCustomers,
  getGeographic,
  getSalespersonList,
  getFilters,
  getGradeBreakdown,
  getZoneAnalysis,
  getMasterBreakdown,
  getGroupBreakdown,
  getCategoryBreakdown,
  getRevenueTrendByCompany,
  getCompanyTarget,
  setCompanyTarget,
  getScopedTarget,
  setScopedTarget
} from '../services/api';
import { seedFilters, setGlobalFilters, clearGlobalFilters } from '../utils/globalFilters';
import { mergeFilterOptions } from '../utils/filterOptionsCache';
import { PALETTES, ACCENTS, pieColors } from '../utils/chartPalettes';
import { th } from '../utils/thHeader';

import { KPISkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';

const Dashboard = () => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(seedFilters({
    startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
    colour: [], thickness: [], format: '', product: '', dimensions: '', group: [], group1: [],
    master: [], company: [], branch: []
  }));
  const [metric, setMetric] = useState('revenue');
  const [trendGroupBy, setTrendGroupBy] = useState('day');
  // Per-chart tax-basis toggle (TEST) for the Master-wise + Category-wise pies only.
  // 'excl' (default, matches the site-wide excl-taxes revenue) or 'incl'.
  const [masterBasis, setMasterBasis] = useState('excl');
  const [groupBasis, setGroupBasis] = useState('excl');
  const [filterOptions, setFilterOptions] = useState({});
  const [companyTarget, setCompanyTargetState] = useState(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetForm, setTargetForm] = useState('');
  // Per-company target inputs (admin, non-scoped). Keys match the 3 daughter-company buckets.
  const [companyTargetForm, setCompanyTargetForm] = useState({ FDL: '', UCPL: '', 'UFPL': '' });
  const [targetSaving, setTargetSaving] = useState(false);
  const isAdmin = user.role === 'admin';
  // Scoped accounts (company / zonal head) see + edit THEIR OWN target instead of the
  // global company turnover; the middleware already scopes their revenue, so `achieved`
  // (data.summary.totalRevenue) is their own figure.
  const scoped = user.scopeType === 'company' || user.scopeType === 'zonal';
  // Company-scoped IDs see only ONE company's data, so the company-comparison charts (Revenue
  // Split by Company + Revenue by Company trend) are meaningless for them — hidden (2026-08-06).
  const companyScoped = user.scopeType === 'company';
  // Non-scoped admin edits the 3-box turnover target; a scoped account may edit only when the
  // backend says so (company targets are shared per-company + gated by the admin's canEditTarget
  // checkbox; zonal accounts can always edit their own). `editable` comes from getScopedTarget.
  const canEditTarget = scoped ? !!(companyTarget && companyTarget.editable) : isAdmin;
  const [data, setData] = useState({
    summary: null,
    trend: null,
    companyTrend: null,
    products: null,
    customers: null,
    geo: null,
    salespersons: null,
    grades: null,
    zones: null,
    masters: null,
    groups: null,
    categories: null
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        summaryRes, trendRes, companyTrendRes, productsRes,
        customersRes, geoRes, spRes, gradeRes, zoneRes, masterRes, groupRes, categoryRes, filtersRes
      ] = await Promise.all([
        getDashboardSummary(filters),
        getRevenueTrend({ ...filters, groupBy: trendGroupBy }),
        getRevenueTrendByCompany({ ...filters, groupBy: trendGroupBy }),
        getTopProducts({ ...filters, limit: 10, sortBy: metric === 'revenue' ? 'totalAmount' : 'totalQty' }),
        getTopCustomers({ ...filters, limit: 20, sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty' }),
        getGeographic({ ...filters, groupBy: 'state', sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty' }),
        getSalespersonList({ ...filters, sortBy: metric === 'revenue' ? 'totalRevenue' : 'totalQty' }),
        getGradeBreakdown(filters),
        getZoneAnalysis(filters),
        getMasterBreakdown(filters),
        getGroupBreakdown(filters),
        getCategoryBreakdown({ ...filters, sortBy: metric === 'revenue' ? 'totalAmount' : 'totalQty' }),
        getFilters(filters)
      ]);

      setData({
        summary: summaryRes.data.data,
        trend: trendRes.data.data,
        companyTrend: companyTrendRes.data.data,
        products: productsRes.data.data,
        customers: customersRes.data.data,
        geo: geoRes.data.data,
        salespersons: spRes.data.data,
        grades: gradeRes.data.data,
        zones: zoneRes.data.data?.zones || [],
        masters: masterRes.data.data || [],
        groups: groupRes.data.data || [],
        categories: categoryRes.data.data || []
      });
      setFilterOptions(mergeFilterOptions(filtersRes.data.data));
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
      const reset = {
        startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
        colour: [], thickness: [], format: '', product: '', dimensions: '', group: [], group1: [], master: [], company: [], branch: []
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

  const fetchCompanyTarget = async () => {
    try {
      if (scoped && user.id) {
        // Scoped account: load its own target. Normalise to { amount, fiscalYear } where
        // amount is the ANNUAL figure so the card's achieved/target math is consistent.
        const res = await getScopedTarget(user.id);
        const d = res.data.data;
        setCompanyTargetState({ amount: d.annualTarget || 0, fiscalYear: d.fiscalYear, mode: d.mode, editable: !!d.editable });
      } else {
        const res = await getCompanyTarget();
        setCompanyTargetState(res.data.data);
      }
    } catch (err) {
      console.error('Target fetch error:', err);
    }
  };

  useEffect(() => { fetchCompanyTarget(); }, []);

  const openTargetModal = () => {
    if (scoped) {
      setTargetForm(companyTarget && companyTarget.amount ? String(companyTarget.amount) : '');
    } else {
      const ct = companyTarget?.companyTargets || {};
      setCompanyTargetForm({
        FDL: ct.FDL ? String(ct.FDL) : '',
        UCPL: ct.UCPL ? String(ct.UCPL) : '',
        'UFPL': ct['UFPL'] ? String(ct['UFPL']) : ''
      });
    }
    setShowTargetModal(true);
  };

  const saveCompanyTarget = async () => {
    try {
      setTargetSaving(true);
      if (scoped && user.id) {
        // Scoped accounts store a single annual target for themselves.
        const amt = Number(targetForm);
        if (!isFinite(amt) || amt < 0) return;
        await setScopedTarget(user.id, { amount: amt, mode: 'yearly' });
        await fetchCompanyTarget();
      } else {
        // Admin: three per-company targets; the overall target = their sum (computed server-side).
        const companyTargets = {
          FDL: Number(companyTargetForm.FDL) || 0,
          UCPL: Number(companyTargetForm.UCPL) || 0,
          'UFPL': Number(companyTargetForm['UFPL']) || 0
        };
        const res = await setCompanyTarget({ companyTargets });
        setCompanyTargetState(res.data.data);
      }
      setShowTargetModal(false);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to save target');
    } finally {
      setTargetSaving(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val || 0);
  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Quantity';
  // Single-bracket title suffix (Title Case brackets, client request 2026-07-27): metric + tax
  // basis merged into ONE parenthetical, e.g. " (Revenue Excl. Taxes)" / " (Quantity)".
  const titleTag = metric === 'revenue' ? ' (Revenue Excl. Taxes)' : ' (Quantity)';
  // The Master/Category pies carry their own incl/excl toggle → basis-aware suffix.
  const basisTag = (basis) => metric === 'revenue' ? ` (Revenue ${basis === 'incl' ? 'Incl.' : 'Excl.'} Taxes)` : ' (Quantity)';
  // Small incl/excl tax-basis toggle rendered in those two pies' headers (revenue mode only).
  const BasisToggle = ({ basis, setBasis }) => metric !== 'revenue' ? null : (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[['excl', 'Excl. Taxes'], ['incl', 'Incl. Taxes']].map(([b, label]) => (
        <button
          key={b}
          onClick={() => setBasis(b)}
          style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: basis === b ? 'var(--primary-600)' : 'var(--bg-card)', color: basis === b ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
        >
          {label}
        </button>
      ))}
    </div>
  );
  // Metric-aware Indian-notation formatters for chart axes/tooltips.
  const axisFmt = (v) => metric === 'revenue' ? formatINRShort(v) : formatShort(v);
  const metricScale = { ticks: { callback: v => axisFmt(v) } };
  // Force every category label to render (no auto-skip) so narrow/mobile widths
  // don't hide states/zones; Chart.js only rotates steeper when it needs to.
  const categoryScale = { ticks: { autoSkip: false, maxRotation: 90, minRotation: 0, font: { size: 11 } } };
  const metricTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${metric === 'revenue' ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}` } };

  // Chart Configs
  // Revenue mode shows TWO lines — Excl. Taxes (assessable) + Incl. Taxes (billed) — so the
  // main dashboard trend exposes both; Quantity mode is a single line.
  const trendChartData = {
    labels: data.trend?.map(d => d._id) || [],
    datasets: metric === 'revenue'
      ? [
          {
            label: 'Excl. Taxes',
            data: data.trend?.map(d => d.revenueExcl) || [],
            borderColor: 'var(--primary-500)',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Incl. Taxes',
            data: data.trend?.map(d => d.revenue) || [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            borderDash: [6, 4]
          }
        ]
      : [{
          label: 'Quantity',
          data: data.trend?.map(d => d.qty) || [],
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

  // Revenue-by-Zone bar (segregated-format data only; zone is not on legacy records).
  const zoneChartData = {
    labels: data.zones?.map(z => z._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.zones?.map(z => metric === 'revenue' ? z.totalRevenue : z.totalQty) || [],
      backgroundColor: ACCENTS.zone,
      borderRadius: 4
    }]
  };

  // Company-wise revenue trend (3 lines: FDL, UCPL, UFPL) — always revenue EXCL taxes.
  const COMPANY_COLORS = { 'FDL': '#10b981', 'UCPL': '#f59e0b', 'UFPL': '#ec4899' };
  const companyTrendChartData = {
    labels: data.companyTrend?.periods || [],
    datasets: [
      // The 3 company lines (Total line removed per client request 2026-07-28).
      ...Object.entries(data.companyTrend?.series || {}).map(([name, arr]) => ({
        label: name,
        data: arr,
        borderColor: COMPANY_COLORS[name] || '#8b5cf6',
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        order: 1
      }))
    ]
  };

  // Grade-wise revenue distribution (segregated format). Click a legend entry to
  // toggle that grade off the pie (native Chart.js legend behaviour).
  // Master-wise distribution (ACP / PVC-WPC / SOFFIT …) — the headline product pie.
  const MASTER_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
  const masterChartData = {
    labels: data.masters?.map(m => m._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.masters?.map(m => metric === 'revenue' ? (masterBasis === 'incl' ? m.totalAmountIncl : m.totalAmount) : m.totalQty) || [],
      backgroundColor: pieColors('master', (data.masters || []).length),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  // Category-wise distribution (internal field `group`: FB / FM / FN / Base …) — cloned from the Products page (no drill).
  const GROUP_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];
  const groupChartData = {
    labels: data.groups?.map(g => g._id) || [],
    datasets: [{
      label: metricLabel,
      data: data.groups?.map(g => metric === 'revenue' ? (groupBasis === 'incl' ? g.totalAmountIncl : g.totalAmount) : g.totalQty) || [],
      backgroundColor: pieColors('pastel', (data.groups || []).length),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  // Shared pie tooltip (respects legend-toggle for the % denominator).
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

  // Sub-Category doughnut (field `category` / Categry) — BLUE palette, cloned from the
  // Products page's "Sub-categories in" donut (same data source + colour scheme).
  const catChartData = {
    labels: data.categories?.map(d => d._id || 'Unknown') || [],
    datasets: [{
      label: metricLabel,
      data: data.categories?.map(d => metric === 'revenue' ? d.totalAmount : d.totalQty) || [],
      backgroundColor: pieColors('subcategory', (data.categories || []).length),
      borderWidth: 0
    }]
  };

  // ── Company revenue split (FDL / UCPL / UFPL) — summed from the company-trend series,
  // so both the target bar and the revenue-split bar respect the active filters. ──
  const COMPANY_ORDER = ['FDL', 'UCPL', 'UFPL'];
  const companySegments = (() => {
    const s = data.companyTrend?.series || {};
    const named = COMPANY_ORDER
      .map(label => ({ label, value: (s[label] || []).reduce((a, b) => a + b, 0), color: COMPANY_COLORS[label] }))
      .filter(seg => seg.value > 0);
    // Reconcile the split with the headline Total Revenue (Excl. Taxes). Company lives only on
    // line items, so any assessable value on invoices WITHOUT company-tagged line items (or under
    // a blank/unmapped company) isn't in the named series. Surface that remainder as an "Other"
    // segment so the split total equals the revenue card instead of coming up short.
    const headline = data.summary?.totalRevenueExclTax || 0;
    const namedSum = named.reduce((a, seg) => a + seg.value, 0);
    const other = headline - namedSum;
    if (other > 1) named.push({ label: 'Other', value: other, color: '#94a3b8' });
    return named;
  })();
  const companySplitTotal = companySegments.reduce((a, seg) => a + seg.value, 0);
  // Achieved revenue per company (for the per-company target table). Includes 0s so all 3 rows show.
  const companyAchievedMap = (() => {
    const s = data.companyTrend?.series || {};
    return Object.fromEntries(COMPANY_ORDER.map(label => [label, (s[label] || []).reduce((a, b) => a + b, 0)]));
  })();

  // Segmented horizontal bar (macOS-storage style). `denom` sets the full-scale width; when
  // `showInside` the wide-enough segments print their % share; every segment has a hover title.
  const CompanyBar = ({ segments, denom, showInside, height = 22 }) => (
    <div style={{ display: 'flex', width: '100%', height: `${height}px`, borderRadius: '6px', overflow: 'hidden', background: 'var(--bg-light, #eef2f7)' }}>
      {segments.map(seg => {
        const w = denom > 0 ? Math.min((seg.value / denom) * 100, 100) : 0;
        const share = companySplitTotal > 0 ? (seg.value / companySplitTotal) * 100 : 0;
        if (w <= 0) return null;
        return (
          <div
            key={seg.label}
            title={`${seg.label}: ${formatCurrency(seg.value)} (${share.toFixed(1)}% of company revenue)`}
            style={{ width: `${w}%`, background: seg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}
          >
            {showInside && w > 7 ? `${share.toFixed(0)}%` : ''}
          </div>
        );
      })}
    </div>
  );

  const CompanyLegend = ({ showAmount = false }) => (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
      {companySegments.map(seg => (
        <span key={seg.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: seg.color }} />
          {seg.label}{showAmount ? <strong style={{ color: 'var(--text-primary)', marginLeft: '2px' }}>{formatCurrency(seg.value)}</strong> : ''}
        </span>
      ))}
    </div>
  );

  const GRADE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
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
          {(() => {
            const target = companyTarget?.amount || 0;
            // Target is compared against the assessable (Excl. Taxes) revenue (client request).
            const achieved = data.summary.totalRevenueExclTax || 0;
            const pct = target > 0 ? (achieved / target) * 100 : 0;
            // Day-by-day pace ("Rate" column): daily target = annual target / 365; expected-by-today
            // = daily × days since 1 AUGUST (inclusive). Anchored to Aug (the data start) rather than
            // the FY's April for now, since the branches only began sending data in Aug — from April
            // everyone reads ~90% behind. Rate = how far achieved is ahead/behind that pace.
            const fyStartYear = companyTarget?.fiscalYear ? parseInt(String(companyTarget.fiscalYear).split('-')[0], 10) : new Date().getFullYear();
            const daysElapsed = Math.min(365, Math.max(1, Math.floor((Date.now() - new Date(fyStartYear, 7, 1).getTime()) / 86400000) + 1));
            // Per-company target rows. Admin sees all 3 daughter companies (from companyTargets + the
            // company-trend achieved map). A COMPANY-scoped account sees a single row for its own
            // company — target = its shared per-company target, achieved = its (already-scoped)
            // revenue — so it gets the same Target · Achieved · % · Rate table.
            const scopedCompanyName = (Array.isArray(user.companies) && user.companies.length === 1)
              ? user.companies[0] : (user.company || companySegments[0]?.label || 'My Company');
            const perCompany = companyScoped
              ? [{ name: scopedCompanyName, tgt: target, ach: achieved, p: target > 0 ? (achieved / target) * 100 : 0, color: COMPANY_COLORS[scopedCompanyName] || '#ec4899' }]
              : COMPANY_ORDER.map(name => {
                  const tgt = (companyTarget?.companyTargets?.[name]) || 0;
                  const ach = companyAchievedMap[name] || 0;
                  return { name, tgt, ach, p: tgt > 0 ? (ach / tgt) * 100 : 0, color: COMPANY_COLORS[name] };
                });
            const hasCompanyTargets = perCompany.some(r => r.tgt > 0);
            return (
              <div className="kpi-card" style={{ gridColumn: 'span 2', gridRow: 'span 2', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div className="kpi-label">
                    {scoped ? 'My Target (Excl. Taxes)' : 'Target Turnover (Excl. Taxes)'}{companyTarget?.fiscalYear ? ` (FY ${companyTarget.fiscalYear})` : ''}
                  </div>
                  {canEditTarget && (
                    <button
                      onClick={openTargetModal}
                      title="Set target"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--primary-600)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {target > 0 ? 'Edit' : 'Set'}
                    </button>
                  )}
                </div>
                <div className="kpi-value">{target > 0 ? formatCurrency(target) : '—'}</div>
                <div style={{ marginTop: '10px' }}>
                  {/* Segmented bar — % of target achieved, split by daughter company (hover for
                      detail). Falls back to a single fill if the company split is unavailable. */}
                  {target > 0 && companySegments.length > 0 ? (
                    <>
                      <CompanyBar segments={companySegments} denom={target} showInside={false} height={10} />
                      <CompanyLegend />
                    </>
                  ) : (
                    <div style={{ height: '8px', borderRadius: '6px', background: 'var(--bg-light, #eef2f7)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? 'var(--success)' : 'var(--primary-500)', borderRadius: '6px', transition: 'width 0.4s ease' }} />
                    </div>
                  )}
                  <div className="kpi-sub" style={{ marginTop: '6px', color: 'var(--text-primary)', fontWeight: 700 }}>
                    {target > 0
                      ? `${formatCurrency(achieved)} achieved · ${Math.round(pct)}%`
                      : (canEditTarget ? 'Set a target to track achievement' : 'No target set')}
                  </div>
                </div>

                {/* Per-company targets table — admin (all 3 companies) + company-scoped accounts
                    (their own company). Zonal heads keep the simple single-target view. */}
                {(!scoped || companyScoped) && (
                  <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Per-Company Targets</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
                          <th style={{ textAlign: 'left', fontWeight: 600, padding: '4px 6px' }}>Company</th>
                          <th style={{ fontWeight: 600, padding: '4px 6px' }}>Target</th>
                          <th style={{ fontWeight: 600, padding: '4px 6px' }}>Achieved</th>
                          <th style={{ fontWeight: 600, padding: '4px 6px' }}>%</th>
                          <th style={{ fontWeight: 600, padding: '4px 6px' }} title="Ahead of / behind the day-by-day pace (target ÷ 365 × days since 1 Aug)">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perCompany.map(r => (
                          <tr key={r.name} style={{ borderTop: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '5px 6px', fontWeight: 600 }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: r.color, marginRight: '6px' }} />{r.name}
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{r.tgt > 0 ? formatCurrency(r.tgt) : '—'}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatCurrency(r.ach)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: r.p >= 100 ? 'var(--success)' : 'var(--text-primary)' }}>{r.tgt > 0 ? `${Math.round(r.p)}%` : '—'}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>
                              {(() => {
                                const expected = r.tgt > 0 ? (r.tgt / 365) * daysElapsed : 0;
                                const rate = expected > 0 ? ((r.ach - expected) / expected) * 100 : null;
                                return rate === null ? '—' : (
                                  <span style={{ color: rate >= 0 ? 'var(--success)' : '#ef4444' }}>{rate >= 0 ? '▲' : '▼'} {Math.abs(Math.round(rate))}%</span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!hasCompanyTargets && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>Set per-company targets via Edit.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="kpi-card">
            <div className="kpi-label">Total Revenue (Excl. Taxes)</div>
            <div className="kpi-value">{formatCurrency(data.summary.totalRevenueExclTax)}</div>
            <div className="kpi-sub">Assessable value</div>
          </div>
          {/* "Oth Amt" on the Kuber sales register — freight charges less discounts, both applied
              to the assessable value BEFORE tax. Split into the net (2×1) plus each half (1×1). */}
          <div className="kpi-card" style={{ gridColumn: 'span 2' }}>
            <div className="kpi-label">Discount / Freight (Net)</div>
            <div
              className="kpi-value"
              style={{ color: (data.summary.otherAmount || 0) < 0 ? 'var(--danger)' : undefined }}
            >
              {formatCurrency(data.summary.otherAmount)}
            </div>
            <div className="kpi-sub">Other amount · freight less discount (excl. taxes)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Discount</div>
            {/* Always shown as a deduction, hence the forced negative sign. */}
            <div className="kpi-value" style={{ color: 'var(--danger)' }}>
              {formatCurrency(-Math.abs(data.summary.discountAmount || 0))}
            </div>
            <div className="kpi-sub">Deducted before taxes</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Freight</div>
            <div className="kpi-value">{formatCurrency(Math.abs(data.summary.freightAmount || 0))}</div>
            <div className="kpi-sub">Added before taxes</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Revenue (Incl. Taxes)</div>
            <div className="kpi-value">{formatCurrency(data.summary.totalRevenue)}</div>
            <div className="kpi-sub">Bill amount</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Quantity Sold</div>
            <div className="kpi-value">{formatNumber(data.summary.totalQty)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Top State by Revenue (Excl. Taxes)</div>
            <div className="kpi-value" style={{ fontSize: '1.25rem' }}>{data.summary.topState || 'N/A'}</div>
            <div className="kpi-sub">{formatCurrency(data.summary.topStateRevenue)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Top Zone by Revenue (Excl. Taxes)</div>
            <div className="kpi-value" style={{ fontSize: '1.25rem' }}>{data.summary.topZone || 'N/A'}</div>
            <div className="kpi-sub">{formatCurrency(data.summary.topZoneRevenue)}</div>
          </div>
        </div>
      )}

      {showTargetModal && (
        <div
          onClick={() => setShowTargetModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '24px', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-md, 0 10px 30px rgba(0,0,0,0.2))' }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px' }}>
              {scoped ? 'Set My Target' : 'Set Company Targets'}{companyTarget?.fiscalYear ? ` — FY ${companyTarget.fiscalYear}` : ''}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              {scoped
                ? 'Annual turnover target (Excl. Taxes) for the current fiscal year (April–March).'
                : 'Set a target per daughter company (Excl. Taxes). The overall Target Turnover is the sum of the three.'}
            </p>
            {scoped ? (
              <TargetAmountInput
                value={targetForm}
                onChange={setTargetForm}
                presets={TURNOVER_TARGET_PRESETS}
                label="Target amount (₹)"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '4px' }}>
                {['FDL', 'UCPL', 'UFPL'].map(name => (
                  <TargetAmountInput
                    key={name}
                    value={companyTargetForm[name]}
                    onChange={(v) => setCompanyTargetForm(f => ({ ...f, [name]: v }))}
                    presets={TURNOVER_TARGET_PRESETS}
                    label={`${name} target (₹)`}
                  />
                ))}
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Total target: {formatCurrency((Number(companyTargetForm.FDL) || 0) + (Number(companyTargetForm.UCPL) || 0) + (Number(companyTargetForm['UFPL']) || 0))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button
                onClick={() => setShowTargetModal(false)}
                style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={saveCompanyTarget}
                disabled={targetSaving || (scoped && targetForm === '')}
                style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--primary-600)', color: '#fff', cursor: targetSaving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (targetSaving || (scoped && targetForm === '')) ? 0.6 : 1 }}
              >
                {targetSaving ? 'Saving…' : 'Save Target'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Company revenue-split bar (TEST) — segmented like macOS storage; shows each daughter
          company's share of total revenue. % printed inside each segment; amounts in the legend;
          hover for the rupee figure. Sits directly below the KPI cards. */}
      {!companyScoped && companySegments.length > 0 && (
        <div className="chart-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Revenue Split by Company (Revenue Excl. Taxes)</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatCurrency(companySplitTotal)} total</span>
          </div>
          <CompanyBar segments={companySegments} denom={companySplitTotal} showInside={true} height={30} />
          <CompanyLegend showAmount={true} />
        </div>
      )}

      <div className="charts-grid">
        {/* ── Grid layout (2 columns): Row 1 = Revenue Trend (full width). Then, row-major:
            Top Products | Master-wise · Category-wise | Grade-wise · Salesperson | By State ·
            By Zone | (empty). Top Customers table spans full width beneath. ── */}

        {/* (Row 1) Revenue Trend — full width. In Revenue mode shows TWO lines (Excl. + Incl.). */}
        {loading && !data.trend ? (
          <ChartSkeleton fullWidth />
        ) : (
          <ChartCard
            title={`${metric === 'revenue' ? 'Revenue' : 'Quantity'} Trend`}
            aiContext={data.trend}
            aiType="Revenue Trend Data"
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
              data={trendChartData}
              plugins={[averageLinePlugin]}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  // Two lines in revenue mode → skip the single-dataset average line (misleading);
                  // keep it for the single Quantity line.
                  averageLine: metric === 'revenue' ? false : { formatter: (v) => formatNumber(Math.round(v)) },
                  legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
                  tooltip: metricTooltip
                },
                scales: { y: metricScale }
              }}
            />
          </ChartCard>
        )}

        {/* (Row 2, full width) Company-wise Revenue Trend — a duplicate of the main trend with
            3 lines (FDL / UCPL / UFPL combined). Always revenue Excl. Taxes, for comparison.
            Hidden for company-scoped IDs (single-company → nothing to compare). */}
        {companyScoped ? null : loading && !data.companyTrend ? (
          <ChartSkeleton fullWidth />
        ) : (data.companyTrend?.periods?.length > 0) ? (
          <ChartCard
            title="Revenue by Company (Revenue Excl. Taxes)"
            aiContext={data.companyTrend}
            aiType="Company-wise Revenue Trend (FDL / UCPL / UFPL)"
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
              data={companyTrendChartData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
                  percentBar: false,
                  tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } }
                },
                scales: { y: { ticks: { callback: v => formatINRShort(v) } } }
              }}
            />
          </ChartCard>
        ) : null}

        {/* (1,2) Master-wise pie — incl/excl tax-basis toggle (TEST). (Swapped ahead of Top Products.) */}
        {loading && !data.masters ? (
          <ChartSkeleton />
        ) : (data.masters && data.masters.length > 0) ? (
          <ChartCard
            title={`Master-wise${basisTag(masterBasis)}`}
            aiContext={data.masters}
            aiType="Master-wise Distribution"
            extra={<BasisToggle basis={masterBasis} setBasis={setMasterBasis} />}
          >
            <Pie
              data={masterChartData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
                  tooltip: piePctTooltip
                }
              }}
            />
          </ChartCard>
        ) : null}

        {/* (2,2) Top Products */}
        {loading && !data.products ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`Top Products${titleTag}`} aiContext={data.products} aiType="Top Products Comparison">
            <Bar
              data={productsChartData}
              plugins={[averageLinePlugin]}
              options={{
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                  legend: { display: false },
                  averageLine: { formatter: (v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(Math.round(v)) },
                  tooltip: metricTooltip
                },
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

        {/* Salesperson donut */}
        {loading && !data.salespersons ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`Salesperson${titleTag}`} aiContext={data.salespersons} aiType="Salesperson Performance">
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

        {/* Sub-Category doughnut (field `category` / Categry) — BLUE palette, cloned from the
            Products page's "Sub-categories in" donut. */}
        {loading && !data.categories ? (
          <ChartSkeleton />
        ) : (data.categories && data.categories.length > 0) ? (
          <ChartCard title={`Sub-Category-wise${titleTag}`} aiContext={data.categories} aiType="Sub-Category Distribution">
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
        ) : null}

        {/* (1,3) Category-wise pie (internal field `group`, TYpe1) — incl/excl toggle (TEST). */}
        {loading && !data.groups ? (
          <ChartSkeleton />
        ) : (data.groups && data.groups.length > 0) ? (
          <ChartCard
            title={`Category-wise${basisTag(groupBasis)}`}
            aiContext={data.groups}
            aiType="Category-wise Distribution"
            extra={<BasisToggle basis={groupBasis} setBasis={setGroupBasis} />}
          >
            <Pie
              data={groupChartData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
                  tooltip: piePctTooltip
                }
              }}
            />
          </ChartCard>
        ) : null}

        {/* (2,3) Grade-wise pie */}
        {loading && !data.grades ? (
          <ChartSkeleton />
        ) : (data.grades && data.grades.length > 0) ? (
          <ChartCard
            title={`Grade-wise Distribution${titleTag}`}
            aiContext={data.grades}
            aiType="Grade-wise Revenue Distribution"
            extra={<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click a grade to toggle</span>}
          >
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

        {loading && !data.geo ? (
          <ChartSkeleton />
        ) : (
          <ChartCard title={`By State${titleTag}`} aiContext={data.geo} aiType="Geographic Breakdown">
            {/* Horizontal scroll with a FROZEN y-axis so the bars stay readable when scrolled. */}
            <ScrollColumnChart
              labels={data.geo?.map(d => d._id) || []}
              values={data.geo?.map(d => metric === 'revenue' ? d.totalRevenue : d.totalQty) || []}
              label={metricLabel}
              color="#f59e0b"
              yFmt={axisFmt}
              valueFmt={(v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(v)}
              avgFmt={(v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(Math.round(v))}
            />
          </ChartCard>
        )}

        {loading && !data.zones ? (
          <ChartSkeleton />
        ) : (data.zones && data.zones.length > 0) ? (
          <ChartCard title={`By Zone${titleTag}`} aiContext={data.zones} aiType="Zone-wise Revenue">
            <Bar
              data={zoneChartData}
              plugins={[averageLinePlugin]}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  averageLine: { formatter: (v) => metric === 'revenue' ? formatCurrency(v) : formatNumber(Math.round(v)) },
                  tooltip: metricTooltip
                },
                scales: { y: metricScale, x: categoryScale }
              }}
            />
          </ChartCard>
        ) : null}

        {loading && !data.customers ? (
          <TableSkeleton />
        ) : (
          <div className="data-table-wrapper" style={{ gridColumn: '1 / -1' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Top Customers</h3>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {/* Fixed layout + colgroup widths so the extra Zone / dual-revenue columns fit
                  the card width without a horizontal scrollbar; long text ellipsises. */}
              <table className="data-table" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '22%' }} />{/* Customer */}
                  <col style={{ width: '11%' }} />{/* City */}
                  <col style={{ width: '12%' }} />{/* State */}
                  <col style={{ width: '9%' }} />{/* Zone */}
                  <col style={{ width: '14%' }} />{/* Salesperson */}
                  <col style={{ width: '7%' }} />{/* Orders */}
                  <col style={{ width: '13%' }} />{/* Revenue excl */}
                  <col style={{ width: '12%' }} />{/* Revenue incl */}
                </colgroup>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                  <tr>
                    <th>Customer Name</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Zone</th>
                    <th>Salesperson</th>
                    <th>Orders</th>
                    <th>{th('Revenue (Excl. Taxes)')}</th>
                    <th>{th('Revenue (Incl. Taxes)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers?.map((cust, i) => {
                    const cellClip = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, ...cellClip }} title={cust._id}>{cust._id}</td>
                        <td style={cellClip} title={cust.city}>{cust.city}</td>
                        <td style={cellClip} title={cust.state}>{cust.state}</td>
                        <td style={cellClip} title={cust.zone}>{cust.zone || '—'}</td>
                        <td style={cellClip} title={cust.salesperson}>{cust.salesperson}</td>
                        <td>{cust.totalOrders}</td>
                        <td style={{ fontWeight: 600, ...cellClip }}>{formatCurrency(cust.totalRevenue)}</td>
                        <td style={{ fontWeight: 600, ...cellClip }}>{formatCurrency(cust.totalRevenueIncl)}</td>
                      </tr>
                    );
                  })}
                  {(!data.customers || data.customers.length === 0) && (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>No customer data available</td></tr>
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
