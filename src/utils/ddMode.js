// Global "DD" view — ⚠️ REWIRED 2026-09-09: this is the DEPOT-BRANCH mode.
//
// The firm sells twice over:
//   LEVEL 1  company → distributor client. Salesperson `DISTRIBUTOR`, ₹3.37 Cr. **Ordinary
//            revenue** — in every tier's figures and in the Salesperson dropdown like any other
//            salesman. Nothing filters it. (Until 2026-09-09 this button filtered exactly that,
//            excluding it by default for EVERYONE — the bug this rewiring fixes.)
//   LEVEL 2  the distributor selling that stock on to end clients, booked out of the five `dd-*`
//            depot branches. A resale of level 1, so counting both double-counts the goods.
//            **SUPER ADMIN ONLY** — this control, and the data itself.
//
// Modes: 'exclude' (default — depots left out so the headline never double-counts) | 'only' (the
// depot lens) | 'with' (depots alongside everything else).
//
// ⚠️ SUPER ADMIN ONLY, and `middleware/depot.js` pins every other tier to 'exclude' server-side, so
// this file is the UI half and never the access control.
// ⚠️ NEVER shape an option list with this value. Which branches a login may LIST is a property of
// its tier alone — gating the Branch dropdown's contents on this switch is the 2026-09-07 bug the
// client hit ("data exist in those DD branches with or without DD"). See FilterBar's branchOptions.
export const DD_MODE_KEY = 'flexibond_dd_mode';
export const DD_DEFAULT_MODE = 'exclude';

export const getDdMode = () => {
  try { return localStorage.getItem(DD_MODE_KEY) || DD_DEFAULT_MODE; }
  catch { return DD_DEFAULT_MODE; }
};

export const setDdMode = (mode) => {
  try { localStorage.setItem(DD_MODE_KEY, mode); } catch { /* ignore */ }
};

// Only the Flexibond super admin (`role: 'admin'` — NOT a sub admin, NOT a Company Admin) may
// see depot (level-2) data or this control.
export const canSeeDd = (user) => (user && user.role) === 'admin';

// Convenience for pages: the effective mode for THIS login. A non-super-admin is always 'exclude',
// so a stale localStorage value from an earlier super-admin session on the same browser can never
// widen what a subsequent scoped login renders.
export const effectiveDdMode = (user) => (canSeeDd(user) ? getDdMode() : DD_DEFAULT_MODE);
