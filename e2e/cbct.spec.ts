import { test, expect } from '@playwright/test';

test.describe('CBCT (Cone-Beam CT) page and simulator interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the CBCT page
    await page.goto('http://localhost:3000/cbct');
  });

  test('renders page layout and key points', async ({ page }) => {
    // Check main headers and sub-elements
    await expect(page.locator('h1')).toContainText('锥形束CT (CBCT) 物理原理');
    
    // Key points summary section check
    const keyPoints = page.locator('ul > li');
    await expect(keyPoints).toHaveCount(4);
    await expect(keyPoints.first()).toContainText('锥形束CT (CBCT) 采用三维锥形射线');
  });

  test('interacts with CBCT parameters controls', async ({ page }) => {
    // Check Select component for phantom choice
    const phantomSelect = page.locator('select').first();
    await expect(phantomSelect).toBeVisible();
    await expect(phantomSelect).toHaveValue('dental');

    // Check sliders presence (Cone Angle, Pixel Size, kVp, Dose, Rotation)
    const sliders = page.locator('input[type="range"]');
    await expect(sliders).toHaveCount(5); // coneAngle, detectorPixelSize, kVp, dose, pitchRotationAngle
  });

  test('starts and stops auto-scanning animation', async ({ page }) => {
    const scanButton = page.locator('button', { hasText: '启动自动扫描' });
    await expect(scanButton).toBeVisible();

    // Click to start scanning
    await scanButton.click();
    await expect(page.locator('button', { hasText: '暂停扫描' })).toBeVisible();

    // Click to stop
    await page.locator('button', { hasText: '暂停扫描' }).click();
    await expect(page.locator('button', { hasText: '启动自动扫描' })).toBeVisible();
  });

  test('renders simulation canvases', async ({ page }) => {
    // We expect three canvases: 2D detector projection, 3D Axial, and 3D Coronal reconstructions
    const canvases = page.locator('canvas');
    await expect(canvases).toHaveCount(3);
  });
});
