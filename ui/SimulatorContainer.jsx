import React from 'react';

const SimulatorContainer = ({ title, children, className = '' }) => {
  return (
    <div className={`gradient-border mt-6 overflow-hidden ${className}`}>
      <div className="rounded-xl bg-bg-100 shadow-md">
        {title && (
          <div className="border-b border-border/20 bg-gradient-to-r from-primary-100 to-accent-100 px-5 py-3">
            <h3 className="font-semibold text-white drop-shadow">{title}</h3>
          </div>
        )}
        <div className="p-5 simulator-container">{children}</div>
      </div>
    </div>
  );
};

export default SimulatorContainer;