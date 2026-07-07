// Centralised Indian-numbering-system formatters.
// Digit grouping is 3,2,2 (e.g. 1,22,26,739) via the en-IN locale, and short
// forms use Crore / Lakh / Thousand — NEVER the American K/M/B or 1,000,000 style.

const inrFull = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const countFmt = new Intl.NumberFormat('en-IN');

// Full rupee value, e.g. ₹1,22,26,739
export const formatINR = (v) => inrFull.format(Number(v) || 0);

// Plain grouped integer, e.g. 1,22,26,739
export const formatCount = (v) => countFmt.format(Number(v) || 0);

// Compact Indian short form for chart axes / tight spaces.
// 1,22,26,739 -> ₹1.22 Cr ; 4,52,000 -> ₹4.52 L ; 96,274 -> ₹96.3 K ; 850 -> ₹850
export const formatINRShort = (v) => {
  const n = Number(v) || 0;
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(1)} K`;
  return `${sign}₹${Math.round(a)}`;
};

// Same as above but without the ₹ symbol (for plain-quantity axes).
export const formatShort = (v) => {
  const n = Number(v) || 0;
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign}${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}${(a / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)} K`;
  return `${sign}${Math.round(a)}`;
};

// Keys whose numeric values represent money (₹). Matched case-insensitively as substrings.
const CURRENCY_KEY_RE = /(revenue|amount|sales|value|tax|igst|cgst|sgst|gst|price|rate|turnover|billamount|total(?!orders|qty|customers|products|categories|colours|invoices|states|cities))/i;
// Keys that are explicitly counts (never money) even if they contain "total".
const COUNT_KEY_RE = /(count|orders|qty|quantity|customers|products|categories|colours|colors|invoices|states|cities|units|share|percent|pct)/i;

// Deep-clone a context object destined for the AI and attach a `<key>_display`
// string next to every numeric value, pre-formatted in Indian notation. The AI is
// instructed to quote these verbatim so it never does the crore/lakh math itself
// (which the model gets wrong — see routes/ai.js).
export const enrichForAI = (input) => {
  const walk = (val) => {
    if (Array.isArray(val)) return val.map(walk);
    if (val && typeof val === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = walk(v);
        if (typeof v === 'number' && Number.isFinite(v)) {
          const isCount = COUNT_KEY_RE.test(k) && !/revenue|amount|sales|tax|value/i.test(k);
          const isCurrency = !isCount && CURRENCY_KEY_RE.test(k);
          if (isCurrency) {
            out[`${k}_display`] = `${formatINR(v)} (${formatINRShort(v)})`;
          } else if (Math.abs(v) >= 1000) {
            out[`${k}_display`] = formatCount(v);
          }
        }
      }
      return out;
    }
    return val;
  };
  return walk(input);
};
