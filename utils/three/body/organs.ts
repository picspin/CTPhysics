// Procedural MOCK organ primitives, ported from the CTPhysics 3D prototype v3.1 (src/model.js).
// Ellipsoids / tubes only: NOT real anatomy. Coordinates in cm (x patient left +, y anterior +, z from vertex).
// `region` = coarse dose region (design assumption); `icrp` = ICRP 103 tissue the organ represents (null = none).
import type { BodyRegionId } from '@/utils/dose-physics';
import type { Icrp103Tissue } from './regions';

export type OrganLayer = 'bone' | 'lung' | 'organ';
export type OrganPart =
  | { k: 'ell' | 'cyl'; cx: number; cy: number; rx: number; ry: number; z0: number; z1: number }
  | { k: 'shell'; cx: number; cy: number; rx: number; ry: number; z0: number; z1: number; wall: number }
  | { k: 'rings'; cx: number; cy: number; rx: number; ry: number; z0: number; z1: number; pitch: number; band: number; t: number }
  | { k: 'vert'; cx: number; cy: number; rx: number; ry: number; z0: number; z1: number; pitch: number; len: number };
export interface OrganSpec {
  id: string;
  layer: OrganLayer;
  region: BodyRegionId;
  icrp: Icrp103Tissue | null;
  color: number;
  opacity: number;
  parts: OrganPart[];
}

export const ORGANS: OrganSpec[] = [
  { id: 'skull', layer: 'bone', region: 'head', icrp: 'boneSurface', color: 0xe9e4d3, opacity: 0.34, parts: [{ k: 'shell', cx: 0, cy: 1, rx: 7.4, ry: 9.1, z0: 0.6, z1: 21, wall: 0.9}] },
  { id: 'ribs', layer: 'bone', region: 'cardiothoracic', icrp: 'boneSurface', color: 0xe6dcc0, opacity: 1, parts: [{ k: 'rings', cx: 0, cy: 0, rx: 14.2, ry: 9, z0: 38, z1: 68, pitch: 3, band: 0.9, t: 0.9}, { k: 'ell', cx: 0, cy: 8.8, rx: 1.8, ry: 0.8, z0: 38, z1: 56}] },
  { id: 'clavicles', layer: 'bone', region: 'cardiothoracic', icrp: 'boneSurface', color: 0xe0d6bb, opacity: 1, parts: [{ k: 'ell', cx: 7.5, cy: 7, rx: 7.2, ry: 1.0, z0: 35.5, z1: 38.3},{ k: 'ell', cx: -7.5, cy: 7, rx: 7.2, ry: 1.0, z0: 35.5, z1: 38.3}] },
  { id: 'spine', layer: 'bone', region: 'cardiothoracic', icrp: 'boneSurface', color: 0xd9d0b5, opacity: 1, parts: [{ k: 'vert', cx: 0, cy: -3.5, rx: 2.0, ry: 1.9, z0: 29, z1: 42, pitch: 3.0, len: 2.3}, { k: 'vert', cx: 0, cy: -6.5, rx: 2.4, ry: 2.2, z0: 42, z1: 72, pitch: 3.2, len: 2.6}, { k: 'vert', cx: 0, cy: -6.0, rx: 2.9, ry: 2.3, z0: 72, z1: 99, pitch: 3.6, len: 3.0}] },
  { id: 'pelvis', layer: 'bone', region: 'abdomen', icrp: 'boneSurface', color: 0xe0d6bb, opacity: 1, parts: [{ k: 'ell', cx: 11, cy: -1.5, rx: 3.4, ry: 6.5, z0: 86, z1: 104},{ k: 'ell', cx: -11, cy: -1.5, rx: 3.4, ry: 6.5, z0: 86, z1: 104}, { k: 'ell', cx: 0, cy: -6.5, rx: 4.5, ry: 2.6, z0: 88, z1: 104},{ k: 'ell', cx: 0, cy: 8, rx: 5.5, ry: 1.2, z0: 101, z1: 106}] },
  { id: 'limbbones', layer: 'bone', region: 'peripheral', icrp: 'boneSurface', color: 0xe8dfc6, opacity: 1, parts: [{ k: 'cyl', cx: 21.5, cy: -4, rx: 1.3, ry: 1.3, z0: 36, z1: 62},{ k: 'cyl', cx: -21.5, cy: -4, rx: 1.3, ry: 1.3, z0: 36, z1: 62}, { k: 'cyl', cx: 21.5, cy: -4.2, rx: 1.0, ry: 0.9, z0: 64, z1: 85},{ k: 'cyl', cx: -21.5, cy: -4.2, rx: 1.0, ry: 0.9, z0: 64, z1: 85}, { k: 'cyl', cx: 8.5, cy: -3, rx: 2, ry: 2, z0: 98, z1: 131},{ k: 'cyl', cx: -8.5, cy: -3, rx: 2, ry: 2, z0: 98, z1: 131}, { k: 'cyl', cx: 8.5, cy: -4, rx: 1.4, ry: 1.4, z0: 134, z1: 168},{ k: 'cyl', cx: -8.5, cy: -4, rx: 1.4, ry: 1.4, z0: 134, z1: 168}] },
  { id: 'lungs', layer: 'lung', region: 'cardiothoracic', icrp: 'lung', color: 0x7fb2e8, opacity: 0.5, parts: [{ k: 'ell', cx: -7.5, cy: 0.3, rx: 6.3, ry: 7.4, z0: 36, z1: 63},{ k: 'ell', cx: 7.5, cy: 0.3, rx: 6.0, ry: 7.4, z0: 36, z1: 63}] },
  { id: 'airway', layer: 'lung', region: 'neck', icrp: 'extrathoracic', color: 0x6fd6cf, opacity: 1, parts: [{ k: 'cyl', cx: 0, cy: 1.5, rx: 0.9, ry: 0.9, z0: 24, z1: 47}] },
  { id: 'brain', layer: 'organ', region: 'head', icrp: 'brain', color: 0xf0a9a0, opacity: 1, parts: [{ k: 'ell', cx: 0, cy: 1, rx: 6.5, ry: 8.4, z0: 2.5, z1: 19.5}] },
  { id: 'thyroid', layer: 'organ', region: 'neck', icrp: 'thyroid', color: 0xd6658a, opacity: 1, parts: [{ k: 'ell', cx: 0, cy: 3.3, rx: 2.9, ry: 1.1, z0: 25, z1: 30.5}] },
  { id: 'esophagus', layer: 'organ', region: 'cardiothoracic', icrp: 'oesophagus', color: 0xc9806b, opacity: 1, parts: [{ k: 'cyl', cx: -0.2, cy: -0.9, rx: 0.8, ry: 0.6, z0: 27, z1: 62}] },
  { id: 'heart', layer: 'organ', region: 'cardiothoracic', icrp: 'heart', color: 0xc0392b, opacity: 1, parts: [{ k: 'ell', cx: 3.5, cy: 3.5, rx: 5, ry: 4.6, z0: 45, z1: 60}] },
  { id: 'aorta', layer: 'organ', region: 'cardiothoracic', icrp: null, color: 0xe5533d, opacity: 1, parts: [{ k: 'cyl', cx: 2.3, cy: -2.8, rx: 1.3, ry: 1.3, z0: 48, z1: 97}] },
  { id: 'liver', layer: 'organ', region: 'abdomen', icrp: 'liver', color: 0x8b3a2f, opacity: 1, parts: [{ k: 'ell', cx: -4.6, cy: 2.5, rx: 8.6, ry: 6.5, z0: 58, z1: 78}] },
  { id: 'gallbladder', layer: 'organ', region: 'abdomen', icrp: 'gallBladder', color: 0x5e9c4a, opacity: 1, parts: [{ k: 'ell', cx: -7, cy: 7.6, rx: 1.3, ry: 2.0, z0: 71, z1: 77}] },
  { id: 'stomach', layer: 'organ', region: 'abdomen', icrp: 'stomach', color: 0xd98b7e, opacity: 1, parts: [{ k: 'ell', cx: 5.5, cy: 3.5, rx: 4.8, ry: 3.8, z0: 62, z1: 74}] },
  { id: 'spleen', layer: 'organ', region: 'abdomen', icrp: 'spleen', color: 0x8e44ad, opacity: 1, parts: [{ k: 'ell', cx: 11, cy: -2.5, rx: 2.2, ry: 4.5, z0: 62, z1: 73}] },
  { id: 'pancreas', layer: 'organ', region: 'abdomen', icrp: 'pancreas', color: 0xe0b25c, opacity: 1, parts: [{ k: 'ell', cx: 0, cy: -0.6, rx: 6, ry: 1.6, z0: 68, z1: 74}] },
  { id: 'kidneys', layer: 'organ', region: 'abdomen', icrp: 'kidneys', color: 0xb5533c, opacity: 1, parts: [{ k: 'ell', cx: 6.2, cy: -4.8, rx: 2.5, ry: 3, z0: 70, z1: 83},{ k: 'ell', cx: -6.2, cy: -4.8, rx: 2.5, ry: 3, z0: 70, z1: 83}] },
  { id: 'adrenals', layer: 'organ', region: 'abdomen', icrp: 'adrenals', color: 0xd4a017, opacity: 1, parts: [{ k: 'ell', cx: 4.4, cy: -5.4, rx: 1.0, ry: 1.2, z0: 66.5, z1: 71.5},{ k: 'ell', cx: -4.4, cy: -5.4, rx: 1.0, ry: 1.2, z0: 66.5, z1: 71.5}] },
  { id: 'small_bowel', layer: 'organ', region: 'abdomen', icrp: 'smallIntestine', color: 0xe3a79c, opacity: 1, parts: [{ k: 'ell', cx: 0, cy: 2.2, rx: 7.2, ry: 4.4, z0: 79, z1: 97}] },
  { id: 'colon', layer: 'organ', region: 'abdomen', icrp: 'colon', color: 0xb8735f, opacity: 1, parts: [{ k: 'cyl', cx: -9.6, cy: 0.8, rx: 1.9, ry: 1.9, z0: 80, z1: 96},{ k: 'cyl', cx: 9.6, cy: -0.6, rx: 1.7, ry: 1.7, z0: 76, z1: 94}, { k: 'ell', cx: 0, cy: 6.3, rx: 10, ry: 1.8, z0: 75, z1: 81},{ k: 'ell', cx: 3.5, cy: 0.5, rx: 4.2, ry: 2.2, z0: 92, z1: 99}] },
  { id: 'bladder', layer: 'organ', region: 'abdomen', icrp: 'bladder', color: 0xf1d26a, opacity: 1, parts: [{ k: 'ell', cx: 0, cy: 3.2, rx: 3.6, ry: 3.0, z0: 96, z1: 104}] },
];

export const ORGAN_IDS = ORGANS.map((o) => o.id);

/** Centre of an organ (mean of its part centres), cm. */
export function organCenter(o: OrganSpec): [number, number, number] {
  let x = 0, y = 0, z = 0;
  for (const p of o.parts) { x += p.cx; y += p.cy; z += (p.z0 + p.z1) / 2; }
  const n = o.parts.length;
  return [x / n, y / n, z / n];
}
