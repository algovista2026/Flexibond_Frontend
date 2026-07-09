/**
 * Global Chart.js plugin: labels each bar with its share (%) of its dataset's total.
 *
 * Registered globally (see main.jsx) so EVERY bar/column chart across the app shows the
 * percentage on each bar. It:
 *   - only acts on bar charts (skips line/pie/doughnut),
 *   - skips stacked bar charts (per-segment share is ambiguous there),
 *   - computes each bar's % as |value| / sum(|dataset values|) * 100,
 *   - can be disabled per-chart via options.plugins.percentBar = false.
 *
 * Works for vertical bars (label above the bar) and horizontal bars (label past the tip).
 */
export const percentBarPlugin = {
  id: 'percentBar',
  afterDatasetsDraw(chart, _args, opts) {
    if (opts === false) return;

    const type = chart.config?.type;
    if (type !== 'bar') return;

    // Skip stacked charts — a bar's share of the whole isn't meaningful per segment.
    if (chart.options?.scales?.x?.stacked || chart.options?.scales?.y?.stacked) return;

    const horizontal = chart.options.indexAxis === 'y';
    const { ctx, chartArea } = chart;

    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden || meta.type === 'line') return;

      const vals = (ds.data || []).map(v => (typeof v === 'number' && isFinite(v)) ? v : 0);
      const total = vals.reduce((a, b) => a + Math.abs(b), 0);
      if (total <= 0) return;

      ctx.save();
      ctx.font = '600 10px sans-serif';
      ctx.fillStyle = '#475569';

      meta.data.forEach((el, i) => {
        const v = vals[i];
        if (!v) return;
        const pct = (Math.abs(v) / total) * 100;
        const text = pct >= 10 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;

        if (horizontal) {
          ctx.textBaseline = 'middle';
          const w = ctx.measureText(text).width;
          let x = el.x + 6;
          ctx.textAlign = 'left';
          if (x + w > chartArea.right) { x = el.x - 6; ctx.textAlign = 'right'; } // flip inside
          ctx.fillText(text, x, el.y);
        } else {
          ctx.textAlign = 'center';
          let y = el.y - 4;
          ctx.textBaseline = 'bottom';
          if (y < chartArea.top + 10) { y = el.y + 4; ctx.textBaseline = 'top'; } // flip below cap
          ctx.fillText(text, el.x, y);
        }
      });

      ctx.restore();
    });
  }
};

export default percentBarPlugin;
