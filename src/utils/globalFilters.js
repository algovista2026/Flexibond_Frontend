// Cross-page "universal" filters. Currently just the Master filter: once selected on any
// FilterBar page it should stay applied when you navigate to another dashboard page. Pages
// remount on route change, so persisting to localStorage + seeding each page's initial
// filter state from it is enough to carry the selection across sections.
const MASTER_KEY = 'flexibond_global_master';

export const getGlobalMaster = () => {
  try {
    const v = JSON.parse(localStorage.getItem(MASTER_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export const setGlobalMaster = (vals) => {
  try {
    localStorage.setItem(MASTER_KEY, JSON.stringify(Array.isArray(vals) ? vals : []));
  } catch {
    /* ignore quota / disabled storage */
  }
};
