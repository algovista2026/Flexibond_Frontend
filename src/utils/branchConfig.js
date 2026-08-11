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

// value -> display label (falls back to the raw value for unknown/legacy branches).
export const branchLabel = (value) => {
  const found = ALL_BRANCHES.find((b) => b.value === value);
  return found ? found.label : value;
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
