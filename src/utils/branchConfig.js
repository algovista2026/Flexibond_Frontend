// Branch registry — the physical branches/locations, grouped under their daughter company.
// Used by BOTH the Data Upload branch selector (tag a file to a branch) and the Branch
// Analytics section's branch picker, so the two always stay in sync.
//
// The `value` MUST equal the Kuber ingest source key stored on Invoice/InvoiceItem.branch
// (routes/ingest.js `BRANCH_COMPANY`), e.g. "uflp-ahmedabad" — the ingestion pipeline stamps the
// branch from that key, so the Branch Analytics strip only binds to real data when these match.
// `label` is display-only.
export const BRANCH_GROUPS = [
  {
    company: 'UFPL',
    label: 'UFPL',
    branches: [
      { value: 'uflp-ahmedabad', label: 'UFPL Home (Ahmedabad)' },
      { value: 'uflp-vadodara', label: 'Vadodara' },
      { value: 'uflp-bhiwandi', label: 'Bhiwandi' },
      { value: 'uflp-pune', label: 'Pune' },
      { value: 'uflp-raipur', label: 'Raipur' },
      { value: 'uflp-indore', label: 'Indore' },
      { value: 'uflp-lucknow', label: 'Lucknow' },
      { value: 'uflp-guwahati', label: 'Guwahati' },
      { value: 'uflp-kolkata', label: 'Kolkata' },
      { value: 'uflp-delhi', label: 'Delhi' },
      // The five depots (backend config/depotBranches.js). ORDINARY UFPL BRANCHES as of 2026-09-08:
      // they belong in this list so they show in the Branch filter and the Branch Analytics strip
      // for everyone the normal scoping allows, with data counted in every total.
      // ⚠️ Between 2026-09-02 and 2026-09-07 they lived in a separate `DD_BRANCHES` export that
      // Branch.jsx and the FilterBar appended only when a super admin had the "DD" switch on — which
      // is exactly why they went missing from the Branch filter. That export is gone.
      // ⚠️ SUPER-ADMIN-ONLY DATA since 2026-09-09 — see DEPOT_BRANCH_VALUES below. (Was a
      // salesperson filter). The keys are fixed: the vendor already pushes to those URLs.
      { value: 'dd-hyd', label: 'DD Hyderabad' },
      { value: 'dd-blr', label: 'DD Bangalore' },
      { value: 'dd-ngr', label: 'DD Nagpur' },
      { value: 'dd-srt', label: 'DD Surat' },
      { value: 'dd-chg', label: 'DD Chandigarh' },
    ],
  },
  {
    company: 'UCPL',
    label: 'UCPL',
    branches: [
      { value: 'ucpl-home', label: 'UCPL Home (Ahmedabad)' },
      { value: 'ucpl-kochi', label: 'Kochi' },
    ],
  },
  {
    company: 'FDL',
    label: 'FDL',
    branches: [
      { value: 'fdl-home', label: 'FDL Home (Ahmedabad)' },
    ],
  },
];

// Flat list of every branch { value, label, company }.
export const ALL_BRANCHES = BRANCH_GROUPS.flatMap((g) =>
  g.branches.map((b) => ({ ...b, company: g.company }))
);

// value -> display label (falls back to the raw value for unknown/legacy branches).
// The five depot ingest keys. ⚠️ SUPER-ADMIN-ONLY DATA (2026-09-09): they carry LEVEL-2 sales —
// the distributor selling on stock it bought at level 1 — so every tier below super admin has these
// rows stripped server-side (middleware/depot.js). This list is what lets the client-built lists
// agree: the Branch strip and the Upload selector drop them via `roles.hidesDepots`, and the Branch
// dropdown unions them back in for a super admin (FilterBar `branchOptions`).
// ⚠️ Which branches you may LIST depends on your TIER, never on the DD toggle — see FilterBar.
// ⚠️ Keep in sync with the backend's `config/depotBranches.js`.
export const DEPOT_BRANCH_VALUES = ['dd-hyd', 'dd-blr', 'dd-ngr', 'dd-srt', 'dd-chg'];
export const isDepotBranch = (value) => DEPOT_BRANCH_VALUES.includes(String(value || '').toLowerCase());

export const branchLabel = (value) => {
  const found = ALL_BRANCHES.find((b) => b.value === value);
  return found ? found.label : value;
};

// Pretty-print a raw branch KEY like "ucpl-kochi" → "UCPL-Kochi": the company code (before the
// first "-") is UPPERCASED and every remaining segment is Title-Cased. Used by the FilterBar
// branch dropdown + chips so the raw ingest keys never surface in lowercase. Unlike `branchLabel`
// (which returns curated names like "Kochi"), this keeps the key's shape, just cased.
export const branchDisplay = (value) => {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return raw;
  const [company, ...rest] = raw.split('-');
  let head = company.toUpperCase();
  if (head === 'UFLP') head = 'UFPL'; // the mistyped daughter-company code was retired 2026-08-05
  const tail = rest.map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p));
  return [head, ...tail].join('-');
};

// value -> its daughter company code (or '' if unknown).
export const companyOfBranch = (value) => {
  const found = ALL_BRANCHES.find((b) => b.value === value);
  return found ? found.company : '';
};

// Per-company accent colours — the SAME family used by the main dashboard's "Revenue Split by
// Company" bar (UFPL pink · UCPL amber/orange · FDL green). Used to tint the branch
// selection cards on the Branch Analytics page.
export const COMPANY_ACCENTS = {
  UFPL: '#ec4899', // pink
  UCPL: '#f59e0b', // orange / amber
  FDL: '#10b981',  // green
};

export const branchAccent = (branchValue) => {
  const co = String(companyOfBranch(branchValue) || '').toUpperCase();
  return COMPANY_ACCENTS[co] || '#6366f1';
};
