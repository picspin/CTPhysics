import React from 'react';

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  valueDisplay?: string | number;
}

export const Slider: React.FC<SliderProps> = ({ label, valueDisplay, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(label || valueDisplay !== undefined) && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          {label && <span>{label}</span>}
          {valueDisplay !== undefined && <span className="font-bold text-[var(--sim-accent)]">{valueDisplay}</span>}
        </div>
      )}
      <input
        type="range"
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--sim-accent)]"
        {...props}
      />
    </div>
  );
};
