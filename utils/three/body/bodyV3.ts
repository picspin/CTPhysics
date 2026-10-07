import * as THREE from 'three';
import type { BodyRegionId } from '@/utils/dose-physics';
import { buildLoft, buildEllipsoid, type PartKind } from './surface';
import { ORGANS, type OrganSpec } from './organs';
import { REGION_IDS } from './regions';
import { INTERACTIVE_ORGAN_IDS } from '@/utils/organ-dose';
import { BodyFrame, cmToLocal, localToCm, regionIndex, regionOfSkinPoint, clampSkinOpacity, SKIN_OPACITY_DEFAULT } from './geometryMath';

// Shared v3.1 body (semi-transparent Fresnel skin over procedural organs) used by the
// Dose page 3D viewer and the Helical CT simulator. ALL GEOMETRY IS A PROCEDURAL TEACHING MOCK.

export interface BodyV3Options {
  frame?: Partial<BodyFrame>;
  /** ring points per section (trunk); limbs use ~60% of it. Lower on mobile. */
  ringPoints?: number;
  /** max ring spacing in cm */
  ringStep?: number;
  skinOpacity?: number;
  /** base skin colour */
  skinColor?: number;
  /** render organs (Helical CT can turn them off) */
  organs?: boolean;
  /** organ ids that can be picked (ICRP-102-style key organs). Others render dimmed as context only. */
  interactiveOrgans?: readonly string[];
}

export interface BodyPick {
  region: BodyRegionId;
  /** organ id, or null when only the skin was hit */
  organId: string | null;
}

export interface BodyV3 {
  group: THREE.Group;
  frame: BodyFrame;
  setSkinOpacity: (v: number) => void;
  setRegionColors: (colors: Partial<Record<BodyRegionId, THREE.Color>>) => void;
  setHighlightRegion: (r: BodyRegionId | null) => void;
  setSelectedOrgan: (id: string | null) => void;
  setOrgansVisible: (v: boolean) => void;
  pick: (raycaster: THREE.Raycaster) => BodyPick | null;
  /** Axial CT slice plane at body z (cm from vertex), textured with `source` (256x256 canvas). null hides it. */
  setSlice: (zCm: number | null, source?: HTMLCanvasElement | null) => void;
  /** call after redrawing the slice canvas */
  refreshSliceTexture: () => void;
  /** triangles of the skin geometry (status / tests) */
  skinTriangles: number;
  dispose: () => void;
}

export const DEFAULT_FRAME: BodyFrame = { s: 4.75 / 175.5, topY: 2.6, anterior: 1 };

const SKIN_VS = /* glsl */ `
attribute float aRegion;
varying vec3 vN; varying vec3 vV; varying float vRegion;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vRegion = aRegion;
  gl_Position = projectionMatrix * mv;
}`;
const SKIN_FS = /* glsl */ `
uniform vec3 uRegionColor[5]; uniform float uOpacity; uniform float uHighlight; uniform float uBack;
varying vec3 vN; varying vec3 vV; varying float vRegion;
void main(){
  float ri = floor(vRegion + 0.5);
  vec3 base = uRegionColor[0];
  if (ri > 0.5) base = uRegionColor[1];
  if (ri > 1.5) base = uRegionColor[2];
  if (ri > 2.5) base = uRegionColor[3];
  if (ri > 3.5) base = uRegionColor[4];
  vec3 n = normalize(vN); if (uBack > 0.5) n = -n;
  float ndv = clamp(abs(dot(n, normalize(vV))), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 2.6);
  float diff = 0.55 + 0.45 * max(dot(n, normalize(vec3(0.4, 0.8, 0.6))), 0.0);
  float hi = (uHighlight > -0.5 && abs(ri - uHighlight) < 0.5) ? 1.0 : 0.0;
  vec3 col = base * diff + vec3(0.9, 0.95, 1.0) * rim * 0.55 + vec3(1.0, 0.7, 0.35) * hi * 0.35;
  float a = uOpacity + rim * (1.0 - uOpacity) * 0.6 + hi * 0.15;
  if (uBack > 0.5) { col *= 0.45; a *= 0.5; }
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}`;

/** Merge lofted parts into one geometry with a per-vertex region attribute. */
function buildSkinGeometry(frame: BodyFrame, M: number, step: number): THREE.BufferGeometry {
  const pieces: { pos: Float32Array; idx: Uint32Array; part: PartKind | 'face' }[] = [];
  pieces.push({ ...buildLoft('body', 1, M, step), part: 'body' });
  const ML = Math.max(12, Math.round(M * 0.6));
  for (const sgn of [1, -1]) {
    pieces.push({ ...buildLoft('arm', sgn, ML, step), part: 'arm' });
    pieces.push({ ...buildLoft('leg', sgn, ML, step), part: 'leg' });
  }
  // nose and ears (small ellipsoids, mock)
  pieces.push({ ...buildEllipsoid(0, 11.2, 1.1, 1.9, 11.2, 16.8, 12, 6), part: 'face' });
  pieces.push({ ...buildEllipsoid(8.0, 0.4, 0.8, 2.0, 8.6, 14.4, 10, 6), part: 'face' });
  pieces.push({ ...buildEllipsoid(-8.0, 0.4, 0.8, 2.0, 8.6, 14.4, 10, 6), part: 'face' });

  let nv = 0, ni = 0;
  for (const p of pieces) { nv += p.pos.length / 3; ni += p.idx.length; }
  const pos = new Float32Array(nv * 3), reg = new Float32Array(nv), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  // cmToLocal maps (x,y,z) -> (x, -z, anterior*y): det = anterior. Loft triangles are CCW-outward in cm space,
  // so only the mirrored frame (anterior = -1, negative determinant) needs its winding reversed.
  const flip = frame.anterior === -1;
  for (const p of pieces) {
    const n = p.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const x = p.pos[i * 3], y = p.pos[i * 3 + 1], z = p.pos[i * 3 + 2];
      const l = cmToLocal(frame, x, y, z);
      pos.set(l, (vo + i) * 3);
      // Limbs (arms and whole legs incl. thighs) are always 'peripheral', matching regions.ts and organs.ts.
      const r = p.part === 'arm' || p.part === 'leg' ? 'peripheral' : regionOfSkinPoint(x, z);
      reg[vo + i] = regionIndex(r);
    }
    for (let k = 0; k < p.idx.length; k += 3) {
      const a = p.idx[k] + vo, b = p.idx[k + 1] + vo, c = p.idx[k + 2] + vo;
      if (flip) { idx[io++] = a; idx[io++] = c; idx[io++] = b; } else { idx[io++] = a; idx[io++] = b; idx[io++] = c; }
    }
    vo += n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRegion', new THREE.BufferAttribute(reg, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function organMeshes(o: OrganSpec, frame: BodyFrame, geo: { sphere: THREE.BufferGeometry; cyl: THREE.BufferGeometry; torus: THREE.BufferGeometry }, mat: THREE.Material): THREE.Mesh[] {
  const s = frame.s, out: THREE.Mesh[] = [];
  const add = (g: THREE.BufferGeometry, cx: number, cy: number, z: number, sx: number, sy: number, sz: number, torus = false) => {
    const m = new THREE.Mesh(g, mat);
    m.position.set(...cmToLocal(frame, cx, cy, z));
    if (torus) { m.rotation.x = Math.PI / 2; m.scale.set(sx * s, sy * s, sz * 15 * s); } else m.scale.set(sx * s, sy * s, sz * s);
    m.userData.organId = o.id;
    out.push(m);
  };
  for (const p of o.parts) {
    const zc = (p.z0 + p.z1) / 2, hz = (p.z1 - p.z0) / 2;
    if (p.k === 'ell' || p.k === 'shell') add(geo.sphere, p.cx, p.cy, zc, p.rx, hz, p.ry);
    else if (p.k === 'cyl') add(geo.cyl, p.cx, p.cy, zc, p.rx, hz * 2, p.ry);
    else if (p.k === 'rings') {
      for (let z = p.z0; z <= p.z1; z += p.pitch) add(geo.torus, p.cx, p.cy, z, p.rx, p.ry, 1, true);
    } else if (p.k === 'vert') {
      for (let z = p.z0; z + p.len <= p.z1 + 1e-6; z += p.pitch) add(geo.cyl, p.cx, p.cy, z + p.len / 2, p.rx, p.len, p.ry);
    }
  }
  return out;
}

export function createBodyV3(options: BodyV3Options = {}): BodyV3 {
  const frame: BodyFrame = { ...DEFAULT_FRAME, ...options.frame };
  const M = options.ringPoints ?? 40;
  const step = options.ringStep ?? 2.5;
  const group = new THREE.Group();
  group.name = 'BodyV3';

  // ---- skin: back faces -> depth pre-pass -> front faces (Fresnel) ----
  const skinGeo = buildSkinGeometry(frame, M, step);
  const baseSkin = new THREE.Color(options.skinColor ?? 0xe0a98f);
  const uniforms = {
    uRegionColor: { value: REGION_IDS.map(() => baseSkin.clone()) },
    uOpacity: { value: clampSkinOpacity(options.skinOpacity ?? SKIN_OPACITY_DEFAULT) },
    uHighlight: { value: -1 },
    uBack: { value: 0 },
  };
  const common = { vertexShader: SKIN_VS, fragmentShader: SKIN_FS, transparent: true, depthWrite: false };
  const backMat = new THREE.ShaderMaterial({ ...common, side: THREE.BackSide, uniforms: { ...uniforms, uBack: { value: 1 } } });
  const preMat = new THREE.ShaderMaterial({ vertexShader: SKIN_VS, fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }', transparent: true, colorWrite: false, depthWrite: true, side: THREE.FrontSide });
  const frontMat = new THREE.ShaderMaterial({ ...common, side: THREE.FrontSide, uniforms, depthFunc: THREE.LessEqualDepth });
  const skinBack = new THREE.Mesh(skinGeo, backMat);
  const skinPre = new THREE.Mesh(skinGeo, preMat);
  const skinFront = new THREE.Mesh(skinGeo, frontMat);
  skinBack.renderOrder = 27; skinPre.renderOrder = 29; skinFront.renderOrder = 30;
  for (const m of [skinBack, skinPre, skinFront]) { m.userData.organId = 'skin'; group.add(m); }

  // ---- organs ----
  const geo = {
    sphere: new THREE.SphereGeometry(1, 20, 14),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 16, 1),
    torus: new THREE.TorusGeometry(1, 0.06, 6, 36),
  };
  const organGroup = new THREE.Group();
  organGroup.name = 'BodyV3Organs';
  const organMats = new Map<string, THREE.MeshStandardMaterial>();
  const organMeshList: THREE.Mesh[] = [];
  const organById = new Map<string, OrganSpec>();
  const interactive = new Set(options.interactiveOrgans ?? INTERACTIVE_ORGAN_IDS);
  const pickable: THREE.Mesh[] = [];
  if (options.organs !== false) {
    for (const o of ORGANS) {
      organById.set(o.id, o);
      const isKey = interactive.has(o.id);
      // non-interactive organs stay visible as dimmed context (they still count in the dose calculation)
      const op = isKey ? o.opacity : Math.min(o.opacity, 0.28);
      const mat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.55, metalness: 0.05, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
      organMats.set(o.id, mat);
      for (const m of organMeshes(o, frame, geo, mat)) {
        if (op < 1) m.renderOrder = o.layer === 'lung' ? 5 : 10;
        organGroup.add(m); organMeshList.push(m);
        if (isKey) pickable.push(m);
      }
    }
  }
  group.add(organGroup);

  let selectedOrgan: string | null = null;
  const tmp = new THREE.Vector3();

  // ---- axial slice plane (texture = CT slice canvas from utils/three/body/slice) ----
  const SLICE_FOV_CM = 50, SLICE_CY_CM = 23.5 - SLICE_FOV_CM / 2;
  const sliceMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const sliceGeo = new THREE.PlaneGeometry(SLICE_FOV_CM * frame.s, SLICE_FOV_CM * frame.s);
  const sliceMesh = new THREE.Mesh(sliceGeo, sliceMat);
  sliceMesh.name = 'BodyV3Slice';
  // image top row = anterior; anterior maps to local +Z * frame.anterior
  sliceMesh.rotation.x = (Math.PI / 2) * frame.anterior;
  sliceMesh.renderOrder = 40;
  sliceMesh.visible = false;
  // bright frame so the plane stays visible when seen almost edge-on
  const sliceFrame = new THREE.LineSegments(new THREE.EdgesGeometry(sliceGeo), new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, depthTest: false }));
  sliceFrame.renderOrder = 41;
  sliceMesh.add(sliceFrame);
  group.add(sliceMesh);
  let sliceTex: THREE.CanvasTexture | null = null;
  let sliceSrc: HTMLCanvasElement | null = null;

  return {
    group,
    frame,
    skinTriangles: (skinGeo.index?.count ?? 0) / 3,
    setSkinOpacity(v) { uniforms.uOpacity.value = clampSkinOpacity(v); },
    setRegionColors(colors) {
      REGION_IDS.forEach((r, i) => { uniforms.uRegionColor.value[i].copy(colors[r] ?? baseSkin); });
    },
    setHighlightRegion(r) { uniforms.uHighlight.value = r ? regionIndex(r) : -1; },
    setSelectedOrgan(id) {
      if (selectedOrgan) { const m = organMats.get(selectedOrgan); if (m) m.emissive.setHex(0x000000); }
      selectedOrgan = id;
      if (id) { const m = organMats.get(id); if (m) m.emissive.setHex(0x553311); }
    },
    setOrgansVisible(v) { organGroup.visible = v; },
    setSlice(zCm, source) {
      if (zCm === null) { sliceMesh.visible = false; return; }
      if (source !== undefined && source !== sliceSrc) {
        sliceTex?.dispose(); sliceTex = null; sliceSrc = source;
        if (source) { sliceTex = new THREE.CanvasTexture(source); sliceTex.colorSpace = THREE.SRGBColorSpace; sliceTex.magFilter = THREE.NearestFilter; }
        sliceMat.map = sliceTex; sliceMat.needsUpdate = true;
      }
      const [X, Y, Z] = cmToLocal(frame, 0, SLICE_CY_CM, zCm);
      sliceMesh.position.set(X, Y, Z);
      sliceMesh.visible = !!sliceTex;
    },
    refreshSliceTexture() { if (sliceTex) sliceTex.needsUpdate = true; },
    pick(raycaster) {
      const targets: THREE.Object3D[] = [skinFront];
      if (organGroup.visible) targets.push(...pickable);
      const hits = raycaster.intersectObjects(targets, false);
      if (!hits.length) return null;
      // Rays pass through the semi-transparent skin and translucent shells (e.g. skull around brain):
      // prefer the first opaque organ hit, else the first translucent one.
      const organHits = hits.filter((h) => h.object.userData.organId !== 'skin');
      const isOpaque = (h: THREE.Intersection) => (organById.get(h.object.userData.organId as string)?.opacity ?? 1) >= 1;
      const organHit = organHits.find(isOpaque) ?? organHits[0];
      if (organHit) {
        const o = organById.get(organHit.object.userData.organId as string)!;
        return { region: o.region, organId: o.id };
      }
      tmp.copy(hits[0].point); group.worldToLocal(tmp);
      const [x, , z] = localToCm(frame, tmp.x, tmp.y, tmp.z);
      return { region: regionOfSkinPoint(x, z), organId: null };
    },
    dispose() {
      skinGeo.dispose(); backMat.dispose(); preMat.dispose(); frontMat.dispose();
      geo.sphere.dispose(); geo.cyl.dispose(); geo.torus.dispose();
      organMats.forEach((m) => m.dispose());
      sliceGeo.dispose(); sliceMat.dispose(); sliceTex?.dispose(); sliceFrame.geometry.dispose(); (sliceFrame.material as THREE.Material).dispose();
    },
  };
}
