import * as THREE from 'three';
import {
  calculateLinearAttenuationCoefficient,
  calculateHounsfieldUnit,
  Tissue,
} from '@/utils/physics-calculations';

/**
 * AttenuationOverlay — a horizontal slice plane that visualizes the
 * phantom's Hounsfield-unit field at the current scan energy.
 *
 * For each pixel of a 128×128 DataTexture, we sample whether the point
 * falls inside the parametric phantom's torso silhouette and assign a
 * tissue value (cortical bone shell, soft tissue, lung, fat, marrow).
 * The pixel color is then driven by the actual attenuation coefficient
 * computed via physics-calculations.calculateLinearAttenuationCoefficient
 * at the simulator's current kV, then mapped through a calibrated
 * diagnostic window/level for visual reading.
 *
 * Per the Phase 3 plan: displayed values must match physics-calculations.ts
 * output within ±2 HU. Cross-check is logged to console in dev.
 */

// Tissue definitions matching the simulator's phantom cross-section.
// Density in g/cm³, zeff is approximate effective atomic number.
const TISSUES = {
  air: { id: 'air', density: 0.001, zeff: 7.6 },
  fat: { id: 'fat', density: 0.92, zeff: 6.0 },
  soft: { id: 'soft', density: 1.06, zeff: 7.4 },
  lung: { id: 'lung', density: 0.25, zeff: 7.4 },
  marrow: { id: 'marrow', density: 1.0, zeff: 7.4 },
  bone: { id: 'bone', density: 1.85, zeff: 13.8 },
} as const satisfies Record<string, Tissue>;

const RES = 128;

// Diagnostic window/level (CT abdomen default: window=400, level=40).
const WINDOW = 400;
const LEVEL = 40;

// Map a single HU value to RGB. Below window floor → black; above ceiling
// → white; in between → linear ramp from blue (low HU) through gray
// (mid) to orange (high HU). Standard DICOM-ish gray ramp, tinted.
function huToColor(hu: number): [number, number, number] {
  const lo = LEVEL - WINDOW / 2;
  const hi = LEVEL + WINDOW / 2;
  const t = Math.max(0, Math.min(1, (hu - lo) / (hi - lo)));
  // Two-stop gradient: dark blue-gray (low) → warm gray (mid) → cream (high)
  if (t < 0.5) {
    const k = t / 0.5;
    return [
      0.05 + k * 0.45, // 0.05 → 0.50
      0.07 + k * 0.43, // 0.07 → 0.50
      0.12 + k * 0.38, // 0.12 → 0.50
    ];
  }
  const k = (t - 0.5) / 0.5;
  return [
    0.50 + k * 0.45, // 0.50 → 0.95
    0.50 + k * 0.40, // 0.50 → 0.90
    0.50 + k * 0.30, // 0.50 → 0.80
  ];
}

// Phantom cross-section at the chest z-slice: an ellipse (torso) with a
// bone rim and an inner lung region. Returns tissue id for (u,v) where
// u,v ∈ [-1,1].
function sampleTissue(u: number, v: number): keyof typeof TISSUES {
  const r = Math.sqrt(u * u + v * v);
  // Outer skin rim (thin)
  if (r > 0.92) return 'soft';
  if (r > 0.88) return 'fat';
  // Cortical bone shell
  if (r > 0.82) return 'bone';
  // Marrow inside bone
  if (r > 0.78) return 'marrow';
  // Two lung lobes (left/right ellipses inside the chest cavity)
  const leftLung = Math.sqrt(((u + 0.32) / 0.22) ** 2 + (v / 0.4) ** 2);
  const rightLung = Math.sqrt(((u - 0.32) / 0.22) ** 2 + (v / 0.4) ** 2);
  if (leftLung < 1 || rightLung < 1) return 'lung';
  // Mediastinum (heart) — central small ellipse
  const heart = Math.sqrt((u / 0.12) ** 2 + (v / 0.18) ** 2);
  if (heart < 1) return 'soft';
  // Vertebra small bump at the back
  if (r > 0.55 && v < -0.6) return 'bone';
  return 'soft';
}

export interface AttenuationOverlayOptions {
  // Phantom outer dimensions in world units (matches parametricPhantom.ts).
  // The overlay plane is sized to (width × depth) and centered at origin.
  width?: number;
  depth?: number;
}

/**
 * Build a horizontal slice plane mesh that visualizes Hounsfield units.
 * The mesh's material is a MeshBasicMaterial whose map is a DataTexture
 * computed at the given kV.
 *
 * Returns the mesh and a setter to re-bake the texture when energy
 * changes (call updateAttenuationTexture(kv) — cheap, single-texture
 * recompute, no per-frame cost).
 */
export function createAttenuationOverlay(
  kv: number,
  options: AttenuationOverlayOptions = {},
): {
  mesh: THREE.Mesh;
  updateAttenuationTexture: (kv: number) => void;
  dispose: () => void;
} {
  const width = options.width ?? 1.0;
  const depth = options.depth ?? 1.5;

  // Build the texture data buffer.
  const data = new Uint8Array(RES * RES * 4);
  const texture = new THREE.DataTexture(
    data,
    RES,
    RES,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  // Reference water attenuation at 70 keV (soft tissue baseline).
  const waterRef = calculateLinearAttenuationCoefficient(TISSUES.soft, 70);

  function bake(kvIn: number): void {
    // Cross-check: sample center pixel and log HU. Should match what the
    // physics module produces for the same tissue + energy.
    const centerHu = calculateHounsfieldUnit(
      calculateLinearAttenuationCoefficient(TISSUES.soft, kvIn),
      waterRef,
    );

    if (typeof window !== 'undefined' && (window as { __ctPhysicsDebug?: boolean }).__ctPhysicsDebug) {
      console.assert(
        Math.abs(centerHu) < 2,
        `[AttenuationOverlay] Center HU drift ${centerHu.toFixed(2)} > 2`,
      );
    }

    for (let y = 0; y < RES; y++) {
      for (let x = 0; x < RES; x++) {
        const u = ((x + 0.5) / RES) * 2 - 1;
        const v = -(((y + 0.5) / RES) * 2 - 1); // flip Y for image space
        const tissue = sampleTissue(u, v);
        const mu = calculateLinearAttenuationCoefficient(TISSUES[tissue], kvIn);
        const hu = calculateHounsfieldUnit(mu, waterRef);
        const [r, g, b] = huToColor(hu);
        const i = (y * RES + x) * 4;
        data[i] = Math.round(r * 255);
        data[i + 1] = Math.round(g * 255);
        data[i + 2] = Math.round(b * 255);
        data[i + 3] = 255;
      }
    }
    texture.needsUpdate = true;
  }

  bake(kv);

  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'AttenuationOverlay';
  // Lay flat on the table (horizontal slice). Plane default faces +Z, so
  // rotate -90° on X so it faces +Y.
  mesh.rotation.x = -Math.PI / 2;

  return {
    mesh,
    updateAttenuationTexture: bake,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
