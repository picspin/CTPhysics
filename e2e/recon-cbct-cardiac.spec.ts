import { test, expect } from '@playwright/test';

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const BASE = 'http://localhost:3000';

async function setLang(page: import('@playwright/test').Page, lang: 'zh' | 'en') {
  await page.addInitScript((l) => localStorage.setItem('pref-lang', l), lang);
}

for (const lang of ['zh', 'en'] as const) {
  test.describe(`new modules (${lang})`, () => {
    test.beforeEach(async ({ page }) => setLang(page, lang));

    test('reconstruction: IR demo renders, updates metrics with iteration slider, no cross-language text', async ({ page }) => {
      await page.goto(`${BASE}/reconstruction`);
      const demo = page.getByTestId('ir-demo');
      await expect(demo).toBeVisible();
      await expect(page.getByTestId('ir-canvas-ir')).toBeVisible();
      const table = page.getByTestId('ir-metrics');
      await expect(table.locator('tbody tr')).toHaveCount(2);
      // wait for the worker result (numbers appear in the IR row)
      await expect(table.locator('tbody tr').nth(1).locator('td').nth(1)).toHaveText(/^\d+$/, { timeout: 30_000 });
      const before = await table.locator('tbody tr').nth(1).innerText();
      const iter = demo.locator('input[type=range]').nth(2);
      await iter.evaluate((el: HTMLInputElement) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        set.call(el, '5');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect.poll(async () => table.locator('tbody tr').nth(1).innerText()).not.toBe(before);
      if (lang === 'en') expect(CJK.test(await demo.innerText())).toBe(false);
    });

    test('cbct: applications cards and DSA principle are shown', async ({ page }) => {
      await page.goto(`${BASE}/reconstruction`);
      await page.locator('main button').filter({ hasText: lang === 'zh' ? '锥束CT (CBCT)' : 'Cone-beam CT (CBCT)' }).click();
      for (const id of ['dsa', 'carm', 'igrt', 'dental']) await expect(page.getByTestId(`cbct-app-${id}`)).toBeVisible();
      await expect(page.getByTestId('cbct-dsa-principle')).toBeVisible();
      if (lang === 'en') expect(CJK.test(await page.getByTestId('cbct-dsa-principle').innerText())).toBe(false);
    });

    test('cardiac: mode toggles, systolic recommendation at high HR, ONE BEAT marked to-be-confirmed', async ({ page }) => {
      await page.goto(`${BASE}/cardiac`);
      const sim = page.getByTestId('cardiac-sim');
      await expect(sim).toBeVisible();
      await expect(page.getByTestId('card-info-standard')).toBeVisible();

      await page.getByTestId('card-mode-turboFlash').click();
      const flash = page.getByTestId('card-info-flash');
      await expect(flash).toContainText('3.4');
      await expect(flash).toContainText('75');
      await expect(flash).toContainText('66');

      // heart rate above the recommended Flash maximum -> non-"ok" status text
      const hr = sim.locator('input[type=range]').first();
      await hr.evaluate((el: HTMLInputElement) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        set.call(el, '85');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(page.getByTestId('card-flash-status')).toHaveClass(/text-red-400/);

      await page.getByTestId('card-mode-oneBeat').click();
      await expect(page.getByTestId('card-info-onebeat')).toBeVisible();
      await expect(page.getByTestId('card-info-onebeat')).toContainText(lang === 'zh' ? '待确认' : 'To be confirmed');

      await page.getByTestId('card-mode-standard').click();
      await page.getByTestId('card-phase-systole').click();
      await expect(page.getByTestId('card-info-standard')).toContainText('100');
      if (lang === 'en') expect(CJK.test(await sim.innerText())).toBe(false);
    });
  });
}
