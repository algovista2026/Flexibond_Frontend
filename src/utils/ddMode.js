// Global "DD" view — ⚠️ REWIRED 2026-09-11.
//
// The 3-way control filters the `DISTRIBUTOR` SALESPERSON, exactly like INTER: 'exclude' (default,
// the "No DD" resting state) | 'only' | 'with'. Sent as `ddMode` on every GET by services/api.js.
//
// ⚠️ NOT the five `dd-*` depot branches. Those are a BRANCH dimension decided server-side from the
// account's role (middleware/depot.js); the mainboard always sees them and there is no UI control.
// The two were conflated between 2026-09-02 and 2026-09-10 and the client corrected it twice — they
// are disjoint sets in the data (overlap exactly 0). The shared `dd` prefix is a naming accident.
//
// ⚠️ MAINBOARD ONLY. The control renders only for `role:'admin'`, and middleware/dd.js pins every
// other tier to **'with'** — unfiltered — so their figures stay exactly as they are. This file is
// the UI half only; never treat it as the access boundary.
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
