import React from 'react';

const SectionCard = ({ title, description, children, className = '' }) => {
  return (
    <div className={`enhanced-card mb-8 animate-slide-up ${className}`}>
      {(title || description) && (
        <div className="mb-5">
          {title && <h2 className="text-xl font-semibold text-text-100">{title}</h2>}
          {description && <p className="mt-2 text-text-200">{description}</p>}
        </div>
      )}
      <div className="content-spacing">{children}</div>
    </div>
  );
};

export default SectionCard;
