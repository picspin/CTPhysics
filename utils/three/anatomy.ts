// Shared anatomy specification for the anthropomorphic Alderson-style phantom.
//
// This file is the SINGLE source of truth for body-part geometry consumed by:
//   - parametricPhantom.ts  (HelicalCTSimulator: silhouette only)
//   - bodyModel.ts          (Dose page: region-segmented, clickable)
//
// By reading from one ANATOMY list the two consumers stay in sync — if a part
// shape changes here, both simulators update identically.
//
// -------------------------------------------------------------------------
// Reference: Alderson-style anthropomorphic phantom (orange translucent) lying
// on its back. Readable anatomy:
//   - Skull with neck pinch
//   - Segmented rib cage (barrel chest)
//   - Tapered waist between rib cage and pelvis
//   - Pelvis slightly wider than waist
//   - Arms: shoulder → upper arm → elbow → forearm → hand  (5 segs / arm)
//   - Legs: hip → thigh → knee → calf → foot              (5 segs / leg)
//
// All units are ~decimeters. Local +Y = head, body in upright stance.
// The HelicalCT consumer rotates the whole group 90° on X so +Y maps to
// world +Z (patient lies along scanner bore).
// -------------------------------------------------------------------------

import * as THREE from 'three';
import { BodyRegionId } from '@/utils/dose-physics';

/** Tier controlling sphere/cylinder segment counts. */
export type AnatomyTier = 'low' | 'standard' | 'hero';

export const ANATOMY_TIER_SEGMENTS: Record<AnatomyTier, [number, number]> = {
  low: [16, 12],
  standard: [32, 24],
  hero: [48, 36],
};

/**
 * Anatomy part kinds. We restrict to BufferGeometry primitives so the
 * module is in-place loadable (no async fetches, no marching cubes).
 */
export type AnatomyPartKind =
  | 'sphere'
  | 'capsule'
  | 'cylinder'
  | 'box';

/**
 * One anatomical piece of the body. Each spec produces a single Mesh in
 * the assembled phantom.
 *
 * Fields:
 *   - id: stable identifier used for debugging / hit-testing debugging.
 *   - kind: primitive shape to build.
 *   - regionId: which dose region this part belongs to (null = silhouette
 *               only, not exposed to the Dose raycaster; e.g. very small
 *               connector parts that aren't a useful click target).
 *   - position: local-space center (decimeters, Y-up body).
 *   - rotationEuler: rotation in radians applied to the primitive before
 *                    it's placed. Use this to tilt a capsule along an
 *                    arm's local axis (Z-up capsule tilted outward).
 *   - scale: per-axis scale. For 'sphere' this stretches the unit sphere
 *            (radius 1). For 'capsule' / 'cylinder' the geometry is
 *            built at unit length along +Y and scaled.
 *   - extra: kind-specific sizing. For 'sphere' = [radius, _unused, _unused].
 *            For 'capsule' / 'cylinder' = [radius, length, _unused].
 *            For 'box' = [width, height, depth] (size of the box).
 */
export interface AnatomyPart {
  id: string;
  kind: AnatomyPartKind;
  regionId: BodyRegionId | null;
  position: [number, number, number];
  rotationEuler: [number, number, number];
  scale: [number, number, number];
  extra: [number, number, number];
}

/**
 * The full anatomy. Order matters only for predictability in the
 * scene-graph; it is NOT load-bearing.
 *
 * Y-coordinates (decimeters, upright stance, head at +Y):
 *   head         y = +2.50
 *   neck         y = +2.05
 *   shoulders    y = +1.70
 *   rib cage     y = +1.20
 *   waist        y = +0.50
 *   pelvis       y = -0.20
 *   hands        y = +0.20
 *   forearms     y = +0.60
 *   upper arms   y = +1.40
 *   thighs       y = -0.70
 *   calves       y = -1.40
 *   feet         y = -2.00
 *
 * Lateral X offsets for paired limbs:
 *   upper arms   x = ±0.85
 *   forearms     x = ±1.00
 *   hands        x = ±1.10
 *   thighs       x = ±0.40
 *   calves       x = ±0.45
 *   feet         x = ±0.45
 */
export const ANATOMY: AnatomyPart[] = [
  // ----- Head + neck -----
  // Slight bottom-taper so the silhouette has a chin-like narrowing.
  {
    id: 'head',
    kind: 'sphere',
    regionId: 'head',
    position: [0, 2.30, 0],
    rotationEuler: [0, 0, 0],
    scale: [0.30, 0.36, 0.28],
    extra: [0.30, 0, 0],
  },
  // Neck — small oblate sphere making the pinch between head and shoulders.
  {
    id: 'neck',
    kind: 'sphere',
    regionId: 'neck',
    position: [0, 1.90, 0],
    rotationEuler: [0, 0, 0],
    scale: [0.13, 0.14, 0.12],
    extra: [0.13, 0, 0],
  },

  // ----- Shoulders / upper chest -----
  // Wider than the rib cage itself so the silhouette has a shoulder bulge.
  {
    id: 'shoulders',
    kind: 'sphere',
    regionId: 'cardiothoracic',
    position: [0, 1.62, 0],
    rotationEuler: [0, 0, 0],
    scale: [0.52, 0.22, 0.34],
    extra: [0.52, 0, 0],
  },
  // Rib cage — barrel-cylinder shape. We use a Y-axis cylinder scaled
  // wider in X and slightly in Z, with a moderate Y length, to give the
  // rib cage its segmented barrel feel.
  {
    id: 'ribcage',
    kind: 'cylinder',
    regionId: 'cardiothoracic',
    position: [0, 1.15, 0],
    rotationEuler: [0, 0, 0],
    scale: [0.46, 0.50, 0.34],
    extra: [0.42, 0.55, 0], // radius, length, _
  },

  // ----- Waist + pelvis -----
  // Abdomen/waist — narrower than rib cage → produces the taper.
  {
    id: 'waist',
    kind: 'sphere',
    regionId: 'abdomen',
    position: [0, 0.45, 0],
    rotationEuler: [0, 0, 0],
    scale: [0.32, 0.36, 0.27],
    extra: [0.32, 0, 0],
  },
  // Pelvis — wider than waist, slightly flatter.
  {
    id: 'pelvis',
    kind: 'sphere',
    regionId: 'abdomen',
    position: [0, -0.15, 0],
    rotationEuler: [0, 0, 0],
    scale: [0.44, 0.30, 0.34],
    extra: [0.44, 0, 0],
  },

  // ----- Arms (peripheral) -----
  // Capsules are unit-length along +Y in their geometry. We keep the
  // arms hanging roughly downward along -Y (capsule default axis), with
  // a small Z-rotation so the elbow drifts slightly outward.
  //
  // Geometry of a capsule rotated by `theta` around Z:
  //   top sits at (sin(theta), cos(theta)) * length/2
  //   bottom sits at (-sin(theta), -cos(theta)) * length/2
  // With theta=0 the capsule points straight up; theta>0 tilts the
  // capsule so its top leans toward +X and bottom toward -X. To hang an
  // arm down with the shoulder ABOVE the elbow, the top half of the
  // capsule must be tucked under the shoulder and the bottom extends
  // outward — which means a NEGATIVE rotation for the right arm and a
  // POSITIVE rotation for the left arm. We pick small angles (~12°) so
  // the arms hang nearly straight down with a natural bow outward.
  {
    id: 'upperArmL',
    kind: 'capsule',
    regionId: 'peripheral',
    position: [-0.62, 1.20, 0],
    rotationEuler: [0, 0, 0.22], // tilt outward ~12° to the left
    scale: [0.13, 0.55, 0.13],
    extra: [0.13, 0.55, 0],
  },
  {
    id: 'upperArmR',
    kind: 'capsule',
    regionId: 'peripheral',
    position: [0.62, 1.20, 0],
    rotationEuler: [0, 0, -0.22], // tilt outward ~12° to the right
    scale: [0.13, 0.55, 0.13],
    extra: [0.13, 0.55, 0],
  },
  // Forearms: elbow → wrist, hanging slightly further outward.
  {
    id: 'forearmL',
    kind: 'capsule',
    regionId: 'peripheral',
    position: [-0.78, 0.50, 0],
    rotationEuler: [0, 0, 0.18],
    scale: [0.11, 0.50, 0.11],
    extra: [0.11, 0.50, 0],
  },
  {
    id: 'forearmR',
    kind: 'capsule',
    regionId: 'peripheral',
    position: [0.78, 0.50, 0],
    rotationEuler: [0, 0, -0.18],
    scale: [0.11, 0.50, 0.11],
    extra: [0.11, 0.50, 0],
  },
  // Hands — small spheres at the wrist (just below the forearms).
  {
    id: 'handL',
    kind: 'sphere',
    regionId: 'peripheral',
    position: [-0.88, -0.05, 0],
    rotationEuler: [0, 0, 0],
    scale: [0.10, 0.14, 0.07],
    extra: [0.10, 0, 0],
  },
  {
    id: 'handR',
    kind: 'sphere',
    regionId: 'peripheral',
    position: [0.88, -0.05, 0],
    rotationEuler: [0, 0, 0],
    scale: [0.10, 0.14, 0.07],
    extra: [0.10, 0, 0],
  },

  // ----- Legs (peripheral) -----
  // Thighs — capsules hanging straight down from the pelvis, slightly
  // bowed outward.
  {
    id: 'thighL',
    kind: 'capsule',
    regionId: 'peripheral',
    position: [-0.32, -0.75, 0],
    rotationEuler: [0, 0, 0.06],
    scale: [0.18, 0.55, 0.18],
    extra: [0.18, 0.55, 0],
  },
  {
    id: 'thighR',
    kind: 'capsule',
    regionId: 'peripheral',
    position: [0.32, -0.75, 0],
    rotationEuler: [0, 0, -0.06],
    scale: [0.18, 0.55, 0.18],
    extra: [0.18, 0.55, 0],
  },
  // Calves — slightly thinner than thighs, slight outward bow.
  {
    id: 'calfL',
    kind: 'capsule',
    regionId: 'peripheral',
    position: [-0.34, -1.45, 0],
    rotationEuler: [0, 0, 0.04],
    scale: [0.14, 0.55, 0.14],
    extra: [0.14, 0.55, 0],
  },
  {
    id: 'calfR',
    kind: 'capsule',
    regionId: 'peripheral',
    position: [0.34, -1.45, 0],
    rotationEuler: [0, 0, -0.04],
    scale: [0.14, 0.55, 0.14],
    extra: [0.14, 0.55, 0],
  },
  // Feet — elongated boxes projecting forward (positive Z).
  {
    id: 'footL',
    kind: 'box',
    regionId: 'peripheral',
    position: [-0.36, -2.05, 0.16],
    rotationEuler: [0, 0, 0],
    scale: [0.18, 0.10, 0.32],
    extra: [0.18, 0.10, 0.32],
  },
  {
    id: 'footR',
    kind: 'box',
    regionId: 'peripheral',
    position: [0.36, -2.05, 0.16],
    rotationEuler: [0, 0, 0],
    scale: [0.18, 0.10, 0.32],
    extra: [0.18, 0.10, 0.32],
  },
];

// -------------------------------------------------------------------------
// Geometry helpers
//
// We build geometries lazily and cache by signature so consumers that
// share the same tier & primitive shape don't multiply BufferGeometries.
// The caller disposes via the returned body's dispose() — we expose the
// cached geometries via `disposeAnatomyGeometries()`.
// -------------------------------------------------------------------------

interface GeometryKey {
  kind: AnatomyPartKind;
  tier: AnatomyTier;
}

const _geometryCache = new Map<string, THREE.BufferGeometry>();

function geometryKey(k: GeometryKey, extra: [number, number, number]): string {
  return `${k.kind}|${k.tier}|${extra[0]}|${extra[1]}|${extra[2]}`;
}

/**
 * Build (or reuse from cache) the unit primitive for a part kind. Sphere
 * geometry is unit-radius; capsule / cylinder are unit-length along +Y;
 * box is sized by its `extra` triple (already a half-extent — see BoxGeometry
 * docs). Callers apply mesh.scale to stretch as needed.
 */
export function getAnatomyPrimitiveGeometry(
  kind: AnatomyPartKind,
  tier: AnatomyTier,
  extra: [number, number, number],
): THREE.BufferGeometry {
  const key = geometryKey({ kind, tier }, extra);
  const cached = _geometryCache.get(key);
  if (cached) return cached;
  const segs = ANATOMY_TIER_SEGMENTS[tier];
  let geo: THREE.BufferGeometry;
  switch (kind) {
    case 'sphere':
      geo = new THREE.SphereGeometry(1, segs[0], segs[1]);
      break;
    case 'capsule':
      // CapsuleGeometry(radius, length, capSegments, radialSegments)
      // `length` here is the cylinder body length; total length is length + 2*radius.
      geo = new THREE.CapsuleGeometry(1, 1, Math.max(8, segs[1]), segs[0]);
      break;
    case 'cylinder':
      // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments)
      geo = new THREE.CylinderGeometry(1, 1, 1, segs[0], Math.max(1, Math.floor(segs[1] / 2)));
      break;
    case 'box':
      geo = new THREE.BoxGeometry(extra[0], extra[1], extra[2]);
      break;
  }
  _geometryCache.set(key, geo);
  return geo;
}

/** Dispose every cached primitive geometry. Call from a top-level dispose
 *  path when the page unmounts; safe to call multiple times. */
export function disposeAnatomyGeometryCache(): void {
  _geometryCache.forEach((geo) => geo.dispose());
  _geometryCache.clear();
}
