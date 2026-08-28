import * as THREE from 'three';

/**
 * Parametric patient phantom — a torso-shaped body built from stretched
 * SphereGeometry primitives. Cheap (no marching cubes), reads as a
 * continuous human silhouette at simulator viewing distance.
 *
 * Anatomy (in local space, +Y up, units ~ decimeters):
 *   - head   at y=+2.2  (small sphere, slightly elongated)
 *   - neck   subtracted via a thin cylinder (creates shoulder taper)
 *   - chest  at y=+1.2  (wide oblate sphere)
 *   - abdomen at y=+0.2 (slightly narrower sphere)
 *   - pelvis at y=-0.8 (wide oblate sphere)
 *
 * All shapes use the same skin material — at viewing distance the seams
 * are imperceptible; the silhouette is what reads.
 *
 * Tier:
 *   - 'low'      16×12 segments (fast)
 *   - 'standard' 32×24 (default)
 *   - 'hero'     48×36 (smooth)
 */

export type PhantomTier = 'low' | 'standard' | 'hero';

export interface PhantomOptions {
  tier?: PhantomTier;
  material: THREE.Material;
}

const TIER_SEGMENTS: Record<PhantomTier, [number, number]> = {
  low: [16, 12],
  standard: [32, 24],
  hero: [48, 36],
};

interface BodyPart {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  scale: [number, number, number];
}

// Helper: build a stretched sphere geometry as a body part.
function stretchedSphere(
  radius: number,
  position: [number, number, number],
  scale: [number, number, number],
  segments: [number, number],
): BodyPart {
  const geo = new THREE.SphereGeometry(radius, segments[0], segments[1]);
  return { geometry: geo, position, scale };
}

export function createParametricPhantomMesh(
  options: PhantomOptions,
): THREE.Group {
  const tier = options.tier ?? 'standard';
  const segs = TIER_SEGMENTS[tier];
  const group = new THREE.Group();
  group.name = 'ParametricPhantom';

  // Torso axis is the scanner's Z axis (patient lies along z through the
  // bore). We lay the body horizontally: rotate the whole group 90° on X
  // so +Y in body space points along +Z in world space.
  const parts: BodyPart[] = [
    // Head
    stretchedSphere(0.32, [0, 2.2, 0], [1, 1.15, 0.95], segs),
    // Chest (oblate — wider than deep)
    stretchedSphere(0.58, [0, 1.0, 0], [1.0, 0.85, 0.7], segs),
    // Abdomen (narrower)
    stretchedSphere(0.50, [0, 0.1, 0], [0.92, 0.9, 0.7], segs),
    // Pelvis (wider again, flatter)
    stretchedSphere(0.45, [0, -0.8, 0], [1.05, 0.75, 0.7], segs),
    // Upper legs hint (two small spheres — adds silhouette continuity)
    stretchedSphere(0.22, [-0.22, -1.5, 0], [1, 1.6, 1], segs),
    stretchedSphere(0.22, [0.22, -1.5, 0], [1, 1.6, 1], segs),
  ];

  for (const part of parts) {
    const mesh = new THREE.Mesh(part.geometry, options.material);
    mesh.position.set(...part.position);
    mesh.scale.set(...part.scale);
    // The whole phantom rotates to lie along scanner Z axis.
    group.add(mesh);
  }

  // Lay the body horizontally along the scanner Z axis. Phantom local +Y
  // (head→toes) maps to world +Z.
  group.rotation.x = Math.PI / 2;
  return group;
}

export function disposeParametricPhantom(group: THREE.Group): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry.dispose();
    }
  });
}
