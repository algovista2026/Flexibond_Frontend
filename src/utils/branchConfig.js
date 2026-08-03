// Branch registry — the physical branches/locations, grouped under their daughter company.
// Used by BOTH the Data Upload branch selector (tag a file to a branch) and the Branch
// Analytics section's branch picker, so the two always stay in sync.
//
// The `value` is what gets stored on Invoice/InvoiceItem.branch and matched by the branch
// filter — since we control both the upload stamp and the query, these values just need to be
// internally consistent. `label` is display-only.
//
// Note (per client, 2026-08-03): the "UFPL" company code is used interchangeably with "UFLP"
// in the source data — treat them as the same company here.
export const BRANCH_GROUPS = [
  {
    company: 'UFPL',
    label: 'UFPL / UFLP',
    branches: [
      { value: 'Vadodara', label: 'Vadodara' },
      { value: 'Bhiwandi', label: 'Bhiwandi' },
      { value: 'Pune', label: 'Pune' },
      { value: 'Raipur', label: 'Raipur' },
      { value: 'Indore', label: 'Indore' },
      { value: 'Lucknow', label: 'Lucknow' },
      { value: 'Guwahati', label: 'Guwahati' },
      { value: 'Kolkata', label: 'Kolkata' },
      { value: 'Delhi', label: 'Delhi' },
      { value: 'UFPL_home', label: 'UFPL Home (Ahmedabad)' },
    ],
  },
  {
    company: 'UCPL',
    label: 'UCPL',
    branches: [
      { value: 'UCPL_home', label: 'UCPL Home' },
      { value: 'Kochin', label: 'Kochin' },
    ],
  },
  {
    company: 'FDL',
    label: 'FDL',
    branches: [
      { value: 'FDL_home', label: 'FDL Home' },
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
