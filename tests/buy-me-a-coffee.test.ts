import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { zh } from '@/i18n/zh';

const PAYMENT_URL = 'https://buymeacoffee.com/zxl14126';

describe('Buy Me a Coffee badge', () => {
  it('points at the project payment page and is linked from the homepage only', () => {
    expect(zh.land_bmc_label.length).toBeGreaterThan(0);
    expect(en.land_bmc_label.toLowerCase()).toContain('coffee');
    expect(zh.land_bmc_hint.length).toBeGreaterThan(0);
    expect(en.land_bmc_hint.length).toBeGreaterThan(0);

    const landing = readFileSync('app/(landing)/page.tsx', 'utf8');
    expect(landing).toContain('BuyMeACoffeeBadge');

    const badge = readFileSync('components/hero/BuyMeACoffeeBadge.tsx', 'utf8');
    expect(badge).toContain(`export const BUY_ME_A_COFFEE_URL = '${PAYMENT_URL}'`);
    expect(badge).toContain('rel="noopener noreferrer"');
    expect(badge).toContain('target="_blank"');
    expect(badge).toContain("t('land_bmc_label')");
    expect(badge).toContain("t('land_bmc_hint')");

    const mainLayout = readFileSync('app/(main)/layout.tsx', 'utf8');
    expect(mainLayout).not.toContain('BuyMeACoffeeBadge');
  });

  it('renders Vercel Web Analytics from the root layout', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    expect(layout).toContain("import { Analytics } from '@vercel/analytics/next'");
    expect(layout).toContain('<Analytics />');
  });
});
