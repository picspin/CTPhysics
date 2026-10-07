// Coarse dose regions of the v3 body + ICRP 103 tissue weighting factors per region.
// Pure logic (no three.js) so it can be unit-tested.
//
// wT values: ICRP Publication 103 (2007). Remainder (0.12) is shared equally by its 13
// sex-specific members, i.e. 0.12/13 each (equivalent re-statement of the ICRP mean).
// The tissue -> region assignment and the region z-boundaries are a TEACHING DESIGN
// ASSUMPTION (MOCK body geometry), not a validated anatomical partition.
import type { BodyRegionId } from '@/utils/dose-physics';
import type { PartKind } from './surface';

export const REGION_IDS: readonly BodyRegionId[] = ['head', 'neck', 'cardiothoracic', 'abdomen', 'peripheral'] as const;

/** Trunk z-ranges in cm from the vertex (MOCK, ~175 cm adult). Limbs are always 'peripheral'. */
export const REGION_Z_CM: Record<Exclude<BodyRegionId, 'peripheral'>, [number, number]> = {
  head: [0, 15],
  neck: [15, 33],
  cardiothoracic: [33, 62],
  abdomen: [62, 106],
};
export const STATURE_CM = 175.5;

/** Region of a point on the body, given the body part it belongs to. */
export function regionAt(zCm: number, part: PartKind | 'organ' = 'body'): BodyRegionId {
  if (part === 'arm') return 'peripheral';
  if (part === 'leg' && zCm >= REGION_Z_CM.abdomen[1]) return 'peripheral';
  if (zCm < REGION_Z_CM.head[1]) return 'head';
  if (zCm < REGION_Z_CM.neck[1]) return 'neck';
  if (zCm < REGION_Z_CM.cardiothoracic[1]) return 'cardiothoracic';
  if (zCm < REGION_Z_CM.abdomen[1]) return 'abdomen';
  return 'peripheral';
}

export const REMAINDER_EACH = 0.12 / 13;

export type Icrp103Tissue =
  | 'redBoneMarrow' | 'colon' | 'lung' | 'stomach' | 'breast' | 'gonads' | 'bladder' | 'oesophagus' | 'liver' | 'thyroid'
  | 'boneSurface' | 'brain' | 'salivaryGlands' | 'skin'
  // 13 remainder members (sex-specific member counted once)
  | 'adrenals' | 'extrathoracic' | 'gallBladder' | 'heart' | 'kidneys' | 'lymphNodes' | 'muscle' | 'oralMucosa'
  | 'pancreas' | 'prostateOrUterus' | 'smallIntestine' | 'spleen' | 'thymus';

export const ICRP103_WT: Record<Icrp103Tissue, number> = {
  redBoneMarrow: 0.12, colon: 0.12, lung: 0.12, stomach: 0.12, breast: 0.12,
  gonads: 0.08,
  bladder: 0.04, oesophagus: 0.04, liver: 0.04, thyroid: 0.04,
  boneSurface: 0.01, brain: 0.01, salivaryGlands: 0.01, skin: 0.01,
  adrenals: REMAINDER_EACH, extrathoracic: REMAINDER_EACH, gallBladder: REMAINDER_EACH, heart: REMAINDER_EACH,
  kidneys: REMAINDER_EACH, lymphNodes: REMAINDER_EACH, muscle: REMAINDER_EACH, oralMucosa: REMAINDER_EACH,
  pancreas: REMAINDER_EACH, prostateOrUterus: REMAINDER_EACH, smallIntestine: REMAINDER_EACH, spleen: REMAINDER_EACH,
  thymus: REMAINDER_EACH,
};

export const REMAINDER_MEMBERS: readonly Icrp103Tissue[] = [
  'adrenals', 'extrathoracic', 'gallBladder', 'heart', 'kidneys', 'lymphNodes', 'muscle', 'oralMucosa',
  'pancreas', 'prostateOrUterus', 'smallIntestine', 'spleen', 'thymus',
];

/** Design-assumption allocation; tissues distributed over the whole body are left unassigned. */
export const REGION_TISSUES: Record<BodyRegionId | 'unassigned', Icrp103Tissue[]> = {
  head: ['brain'],
  neck: ['thyroid', 'salivaryGlands', 'extrathoracic', 'oralMucosa'],
  cardiothoracic: ['lung', 'breast', 'oesophagus', 'heart', 'thymus'],
  abdomen: ['colon', 'stomach', 'gonads', 'liver', 'bladder', 'adrenals', 'gallBladder', 'kidneys', 'pancreas', 'prostateOrUterus', 'smallIntestine', 'spleen'],
  peripheral: [],
  unassigned: ['redBoneMarrow', 'boneSurface', 'skin', 'lymphNodes', 'muscle'],
};

export function regionWtSum(region: BodyRegionId | 'unassigned'): number {
  return REGION_TISSUES[region].reduce((a, t) => a + ICRP103_WT[t], 0);
}
