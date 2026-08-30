import * as THREE from 'three';
import { PCCTParams } from '@/utils/pcct-physics';
import { DetectorMaterials } from '@/utils/three/detectorMaterials';

/**
 * 3D detector-perspective scene for the PCCT simulator.
 *
 * Contrasts an Energy-Integrating Detector (EID, indirect conversion)
 * with a Photon-Counting Detector (PCD, direct conversion) side by side.
 * The scene is built so that every visual difference the user can see
 * corresponds to a real physical difference:
 *
 *   EID (left)                          PCD (right)
 *   ------------------------------      ------------------------------
 *   Scintillator slab (GOS/CsI)         CdTe/CZT semiconductor slab
 *   X-ray -> visible light              X-ray -> electron-hole pairs
 *   Light spreads LATERALLY (wide       Charge drifts along the HV field
 *     glowing blob spanning ~3 pixels)    lines (tight, narrow cloud)
 *   Tungsten septa grid between every   NO septa — nothing to block the
 *     pixel => geometric dead space       charge, so pixels can shrink
 *   Coarse pixel pitch (16 x 12)        Fine pixel pitch (32 x 24)
 *   Signal is INTEGRATED: one analog    Each photon makes a discrete
 *     number per readout, broad and       pulse whose HEIGHT is its
 *     smeared, no energy information      energy => sorted into bins
 *   Electronic noise floor adds to the  Threshold 1 sits ABOVE the noise
 *     signal and cannot be removed        floor => noise is rejected
 *
 * Two non-ideal PCD effects are modelled explicitly, because they are the
 * honest cost of photon counting and the user asked to see them:
 *
 *  1. Charge sharing — the electron-hole cloud straddles a pixel
 *     boundary, so one photon's energy is split across two neighbouring
 *     pixels. BOTH pixels register a lower-energy count, and the two
 *     halves frequently fall BELOW threshold 1 and are lost entirely.
 *     The scene renders this as two dim clouds plus two short pulses
 *     under the threshold line, and counts the losses.
 *
 *  2. Pulse pile-up — at high flux, a second photon arrives inside the
 *     dead time of the first. The two pulses merge and are misread as a
 *     single higher-energy event. Probability is 1 - exp(-flux * tau),
 *     the same expression the surrounding simulator UI reports, so the
 *     3D view and the numeric readout always agree.
 *
 * Rendering notes: the two pixel arrays are InstancedMesh (one draw call
 * each). Septa, bezels and back plates all reuse a module-scope unit box
 * with per-mesh scale, so there is no per-mesh geometry to leak. Photon
 * events come from a fixed pre-allocated pool — nothing is allocated per
 * frame.
 */

export type DetectorViewMode = 'both' | 'eid' | 'pcd';

export interface PCDDetectorOptions {
  /** Visible pixel count along X for the EID array. */
  eidGridX?: number;
  /** Visible pixel count along Z for the EID array. */
  eidGridZ?: number;
  /**
   * Visible pixel count along X for the PCD array. Deliberately finer
   * than the EID grid — the absence of septa is exactly what lets a
   * direct-conversion detector shrink its pixels.
   */
  pcdGridX?: number;
  /** Visible pixel count along Z for the PCD array. */
  pcdGridZ?: number;
}

/** Live counters the React layer can display next to the canvas. */
export interface PCDDetectorStats {
  /** PCD counts landing in threshold1..threshold2. */
  bin1: number;
  /** PCD counts landing in threshold2..threshold3. */
  bin2: number;
  /** PCD counts landing at or above threshold3. */
  bin3: number;
  /** PCD events lost below threshold1 (mostly charge-sharing halves). */
  subThreshold: number;
  /** PCD events merged by pile-up (two photons read as one). */
  pileUp: number;
  /** EID accumulated signal in arbitrary units — a single number. */
  eidIntegral: number;
  /** Number of photons that went into that single EID number. */
  eidPhotons: number;
}

export interface PCDDetector {
  group: THREE.Group;
  /** Advance the animation by one frame. */
  update(params: PCCTParams, elapsedSeconds: number): void;
  /** Show both detectors, or focus a single one (it recentres). */
  setViewMode(mode: DetectorViewMode): void;
  /** Current live counters (cheap — returns an internal snapshot copy). */
  getStats(): PCDDetectorStats;
  /** Toggle the entire assembly. */
  setEnabled(v: boolean): void;
  /** Detach and dispose all GPU resources this module owns. */
  dispose(): void;
}

// --- Module-scope shared geometry -----------------------------------
// A unit box and a unit sphere, scaled per mesh. Sharing them means the
// housings, bezels and septa contribute zero disposable geometry.
const BOX_GEOM = new THREE.BoxGeometry(1, 1, 1);
const SPHERE_GEOM = new THREE.SphereGeometry(0.5, 16, 12);

// World-scale constants for the two detector assemblies.
const DETECTOR_WIDTH = 2.4;
const DETECTOR_HEIGHT = 1.6;
const DETECTOR_DEPTH = 0.55;
const FACE_W = DETECTOR_WIDTH - 0.08;
const FACE_H = DETECTOR_HEIGHT - 0.08;

// Layer thicknesses — physically tiny, exaggerated here for readability.
const SCINT_LAYER_THICK = 0.06;
const SUBSTRATE_LAYER_THICK = 0.08;
const SEPTA_THICK = 0.018;

// Side-by-side placement.
const EID_X = -1.6;
const PCD_X = 1.6;

// Pulse-train ribbons — one under each detector.
const RIBBON_SEGMENTS = 96;
const RIBBON_LEN = 2.3;
const RIBBON_HEIGHT = 0.72; // world units representing 20..140 keV
const RIBBON_Y = -1.35;
const RIBBON_Z = 0.95; // pulled in front of the detectors so it reads clearly

// Energy axis: keV -> ribbon Y.
const E_MIN_KEV = 20;
const E_SPAN_KEV = 120;

// Event pool size — bounds GPU memory and draw calls.
const MAX_EVENTS = 28;

// Pile-up dead time (seconds). Matches the surrounding simulator UI,
// which reports pileUpFraction = 1 - exp(-flux * 0.05).
const PULSE_DEAD_TIME = 0.05;

// K-edge energies (keV) for the selectable contrast agents. Used to draw
// the K-edge reference marker on the PCD energy axis — the whole point of
// a tunable threshold is that you can place one right at the K-edge.
const K_EDGE_KEV: Record<PCCTParams['contrastAgent'], number> = {
  iodine: 33.2,
  gadolinium: 50.2,
  bismuth: 90.5,
};

/** Map a photon energy in keV onto the ribbon's vertical axis. */
function energyToY(keV: number): number {
  const t = (keV - E_MIN_KEV) / E_SPAN_KEV;
  return Math.max(0, Math.min(1.05, t)) * RIBBON_HEIGHT;
}

/**
 * One photon interaction. An event owns every mesh it might need, so the
 * pool never allocates: an incident streak, a primary conversion blob, a
 * secondary blob (only used when charge sharing splits the cloud), and a
 * marker on the ribbon.
 */
interface PhotonEvent {
  active: boolean;
  inPCD: boolean;
  birthTime: number;
  duration: number;
  energyKeV: number;
  /** Position along the ribbon, 0..1. */
  slot: number;
  /** 1.0 for a normal event; ~0.5 per half for a charge-shared event. */
  sharedFraction: number;
  shared: boolean;
  streak: THREE.Mesh;
  blobA: THREE.Mesh;
  blobB: THREE.Mesh;
  marker: THREE.Mesh;
}

/**
 * Build the side-by-side EID vs PCD detector scene.
 */
export function createPCDDetector(
  materials: DetectorMaterials,
  options: PCDDetectorOptions = {},
): PCDDetector {
  const eidGridX = options.eidGridX ?? 16;
  const eidGridZ = options.eidGridZ ?? 12;
  const pcdGridX = options.pcdGridX ?? 32;
  const pcdGridZ = options.pcdGridZ ?? 24;

  const group = new THREE.Group();
  group.name = 'PCDDetectorScene';

  // Geometries this module creates and must dispose. Anything built from
  // BOX_GEOM / SPHERE_GEOM is deliberately absent from this list.
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const ownedMaterials: THREE.Material[] = [];
  const ownedTextures: THREE.Texture[] = [];

  const eidGroup = new THREE.Group();
  eidGroup.name = 'EIDDetector';
  eidGroup.position.x = EID_X;
  group.add(eidGroup);

  const pcdGroup = new THREE.Group();
  pcdGroup.name = 'PCDDetector';
  pcdGroup.position.x = PCD_X;
  group.add(pcdGroup);

  // -----------------------------------------------------------------
  // SECTION 1 — Housings
  // -----------------------------------------------------------------
  // Back plate plus a four-sided bezel, all instances of the shared unit
  // box with per-mesh scale.

  function addScaledBox(
    parent: THREE.Object3D,
    material: THREE.Material,
    sx: number,
    sy: number,
    sz: number,
    px: number,
    py: number,
    pz: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(BOX_GEOM, material);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(px, py, pz);
    parent.add(mesh);
    return mesh;
  }

  function buildHousing(name: string): THREE.Group {
    const housingGroup = new THREE.Group();
    housingGroup.name = name;

    const backPlate = addScaledBox(
      housingGroup,
      materials.photodiode,
      DETECTOR_WIDTH,
      DETECTOR_DEPTH * 0.5,
      DETECTOR_HEIGHT,
      0,
      -DETECTOR_DEPTH * 0.25,
      0,
    );
    backPlate.castShadow = true;
    backPlate.receiveShadow = true;

    const bezelY = DETECTOR_DEPTH * 0.45;
    addScaledBox(housingGroup, materials.tungstenSepta, DETECTOR_WIDTH + 0.05, 0.04, 0.06, 0, bezelY, DETECTOR_HEIGHT / 2 + 0.03);
    addScaledBox(housingGroup, materials.tungstenSepta, DETECTOR_WIDTH + 0.05, 0.04, 0.06, 0, bezelY, -DETECTOR_HEIGHT / 2 - 0.03);
    addScaledBox(housingGroup, materials.tungstenSepta, 0.06, 0.04, DETECTOR_HEIGHT + 0.05, -DETECTOR_WIDTH / 2 - 0.03, bezelY, 0);
    addScaledBox(housingGroup, materials.tungstenSepta, 0.06, 0.04, DETECTOR_HEIGHT + 0.05, DETECTOR_WIDTH / 2 + 0.03, bezelY, 0);

    return housingGroup;
  }

  // -----------------------------------------------------------------
  // SECTION 2 — EID layer stack (indirect conversion)
  // -----------------------------------------------------------------
  // Top down: scintillator slab -> tungsten septa grid -> photodiodes.
  // The septa grid is the key teaching element. Real EIDs put a septum
  // between EVERY pixel, which is why their geometric dose efficiency is
  // only ~50-65% — the septa are dead area that catches no signal.

  const eidHousing = buildHousing('EIDHousing');
  eidGroup.add(eidHousing);

  const scintGeo = new THREE.BoxGeometry(FACE_W, SCINT_LAYER_THICK, FACE_H);
  ownedGeometries.push(scintGeo);
  const scint = new THREE.Mesh(scintGeo, materials.scintillator);
  scint.name = 'EIDScintillator';
  scint.position.y = DETECTOR_DEPTH * 0.5 - SCINT_LAYER_THICK / 2;
  eidHousing.add(scint);

  // Septa grid — a wall between every pixel, in both directions.
  const septaGroup = new THREE.Group();
  septaGroup.name = 'EIDSepta';
  septaGroup.position.y = DETECTOR_DEPTH * 0.5 - SCINT_LAYER_THICK / 2;
  eidHousing.add(septaGroup);

  const septaYLen = SCINT_LAYER_THICK + 0.012;
  for (let i = 1; i < eidGridX; i++) {
    const x = (i / eidGridX - 0.5) * FACE_W;
    addScaledBox(septaGroup, materials.tungstenSepta, SEPTA_THICK, septaYLen, FACE_H, x, 0, 0);
  }
  for (let j = 1; j < eidGridZ; j++) {
    const z = (j / eidGridZ - 0.5) * FACE_H;
    addScaledBox(septaGroup, materials.tungstenSepta, FACE_W, septaYLen, SEPTA_THICK, 0, 0, z);
  }

  // Photodiode array under the septa — one tile per pixel.
  const eidPitchX = FACE_W / eidGridX;
  const eidPitchZ = FACE_H / eidGridZ;
  const photodiodeGeo = new THREE.PlaneGeometry(eidPitchX * 0.74, eidPitchZ * 0.74);
  ownedGeometries.push(photodiodeGeo);
  const photodiodeMesh = new THREE.InstancedMesh(
    photodiodeGeo,
    materials.photodiode,
    eidGridX * eidGridZ,
  );
  photodiodeMesh.name = 'EIDPhotodiodePixels';

  // Scratch objects for instance layout — allocated once, not per pixel.
  const tmpMatrix = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3(1, 1, 1);
  const faceUpQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  const tmpColor = new THREE.Color();

  const eidPixelY = DETECTOR_DEPTH * 0.5 - SCINT_LAYER_THICK - 0.008;
  let pdIdx = 0;
  for (let j = 0; j < eidGridZ; j++) {
    for (let i = 0; i < eidGridX; i++) {
      const x = ((i + 0.5) / eidGridX - 0.5) * FACE_W;
      const z = ((j + 0.5) / eidGridZ - 0.5) * FACE_H;
      tmpPos.set(x, eidPixelY, z);
      tmpMatrix.compose(tmpPos, faceUpQuat, tmpScale);
      photodiodeMesh.setMatrixAt(pdIdx, tmpMatrix);
      pdIdx++;
    }
  }
  photodiodeMesh.instanceMatrix.needsUpdate = true;
  // Allocate the instance colour buffer up front so the noise-floor
  // visualization never has to allocate mid-frame.
  photodiodeMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(eidGridX * eidGridZ * 3).fill(0.2),
    3,
  );
  photodiodeMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  eidHousing.add(photodiodeMesh);

  // -----------------------------------------------------------------
  // SECTION 3 — PCD layer stack (direct conversion)
  // -----------------------------------------------------------------
  // Top down: HV bias cathode -> CdTe/CZT bulk -> pixelated anodes.
  // No septa anywhere: the charge is steered by the electric field, not
  // by physical walls, so the pixel pitch here is half the EID's.

  const pcdHousing = buildHousing('PCDHousing');
  pcdGroup.add(pcdHousing);

  const biasGeo = new THREE.PlaneGeometry(FACE_W, FACE_H, 12, 8);
  ownedGeometries.push(biasGeo);
  const bias = new THREE.Mesh(biasGeo, materials.biasGrid);
  bias.name = 'PCDBiasCathode';
  bias.rotation.x = -Math.PI / 2;
  bias.position.y = DETECTOR_DEPTH * 0.5 - 0.01;
  pcdHousing.add(bias);

  const substrateGeo = new THREE.BoxGeometry(FACE_W, SUBSTRATE_LAYER_THICK, FACE_H);
  ownedGeometries.push(substrateGeo);
  const substrate = new THREE.Mesh(substrateGeo, materials.cdteSubstrate);
  substrate.name = 'PCDSubstrate';
  substrate.position.y = DETECTOR_DEPTH * 0.5 - 0.01 - SUBSTRATE_LAYER_THICK / 2;
  pcdHousing.add(substrate);

  const pcdPitchX = FACE_W / pcdGridX;
  const pcdPitchZ = FACE_H / pcdGridZ;
  const anodeGeo = new THREE.PlaneGeometry(pcdPitchX * 0.86, pcdPitchZ * 0.86);
  ownedGeometries.push(anodeGeo);
  const anodeMesh = new THREE.InstancedMesh(
    anodeGeo,
    materials.pixelElectrode,
    pcdGridX * pcdGridZ,
  );
  anodeMesh.name = 'PCDAnodePixels';
  const pcdPixelY = DETECTOR_DEPTH * 0.5 - 0.01 - SUBSTRATE_LAYER_THICK - 0.004;
  let anIdx = 0;
  for (let j = 0; j < pcdGridZ; j++) {
    for (let i = 0; i < pcdGridX; i++) {
      const x = ((i + 0.5) / pcdGridX - 0.5) * FACE_W;
      const z = ((j + 0.5) / pcdGridZ - 0.5) * FACE_H;
      tmpPos.set(x, pcdPixelY, z);
      tmpMatrix.compose(tmpPos, faceUpQuat, tmpScale);
      anodeMesh.setMatrixAt(anIdx, tmpMatrix);
      anIdx++;
    }
  }
  anodeMesh.instanceMatrix.needsUpdate = true;
  pcdHousing.add(anodeMesh);

  // -----------------------------------------------------------------
  // SECTION 4 — Ribbons (the readout contrast)
  // -----------------------------------------------------------------
  // Two separate ribbons, because EID and PCD readouts are not the same
  // kind of signal and drawing them on one axis would be a lie:
  //
  //   EID ribbon: a single broad ANALOG waveform. Overlapping light
  //     pulses blur together; the detector reports the area under this
  //     curve as one number. No thresholds — there is nothing to
  //     threshold, the energy information is already gone.
  //
  //   PCD ribbon: DISCRETE pulses whose height is the photon energy,
  //     with the three user-set thresholds drawn across it and a K-edge
  //     marker. Pulse colour shows which bin the photon was counted in.

  function makeRibbon(name: string, x: number): {
    root: THREE.Group;
    traceVerts: Float32Array;
    traceGeo: THREE.BufferGeometry;
    traceAttr: THREE.BufferAttribute;
  } {
    const root = new THREE.Group();
    root.name = name;
    root.position.set(x, RIBBON_Y, RIBBON_Z);
    group.add(root);

    // Baseline (the time axis).
    const baseGeo = new THREE.BufferGeometry();
    const baseVerts = new Float32Array([
      -RIBBON_LEN / 2, 0, 0,
      RIBBON_LEN / 2, 0, 0,
    ]);
    baseGeo.setAttribute('position', new THREE.BufferAttribute(baseVerts, 3));
    ownedGeometries.push(baseGeo);
    const baseMat = new THREE.LineBasicMaterial({
      color: 0x37506b,
      transparent: true,
      opacity: 0.8,
    });
    ownedMaterials.push(baseMat);
    root.add(new THREE.Line(baseGeo, baseMat));

    // The live trace.
    const traceGeo = new THREE.BufferGeometry();
    const traceVerts = new Float32Array(RIBBON_SEGMENTS * 3);
    for (let i = 0; i < RIBBON_SEGMENTS; i++) {
      traceVerts[i * 3 + 0] = (i / (RIBBON_SEGMENTS - 1) - 0.5) * RIBBON_LEN;
    }
    const traceAttr = new THREE.BufferAttribute(traceVerts, 3);
    traceAttr.setUsage(THREE.DynamicDrawUsage);
    traceGeo.setAttribute('position', traceAttr);
    ownedGeometries.push(traceGeo);
    return { root, traceVerts, traceGeo, traceAttr };
  }

  const eidRibbon = makeRibbon('EIDRibbon', EID_X);
  const eidTraceMat = new THREE.LineBasicMaterial({
    color: 0xa78bfa,
    transparent: true,
    opacity: 0.95,
  });
  ownedMaterials.push(eidTraceMat);
  eidRibbon.root.add(new THREE.Line(eidRibbon.traceGeo, eidTraceMat));

  const pcdRibbon = makeRibbon('PCDRibbon', PCD_X);
  const pcdTraceMat = new THREE.LineBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.95,
  });
  ownedMaterials.push(pcdTraceMat);
  pcdRibbon.root.add(new THREE.Line(pcdRibbon.traceGeo, pcdTraceMat));

  // --- EID electronic-noise floor line ---
  // The EID's signal sits ON TOP of this floor and cannot be separated
  // from it. Drawn only when the user enables electronic noise.
  const noiseFloorGeo = new THREE.BufferGeometry();
  noiseFloorGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([-RIBBON_LEN / 2, 0, 0, RIBBON_LEN / 2, 0, 0]),
      3,
    ),
  );
  ownedGeometries.push(noiseFloorGeo);
  const noiseFloorMat = new THREE.LineDashedMaterial({
    color: 0xf87171,
    transparent: true,
    opacity: 0.85,
    dashSize: 0.06,
    gapSize: 0.04,
  });
  ownedMaterials.push(noiseFloorMat);
  const noiseFloorLine = new THREE.Line(noiseFloorGeo, noiseFloorMat);
  noiseFloorLine.name = 'EIDNoiseFloor';
  noiseFloorLine.computeLineDistances();
  noiseFloorLine.visible = false;
  eidRibbon.root.add(noiseFloorLine);

  // --- EID integrated-readout bar ---
  // One bar, one number: everything the EID knows after a readout.
  const eidIntegralBarMat = new THREE.MeshBasicMaterial({
    color: 0xa78bfa,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  ownedMaterials.push(eidIntegralBarMat);
  const eidIntegralBar = new THREE.Mesh(BOX_GEOM, eidIntegralBarMat);
  eidIntegralBar.name = 'EIDIntegralBar';
  eidIntegralBar.position.set(RIBBON_LEN / 2 + 0.12, 0, 0);
  eidIntegralBar.scale.set(0.1, 0.001, 0.02);
  eidRibbon.root.add(eidIntegralBar);

  // --- PCD threshold lines + K-edge marker ---
  const thresholdLines: THREE.Line[] = [];
  const THRESHOLD_COLORS = [0x66ff99, 0xffd166, 0xff8866];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([-RIBBON_LEN / 2, 0, 0, RIBBON_LEN / 2, 0, 0]),
        3,
      ),
    );
    ownedGeometries.push(geo);
    const mat = new THREE.LineDashedMaterial({
      color: THRESHOLD_COLORS[i],
      transparent: true,
      opacity: 0.7,
      dashSize: 0.05,
      gapSize: 0.05,
    });
    ownedMaterials.push(mat);
    const line = new THREE.Line(geo, mat);
    line.name = `PCDThreshold${i + 1}`;
    pcdRibbon.root.add(line);
    thresholdLines.push(line);
  }

  const kEdgeGeo = new THREE.BufferGeometry();
  kEdgeGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([-RIBBON_LEN / 2, 0, 0, RIBBON_LEN / 2, 0, 0]),
      3,
    ),
  );
  ownedGeometries.push(kEdgeGeo);
  const kEdgeMat = new THREE.LineBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.9,
  });
  ownedMaterials.push(kEdgeMat);
  const kEdgeLine = new THREE.Line(kEdgeGeo, kEdgeMat);
  kEdgeLine.name = 'PCDKEdgeMarker';
  pcdRibbon.root.add(kEdgeLine);

  // -----------------------------------------------------------------
  // SECTION 5 — Labels
  // -----------------------------------------------------------------

  function makeLabelSprite(text: string, colorHex: number, scaleX: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallbackMat = new THREE.SpriteMaterial({ color: colorHex });
      ownedMaterials.push(fallbackMat);
      const fallback = new THREE.Sprite(fallbackMat);
      fallback.scale.set(scaleX, scaleX * 0.125, 1);
      return fallback;
    }
    const css = '#' + colorHex.toString(16).padStart(6, '0');
    ctx.fillStyle = 'rgba(8, 11, 16, 0.88)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = css;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
    ctx.fillStyle = css;
    // Shrink the font until the label fits inside the padded box, so
    // longer captions are never clipped mid-word.
    const maxTextWidth = canvas.width - 24;
    let fontPx = 30;
    do {
      ctx.font = `bold ${fontPx}px monospace`;
      if (ctx.measureText(text).width <= maxTextWidth) break;
      fontPx -= 1;
    } while (fontPx > 10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    ownedTextures.push(tex);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    ownedMaterials.push(mat);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scaleX, scaleX * 0.125, 1);
    return sprite;
  }

  const labelY = DETECTOR_DEPTH * 0.5 + 0.62;
  const eidLabel = makeLabelSprite('EID  indirect / integrating', 0xa78bfa, 2.3);
  eidLabel.position.set(EID_X, labelY, 0);
  group.add(eidLabel);

  const pcdLabel = makeLabelSprite('PCD  direct / counting', 0x34d399, 2.3);
  pcdLabel.position.set(PCD_X, labelY, 0);
  group.add(pcdLabel);

  // Ribbon captions name what each readout actually is.
  const eidRibbonLabel = makeLabelSprite('integrated signal  (no spectrum)', 0xa78bfa, 2.1);
  eidRibbonLabel.position.set(EID_X, RIBBON_Y - 0.3, RIBBON_Z);
  group.add(eidRibbonLabel);

  const pcdRibbonLabel = makeLabelSprite('pulse height = photon energy', 0x34d399, 2.1);
  pcdRibbonLabel.position.set(PCD_X, RIBBON_Y - 0.3, RIBBON_Z);
  group.add(pcdRibbonLabel);

  // -----------------------------------------------------------------
  // SECTION 6 — Photon event pool
  // -----------------------------------------------------------------

  const streakGeom = new THREE.CylinderGeometry(0.012, 0.004, 1, 6, 1, true);
  ownedGeometries.push(streakGeom);
  const markerGeom = new THREE.PlaneGeometry(0.05, 0.05);
  ownedGeometries.push(markerGeom);

  const events: PhotonEvent[] = [];
  for (let i = 0; i < MAX_EVENTS; i++) {
    const streakMat = materials.pulseSprite.clone();
    ownedMaterials.push(streakMat);
    const streak = new THREE.Mesh(streakGeom, streakMat);
    streak.visible = false;
    group.add(streak);

    const blobMatA = materials.chargeCloud.clone();
    ownedMaterials.push(blobMatA);
    const blobA = new THREE.Mesh(SPHERE_GEOM, blobMatA);
    blobA.visible = false;
    group.add(blobA);

    const blobMatB = materials.chargeCloud.clone();
    ownedMaterials.push(blobMatB);
    const blobB = new THREE.Mesh(SPHERE_GEOM, blobMatB);
    blobB.visible = false;
    group.add(blobB);

    const markerMat = materials.pulseSprite.clone();
    ownedMaterials.push(markerMat);
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.visible = false;
    group.add(marker);

    events.push({
      active: false,
      inPCD: false,
      birthTime: -1,
      duration: 0.5,
      energyKeV: 0,
      slot: 0,
      sharedFraction: 1,
      shared: false,
      streak,
      blobA,
      blobB,
      marker,
    });
  }

  function nextFreeEvent(): PhotonEvent | null {
    for (const e of events) {
      if (!e.active) return e;
    }
    return null;
  }

  // -----------------------------------------------------------------
  // SECTION 7 — Simulation state
  // -----------------------------------------------------------------

  const stats: PCDDetectorStats = {
    bin1: 0,
    bin2: 0,
    bin3: 0,
    subThreshold: 0,
    pileUp: 0,
    eidIntegral: 0,
    eidPhotons: 0,
  };

  let nextSpawnEID = 0;
  let nextSpawnPCD = 0;
  let lastPCDPulseTime = -10;
  let lastPCDEvent: PhotonEvent | null = null;
  let thresholdSnapshot = '';
  let kEdgeSnapshot = '';
  let viewMode: DetectorViewMode = 'both';

  /**
   * Sample a photon energy from a crude bremsstrahlung-shaped spectrum
   * bounded by the tube voltage. Not a physical spectrum model — the
   * simulator's `calculatePCCTSpectrum` owns that. This only needs to
   * produce a believable spread of pulse heights for the animation.
   */
  function samplePhotonEnergy(kVp: number): number {
    const eMax = Math.max(E_MIN_KEV + 10, kVp);
    const u = Math.random();
    return E_MIN_KEV + (eMax - E_MIN_KEV) * Math.pow(u, 0.75);
  }

  /** Which energy bin does this pulse land in? -1 means "lost". */
  function classify(params: PCCTParams, keV: number): number {
    if (keV < params.threshold1) return -1;
    if (keV < params.threshold2) return 0;
    if (keV < params.threshold3) return 1;
    return 2;
  }

  function positionInFace(
    detectorX: number,
    gridX: number,
    gridZ: number,
    faceY: number,
    out: THREE.Vector3,
  ): void {
    const i = Math.floor(Math.random() * gridX);
    const j = Math.floor(Math.random() * gridZ);
    out.set(
      ((i + 0.5) / gridX - 0.5) * FACE_W + detectorX,
      faceY,
      ((j + 0.5) / gridZ - 0.5) * FACE_H,
    );
  }

  const spawnPos = new THREE.Vector3();

  /** Aim the incident streak so it falls onto the interaction point. */
  function placeStreak(ev: PhotonEvent, x: number, y: number, z: number): void {
    const streakLen = 0.85;
    ev.streak.scale.set(1, streakLen, 1);
    ev.streak.position.set(x, y + streakLen / 2, z);
    ev.streak.visible = true;
  }

  function spawnEIDPhoton(params: PCCTParams, now: number): void {
    const ev = nextFreeEvent();
    if (!ev) return;

    const energyKeV = samplePhotonEnergy(params.kVp);
    ev.active = true;
    ev.inPCD = false;
    ev.birthTime = now;
    ev.duration = 0.62;
    ev.energyKeV = energyKeV;
    ev.slot = Math.random();
    ev.shared = false;
    ev.sharedFraction = 1;

    const faceY = DETECTOR_DEPTH * 0.5 - SCINT_LAYER_THICK / 2;
    positionInFace(EID_X, eidGridX, eidGridZ, faceY, spawnPos);
    placeStreak(ev, spawnPos.x, DETECTOR_DEPTH * 0.5, spawnPos.z);

    // The scintillation light blob. It starts small and spreads out
    // LATERALLY inside the slab — this is the effect that puts a floor
    // under EID pixel size.
    ev.blobA.position.copy(spawnPos);
    ev.blobA.visible = true;
    ev.blobB.visible = false;

    // Every photon's energy is simply added to the running integral.
    // Nothing records what that energy was.
    stats.eidIntegral += energyKeV;
    stats.eidPhotons += 1;

    // The EID marker rides the analog trace rather than standing at a
    // pulse height, because there is no pulse height to stand at.
    ev.marker.visible = false;
  }

  function spawnPCDPhoton(params: PCCTParams, now: number): void {
    const energyKeV = samplePhotonEnergy(params.kVp);

    // --- Pile-up ---
    // If this photon arrives inside the dead time of the previous one,
    // the two pulses merge: the electronics see ONE event whose apparent
    // energy is the sum. The count is lost and the spectrum is distorted
    // upward. Probability matches 1 - exp(-flux * tau).
    const pileUpProb = 1 - Math.exp(-params.photonFlux * PULSE_DEAD_TIME);
    const withinDeadTime = now - lastPCDPulseTime < PULSE_DEAD_TIME * 4;
    if (
      lastPCDEvent &&
      lastPCDEvent.active &&
      lastPCDEvent.inPCD &&
      withinDeadTime &&
      Math.random() < pileUpProb
    ) {
      // Merge into the previous pulse and re-classify at the summed
      // (wrong, too high) energy.
      const merged = Math.min(E_MIN_KEV + E_SPAN_KEV * 1.05, lastPCDEvent.energyKeV + energyKeV);
      lastPCDEvent.energyKeV = merged;
      lastPCDEvent.birthTime = now;
      stats.pileUp += 1;
      lastPCDPulseTime = now;
      return;
    }

    const ev = nextFreeEvent();
    if (!ev) return;

    ev.active = true;
    ev.inPCD = true;
    ev.birthTime = now;
    ev.duration = 0.55;
    ev.energyKeV = energyKeV;
    ev.slot = Math.random();

    const faceY = DETECTOR_DEPTH * 0.5 - 0.01 - SUBSTRATE_LAYER_THICK * 0.5;
    positionInFace(PCD_X, pcdGridX, pcdGridZ, faceY, spawnPos);
    placeStreak(ev, spawnPos.x, DETECTOR_DEPTH * 0.5, spawnPos.z);

    // --- Charge sharing ---
    // Smaller pixels mean a larger fraction of clouds straddle a pixel
    // boundary. The energy is split between the two neighbours, so each
    // records a LOW-energy event — and both halves often fall under
    // threshold 1 and are thrown away.
    const shareProb = Math.min(0.5, (params.photonFlux / 30) * 0.6);
    ev.shared = Math.random() < shareProb;

    if (ev.shared) {
      ev.sharedFraction = 0.42 + Math.random() * 0.16;
      const offset = pcdPitchX * 0.55;
      ev.blobA.position.set(spawnPos.x - offset, spawnPos.y, spawnPos.z);
      ev.blobA.visible = true;
      ev.blobB.position.set(spawnPos.x + offset, spawnPos.y, spawnPos.z);
      ev.blobB.visible = true;

      // Both halves are counted separately, each at its own reduced
      // energy. This is the honest accounting: one photon in, two wrong
      // counts (or two losses) out.
      const halfA = energyKeV * ev.sharedFraction;
      const halfB = energyKeV * (1 - ev.sharedFraction);
      for (const half of [halfA, halfB]) {
        const bin = classify(params, half);
        if (bin === -1) stats.subThreshold += 1;
        else if (bin === 0) stats.bin1 += 1;
        else if (bin === 1) stats.bin2 += 1;
        else stats.bin3 += 1;
      }
      // The visible pulse height is the larger half — visibly lower than
      // where an unshared photon of this energy would have landed.
      ev.energyKeV = energyKeV * Math.max(ev.sharedFraction, 1 - ev.sharedFraction);
    } else {
      ev.sharedFraction = 1;
      ev.blobA.position.copy(spawnPos);
      ev.blobA.visible = true;
      ev.blobB.visible = false;

      const bin = classify(params, energyKeV);
      if (bin === -1) stats.subThreshold += 1;
      else if (bin === 0) stats.bin1 += 1;
      else if (bin === 1) stats.bin2 += 1;
      else stats.bin3 += 1;
    }

    // The ribbon marker: height is the pulse height, colour is the bin.
    const y = energyToY(ev.energyKeV);
    ev.marker.position.set((ev.slot - 0.5) * RIBBON_LEN, y, 0.02);
    ev.marker.visible = true;

    lastPCDPulseTime = now;
    lastPCDEvent = ev;
  }

  function rebuildThresholdLines(params: PCCTParams): void {
    const values = [params.threshold1, params.threshold2, params.threshold3];
    for (let i = 0; i < 3; i++) {
      const line = thresholdLines[i];
      const attr = line.geometry.attributes.position as THREE.BufferAttribute;
      const y = energyToY(values[i]);
      attr.setY(0, y);
      attr.setY(1, y);
      attr.needsUpdate = true;
      line.computeLineDistances();
    }
  }

  function rebuildKEdgeLine(params: PCCTParams): void {
    const y = energyToY(K_EDGE_KEV[params.contrastAgent]);
    const attr = kEdgeLine.geometry.attributes.position as THREE.BufferAttribute;
    attr.setY(0, y);
    attr.setY(1, y);
    attr.needsUpdate = true;
  }

  // -----------------------------------------------------------------
  // SECTION 8 — Per-frame update
  // -----------------------------------------------------------------

  function update(params: PCCTParams, elapsedSeconds: number): void {
    // (a) Threshold + K-edge guides — rebuilt only when they change.
    const tSnap = `${params.threshold1}|${params.threshold2}|${params.threshold3}`;
    if (tSnap !== thresholdSnapshot) {
      rebuildThresholdLines(params);
      thresholdSnapshot = tSnap;
    }
    if (params.contrastAgent !== kEdgeSnapshot) {
      rebuildKEdgeLine(params);
      kEdgeSnapshot = params.contrastAgent;
    }

    // (b) Spawn photons into whichever detectors are visible.
    const spawnRate = Math.max(0.5, params.photonFlux * 1.2);
    const spawnInterval = 1 / spawnRate;
    // If we have been away (backgrounded tab, tab switch), skip forward
    // rather than trying to catch up over thousands of iterations.
    if (elapsedSeconds - nextSpawnEID > 2) nextSpawnEID = elapsedSeconds;
    if (elapsedSeconds - nextSpawnPCD > 2) nextSpawnPCD = elapsedSeconds;

    if (viewMode !== 'pcd') {
      let guard = 0;
      while (elapsedSeconds >= nextSpawnEID && guard++ < 64) {
        spawnEIDPhoton(params, elapsedSeconds);
        nextSpawnEID += spawnInterval * (0.7 + Math.random() * 0.6);
      }
    } else {
      nextSpawnEID = elapsedSeconds;
    }

    if (viewMode !== 'eid') {
      let guard = 0;
      while (elapsedSeconds >= nextSpawnPCD && guard++ < 64) {
        spawnPCDPhoton(params, elapsedSeconds);
        nextSpawnPCD += spawnInterval * (0.7 + Math.random() * 0.6);
      }
    } else {
      nextSpawnPCD = elapsedSeconds;
    }

    // (c) Retire expired events.
    for (const ev of events) {
      if (!ev.active) continue;
      const dt = elapsedSeconds - ev.birthTime;
      if (dt < 0 || dt > ev.duration) {
        ev.active = false;
        ev.streak.visible = false;
        ev.blobA.visible = false;
        ev.blobB.visible = false;
        ev.marker.visible = false;
        if (lastPCDEvent === ev) lastPCDEvent = null;
      }
    }

    // (d) Rebuild both ribbon traces.
    //
    // The EID trace uses a WIDE gaussian per photon: the integrating
    // readout smears everything together, and at high flux the individual
    // events become one indistinguishable lump. The PCD trace uses a
    // NARROW gaussian: each photon stays a resolvable, measurable spike.
    const EID_SIGMA2 = 2 * 0.055; // broad — integration smears
    const PCD_SIGMA2 = 2 * 0.0022; // narrow — discrete counting

    for (let i = 0; i < RIBBON_SEGMENTS; i++) {
      const t = i / (RIBBON_SEGMENTS - 1);
      let eidY = 0;
      let pcdY = 0;

      for (const ev of events) {
        if (!ev.active) continue;
        const dt = elapsedSeconds - ev.birthTime;
        if (dt < 0 || dt > ev.duration) continue;
        const ageT = dt / ev.duration;
        const d = t - ev.slot;
        const pulseY = energyToY(ev.energyKeV);

        if (ev.inPCD) {
          const g = Math.exp(-(d * d) / PCD_SIGMA2);
          pcdY += pulseY * g * Math.exp(-ageT * 3.2);
        } else {
          const g = Math.exp(-(d * d) / EID_SIGMA2);
          // The EID contribution decays slowly (long integration window).
          eidY += pulseY * g * 0.55 * Math.exp(-ageT * 1.3);
        }
      }

      // The EID noise floor rides on top of the signal and can never be
      // subtracted out — that is the whole point.
      if (params.enableElectronicNoise) {
        eidY += 0.05 + Math.random() * 0.035;
      }

      eidRibbon.traceVerts[i * 3 + 1] = eidY;
      pcdRibbon.traceVerts[i * 3 + 1] = pcdY;
    }
    eidRibbon.traceAttr.needsUpdate = true;
    pcdRibbon.traceAttr.needsUpdate = true;

    // (e) Noise floor guide on the EID ribbon.
    noiseFloorLine.visible = params.enableElectronicNoise;
    if (params.enableElectronicNoise) {
      const attr = noiseFloorGeo.attributes.position as THREE.BufferAttribute;
      attr.setY(0, 0.065);
      attr.setY(1, 0.065);
      attr.needsUpdate = true;
      noiseFloorLine.computeLineDistances();
    }

    // (f) EID integrated-readout bar. Height tracks the running integral
    // with a leaky window so it settles instead of growing forever.
    const targetH = Math.min(RIBBON_HEIGHT, (stats.eidIntegral % 4000) / 4000 * RIBBON_HEIGHT);
    eidIntegralBar.scale.set(0.1, Math.max(0.002, targetH), 0.02);
    eidIntegralBar.position.y = eidIntegralBar.scale.y / 2;

    // (g) Per-event visuals.
    for (const ev of events) {
      if (!ev.active) continue;
      const dt = elapsedSeconds - ev.birthTime;
      const ageT = Math.max(0, Math.min(1, dt / ev.duration));

      // Incident streak: visible only during the first slice of the
      // event's life, shrinking as the photon is absorbed.
      if (ageT < 0.22) {
        const k = 1 - ageT / 0.22;
        ev.streak.visible = true;
        ev.streak.scale.set(1, 0.85 * k, 1);
        ev.streak.position.y = DETECTOR_DEPTH * 0.5 + (0.85 * k) / 2;
        (ev.streak.material as THREE.MeshBasicMaterial).opacity = 0.85 * k;
      } else {
        ev.streak.visible = false;
      }

      if (ev.inPCD) {
        // Charge cloud: tight, and flattened along Y because it is being
        // drifted down the field lines toward the anode.
        const r = 0.018 + ageT * 0.03;
        const fade = Math.max(0, 1 - ageT);
        const matA = ev.blobA.material as THREE.MeshBasicMaterial;
        ev.blobA.scale.set(r, r * 0.55, r);
        ev.blobA.position.y =
          DETECTOR_DEPTH * 0.5 - 0.01 - SUBSTRATE_LAYER_THICK * (0.2 + ageT * 0.7);
        matA.opacity = 0.9 * fade * ev.sharedFraction;
        matA.color.setHex(0x66ffd4);

        if (ev.shared) {
          const matB = ev.blobB.material as THREE.MeshBasicMaterial;
          ev.blobB.scale.set(r, r * 0.55, r);
          ev.blobB.position.y = ev.blobA.position.y;
          matB.opacity = 0.9 * fade * (1 - ev.sharedFraction);
          // Shared halves are tinted red: this is energy landing in the
          // wrong bin (or being lost below threshold 1).
          matB.color.setHex(0xff7a66);
          matA.color.setHex(0xff7a66);
        }

        // Ribbon marker colour = which bin this pulse was counted into.
        const bin = classify(params, ev.energyKeV);
        const markerMat = ev.marker.material as THREE.MeshBasicMaterial;
        if (bin === -1) tmpColor.setHex(0xff5566);
        else tmpColor.setHex(THRESHOLD_COLORS[bin]);
        markerMat.color.copy(tmpColor);
        markerMat.opacity = 0.95 * Math.max(0, 1 - ageT * 0.9);
        ev.marker.position.y = energyToY(ev.energyKeV);
        const ms = 1 + ageT * 0.6;
        ev.marker.scale.set(ms, ms, 1);
      } else {
        // Scintillation light: spreads out laterally and stays wide.
        // Compare its footprint to the PCD cloud above — this is the
        // spatial-resolution penalty of indirect conversion, drawn to
        // scale against the two pixel pitches.
        const r = 0.05 + ageT * 0.19;
        const fade = Math.max(0, 1 - ageT);
        const matA = ev.blobA.material as THREE.MeshBasicMaterial;
        // Flattened in Y: the light is confined by the slab thickness
        // but free to spread in X and Z.
        ev.blobA.scale.set(r, SCINT_LAYER_THICK * 0.9, r);
        matA.opacity = 0.5 * fade;
        matA.color.setHex(0xc4b5fd);
      }
    }

    // (h) Scintillator glow tracks flux.
    materials.scintillator.emissiveIntensity =
      0.06 + Math.min(0.24, params.photonFlux / 125);

    // (i) EID electronic-noise floor rendered onto the photodiode array.
    // With noise on, every pixel flickers even with no X-rays present.
    const colorAttr = photodiodeMesh.instanceColor;
    if (colorAttr) {
      const n = eidGridX * eidGridZ;
      if (params.enableElectronicNoise) {
        for (let i = 0; i < n; i++) {
          const noise = 0.16 + Math.random() * 0.2;
          colorAttr.setXYZ(i, noise, noise * 0.85, noise * 0.95);
        }
        colorAttr.needsUpdate = true;
      } else {
        // Only rewrite once when transitioning to the quiet state.
        if (colorAttr.getX(0) !== 0.18) {
          for (let i = 0; i < n; i++) colorAttr.setXYZ(i, 0.18, 0.2, 0.25);
          colorAttr.needsUpdate = true;
        }
      }
    }
  }

  // -----------------------------------------------------------------
  // SECTION 9 — Public surface
  // -----------------------------------------------------------------

  function setViewMode(mode: DetectorViewMode): void {
    viewMode = mode;
    const showEID = mode !== 'pcd';
    const showPCD = mode !== 'eid';

    eidGroup.visible = showEID;
    eidLabel.visible = showEID;
    eidRibbon.root.visible = showEID;
    eidRibbonLabel.visible = showEID;

    pcdGroup.visible = showPCD;
    pcdLabel.visible = showPCD;
    pcdRibbon.root.visible = showPCD;
    pcdRibbonLabel.visible = showPCD;

    // Recentre the focused detector so a single-detector view fills the
    // frame instead of sitting off to one side.
    const eidX = mode === 'eid' ? 0 : EID_X;
    const pcdX = mode === 'pcd' ? 0 : PCD_X;
    eidGroup.position.x = eidX;
    eidLabel.position.x = eidX;
    eidRibbon.root.position.x = eidX;
    eidRibbonLabel.position.x = eidX;
    pcdGroup.position.x = pcdX;
    pcdLabel.position.x = pcdX;
    pcdRibbon.root.position.x = pcdX;
    pcdRibbonLabel.position.x = pcdX;

    // Retire in-flight events — their world positions belong to the old
    // layout and would otherwise hang in mid-air after a recentre.
    for (const ev of events) {
      ev.active = false;
      ev.streak.visible = false;
      ev.blobA.visible = false;
      ev.blobB.visible = false;
      ev.marker.visible = false;
    }
    lastPCDEvent = null;
  }

  function getStats(): PCDDetectorStats {
    return { ...stats };
  }

  function setEnabled(v: boolean): void {
    group.visible = v;
  }

  function dispose(): void {
    for (const g of ownedGeometries) g.dispose();
    for (const m of ownedMaterials) m.dispose();
    for (const t of ownedTextures) t.dispose();
    ownedGeometries.length = 0;
    ownedMaterials.length = 0;
    ownedTextures.length = 0;
    // BOX_GEOM and SPHERE_GEOM are module-scope and shared across every
    // instance of this scene — intentionally NOT disposed here.
  }

  return {
    group,
    update,
    setViewMode,
    getStats,
    setEnabled,
    dispose,
  };
}
