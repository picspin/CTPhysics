import React from 'react';
import { Select as AntSelect } from 'antd';

const Select = ({ label, options, value, onChange, className = '', id }) => {
  const selectId = id || `select-${label || 'field'}`;
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label htmlFor={selectId} className="block text-sm font-medium text-text-100">{label}</label>}
      <AntSelect
        id={selectId}
        value={value}
        onChange={(val) => onChange(val)}
        aria-label={label || 'select'}
        className="w-full"
        options={options.map((o)=>({ value: o.id || o.value, label: o.name }))}
      />
    </div>
  );
};

export default Select;