import React from 'react';
import { Slider as AntSlider } from 'antd';

const Slider = ({ label, min, max, value, onChange, step = 1, className = '', id }) => {
  const sliderId = id || `slider-${label || 'range'}`;
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label htmlFor={sliderId} className="block text-sm font-medium text-text-100">{label}</label>}
      <AntSlider id={sliderId} min={min} max={max} value={value} step={step} onChange={(v)=>onChange(Number(v))} />
      <div className="flex justify-between text-xs text-text-200">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

export default Slider;