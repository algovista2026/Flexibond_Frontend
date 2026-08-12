// Cross-page "universal" filters. Every FilterBar filter (the date range + all dropdowns) is
// persisted here so that once you set a selection on any analytics page it stays applied when
// you navigate to another dashboard page. Pages remount on route change, so persisting to
// localStorage + seeding each page's initial filter state from it is enough to carry the whole
// filter set across sections. Page-specific extras (product / dimensions / city / format) are
// intentionally NOT universal — they stay local to the page that owns them.
const KEY = 'flexibond_global_filters';

// The filter fields shared by every FilterBar page. Kept in sync with the FilterBar dropdowns.
export const UNIVERSAL_KEYS = [
  'startDate', 'endDate', 'company', 'branch', 'master', 'group', 'category', 'grade',
  'group1', 'thickness', 'colour', 'zone', 'state', 'salesperson'
];

export const getGlobalFilters = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

// Merge a page's filter object into the saved universal set. Only keys the page actually
// declares are written, so a page that doesn't render a given filter (e.g. Salesperson has no
// Salesperson dropdown) never wipes that value from the shared set.
export const setGlobalFilters = (filters) => {
  try {
    const slim = { ...getGlobalFilters() };
    for (const k of UNIVERSAL_KEYS) if (filters && k in filters) slim[k] = filters[k];
    localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* ignore quota / disabled storage */
  }
};

// "Clear Filters" wipes the whole universal set (not just the fields the current page renders),
// so clearing from any page clears everywhere.
export const clearGlobalFilters = () => {
  try {
    localStorage.removeItem(KEY);
    localStorage.setItem('flexibond_inter_mode', 'exclude'); // fresh session → default to "No INTER"
  } catch {
    /* ignore */
  }
};

// Merge the saved universal filters onto a page's default filter state. Only universal keys the
// page already declares are overridden, so a page never gains an unexpected field.
export const seedFilters = (defaults) => {
  const saved = getGlobalFilters();
  const merged = { ...defaults };
  for (const k of UNIVERSAL_KEYS) {
    if (k in defaults && k in saved) merged[k] = saved[k];
  }
  return merged;
};
