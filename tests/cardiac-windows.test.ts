import { describe, it, expect } from 'vitest';
import {
  DIASTOLIC_WINDOW_TABLE,
  SYSTOLIC_WINDOW_MS,
  HIGH_PITCH_DS,
  buildPlan,
  diastolicWindow,
  diastolicWindowMs,
  dualSourceTemporalResolutionMs,
  ecgValue,
  halfScanTemporalResolutionMs,
  msToPct,
  recommendPhase,
  rrMs,
  systolicWindow,
  highPitchBlock,
  highPitchStatus,
} from '@/utils/cardiac-windows';

describe('diastolic / systolic window table', () => {
  it('reproduces the table values exactly at the tabulated heart rates', () => {
    const expected: Record<number, number> = { 60: 240, 65: 190, 70: 150, 75: 100, 80: 75 };
    for (const { hr, ms } of DIASTOLIC_WINDOW_TABLE) {
      expect(ms).toBe(expected[hr]);
      expect(diastolicWindowMs(hr)).toEqual({ ms, source: 'table' });
    }
    expect(SYSTOLIC_WINDOW_MS).toBe(100);
  });

  it('interpolates between entries (flagged) and flags values outside the table', () => {
    expect(diastolicWindowMs(72)).toMatchObject({ source: 'interpolated' });
    expect(diastolicWindowMs(72).ms).toBeGreaterThan(100);
    expect(diastolicWindowMs(72).ms).toBeLessThan(150);
    expect(diastolicWindowMs(50)).toEqual({ ms: 240, source: 'below-table' });
    expect(diastolicWindowMs(100)).toEqual({ ms: 75, source: 'above-table' });
  });

  it('diastolic window is monotonically shrinking with heart rate', () => {
    let prev = Infinity;
    for (let hr = 40; hr <= 120; hr++) {
      const ms = diastolicWindowMs(hr).ms;
      expect(ms).toBeLessThanOrEqual(prev + 1e-9);
      prev = ms;
    }
  });

  it('recommends systole once the diastolic window is shorter than the systolic one (HR > 75)', () => {
    expect(recommendPhase(60)).toBe('diastole');
    expect(recommendPhase(70)).toBe('diastole');
    expect(recommendPhase(75)).toBe('either');
    expect(recommendPhase(80)).toBe('systole');
    expect(recommendPhase(110)).toBe('systole');
  });
});

describe('window placement relative to R', () => {
  it('diastolic window has the tabulated duration and stays inside 40–90 % R-R', () => {
    for (const { hr, ms } of DIASTOLIC_WINDOW_TABLE) {
      const w = diastolicWindow(hr);
      expect(w.endMs - w.startMs).toBeCloseTo(ms, 6);
      expect(msToPct(w.startMs, hr)).toBeGreaterThanOrEqual(40 - 1e-9);
      expect(msToPct(w.endMs, hr)).toBeLessThanOrEqual(90 + 1e-9);
    }
  });

  it('systolic window is 300–400 ms after R (100 ms wide) regardless of heart rate and fits in the cycle', () => {
    for (const hr of [50, 80, 100, 120]) {
      const w = systolicWindow(hr);
      expect(w).toEqual({ startMs: 300, endMs: 400 });
      expect(w.endMs).toBeLessThan(rrMs(hr));
    }
  });
});

describe('High-pitch dual-source mode', () => {
  it('uses the documented constants', () => {
    expect(HIGH_PITCH_DS.startPhasePct).toBe(60);
    expect(HIGH_PITCH_DS.systems.setA).toMatchObject({ pitch: 3.4, temporalResolutionMs: 75 });
    expect(HIGH_PITCH_DS.systems.setB).toMatchObject({ pitch: 3.2, temporalResolutionMs: 66 });
    expect(HIGH_PITCH_DS.maxHrRecommended).toBe(65);
    expect(HIGH_PITCH_DS.maxHrFieldExperience).toBe(70);
  });

  it('heart-rate status: ≤65 ok, 66–70 field experience only, >70 out of range', () => {
    expect(highPitchStatus(60)).toBe('ok');
    expect(highPitchStatus(65)).toBe('ok');
    expect(highPitchStatus(66)).toBe('field-experience');
    expect(highPitchStatus(70)).toBe('field-experience');
    expect(highPitchStatus(71)).toBe('out-of-range');
  });

  it('block starts at 60 % R-R and reaches the >90 % motion zone just above the recommended heart rate', () => {
    expect(highPitchBlock(60).startMs).toBeCloseTo(600, 6);
    expect(highPitchBlock(60).intoMotionZone).toBe(false);
    expect(highPitchBlock(65).intoMotionZone).toBe(false);
    expect(highPitchBlock(70).intoMotionZone).toBe(true);
    expect(highPitchBlock(90).intoMotionZone).toBe(true);
  });

  it('temporal resolution: independent of HR by construction, geometric estimate close to the stated 75 / 66 ms', () => {
    expect(dualSourceTemporalResolutionMs(250)).toBeCloseTo(66, 0);
    expect(Math.abs(dualSourceTemporalResolutionMs(280) - 75)).toBeLessThan(1.5);
    expect(halfScanTemporalResolutionMs(300)).toBe(150);
    expect(halfScanTemporalResolutionMs(330, true)).toBe(82.5);
  });
});

describe('acquisition plan', () => {
  const base = { gating: 'prospective', phase: 'diastole', hr: 70, ecgPulsing: false } as const;

  it('prospective: X-ray only inside the target window of each of the 3 beats', () => {
    const p = buildPlan({ ...base, mode: 'standard' });
    expect(p.tube).toHaveLength(3);
    expect(p.targets).toHaveLength(3);
    for (const s of p.tube) expect(s.level).toBe(1);
    expect(p.tube[0].endMs - p.tube[0].startMs).toBeCloseTo(150, 6);
  });

  it('retrospective: X-ray on all beat; with pulsing the floor is 25 % outside the window', () => {
    const full = buildPlan({ ...base, mode: 'standard', gating: 'retrospective' });
    expect(full.tube.every((s) => s.level === 1 && s.endMs - s.startMs === full.rr)).toBe(true);
    const pulsed = buildPlan({ ...base, mode: 'standard', gating: 'retrospective', ecgPulsing: true });
    expect(pulsed.tube.filter((s) => s.level === 0.25)).toHaveLength(6);
    const hi = pulsed.tube.filter((s) => s.level === 1);
    expect(hi).toHaveLength(3);
  });

  it('systole at high heart rate gives a 100 ms window at 300–400 ms', () => {
    const p = buildPlan({ ...base, mode: 'standard', phase: 'systole', hr: 90 });
    expect(p.targets[0]).toMatchObject({ startMs: 300, endMs: 400 });
  });

  it('High-pitch mode: triggered on beat 0, one block in beat 1, phase fixed', () => {
    const p = buildPlan({ ...base, mode: 'highPitchDS', hr: 60 });
    expect(p.triggerBeat).toBe(0);
    expect(p.phaseFixed).toBe(true);
    expect(p.tube).toHaveLength(1);
    expect(p.tube[0].beat).toBe(1);
    expect(p.tube[0].startMs).toBeCloseTo(600, 6);
  });

  it('Single-beat mode: a single target, duration NOT known (no invented number)', () => {
    const p = buildPlan({ ...base, mode: 'singleBeat' });
    expect(p.targets).toHaveLength(1);
    expect(p.targets[0].durationKnown).toBe(false);
    expect(p.targets[0].startMs).toBe(p.targets[0].endMs);
    // the tube-current band is NOT empty: one explicit unknown-duration marker, no invented length
    expect(p.tube).toHaveLength(1);
    expect(p.tube[0].durationUnknown).toBe(true);
    expect(p.tube[0].beat).toBe(p.targets[0].beat);
    expect(p.tube[0].startMs).toBe(p.tube[0].endMs);
    expect(p.tube[0].startMs).toBe(p.targets[0].startMs);
  });

  it('only single-beat mode produces unknown-duration tube segments', () => {
    for (const mode of ['standard', 'highPitchDS'] as const) {
      const p = buildPlan({ ...base, mode });
      expect(p.tube.length).toBeGreaterThan(0);
      expect(p.tube.some((s) => s.durationUnknown)).toBe(false);
    }
  });
});

describe('ECG waveform is aligned to R = 0', () => {
  it('maximum of a beat is at t = 0 and it is periodic', () => {
    for (const hr of [50, 75, 110]) {
      const rr = 60 / hr;
      let best = -Infinity;
      let at = 0;
      for (let t = -rr / 2; t < rr / 2; t += 0.001) {
        const v = ecgValue(t, rr);
        if (v > best) {
          best = v;
          at = t;
        }
      }
      expect(Math.abs(at)).toBeLessThan(0.004);
      expect(best).toBeGreaterThan(0.9);
      expect(ecgValue(0.1, rr)).toBeCloseTo(ecgValue(0.1 + rr, rr), 6);
    }
  });
});
