import React from 'react';

const TabGroup = ({ 
  tabs, 
  activeTab, 
  onChange, 
  className = '' 
}) => {
  return (
    <div className={`mb-6 overflow-x-auto ${className}`}>
      <div className="flex space-x-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
              activeTab === tab.id
                ? 'bg-primary-100 text-white shadow-md'
<<<<<<< HEAD
                : 'bg-200/70 text-text-200 hover:bg-300/50 hover:text-text-100'
=======
                : 'bg-bg-200/70 text-text-200 hover:bg-bg-300/50 hover:text-text-100'
>>>>>>> 5cc269c7d7bb3e0f9bea78d37883bea822dffc4c
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-2 h-0.5 w-full bg-bg-300/50">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`h-full transition-all duration-300 ${
              activeTab === tab.id ? 'bg-primary-100' : 'bg-transparent'
            }`}
            style={{
              width: `${100 / tabs.length}%`,
              transform: `translateX(${
                tabs.findIndex((t) => t.id === activeTab) * 100
              }%)`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default TabGroup;
