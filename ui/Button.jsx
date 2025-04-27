import React from 'react';

const Button = ({ children, onClick, disabled = false, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md bg-primary-100 ${sizeClasses[size]} font-medium text-white shadow-sm transition-colors hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;