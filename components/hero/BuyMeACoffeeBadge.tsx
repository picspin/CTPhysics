'use client';

import React, { useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

export const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/zxl14126';

const tooltipId = 'buy-me-a-coffee-tooltip';

function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

/**
 * Homepage support badge. Mouse hover and keyboard focus reveal the payment
 * URL, and a click follows it. On a touch screen the first tap only reveals
 * the URL; the next tap opens it.
 */
export default function BuyMeACoffeeBadge() {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  const open = hovered || focused || revealed;

  return (
    <a
      href={BUY_ME_A_COFFEE_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="bmc-badge"
      aria-describedby={tooltipId}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={(event) => {
        if (revealedRef.current || !isCoarsePointer()) return;
        event.preventDefault();
        revealedRef.current = true;
        setRevealed(true);
      }}
      className="fixed bottom-5 right-5 z-40 block w-max max-w-[calc(100vw-2.5rem)] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#FFDD00] focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:bottom-6 sm:right-6"
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#FFDD00] px-3.5 py-2 text-sm font-semibold text-zinc-950 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:brightness-105">
        <span aria-hidden="true" className="text-base leading-none">
          ☕
        </span>
        <span>{t('land_bmc_label')}</span>
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        data-state={open ? 'open' : 'closed'}
        aria-hidden={open ? undefined : true}
        className={`absolute bottom-full right-0 mb-2 block w-max max-w-[min(18rem,calc(100vw-2.5rem))] rounded-xl border border-white/15 bg-zinc-950/95 px-3 py-2 text-left shadow-xl backdrop-blur-md transition duration-150 ${
          open ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'
        }`}
      >
        <span className="block text-xs font-medium text-[#FFDD00]">{t('land_bmc_hint')}</span>
        <span className="mt-1 block break-all font-mono text-[11px] leading-snug text-sky-100">{BUY_ME_A_COFFEE_URL}</span>
      </span>
    </a>
  );
}
