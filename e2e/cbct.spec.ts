import { test, expect } from '@playwright/test';

test.describe('CBCT (Cone-Beam CT) integration inside Reconstruction page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reconstruction page
    await page.goto('http://localhost:3000/reconstruction');
    // Switch to CBCT Tab
    await page.locator('main button').filter({ hasText: '锥束CT (CBCT)' }).click();
  });

  test('renders CBCT tab headers and contents', async ({ page }) => {
    await expect(page.locator('h3', { hasText: '锥束CT (Cone Beam CT) 物理原理' })).toBeVisible();
    await expect(page.locator('h3', { hasText: '锥束CT物理模拟' })).toBeVisible();
  });

  test('interacts with CBCT parameters controls inside tab', async ({ page }) => {
    // Check Select component for phantom choice
    const phantomSelect = page.locator('select').first();
    await expect(phantomSelect).toBeVisible();
    await expect(phantomSelect).toHaveValue('dental');

    // Check sliders presence (Cone Angle, Pixel Size, kVp, Dose, Rotation)
    const sliders = page.locator('input[type="range"]');
    // We expect sliders from Helical, BP etc. to be there or tab-isolated depending on rendering,
    // let's just make sure there are active range inputs
    await expect(sliders.count()).resolves.toBeGreaterThanOrEqual(5);
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

  test('renders simulation canvases for CBCT', async ({ page }) => {
    // Project canvas + axial canvas + coronal canvas = 3 canvases when CBCT active
    const canvases = page.locator('canvas');
    await expect(canvases.count()).resolves.toBeGreaterThanOrEqual(3);
  });
});
