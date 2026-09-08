// Global "DD" view — REWIRED 2026-09-08.
//
// ⚠️ DD is a SALESPERSON filter now, working exactly like INTER: `DISTRIBUTOR` is a special salesman
// pulled out of the Salesperson dropdown and driven by this 3-way control instead.
// ⚠️ It has NOTHING to do with the five `dd-*` depot branches. Those were what this switched between
// 2026-09-02 and 2026-09-07; they are now ordinary UFPL branches in `branchConfig.BRANCH_GROUPS`
// whose data counts in every total whether this is on or off. Shared prefix, unrelated things.
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
