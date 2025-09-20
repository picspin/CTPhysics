import React from 'react';

type InfoTooltipProps = {
  label: string;
  children?: React.ReactNode;
};

export default function InfoTooltip({ label, children }: InfoTooltipProps) {
  return (
    <span className="relative inline-flex items-center">
      <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-100/10 text-primary-100" aria-label={label} role="img" tabIndex={0}>
        i
      </span>
      {children && (
        <span className="pointer-events-none absolute left-6 top-1/2 z-10 hidden -translate-y-1/2 rounded-md border border-border bg-bg-100 px-2 py-1 text-xs text-text-100 shadow-md md:block">
          {children}
        </span>
      )}
    </span>
  );
}

