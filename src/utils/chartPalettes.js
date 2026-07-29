/**
 * Per-dimension chart colour palettes (approved 2026-07-27).
 *
 * Each analytics dimension gets its OWN colour family so pies for different dimensions no
 * longer look identical, and the SAME family is reused wherever that dimension is charted
 * (Dashboard / Products / Salesperson / Clients). Pie/doughnut charts cycle a multi-shade
 * `PALETTES[...]`; single-series bar charts use `ACCENTS[...]`.
 *
 *  master        → vibrant multi-hue (the headline product classification)
 *  subcategory   → BLUE family (field `category` / Categry — client's preferred palette; reserved)
 *  category      → emerald / teal (field `group` / TYpe1)
 *  grade         → warm amber → orange → red ramp
 *  variants      → pink / magenta (field `group1` / TYpe2)
 *  zone          → indigo family
 *  thickness     → purple bar (reserved) · colour → teal bar · dimension → orange bar
 */

export const PALETTES = {
  master: ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#84cc16', '#14b8a6'],
  // Sub-Category — BLUE (reserved, client favourite). This is the ORIGINAL smooth blue ramp
  // (blues → sky → indigo tints) the client preferred — no dark navy tones (2026-07-28).
  subcategory: [
    '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe',
    '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe',
    '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'
  ],
  // Category (group / TYpe1) — emerald / teal
  category: ['#064e3b', '#065f46', '#047857', '#059669', '#10b981', '#34d399', '#0d9488', '#14b8a6', '#2dd4bf', '#6ee7b7', '#5eead4', '#99f6e4'],
  // Grade — warm amber → orange → red
  grade: ['#78350f', '#92400e', '#b45309', '#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fde68a'],
  // Variants (group1 / TYpe2) — pink / magenta
  variants: ['#831843', '#9d174d', '#be185d', '#db2777', '#ec4899', '#f472b6', '#a21caf', '#c026d3', '#e879f9', '#d946ef', '#f0abfc', '#f5d0fe'],
  // Zone — indigo family
  zone: ['#312e81', '#3730a3', '#4338ca', '#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'],
  // Muted "Media.io" palette (client swatches 2026-07-29: #C59BBE mauve · #EAD7C9 beige ·
  // #B8C3B6 sage · #6A5B63 taupe) + nearby shades. Under trial on the Products grade/category
  // charts; may go global later.
  muted: ['#C59BBE', '#B8C3B6', '#EAD7C9', '#6A5B63', '#A98FB0', '#9DAF97', '#D8C4B0', '#8A7B83', '#D9B8D2', '#C7D2C0', '#EFE2D2', '#7A6E75'],
};

// Single-series bar accents (one colour per dimension).
export const ACCENTS = {
  thickness: '#8b5cf6', // purple (reserved)
  colour: '#14b8a6',    // teal
  dimension: '#f97316', // orange
  zone: '#6366f1',      // indigo
  product: '#3b82f6',   // blue
};

/**
 * Return `n` colours from a palette, cycling if there are more slices than shades.
 */
export const pieColors = (paletteKey, n) => {
  const pal = PALETTES[paletteKey] || PALETTES.master;
  return Array.from({ length: n }, (_, i) => pal[i % pal.length]);
};
