import React from 'react';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  className = '',
  disabled = false,
  type = 'button'
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-100/50 focus:ring-offset-2";
  
  const variantStyles = {
    primary: "bg-gradient-to-r from-primary-100 to-primary-200 text-white hover:shadow-md hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:transform-none disabled:hover:shadow-none",
    secondary: "bg-bg-200 text-text-100 hover:bg-bg-300 hover:shadow-sm hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:transform-none disabled:hover:shadow-none",
    outline: "border border-border/40 bg-transparent text-text-100 hover:border-primary-100/30 hover:bg-bg-200/70 hover:shadow-sm hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:transform-none disabled:hover:shadow-none"
  };
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
