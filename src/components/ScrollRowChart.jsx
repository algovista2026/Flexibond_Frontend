import React from 'react';
import { Bar } from 'react-chartjs-2';

/**
 * Horizontal (row) bar chart that FILLS its card — the value axis sits at the bottom and its
 * gridlines run the full height of the card.
 *
 * History: this used to be two stacked canvases (a vertically-scrolling bars chart + a "frozen"
 * axis-only chart pinned at the bottom). That produced three problems the client flagged
 * (2026-08-18):
 *   • the gridlines VANISHED in the middle of the card — the scrolling chart's gridlines stopped at
 *     its own (short) inner height and the frozen axis drew its own stubs 80px lower, leaving a
 *     blank band between them, glaring on charts with only 3-4 rows;
 *   • the scroll boundary cut the top/bottom row in HALF, so bars appeared to start out of a
 *     hidden border while scrolling;
 *   • the left label gutter was FORCED to a fixed 92px (needed to keep the two canvases aligned),
 *     wasting a big strip of the card on short labels like "101" / "1220 x 2440".
 *
 * One canvas fixes all three: continuous gridlines, no clipped rows, and the category scale sizes
 * itself to the longest label so the plot starts as far left as it can. Rows share the available
 * height, and `barHeight` now caps the bar THICKNESS so a 3-row chart draws normal bars instead of
 * three fat slabs.
 *
 * Fills its parent (expects a position:relative box, e.g. a ChartCard body).
 */
const ScrollRowChart = ({
  labels = [],
  values = [],
  label = '',
  color = '#f97316',
  valueFmt = (v) => v,   // tooltip formatter
  xFmt = (v) => v,       // value-axis tick formatter
  barHeight = 30,        // MAX bar thickness (rows are spaced by the available height)
  maxRows = 15,          // render guard — see below
}) => {
  // Render guard: one dashboard cell can only show ~15 readable rows. Callers already cap their
  // breakdowns server-side (top 15 by revenue), but the DB has 420 colours / 93 dimensions, so an
  // uncapped list slipping through would draw a stack of unreadable hairlines. Values arrive sorted
  // descending everywhere this is used, so slicing keeps the top rows.
  const rows = Math.min(labels.length, maxRows);
  const cut = rows < labels.length;
  const shownLabels = cut ? labels.slice(0, rows) : labels;
  const shownValues = cut ? values.slice(0, rows) : values;

  // Long lists get a smaller category font so every row still keeps its label (autoSkip stays off).
  const tickFont = rows > 12 ? 9 : 10;

  const data = {
    labels: shownLabels,
    datasets: [{ label, data: shownValues, backgroundColor: color, borderRadius: 4, maxBarThickness: barHeight }],
  };

  const options = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    // Room on the right for the global percentBar % label so it isn't clipped by the card edge.
    layout: { padding: { right: 44, top: 2 } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${valueFmt(ctx.raw)}` } },
    },
    scales: {
      // No afterFit override — the scale fits the longest label, so no dead left gutter.
      y: { grid: { display: false }, ticks: { font: { size: tickFont }, autoSkip: false } },
      x: {
        position: 'bottom',
        beginAtZero: true,
        grid: { display: true, color: 'rgba(0,0,0,0.07)' },
        border: { display: false },
        ticks: { callback: (v) => xFmt(v), font: { size: 10 }, maxRotation: 45, minRotation: 30 },
      },
    },
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default ScrollRowChart;
