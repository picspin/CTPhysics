import * as THREE from 'three';

/**
 * PBR materials for PCCT-specific detector structures.
 *
 * Distinct from `scannerMaterials.ts` (which covers gantry chrome / housing
 * / vinyl / skin) — these describe the *layer* physics: the scintillator
 * face that emits visible light, the CdTe/CZT semiconductor that absorbs
 * X-rays directly into electron-hole pairs, the tungsten septa that
 * separate EID pixels, and the pixelated electrode array on the back of
 * a PCD.
 *
 * Like the scanner materials, every material is shared (one instance per
 * category across the whole scene) — PhysicalMaterial with emission /
 * clearcoat is expensive to compile and to GPU-upload.
 */

export interface DetectorMaterials {
  // Scintillator (GOS / CsI) — the "indirect" conversion layer used in
  // EIDs. Slightly emissive blue-green so the user can see the layer
  // glow when an X-ray hits it. emissionIntensity is multiplied at
  // runtime via material.emissiveIntensity to pulse with photon hits.
  scintillator: THREE.MeshPhysicalMaterial;

  // Photodiode substrate layer under the EID scintillator. Dark silicon
  // look — matte, very low metalness, slight sheen.
  photodiode: THREE.MeshPhysicalMaterial;

  // Tungsten septa — thin reflective walls between EID pixels. High
  // metalness, mid roughness so the user can SEE the pixel pitch of
  // an EID array without the septa reading as a perfect mirror.
  tungstenSepta: THREE.MeshPhysicalMaterial;

  // CdTe / CZT semiconductor substrate. Dark grey with a faint amber
  // tint (matches the visual hue of CdTe crystals). Matte; the cloud
  // visualization handles the visible glow.
  cdteSubstrate: THREE.MeshPhysicalMaterial;

  // Pixelated anode electrode on the back of the PCD. Copper-coloured,
  // mid-roughness metal so it reads as a circuit pad.
  pixelElectrode: THREE.MeshPhysicalMaterial;

  // Charge cloud (electron-hole) — additive material for the pulse
  // visualizations. BasicMaterial because we want unlit, additive,
  // HDR-bright pixels for bloom kick.
  chargeCloud: THREE.MeshBasicMaterial;

  // Anode trigger pulse — small additive sprite for the time-axis
  // pulse-train.
  pulseSprite: THREE.MeshBasicMaterial;

  // Top reflective / bias field grid for the PCD — transparent thin
  // mesh that implies the high-voltage bias without occluding the
  // substrate.
  biasGrid: THREE.MeshBasicMaterial;
}

export interface DetectorMaterialsOptions {
  scintillatorColor?: THREE.ColorRepresentation;
  substrateColor?: THREE.ColorRepresentation;
  electrodeColor?: THREE.ColorRepresentation;
}

export function createDetectorMaterials(
  options: DetectorMaterialsOptions = {},
): DetectorMaterials {
  const scintillatorColor = options.scintillatorColor ?? 0x6e7ad6;
  const substrateColor = options.substrateColor ?? 0x4a3520;
  const electrodeColor = options.electrodeColor ?? 0xb88a4a;

  // Scintillator: Gd2O2S / CsI glow. The actual emission pumps per
  // photon hit (driven by emissiveIntensity), so we start at a baseline.
  const scintillator = new THREE.MeshPhysicalMaterial({
    color: scintillatorColor,
    metalness: 0.0,
    roughness: 0.55,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xa6b8ff),
    sheenRoughness: 0.5,
    emissive: new THREE.Color(0xa8b8ff),
    emissiveIntensity: 0.06,
  });

  // Photodiode: silicon wafer feel. Matte dark blue-grey, low metal.
  const photodiode = new THREE.MeshPhysicalMaterial({
    color: 0x141a26,
    metalness: 0.15,
    roughness: 0.6,
    clearcoat: 0.15,
  });

  // Tungsten septa: high metalness, mid roughness so they read as
  // physical walls without being perfect mirrors (which would clash
  // with the dark detector housing).
  const tungstenSepta = new THREE.MeshPhysicalMaterial({
    color: 0x9a9a9c,
    metalness: 1.0,
    roughness: 0.42,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
  });

  // CdTe / CZT substrate: dark amber-brown, fully matte.
  const cdteSubstrate = new THREE.MeshPhysicalMaterial({
    color: substrateColor,
    metalness: 0.0,
    roughness: 0.78,
    clearcoat: 0.0,
  });

  // Pixelated electrode: copper pad. Mid-roughness metal so reflections
  // are present but not noisy.
  const pixelElectrode = new THREE.MeshPhysicalMaterial({
    color: electrodeColor,
    metalness: 1.0,
    roughness: 0.38,
    clearcoat: 0.4,
    clearcoatRoughness: 0.25,
  });

  // Charge cloud: additive unlit. Colour is pumped at runtime via
  // material.color when a charge cloud "fires".
  const chargeCloud = new THREE.MeshBasicMaterial({
    color: 0x66ffd4,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Pulse sprite: small bright dot. We use a MeshBasicMaterial so the
  // pulse stays bright through the postFX bloom pass.
  const pulseSprite = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // Bias grid: a thin transparent mesh to imply the cathode HV field.
  // Not really a physical material — visual cheat.
  const biasGrid = new THREE.MeshBasicMaterial({
    color: 0x66bbff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true,
  });

  return {
    scintillator,
    photodiode,
    tungstenSepta,
    cdteSubstrate,
    pixelElectrode,
    chargeCloud,
    pulseSprite,
    biasGrid,
  };
}

export function disposeDetectorMaterials(mats: DetectorMaterials): void {
  for (const m of Object.values(mats)) {
    m.dispose();
  }
}