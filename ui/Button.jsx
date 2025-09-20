import React from 'react';
import { Button as AntButton } from 'antd';

const Button = ({ children, onClick, disabled = false, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <AntButton onClick={onClick} disabled={disabled} size={size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'middle'} className={className} type="primary">
      {children}
    </AntButton>
  );
};

export default Button;