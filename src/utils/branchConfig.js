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

// ── "DD" own-depot feeds (added 2026-09-02) ────────────────────────────────────────────────
// The five HYD/BLR/NGR/SRT/CHG warehouses appear in the Clients section under other trading names
// but are the firm's own stock points. They push through their own ingest URLs
// (`/api/ingest/dd-hyd/entries`, …; backend config/ddBranches.js) and every row they produce is
// flagged `dd: true`.
// ⚠️ Deliberately NOT part of BRANCH_GROUPS or ALL_BRANCHES: those drive the Upload selector and the
// Branch Analytics strip for EVERY account, and depot data is super-admin-only. Branch.jsx and the
// FilterBar's branch dropdown append this list themselves, and only when a super admin has the DD
// view switched on.
// `company: 'UFPL'` — the depots are part of UFPL (client confirmation 2026-09-07), so they carry
// the UFPL pink accent and their revenue lands in UFPL's slice. What keeps them separate is the
// `dd` flag + the DD view switch, NOT the company code.
export const DD_BRANCHES = [
  { value: 'dd-hyd', label: 'DD Hyderabad', company: 'UFPL' },
  { value: 'dd-blr', label: 'DD Bangalore', company: 'UFPL' },
  { value: 'dd-ngr', label: 'DD Nagpur', company: 'UFPL' },
  { value: 'dd-srt', label: 'DD Surat', company: 'UFPL' },
  { value: 'dd-chg', label: 'DD Chandigarh', company: 'UFPL' },
];

// Just the depot keys, for membership tests in the filter bar.
export const DD_BRANCH_VALUES = DD_BRANCHES.map(b => b.value);

// Everything we can name — the real branches plus the DD depots. Used for display lookups only.
const NAMED_BRANCHES = [...ALL_BRANCHES, ...DD_BRANCHES];

// value -> display label (falls back to the raw value for unknown/legacy branches).
export const branchLabel = (value) => {
  const found = NAMED_BRANCHES.find((b) => b.value === value);
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
  const found = NAMED_BRANCHES.find((b) => b.value === value);
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
