import React, { useRef, useState, useMemo } from 'react';
import { FiInfo, FiX, FiCalendar } from 'react-icons/fi';
import MultiSelect from './MultiSelect';
import { branchDisplay, DEPOT_BRANCH_VALUES, isDepotBranch } from '../utils/branchConfig';
import { setDdMode, canSeeDd, effectiveDdMode } from '../utils/ddMode';

// A date field that keeps a text placeholder when empty, but has an explicit calendar
// button that reliably opens the native date picker (showPicker) — the old focus-driven
// type-swap made the built-in calendar icon flaky / sometimes unresponsive.
const DateField = ({ name, value, placeholder, onChange }) => {
  const ref = useRef(null);
  const openPicker = () => {
    const el = ref.current;
    if (!el) return;
    el.type = 'date';
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };
  return (
    <div className="date-field" style={{ display: 'flex', alignItems: 'stretch', gap: '4px' }}>
      <input
        ref={ref}
        type={value ? 'date' : 'text'}
        name={name}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => (e.target.type = 'date')}
        onBlur={(e) => !e.target.value && (e.target.type = 'text')}
        placeholder={placeholder}
        style={{ height: '42px' }}
      />
      <button
        type="button"
        className="btn-secondary"
        title="Open calendar"
        onClick={openPicker}
        style={{ height: '42px', padding: '0 10px', display: 'inline-flex', alignItems: 'center' }}
      >
        <FiCalendar size={16} />
      </button>
    </div>
  );
};

// ── Month quick-select (added 2026-09-07) ───────────────────────────────────────────────────
// The client reports monthly. Doing that with the two date fields means remembering that August
// ends on the 31st and September on the 30th, every time. This dropdown does it for them.
//
// It is deliberately NOT a new filter: it just WRITES startDate/endDate, which are already
// universal (UNIVERSAL_KEYS), so a month picked on the Dashboard carries to Products/Clients/
// Financials with no extra persistence. For the same reason its displayed value is DERIVED from
// the two dates rather than stored — hand-edit either date and it falls back to "(Custom range)"
// on its own, so the control can never disagree with the window actually applied.
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-');
  return `${MONTH_NAMES[Number(m) - 1] || m} ${y}`;
};

// Last calendar day of a "YYYY-MM" → "YYYY-MM-DD". `new Date(y, m, 0)` with a 1-based month is
// the last day of that month (JS rolls back a day from the 0th of the NEXT month).
const monthEnd = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};

// Which month, if any, the current date window exactly represents. "" = a custom range.
const monthOfRange = (startDate, endDate) => {
  const m = /^(\d{4})-(\d{2})-01$/.exec(String(startDate || ''));
  if (!m) return '';
  const ym = `${m[1]}-${m[2]}`;
  return endDate === monthEnd(ym) ? ym : '';
};

// Salespeople hidden from the Salesperson dropdown because a dedicated 3-way control owns them.
// Keep in sync with the backend's utils/interFilter.js + utils/ddFilter.js.
//
// ⚠️ INTER is hidden for EVERY account — every account has the INTER control.
// ⚠️ DISTRIBUTOR is hidden for the MAINBOARD ONLY (2026-09-11), because only the mainboard has the
// "DD" button. Hiding it from a tier that has no button would leave that tier unable to select a
// salesman whose revenue they can still see — the dropdown would silently disagree with the data.
const HIDDEN_ALWAYS = ['INTER'];
const hiddenSalespeople = (hasDdControl) =>
  new Set(hasDdControl ? [...HIDDEN_ALWAYS, 'DISTRIBUTOR'] : HIDDEN_ALWAYS);

const FilterBar = ({ filters, options, onFilterChange, hideSalesperson = false, hideBranch = false, showBatch = false }) => {
  // Render a dropdown when it has options OR when it currently has a selection — so an
  // active filter is never hidden even if cascading momentarily empties its option list.
  const show = (list, selected) =>
    (Array.isArray(list) && list.length > 0) || (Array.isArray(selected) && selected.length > 0);

  // A company-scoped account is locked to one company — hide the Company filter entirely
  // (the server already forces their company on every request).
  const me = JSON.parse(sessionStorage.getItem('flexibond_user') || '{}');
  const hideCompany = me.scopeType === 'company';

  // Global INTER view — universal + persisted (localStorage). Three modes across every dashboard:
  //   'with'    → all data, INTER included (default)
  //   'only'    → only the INTER salesperson
  //   'exclude' → all data with INTER removed
  // The api interceptor injects interMode on every request, so switching just triggers a re-fetch.
  const [interMode, setInterModeState] = useState(() => localStorage.getItem('flexibond_inter_mode') || 'exclude');
  const setInter = (mode) => {
    setInterModeState(mode);
    localStorage.setItem('flexibond_inter_mode', mode);
    onFilterChange({}); // re-fetch with the new interMode
  };

  // Global DD view — ⚠️ REWIRED 2026-09-11: this filters the `DISTRIBUTOR` SALESPERSON, exactly like
  // the INTER control beside it. 'with' = DISTRIBUTOR shown alongside everyone / 'only' = just their
  // sales / 'exclude' = removed (the resting "No DD" default).
  // ⚠️ It is NOT a branch filter. The five `dd-*` DEPOT branches are a separate dimension handled
  // entirely server-side by middleware/depot.js — the mainboard always sees them, no control needed.
  // The two were conflated twice and the client corrected it both times; they are disjoint sets.
  // MAINBOARD ONLY: not rendered for any other tier, and middleware/dd.js pins those tiers to 'with'
  // (unfiltered) so their figures are untouched.
  const showDd = canSeeDd(me);
  const DD_ACCENT = '#8b5cf6'; // purple — same violet the chart palettes already use

  // ⚠️ Seeded from effectiveDdMode, NOT getDdMode: on a shared browser localStorage can still hold
  // 'only' from a previous super-admin session, and that must not reshape a scoped login's branch
  // dropdown. Non-super-admins always resolve to 'exclude'.
  const [ddMode, setDdModeState] = useState(() => effectiveDdMode(me));
  // ⚠️ THE BRANCH DROPDOWN'S CONTENTS DEPEND ON THE ACCOUNT'S TIER, NEVER ON `ddMode`.
  // `/dashboard/filters` is data-driven and the server applies the depot filter to it, so in the
  // default 'exclude' mode the depot branches are simply absent from the facet — which for a SUPER
  // ADMIN would mean the five depots vanish from the dropdown until an unrelated toggle was flipped.
  // That is precisely the bug the client reported on 2026-09-08 ("data exist in those DD branches
  // with or without DD"), so the depot values are unioned back in for the super admin unconditionally
  // — same list whatever the mode. For every other tier they are omitted, because that tier genuinely
  // cannot see the data and a dropdown entry that returns nothing is worse than no entry.
  // ⚠️ Also guards against a stale localStorage union: filterOptionsCache remembers every option
  // ever seen per browser, so without this a scoped login on a shared machine could inherit depot
  // values a super admin's session cached earlier.
  const branchOptions = useMemo(() => {
    const raw = options?.branches || [];
    const valueOf = (o) => String(typeof o === 'string' ? o : (o?.value ?? o?.label ?? '')).toLowerCase();
    if (!showDd) return raw.filter((o) => !isDepotBranch(valueOf(o)));
    const present = new Set(raw.map(valueOf));
    return [...raw, ...DEPOT_BRANCH_VALUES.filter((v) => !present.has(v))];
  }, [options?.branches, showDd]);

  const setDd = (mode) => {
    setDdModeState(mode);
    setDdMode(mode);
    onFilterChange({}); // re-fetch with the new ddMode
  };

  // Month quick-select: months that actually hold data, newest first. The currently-applied month
  // is force-included so the dropdown can never show a blank for a window that IS a whole month.
  const selectedMonth = monthOfRange(filters.startDate, filters.endDate);
  const monthOptions = [...new Set([...(options?.months || []), ...(selectedMonth ? [selectedMonth] : [])])]
    .sort().reverse();

  return (
    <>
      <div className="filter-bar">
        {/* Month quick-select — sits before Start Date; writes both date fields. */}
        {monthOptions.length > 0 && (
          <select
            title="Jump to a whole month — sets the start and end dates to that month's first and last day."
            value={selectedMonth}
            onChange={(e) => {
              const ym = e.target.value;
              onFilterChange(ym
                ? { startDate: `${ym}-01`, endDate: monthEnd(ym) }
                : { startDate: '', endDate: '' }); // "(Custom range)" clears the window
            }}
            style={{ height: '42px' }}
          >
            <option value="">Month</option>
            {monthOptions.map(ym => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
          </select>
        )}

        <DateField
          name="startDate"
          value={filters.startDate}
          placeholder="Start Date"
          onChange={(v) => onFilterChange({ startDate: v })}
        />
        <DateField
          name="endDate"
          value={filters.endDate}
          placeholder="End Date"
          onChange={(v) => onFilterChange({ endDate: v })}
        />

        {/* Company — daughter-company (TYpe3). The primary filter, styled prominently in amber.
            Locked/hidden for company-scoped users (they only ever see their own company), so
            pages omit it via hideCompany. */}
        {!hideCompany && show(options?.companies, filters.company) && (
          <MultiSelect
            label="Company"
            options={options.companies}
            selected={filters.company || []}
            onChange={(vals) => onFilterChange({ company: vals })}
          />
        )}

        {/* Branch — physical branch/location (sits between Company and Master). Universal, like
            the other dropdowns. Hidden on the Branch Analytics page (its strip is the selector).
            ⚠️ The list is shaped by WHO YOU ARE and never by the DD switch — see `branchOptions`. */}
        {!hideBranch && show(branchOptions, filters.branch) && (
          <MultiSelect
            label="Branch"
            options={branchOptions}
            selected={filters.branch || []}
            formatOption={branchDisplay}
            onChange={(vals) => onFilterChange({ branch: vals })}
          />
        )}

        {/* Master — headline product classification. */}
        {show(options?.masters, filters.master) && (
          <MultiSelect
            label="Master"
            options={options.masters}
            selected={filters.master || []}
            onChange={(vals) => onFilterChange({ master: vals })}
          />
        )}

        {/* Category — sourced from the "TYpe1" column (internal field: group). */}
        {show(options?.groups, filters.group) && (
          <MultiSelect
            label="Category"
            options={options.groups}
            selected={filters.group || []}
            onChange={(vals) => onFilterChange({ group: vals })}
          />
        )}

        {/* Sub-Category — the real "Categry" column (internal field: category). */}
        {show(options?.categories, filters.category) && (
          <MultiSelect
            label="Sub-Category"
            options={options.categories}
            selected={filters.category || []}
            onChange={(vals) => onFilterChange({ category: vals })}
          />
        )}

        {show(options?.grades, filters.grade) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MultiSelect
              label="Grade"
              options={options.grades}
              selected={filters.grade || []}
              onChange={(vals) => onFilterChange({ grade: vals })}
            />
            <span
              title="Grade is a per-line-item attribute (one invoice can span several grades). When you filter by Grade — like Category or Product — revenue is calculated from line items and shown tax-inclusive, so grade totals add up to the overall Total Revenue (a small ~0.4% rounding difference is normal)."
              style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help', color: 'var(--text-muted)' }}
            >
              <FiInfo size={15} />
            </span>
          </div>
        )}

        {/* Variants — the "TYpe2" column (internal field: group1). */}
        {show(options?.group1s, filters.group1) && (
          <MultiSelect
            label="Variants"
            options={options.group1s}
            selected={filters.group1 || []}
            onChange={(vals) => onFilterChange({ group1: vals })}
          />
        )}

        {/* Thickness / Section — the "Type" column (internal field: thickness). */}
        {show(options?.thickness, filters.thickness) && (
          <MultiSelect
            label="Thickness / Section"
            options={options.thickness}
            selected={filters.thickness || []}
            onChange={(vals) => onFilterChange({ thickness: vals })}
          />
        )}

        {show(options?.colours, filters.colour) && (
          <MultiSelect
            label="Colours"
            options={options.colours}
            selected={filters.colour || []}
            onChange={(vals) => onFilterChange({ colour: vals })}
          />
        )}

        {/* Batch (Kuber line field `UColour`: BB / BG / BJ / JB / JV / …). Products page only,
            via the `showBatch` prop — it sits right after Colours. */}
        {showBatch && show(options?.batches, filters.batch) && (
          <MultiSelect
            label="Batch"
            options={options.batches}
            selected={filters.batch || []}
            onChange={(vals) => onFilterChange({ batch: vals })}
          />
        )}

        {show(options?.zones, filters.zone) && (
          <MultiSelect
            label="Zone"
            options={options.zones}
            selected={filters.zone || []}
            onChange={(vals) => onFilterChange({ zone: vals })}
          />
        )}

        {show(options?.states, filters.state) && (
          <MultiSelect
            label="State"
            options={options.states}
            selected={filters.state || []}
            onChange={(vals) => onFilterChange({ state: vals })}
          />
        )}

        {/* Salesperson — only INTER is withheld (its own 3-way control owns it). ⚠️ DISTRIBUTOR
            IS listed here: it is the level-1 sale and ordinary revenue (2026-09-09). */}
        {!hideSalesperson && show(options?.salespersons, filters.salesperson) && (
          <MultiSelect
            label="Salesperson"
            options={(options.salespersons || []).filter(o => !hiddenSalespeople(showDd).has(String(typeof o === 'string' ? o : (o?.value ?? o?.label ?? '')).toUpperCase()))}
            selected={filters.salesperson || []}
            onChange={(vals) => onFilterChange({ salesperson: vals })}
          />
        )}

        <button
          className="btn-secondary"
          onClick={() => onFilterChange({
            startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
            colour: [], batch: [], thickness: [], format: '', product: '', dimensions: '', city: '', group: [],
            group1: [], master: [], company: [], branch: []
          }, true)}
        >
          Clear Filters
        </button>

        {/* INTER view — 3-way segmented control, pushed to the right corner of the filter box.
            Universal + persisted; the api interceptor sends the mode on every request. */}
        <div
          title="INTER (inter-company) salesperson view — applies to every dashboard: include it with everyone, show only INTER, or remove INTER."
          style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', marginLeft: 'auto' }}
        >
          {[['with', 'With INTER'], ['only', 'Only INTER'], ['exclude', 'No INTER']].map(([m, label], i) => (
            <button
              key={m}
              onClick={() => setInter(m)}
              style={{
                padding: '9px 12px', border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--border-color)',
                background: interMode === m ? 'var(--primary-600)' : '#fff', color: interMode === m ? '#fff' : 'var(--text-primary)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* DD view — 3-way segmented control, mirroring INTER. ⚠️ Rendered for the SUPER ADMIN
            only; every other tier never sees it and the server ignores the mode for them. */}
        {showDd && (
          <div
            title="DD depot view — the five DD depot branches (HYD · BLR · NGR · SRT · CHG) carry the distributor's onward sales to end clients. Include them alongside everything, show only them, or leave them out. Excluded by default so the headline doesn't count the same goods twice. Super admins only — no other tier can see this data. The DISTRIBUTOR salesman itself is ordinary revenue and is in the Salesperson dropdown."
            style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}
          >
            {[['with', 'With DD'], ['only', 'Only DD'], ['exclude', 'No DD']].map(([m, label], i) => (
              <button
                key={m}
                onClick={() => setDd(m)}
                style={{
                  padding: '9px 12px', border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--border-color)',
                  // Purple, not the app's primary blue — the DD control is a super-admin-only view
                  // switch, so it reads as distinct from the INTER control sitting next to it.
                  background: ddMode === m ? DD_ACCENT : '#fff', color: ddMode === m ? '#fff' : 'var(--text-primary)',
                  fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <AppliedFilters filters={filters} onFilterChange={onFilterChange} />
    </>
  );
};

// Field labels + how each active filter is rendered as a removable chip below the bar.
// Labels are the client-facing names (Company / Category / Sub-Category / Variants / …).
const CHIP_LABELS = {
  company: 'Company', branch: 'Branch', master: 'Master', group: 'Category', category: 'Sub-Category',
  grade: 'Grade', group1: 'Variants', thickness: 'Thickness / Section', colour: 'Colours', batch: 'Batch',
  zone: 'Zone', state: 'State', salesperson: 'Salesperson', product: 'Product',
  dimensions: 'Size', city: 'City'
};

const AppliedFilters = ({ filters, onFilterChange }) => {
  const chips = [];
  if (filters.startDate) chips.push({ key: 'startDate', scalar: true, text: `From ${filters.startDate}` });
  if (filters.endDate) chips.push({ key: 'endDate', scalar: true, text: `To ${filters.endDate}` });

  Object.entries(CHIP_LABELS).forEach(([key, label]) => {
    const v = filters[key];
    const disp = (val) => (key === 'branch' ? branchDisplay(val) : val);
    if (Array.isArray(v)) {
      v.forEach(val => chips.push({ key, val, text: `${label}: ${disp(val)}` }));
    } else if (v) {
      chips.push({ key, scalar: true, text: `${label}: ${disp(v)}` });
    }
  });
  if (chips.length === 0) return null;

  const removeChip = (chip) => {
    if (chip.scalar) {
      onFilterChange({ [chip.key]: '' });
    } else {
      const cur = Array.isArray(filters[chip.key]) ? filters[chip.key] : [];
      onFilterChange({ [chip.key]: cur.filter(x => x !== chip.val) });
    }
  };

  const clearAll = () => onFilterChange({
    startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
    colour: [], batch: [], thickness: [], format: '', product: '', dimensions: '', city: '', group: [],
    group1: [], master: [], company: []
  }, true);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', margin: '-8px 0 20px' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Applied:</span>
      {chips.map((chip, i) => (
        <span
          key={`${chip.key}-${chip.val ?? 'scalar'}-${i}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 6px 3px 10px',
            borderRadius: '14px', background: 'var(--primary-50, #eff6ff)', color: 'var(--primary-600)',
            border: '1px solid var(--primary-200, #bfdbfe)', fontSize: '0.78rem', fontWeight: 600
          }}
        >
          {chip.text}
          <button
            onClick={() => removeChip(chip)}
            title="Remove filter"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--primary-600)', cursor: 'pointer', padding: 0 }}
          >
            <FiX size={13} />
          </button>
        </span>
      ))}
      <button
        onClick={clearAll}
        style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '2px 4px' }}
      >
        Clear all
      </button>
    </div>
  );
};

export default FilterBar;
