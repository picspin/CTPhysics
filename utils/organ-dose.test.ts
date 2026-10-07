import { describe, it, expect } from 'vitest';
import {
  ICRP103_WT_TABLE, WT_TABLE_ROWS, REMAINDER_TISSUES, ALL_TISSUES, W_REMAINDER, INTERACTIVE_ORGANS, isRemainder,
  computeOrganDoses, computeRegionsDose, rangesForRegions, mergeRanges, coverageFraction, tissueSegments,
  organEquivalentDose, effectiveDoseFromK, REGION_SCAN_RANGE_CM,
} from './organ-dose';
import type { BodyRegionId } from './dose-physics';

describe('ICRP 103 tissue weights', () => {
  it('sum to exactly 1.00', () => {
    const s = Object.values(ICRP103_WT_TABLE).reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1, 12);
  });
  it('match the owner table', () => {
    for (const t of ['redBoneMarrow', 'colon', 'stomach', 'lung', 'breast', 'remainder'] as const) expect(ICRP103_WT_TABLE[t]).toBe(0.12);
    expect(ICRP103_WT_TABLE.gonads).toBe(0.08);
    for (const t of ['bladder', 'oesophagus', 'liver', 'thyroid'] as const) expect(ICRP103_WT_TABLE[t]).toBe(0.04);
    for (const t of ['boneSurface', 'brain', 'salivaryGlands', 'skin'] as const) expect(ICRP103_WT_TABLE[t]).toBe(0.01);
    expect(WT_TABLE_ROWS.reduce((a, r) => a + r.wT * r.tissues.length, 0)).toBeCloseTo(1, 12);
  });
  it('remainder has the 13 ICRP 103 tissues incl. heart and kidneys', () => {
    expect(REMAINDER_TISSUES).toHaveLength(13);
    expect(isRemainder('heart')).toBe(true);
    expect(isRemainder('kidneys')).toBe(true);
    expect(isRemainder('liver')).toBe(false);
    expect(INTERACTIVE_ORGANS.heart.tissue).toBe('heart');
    expect(INTERACTIVE_ORGANS.kidneys.tissue).toBe('kidneys');
  });
  it('every tissue has a normalised spatial model', () => {
    for (const t of ALL_TISSUES) expect(tissueSegments(t).reduce((a, s) => a + s[2], 0)).toBeCloseTo(1, 9);
  });
});

describe('organ-by-organ effective dose', () => {
  it('E = Σ wT·HT + 0.12 × mean(H_remainder), summed over all tissues', () => {
    const r = computeRegionsDose(['cardiothoracic'], 10);
    const weighted = r.tissues.filter((x) => !x.remainder).reduce((a, x) => a + ICRP103_WT_TABLE[x.tissue as keyof typeof ICRP103_WT_TABLE] * x.H, 0);
    const rem = r.tissues.filter((x) => x.remainder);
    expect(rem).toHaveLength(13);
    const mean = rem.reduce((a, x) => a + x.H, 0) / 13;
    expect(r.remainderMeanH).toBeCloseTo(mean, 12);
    expect(r.effectiveDoseMSv).toBeCloseTo(weighted + W_REMAINDER * mean, 12);
    expect(r.tissues.reduce((a, x) => a + x.contribution, 0)).toBeCloseTo(r.effectiveDoseMSv, 12);
  });
  it('k is derived: k = E/DLP and DLP×k gives E back', () => {
    const r = computeRegionsDose(['abdomen'], 12);
    expect(r.dlpMgyCm).toBeCloseTo(12 * 44, 9);
    expect(r.kDerived).toBeCloseTo(r.effectiveDoseMSv / r.dlpMgyCm, 15);
    expect(effectiveDoseFromK(r.dlpMgyCm, r.kDerived)).toBeCloseTo(r.effectiveDoseMSv, 12);
  });
  it('E and DLP are linear in CTDIvol, so k is independent of CTDIvol', () => {
    const a = computeRegionsDose(['neck'], 5), b = computeRegionsDose(['neck'], 20);
    expect(b.effectiveDoseMSv / a.effectiveDoseMSv).toBeCloseTo(4, 9);
    expect(b.kDerived).toBeCloseTo(a.kDerived, 15);
  });
  it('fully covered organ gets H = CTDIvol; unscanned organ gets only the mock scatter share', () => {
    expect(organEquivalentDose('brain', { ctdiVolMgy: 50, ranges: [[0, 30]] }).H).toBeCloseTo(50, 9);
    expect(organEquivalentDose('liver', { ctdiVolMgy: 50, ranges: [[0, 30]], scatter: 0.01 }).H).toBeCloseTo(0.5, 9);
  });
  it('trunk regions carry more E per DLP than head or limbs (derived k ordering)', () => {
    const k = (r: BodyRegionId) => computeRegionsDose([r], 10).kDerived;
    expect(k('cardiothoracic')).toBeGreaterThan(k('head'));
    expect(k('abdomen')).toBeGreaterThan(k('peripheral'));
    expect(k('neck')).toBeGreaterThan(k('head'));
  });
  it('limb-only scan is driven by skin/bone/marrow/muscle, not by trunk organs', () => {
    const r = computeRegionsDose(['peripheral'], 10);
    const byT = Object.fromEntries(r.tissues.map((x) => [x.tissue, x.f]));
    expect(byT.liver).toBe(0); expect(byT.lung).toBe(0);
    expect(byT.skin).toBeGreaterThan(0.3); expect(byT.muscle).toBeGreaterThan(0.3);
  });
});

describe('combined multi-region scans', () => {
  it('ranges are merged; adjacent regions form one range', () => {
    expect(rangesForRegions(['cardiothoracic', 'abdomen'])).toEqual([[33, 106]]);
    expect(mergeRanges([[0, 10], [20, 30], [5, 22]])).toEqual([[0, 30]]);
    expect(rangesForRegions(['head', 'abdomen'])).toEqual([REGION_SCAN_RANGE_CM.head, REGION_SCAN_RANGE_CM.abdomen]);
  });
  it('chest + abdomen: E is computed once from merged per-organ H_T (not by adding region E values)', () => {
    const ctdi = 10;
    const chest = computeRegionsDose(['cardiothoracic'], ctdi);
    const abd = computeRegionsDose(['abdomen'], ctdi);
    const both = computeRegionsDose(['cardiothoracic', 'abdomen'], ctdi);
    // per-organ merge: the liver straddles z = 62 cm, its coverage is the union, capped at 1
    const fLiver = both.tissues.find((x) => x.tissue === 'liver')!.f;
    expect(fLiver).toBeCloseTo(Math.min(1, coverageFraction('liver', [[33, 62]]) + coverageFraction('liver', [[62, 106]])), 9);
    // recompute E from the merged H_T by hand
    const manual = both.tissues.filter((x) => !x.remainder).reduce((a, x) => a + x.wEff * x.H, 0)
      + 0.12 * both.tissues.filter((x) => x.remainder).reduce((a, x) => a + x.H, 0) / 13;
    expect(both.effectiveDoseMSv).toBeCloseTo(manual, 12);
    // naive addition double-counts the out-of-field scatter of each partial scan, so it differs
    const naive = chest.effectiveDoseMSv + abd.effectiveDoseMSv;
    expect(Math.abs(naive - both.effectiveDoseMSv)).toBeGreaterThan(1e-3);
    expect(naive).toBeGreaterThan(both.effectiveDoseMSv);
    expect(both.dlpMgyCm).toBeCloseTo(chest.dlpMgyCm + abd.dlpMgyCm, 9);
  });
  it('overlapping ranges: organ coverage is not double-counted (naive sum exceeds full coverage)', () => {
    const a = computeOrganDoses({ ctdiVolMgy: 10, ranges: [[40, 70]] });
    const b = computeOrganDoses({ ctdiVolMgy: 10, ranges: [[55, 85]] });
    const u = computeOrganDoses({ ctdiVolMgy: 10, ranges: [[40, 70], [55, 85]] });
    expect(u.scanLengthCm).toBe(45);
    const H = (r: typeof u, t: string) => r.tissues.find((x) => x.tissue === t)!.H;
    expect(H(u, 'liver')).toBeLessThanOrEqual(10 + 1e-9);
    expect(H(a, 'liver') + H(b, 'liver')).toBeGreaterThan(H(u, 'liver'));
    expect(a.effectiveDoseMSv + b.effectiveDoseMSv).toBeGreaterThan(u.effectiveDoseMSv);
  });
});
