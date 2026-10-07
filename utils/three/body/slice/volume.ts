// Input tables for the CT slice kernel (WASM in public/wasm/ct_kernel.wasm, JS twin in ./jsEngine.ts).
// Ported from the CTPhysics 3D prototype v3.1 (src/model.js + src/init-data.js).
// EVERYTHING here is MOCK: procedural ellipsoids/tubes from ../organs.ts and the lofted surface from ../surface.ts,
// rasterised into a 256 x 256 x 351 label volume (0.195 cm pixels, 0.5 cm slices, z = 0..175 cm from the vertex).
// HU values are illustrative teaching numbers, not measured attenuation.
import { ORGANS } from '../organs';
import { SURFACE_TABLE, COLS } from '../surface';
import { REGION_IDS } from '../regions';

export const N = 256, NN = N * N, NZ = 351, MAXP = 512, PSTRIDE = 16;
export const FOV_CM = 50, X0 = -25, Y0 = 23.5, PX = FOV_CM / N;
export const Z_MAX_CM = (NZ - 1) * 0.5;
export const SKIN_IDX = 1, SOFT_IDX = 200, TABLE_IDX = 201;

/** MOCK HU per tissue class (prototype regions.json, status "mock"). */
export const MOCK_HU = {
  air: -1000, fat: -100, soft: 45, blood: 40, lung: -800, brain: 35, fluid: 8,
  boneCranial: 700, boneAxial: 400, boneLimb: 500, table: -300,
} as const;
/** MOCK organ-level HU. */
export const ORGAN_HU: Record<string, number> = {
  skull: MOCK_HU.boneCranial, ribs: MOCK_HU.boneAxial, clavicles: MOCK_HU.boneAxial, spine: MOCK_HU.boneAxial, pelvis: MOCK_HU.boneAxial,
  limbbones: MOCK_HU.boneLimb, lungs: MOCK_HU.lung, airway: MOCK_HU.air, brain: MOCK_HU.brain, thyroid: 75, esophagus: MOCK_HU.soft,
  heart: MOCK_HU.blood, aorta: MOCK_HU.blood, liver: 60, gallbladder: MOCK_HU.fluid, stomach: 40, spleen: 50, pancreas: 45,
  kidneys: 32, adrenals: MOCK_HU.soft, small_bowel: 30, colon: 25, bladder: MOCK_HU.fluid,
};

/** Label index of every organ id in the volume (skin = 1, organs 2..). */
export const ORGAN_LABEL: Record<string, number> = {};
ORGANS.forEach((o, i) => { ORGAN_LABEL[o.id] = i + 2; });
export const LABEL_ORGAN: Record<number, string> = { [SKIN_IDX]: 'skin', [SOFT_IDX]: 'soft', [TABLE_IDX]: 'table' };
ORGANS.forEach((o, i) => { LABEL_ORGAN[i + 2] = o.id; });

export interface SliceInit {
  prims: Float64Array; kps: Float64Array; np: number;
  lutHU: Float64Array; lutReg: Uint8Array; lutTis: Uint8Array; palette: Uint8Array; wT: Float64Array; tisReg: Uint8Array;
}

const KIND = { ell: 1, cyl: 2, shell: 3, rings: 4, vert: 5 } as const;
const REGION_RGB: Record<string, [number, number, number]> = {
  head: [90, 169, 255], neck: [63, 208, 201], cardiothoracic: [255, 122, 122], abdomen: [180, 140, 255], peripheral: [140, 200, 120],
};

export function buildSliceInit(): SliceInit {
  const prims = new Float64Array(MAXP * PSTRIDE);
  const kps = new Float64Array(2048 * COLS); kps.set(SURFACE_TABLE.kps.subarray(0, SURFACE_TABLE.nk * COLS));
  let np = 0;
  const push = (a: number[]) => { if (np >= MAXP) throw new Error('too many primitives'); prims.set(a, np * PSTRIDE); np++; };
  const off = SURFACE_TABLE.off;
  // couch + headrest (lowest priority)
  push([7, TABLE_IDX, 0, -13.4, 22, 1.1, -1, 1000]);
  push([7, TABLE_IDX, 0, -10.45, 10, 1.85, -1, 26]);
  // skin: subcutaneous-fat outline of every part, nose/ears, then soft-tissue interiors (same order as the prototype)
  const profs: Array<['body' | 'arm' | 'leg', number]> = [['body', 0], ['arm', 1], ['arm', -1], ['leg', 1], ['leg', -1]];
  for (const [k, sgn] of profs) push([6, SKIN_IDX, sgn, 0, 0, 0, 0, 0, off[k][0], off[k][1], 0, 0, 0, 0]);
  push([1, SKIN_IDX, 0, 11.2, 1.1, 1.9, 11.2, 16.8]);
  push([1, SKIN_IDX, 8.0, 0.4, 0.8, 2.0, 8.6, 14.4]);
  push([1, SKIN_IDX, -8.0, 0.4, 0.8, 2.0, 8.6, 14.4]);
  for (const [k, sgn] of profs) push([6, SOFT_IDX, sgn, 0, 0, 0, 0, 0, off[k][0], off[k][1], 1, 0.35, 1.3, 22]);
  for (const o of ORGANS) {
    const id = ORGAN_LABEL[o.id];
    for (const p of o.parts) {
      if (p.k === 'shell') push([3, id, p.cx, p.cy, p.rx, p.ry, p.z0, p.z1, p.wall]);
      else if (p.k === 'rings') push([4, id, p.cx, p.cy, p.rx, p.ry, p.z0, p.z1, p.pitch, p.band, p.t]);
      else if (p.k === 'vert') push([5, id, p.cx, p.cy, p.rx, p.ry, p.z0, p.z1, p.pitch, p.len]);
      else push([KIND[p.k], id, p.cx, p.cy, p.rx, p.ry, p.z0, p.z1]);
    }
  }
  const lutHU = new Float64Array(256), lutReg = new Uint8Array(256), lutTis = new Uint8Array(256), palette = new Uint8Array(24);
  lutHU[0] = MOCK_HU.air; lutHU[SKIN_IDX] = MOCK_HU.fat; lutHU[SOFT_IDX] = MOCK_HU.soft; lutHU[TABLE_IDX] = MOCK_HU.table;
  REGION_IDS.forEach((r, i) => palette.set(REGION_RGB[r], (i + 1) * 3));
  for (const o of ORGANS) {
    const id = ORGAN_LABEL[o.id];
    const hu = ORGAN_HU[o.id]; if (hu === undefined) throw new Error('no mock HU for ' + o.id);
    lutHU[id] = hu; lutReg[id] = REGION_IDS.indexOf(o.region) + 1;
  }
  // Dose is computed in utils/organ-dose.ts (the kernel no longer contains a dose routine); wT/tisReg stay zero.
  return { prims, kps, np, lutHU, lutReg, lutTis, palette, wT: new Float64Array(64), tisReg: new Uint8Array(64) };
}

/** body z (cm from vertex) -> pixel helpers for overlays */
export const pxToCm = (px: number, py: number): [number, number] => [X0 + (px + 0.5) * PX, Y0 - (py + 0.5) * PX];
