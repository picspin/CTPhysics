# Test info

- Name: PCCT (Photon-Counting CT) page and simulator interactions >> renders parallel simulator slices
- Location: /home/hilbert/clawd/agents/mills/CTPhysics/e2e/pcct.spec.ts:17:7

# Error details

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/pcct", waiting until "load"

    at /home/hilbert/clawd/agents/mills/CTPhysics/e2e/pcct.spec.ts:5:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('PCCT (Photon-Counting CT) page and simulator interactions', () => {
   4 |   test.beforeEach(async ({ page }) => {
>  5 |     await page.goto('http://localhost:3000/pcct');
     |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
   6 |   });
   7 |
   8 |   test('renders page layout and core concept list', async ({ page }) => {
   9 |     await expect(page.locator('h1').last()).toContainText('光子计数CT (PCCT) 物理孪生模拟');
  10 |     
  11 |     // Check KeyPoints section
  12 |     const keyPoints = page.locator('div.mt-6 ul > li');
  13 |     await expect(keyPoints).toHaveCount(4);
  14 |     await expect(keyPoints.first()).toContainText('半导体直接转换探测器');
  15 |   });
  16 |
  17 |   test('renders parallel simulator slices', async ({ page }) => {
  18 |     // EID vs PCCT Canvas renderers
  19 |     const canvases = page.locator('canvas');
  20 |     await expect(canvases).toHaveCount(3);
  21 |   });
  22 |
  23 |   test('switches tabs and checks panels', async ({ page }) => {
  24 |     // Check default visible text
  25 |     await expect(page.locator('h3', { hasText: '重建图像对比：冠状动脉 CTA' })).toBeVisible();
  26 |
  27 |     // Click on Detector layer tab
  28 |     await page.click('button:has-text("探测器层")');
  29 |     await expect(page.locator('h3', { hasText: '探测器能级分桶 (Energy Binning)' })).toBeVisible();
  30 |
  31 |     // Verify sliders for thresholds appear in detector tab
  32 |     const sliders = page.locator('input[type="range"]');
  33 |     // Original 5 sliders + 3 thresholds = 8
  34 |     await expect(sliders).toHaveCount(8);
  35 |
  36 |     // Verify Recharts SVG Energy spectrum line chart is rendered
  37 |     await expect(page.locator('.recharts-responsive-container')).toBeVisible();
  38 |
  39 |     // Click on Material Decomposition tab
  40 |     await page.click('button:has-text("物质分解")');
  41 |     await expect(page.locator('h3', { hasText: '能谱物质分解' })).toBeVisible();
  42 |     
  43 |     // Select active material channel buttons
  44 |     await expect(page.locator('button', { hasText: 'composite' })).toBeVisible();
  45 |     await expect(page.locator('button', { hasText: 'iodine' })).toBeVisible();
  46 |   });
  47 | });
  48 |
```