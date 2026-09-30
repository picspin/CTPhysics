import { test, expect } from '@playwright/test';

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

// Smoke test for the zh/en language toggle. Default language is zh.
test.describe('bilingual i18n', () => {
  test('landing page toggle switches <html lang> and text', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    await page.getByTestId('landing-lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const text = (await page.locator('body').innerText()).replace('简体中文', '');
    expect(CJK.test(text)).toBe(false);

    // persisted across reload
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('settings modal toggles language on an inner page and back', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pref-lang', 'zh'));
    await page.goto('http://localhost:3000/pcct');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    await page.getByRole('button', { name: /设置|Settings/ }).first().click();
    await page.getByRole('button', { name: /^English$/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('main h1').first()).toContainText(/Photon-Counting/i);
    const main = (await page.locator('main').innerText()).trim();
    expect(CJK.test(main)).toBe(false);

    await page.getByRole('button', { name: /设置|Settings/ }).first().click();
    await page.getByRole('button', { name: /简体中文/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.locator('main h1').first()).toContainText('光子计数');
  });

  test('no CJK on any route in English mode', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pref-lang', 'en'));
    for (const route of ['/', '/reconstruction', '/dose', '/cardiac', '/dual-energy', '/pcct', '/questions']) {
      await page.goto('http://localhost:3000' + route);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      const text = (await page.locator('body').innerText()).replace('简体中文', '');
      expect(CJK.test(text), `CJK text on ${route} in en mode`).toBe(false);
    }
  });
});
