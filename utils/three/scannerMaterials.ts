import * as THREE from 'three';

/**
 * PBR material recipes for CT scanner hardware.
 *
 * Values lifted from img2threejs/docs/materials/THREEJS_MATERIAL_REFERENCE.md,
 * mapped to CTPhysics objects. All are MeshPhysicalMaterial so we get
 * clearcoat / transmission / sheen / anisotropy channels.
 *
 * `scannerMaterials()` factory returns a frozen record; share a single
 * instance per material category (don't allocate per-mesh — PhysicalMaterial
 * with clearcoat / transmission is expensive to compile and to GPU-upload).
 */

export interface ScannerMaterials {
  gantryChrome: THREE.MeshPhysicalMaterial;
  gantryBore: THREE.MeshPhysicalMaterial;
  tubeHousing: THREE.MeshPhysicalMaterial;
  tubeGlass: THREE.MeshPhysicalMaterial;
  detectorHousing: THREE.MeshPhysicalMaterial;
  detectorPanel: THREE.MeshPhysicalMaterial;
  tableVinyl: THREE.MeshPhysicalMaterial;
  tableChassis: THREE.MeshPhysicalMaterial;
  skinPhantom: THREE.MeshPhysicalMaterial;
  floor: THREE.MeshStandardMaterial;
}

export function createScannerMaterials(): ScannerMaterials {
  // Gantry outer ring: polished chrome. Reflects environment clearly.
  const gantryChrome = new THREE.MeshPhysicalMaterial({
    color: 0xd9dde2,
    metalness: 1.0,
    roughness: 0.18,
    clearcoat: 0.4,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.0,
  });

  // Gantry inner bore: brushed steel feel via roughness without anisotropy map
  // (anisotropy map would require procedural texture — Phase 1 keeps it scalar).
  const gantryBore = new THREE.MeshPhysicalMaterial({
    color: 0xa9b0b8,
    metalness: 1.0,
    roughness: 0.35,
    envMapIntensity: 0.85,
  });

  // X-ray tube housing: painted medical-grade white/cream.
  const tubeHousing = new THREE.MeshPhysicalMaterial({
    color: 0xf2eedb,
    metalness: 0.4,
    roughness: 0.55,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
  });

  // X-ray tube window glass: borosilicate feel. Slight warm emissive when idle
  // reads as "ready" status in the simulator UI.
  const tubeGlass = new THREE.MeshPhysicalMaterial({
    color: 0xfff2cc,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.4,
    ior: 1.5,
    attenuationColor: new THREE.Color(0xfff0c0),
    attenuationDistance: 0.6,
    emissive: new THREE.Color(0xffaa33),
    emissiveIntensity: 0.08,
    transparent: true,
  });

  // Detector housing (the body of the detector array).
  const detectorHousing = new THREE.MeshPhysicalMaterial({
    color: 0x2a313a,
    metalness: 1.0,
    roughness: 0.28,
    clearcoat: 0.2,
    envMapIntensity: 0.9,
  });

  // Detector scintillator panel face: matte dark with subtle sheen.
  const detectorPanel = new THREE.MeshPhysicalMaterial({
    color: 0x1f2429,
    metalness: 0.0,
    roughness: 0.62,
    sheen: 0.3,
    sheenColor: new THREE.Color(0x2a3a4a),
    sheenRoughness: 0.7,
  });

  // Patient table vinyl top: glossy plastic with fabric-like sheen.
  const tableVinyl = new THREE.MeshPhysicalMaterial({
    color: 0x3a3a3e,
    metalness: 0.0,
    roughness: 0.45,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    sheen: 0.2,
    sheenColor: new THREE.Color(0x55555a),
  });

  // Table chassis (the structural frame).
  const tableChassis = new THREE.MeshPhysicalMaterial({
    color: 0xc8ccd1,
    metalness: 1.0,
    roughness: 0.42,
  });

  // Phantom skin (placeholder; replaced by SDF body in Phase 3).
  // Human-skin recipe from the reference table.
  const skinPhantom = new THREE.MeshPhysicalMaterial({
    color: 0xd9b48a,
    metalness: 0.0,
    roughness: 0.52,
    clearcoat: 0.12,
    clearcoatRoughness: 0.4,
    ior: 1.4,
    sheen: 0.1,
    sheenColor: new THREE.Color(0xc08a6a),
  });

  // Floor: dark, matte. Plain MeshStandardMaterial is fine here — the floor
  // doesn't need the heavy PBR channels and saves some shader cost.
  const floor = new THREE.MeshStandardMaterial({
    color: 0x1c1f24,
    roughness: 0.85,
    metalness: 0.0,
  });

  return {
    gantryChrome,
    gantryBore,
    tubeHousing,
    tubeGlass,
    detectorHousing,
    detectorPanel,
    tableVinyl,
    tableChassis,
    skinPhantom,
    floor,
  };
}

export function disposeScannerMaterials(mats: ScannerMaterials): void {
  for (const m of Object.values(mats)) {
    m.dispose();
  }
}
