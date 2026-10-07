// Pure helpers shared by the three.js body builder and the unit tests.
import { regionAt, REGION_IDS } from './regions';
import type { BodyRegionId } from '@/utils/dose-physics';

export interface BodyFrame {
  /** scene units per cm */
  s: number;
  /** local Y of the vertex (top of head) */
  topY: number;
  /** +1: anterior faces local +Z (upright viewer); -1: anterior faces local -Z (so a +90deg X rotation lays the body supine) */
  anterior: 1 | -1;
}

/** cm (x left+, y anterior+, z from vertex) -> local scene coordinates. */
export function cmToLocal(f: BodyFrame, x: number, y: number, z: number): [number, number, number] {
  return [x * f.s, f.topY - z * f.s, f.anterior * y * f.s];
}
export function localToCm(f: BodyFrame, X: number, Y: number, Z: number): [number, number, number] {
  return [X / f.s, (Z / f.s) * f.anterior, (f.topY - Y) / f.s];
}

/** Classify a skin point (cm) into a coarse dose region. Arms hang beside the trunk at |x| > ~17.5 cm. */
export function regionOfSkinPoint(x: number, z: number): BodyRegionId {
  if (Math.abs(x) > 17.5 && z > 32 && z < 111) return 'peripheral';
  if (z >= 106) return 'peripheral';
  return regionAt(z, 'body');
}

export function regionIndex(r: BodyRegionId): number {
  return REGION_IDS.indexOf(r);
}

/** Clamp the skin opacity slider (5%..90%, default 30% as in the prototype). */
export const SKIN_OPACITY_DEFAULT = 0.3;
export function clampSkinOpacity(v: number): number {
  if (!Number.isFinite(v)) return SKIN_OPACITY_DEFAULT;
  return Math.min(0.9, Math.max(0.05, v));
}
