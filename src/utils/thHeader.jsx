import React from 'react';

/**
 * Render a table column header, breaking a trailing "(…)" clause onto its own second line for
 * a cleaner look (client request 2026-07-28):
 *   "Revenue (Excl. Taxes)"  →  Revenue
 *                                (Excl. Taxes)
 * Headers with no bracket are returned unchanged.
 */
export const th = (text) => {
  const str = String(text);
  const i = str.indexOf('(');
  if (i === -1) return text;
  const main = str.slice(0, i).trim();
  const bracket = str.slice(i).trim();
  return (
    <>
      {main}
      <span style={{ display: 'block', fontWeight: 'inherit', opacity: 0.85 }}>{bracket}</span>
    </>
  );
};
