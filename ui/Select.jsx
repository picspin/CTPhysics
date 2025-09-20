import React from 'react';

const Select = ({ label, options, value, onChange, className = '', id }) => {
  const selectId = id || `select-${label || 'field'}`;
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label htmlFor={selectId} className="block text-sm font-medium text-text-100">{label}</label>}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label || 'select'}
        className="w-full rounded-md border border-border bg-bg-100 px-3 py-2 text-sm text-text-100 shadow-sm focus:border-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-200"
      >
        {options.map((option) => (
          <option key={option.id || option.value} value={option.id || option.value}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;