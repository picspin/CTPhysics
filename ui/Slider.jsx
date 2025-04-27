import React from 'react';

const Slider = ({ label, min, max, value, onChange, step = 1, className = '' }) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="block text-sm font-medium text-text-100">{label}</label>}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={step}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-200 accent-primary-100"
      />
      <div className="flex justify-between text-xs text-text-200">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

export default Slider;