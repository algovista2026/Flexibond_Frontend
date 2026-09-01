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
// ⚠️ The own-depot ("dd-*") branches are NEVER written into the persisted union. The union is a
// per-BROWSER store with no notion of who is logged in, so remembering them would surface depot
// names in the Branch dropdown of whoever logs in next on that machine (via the empty-list
// fallback). They also don't need the union's protection: it exists so a purge can't make a
// dropdown vanish, and the DD feeds are live push feeds that are never purged. A super admin still
// sees them — straight from the fresh fetch. See utils/ddMode.js.
const isDdValue = (v) => /^dd-/i.test(String(v));

export const mergeFilterOptions = (fresh = {}) => {
  const cache = load();
  const out = { ...fresh };
  for (const k of OPTION_KEYS) {
    const list = Array.isArray(fresh[k]) ? fresh[k] : [];
    const prev = Array.isArray(cache[k]) ? cache[k] : [];
    const cacheable = k === 'branches' ? list.filter(v => !isDdValue(v))
      : k === 'companies' ? list.filter(v => String(v).toUpperCase() !== 'DD')
        : list;
    const union = sortUnion(Array.from(new Set([...prev, ...cacheable])));
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
