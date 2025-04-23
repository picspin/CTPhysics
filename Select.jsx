import React from 'react';

const Select = ({ 
  label, 
  options, 
  value, 
  onChange, 
  className = '' 
}) => {
  return (
    <div className={`${className}`}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-text-100">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-border/40 bg-bg-100 px-4 py-2.5 pr-10 text-sm text-text-100 shadow-sm transition-all duration-300 focus:border-primary-100/50 focus:outline-none focus:ring-2 focus:ring-primary-100/20"
        >
          {options.map((option) => (
            <option key={option.id || option.value} value={option.id || option.value}>
              {option.name || option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-200">
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Select;
