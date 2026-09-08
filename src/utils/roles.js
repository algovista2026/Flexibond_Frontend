// ────────────────────────────────────────────────────────────────────────────
// utils/roles.js — the frontend mirror of the backend's `config/roles.js`.
// Added 2026-09-08 with the SUB ADMIN tier.
//
// The tiers, top to bottom:
//   'admin'        SUPER ADMIN — everything, incl. the five `dd-*` depot branches and the
//                  DISTRIBUTOR ("DD") salesman. Invisible to every tier below.
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

// A sub admin is depot-blind: hide the five `dd-*` branches from any list the client builds itself
// (the Branch strip, the Upload branch selector). Anything data-driven — the Branch dropdown, every
// chart — is already stripped by the server, so this only covers hard-coded lists.
export const hidesDepots = (user) => isSubAdmin(user);

// Human label for the badge in Admin Panel → Users.
export const ROLE_LABELS = {
  admin: 'super admin',
  subadmin: 'sub admin',
  companyadmin: 'company admin',
  viewer: 'viewer',
};
