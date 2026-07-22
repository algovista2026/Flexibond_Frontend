import React from 'react';
import { FiInfo, FiX } from 'react-icons/fi';
import MultiSelect from './MultiSelect';

const FilterBar = ({ filters, options, onFilterChange, hideSalesperson = false, showGroup = false }) => {
  return (
    <>
      <div className="filter-bar">
      <input
        type={filters.startDate ? "date" : "text"}
        name="startDate"
        value={filters.startDate || ''}
        onChange={(e) => onFilterChange({ startDate: e.target.value })}
        onFocus={(e) => (e.target.type = "date")}
        onBlur={(e) => !e.target.value && (e.target.type = "text")}
        placeholder="Start Date"
        style={{ height: '42px' }}
      />
      <input
        type={filters.endDate ? "date" : "text"}
        name="endDate"
        value={filters.endDate || ''}
        onChange={(e) => onFilterChange({ endDate: e.target.value })}
        onFocus={(e) => (e.target.type = "date")}
        onBlur={(e) => !e.target.value && (e.target.type = "text")}
        placeholder="End Date"
        style={{ height: '42px' }}
      />

      {/* Master — the headline product classification. Placed first (next to the dates) and
          styled prominently in amber so it stands out from the other filters. */}
      {options?.masters && options.masters.length > 0 && (
        <MultiSelect
          label="Master"
          options={options.masters}
          selected={filters.master}
          accent="#d97706"
          onChange={(vals) => onFilterChange({ master: vals })}
        />
      )}

      {!hideSalesperson && options?.salespersons && options.salespersons.length > 0 && (
        <MultiSelect
          label="Sales man"
          options={options.salespersons}
          selected={filters.salesperson}
          onChange={(vals) => onFilterChange({ salesperson: vals })}
        />
      )}

      {options?.categories && options.categories.length > 0 && (
        <MultiSelect
          label="Categry"
          options={options.categories}
          selected={filters.category}
          onChange={(vals) => onFilterChange({ category: vals })}
        />
      )}

      {options?.states && options.states.length > 0 && (
        <MultiSelect
          label="State"
          options={options.states}
          selected={filters.state}
          onChange={(vals) => onFilterChange({ state: vals })}
        />
      )}

      {options?.grades && options.grades.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MultiSelect
            label="Grade"
            options={options.grades}
            selected={filters.grade}
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

      {/* Group is now universal (all pages), not Products-only. Sourced from the "TYpe1"
          column now (was "Group"); labelled to match the sheet. */}
      {options?.groups && options.groups.length > 0 && (
        <MultiSelect
          label="TYpe1"
          options={options.groups}
          selected={filters.group}
          onChange={(vals) => onFilterChange({ group: vals })}
        />
      )}

      {options?.group1s && options.group1s.length > 0 && (
        <MultiSelect
          label="TYpe2"
          options={options.group1s}
          selected={filters.group1}
          onChange={(vals) => onFilterChange({ group1: vals })}
        />
      )}

      {options?.zones && options.zones.length > 0 && (
        <MultiSelect
          label="Zone"
          options={options.zones}
          selected={filters.zone}
          onChange={(vals) => onFilterChange({ zone: vals })}
        />
      )}

      {options?.colours && options.colours.length > 0 && (
        <MultiSelect
          label="Colour"
          options={options.colours}
          selected={filters.colour}
          onChange={(vals) => onFilterChange({ colour: vals })}
        />
      )}

      {options?.thickness && options.thickness.length > 0 && (
        <MultiSelect
          label="Type"
          options={options.thickness}
          selected={filters.thickness}
          onChange={(vals) => onFilterChange({ thickness: vals })}
        />
      )}

      {/* Old-vs-new data comparison toggle (single-select) */}
      <select
        value={filters.format || ''}
        onChange={(e) => onFilterChange({ format: e.target.value })}
        title="Data format"
      >
        <option value="">All Data</option>
        <option value="segregated">New format</option>
        <option value="legacy">Legacy format</option>
      </select>

      <button
        className="btn-secondary"
        onClick={() => onFilterChange({
          startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [],
          colour: [], thickness: [], format: '', product: '', dimensions: '', city: '', group: [],
          group1: [], master: []
        }, true)}
      >
        Clear Filters
      </button>
      </div>

      <AppliedFilters filters={filters} onFilterChange={onFilterChange} />
    </>
  );
};

// Field labels + how each active filter is rendered as a removable chip below the bar.
// Labels mirror the real spreadsheet column names (temporary — see imp.md).
const CHIP_LABELS = {
  salesperson: 'Sales man', category: 'Categry', state: 'State', grade: 'Grade',
  zone: 'Zone', colour: 'Colour', thickness: 'Type', product: 'Product',
  dimensions: 'Size', city: 'City', group: 'TYpe1', group1: 'TYpe2', master: 'Master'
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
  if (filters.format) {
    chips.push({ key: 'format', scalar: true, text: `Format: ${filters.format === 'segregated' ? 'New' : 'Legacy'}` });
  }

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
    group1: [], master: []
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
