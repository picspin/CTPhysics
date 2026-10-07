import { describe, it, expect } from 'vitest';
import { computeOrganDoses, REMAINDER_TISSUES, W_REMAINDER, computeRegionsDose } from '@/utils/organ-dose';

const sumW = (r: ReturnType<typeof computeOrganDoses>) => r.tissues.reduce((a, t) => a + t.wEff, 0);
// Kidney-only scan: kidneys fully covered while every specified tissue is only partly covered.
const kidneyRanges = (): [number, number][] => {
  // find a narrow window where kidney H exceeds all specified tissues
  for (let z = 60; z < 110; z += 0.5) for (const w of [3, 4, 5, 6, 8]) {
    const r = computeOrganDoses({ ctdiVolMgy: 10, ranges: [[z, z + w]], remainderSplitRule: true });
    if (r.remainderSplitTissue === 'kidneys') return [[z, z + w]];
  }
  throw new Error('no kidney-only window found');
};

describe('remainder splitting rule (optional, off by default)', () => {
  it('is off by default: every remainder tissue gets 0.12/13', () => {
    const r = computeOrganDoses({ ctdiVolMgy: 10, ranges: kidneyRanges() });
    expect(r.remainderSplitTissue).toBeNull();
    for (const t of r.tissues.filter((x) => x.remainder)) expect(t.wEff).toBeCloseTo(W_REMAINDER / 13, 12);
    expect(sumW(r)).toBeCloseTo(1, 12);
  });

  it('triggers for a kidney-only scan: kidneys get 0.06, other 12 share 0.06', () => {
    const ranges = kidneyRanges();
    const r = computeOrganDoses({ ctdiVolMgy: 10, ranges, remainderSplitRule: true });
    const off = computeOrganDoses({ ctdiVolMgy: 10, ranges });
    expect(r.remainderSplitTissue).toBe('kidneys');
    const k = r.tissues.find((t) => t.tissue === 'kidneys')!;
    const maxSpec = Math.max(...r.tissues.filter((t) => !t.remainder).map((t) => t.H));
    expect(k.H).toBeGreaterThan(maxSpec);
    expect(k.wEff).toBeCloseTo(W_REMAINDER / 2, 12);
    for (const t of r.tissues.filter((x) => x.remainder && x.tissue !== 'kidneys')) expect(t.wEff).toBeCloseTo(W_REMAINDER / 2 / 12, 12);
    expect(sumW(r)).toBeCloseTo(1, 12);
    expect(r.effectiveDoseMSv).toBeGreaterThan(off.effectiveDoseMSv);
    expect(REMAINDER_TISSUES.length).toBe(13);
  });

  it('does not trigger for a normal chest scan', () => {
    const r = computeRegionsDose(['cardiothoracic'], 10, undefined, true);
    const off = computeRegionsDose(['cardiothoracic'], 10);
    expect(r.remainderSplitTissue).toBeNull();
    expect(r.effectiveDoseMSv).toBeCloseTo(off.effectiveDoseMSv, 12);
    expect(sumW(r)).toBeCloseTo(1, 12);
  });
});
