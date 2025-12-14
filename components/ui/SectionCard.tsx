import React from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, description, children, className = '' }) => {
  return (
    <div className={`glass-card mb-8 animate-slide-up ${className}`}>
      {(title || description) && (
        <div className="mb-5">
          {title && <h2 className="text-xl font-semibold text-white">{title}</h2>}
          {description && <p className="mt-2 text-white/80">{description}</p>}
        </div>
      )}
      <div className="content-spacing">{children}</div>
    </div>
  );
};

export default SectionCard;
