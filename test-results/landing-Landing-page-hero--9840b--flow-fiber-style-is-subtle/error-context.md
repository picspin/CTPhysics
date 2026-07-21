# Test info

- Name: Landing page hero and orbit interactions >> flow fiber style is subtle
- Location: /home/hilbert/clawd/agents/mills/CTPhysics/e2e/landing.spec.ts:25:7

# Error details

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

    at /home/hilbert/clawd/agents/mills/CTPhysics/e2e/landing.spec.ts:26:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Landing page hero and orbit interactions', () => {
   4 |   test('renders hero background image', async ({ page }) => {
   5 |     await page.goto('http://localhost:3000/');
   6 |     const bg = page.getByTestId('hero-background');
   7 |     await expect(bg).toBeVisible();
   8 |     const style = await bg.evaluate((el) => getComputedStyle(el).backgroundImage);
   9 |     expect(style).toContain('/images/ct-hero.jpg');
  10 |   });
  11 |
  12 |   test('center hover accelerates satellite orbit', async ({ page }) => {
  13 |     await page.goto('http://localhost:3000/');
  14 |     const orbit = page.getByTestId('orbit-container');
  15 |
  16 |     const hasHook = await page.evaluate(() => Boolean((window as Window & { __setCenterHover?: (val: boolean) => void }).__setCenterHover));
  17 |     if (!hasHook) test.skip(true, 'control hook not available');
  18 |
  19 |     await expect(orbit).toHaveAttribute('data-speed', 'normal');
  20 |     await page.evaluate(() => (window as Window & { __setCenterHover?: (val: boolean) => void }).__setCenterHover?.(true));
  21 |     await page.waitForTimeout(200);
  22 |     await expect(orbit).toHaveAttribute('data-speed', 'fast');
  23 |   });
  24 |
  25 |   test('flow fiber style is subtle', async ({ page }) => {
> 26 |     await page.goto('http://localhost:3000/');
     |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  27 |     const bg = page.getByTestId('hero-background');
  28 |     await expect(bg).toHaveAttribute('data-flow-style', 'particle-s-curve');
  29 |   });
  30 | });
```