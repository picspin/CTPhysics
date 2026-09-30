# i18n review notes (zh / en)

Everything below is something a human reviewer should look at. **All English text was written by an AI assistant
and has not been reviewed by a native speaker or by a CT-physics domain expert.** Treat it as a good first draft.

## 1. Architecture (short)

| Piece | Where |
| --- | --- |
| Chinese dictionary (canonical key set) | `i18n/zh.ts` |
| English dictionary, typed `Record<MessageKey, string>` — a missing/extra key fails `tsc` | `i18n/en.ts` |
| `translate()` (pure, unit-tested): requested language → other language → `⚠key`, dev-only `console.warn` | `i18n/index.ts` |
| id → key maps for organs / regions / tissues | `i18n/labels.ts` |
| React context (`t`, `language`, `setLanguage`, sets `<html lang>`, title, meta description) | `context/LanguageContext.tsx` |
| Bilingual page content, same ids in both trees | `data/zh/*.json`, `data/en/*.json`, consumed via `data/content.ts` (`useContent(page)`) |
| Canvas/3D label helper (re-bakes on language change) | `utils/three/labelTexture.ts` |
| Guard rails | `scripts/check-i18n.mjs` (`npm run check:i18n`), `tests/i18n.test.ts`, `e2e/i18n.spec.ts` |

Default language is still **zh**. The `<html lang>` attribute is `zh-CN` in the static HTML and an inline script in
`app/layout.tsx` fixes it from `localStorage['pref-lang']` before hydration (avoids a wrong-language flash of the
`lang` attribute; the visible text still renders zh first, then switches after hydration when the user chose en).

## 2. Bugs fixed in the dictionary

* Four keys had a stray trailing colon (`pcct_escape_hint:`, `cbct_note:`, `pcct_t2_hint:`, `pcct_dec_composite:`) —
  so `t('pcct_escape_hint')` silently returned the key. Fixed; `check:i18n` and a vitest case forbid this forever.
* `pcct_dec_iodine` had the wrong English text (copy of the composite-colour sentence). Rewritten as an iodine-map description.
* `t('overview')` was being used as the label of the BMI slider in `PCCTSimulator` — now `pcct_bmi`.
* `reconstruction/page.tsx` rendered `"{t(..)} (Helical…)"` producing a mixed label — now a single key.

## 3. Source typos / content issues found while translating

* "Feldman" (zh content) → translated as **Feldkamp** (FDK algorithm). The zh text was left as found except where the
  Latin name was wrong in the dictionary.
* `CTDIvol = CTDIw / pitch` and "a 1 kg foot receiving X mGy" style statements are reproduced **verbatim** from the
  source content. The first is the standard definition; the foot example is a teaching simplification. Not changed.
* The Helical simulator dose read-out (`mA·(kV/100)²/pitch`) is a toy formula, kept as is (units displayed as mGy as before).
* Hard-coded illustrative numbers in the PCCT UI (e.g. the "EID electronic noise ~18 HU" readout) and the
  toy physics in `utils/pcct-physics.ts` are not sourced anywhere in the repo. Left unchanged; flagged only.

## 4. Terminology choices worth checking

| English used | zh in source | Note |
| --- | --- | --- |
| calcium blooming | 钙化膨胀 | zh side no longer contains the loan word "blooming" in prose |
| beam-hardening streaks / cupping | 硬化条纹伪影 / 杯状伪影 | |
| K-escape | K 逃逸 | "escape peak" in the physics sense; text says CdTe fluorescence escape |
| K-edge | K-edge | kept as loan word in zh on purpose ("K-edge 33 keV"), ignored by the mixed-label lint |
| bowtie filter | 领结滤波器 | |
| slice-sensitivity profile | 切片灵敏度分布 | zh source literally says "sensitivity distribution" |
| charge sharing / pulse pile-up | 电荷共享 / 脉冲堆积 | |
| virtual non-contrast / iodine overlay / bone subtraction | 虚拟平扫 / 碘叠加 / 骨骼减除 | vendor-neutral wording |
| SSDE / DLP / CTDIvol | kept as acronyms | full names in zh: 剂量长度乘积, 容积CT剂量指数 |
| quarter-scan / half-scan reconstruction | 四分之一扫描 / 半扫描重建 | |

## 5. Content JSON (`data/en/*.json`)

* Structure mirrors `data/zh/*.json` exactly: same section ids, key-point counts, question ids, option counts,
  `correctAnswer` indices. `check:i18n` and vitest enforce this.
* 33 quiz questions + explanations, dose, cardiac, dual-energy and reconstruction sections were translated.
  The style aims for the plain, conversational teaching tone of the source (Prof. Mark Hammer-style lecture notes)
  rather than literal word-for-word rendering; technical claims were **not** altered.
* Quiz options that used "中文 (English)" style were reduced to the plain zh term in `data/zh` (only the redundant
  English gloss was removed, e.g. "螺距 (Pitch)" → "螺距"). No semantic change. Acronyms like CTDI, SSDE stay.
* **Copyright / permission risk:** the survey (`ctphysics-overview.md`) indicates the original material derives from
  xrayphysics.com / Prof. Mark Hammer's lectures. An English rendering is a derivative work; the owner should confirm
  that they have the right to publish it (and whether attribution is required) before shipping the English text.

## 6. Things not done / limits

* **Glossary helper** (`term()` showing the other-language term on hover) — not implemented; only noted as an idea.
* **Dead code not migrated** (not imported anywhere; verified with `rg`): `components/ui/Header.tsx`,
  `components/ui/Sidebar.tsx`, `components/simulators/RadiationDoseSimulator.tsx`. They still contain Chinese-only
  text and are allow-listed in `scripts/check-i18n.mjs`. Delete them or migrate them if they get revived.
  (`ui/Layout.tsx`, `ui/LiquidGlass.tsx`, `simulators/FracturePhantom.tsx`, `utils/data-manager.ts` contain no CJK.)
* Code **comments** written in Chinese were translated to English where they appeared in migrated files; the check
  script ignores comments anyway.
* Canvas/WebGL labels were verified in a headless Chrome (SwiftShader) by hooking `CanvasRenderingContext2D.fillText`
  and by screenshots — not on a real GPU. The 3D sprite text itself is not in the DOM and is only checked via screenshots
  (`/workspace/ctphysics-i18n-shots/`).
* `Intl`/number formatting: numbers still use `toLocaleString()` with the browser locale for the MC photon count.
* Sidebar badge ("25") and similar numerics are language-neutral.
* The brand name "CT Physics" (sidebar logo) stays English in zh mode on purpose (brand); the landing page uses `brand_name` = "CT PHYSICS".
* `lang_name_zh` ("简体中文") is intentionally CJK in English mode: a language switcher should name each language in its own script.
* Existing e2e specs asserted the old mixed strings (`锥束CT (Cone Beam CT) 物理原理`, `探测器能级分桶 (Energy Binning)`,
  `Tube Voltage`, `开始扫描 (START)`, channel buttons `composite`/`iodine`). They were updated to the new zh strings.
  `e2e/visual/*` specs that take screenshot baselines were **not** re-run (they need baseline PNGs and a GPU); text
  selectors only were adjusted.
* No Next.js route-based locale (`/en/...`) was introduced: the site stays a client-side toggle with `localStorage`,
  so URLs are not language-specific and search engines only see the zh static HTML.
