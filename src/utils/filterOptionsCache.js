// Keep the FilterBar dropdowns from disappearing when data is deleted/purged.
//
// The `/dashboard/filters` endpoint derives each dropdown's option list from the live data, so
// deleting an upload (or a whole purge) empties those lists and the dropdowns vanish. The client
// wants the filters to be permanent. So we remember the UNION of every option value ever seen
// (in localStorage) and, whenever a freshly-fetched list comes back EMPTY, we fall back to the
// remembered union. Non-empty fresh lists are used as-is, so cascading still narrows the options
// while the underlying data exists.
const KEY = 'flexibond_filter_options';

const OPTION_KEYS = [
  'salespersons', 'cities', 'states', 'categories', 'products', 'thickness', 'dimensions',
  'grades', 'zones', 'colours', 'groups', 'group1s', 'masters', 'companies', 'branches'
];

const NONE = '(None)';
// Sort a union list stably: alphabetical, but keep the "(None)" bucket pinned last.
const sortUnion = (arr) =>
  [...arr].sort((a, b) => {
    if (a === NONE) return 1;
    if (b === NONE) return -1;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  });

const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

const save = (obj) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* ignore quota / disabled storage */
  }
};

// Merge freshly-fetched filter options with the persisted union. Grows the remembered union and
// returns a display set where any key the fresh fetch left empty falls back to that union.
export const mergeFilterOptions = (fresh = {}) => {
  const cache = load();
  const out = { ...fresh };
  for (const k of OPTION_KEYS) {
    const list = Array.isArray(fresh[k]) ? fresh[k] : [];
    const prev = Array.isArray(cache[k]) ? cache[k] : [];
    const union = sortUnion(Array.from(new Set([...prev, ...list])));
    cache[k] = union;
    out[k] = list.length ? list : union; // fall back to union only when the fresh list is empty
  }
  save(cache);
  return out;
};

export const clearFilterOptionsCache = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
