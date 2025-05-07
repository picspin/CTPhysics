import React from 'react';

const KeyPoints = ({ points }) => {
  if (!points || points.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl bg-bg-200 bg-opacity-70 p-5 backdrop-blur-sm">
      <h3 className="mb-3 font-semibold text-text-100">要点</h3>
      <ul className="space-y-2 text-text-200">
        {points.map((point, index) => (
          <li key={index} className="flex items-start">
            <span className="mr-2 mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 bg-opacity-20 text-xs text-primary-200">
              {index + 1}
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default KeyPoints;
