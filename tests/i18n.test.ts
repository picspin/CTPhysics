import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dictionaries, translate, MISSING_MARKER, HTML_LANG, isLanguage, DEFAULT_LANGUAGE } from '@/i18n';
import { zh } from '@/i18n/zh';
import { en } from '@/i18n/en';

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

describe('i18n dictionaries', () => {
  it('zh and en have exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });

  it('no key ends with a colon and no value is empty', () => {
    for (const lang of ['zh', 'en'] as const) {
      for (const [k, v] of Object.entries(dictionaries[lang])) {
        expect(k.endsWith(':'), `${lang}.${k}`).toBe(false);
        expect(v.trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it('{placeholders} match between languages', () => {
    const ph = (s: string) => Array.from(new Set(Array.from(s.matchAll(/\{(\w+)\}/g)).map((m) => m[1]))).sort();
    for (const k of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(ph(en[k]), k).toEqual(ph(zh[k]));
    }
  });

  it('English messages contain no CJK (except the language-name label)', () => {
    for (const [k, v] of Object.entries(en)) {
      if (k === 'lang_name_zh') continue;
      expect(CJK.test(v), `${k}: ${v}`).toBe(false);
    }
  });

  it('the four previously colon-suffixed keys and pcct_dec_iodine are fixed', () => {
    for (const k of ['pcct_escape_hint', 'cbct_note', 'pcct_t2_hint', 'pcct_dec_composite'] as const) {
      expect(zh[k]).toBeTruthy();
      expect(en[k]).toBeTruthy();
    }
    // Was a copy of the composite text; must now talk about the iodine map.
    expect(en.pcct_dec_iodine.toLowerCase()).toContain('iodine');
    expect(en.pcct_dec_iodine).not.toEqual(en.pcct_dec_composite);
  });
});

describe('translate() fallback', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const dictZh = dictionaries.zh as Record<string, string>;
  const dictEn = dictionaries.en as Record<string, string>;

  beforeEach(() => warn.mockClear());
  afterEach(() => {
    delete dictZh.__only_zh;
    delete dictEn.__only_en;
  });

  it('returns the requested language when present', () => {
    expect(translate('zh', 'settings')).toBe(zh.settings);
    expect(translate('en', 'settings')).toBe(en.settings);
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to the other language and warns', () => {
    dictZh.__only_zh = '仅中文';
    dictEn.__only_en = 'English only';
    expect(translate('en', '__only_zh')).toBe('仅中文');
    expect(translate('zh', '__only_en')).toBe('English only');
    expect(warn).toHaveBeenCalled();
  });

  it('shows a visible marker when the key exists nowhere', () => {
    const out = translate('en', '__nope__');
    expect(out).toBe(`${MISSING_MARKER}__nope__`);
    expect(out.startsWith('\u26A0')).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it('treats an empty string as missing', () => {
    dictEn.__only_zh = '';
    dictZh.__only_zh = '有内容';
    expect(translate('en', '__only_zh')).toBe('有内容');
    delete dictEn.__only_zh;
  });

  it('interpolates {params}, also through the fallback', () => {
    expect(translate('en', 'region_step', { n: 3 })).toBe('Step 3');
    expect(translate('zh', 'region_step', { n: 3 })).toBe('步骤 3');
    dictZh.__only_zh = '共 {n} 项';
    expect(translate('en', '__only_zh', { n: 5 })).toBe('共 5 项');
    // unknown placeholder is left visible rather than swallowed
    expect(translate('en', 'region_step', {})).toBe('Step {n}');
  });
});

describe('language helpers', () => {
  it('maps to BCP-47 tags and validates', () => {
    expect(HTML_LANG).toEqual({ zh: 'zh-CN', en: 'en' });
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(DEFAULT_LANGUAGE).toBe('zh');
  });
});

describe('bilingual content JSON', () => {
  const dirZh = path.resolve(__dirname, '../data/zh');
  const dirEn = path.resolve(__dirname, '../data/en');
  const files = fs.readdirSync(dirZh).filter((f) => f.endsWith('.json'));

  it('has a matching English file for every Chinese file', () => {
    expect(fs.readdirSync(dirEn).filter((f) => f.endsWith('.json')).sort()).toEqual(files.sort());
  });

  it.each(files)('%s: ids, counts and answers match; English has no CJK', (f) => {
    const a = JSON.parse(fs.readFileSync(path.join(dirZh, f), 'utf8'));
    const rawEn = fs.readFileSync(path.join(dirEn, f), 'utf8');
    const b = JSON.parse(rawEn);
    expect(CJK.test(rawEn)).toBe(false);

    const walk = (x: unknown, y: unknown, where: string) => {
      if (Array.isArray(x)) {
        expect(Array.isArray(y), where).toBe(true);
        expect((y as unknown[]).length, where).toBe(x.length);
        x.forEach((v, i) => walk(v, (y as unknown[])[i], `${where}[${i}]`));
      } else if (x && typeof x === 'object') {
        const xo = x as Record<string, unknown>;
        const yo = y as Record<string, unknown>;
        expect(Object.keys(yo).sort(), where).toEqual(Object.keys(xo).sort());
        for (const k of Object.keys(xo)) {
          if (k === 'id' || k === 'correctAnswer' || typeof xo[k] !== 'string') {
            if (typeof xo[k] !== 'object') expect(yo[k], `${where}.${k}`).toEqual(xo[k]);
          }
          walk(xo[k], yo[k], `${where}.${k}`);
        }
      }
    };
    walk(a, b, f);
  });
});
