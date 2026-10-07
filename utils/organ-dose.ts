// ============================================================================
// Organ-by-organ effective dose (ICRP 103 methodology) — TEACHING MODEL
// ============================================================================
//
// ICRP methodology: effective dose for CT must be computed organ by organ with
// tissue weighting,
//
//     E = Σ_T w_T · H_T      (summed over ALL tissues, i.e. the whole body)
//
// with the remainder handled as   w_remainder · mean(H_T of the 13 remainder tissues),
// w_remainder = 0.12. A region "k-factor" is then only a DERIVED quantity:
//
//     k = E / DLP   [mSv / (mGy·cm)],   and   E_region = DLP × k  (identity).
//
// Combined multi-region scans: the scan ranges are merged first, every organ's
// H_T is computed from its coverage by the UNION of the ranges, and E is
// computed once. Per-region E values are never added.
//
// What is MOCK / illustrative here (not dosimetry):
//   • organ z-extents come from the procedural MOCK body (utils/three/body/organs.ts)
//     or from the hand-made TISSUE_SEGMENTS table below;
//   • organ dose model:  H_T = CTDIvol × [ f_T + s · (1 − f_T) ]   (mGy → mSv, w_R = 1 for photons)
//     f_T = fraction of the tissue's (mock) mass inside the scanned z-range,
//     s   = a flat out-of-field scatter fraction (MOCK, default 0.01).
//   Real organ doses depend on kVp spectrum, patient size, tube-current modulation,
//   bow-tie filtration and depth; use Monte Carlo tools / validated software for that.
// ============================================================================

import { ORGANS, type OrganSpec } from '@/utils/three/body/organs';
import type { BodyRegionId } from '@/utils/dose-physics';

// ---- ICRP 103 tissue weighting factors ----------------------------------------------

export type WeightedTissue =
  | 'redBoneMarrow' | 'colon' | 'stomach' | 'lung' | 'breast'
  | 'gonads'
  | 'bladder' | 'oesophagus' | 'liver' | 'thyroid'
  | 'boneSurface' | 'brain' | 'salivaryGlands' | 'skin';

export type RemainderTissue =
  | 'adrenals' | 'extrathoracic' | 'gallBladder' | 'heart' | 'kidneys' | 'lymphNodes' | 'muscle'
  | 'oralMucosa' | 'pancreas' | 'prostateOrUterus' | 'smallIntestine' | 'spleen' | 'thymus';

export type Tissue = WeightedTissue | RemainderTissue;

/** ICRP 103 w_T. 'remainder' (0.12) is applied to the MEAN H_T of the 13 remainder tissues. */
export const ICRP103_WT_TABLE: Record<WeightedTissue | 'remainder', number> = {
  redBoneMarrow: 0.12, colon: 0.12, stomach: 0.12, lung: 0.12, breast: 0.12, remainder: 0.12,
  gonads: 0.08,
  bladder: 0.04, oesophagus: 0.04, liver: 0.04, thyroid: 0.04,
  boneSurface: 0.01, brain: 0.01, salivaryGlands: 0.01, skin: 0.01,
};

/** Rows of the w_T table as shown in the UI (owner's grouping). */
export const WT_TABLE_ROWS: Array<{ wT: number; tissues: Array<WeightedTissue | 'remainder'> }> = [
  { wT: 0.12, tissues: ['redBoneMarrow', 'colon', 'stomach', 'lung', 'breast', 'remainder'] },
  { wT: 0.08, tissues: ['gonads'] },
  { wT: 0.04, tissues: ['bladder', 'oesophagus', 'liver', 'thyroid'] },
  { wT: 0.01, tissues: ['boneSurface', 'brain', 'salivaryGlands', 'skin'] },
];

export const WEIGHTED_TISSUES = Object.keys(ICRP103_WT_TABLE).filter((k) => k !== 'remainder') as WeightedTissue[];

/** ICRP 103 remainder tissues (13; prostate for males / uterus-cervix for females counted as one entry). */
export const REMAINDER_TISSUES: readonly RemainderTissue[] = [
  'adrenals', 'extrathoracic', 'gallBladder', 'heart', 'kidneys', 'lymphNodes', 'muscle',
  'oralMucosa', 'pancreas', 'prostateOrUterus', 'smallIntestine', 'spleen', 'thymus',
];
export const W_REMAINDER = ICRP103_WT_TABLE.remainder;
export const ALL_TISSUES: readonly Tissue[] = [...WEIGHTED_TISSUES, ...REMAINDER_TISSUES];

export const isRemainder = (t: Tissue): t is RemainderTissue => (REMAINDER_TISSUES as readonly string[]).includes(t);

// ---- Interactive key regions / organs (ICRP-102-style simplification) -------------------

/** The only organs the user can pick in 3D. Everything else still counts in E. */
export const INTERACTIVE_ORGANS: Record<string, { region: BodyRegionId; tissue: Tissue | null }> = {
  brain: { region: 'head', tissue: 'brain' },
  thyroid: { region: 'neck', tissue: 'thyroid' },
  lungs: { region: 'cardiothoracic', tissue: 'lung' },
  heart: { region: 'cardiothoracic', tissue: 'heart' },       // remainder tissue
  liver: { region: 'abdomen', tissue: 'liver' },
  kidneys: { region: 'abdomen', tissue: 'kidneys' },          // remainder tissue
  limbbones: { region: 'peripheral', tissue: null },          // limbs: skin / bone surface / marrow / muscle share
};
export const INTERACTIVE_ORGAN_IDS = Object.keys(INTERACTIVE_ORGANS);

// ---- Spatial (z) model --------------------------------------------------------------

/** z-ranges of the five scan regions, cm from the vertex (MOCK ~175 cm adult). Limbs/trunk = lower limbs. */
export const REGION_SCAN_RANGE_CM: Record<BodyRegionId, [number, number]> = {
  head: [0, 15],
  neck: [15, 33],
  cardiothoracic: [33, 62],
  abdomen: [62, 106],
  peripheral: [106, 175],
};

/** A mass segment: uniform mass along [z0, z1] carrying `w` of the tissue's mass. */
export type Segment = [z0: number, z1: number, w: number];

const organ = (id: string): OrganSpec => {
  const o = ORGANS.find((x) => x.id === id);
  if (!o) throw new Error('unknown organ ' + id);
  return o;
};

/** Mass profile of a MOCK organ along z, from its primitives (ellipsoid cross-section ∝ 1−u²). 0.5 cm bins. */
function organSegments(id: string): Segment[] {
  const o = organ(id);
  const bins = new Map<number, number>();
  let total = 0;
  for (const p of o.parts) {
    const zc = (p.z0 + p.z1) / 2, hz = (p.z1 - p.z0) / 2;
    for (let z = Math.floor(p.z0 * 2) / 2; z < p.z1; z += 0.5) {
      const zm = z + 0.25;
      if (zm < p.z0 || zm > p.z1) continue;
      const u = (zm - zc) / hz;
      const area = p.rx * p.ry * (p.k === 'ell' ? Math.max(0, 1 - u * u) : 1);
      bins.set(z, (bins.get(z) ?? 0) + area);
      total += area;
    }
  }
  return Array.from(bins.entries()).sort((a, b) => a[0] - b[0]).map(([z, a]) => [z, z + 0.5, a / total] as Segment);
}

/** Hand-made MOCK mass distributions for tissues without their own mesh (fractions sum to 1). */
export const TISSUE_SEGMENTS_MOCK: Partial<Record<Tissue, Segment[]>> = {
  redBoneMarrow: [[0, 21, 0.08], [29, 68, 0.30], [68, 86, 0.15], [86, 106, 0.38], [106, 130, 0.09]],
  boneSurface: [[0, 21, 0.15], [21, 106, 0.50], [106, 175, 0.35]],
  skin: [[0, 21, 0.08], [21, 32, 0.04], [32, 106, 0.50], [106, 175, 0.38]],
  muscle: [[0, 32, 0.06], [32, 106, 0.50], [106, 175, 0.44]],
  lymphNodes: [[21, 32, 0.15], [32, 68, 0.30], [68, 106, 0.40], [106, 130, 0.15]],
  breast: [[38, 56, 1]],
  gonads: [[96, 112, 1]],
  salivaryGlands: [[14, 26, 1]],
  extrathoracic: [[11, 30, 1]],
  oralMucosa: [[16, 22, 1]],
  thymus: [[36, 46, 1]],
  prostateOrUterus: [[94, 104, 1]],
};

/** Tissue -> MOCK organ mesh that defines its z-extent. */
const TISSUE_ORGAN: Partial<Record<Tissue, string>> = {
  brain: 'brain', thyroid: 'thyroid', lung: 'lungs', heart: 'heart', liver: 'liver', kidneys: 'kidneys',
  stomach: 'stomach', colon: 'colon', bladder: 'bladder', oesophagus: 'esophagus', gallBladder: 'gallbladder',
  spleen: 'spleen', pancreas: 'pancreas', adrenals: 'adrenals', smallIntestine: 'small_bowel',
};

const SEGMENTS: Record<Tissue, Segment[]> = (() => {
  const out = {} as Record<Tissue, Segment[]>;
  for (const t of ALL_TISSUES) {
    const id = TISSUE_ORGAN[t];
    const s = id ? organSegments(id) : TISSUE_SEGMENTS_MOCK[t];
    if (!s) throw new Error('no spatial model for ' + t);
    out[t] = s;
  }
  return out;
})();
export const tissueSegments = (t: Tissue): Segment[] => SEGMENTS[t];

// ---- Scan ranges ------------------------------------------------------------------

export type Range = [number, number];

/** Merge overlapping / touching ranges (sorted, disjoint result). */
export function mergeRanges(ranges: Range[]): Range[] {
  const r = ranges.map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as Range).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  for (const [a, b] of r) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
export const rangesLength = (ranges: Range[]) => mergeRanges(ranges).reduce((s, [a, b]) => s + (b - a), 0);
export const rangesForRegions = (regions: BodyRegionId[]): Range[] => mergeRanges(regions.map((r) => [...REGION_SCAN_RANGE_CM[r]] as Range));

/** Fraction of a tissue's mass inside the (merged) scan ranges, 0..1. */
export function coverageFraction(t: Tissue, ranges: Range[]): number {
  const m = mergeRanges(ranges);
  let f = 0;
  for (const [z0, z1, w] of SEGMENTS[t]) {
    const len = z1 - z0;
    if (len <= 0) continue;
    for (const [a, b] of m) {
      const ov = Math.min(z1, b) - Math.max(z0, a);
      if (ov > 0) f += w * (ov / len);
    }
  }
  return Math.min(1, Math.max(0, f));
}

// ---- Organ doses & effective dose ----------------------------------------------------

export const MOCK_SCATTER_FRACTION = 0.01;

export interface OrganDoseInput {
  /** CTDIvol in mGy (assumed constant over the scan; no tube-current modulation) */
  ctdiVolMgy: number;
  /** scanned z-ranges (cm from the vertex); merged internally */
  ranges: Range[];
  /** MOCK out-of-field scatter fraction */
  scatter?: number;
}

export interface TissueDose {
  tissue: Tissue;
  remainder: boolean;
  /** coverage fraction f_T */
  f: number;
  /** equivalent dose H_T, mSv */
  H: number;
  /** effective weight used: w_T, or 0.12/13 for each remainder tissue (= 0.12 × mean) */
  wEff: number;
  /** contribution to E, mSv */
  contribution: number;
}

export interface OrganDoseResult {
  ranges: Range[];
  scanLengthCm: number;
  ctdiVolMgy: number;
  dlpMgyCm: number;
  tissues: TissueDose[];
  remainderMeanH: number;
  remainderContribution: number;
  /** E = Σ w_T H_T + 0.12 × mean(H_remainder), mSv */
  effectiveDoseMSv: number;
  /** derived k = E / DLP, mSv/(mGy·cm); NaN when DLP = 0 */
  kDerived: number;
}

export function organEquivalentDose(t: Tissue, input: OrganDoseInput): { f: number; H: number } {
  const s = input.scatter ?? MOCK_SCATTER_FRACTION;
  const f = coverageFraction(t, input.ranges);
  return { f, H: input.ctdiVolMgy * (f + s * (1 - f)) };
}

/** Whole-body organ-by-organ E for a (possibly multi-region) scan. */
export function computeOrganDoses(input: OrganDoseInput): OrganDoseResult {
  const ranges = mergeRanges(input.ranges);
  const L = rangesLength(ranges);
  const dlp = input.ctdiVolMgy * L;
  const H = (t: Tissue) => organEquivalentDose(t, { ...input, ranges });
  const tissues: TissueDose[] = [];
  let E = 0;
  for (const t of WEIGHTED_TISSUES) {
    const { f, H: h } = H(t);
    const w = ICRP103_WT_TABLE[t];
    tissues.push({ tissue: t, remainder: false, f, H: h, wEff: w, contribution: w * h });
    E += w * h;
  }
  let sumRem = 0;
  for (const t of REMAINDER_TISSUES) {
    const { f, H: h } = H(t);
    sumRem += h;
    tissues.push({ tissue: t, remainder: true, f, H: h, wEff: W_REMAINDER / REMAINDER_TISSUES.length, contribution: (W_REMAINDER * h) / REMAINDER_TISSUES.length });
  }
  const remMean = sumRem / REMAINDER_TISSUES.length;
  const remContribution = W_REMAINDER * remMean;
  E += remContribution;
  return {
    ranges, scanLengthCm: L, ctdiVolMgy: input.ctdiVolMgy, dlpMgyCm: dlp, tissues,
    remainderMeanH: remMean, remainderContribution: remContribution,
    effectiveDoseMSv: E, kDerived: dlp > 0 ? E / dlp : NaN,
  };
}

/** Convenience: scan the given regions (merged) at CTDIvol. */
export const computeRegionsDose = (regions: BodyRegionId[], ctdiVolMgy: number, scatter?: number) =>
  computeOrganDoses({ ctdiVolMgy, ranges: rangesForRegions(regions), scatter });

/** Region-level E from the derived k: E_region = DLP × k (equals E by construction). */
export const effectiveDoseFromK = (dlpMgyCm: number, k: number) => dlpMgyCm * k;

/** Tissues sorted by their contribution to E (remainder tissues individually at 0.12/13 × H_T). */
export const topContributors = (r: OrganDoseResult, n = 5): TissueDose[] =>
  [...r.tissues].sort((a, b) => b.contribution - a.contribution).slice(0, n);
