import * as THREE from 'three';

/**
 * Parametric patient phantom — anatomically-segmented Alderson-style body
 * built from BufferGeometry primitives (Sphere / Capsule / Cylinder / Box).
 *
 * Reads the shared `ANATOMY` spec from `./anatomy` so the HelicalCT scanner
 * view and the Dose page stay in lockstep — if a part shape changes, both
 * update from the same source of truth.
 *
 * Body in local space: +Y = head, units ~decimeters, upright stance. The
 * caller (HelicalCT simulator) rotates the returned group 90° on X so the
 * patient lies along the scanner bore.
 *
 * Tier:
 *   - 'low'      16×12 segments (fast)
 *   - 'standard' 32×24 (default)
 *   - 'hero'     48×36 (smooth)
 */

import { AnatomyTier, ANATOMY, AnatomyPart, getAnatomyPrimitiveGeometry } from './anatomy';

export type PhantomTier = 'low' | 'standard' | 'hero';

export interface PhantomOptions {
  tier?: PhantomTier;
  material: THREE.Material;
}

function applyPart(mesh: THREE.Mesh, part: AnatomyPart): void {
  mesh.position.set(...part.position);
  mesh.rotation.set(...part.rotationEuler);
  mesh.scale.set(...part.scale);
}

export function createParametricPhantomMesh(
  options: PhantomOptions,
): THREE.Group {
  const tier = (options.tier ?? 'standard') satisfies AnatomyTier;
  const group = new THREE.Group();
  group.name = 'ParametricPhantom';

  // Build a mesh per anatomy part, all sharing the caller's skin material.
  for (const part of ANATOMY) {
    const geo = getAnatomyPrimitiveGeometry(part.kind, tier, part.extra);
    const mesh = new THREE.Mesh(geo, options.material);
    mesh.name = `phantom-${part.id}`;
    applyPart(mesh, part);
    group.add(mesh);
  }

  // Lay the body horizontally along the scanner Z axis. Phantom local +Y
  // (head→toes) maps to world +Z.
  group.rotation.x = Math.PI / 2;
  return group;
}

export function disposeParametricPhantom(group: THREE.Group): void {
  // The geometries come from the shared anatomy cache; we do NOT dispose
  // them here. If the consumer has fully torn down the page they can call
  // `disposeAnatomyGeometryCache()`. Each mesh we created is removed by
  // the parent group's disposal path.
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      // Drop references so the GC can collect after group removal.
      mesh.geometry = undefined as unknown as THREE.BufferGeometry;
    }
  });
}
