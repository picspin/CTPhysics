# Test info

- Name: Landing page hero and orbit interactions >> center hover accelerates satellite orbit
- Location: E:\Projects\CTPhysics\e2e\landing.spec.ts:12:7

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toHaveAttribute(expected)

Locator: getByTestId('orbit-container')
Expected string: "fast"
Received string: "normal"
Call log:
  - expect.toHaveAttribute with timeout 5000ms
  - waiting for getByTestId('orbit-container')
    9 × locator resolved to <div data-speed="normal" data-testid="orbit-container" class="relative w-full h-full flex items-center justify-center pointer-events-none">…</div>
      - unexpected value "normal"

    at E:\Projects\CTPhysics\e2e\landing.spec.ts:19:25
```

# Page snapshot

```yaml
- main:
  - navigation:
    - text: CT PHYSICS
    - link "CT Reconst":
      - /url: /reconstruction
      - text: CT Reconst
      - img
    - link "Dose Safe":
      - /url: /dose
      - text: Dose Safe
      - img
    - link "Cardiac CT":
      - /url: /cardiac
      - text: Cardiac CT
      - img
    - link "Spectral":
      - /url: /dual-energy
      - text: Spectral
      - img
    - link "Practice":
      - /url: /questions
      - text: Practice
      - img
    - img
  - heading "CT PHYSICS" [level=1]
  - paragraph: Next Gen Imaging Simulation
  - link "Reconstruction FBP, Helical & Kernels":
    - /url: /reconstruction
    - heading "Reconstruction" [level=3]
    - paragraph: FBP, Helical & Kernels
  - link "Dose & Safety CTDI, DLP & ALARA":
    - /url: /dose
    - heading "Dose & Safety" [level=3]
    - paragraph: CTDI, DLP & ALARA
  - link "Cardiac CT ECG Gating & 4D":
    - /url: /cardiac
    - heading "Cardiac CT" [level=3]
    - paragraph: ECG Gating & 4D
  - link "Dual Energy Spectral Analysis":
    - /url: /dual-energy
    - heading "Dual Energy" [level=3]
    - paragraph: Spectral Analysis
  - link "Quiz Base Test Knowledge":
    - /url: /questions
    - heading "Quiz Base" [level=3]
    - paragraph: Test Knowledge
  - link "Architecture System Design":
    - /url: /
    - heading "Architecture" [level=3]
    - paragraph: System Design
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
  16 |     await expect(orbit).toHaveAttribute('data-speed', 'normal');
  17 |     await page.evaluate(() => (window as any).__setCenterHover?.(true));
  18 |     await page.waitForTimeout(200);
> 19 |     await expect(orbit).toHaveAttribute('data-speed', 'fast');
     |                         ^ Error: Timed out 5000ms waiting for expect(locator).toHaveAttribute(expected)
  20 |   });
  21 | });
```