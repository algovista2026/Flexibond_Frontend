import React from 'react';
import { FiInfo } from 'react-icons/fi';
import MultiSelect from './MultiSelect';

const FilterBar = ({ filters, options, onFilterChange, hideSalesperson = false }) => {
  return (
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

      {!hideSalesperson && options?.salespersons && options.salespersons.length > 0 && (
        <MultiSelect
          label="All Salespersons"
          options={options.salespersons}
          selected={filters.salesperson}
          onChange={(vals) => onFilterChange({ salesperson: vals })}
        />
      )}

      {options?.categories && options.categories.length > 0 && (
        <MultiSelect
          label="All Categories"
          options={options.categories}
          selected={filters.category}
          onChange={(vals) => onFilterChange({ category: vals })}
        />
      )}

      {options?.states && options.states.length > 0 && (
        <MultiSelect
          label="All States"
          options={options.states}
          selected={filters.state}
          onChange={(vals) => onFilterChange({ state: vals })}
        />
      )}

      {options?.grades && options.grades.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MultiSelect
            label="All Grades"
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

      {options?.zones && options.zones.length > 0 && (
        <MultiSelect
          label="All Zones"
          options={options.zones}
          selected={filters.zone}
          onChange={(vals) => onFilterChange({ zone: vals })}
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
          startDate: '', endDate: '', salesperson: [], category: [], state: [], grade: [], zone: [], format: ''
        }, true)}
      >
        Clear Filters
      </button>
    </div>
  );
};

export default FilterBar;
