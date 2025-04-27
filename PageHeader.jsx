import React from 'react';

const PageHeader = ({ title, description }) => {
  return (
    <div className="mb-8 animate-fade-in">
      <h1 className="text-2xl font-bold text-text-100 md:text-3xl">{title}</h1>
      {description && <p className="mt-3 text-text-200">{description}</p>}
    </div>
  );
};

export default PageHeader;
