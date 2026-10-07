#!/usr/bin/env node
/**
 * i18n guard rails. Run with `npm run check:i18n`.
 *
 * 1. zh/en key parity + no key ending in ':' + no empty values
 * 2. {placeholder} parity between zh and en for every key
 * 3. data/zh vs data/en structural parity (ids, counts, correctAnswer)
 * 4. No CJK in data/en/*.json and in i18n/en.ts (except the language-name label)
 * 5. No CJK characters in .ts/.tsx source outside the allowed files
 *    (comments are ignored; the dictionaries and data/zh are the only homes for Chinese)
 * 6. No mixed-language labels of the form "中文 (English)" in source/dictionaries
 * 7. (warning only, never fails) dictionary keys that are not referenced anywhere in source
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const CJK_IDEOGRAPH = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

const errors = [];
const fail = (msg) => errors.push(msg);
const rel = (p) => path.relative(ROOT, p);

// ---------------------------------------------------------------- dictionaries
/** Parse `  key: "value",` lines of an i18n dictionary file. */
function parseDict(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = new Map();
  const re = /^\s{2}([A-Za-z0-9_]+):\s*("(?:[^"\\]|\\.)*"),?\s*$/gm;
  let m;
  while ((m = re.exec(src))) {
    if (out.has(m[1])) fail(`${rel(file)}: duplicate key ${m[1]}`);
    out.set(m[1], JSON.parse(m[2]));
  }
  // Keys with a trailing colon (quoted form) would not match the regex above.
  const bad = src.match(/^\s{2}["']?[A-Za-z0-9_]+:["']?\s*:/gm);
  if (bad) fail(`${rel(file)}: key(s) with trailing colon: ${bad.join(', ')}`);
  return out;
}

const zh = parseDict(path.join(ROOT, 'i18n/zh.ts'));
const en = parseDict(path.join(ROOT, 'i18n/en.ts'));

for (const k of zh.keys()) if (!en.has(k)) fail(`i18n: key "${k}" missing in en.ts`);
for (const k of en.keys()) if (!zh.has(k)) fail(`i18n: key "${k}" missing in zh.ts`);
for (const [lang, dict] of [['zh', zh], ['en', en]]) {
  for (const [k, v] of dict) {
    if (k.endsWith(':')) fail(`i18n/${lang}: key "${k}" ends with a colon`);
    if (!v.trim()) fail(`i18n/${lang}: key "${k}" is empty`);
  }
}

const ALLOWED_CJK_IN_EN = new Set(['lang_name_zh']);
for (const [k, v] of en) {
  if (CJK.test(v) && !ALLOWED_CJK_IN_EN.has(k)) fail(`i18n/en: key "${k}" contains CJK text: ${v.slice(0, 40)}`);
}
const ph = (s) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');
for (const [k, v] of zh) {
  if (!en.has(k)) continue;
  if (ph(v) !== ph(en.get(k))) fail(`i18n: placeholder mismatch for "${k}": zh{${ph(v)}} en{${ph(en.get(k))}}`);
}
// Mixed "中文 (English words)" labels. Standard abbreviations/units/proper names in
// parentheses — (CTDIvol), (keV), (mg/mL), (Feldkamp-Davis-Kress) — are fine; an English
// *common-noun gloss* such as (energy binning) or (septa) is not.
const MIXED = /[\u4e00-\u9fff]\s*[（(]\s*[^)）]*\b[a-z]{4,}\b[^)）]*[)）]/;
const MIXED_ALLOW = new Set([]); // keys that legitimately embed an English abbreviation
for (const [k, v] of zh) {
  // {placeholders} and the loanword "K-edge" (kept untranslated in zh on purpose) are ignored.
  const probe = v.replace(/\{\w+\}/g, '').replace(/K-edge/g, 'K');
  if (MIXED.test(probe) && !MIXED_ALLOW.has(k)) fail(`i18n/zh: key "${k}" looks like a mixed-language label: ${v.slice(0, 50)}`);
}

// ------------------------------------------------------------------ data files
function shape(a, b, where) {
  if (Array.isArray(a) !== Array.isArray(b)) return fail(`${where}: array/object mismatch`);
  if (Array.isArray(a)) {
    if (a.length !== b.length) fail(`${where}: length ${a.length} (zh) vs ${b.length} (en)`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) shape(a[i], b[i], `${where}[${i}]`);
    return;
  }
  if (a && typeof a === 'object') {
    const ka = Object.keys(a).sort().join(',');
    const kb = Object.keys(b ?? {}).sort().join(',');
    if (ka !== kb) return fail(`${where}: keys differ\n   zh: ${ka}\n   en: ${kb}`);
    for (const k of Object.keys(a)) {
      const va = a[k], vb = b[k];
      // Language-neutral scalars (ids, numbers, booleans, indices) must be identical.
      if (typeof va !== typeof vb) fail(`${where}.${k}: type mismatch`);
      else if (va && typeof va === 'object') shape(va, vb, `${where}.${k}`);
      else if (typeof va !== 'string' && va !== vb) fail(`${where}.${k}: value ${va} (zh) vs ${vb} (en)`);
      else if (typeof va === 'string' && /(^|_)(id|type|correctAnswer)$/.test(k) && va !== vb)
        fail(`${where}.${k}: "${va}" (zh) vs "${vb}" (en)`);
    }
    return;
  }
}
const dataZhDir = path.join(ROOT, 'data/zh');
const dataEnDir = path.join(ROOT, 'data/en');
const zhFiles = fs.readdirSync(dataZhDir).filter((f) => f.endsWith('.json')).sort();
const enFiles = fs.readdirSync(dataEnDir).filter((f) => f.endsWith('.json')).sort();
if (zhFiles.join() !== enFiles.join()) fail(`data: file lists differ: zh=[${zhFiles}] en=[${enFiles}]`);
for (const f of zhFiles) {
  if (!enFiles.includes(f)) continue;
  const a = JSON.parse(fs.readFileSync(path.join(dataZhDir, f), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.join(dataEnDir, f), 'utf8'));
  shape(a, b, `data/${f}`);
  const txt = fs.readFileSync(path.join(dataEnDir, f), 'utf8');
  txt.split('\n').forEach((line, i) => {
    if (CJK.test(line)) fail(`data/en/${f}:${i + 1}: CJK text in English content: ${line.trim().slice(0, 60)}`);
  });
}

// ---------------------------------------------------------- source CJK scanning
// Files that are allowed to contain CJK in code (beyond the dictionaries + data/zh):
const ALLOW_FILES = new Set([
  'i18n/zh.ts',
  // Test fixtures that intentionally contain Chinese sample strings.
  'tests/i18n.test.ts',
]);
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'e2e', 'coverage', 'playwright-report', 'test-results', 'public', 'docs', 'scripts']);

function stripComments(src) {
  // Good enough for this code base: removes // line comments and /* */ blocks,
  // while leaving string/template/JSX text untouched.
  let out = '';
  let i = 0;
  let state = null; // null | '"' | "'" | '`'
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (state) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (c === state) state = null;
      i++;
      continue;
    }
    if (c === '/' && n === '/' && src[i - 1] !== ':') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    if (c === '"' || c === '`') state = c;
    // A single quote in JSX text (e.g. "don't") is not a string start; only treat it as one after
    // typical code punctuation.
    else if (c === "'" && /[\s(,:=\[{?|&+]/.test(src[i - 1] ?? ' ')) state = "'";
    out += c;
    i++;
  }
  return out;
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (rel(p) === 'data/zh') continue;
      yield* walk(p);
    } else if (/\.(ts|tsx|mts|mjs|js|jsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) yield p;
  }
}

for (const file of walk(ROOT)) {
  const r = rel(file).split(path.sep).join('/');
  if (ALLOW_FILES.has(r)) continue;
  if (r.startsWith('scripts/') || r.endsWith('.config.ts') || r.endsWith('.config.mjs') || r.endsWith('.config.js')) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!CJK.test(src)) continue;
  const stripped = r === 'i18n/en.ts' ? null : stripComments(src);
  const lines = (stripped ?? src).split('\n');
  lines.forEach((line, i) => {
    if (!CJK.test(line)) return;
    if (r === 'i18n/en.ts') return; // handled per key above
    fail(`${r}:${i + 1}: hard-coded CJK outside i18n dictionaries: ${line.trim().slice(0, 70)}`);
  });
}

// ------------------------------------------------------- unused keys (warning only)
// A key counts as referenced when its name appears in any source file other than the two
// dictionaries, or when a dynamic template key such as `prefix_${x}` could produce it.
// This is a heuristic: it only warns and never affects the exit code.
const warnings = [];
{
  let corpus = '';
  const prefixes = new Set();
  const scan = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.next', 'coverage', 'playwright-report', 'test-results', 'public', 'docs'].includes(e.name)) continue;
        scan(p);
      } else if (/\.(ts|tsx|mts|mjs|js|jsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
        const r = rel(p).split(path.sep).join('/');
        if (r === 'i18n/zh.ts' || r === 'i18n/en.ts' || r === 'scripts/check-i18n.mjs') continue;
        const src = fs.readFileSync(p, 'utf8');
        corpus += src + '\n';
        for (const m of src.matchAll(/[`'"]([A-Za-z0-9_]*)\$\{/g)) if (m[1]) prefixes.add(m[1]);
      }
    }
  };
  scan(ROOT);
  const words = new Set(corpus.match(/[A-Za-z0-9_]+/g) ?? []);
  for (const k of zh.keys()) {
    if (words.has(k)) continue;
    if ([...prefixes].some((pre) => k.startsWith(pre))) continue;
    warnings.push(k);
  }
}

// ------------------------------------------------------------------ report
if (errors.length) {
  console.error(`check:i18n FAILED (${errors.length} problem${errors.length === 1 ? '' : 's'})`);
  for (const e of errors.slice(0, 200)) console.error(' - ' + e);
  if (errors.length > 200) console.error(` ... and ${errors.length - 200} more`);
  process.exit(1);
}
if (warnings.length) {
  console.warn(`check:i18n warning: ${warnings.length} dictionary key(s) not referenced in source (heuristic, not an error):`);
  for (const k of warnings.slice(0, 50)) console.warn(' - ' + k);
  if (warnings.length > 50) console.warn(` ... and ${warnings.length - 50} more`);
}
console.log(`check:i18n OK — ${zh.size} keys in zh/en parity, ${zhFiles.length} data files bilingual, no stray CJK in source.`);
