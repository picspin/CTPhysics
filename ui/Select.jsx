import React from 'react';

const Select = ({ label, options, value, onChange, className = '' }) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="block text-sm font-medium text-text-100">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-bg-100 px-3 py-2 text-sm text-text-100 shadow-sm focus:border-primary-100 focus:outline-none focus:ring-1 focus:ring-primary-100"
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