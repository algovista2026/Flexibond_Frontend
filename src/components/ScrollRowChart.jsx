import React, { useRef, useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';

/**
 * Horizontal (row) bar chart that scrolls VERTICALLY while the value axis (x) stays FROZEN at the
 * bottom — so you can read the top bars' values without scrolling down (client request 2026-08-11).
 * The row-wise analog of ScrollColumnChart.
 *
 * Two stacked `indexAxis:'y'` Bar charts:
 *   • top cell (scrolls): the bars + their category labels (left, scroll together), value axis hidden
 *     but its GRIDLINES drawn; inner height grows with the row count.
 *   • bottom cell (fixed): an axis-only chart (bars + labels transparent) that draws the value ticks.
 * Both use the SAME explicit x-range [0, max] (not suggestedMax — that let each mini-chart auto-pick a
 * slightly different range, which produced phantom negative ticks + misalignment), the SAME forced
 * left label width, and the bottom axis is padded right by the scroll track's scrollbar width, so the
 * frozen ticks + gridlines line up with the scrolling bars.
 *
 * Fills its parent (expects a position:relative box, e.g. a ChartCard body).
 */
const ScrollRowChart = ({
  labels = [],
  values = [],
  label = '',
  color = '#f97316',
  valueFmt = (v) => v,   // tooltip formatter
  xFmt = (v) => v,       // frozen-axis tick formatter
  barHeight = 30,
  labelWidth = 92,
  axisHeight = 80, // room for the rotated ₹ tick labels so they aren't clipped
}) => {
  const scrollRef = useRef(null);
  const [sbw, setSbw] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) setSbw(Math.max(0, el.offsetWidth - el.clientWidth));
  }, [labels.length]);

  const maxV = values.length ? Math.max(...values) : 0;
  const niceMax = maxV > 0 ? maxV * 1.08 : 1;
  const xCommon = { type: 'linear', min: 0, max: niceMax }; // identical range on BOTH charts
  const grid = { display: true, color: 'rgba(0,0,0,0.07)' };
  const forceY = (s) => { s.width = labelWidth; };

  // Scrolling bars: category labels on y, value axis hidden (ticks off) but gridlines drawn.
  const barData = { labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 4 }] };
  const barOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    layout: { padding: { right: 12 } },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${valueFmt(ctx.raw)}` } } },
    scales: {
      y: { afterFit: forceY, grid: { display: false }, ticks: { font: { size: 10 }, autoSkip: false } },
      x: { ...xCommon, grid, border: { display: false }, ticks: { display: false } },
    },
  };

  // Frozen bottom axis: same x-range + same left width; bars + y-labels transparent; x ticks shown.
  const axisData = { labels, datasets: [{ label, data: values, backgroundColor: 'transparent', borderColor: 'transparent' }] };
  const axisOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    layout: { padding: { right: 12 + sbw } },
    plugins: { legend: { display: false }, tooltip: { enabled: false }, percentBar: false },
    scales: {
      y: { afterFit: forceY, grid: { display: false }, ticks: { display: false } },
      x: { ...xCommon, position: 'bottom', grid, ticks: { callback: (v) => xFmt(v), font: { size: 10 }, maxRotation: 45, minRotation: 30 } },
    },
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ height: `${Math.max(labels.length * barHeight, 120)}px` }}>
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
      <div style={{ height: `${axisHeight}px`, flexShrink: 0 }}>
        <Bar data={axisData} options={axisOptions} />
      </div>
    </div>
  );
};

export default ScrollRowChart;
