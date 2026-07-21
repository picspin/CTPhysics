import { test, expect } from '@playwright/test';

test.describe('PCCT (Photon-Counting CT) page and simulator interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/pcct');
  });

  test('renders page layout and core concept list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('光子计数CT (PCCT) 物理孪生模拟');
    
    // Check KeyPoints section
    const keyPoints = page.locator('ul > li');
    await expect(keyPoints).toHaveCount(4);
    await expect(keyPoints.first()).toContainText('半导体直接转换探测器');
  });

  test('renders parallel simulator slices', async ({ page }) => {
    // EID vs PCCT Canvas renderers
    const canvases = page.locator('canvas');
    await expect(canvases).toHaveCount(3);
  });

  test('switches tabs and checks panels', async ({ page }) => {
    // Check default visible text
    await expect(page.locator('h3', { hasText: '重建图像对比：冠状动脉 CTA' })).toBeVisible();

    // Click on Detector layer tab
    await page.click('button:has-text("探测器层")');
    await expect(page.locator('h3', { hasText: '探测器能级分桶 (Energy Binning)' })).toBeVisible();

    // Verify sliders for thresholds appear in detector tab
    const sliders = page.locator('input[type="range"]');
    // Original 5 sliders + 3 thresholds = 8
    await expect(sliders).toHaveCount(8);

    // Verify Recharts SVG Energy spectrum line chart is rendered
    await expect(page.locator('.recharts-responsive-container')).toBeVisible();

    // Click on Material Decomposition tab
    await page.click('button:has-text("物质分解")');
    await expect(page.locator('h3', { hasText: '能谱物质分解' })).toBeVisible();
    
    // Select active material channel buttons
    await expect(page.locator('button', { hasText: 'composite' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'iodine' })).toBeVisible();
  });
});
