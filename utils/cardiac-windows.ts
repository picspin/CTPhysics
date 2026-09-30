/**
 * Pure logic for the cardiac-gating simulator: acquisition windows relative to the R-wave.
 *
 * Time axis convention: every time is in ms AFTER THE R-WAVE of the current beat (R = 0), and
 * "%" means percent of the R-R interval measured from that R-wave (the usual cardiac-CT convention).
 *
 * Sources (manufacturer training material, see docs/cardiac-sources-and-gaps.md for page references):
 *  - window-vs-heart-rate table (diastolic 240/190/150/100/75 ms at 60/65/70/75/80 bpm, systolic ~100 ms)
 *  - systolic acquisition recipe: pulsing 300–400 ms, scan 250–450 ms after R (absolute ms, not % R-R)
 *  - Turbo Flash: prospective ECG trigger, default start phase 60 %, pitch 3.4 (Flash) / 3.2 (Force protocols),
 *    constant temporal resolution 75 ms (Flash) / 66 ms (Force), HR ≤ 65 bpm (70 = field experience only),
 *    acquisition block ~270 ms (schematic of the Flash illustration), motion-risk zone > 90 % R-R.
 *  - ONE BEAT: NO numbers are available -> nothing numeric is provided here on purpose.
 *
 * Things that are NOT in the source and are therefore illustrative assumptions (flagged in the UI/docs):
 *  - the POSITION of the diastolic window inside the cycle (modelled as centred on 75 % R-R, clamped to 40–90 %)
 */

export const DIASTOLIC_WINDOW_TABLE: readonly { hr: number; ms: number }[] = [
  { hr: 60, ms: 240 },
  { hr: 65, ms: 190 },
  { hr: 70, ms: 150 },
  { hr: 75, ms: 100 },
  { hr: 80, ms: 75 },
];

/** Usable systolic window (constant over the tabulated heart rates). */
export const SYSTOLIC_WINDOW_MS = 100;
/** Systolic recipe: ECG-pulsing range and scan range, ms after R. */
export const SYSTOLIC_PULSING_MS = { start: 300, end: 400 } as const;
export const SYSTOLIC_SCAN_MS = { start: 250, end: 450 } as const;

/** Heart moves again in late diastole: cycle fraction above which Flash images may be degraded. */
export const MOTION_RISK_START_PCT = 90;
/** Schematic centre of the diastolic window (assumption – the source gives durations, not positions). */
export const DIASTOLE_CENTER_PCT = 75;
export const DIASTOLE_CLAMP_PCT = { min: 40, max: 90 } as const;

export const rrMs = (hr: number): number => 60000 / hr;
export const msToPct = (ms: number, hr: number): number => (ms / rrMs(hr)) * 100;
export const pctToMs = (pct: number, hr: number): number => (pct / 100) * rrMs(hr);

export type WindowSource = 'table' | 'interpolated' | 'below-table' | 'above-table';
export interface WindowValue {
  ms: number;
  /**
   * table: exact table entry; interpolated: linear between two entries (NOT manufacturer data);
   * below-table: HR < 60, value is the 60 bpm entry and the true window is at least that long;
   * above-table: HR > 80, value is the 80 bpm entry and the true window is at most that long.
   */
  source: WindowSource;
}

export function diastolicWindowMs(hr: number): WindowValue {
  const t = DIASTOLIC_WINDOW_TABLE;
  if (hr < t[0].hr) return { ms: t[0].ms, source: 'below-table' };
  if (hr > t[t.length - 1].hr) return { ms: t[t.length - 1].ms, source: 'above-table' };
  for (let i = 0; i < t.length; i++) {
    if (t[i].hr === hr) return { ms: t[i].ms, source: 'table' };
    if (hr > t[i].hr && hr < t[i + 1].hr) {
      const f = (hr - t[i].hr) / (t[i + 1].hr - t[i].hr);
      return { ms: t[i].ms + f * (t[i + 1].ms - t[i].ms), source: 'interpolated' };
    }
  }
  return { ms: t[t.length - 1].ms, source: 'above-table' };
}

export type PhaseChoice = 'diastole' | 'systole';
export type PhaseRecommendation = PhaseChoice | 'either';

/**
 * Recommendation derived only from the table: diastole while its window is longer than the systolic one,
 * systole once the diastolic window is shorter (HR > 75 bpm); equal at 75 bpm.
 */
export function recommendPhase(hr: number): PhaseRecommendation {
  const d = diastolicWindowMs(hr).ms;
  if (Math.abs(d - SYSTOLIC_WINDOW_MS) < 0.5) return 'either';
  return d > SYSTOLIC_WINDOW_MS ? 'diastole' : 'systole';
}

export interface MsWindow {
  startMs: number;
  endMs: number;
}

/** Diastolic window of the tabulated duration, centred on 75 % R-R and kept inside 40–90 % R-R. */
export function diastolicWindow(hr: number): MsWindow {
  const rr = rrMs(hr);
  const dur = Math.min(diastolicWindowMs(hr).ms, (DIASTOLE_CLAMP_PCT.max - DIASTOLE_CLAMP_PCT.min) / 100 * rr);
  let start = pctToMs(DIASTOLE_CENTER_PCT, hr) - dur / 2;
  start = Math.max(pctToMs(DIASTOLE_CLAMP_PCT.min, hr), Math.min(start, pctToMs(DIASTOLE_CLAMP_PCT.max, hr) - dur));
  return { startMs: start, endMs: start + dur };
}

/** Systolic window: absolute ms after R (300–400), independent of heart rate, clipped to the cycle. */
export function systolicWindow(hr: number): MsWindow {
  const rr = rrMs(hr);
  return { startMs: Math.min(SYSTOLIC_PULSING_MS.start, rr), endMs: Math.min(SYSTOLIC_PULSING_MS.end, rr) };
}

export function phaseWindow(hr: number, phase: PhaseChoice): MsWindow {
  return phase === 'diastole' ? diastolicWindow(hr) : systolicWindow(hr);
}

// -------------------------------------------------------------------------- Turbo Flash
export type FlashSystem = 'flash' | 'force';
export const TURBO_FLASH = {
  startPhasePct: 60,
  /** total acquisition block of the Flash schematic (ms) */
  blockMs: 270,
  maxHrRecommended: 65,
  maxHrFieldExperience: 70,
  triggerLatencyBeats: 1.5,
  systems: {
    flash: { pitch: 3.4, rotationMs: 280, temporalResolutionMs: 75, bedSpeedMmPerS: 460 },
    // bed speed for Force protocols is not in the source -> omitted
    force: { pitch: 3.2, rotationMs: 250, temporalResolutionMs: 66, bedSpeedMmPerS: null },
  },
} as const;

/** Geometric temporal resolution of the 95° dual-source system: T_rot · 95° / 360°. */
export const dualSourceTemporalResolutionMs = (rotationMs: number, angleDeg = 95): number => (rotationMs * angleDeg) / 360;

/** Single source: T_rot / 2; first-generation dual source (90°): T_rot / 4. */
export const halfScanTemporalResolutionMs = (rotationMs: number, dualSource = false): number =>
  dualSource ? rotationMs / 4 : rotationMs / 2;

export type FlashStatus = 'ok' | 'field-experience' | 'out-of-range';
export function turboFlashStatus(hr: number): FlashStatus {
  if (hr <= TURBO_FLASH.maxHrRecommended) return 'ok';
  if (hr <= TURBO_FLASH.maxHrFieldExperience) return 'field-experience';
  return 'out-of-range';
}

export interface FlashBlock extends MsWindow {
  startPct: number;
  endPct: number;
  /** block reaches into the > 90 % R-R zone where the heart moves again */
  intoMotionZone: boolean;
}

export function turboFlashBlock(hr: number, startPhasePct: number = TURBO_FLASH.startPhasePct): FlashBlock {
  const startMs = pctToMs(startPhasePct, hr);
  const endMs = startMs + TURBO_FLASH.blockMs;
  const endPct = msToPct(endMs, hr);
  return { startMs, endMs, startPct: startPhasePct, endPct, intoMotionZone: endPct > MOTION_RISK_START_PCT + 1e-9 };
}

// -------------------------------------------------------------------------- acquisition plan
export type AcqMode = 'standard' | 'turboFlash' | 'oneBeat';
export type Gating = 'prospective' | 'retrospective';

export interface PlanParams {
  mode: AcqMode;
  gating: Gating;
  phase: PhaseChoice;
  hr: number;
  /** retrospective only: reduce tube current outside the target window */
  ecgPulsing: boolean;
}

export interface PlanSegment extends MsWindow {
  /** beat index in the displayed strip (0 = first beat) */
  beat: number;
  /** relative tube current 0 … 1 */
  level: number;
}

export interface TargetWindow extends MsWindow {
  beat: number;
  /** false for ONE BEAT, where no duration is available: startMs = endMs = window centre */
  durationKnown: boolean;
}

export interface AcqPlan {
  beats: number;
  rr: number;
  /** tube-current segments (level 0 = X-ray off) */
  tube: PlanSegment[];
  /** windows the image data are taken from / aimed at */
  targets: TargetWindow[];
  /** beat in which the trigger R-wave sits (Turbo Flash and ONE BEAT), else null */
  triggerBeat: number | null;
  /** phase selection is fixed by the mode (Turbo Flash default start phase) */
  phaseFixed: boolean;
}

export const DISPLAY_BEATS = 3;
/** Tube-current floor with ECG pulsing in the manufacturer example (25 %). */
export const PULSING_FLOOR = 0.25;

export function buildPlan(p: PlanParams): AcqPlan {
  const rr = rrMs(p.hr);
  const beats = DISPLAY_BEATS;
  const tube: PlanSegment[] = [];
  const targets: TargetWindow[] = [];
  let triggerBeat: number | null = null;
  let phaseFixed = false;

  if (p.mode === 'standard') {
    const w = phaseWindow(p.hr, p.phase);
    for (let b = 0; b < beats; b++) {
      targets.push({ beat: b, ...w, durationKnown: true });
      if (p.gating === 'prospective') {
        tube.push({ beat: b, ...w, level: 1 });
      } else if (p.ecgPulsing) {
        tube.push({ beat: b, startMs: 0, endMs: w.startMs, level: PULSING_FLOOR });
        tube.push({ beat: b, ...w, level: 1 });
        tube.push({ beat: b, startMs: w.endMs, endMs: rr, level: PULSING_FLOOR });
      } else {
        tube.push({ beat: b, startMs: 0, endMs: rr, level: 1 });
      }
    }
  } else if (p.mode === 'turboFlash') {
    const blk = turboFlashBlock(p.hr);
    triggerBeat = 0;
    phaseFixed = true;
    // trigger on the first R-wave; X-ray starts ~1.5 beats later, i.e. in the 60 % region of the NEXT beat.
    // The block is NOT clipped at the next R-wave: at high heart rates it simply continues into the next beat.
    tube.push({ beat: 1, startMs: blk.startMs, endMs: blk.endMs, level: 1 });
    targets.push({ beat: 1, startMs: blk.startMs, endMs: blk.endMs, durationKnown: true });
  } else {
    const w = phaseWindow(p.hr, p.phase);
    const centre = (w.startMs + w.endMs) / 2;
    triggerBeat = 0;
    targets.push({ beat: 1, startMs: centre, endMs: centre, durationKnown: false });
  }
  return { beats, rr, tube, targets, triggerBeat, phaseFixed };
}

// -------------------------------------------------------------------------- ECG waveform (R = 0)
/**
 * Synthetic single-lead ECG, `tSec` seconds relative to an R-wave (negative = before). The beat is a sum of
 * Gaussians: P before R, small Q/S, R at exactly t = 0, T after; the QT-like spacing scales with √RR.
 */
export function ecgValue(tSec: number, rrSec: number): number {
  const g = (t: number, c: number, s: number, a: number): number => a * Math.exp(-((t - c) ** 2) / (2 * s * s));
  const k = Math.sqrt(rrSec);
  // wrap to the nearest R so the trace is periodic
  let t = tSec % rrSec;
  if (t > rrSec / 2) t -= rrSec;
  if (t < -rrSec / 2) t += rrSec;
  return (
    g(t, -0.16 * Math.min(k, 1), 0.022, 0.14) + // P
    g(t, -0.03, 0.009, -0.12) + // Q
    g(t, 0, 0.011, 1.0) + // R
    g(t, 0.03, 0.01, -0.2) + // S
    g(t, 0.27 * k, 0.05, 0.28) // T
  );
}
