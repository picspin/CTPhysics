import * as THREE from 'three';

// Region-segmented parametric body model for the Dose & Safety view.
//
// Why not just call createParametricPhantomMesh? Because the dose view
// needs each anatomical region as its OWN clickable mesh so the
// Raycaster can identify which region the user clicked. The parametric
// phantom groups everything under one mesh-per-sphere and shares one
// skin material — no region metadata, no per-region color.
//
// This module reuses the same BufferGeometry primitives as the HelicalCT
// simulator's parametric phantom (via the shared ANATOMY spec in
// `./anatomy`) but splits the body into per-region meshes. Each
// regionId-bearing mesh carries:
//   - userData.regionId → BODY_REGIONS key
//   - its own material slot (so we can color-map dose per region)
//   - an outline halo (LineSegments wireframe) toggled on hover/select
//
// The body is built with its long axis along local +Y (head at top).
// The consuming viewer is responsible for any rotation (e.g. laying it
// horizontally on a CT table).

import { BodyRegionId } from '@/utils/dose-physics';
import {
  AnatomyTier,
  ANATOMY,
  AnatomyPart,
  ANATOMY_TIER_SEGMENTS,
  disposeAnatomyGeometryCache,
  getAnatomyPrimitiveGeometry,
} from './anatomy';

export interface BodyModelMaterials {
  skin: THREE.MeshPhysicalMaterial;
  outline: THREE.LineBasicMaterial;
  /** One slot per region — used to color-map dose. */
  perRegion: Record<BodyRegionId, THREE.MeshPhysicalMaterial>;
}

export interface BodyModelOptions {
  /** Tier controlling primitive segment counts. 'standard' is the default. */
  tier?: 'low' | 'standard' | 'hero';
  /** Overall body habitus multiplier (1.0 = adult reference). */
  bodyScale?: number;
}

export interface BodyRegionMesh extends THREE.Mesh {
  userData: {
    regionId: BodyRegionId;
    /** Outline wireframe mesh orbiting this region; null if not built. */
    outline: THREE.LineSegments | null;
  };
}

export interface BodyModel {
  group: THREE.Group;
  /** All five region meshes, addressable by regionId. */
  regions: Record<BodyRegionId, BodyRegionMesh>;
  /** Set the color-tint (color * t) on a region's skin material. */
  setRegionTint: (region: BodyRegionId, tint: THREE.Color) => void;
  /** Reset all tints to base skin color. */
  resetTints: () => void;
  /** Highlight a region (thick bright outline). Pass null to clear. */
  highlightRegion: (region: BodyRegionId | null) => void;
  /** Rescale the whole body (used to simulate patient habitus). */
  setBodyScale: (scale: number) => void;
  /** Dispose all geometry & materials owned by this body. */
  dispose: () => void;
  /** Materials created here — caller is responsible for not also disposing. */
  materials: BodyModelMaterials;
}

// Build a wireframe outline that sits just outside the mesh — used to
// show selection / hover. Reuses the same geometry as the mesh.
function buildOutline(
  geometry: THREE.BufferGeometry,
  scale: THREE.Vector3,
  outlineMat: THREE.LineBasicMaterial,
): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry, 18);
  const lines = new THREE.LineSegments(edges, outlineMat);
  lines.scale.copy(scale).multiplyScalar(1.04);
  return lines;
}

const BASE_SKIN_COLOR = new THREE.Color(0xd49a6c);
const OUTLINE_COLOR = 0xffaa66;

function createMaterials(): BodyModelMaterials {
  // Shared skin material recipe — same as parametric phantom.
  // The colour is the more saturated warm-orange of an Alderson-style
  // phantom (0xd49a6c) rather than the paler 0xd9b48a we used when the
  // body was a stack of torso spheres; the brighter base reads as the
  // glossy rubber phantom the user expects.
  const skin = new THREE.MeshPhysicalMaterial({
    color: BASE_SKIN_COLOR.clone(),
    metalness: 0.0,
    roughness: 0.48,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
    ior: 1.4,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xc0703a),
  });

  // Each region gets its OWN skin material instance so we can tint
  // independently. Yes, that's 5 PhysicalMaterial instances — still
  // far cheaper than 5 unique geometries.
  const perRegion = {} as Record<BodyRegionId, THREE.MeshPhysicalMaterial>;
  const regionIds: BodyRegionId[] = ['head', 'neck', 'cardiothoracic', 'abdomen', 'peripheral'];
  for (const rid of regionIds) {
    perRegion[rid] = new THREE.MeshPhysicalMaterial({
      color: BASE_SKIN_COLOR.clone(),
      metalness: 0.0,
      roughness: 0.48,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
      ior: 1.4,
      sheen: 0.25,
      sheenColor: new THREE.Color(0xc0703a),
    });
  }

  const outline = new THREE.LineBasicMaterial({
    color: OUTLINE_COLOR,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });

  return { skin, perRegion, outline };
}

/**
 * Build the region-segmented body model.
 *
 * Returns a BodyModel handle with helpers for tinting / highlighting
 * regions and rescaling the whole body for SSDE demonstrations.
 */
export function createRegionSegmentedBodyModel(
  options: BodyModelOptions = {},
): BodyModel {
  const tier = (options.tier ?? 'standard') satisfies AnatomyTier;
  const baseBodyScale = options.bodyScale ?? 1.0;

  const materials = createMaterials();
  const group = new THREE.Group();
  group.name = 'RegionSegmentedBody';
  group.scale.setScalar(baseBodyScale);

  // Collect the per-region meshes we build. We track one mesh per
  // region (the "primary" mesh of that region, used for outline /
  // highlighting). Other parts of the same region share the same
  // material so dose colouring still propagates.
  const regions = {} as Record<BodyRegionId, BodyRegionMesh>;
  const primaryByRegion: Partial<Record<BodyRegionId, BodyRegionMesh>> = {};

  for (const part of ANATOMY) {
    // regionId may be null only for connector geometry, but our ANATOMY
    // spec assigns every part to a region. If we ever introduce a null
    // part we'd render it with the shared skin material and skip the
    // region bookkeeping.
    const regionId = part.regionId;
    if (!regionId) continue;

    const geo = getAnatomyPrimitiveGeometry(part.kind, tier, part.extra);
    const mat = materials.perRegion[regionId];
    const mesh = new THREE.Mesh(geo, mat) as unknown as BodyRegionMesh;
    mesh.position.set(...part.position);
    mesh.rotation.set(...part.rotationEuler);
    mesh.scale.set(...part.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `region-${regionId}-${part.id}`;

    // Build an outline ONLY for the primary mesh of each region (the
    // first anatomy part we encounter for that region). Keeping one
    // outline per region avoids 16+ orbiting wireframes.
    let outline: THREE.LineSegments | null = null;
    if (!primaryByRegion[regionId]) {
      outline = buildOutline(
        geo,
        new THREE.Vector3(...part.scale),
        materials.outline,
      );
      outline.visible = false;
      outline.position.copy(mesh.position);
      outline.rotation.copy(mesh.rotation);
      primaryByRegion[regionId] = mesh;
    }

    mesh.userData = {
      regionId,
      outline,
    };

    group.add(mesh);
    if (outline) group.add(outline);
    regions[regionId] = mesh;
  }

  const baseColor = materials.skin.color.clone();

  function setRegionTint(region: BodyRegionId, tint: THREE.Color): void {
    const mat = materials.perRegion[region];
    mat.color.copy(baseColor).multiply(tint);
  }

  function resetTints(): void {
    for (const mat of Object.values(materials.perRegion)) {
      mat.color.copy(baseColor);
    }
  }

  function highlightRegion(target: BodyRegionId | null): void {
    for (const [rid, mesh] of Object.entries(primaryByRegion)) {
      const outline = mesh.userData.outline;
      if (!outline) continue;
      if (rid === target) {
        outline.visible = true;
        (outline.material as THREE.LineBasicMaterial).opacity = 0.95;
      } else {
        outline.visible = false;
        (outline.material as THREE.LineBasicMaterial).opacity = 0.0;
      }
    }
  }

  function setBodyScale(scale: number): void {
    group.scale.setScalar(scale);
  }

  function dispose(): void {
    // EdgesGeometries used by the outlines are owned by us — dispose them.
    for (const mesh of Object.values(primaryByRegion)) {
      mesh.userData.outline?.geometry.dispose();
    }
    // Materials: dispose all owned materials.
    for (const mat of Object.values(materials.perRegion)) {
      mat.dispose();
    }
    materials.outline.dispose();
    materials.skin.dispose();
    // Dispose the shared primitive cache — last consumer tears it down.
    disposeAnatomyGeometryCache();
  }

  return {
    group,
    regions,
    setRegionTint,
    resetTints,
    highlightRegion,
    setBodyScale,
    dispose,
    materials,
  };
}
