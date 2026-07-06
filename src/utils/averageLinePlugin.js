/**
 * Reusable Chart.js plugin that draws a dashed "average" line across a bar chart
 * (the mean of the first dataset), with a small label.
 *
 * Works for both vertical bars (line is horizontal, at y = avg) and horizontal
 * bars (indexAxis: 'y' -> line is vertical, at x = avg).
 *
 * Enable per-chart via options.plugins.averageLine, e.g.:
 *   options={{
 *     plugins: {
 *       averageLine: { color: '#ef4444', formatter: (v) => `₹${v}` }
 *     }
 *   }}
 * and pass the plugin to the chart: <Bar plugins={[averageLinePlugin]} ... />
 *
 * If options.plugins.averageLine is absent/false, the plugin does nothing.
 */
export const averageLinePlugin = {
  id: 'averageLine',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts) return;

    const dataset = chart.data.datasets?.[0];
    const values = (dataset?.data || []).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const { ctx, chartArea, scales } = chart;
    const horizontal = chart.options.indexAxis === 'y';
    const color = opts.color || '#ef4444';

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;

    let labelX, labelY;
    if (horizontal) {
      const x = scales.x.getPixelForValue(avg);
      if (x < chartArea.left || x > chartArea.right) { ctx.restore(); return; }
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      labelX = Math.min(x + 6, chartArea.right - 4);
      labelY = chartArea.top + 12;
    } else {
      const y = scales.y.getPixelForValue(avg);
      if (y < chartArea.top || y > chartArea.bottom) { ctx.restore(); return; }
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      labelX = chartArea.right - 4;
      labelY = Math.max(y - 6, chartArea.top + 10);
    }
    ctx.stroke();

    // Label
    const text = `Avg: ${opts.formatter ? opts.formatter(avg) : Math.round(avg).toLocaleString('en-IN')}`;
    ctx.setLineDash([]);
    ctx.font = '600 11px sans-serif';
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = horizontal ? 'left' : 'right';
    ctx.fillText(text, labelX, labelY);
    ctx.restore();
  }
};

export default averageLinePlugin;
