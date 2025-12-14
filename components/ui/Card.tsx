import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
    return (
        <div className={`glass-card border border-white/15 shadow-sm overflow-hidden ${className}`}>
            {title && (
                <div className="px-4 py-3 border-b border-white/10 bg-white/10">
                    <h3 className="font-semibold text-white text-sm uppercase tracking-wider">{title}</h3>
                </div>
            )}
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};
