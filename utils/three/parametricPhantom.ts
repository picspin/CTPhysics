import * as THREE from 'three';
import { createBodyV3, type BodyV3 } from './body/bodyV3';

/**
 * Helical CT patient: the shared v3.1 body (semi-transparent Fresnel skin over
 * procedural MOCK organs, see ./body/bodyV3.ts), laid supine along the scanner bore.
 *
 * Local frame of the inner body: +Y = head, anterior = -Z, so the +90 deg X rotation
 * of the returned group maps head -> world +Z and anterior -> world +Y (supine).
 * The inner body is lifted so its posterior surface rests on y = 0 of the group.
 */
export type PhantomTier = 'low' | 'standard' | 'hero';

export interface PhantomOptions {
  tier?: PhantomTier;
  /** Only the colour of this material is used, for the skin. */
  material?: THREE.Material;
  skinOpacity?: number;
}

const RING_POINTS: Record<PhantomTier, number> = { low: 24, standard: 36, hero: 48 };

export function createParametricPhantomMesh(options: PhantomOptions = {}): THREE.Group {
  const tier = options.tier ?? 'standard';
  const color = (options.material as THREE.MeshStandardMaterial | undefined)?.color;
  const body = createBodyV3({
    frame: { anterior: -1 },
    ringPoints: RING_POINTS[tier],
    ringStep: tier === 'low' ? 4 : 2.5,
    skinOpacity: options.skinOpacity ?? 0.45,
    skinColor: color ? color.getHex() : undefined,
  });
  // posterior-most skin is ~12.5 cm behind the trunk centre line (MOCK geometry)
  body.group.position.z = -12.5 * body.frame.s;
  const group = new THREE.Group();
  group.name = 'ParametricPhantom';
  group.add(body.group);
  group.userData.body = body;
  group.rotation.x = Math.PI / 2;
  return group;
}

export function getPhantomBody(group: THREE.Group): BodyV3 | undefined {
  return group.userData.body as BodyV3 | undefined;
}

export function disposeParametricPhantom(group: THREE.Group): void {
  getPhantomBody(group)?.dispose();
}
