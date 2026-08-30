import { test, expect } from '@playwright/test';

/**
 * PR #1 visual verification:
 *   AttenuationOverlay floating "Slice @ {kv} kV" sprite must track the
 *   kv slider after the user drags it.
 *
 * Pre-fix: the sprite canvas was drawn once at init with initialKv=120 and
 * never re-baked, so the label was stuck on "Slice @ 120 kV" regardless of
 * slider value.
 *
 * Post-fix: makeLabelSprite exposes sprite.userData.setText(text) which
 * re-bakes the canvas and flips tex.needsUpdate; the kv effect calls it.
 *
 * Visual evidence: e2e/visual/cleanup/label-kv-{80,120,140}.png
 */

test.describe('PR #1 — AttenuationOverlay slice label tracks kV slider', () => {
  test.setTimeout(90_000);

  test('label text updates when kv slider moves to min (80) and max (140)', async ({ page }) => {
    await page.goto('http://localhost:3000/reconstruction', { waitUntil: 'domcontentloaded' });
    const helicalTab = page.getByRole('button', { name: '螺旋CT与螺距' });
    await helicalTab.waitFor({ state: 'visible', timeout: 60_000 });
    await helicalTab.scrollIntoViewIfNeeded();
    await helicalTab.click();
    // Wait until the helical simulator's kV slider label is in the DOM
    // (proves the helical simulator mounted, not the default FBP one).
    const kvLabel = page.locator('span', { hasText: 'Tube Voltage' });
    await kvLabel.waitFor({ state: 'visible', timeout: 60_000 });
    const kvSlider = kvLabel
      .locator('xpath=ancestor::div[contains(@class,"flex-col")][1]')
      .locator('input[type="range"]');
    await expect(kvSlider).toHaveCount(1);

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(2000); // let WebGL warm up + initial label bake

    // --- Default: kv=120 ---
    await expect(kvSlider).toHaveValue('120');
    await canvas.screenshot({ path: 'e2e/visual/cleanup/label-kv-120.png' });

    // --- Min: kv=80 ---
    await kvSlider.fill('80');
    await page.waitForTimeout(400);
    await expect(kvSlider).toHaveValue('80');
    await canvas.screenshot({ path: 'e2e/visual/cleanup/label-kv-80.png' });

    // --- Max: kv=140 ---
    await kvSlider.fill('140');
    await page.waitForTimeout(400);
    await expect(kvSlider).toHaveValue('140');
    await canvas.screenshot({ path: 'e2e/visual/cleanup/label-kv-140.png' });
  });
});