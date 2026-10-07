#!/usr/bin/env node
/**
 * Repeatable i18n crawl. Usage:
 *   npx next build && npx next start -p 3000 &
 *   node scripts/i18n-crawl.mjs [--base http://localhost:3000] [--shots DIR] [--out report.json]
 * For every route and both languages it clicks every tab/button/select/toggle/summary,
 * collects DOM text, title/aria-label/placeholder/alt attributes, SVG <text>, and canvas
 * fillText/strokeText calls (incl. 3D sprite label textures), then reports CJK strings in en
 * mode and English-looking UI words in zh mode. Exit code 1 if any finding.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:3000');
const SHOTS = arg('--shots', '');
const OUT = arg('--out', '');
const ROUTES = ['/', '/reconstruction', '/dose', '/cardiac', '/dual-energy', '/pcct', '/questions'];
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
// Allowed tokens in zh mode: units, acronyms, symbols, brand, language names.
const ALLOW_EN = new Set(['CT', 'Physics', 'English', 'GitHub', 'ICRP', 'HU', 'kV', 'kVp', 'mA', 'mAs', 'keV', 'MeV', 'mSv', 'mGy', 'cm', 'mm', 'ms', 'bpm', 'DLP', 'CTDI', 'CTDIvol', 'SSDE', 'FBP', 'IR', 'DL', 'DECT', 'PCCT', 'PCD', 'CBCT', 'ECG', 'MTF', 'NPS', 'SNR', 'CNR', 'FOV', 'ROI', 'ART', 'SART', 'MBIR', 'ASIR', 'OSEM', 'MLEM', 'TV', 'FDK', 'Hz', 'Sv', 'Gy', 'LUT', 'RGB', 'WL', 'WW', 'VMI', 'Z', 'Rho', 'CdTe', 'CZT', 'GOS', 'Si', 'Ka', 'K', 'DE', 'AI', 'MPR', 'MIP', 'VR', 'RR', 'R', 'BMI', 'kg', 'lp', 'GB', 'MB', 'Nyquist', 'Ram', 'Lak', 'Shepp', 'Logan', 'Hann', 'Hamming', 'Cosine', 'Q', 'E', 'N', 'S', 'A', 'B', 'C', 'D', 'X', 'Y', 'TCM', 'AEC', 'LAO', 'RAO', 'SD', 'mL', 'OK', 'vol', 'max', 'Mcps', 'eff', 'sqrt']);

const INIT = () => {
  window.__canvasText = new Set();
  for (const proto of [CanvasRenderingContext2D.prototype, (window.OffscreenCanvasRenderingContext2D || {}).prototype].filter(Boolean)) {
    for (const fn of ['fillText', 'strokeText']) {
      const orig = proto[fn];
      proto[fn] = function (t, ...r) { try { window.__canvasText.add(JSON.stringify([window.__crawlLang === 'zh' ? 'zh-CN' : 'en', String(t)])); } catch {} return orig.call(this, t, ...r); };
    }
  }
};

async function collect(page) {
  return page.evaluate(() => {
    const out = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const p = walker.currentNode.parentElement;
      if (!p || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName)) continue;
      const t = walker.currentNode.textContent.trim();
      if (t) out.add(t);
    }
    for (const el of document.querySelectorAll('[title],[aria-label],[placeholder],[alt]'))
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && v.trim()) out.add(v.trim()); }
    for (const o of document.querySelectorAll('option')) out.add(o.textContent.trim());
    out.add(document.title);
    const want = window.__crawlLang === 'en' ? 'en' : 'zh-CN';
    for (const j of window.__canvasText || []) { const [l, t] = JSON.parse(j); if (l === want) out.add(t.trim()); }
    return [...out].filter(Boolean);
  });
}

async function exercise(page, extra) {
  const sel = 'main button, main [role=tab], main summary, main [role=switch], main input[type=checkbox], main input[type=radio]';
  const n = await page.locator(sel).count();
  const seen = new Set();
  for (let i = 0; i < Math.min(n, 250); i++) {
    const el = page.locator(sel).nth(i);
    try {
      if (!(await el.isVisible())) continue;
      const label = (await el.innerText({ timeout: 300 }).catch(() => '')) + i;
      if (seen.has(label)) continue; seen.add(label);
      const skip = await el.evaluate((e) => /lang|language/i.test((e.getAttribute('data-testid') || '') + (e.getAttribute('aria-label') || '')) || /^(English|简体中文|中文|EN|ZH)$/i.test((e.textContent || '').trim())).catch(() => true);
      if (skip) continue;
      await el.click({ timeout: 800, trial: false });
      await page.waitForTimeout(120);
      extra.push(...(await collect(page)));
      await page.keyboard.press('Escape').catch(() => {});
    } catch {}
  }
  // hover charts so tooltips render
  const charts = page.locator('.recharts-surface');
  for (let i = 0; i < Math.min(await charts.count(), 30); i++) {
    const box = await charts.nth(i).boundingBox().catch(() => null);
    if (!box) continue;
    for (const fx of [0.3, 0.5, 0.7]) { await page.mouse.move(box.x + box.width * fx, box.y + box.height * 0.5).catch(() => {}); await page.waitForTimeout(80); extra.push(...(await collect(page))); }
  }
  const selects = page.locator('main select');
  for (let i = 0; i < (await selects.count()); i++) {
    const s = selects.nth(i);
    const vals = await s.locator('option').evaluateAll((os) => os.map((o) => o.value)).catch(() => []);
    for (const v of vals) { await s.selectOption(v, { timeout: 800 }).catch(() => {}); await page.waitForTimeout(100); extra.push(...(await collect(page))); }
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const report = {};
let total = 0;
try {
for (const lang of ['en', 'zh']) {
  for (const vp of [{ width: 1440, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript((l) => { localStorage.setItem('pref-lang', l); window.__crawlLang = l; }, lang);
    await ctx.addInitScript(INIT);
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch((e) => { throw new Error(`navigation failed for ${route}: ${e.message}`); });
      if (!resp || !resp.ok()) throw new Error(`navigation failed for ${route}: HTTP ${resp ? resp.status() : 'no response'}`);
      await page.waitForTimeout(800);
      const before = new Set(await collect(page));
      const extra = [];
      await exercise(page, extra);
      await page.waitForTimeout(500);
      const all = new Set([...before, ...extra, ...(await collect(page))]);
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${lang}${route === '/' ? '_landing' : route.replace(/\//g, '_')}.png`), fullPage: true }).catch(() => {}); }
      let findings;
      if (lang === 'en') findings = [...all].filter((t) => CJK.test(t.replace(/简体中文|中文/g, '')));
      else findings = [...all].filter((t) => !CJK.test(t) && t.length > 2 && t !== 'English' && (t.match(/[A-Za-z]{3,}/g) || []).some((w) => !ALLOW_EN.has(w) && !/^[A-Z][A-Z0-9]+$/.test(w)));
      report[`${lang} ${route}`] = findings;
      total += findings.length;
      console.log(`${lang.padEnd(3)} ${route.padEnd(16)} ${findings.length}`);
      await page.close();
    }
    await ctx.close();
  }
}
} finally {
  await browser.close();
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
else console.log(JSON.stringify(report, null, 2));
process.exit(total ? 1 : 0);
