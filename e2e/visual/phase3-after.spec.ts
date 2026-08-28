import { test, expect } from '@playwright/test';

/**
 * Baseline screenshot capture for visual realism work.
 *
 * Per Phase 1 + 3 plan: capture before any code changes so we have a
 * truth source to diff against after PBR / env-map / lighting upgrades.
 *
 * Scope: only pages with real 3D content. Other simulators (BeamHardening,
 * DualEnergy, XrayAttenuation, CardiacGating, RadiationDose) are 2D Canvas /
 * Recharts / pure CSS and not in this scope.
 *
 * HelicalCTSimulator is mounted under the "螺旋CT与螺距" tab of
 * /reconstruction (default tab is "BP & FBP").
 */

test.describe('Visual baselines — pre-upgrade', () => {
  test('reconstruction → helical tab (HelicalCTSimulator 3D)', async ({ page }) => {
    await page.goto('http://localhost:3000/reconstruction');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '螺旋CT与螺距' }).click();
    await page.waitForTimeout(1200); // let WebGL init + render a few frames
    await page.screenshot({
      path: 'e2e/visual/phase3/reconstruction-helical-phase3-full.png',
      fullPage: true,
    });
  });

  test('landing hero (CTHeroScene R3F)', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: 'e2e/visual/phase3/landing-phase3-full.png',
      fullPage: true,
    });
  });

  test('reconstruction → helical tab — 3D viewport only', async ({ page }) => {
    await page.goto('http://localhost:3000/reconstruction');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '螺旋CT与螺距' }).click();
    await page.waitForTimeout(1200);
    // The 3D viewport is the left half of HelicalCTSimulator (ref={containerRef}).
    // It contains a single <canvas> mounted by THREE.WebGLRenderer.
    // We target the first canvas inside the simulator's 3D column.
    const threeDCanvas = page.locator('canvas').first();
    await expect(threeDCanvas).toBeVisible();
    await threeDCanvas.screenshot({
      path: 'e2e/visual/phase3/reconstruction-helical-phase3-3d-canvas.png',
    });
  });
});
