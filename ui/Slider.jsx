import React from 'react';

const Slider = ({ label, min, max, value, onChange, step = 1, className = '', id }) => {
  const sliderId = id || `slider-${label || 'range'}`;
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label htmlFor={sliderId} className="block text-sm font-medium text-text-100">{label}</label>}
      <input
        type="range"
        id={sliderId}
        min={min}
        max={max}
        value={value}
        step={step}
        onChange={(e) => onChange(parseInt(e.target.value))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-bg-200 accent-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-200"
      />
      <div className="flex justify-between text-xs text-text-200">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

export default Slider;