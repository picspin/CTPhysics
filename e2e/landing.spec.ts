import { test, expect } from '@playwright/test';

test.describe('Landing page hero and orbit interactions', () => {
  test('renders hero background image', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const bg = page.getByTestId('hero-background');
    await expect(bg).toBeVisible();
    const style = await bg.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(style).toContain('/images/ct-hero.jpg');
  });

  test('center hover accelerates satellite orbit', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const orbit = page.getByTestId('orbit-container');

    const hasHook = await page.evaluate(() => Boolean((window as Window & { __setCenterHover?: (val: boolean) => void }).__setCenterHover));
    if (!hasHook) test.skip(true, 'control hook not available');

    await expect(orbit).toHaveAttribute('data-speed', 'normal');
    await page.evaluate(() => (window as Window & { __setCenterHover?: (val: boolean) => void }).__setCenterHover?.(true));
    await page.waitForTimeout(200);
    await expect(orbit).toHaveAttribute('data-speed', 'fast');
  });

  test('flow fiber style is subtle', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const bg = page.getByTestId('hero-background');
    await expect(bg).toHaveAttribute('data-flow-style', 'particle-s-curve');
  });
});