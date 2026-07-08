/**
 * Chart.js plugin that draws a horizontal dashed "target" line across a trend chart,
 * with a label, at a given y-value. Used for the Salesperson Target Achievement tracker.
 *
 * Enable per-chart via options.plugins.targetLine, e.g.:
 *   options={{
 *     plugins: {
 *       targetLine: { value: 500000, label: 'Monthly Target', formatter: (v) => `₹${v}` }
 *     }
 *   }}
 * and pass the plugin to the chart: <Line plugins={[targetLinePlugin]} ... />
 *
 * If options.plugins.targetLine is absent/false or value is not a positive number,
 * the plugin does nothing.
 */
export const targetLinePlugin = {
  id: 'targetLine',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || typeof opts.value !== 'number' || !isFinite(opts.value) || opts.value <= 0) return;

    const { ctx, chartArea, scales } = chart;
    if (!scales.y) return;

    const y = scales.y.getPixelForValue(opts.value);
    if (y < chartArea.top || y > chartArea.bottom) return; // target off the visible scale

    const color = opts.color || '#16a34a';

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([8, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();

    const base = opts.label || 'Target';
    const text = `${base}: ${opts.formatter ? opts.formatter(opts.value) : Math.round(opts.value).toLocaleString('en-IN')}`;
    ctx.setLineDash([]);
    ctx.font = '600 11px sans-serif';
    ctx.fillStyle = color;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(text, chartArea.left + 6, Math.max(y - 4, chartArea.top + 12));
    ctx.restore();
  }
};

export default targetLinePlugin;
