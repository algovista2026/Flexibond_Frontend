import React from 'react';
import { Bar } from 'react-chartjs-2';
import { averageLinePlugin } from '../utils/averageLinePlugin';

/**
 * Vertical column chart that scrolls HORIZONTALLY while keeping the Y-axis FROZEN on the left
 * (client request 2026-07-29 — a scrolled chart used to carry its axis off-screen).
 *
 * Layout: a strict 2-column CSS grid — `[axisWidth] [1fr]`. The grid track width is enforced
 * (unlike flex-basis, which was being overridden), so the axis stays a thin fixed strip.
 *   • Left cell  = the Y-axis only (bars + X labels transparent).
 *   • Right cell = the bars (Y-axis hidden), inside a horizontally-scrolling track.
 * Both charts share the SAME Y-scale (identical `suggestedMax` + `beginAtZero`), the SAME top
 * padding, and the SAME X-axis label geometry (fixed 90° rotation, identical labels) so the two
 * plot areas are the same height and the frozen ticks line up with the scrolling bars.
 *
 * Fills its parent (expects a `position:relative` box, e.g. a ChartCard body).
 */
const ScrollColumnChart = ({
  labels = [],
  values = [],
  label = '',
  color = '#8b5cf6',
  yFmt = (v) => v,
  valueFmt = (v) => v,
  avgFmt = null,          // when set, draws the dashed average line on the scrollable chart
  barWidth = 46,
  axisWidth = 80,
  topPad = 22
}) => {
  const maxV = values.length ? Math.max(...values) : 0;
  const yScale = { beginAtZero: true, suggestedMax: maxV > 0 ? maxV * 1.12 : 1 };
  // Fixed 90° rotation on BOTH charts so each reserves identical bottom space for labels.
  const xTicks = (visible) => ({
    autoSkip: false,
    maxRotation: 90,
    minRotation: 90,
    font: { size: 10 },
    ...(visible ? {} : { color: 'rgba(0,0,0,0)' })
  });

  // Axis-only chart (left strip): show Y ticks; bars + X labels transparent.
  const axisData = { labels, datasets: [{ label, data: values, backgroundColor: 'transparent', borderColor: 'transparent' }] };
  const axisOptions = {
    maintainAspectRatio: false,
    layout: { padding: { top: topPad } },
    plugins: { legend: { display: false }, tooltip: { enabled: false }, percentBar: false, averageLine: false },
    scales: {
      y: {
        ...yScale,
        // Force the y-axis to occupy (almost) the whole strip so tick labels never clip on the
        // left edge — the empty plot area to its right shrinks to a few px (invisible).
        afterFit: (scale) => { scale.width = axisWidth - 6; },
        ticks: { callback: (v) => yFmt(v), font: { size: 11 }, padding: 4 }
      },
      x: { grid: { display: false, drawTicks: false }, ticks: xTicks(false) }
    }
  };

  const barData = { labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 4 }] };
  const barOptions = {
    maintainAspectRatio: false,
    layout: { padding: { top: topPad } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${valueFmt(ctx.raw)}` } },
      ...(avgFmt ? { averageLine: { formatter: avgFmt } } : { averageLine: false })
    },
    scales: {
      y: { ...yScale, display: false },
      x: { grid: { drawTicks: true }, ticks: xTicks(true) }
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `${axisWidth}px minmax(0, 1fr)` }}>
      <div style={{ overflow: 'hidden', height: '100%' }}>
        <Bar data={axisData} options={axisOptions} />
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'hidden', height: '100%' }}>
        <div style={{ height: '100%', minWidth: `${Math.max(labels.length * barWidth, 100)}px` }}>
          <Bar data={barData} options={barOptions} plugins={avgFmt ? [averageLinePlugin] : []} />
        </div>
      </div>
    </div>
  );
};

export default ScrollColumnChart;
