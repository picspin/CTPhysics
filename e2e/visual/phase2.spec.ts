import { test, expect } from '@playwright/test';

/**
 * Phase 2 — Visual realism screenshots.
 *
 * Captures the HelicalCTSimulator under different states to verify:
 *   - PostFX chain is wired up (Bloom on tube emissive / chrome highlights,
 *     SSAO on bore interior depressions, Vignette on corners, SMAA cleans
 *     up the SSAO noise)
 *   - X-ray cone beam replaces the old red PlaneGeometry sheet
 *   - kV slider visibly intensifies the beam (80→0.35, 140→0.95)
 *
 * Requires the dev server running on http://localhost:3000.
 * HelicalCTSimulator lives under the 螺旋CT与螺距 tab on /reconstruction.
 */

test.describe('Phase 2 — postprocessing + X-ray cone beam', () => {
  test('XR off — landing (default state)', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: 'e2e/visual/phase2/01-landing-xr-off.png',
      fullPage: true,
    });
  });

  test('helical — scan off (baseline, beam hidden)', async ({ page }) => {
    await page.goto('http://localhost:3000/reconstruction');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '螺旋CT与螺距' }).click();
    await page.waitForTimeout(1200);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await canvas.screenshot({
      path: 'e2e/visual/phase2/02-helical-scan-off.png',
    });
  });

  test('helical — scan on (XR cone beam visible)', async ({ page }) => {
    await page.goto('http://localhost:3000/reconstruction');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '螺旋CT与螺距' }).click();
    await page.waitForTimeout(1000);
    // Click the START button to enable scanning.
    await page.getByRole('button', { name: '开始扫描 (START)' }).click();
    await page.waitForTimeout(1200); // let a few rotation frames render
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await canvas.screenshot({
      path: 'e2e/visual/phase2/03-helical-scan-on.png',
    });
  });

  test('helical — scan on + kV=140 (high-energy beam brighter)', async ({ page }) => {
    await page.goto('http://localhost:3000/reconstruction');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '螺旋CT与螺距' }).click();
    await page.waitForTimeout(1000);
    // Enable scanning.
    await page.getByRole('button', { name: '开始扫描 (START)' }).click();
    // The Slider component is a plain <input type="range"> without an
    // aria-label. Slider order in HelicalCTSimulator.tsx:
    //   [0] Rotation Time, [1] Pitch, [2] Tube Voltage (kV), [3] Tube Current (mA)
    await page.evaluate(() => {
      const sliders = document.querySelectorAll('input[type="range"]');
      const kv = sliders[2] as HTMLInputElement; // kV slider
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(kv, '140');
      kv.dispatchEvent(new Event('input', { bubbles: true }));
      kv.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(1500);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await canvas.screenshot({
      path: 'e2e/visual/phase2/04-helical-scan-on-kv140.png',
    });
  });
});