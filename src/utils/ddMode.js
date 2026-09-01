// Global "DD" (own-depot) view — added 2026-09-02.
//
// Five accounts that show up in the Clients section under other trading names are actually the
// firm's own warehouses (HYD · BLR · NGR · SRT · CHG). They push through their own Kuber ingest
// URLs and every row they produce is flagged `dd: true` on the backend.
//
// ⚠️ SUPER ADMIN ONLY. The 3-way control lives in the FilterBar and only renders for `role:'admin'`;
// the api interceptor sends the chosen mode on every GET. The real enforcement is server-side
// (`middleware/dd.js` forces 'exclude' for every other tier), so this file is purely the UI half —
// never treat it as the access control.
//
// Modes mirror the INTER control: 'exclude' (default) | 'only' | 'with'.
export const DD_MODE_KEY = 'flexibond_dd_mode';
export const DD_DEFAULT_MODE = 'exclude';

export const getDdMode = () => {
  try { return localStorage.getItem(DD_MODE_KEY) || DD_DEFAULT_MODE; }
  catch { return DD_DEFAULT_MODE; }
};

export const setDdMode = (mode) => {
  try { localStorage.setItem(DD_MODE_KEY, mode); } catch { /* ignore */ }
};

// Only the Flexibond super admin (`role: 'admin'` — NOT a Company Admin) may see depot data.
export const canSeeDd = (user) => (user && user.role) === 'admin';

// Convenience for pages: the effective mode for THIS login. A non-super-admin is always 'exclude',
// so a stale localStorage value from an earlier admin session on the same browser can never widen
// what a subsequent scoped login renders.
export const effectiveDdMode = (user) => (canSeeDd(user) ? getDdMode() : DD_DEFAULT_MODE);
