import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
    return (
        <div className={`bg-bg-100 dark:bg-[#252525] rounded-xl border border-border-100 dark:border-[#444] shadow-sm overflow-hidden ${className}`}>
            {title && (
                <div className="px-4 py-3 border-b border-border-100 dark:border-[#444] bg-bg-200 dark:bg-[#333]">
                    <h3 className="font-semibold text-text-100 dark:text-white text-sm uppercase tracking-wider">{title}</h3>
                </div>
            )}
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};
