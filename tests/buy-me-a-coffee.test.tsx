// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BuyMeACoffeeBadge from '@/components/hero/BuyMeACoffeeBadge';
import { LanguageProvider } from '@/context/LanguageContext';
import { useLanguage } from '@/context/LanguageContext';
import { en } from '@/i18n/en';
import { zh } from '@/i18n/zh';

const PAYMENT_URL = 'https://buymeacoffee.com/zxl14126';

function setCoarsePointer(coarse: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: coarse,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function LanguageToggle() {
  const { setLanguage } = useLanguage();
  return (
    <button type="button" onClick={() => setLanguage('en')}>
      toggle
    </button>
  );
}

function renderBadge() {
  localStorage.clear();
    return render(
    <LanguageProvider>
      <LanguageToggle />
      <BuyMeACoffeeBadge />
    </LanguageProvider>,
  );
}

function tooltip(): HTMLElement {
  const node = document.getElementById('buy-me-a-coffee-tooltip');
  if (!node) throw new Error('payment tooltip is missing');
  return node;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Buy Me a Coffee badge', () => {
  it('links to the payment page without a native title tooltip', () => {
    setCoarsePointer(false);
    renderBadge();
    const link = screen.getByTestId('bmc-badge');

    expect(link.getAttribute('href')).toBe(PAYMENT_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.hasAttribute('title')).toBe(false);
    expect(link.textContent).toContain(zh.land_bmc_label);
    expect(tooltip().textContent).toContain(zh.land_bmc_hint);
    expect(tooltip().textContent).toContain(PAYMENT_URL);
    expect(tooltip().getAttribute('data-state')).toBe('closed');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('bmc-badge').textContent).toContain(en.land_bmc_label);
    expect(tooltip().textContent).toContain(en.land_bmc_hint);
    expect(tooltip().textContent).not.toContain(zh.land_bmc_hint);
  });

  it('shows the payment URL on mouse hover and hides it when the pointer leaves', () => {
    setCoarsePointer(false);
    renderBadge();
    const link = screen.getByTestId('bmc-badge');

    fireEvent.mouseEnter(link);
    expect(tooltip().getAttribute('data-state')).toBe('open');
    expect(tooltip().textContent).toContain(PAYMENT_URL);
    expect(fireEvent.click(link)).toBe(true);

    fireEvent.mouseLeave(link);
    expect(tooltip().getAttribute('data-state')).toBe('closed');
  });

  it('reveals the payment URL on the first touch tap and follows the link on the next tap', () => {
    setCoarsePointer(true);
    renderBadge();
    const link = screen.getByTestId('bmc-badge');

    fireEvent.pointerEnter(link, { pointerType: 'touch' });
    expect(tooltip().getAttribute('data-state')).toBe('closed');

    // A tap focuses the control before the click. The URL must appear, and this
    // activation must not navigate.
    fireEvent.focus(link);
    expect(fireEvent.click(link)).toBe(false);
    expect(link.getAttribute('href')).toBe(PAYMENT_URL);
    expect(tooltip().getAttribute('data-state')).toBe('open');
    expect(tooltip().textContent).toContain(zh.land_bmc_hint);
    expect(tooltip().textContent).toContain(PAYMENT_URL);

    expect(fireEvent.click(link)).toBe(true);
  });

  it('is mounted on the homepage only, with analytics in the root layout', () => {
    const landing = readFileSync('app/(landing)/page.tsx', 'utf8');
    const mainLayout = readFileSync('app/(main)/layout.tsx', 'utf8');
    const layout = readFileSync('app/layout.tsx', 'utf8');

    expect(landing).toContain('BuyMeACoffeeBadge');
    expect(mainLayout).not.toContain('BuyMeACoffeeBadge');
    expect(layout).toContain("import { Analytics } from '@vercel/analytics/next'");
    expect(layout).toContain('<Analytics />');
  });
});
