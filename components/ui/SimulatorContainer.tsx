import React from 'react';

interface SimulatorContainerProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  helpContent?: React.ReactNode;
}

const SimulatorContainer: React.FC<SimulatorContainerProps> = ({ title, description, children, className = '', helpContent }) => {
  return (
    <div className={`mt-6 overflow-hidden ${className}`}>
      <div className="rounded-xl bg-bg-100 shadow-md">
        {title && (
          <div className="border-b border-border/20 bg-gradient-to-r from-primary-100 to-primary-200 px-5 py-3 text-white">
            <h3 className="font-medium">{title}</h3>
            {description && <p className="text-sm text-white/80 mt-1">{description}</p>}
          </div>
        )}
        <div className="p-5">
          {helpContent && (
            <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-200">
              {helpContent}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};

export default SimulatorContainer;
