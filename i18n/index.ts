import { zh } from './zh';
import { en } from './en';
import type { MessageKey } from './keys';

/**
 * Bilingual (zh / en) message lookup.
 *
 * - `zh.ts` is the source-of-truth key set. `en.ts` is typed as
 *   `Record<MessageKey, string>`, so a missing (or extra) key in either file
 *   fails `tsc --noEmit`.
 * - `translate()` is a pure function (no React) so it can be unit-tested.
 */
export type Language = 'zh' | 'en';
export type { MessageKey } from './keys';
export type MessageParams = Record<string, string | number>;

export const LANGUAGES: readonly Language[] = ['zh', 'en'] as const;
export const DEFAULT_LANGUAGE: Language = 'zh';
export const LANGUAGE_STORAGE_KEY = 'pref-lang';

export const dictionaries: Record<Language, Record<MessageKey, string>> = { zh, en };

/** BCP-47 tag used for `<html lang>`. */
export const HTML_LANG: Record<Language, string> = { zh: 'zh-CN', en: 'en' };

export function isLanguage(value: unknown): value is Language {
  return value === 'zh' || value === 'en';
}

/** Marker rendered when a key is missing in BOTH languages. */
export const MISSING_MARKER = '\u26A0';

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (warned.has(message)) return;
  warned.add(message);
  // eslint-disable-next-line no-console
  console.warn(`[i18n] ${message}`);
}

/**
 * Look a key up. Fallback chain:
 *   requested language -> the other language -> visible marker `⚠key`.
 * Falling back (or hitting the marker) logs a dev-only console warning.
 */
export function translate(language: Language, key: string, params?: MessageParams): string {
  const primary = (dictionaries[language] as Record<string, string | undefined>)[key];
  if (typeof primary === 'string' && primary !== '') return interpolate(primary, params);

  const otherLang: Language = language === 'zh' ? 'en' : 'zh';
  const secondary = (dictionaries[otherLang] as Record<string, string | undefined>)[key];
  if (typeof secondary === 'string' && secondary !== '') {
    warnOnce(`missing "${key}" for "${language}", falling back to "${otherLang}"`);
    return interpolate(secondary, params);
  }

  warnOnce(`missing "${key}" in every language`);
  return `${MISSING_MARKER}${key}`;
}
