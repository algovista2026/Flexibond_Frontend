import React from 'react';

/**
 * Side legend for a donut chart: colour dot + label on the left, % share on the right, one row each.
 *
 * Extracted 2026-08-23. The Dashboard and Branch salesperson donuts each hand-rolled this markup and
 * had drifted: Branch wrapped its dot and label in two SEPARATE spans instead of one `.legend-label`
 * wrapper, so the `.legend-item { justify-content: space-between }` rule pushed the name to the far
 * RIGHT edge, and it omitted the % entirely. It also added its own `marginBottom` on top of
 * `.custom-legend`'s `gap: 10px`, which overflowed the 250px max-height and produced a scrollbar that
 * clipped the last entry. Both charts now render from here so they cannot diverge again.
 *
 * Pass the chart's OWN data/colours so the legend always matches the slices:
 *   <DonutLegend labels={d.labels} values={d.datasets[0].data} colors={d.datasets[0].backgroundColor} />
 */
const DonutLegend = ({ labels = [], values = [], colors = [] }) => {
  const total = values.reduce((a, b) => a + (Number(b) || 0), 0);
  const palette = Array.isArray(colors) ? colors : [colors];

  return (
    <div className="custom-legend">
      {labels.map((label, i) => {
        const val = Number(values[i]) || 0;
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
        return (
          <div key={`${label}-${i}`} className="legend-item">
            {/* One wrapper for dot+label is what makes space-between put the % on the right. */}
            <div className="legend-label">
              <div className="legend-dot" style={{ background: palette[i % palette.length] }} />
              <span
                title={label}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >{label}</span>
            </div>
            <span className="legend-percentage">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
};

export default DonutLegend;
