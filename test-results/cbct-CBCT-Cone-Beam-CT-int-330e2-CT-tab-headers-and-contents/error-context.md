# Test info

- Name: CBCT (Cone-Beam CT) integration inside Reconstruction page >> renders CBCT tab headers and contents
- Location: /home/hilbert/clawd/agents/mills/CTPhysics/e2e/cbct.spec.ts:11:7

# Error details

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/reconstruction", waiting until "load"

    at /home/hilbert/clawd/agents/mills/CTPhysics/e2e/cbct.spec.ts:6:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('CBCT (Cone-Beam CT) integration inside Reconstruction page', () => {
   4 |   test.beforeEach(async ({ page }) => {
   5 |     // Navigate to reconstruction page
>  6 |     await page.goto('http://localhost:3000/reconstruction');
     |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
   7 |     // Switch to CBCT Tab
   8 |     await page.locator('main button').filter({ hasText: '锥束CT (CBCT)' }).click();
   9 |   });
  10 |
  11 |   test('renders CBCT tab headers and contents', async ({ page }) => {
  12 |     await expect(page.locator('h3', { hasText: '锥束CT (Cone Beam CT) 物理原理' })).toBeVisible();
  13 |     await expect(page.locator('h3', { hasText: '锥束CT物理模拟' })).toBeVisible();
  14 |   });
  15 |
  16 |   test('interacts with CBCT parameters controls inside tab', async ({ page }) => {
  17 |     // Check Select component for phantom choice
  18 |     const phantomSelect = page.locator('select').first();
  19 |     await expect(phantomSelect).toBeVisible();
  20 |     await expect(phantomSelect).toHaveValue('dental');
  21 |
  22 |     // Check sliders presence (Cone Angle, Pixel Size, kVp, Dose, Rotation)
  23 |     const sliders = page.locator('input[type="range"]');
  24 |     // We expect sliders from Helical, BP etc. to be there or tab-isolated depending on rendering,
  25 |     // let's just make sure there are active range inputs
  26 |     await expect(sliders.count()).resolves.toBeGreaterThanOrEqual(5);
  27 |   });
  28 |
  29 |   test('starts and stops auto-scanning animation', async ({ page }) => {
  30 |     const scanButton = page.locator('button', { hasText: '启动自动扫描' });
  31 |     await expect(scanButton).toBeVisible();
  32 |
  33 |     // Click to start scanning
  34 |     await scanButton.click();
  35 |     await expect(page.locator('button', { hasText: '暂停扫描' })).toBeVisible();
  36 |
  37 |     // Click to stop
  38 |     await page.locator('button', { hasText: '暂停扫描' }).click();
  39 |     await expect(page.locator('button', { hasText: '启动自动扫描' })).toBeVisible();
  40 |   });
  41 |
  42 |   test('renders simulation canvases for CBCT', async ({ page }) => {
  43 |     // Project canvas + axial canvas + coronal canvas = 3 canvases when CBCT active
  44 |     const canvases = page.locator('canvas');
  45 |     await expect(canvases.count()).resolves.toBeGreaterThanOrEqual(3);
  46 |   });
  47 | });
  48 |
```