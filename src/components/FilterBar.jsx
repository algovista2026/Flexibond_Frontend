import React, { useRef, useState } from 'react';
import { FiInfo, FiX, FiCalendar } from 'react-icons/fi';
import MultiSelect from './MultiSelect';

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

const FilterBar = ({ filters, options, onFilterChange, hideSalesperson = false, hideBranch = false }) => {
  // Render a dropdown when it has options OR when it currently has a selection — so an
  // active filter is never hidden even if cascading momentarily empties its option list.
  const show = (list, selected) =>
    (Array.isArray(list) && list.length > 0) || (Array.isArray(selected) && selected.length > 0);

  // A company-scoped account is locked to one company — hide the Company filter entirely
  // (the server already forces their company on every request).
  const me = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const hideCompany = me.scopeType === 'company';

  // Global INTER view — universal + persisted (localStorage). Three modes across every dashboard:
  //   'with'    → all data, INTER included (default)
  //   'only'    → only the INTER salesperson
  //   'exclude' → all data with INTER removed
  // The api interceptor injects interMode on every request, so switching just triggers a re-fetch.
  const [interMode, setInterModeState] = useState(() => localStorage.getItem('flexibond_inter_mode') || 'with');
  const setInter = (mode) => {
    setInterModeState(mode);
    localStorage.setItem('flexibond_inter_mode', mode);
    onFilterChange({}); // re-fetch with the new interMode
  };

  return (
    <>
      <div className="filter-bar">
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
            accent="#d97706"
            onChange={(vals) => onFilterChange({ company: vals })}
          />
        )}

        {/* Branch — physical branch/location (sits between Company and Master). Universal, like
            the other dropdowns. Hidden on the Branch Analytics page (its strip is the selector). */}
        {!hideBranch && show(options?.branches, filters.branch) && (
          <MultiSelect
            label="Branch"
            options={options.branches}
            selected={filters.branch || []}
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

        {!hideSalesperson && show(options?.salespersons, filters.salesperson) && (
          <MultiSelect
            label="Salesperson"
            options={(options.salespersons || []).filter(o => String(typeof o === 'string' ? o : (o?.value ?? o?.label ?? '')).toUpperCase() !== 'INTER')}
            selected={filters.salesperson || []}
            onChange={(vals) => onFilterChange({ salesperson: vals })}
          />
        )}

        <button
          className="btn-secondary"
          onClick={() => onFilterChange({
            startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
            colour: [], thickness: [], format: '', product: '', dimensions: '', city: '', group: [],
            group1: [], master: [], company: [], branch: []
          }, true)}
        >
          Clear Filters
        </button>

        {/* INTER view — 3-way segmented control after Clear Filters (red accent). Universal +
            persisted; the api interceptor sends the mode on every request. */}
        <div
          title="INTER (inter-company) salesperson view — applies to every dashboard: include it with everyone, show only INTER, or remove INTER."
          style={{ display: 'inline-flex', border: '1px solid #dc2626', borderRadius: '8px', overflow: 'hidden' }}
        >
          {[['with', 'With INTER'], ['only', 'Only INTER'], ['exclude', 'No INTER']].map(([m, label], i) => (
            <button
              key={m}
              onClick={() => setInter(m)}
              style={{
                padding: '9px 12px', border: 'none', borderLeft: i === 0 ? 'none' : '1px solid #dc2626',
                background: interMode === m ? '#dc2626' : '#fff', color: interMode === m ? '#fff' : '#dc2626',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <AppliedFilters filters={filters} onFilterChange={onFilterChange} />
    </>
  );
};

// Field labels + how each active filter is rendered as a removable chip below the bar.
// Labels are the client-facing names (Company / Category / Sub-Category / Variants / …).
const CHIP_LABELS = {
  company: 'Company', branch: 'Branch', master: 'Master', group: 'Category', category: 'Sub-Category',
  grade: 'Grade', group1: 'Variants', thickness: 'Thickness / Section', colour: 'Colours',
  zone: 'Zone', state: 'State', salesperson: 'Salesperson', product: 'Product',
  dimensions: 'Size', city: 'City'
};

const AppliedFilters = ({ filters, onFilterChange }) => {
  const chips = [];
  if (filters.startDate) chips.push({ key: 'startDate', scalar: true, text: `From ${filters.startDate}` });
  if (filters.endDate) chips.push({ key: 'endDate', scalar: true, text: `To ${filters.endDate}` });

  Object.entries(CHIP_LABELS).forEach(([key, label]) => {
    const v = filters[key];
    if (Array.isArray(v)) {
      v.forEach(val => chips.push({ key, val, text: `${label}: ${val}` }));
    } else if (v) {
      chips.push({ key, scalar: true, text: `${label}: ${v}` });
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
    colour: [], thickness: [], format: '', product: '', dimensions: '', city: '', group: [],
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
