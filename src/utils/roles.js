// ────────────────────────────────────────────────────────────────────────────
// utils/roles.js — the frontend mirror of the backend's `config/roles.js`.
// Added 2026-09-08 with the SUB ADMIN tier.
//
// The tiers, top to bottom:
//   'admin'        SUPER ADMIN — everything, incl. the five `dd-*` depot branches and the
//                  branches (level-2 depot sales) and the "DD" 3-way control that filters them.
//                  Invisible to every tier below.
//   'subadmin'     SUB ADMIN — same nav, same pages, same global admin surface as a super admin,
//                  EXCEPT: no depot branches, no DD control, and super admins are invisible to it.
//   'companyadmin' COMPANY ADMIN — master control over ONE company.
//   'viewer'       ordinary scoped login; sees whatever modules the admin granted.
//
// ⚠️ Use `isGlobalAdmin` for "does this login get the admin surface / bypass module permissions?".
// Reserve `isSuperAdmin` for the two depot/DD gates — that is the ONLY difference between the top
// two tiers, and it is enforced server-side regardless (middleware/depot.js + middleware/dd.js);
// these helpers are the UI half only, never the access control.
// ────────────────────────────────────────────────────────────────────────────
const roleOf = (user) => (user && user.role) || '';

export const isSuperAdmin = (user) => roleOf(user) === 'admin';
export const isSubAdmin = (user) => roleOf(user) === 'subadmin';
export const isGlobalAdmin = (user) => isSuperAdmin(user) || isSubAdmin(user);
export const isCompanyAdmin = (user) => roleOf(user) === 'companyadmin';
export const isAnyAdmin = (user) => isGlobalAdmin(user) || isCompanyAdmin(user);

// ⚠️ REWIRED 2026-09-09: EVERY tier below super admin is depot-blind, not just the sub admin. The
// five `dd-*` depots carry LEVEL-2 sales (the distributor selling on stock it bought at level 1),
// restricted to the super admin. Used to drop them from lists the client builds itself (the Branch
// strip, the Upload selector); data-driven lists are already stripped server-side.
// ⚠️ NOT about the `DISTRIBUTOR` salesperson — that is level-1 revenue, ordinary for every tier.
export const hidesDepots = (user) => !isSuperAdmin(user);

// Human label for the badge in Admin Panel → Users.
export const ROLE_LABELS = {
  admin: 'super admin',
  subadmin: 'sub admin',
  companyadmin: 'company admin',
  viewer: 'viewer',
};
