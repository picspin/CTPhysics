// Axial CT slice engines over the MOCK label volume (see ./volume.ts).
//  - WasmSliceEngine: thin wrapper over public/wasm/ct_kernel.wasm (AssemblyScript source: wasm/ct-kernel/assembly/index.ts).
//    Voxelises the whole 256x256x351 volume once inside WASM linear memory (~23 MB), then renders any z in ~1 ms.
//  - JsSliceEngine: pure-TS twin with identical arithmetic. Mobile-safe: it rasterises only the requested slice on demand
//    (64 kB per slice, small LRU cache), so it never allocates the full volume.
// Only numbers cross the JS/WASM boundary; results are read through typed-array views on wasm memory.
import { evalSection, COLS } from '../surface';
import { N, NN, NZ, MAXP, PSTRIDE, X0, Y0, PX, type SliceInit } from './volume';

export type SliceEngineKind = 'wasm' | 'js';
export interface SliceResult { hu: Int16Array; rgba: Uint8ClampedArray; labels: Uint8Array; ms: number }
export interface SliceEngine {
  kind: SliceEngineKind;
  /** render the axial slice at body z (cm from vertex). sel = label to highlight (0 = none) */
  render(z: number, ww: number, wl: number, sel: number, noise?: boolean): SliceResult;
  dispose(): void;
}

export const zToK = (z: number) => { let k = Math.floor(z * 2 + 0.5); if (k < 0) k = 0; if (k > NZ - 1) k = NZ - 1; return k; };

function hash32(n0: number): number {
  let n = (n0 ^ 61) ^ (n0 >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}

/** Rasterise one slice of the primitive table into `L` (length NN). Same algorithm as paintPrim() in the kernel. */
export function rasterizeSlice(d: SliceInit, k: number, L: Uint8Array): void {
  L.fill(0);
  const P = d.prims, K = d.kps, pe = [0, 0, 0, 0, 0], z = k * 0.5;
  const fillE = (cx: number, cy: number, rx: number, ry: number, id: number) => {
    if (!(rx > 0) || !(ry > 0)) return;
    let px0 = Math.floor((cx - rx - X0) / PX) - 1; if (px0 < 0) px0 = 0; let px1 = Math.floor((cx + rx - X0) / PX) + 1; if (px1 > N - 1) px1 = N - 1;
    let py0 = Math.floor((Y0 - (cy + ry)) / PX) - 1; if (py0 < 0) py0 = 0; let py1 = Math.floor((Y0 - (cy - ry)) / PX) + 1; if (py1 > N - 1) py1 = N - 1;
    for (let py = py0; py <= py1; py++) { const y = Y0 - (py + 0.5) * PX, dy = (y - cy) / ry;
      for (let px = px0; px <= px1; px++) { const x = X0 + (px + 0.5) * PX, dx = (x - cx) / rx; if (dx * dx + dy * dy > 1) continue; L[py * N + px] = id; } }
  };
  const fillA = (cx: number, cy: number, rx: number, ry: number, irx: number, iry: number, id: number) => {
    if (!(rx > 0) || !(ry > 0)) return;
    let px0 = Math.floor((cx - rx - X0) / PX) - 1; if (px0 < 0) px0 = 0; let px1 = Math.floor((cx + rx - X0) / PX) + 1; if (px1 > N - 1) px1 = N - 1;
    let py0 = Math.floor((Y0 - (cy + ry)) / PX) - 1; if (py0 < 0) py0 = 0; let py1 = Math.floor((Y0 - (cy - ry)) / PX) + 1; if (py1 > N - 1) py1 = N - 1;
    for (let py = py0; py <= py1; py++) { const y = Y0 - (py + 0.5) * PX, dy = (y - cy) / ry, ey = (y - cy) / iry;
      for (let px = px0; px <= px1; px++) { const x = X0 + (px + 0.5) * PX, dx = (x - cx) / rx; if (dx * dx + dy * dy > 1) continue; const ex = (x - cx) / irx; if (ex * ex + ey * ey < 1) continue; L[py * N + px] = id; } }
  };
  const fillB = (cx: number, cy: number, hx: number, hy: number, id: number) => {
    const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy;
    for (let py = 0; py < N; py++) { const y = Y0 - (py + 0.5) * PX; if (y < y0 || y > y1) continue;
      for (let px = 0; px < N; px++) { const x = X0 + (px + 0.5) * PX; if (x < x0 || x > x1) continue; L[py * N + px] = id; } }
  };
  const fillS = (cx: number, cy: number, rx: number, ry: number, sq: number, id: number) => {
    if (!(rx > 0) || !(ry > 0)) return;
    let px0 = Math.floor((cx - rx - X0) / PX) - 1; if (px0 < 0) px0 = 0; let px1 = Math.floor((cx + rx - X0) / PX) + 1; if (px1 > N - 1) px1 = N - 1;
    let py0 = Math.floor((Y0 - (cy + ry)) / PX) - 1; if (py0 < 0) py0 = 0; let py1 = Math.floor((Y0 - (cy - ry)) / PX) + 1; if (py1 > N - 1) py1 = N - 1;
    for (let py = py0; py <= py1; py++) { const y = Y0 - (py + 0.5) * PX, dy = (y - cy) / ry, v2 = dy * dy;
      for (let px = px0; px <= px1; px++) { const x = X0 + (px + 0.5) * PX, dx = (x - cx) / rx, u2 = dx * dx; if ((1 - sq) * (u2 + v2) + sq * (u2 * u2 + v2 * v2) > 1) continue; L[py * N + px] = id; } }
  };
  for (let pi = 0; pi < d.np; pi++) {
    const o = pi * PSTRIDE, kind = P[o] | 0, id = P[o + 1] | 0, cx = P[o + 2], cy = P[o + 3], rx = P[o + 4], ry = P[o + 5], z0 = P[o + 6], z1 = P[o + 7];
    if (kind === 1) { const zc = (z0 + z1) / 2, hz = (z1 - z0) / 2, u = (z - zc) / hz; if (Math.abs(u) < 1) { const f = Math.sqrt(1 - u * u); fillE(cx, cy, rx * f, ry * f, id); } }
    else if (kind === 2) { if (z >= z0 && z <= z1) fillE(cx, cy, rx, ry, id); }
    else if (kind === 3) { const wall = P[o + 8], zc = (z0 + z1) / 2, hz = (z1 - z0) / 2, u = (z - zc) / hz;
      if (Math.abs(u) < 1) { const f = Math.sqrt(1 - u * u), hin = hz - wall, u3 = (z - zc) / hin;
        if (Math.abs(u3) < 1) { const f3 = Math.sqrt(1 - u3 * u3); fillA(cx, cy, rx * f, ry * f, (rx - wall) * f3, (ry - wall) * f3, id); } else fillE(cx, cy, rx * f, ry * f, id); } }
    else if (kind === 4) { const pitch = P[o + 8], band = P[o + 9], t = P[o + 10]; if (z < z0 - band || z > z1 + band) continue;
      const i = Math.floor((z - z0) / pitch + 0.5), zi = z0 + i * pitch; if (i >= 0 && zi <= z1 + 1e-6 && Math.abs(z - zi) <= band / 2) fillA(cx, cy, rx, ry, rx - t, ry - t, id); }
    else if (kind === 5) { const pitch = P[o + 8], len = P[o + 9]; for (let q = 0; z0 + q * pitch + len <= z1 + 1e-6; q++) { const zk = z0 + q * pitch; if (z >= zk && z <= zk + len) { fillE(cx, cy, rx, ry, id); break; } } }
    else if (kind === 6) { const off = P[o + 8] | 0, n = P[o + 9] | 0, mode = P[o + 10] | 0; if (!evalSection(K, off, n, z, pe)) continue; const cxs = cx * pe[3];
      if (mode === 0) fillS(cxs, pe[2], pe[0], pe[1], pe[4], id);
      else { const f = z < P[o + 13] ? P[o + 11] : P[o + 12], ax = pe[0] - f, ay = pe[1] - f; if (ax > 0.2 && ay > 0.2) fillS(cxs, pe[2], ax, ay, pe[4], id); } }
    else if (kind === 7) { if (z >= z0 && z < z1) fillB(cx, cy, rx, ry, id); }
  }
}

/** Window a label slice to HU + RGBA. Same arithmetic as renderSlice() in the kernel (tint off). */
export function shadeSlice(d: SliceInit, k: number, L: Uint8Array, ww: number, wl: number, sel: number, noise: boolean, H: Int16Array, R: Uint8ClampedArray): void {
  const lo = wl - ww / 2;
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    const o = py * N + px, id = L[o]; let h = d.lutHU[id];
    if (noise) { const s = (Math.imul(px, 73856093) ^ Math.imul(py, 19349663) ^ Math.imul(k, 83492791)); const g = hash32(s) + hash32(s + 1) + hash32(s + 2) + hash32(s + 3) - 2; h += g * 13.86 * (id === 0 ? 0.15 : 1); }
    let hi = Math.floor(h + 0.5); if (hi < -32768) hi = -32768; if (hi > 32767) hi = 32767; H[o] = hi;
    let v = (hi - lo) / ww; if (v < 0) v = 0; if (v > 1) v = 1; const g8 = v * 255; let r = g8, gg = g8, b = g8;
    if (sel > 0 && id === sel) { r = g8 * 0.55 + 255 * 0.45; gg = g8 * 0.55 + 150 * 0.45; b = g8 * 0.55; }
    const q = o * 4; R[q] = Math.floor(r + 0.5); R[q + 1] = Math.floor(gg + 0.5); R[q + 2] = Math.floor(b + 0.5); R[q + 3] = 255;
  }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class JsSliceEngine implements SliceEngine {
  kind: SliceEngineKind = 'js';
  private cache = new Map<number, Uint8Array>();
  private hu = new Int16Array(NN);
  private rgba = new Uint8ClampedArray(NN * 4);
  constructor(private d: SliceInit, private cacheSize = 24) {}
  labelsAt(k: number): Uint8Array {
    let L = this.cache.get(k);
    if (L) { this.cache.delete(k); this.cache.set(k, L); return L; }
    L = new Uint8Array(NN); rasterizeSlice(this.d, k, L); this.cache.set(k, L);
    if (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value as number);
    return L;
  }
  render(z: number, ww: number, wl: number, sel: number, noise = false): SliceResult {
    const t0 = now(); const k = zToK(z); const L = this.labelsAt(k);
    shadeSlice(this.d, k, L, ww, wl, sel, noise, this.hu, this.rgba);
    return { hu: this.hu, rgba: this.rgba, labels: L, ms: now() - t0 };
  }
  dispose() { this.cache.clear(); }
}

interface KernelExports {
  memory: WebAssembly.Memory;
  dims(w: number): number; voxelize(np: number): void; renderSlice(z: number, ww: number, wl: number, sel: number, tint: number, noise: number): void;
  ptrLabels(): number; ptrPrims(): number; ptrKps(): number; ptrLutHU(): number; ptrLutReg(): number; ptrLutTis(): number;
  ptrPalette(): number; ptrHU(): number; ptrRGBA(): number; ptrWT(): number; ptrTisReg(): number;
}

export class WasmSliceEngine implements SliceEngine {
  kind: SliceEngineKind = 'wasm';
  voxelizeMs = 0;
  private x: KernelExports;
  private constructor(instance: WebAssembly.Instance, d: SliceInit) {
    const x = instance.exports as unknown as KernelExports; this.x = x;
    if (x.dims(0) !== N || x.dims(1) !== NZ || x.dims(2) !== MAXP || x.dims(3) !== PSTRIDE) throw new Error('wasm/JS dimension mismatch');
    const buf = x.memory.buffer;
    new Float64Array(buf, x.ptrPrims(), MAXP * PSTRIDE).set(d.prims);
    new Float64Array(buf, x.ptrKps(), 2048 * COLS).set(d.kps);
    new Float64Array(buf, x.ptrLutHU(), 256).set(d.lutHU);
    new Uint8Array(buf, x.ptrLutReg(), 256).set(d.lutReg);
    new Uint8Array(buf, x.ptrLutTis(), 256).set(d.lutTis);
    new Uint8Array(buf, x.ptrPalette(), 24).set(d.palette);
    new Float64Array(buf, x.ptrWT(), 64).set(d.wT);
    new Uint8Array(buf, x.ptrTisReg(), 64).set(d.tisReg);
    const t0 = now(); x.voxelize(d.np); this.voxelizeMs = now() - t0;
  }
  static async fromBytes(bytes: BufferSource, d: SliceInit): Promise<WasmSliceEngine> {
    const { instance } = await WebAssembly.instantiate(bytes, { env: { abort(_m: number, _f: number, line: number, col: number) { throw new Error(`wasm abort ${line}:${col}`); } } });
    return new WasmSliceEngine(instance, d);
  }
  render(z: number, ww: number, wl: number, sel: number, noise = false): SliceResult {
    const t0 = now(); const x = this.x; x.renderSlice(z, ww, wl, sel, 0, noise ? 1 : 0); const ms = now() - t0;
    const buf = x.memory.buffer, k = zToK(z);
    return { hu: new Int16Array(buf, x.ptrHU(), NN), rgba: new Uint8ClampedArray(buf, x.ptrRGBA(), NN * 4), labels: new Uint8Array(buf, x.ptrLabels() + k * NN, NN), ms };
  }
  dispose() { /* instance is GC'd with the engine */ }
}

/** Lazy factory: tries WASM unless `prefer` is 'js' or the device looks memory-constrained; falls back to JS on any error. */
export async function createSliceEngine(d: SliceInit, opts: { prefer?: SliceEngineKind; url?: string } = {}): Promise<{ engine: SliceEngine; fallbackReason?: string }> {
  if (opts.prefer === 'js') return { engine: new JsSliceEngine(d) };
  try {
    if (typeof WebAssembly === 'undefined') throw new Error('WebAssembly unavailable');
    const res = await fetch(opts.url ?? '/wasm/ct_kernel.wasm');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { engine: await WasmSliceEngine.fromBytes(await res.arrayBuffer(), d) };
  } catch (e) {
    return { engine: new JsSliceEngine(d), fallbackReason: String((e as Error)?.message ?? e) };
  }
}

/** Heuristic for the default engine: phones / low-memory devices use the on-demand JS engine (no 23 MB volume). */
export function preferredEngine(): SliceEngineKind {
  if (typeof window === 'undefined') return 'js';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small = window.matchMedia?.('(max-width: 768px)').matches;
  if (small || (nav.deviceMemory !== undefined && nav.deviceMemory < 4)) return 'js';
  return 'wasm';
}
