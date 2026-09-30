# Cardiac CT module — sources, assumptions and unsourced items

Scope: `components/simulators/CardiacGatingSimulator.tsx`, `utils/cardiac-windows.ts`, `data/{zh,en}/cardiac.json`,
`app/(main)/cardiac/page.tsx`, `utils/physics-calculations.ts`.

## 1. What the new acquisition-window chart is based on

Source: a digest of a Siemens dual-source CT training slide deck (Siemens Healthcare 2016, marked *Restricted / For
internal use only*, 94 pages; the digest with page references is kept outside the repository). Page numbers below are
PDF pages. Items marked ★ were read from screenshots/diagrams rather than the text layer (slightly lower confidence).

| Used in the app | Value | Source page |
| --- | --- | --- |
| Diastolic window vs heart rate | 240 / 190 / 150 / 100 / 75 ms at 60 / 65 / 70 / 75 / 80 bpm | p.16 |
| Systolic window | ≈ 100 ms at all tabulated heart rates | p.16 |
| Systolic acquisition recipe (absolute ms after R, not % R-R) | pulsing 300–400 ms; scan 250–450 ms; "Best Syst" | pp.39–40 ★ |
| Turbo Flash trigger / start phase | prospective ECG trigger, default start phase 60 %, not editable in the trigger card | pp.55, 64 |
| Turbo Flash pitch | 3.4 (Flash, bed speed 460 mm/s); 3.2 (Force protocols) | pp.51–52, 55 |
| Temporal resolution, independent of HR | Flash 75 ms (280 ms × 95°/360°), Force 66 ms (250 ms × 95°/360°) | pp.10–11, 15 |
| Max HR | 65 bpm recommended; 70 = field experience, *not* a Siemens recommendation | p.55 |
| Motion-risk zone | > 90 % R-R | p.62 |
| Trigger latency / bed run-up | X-ray starts ≈ 1.5 cardiac cycles after the triggering R-wave; ≈ 30 cm run-up, ≈ 1.1 s acceleration; ECG predicted from previous 3 beats | pp.50–52, 61 |
| Acquisition block length | ≈ 270 ms (schematic only) | p.49 ★ |
| ECG pulsing floor | 25 % (MinDose 4 %) | pp.31, 42–44 |

### Assumptions made by the app (NOT in the source)

* **Position** of the diastolic window inside the cycle. The table gives durations only. The app centres the window on
  75 % R-R and clamps it to 40–90 % R-R. This is flagged in the UI ("schematic assumption").
* Linear interpolation of the window duration between tabulated heart rates (flagged in the UI as *not manufacturer
  data*). Below 60 bpm / above 80 bpm the nearest table value is shown with an explicit note.
* Switching recommendation "diastole → systole above 75 bpm" is derived purely from the table (diastolic window becomes
  shorter than the ≈ 100 ms systolic window). It is a teaching hint, not a protocol.
* The systolic window is drawn at 300–400 ms after R (the pulsing range of the recipe), clipped to the R-R interval.
* Turbo Flash block placement: the block starts at 60 % R-R of the beat *after* the trigger beat (≈ 1.5 cycles latency)
  and is **not** clipped at the next R-wave; above ≈ 65 bpm it reaches the > 90 % zone and a warning is shown.

### ONE BEAT — no source data

The source document does **not** mention "ONE BEAT", single-beat acquisition, 320-row or 16 cm detectors. The app therefore shows
only a generic, qualitative description (wide detector covers the heart in one rotation, axial acquisition, needs a
stable low-variability rhythm, avoids stair-step artifacts between beats) and marks **every** number as *to be
confirmed*: detector coverage, rotation time, temporal resolution, heart-rate limit, phase window, dose. On the chart
the ONE BEAT marker has a dashed outline with a "?" and a fixed visual width — it does not represent a duration.
The closest item in the source (Force Adaptive Cardio Sequence, 2–4 scans, multi-beat) is deliberately *not* used.
To complete this mode, a vendor document for the specific wide-detector scanner is needed.

## 2. Fixed in this branch

* **Phase reference.** The old simulator generated the ECG with the P-wave at t = 0 (R peak ≈ 20–25 % of the cycle) and
  computed "70–80 %" from that origin, so the percentages were not % R-R. The ECG is now generated with the **R-wave at
  exactly t = 0** (`ecgValue`, unit-tested) and every window is expressed in ms / % after R.
* **Window was a 4-px line**; now a block whose width is the window duration.
* **`CardiacGatingOptions.heartRateRange` vs `heartRates`** type mismatch: `data/*/cardiac.json` ships `heartRates`
  (presets), the type required `heartRateRange` (slider range). Both are now optional in the type. The simulator did not
  use either (slider hard-coded to 40–120 bpm) and still does not; it accepts `gatingTypes` from the JSON.
* `calculateOptimalPhase` is marked `@deprecated` with a comment (see below); no behaviour change.

## 3. Existing unsourced / questionable items (flagged, NOT changed)

| Where | Item | Why flagged |
| --- | --- | --- |
| `utils/physics-calculations.ts` `calculateOptimalPhase` | 75 % for HR < 65, **45 %** for higher HR ("systolic") | Not in the training material. 45 % R-R is not a generally valid systolic phase; the document uses absolute ms after R (≈ 300–400 ms) for systole and shows a best-systole example at 38 %. `rotationTime` is unused. Pinned by `utils/physics-calculations.test.ts`, so left as is and marked deprecated. No UI uses it. |
| `data/{zh,en}/cardiac.json` (`radiation-dose`) | "Retrospective gating typically delivers **3–4 times** the dose of prospective gating" (content + key point) | Not in the training material, which gives no dose multiple. The ratio depends strongly on scanner, pitch, ECG pulsing and protocol; with ECG pulsing the difference is much smaller. Needs a citation or softer wording — left for the owner. |
| `app/(main)/cardiac/page.tsx` `CardiacDoseCalculator` | Base dose 3 mSv (prospective) / 12 mSv (retrospective), ×1.2 above 70 bpm, "dose reduction 70–80 %" | Invented illustrative constants (note: 12/3 = 4×, and "70–80 %" would be 75 %). Not sourced; should be labelled as illustrative or replaced by DLP-based data. |
| same file | Image-quality bands ≤ 65 / ≤ 80 bpm ("Excellent/Good/Fair") and the `> 70 bpm → beta-blocker` advice | Unsourced heuristics. (The training material supports 65 bpm only as the Turbo Flash limit.) |
| `card_tr_note` | "temporal resolution should be below 100 ms at 70 bpm" | Unsourced rule of thumb. |
| `utils/data-manager.ts` `'cardiac-gating'` defaults | `gatingWindows.prospective = 70–80 %`, `heartRateRange` 40–120 | Unused by the UI; 70–80 % measured from R would conflict with the new table-based windows. |
| `card_guide_pro_2` | "needs a stable, low heart rate (<65 bpm)" | Reworded to "roughly below 65 bpm" in this branch; the 65 is the Flash limit, not a general rule for step-and-shoot. |
| `temporal-resolution` section | `calculateTemporalResolution` only has T/2 and T/4 | The new `utils/cardiac-windows.ts` adds the Flash/Force form T·95°/360°; the old calculator UI is unchanged. |

## 4. Licensing note

The source deck is marked *Restricted / For internal use only*. Only the individual numerical facts above (and their
page references in this document) are used; no slide text or images are reproduced. Confirm that publishing these
figures on a public site is acceptable before deploying.
