import React, { useState } from 'react';

const Slider = ({ 
  label, 
  min, 
  max, 
  value, 
  onChange, 
  step = 1, 
  className = '' 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className={`${className}`}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-text-100">
          {label}
        </label>
      )}
      <div className="relative pt-1">
        <div className="relative h-2 w-full rounded-full bg-bg-200">
          <div 
            className="absolute h-full rounded-full bg-gradient-to-r from-primary-100 to-primary-200 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="absolute inset-0 h-2 w-full cursor-pointer appearance-none bg-transparent focus:outline-none"
        />
        <div 
          className={`absolute -mt-1 h-4 w-4 rounded-full bg-white shadow-md transition-all duration-300 ${
            isFocused ? 'ring-4 ring-primary-100/30' : ''
          }`}
          style={{ 
            left: `calc(${percentage}% - 0.5rem)`,
            top: '0.25rem'
          }}
        ></div>
        <div className="mt-4 flex justify-between text-xs text-text-200">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
};

export default Slider;
