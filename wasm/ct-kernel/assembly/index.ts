// CTPhysics v3 — mock-volume kernel (AssemblyScript -> WebAssembly).
// EVERYTHING here computes on MOCK geometry (analytic ellipsoids / tubes rasterised to a label volume).
// JS <-> WASM boundary: JS writes primitive table + look-up tables into linear memory through the
// pointers exported below, calls the functions, and reads results through typed-array views.
// No JS objects cross the boundary; every call is plain numbers (scalars / pointers).

const N: i32 = 256;          // slice is N x N pixels
const NN: i32 = 65536;       // N*N
const NZ: i32 = 351;         // z = k * 0.5 cm, k = 0..350  (0 .. 175 cm)
const MAXP: i32 = 512;       // max primitives
const PSTRIDE: i32 = 16;     // f64 per primitive record
const COLS: i32 = 6;         // f64 per body-surface section row
const FOV: f64 = 50.0;
const X0: f64 = -25.0;
const Y0: f64 = 23.5;
const PX: f64 = FOV / 256.0;

let labels = new StaticArray<u8>(NN * NZ);          // label volume, index = k*NN + py*N + px
let prims = new StaticArray<f64>(MAXP * PSTRIDE);
let kps = new StaticArray<f64>(2048 * COLS);        // body-surface section rows: z, rx, ry, cy, kx, sq (see src/body-surface.js)
let lutHU = new StaticArray<f64>(256);              // label -> mock HU
let lutReg = new StaticArray<u8>(256);              // label -> dose region (0 = unassigned)
let lutTis = new StaticArray<u8>(256);              // label -> ICRP 103 tissue index (kept for buffer layout; dose is computed in utils/organ-dose.ts)
let palette = new StaticArray<u8>(8 * 3);           // dose-region colours
let hu = new StaticArray<i16>(NN);                  // current slice HU
let rgba = new StaticArray<u8>(NN * 4);             // current slice, windowed RGBA
let counts = new StaticArray<u32>(256);             // voxels per label in current slice
let cnt = new StaticArray<u32>(256 * NZ);           // voxels per label per slice
let roiOut = new StaticArray<f64>(8);
let profVal = new StaticArray<f64>(1024);
let profLab = new StaticArray<u8>(1024);
let wTarr = new StaticArray<f64>(64);
let tisReg = new StaticArray<u8>(64);

export function ptrLabels(): usize { return changetype<usize>(labels); }
export function ptrPrims(): usize { return changetype<usize>(prims); }
export function ptrKps(): usize { return changetype<usize>(kps); }
export function ptrLutHU(): usize { return changetype<usize>(lutHU); }
export function ptrLutReg(): usize { return changetype<usize>(lutReg); }
export function ptrLutTis(): usize { return changetype<usize>(lutTis); }
export function ptrPalette(): usize { return changetype<usize>(palette); }
export function ptrHU(): usize { return changetype<usize>(hu); }
export function ptrRGBA(): usize { return changetype<usize>(rgba); }
export function ptrCounts(): usize { return changetype<usize>(counts); }
export function ptrRoi(): usize { return changetype<usize>(roiOut); }
export function ptrProfVal(): usize { return changetype<usize>(profVal); }
export function ptrProfLab(): usize { return changetype<usize>(profLab); }
export function ptrWT(): usize { return changetype<usize>(wTarr); }
export function ptrTisReg(): usize { return changetype<usize>(tisReg); }
export function dims(which: i32): i32 { return which == 0 ? N : which == 1 ? NZ : which == 2 ? MAXP : PSTRIDE; }

@inline function hash32(n0: i32): f64 {
  let n: i32 = (n0 ^ 61) ^ (n0 >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = n * 0x27d4eb2d;
  n = n ^ (n >>> 15);
  return <f64>(<u32>n) / 4294967296.0;
}

function fillE(base: i32, cx: f64, cy: f64, rx: f64, ry: f64, id: u8): void {
  if (!(rx > 0.0) || !(ry > 0.0)) return;
  let px0 = <i32>Math.floor((cx - rx - X0) / PX) - 1; if (px0 < 0) px0 = 0;
  let px1 = <i32>Math.floor((cx + rx - X0) / PX) + 1; if (px1 > N - 1) px1 = N - 1;
  let py0 = <i32>Math.floor((Y0 - (cy + ry)) / PX) - 1; if (py0 < 0) py0 = 0;
  let py1 = <i32>Math.floor((Y0 - (cy - ry)) / PX) + 1; if (py1 > N - 1) py1 = N - 1;
  for (let py = py0; py <= py1; py++) {
    let y = Y0 - (<f64>py + 0.5) * PX;
    let dy = (y - cy) / ry;
    for (let px = px0; px <= px1; px++) {
      let x = X0 + (<f64>px + 0.5) * PX;
      let dx = (x - cx) / rx;
      if (dx * dx + dy * dy > 1.0) continue;
      unchecked(labels[base + py * N + px] = id);
    }
  }
}

function fillA(base: i32, cx: f64, cy: f64, rx: f64, ry: f64, irx: f64, iry: f64, id: u8): void {
  if (!(rx > 0.0) || !(ry > 0.0)) return;
  let px0 = <i32>Math.floor((cx - rx - X0) / PX) - 1; if (px0 < 0) px0 = 0;
  let px1 = <i32>Math.floor((cx + rx - X0) / PX) + 1; if (px1 > N - 1) px1 = N - 1;
  let py0 = <i32>Math.floor((Y0 - (cy + ry)) / PX) - 1; if (py0 < 0) py0 = 0;
  let py1 = <i32>Math.floor((Y0 - (cy - ry)) / PX) + 1; if (py1 > N - 1) py1 = N - 1;
  for (let py = py0; py <= py1; py++) {
    let y = Y0 - (<f64>py + 0.5) * PX;
    let dy = (y - cy) / ry;
    let ey = (y - cy) / iry;
    for (let px = px0; px <= px1; px++) {
      let x = X0 + (<f64>px + 0.5) * PX;
      let dx = (x - cx) / rx;
      if (dx * dx + dy * dy > 1.0) continue;
      let ex = (x - cx) / irx;
      if (ex * ex + ey * ey < 1.0) continue;
      unchecked(labels[base + py * N + px] = id);
    }
  }
}

function fillB(base: i32, cx: f64, cy: f64, hx: f64, hy: f64, id: u8): void {
  let x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy;
  for (let py = 0; py < N; py++) {
    let y = Y0 - (<f64>py + 0.5) * PX;
    if (y < y0 || y > y1) continue;
    for (let px = 0; px < N; px++) {
      let x = X0 + (<f64>px + 0.5) * PX;
      if (x < x0 || x > x1) continue;
      unchecked(labels[base + py * N + px] = id);
    }
  }
}

// ---- body surface (v3.1): section curves -> monotone cubic Hermite (PCHIP) interpolation; same code as src/body-surface.js ----
let pe_rx: f64 = 0.0; let pe_ry: f64 = 0.0; let pe_cy: f64 = 0.0; let pe_kx: f64 = 0.0; let pe_sq: f64 = 0.0;
@inline function kat(off: i32, j: i32, c: i32): f64 { return unchecked(kps[(off + j) * COLS + c]); }
function tangentAt(off: i32, n: i32, i: i32, c: i32): f64 {
  if (i == 0) return (kat(off, 1, c) - kat(off, 0, c)) / (kat(off, 1, 0) - kat(off, 0, 0));
  if (i == n - 1) return (kat(off, n - 1, c) - kat(off, n - 2, c)) / (kat(off, n - 1, 0) - kat(off, n - 2, 0));
  let h0 = kat(off, i, 0) - kat(off, i - 1, 0); let h1 = kat(off, i + 1, 0) - kat(off, i, 0);
  let d0 = (kat(off, i, c) - kat(off, i - 1, c)) / h0; let d1 = (kat(off, i + 1, c) - kat(off, i, c)) / h1;
  if (d0 * d1 <= 0.0) return 0.0;
  let w1 = 2.0 * h1 + h0; let w2 = h1 + 2.0 * h0;
  return (w1 + w2) / (w1 / d0 + w2 / d1);
}
function evalSection(off: i32, n: i32, z: f64): bool {
  let last = n - 1;
  if (z <= kat(off, 0, 0) || z >= kat(off, last, 0)) return false;
  let i = 0;
  for (let j = 0; j < n - 1; j++) { if (z >= kat(off, j, 0) && z <= kat(off, j + 1, 0)) { i = j; break; } }
  let za = kat(off, i, 0); let zb = kat(off, i + 1, 0); let h = zb - za; let u = (z - za) / h;
  let u2 = u * u; let u3 = u2 * u;
  let h00 = 2.0 * u3 - 3.0 * u2 + 1.0; let h10 = u3 - 2.0 * u2 + u; let h01 = -2.0 * u3 + 3.0 * u2; let h11 = u3 - u2;
  let r0 = 0.0; let r1 = 0.0; let r2 = 0.0; let r3 = 0.0; let r4 = 0.0;
  for (let c = 1; c < COLS; c++) {
    let va = kat(off, i, c); let vb = kat(off, i + 1, c);
    let v = h00 * va + h10 * h * tangentAt(off, n, i, c) + h01 * vb + h11 * h * tangentAt(off, n, i + 1, c);
    if (c == 1) r0 = v; else if (c == 2) r1 = v; else if (c == 3) r2 = v; else if (c == 4) r3 = v; else r4 = v;
  }
  if (r0 < 0.0) r0 = 0.0; if (r1 < 0.0) r1 = 0.0;
  if (r4 < 0.0) r4 = 0.0; if (r4 > 1.0) r4 = 1.0;
  pe_rx = r0; pe_ry = r1; pe_cy = r2; pe_kx = r3; pe_sq = r4;
  return true;
}
// super-ellipse fill: (1-sq)(u^2+v^2) + sq(u^4+v^4) <= 1 (sq = 0 is an ellipse)
function fillS(base: i32, cx: f64, cy: f64, rx: f64, ry: f64, sq: f64, id: u8): void {
  if (!(rx > 0.0) || !(ry > 0.0)) return;
  let px0 = <i32>Math.floor((cx - rx - X0) / PX) - 1; if (px0 < 0) px0 = 0;
  let px1 = <i32>Math.floor((cx + rx - X0) / PX) + 1; if (px1 > N - 1) px1 = N - 1;
  let py0 = <i32>Math.floor((Y0 - (cy + ry)) / PX) - 1; if (py0 < 0) py0 = 0;
  let py1 = <i32>Math.floor((Y0 - (cy - ry)) / PX) + 1; if (py1 > N - 1) py1 = N - 1;
  for (let py = py0; py <= py1; py++) {
    let y = Y0 - (<f64>py + 0.5) * PX;
    let dy = (y - cy) / ry; let v2 = dy * dy;
    for (let px = px0; px <= px1; px++) {
      let x = X0 + (<f64>px + 0.5) * PX;
      let dx = (x - cx) / rx; let u2 = dx * dx;
      if ((1.0 - sq) * (u2 + v2) + sq * (u2 * u2 + v2 * v2) > 1.0) continue;
      unchecked(labels[base + py * N + px] = id);
    }
  }
}

// primitive record: [0]kind [1]label [2]cx [3]cy [4]rx [5]ry [6]z0 [7]z1 [8..13] params
// kinds: 1 ellipsoid, 2 elliptic cylinder, 3 ellipsoid shell(p8=wall), 4 rings(p8 pitch,p9 band,p10 t),
//        5 stacked vertebrae(p8 pitch,p9 len), 6 body-surface loft (p2 = side sign, p8 row offset,p9 row count,p10 mode 0 outer/1 inset,
//        p11 inset below p13, p12 inset from p13 on, p13 z of change), 7 box (z0<=z<z1)
function paintPrim(pi: i32, z: f64, base: i32): void {
  let o = pi * PSTRIDE;
  let kind = <i32>unchecked(prims[o]);
  let id = <u8>(<i32>unchecked(prims[o + 1]));
  let cx = unchecked(prims[o + 2]); let cy = unchecked(prims[o + 3]);
  let rx = unchecked(prims[o + 4]); let ry = unchecked(prims[o + 5]);
  let z0 = unchecked(prims[o + 6]); let z1 = unchecked(prims[o + 7]);
  if (kind == 1) {
    let zc = (z0 + z1) / 2.0; let hz = (z1 - z0) / 2.0; let u = (z - zc) / hz;
    if (Math.abs(u) < 1.0) { let f = Math.sqrt(1.0 - u * u); fillE(base, cx, cy, rx * f, ry * f, id); }
  } else if (kind == 2) {
    if (z >= z0 && z <= z1) fillE(base, cx, cy, rx, ry, id);
  } else if (kind == 3) {
    let wall = unchecked(prims[o + 8]);
    let zc = (z0 + z1) / 2.0; let hz = (z1 - z0) / 2.0; let u = (z - zc) / hz;
    if (Math.abs(u) < 1.0) {
      let f = Math.sqrt(1.0 - u * u);
      let hin = hz - wall; let u3 = (z - zc) / hin;
      if (Math.abs(u3) < 1.0) { let f3 = Math.sqrt(1.0 - u3 * u3); fillA(base, cx, cy, rx * f, ry * f, (rx - wall) * f3, (ry - wall) * f3, id); }
      else fillE(base, cx, cy, rx * f, ry * f, id);
    }
  } else if (kind == 4) {
    let pitch = unchecked(prims[o + 8]); let band = unchecked(prims[o + 9]); let t = unchecked(prims[o + 10]);
    if (z < z0 - band || z > z1 + band) return;
    let i = <i32>Math.floor((z - z0) / pitch + 0.5); let zi = z0 + <f64>i * pitch;
    if (i >= 0 && zi <= z1 + 1e-6 && Math.abs(z - zi) <= band / 2.0) fillA(base, cx, cy, rx, ry, rx - t, ry - t, id);
  } else if (kind == 5) {
    let pitch = unchecked(prims[o + 8]); let len = unchecked(prims[o + 9]);
    for (let k = 0; z0 + <f64>k * pitch + len <= z1 + 1e-6; k++) {
      let zk = z0 + <f64>k * pitch;
      if (z >= zk && z <= zk + len) { fillE(base, cx, cy, rx, ry, id); break; }
    }
  } else if (kind == 6) {
    let off = <i32>unchecked(prims[o + 8]); let n = <i32>unchecked(prims[o + 9]); let mode = <i32>unchecked(prims[o + 10]);
    if (!evalSection(off, n, z)) return;
    let cxs = cx * pe_kx;
    if (mode == 0) fillS(base, cxs, pe_cy, pe_rx, pe_ry, pe_sq, id);
    else {
      let f = z < unchecked(prims[o + 13]) ? unchecked(prims[o + 11]) : unchecked(prims[o + 12]);
      let ax = pe_rx - f; let ay = pe_ry - f;
      if (ax > 0.2 && ay > 0.2) fillS(base, cxs, pe_cy, ax, ay, pe_sq, id);
    }
  } else if (kind == 7) {
    if (z >= z0 && z < z1) fillB(base, cx, cy, rx, ry, id);
  }
}

// (a) rasterise the primitive table into the label volume; later primitives overwrite earlier ones.
export function voxelize(np: i32): void {
  memory.fill(changetype<usize>(labels), 0, <usize>(NN * NZ));
  memory.fill(changetype<usize>(cnt), 0, <usize>(256 * NZ * 4));
  for (let k = 0; k < NZ; k++) {
    let z = <f64>k * 0.5; let base = k * NN;
    for (let p = 0; p < np; p++) paintPrim(p, z, base);
    for (let i = 0; i < NN; i++) { let l = <i32>unchecked(labels[base + i]); unchecked(cnt[l * NZ + k] += 1); }
  }
}

// (a) axial slice at z -> HU (Int16) + windowed RGBA. sel: label to highlight (0 none); tint: 1 = dose-region tint; noise: 1 = add synthetic noise
export function renderSlice(z: f64, ww: f64, wl: f64, sel: i32, tint: i32, noise: i32): void {
  let k = <i32>Math.floor(z * 2.0 + 0.5); if (k < 0) k = 0; if (k > NZ - 1) k = NZ - 1;
  let base = k * NN; let lo = wl - ww / 2.0;
  memory.fill(changetype<usize>(counts), 0, 1024);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      let o = py * N + px;
      let id = <i32>unchecked(labels[base + o]);
      let h = unchecked(lutHU[id]);
      if (noise != 0) {
        let s: i32 = (px * 73856093) ^ (py * 19349663) ^ (k * 83492791);
        let g = hash32(s) + hash32(s + 1) + hash32(s + 2) + hash32(s + 3) - 2.0;
        h += g * 13.86 * (id == 0 ? 0.15 : 1.0);
      }
      let hi = <i32>Math.floor(h + 0.5); if (hi < -32768) hi = -32768; if (hi > 32767) hi = 32767;
      unchecked(hu[o] = <i16>hi);
      unchecked(counts[id] += 1);
      let v = (<f64>hi - lo) / ww; if (v < 0.0) v = 0.0; if (v > 1.0) v = 1.0;
      let g8 = v * 255.0; let r = g8; let gg = g8; let b = g8;
      if (sel > 0 && id == sel) { r = g8 * 0.55 + 255.0 * 0.45; gg = g8 * 0.55 + 150.0 * 0.45; b = g8 * 0.55; }
      else if (tint != 0) {
        let rg = <i32>unchecked(lutReg[id]);
        if (rg > 0 && rg < 8) {
          r = r * 0.62 + <f64>unchecked(palette[rg * 3]) * 0.38; gg = gg * 0.62 + <f64>unchecked(palette[rg * 3 + 1]) * 0.38; b = b * 0.62 + <f64>unchecked(palette[rg * 3 + 2]) * 0.38;
        }
      }
      let q = o * 4;
      unchecked(rgba[q] = <u8>(<i32>Math.floor(r + 0.5)));
      unchecked(rgba[q + 1] = <u8>(<i32>Math.floor(gg + 0.5)));
      unchecked(rgba[q + 2] = <u8>(<i32>Math.floor(b + 0.5)));
      unchecked(rgba[q + 3] = 255);
    }
  }
}

// (b) ROI statistics on the current slice: circle centre (cx,cy) in pixel coordinates, radius in pixels -> [n, mean, sd, min, max]
export function roiStats(cx: f64, cy: f64, r: f64): void {
  let n: f64 = 0.0; let s: f64 = 0.0; let s2: f64 = 0.0; let mn: f64 = 1e9; let mx: f64 = -1e9;
  let x0 = <i32>Math.floor(cx - r) - 1; if (x0 < 0) x0 = 0;
  let x1 = <i32>Math.floor(cx + r) + 1; if (x1 > N - 1) x1 = N - 1;
  let y0 = <i32>Math.floor(cy - r) - 1; if (y0 < 0) y0 = 0;
  let y1 = <i32>Math.floor(cy + r) + 1; if (y1 > N - 1) y1 = N - 1;
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    let dx = <f64>px + 0.5 - cx; let dy = <f64>py + 0.5 - cy;
    if (dx * dx + dy * dy > r * r) continue;
    let v = <f64>unchecked(hu[py * N + px]);
    n += 1.0; s += v; s2 += v * v; if (v < mn) mn = v; if (v > mx) mx = v;
  }
  let mean = n > 0.0 ? s / n : 0.0;
  let varr = n > 1.0 ? (s2 - n * mean * mean) / (n - 1.0) : 0.0; if (varr < 0.0) varr = 0.0;
  unchecked(roiOut[0] = n); unchecked(roiOut[1] = mean); unchecked(roiOut[2] = Math.sqrt(varr));
  unchecked(roiOut[3] = n > 0.0 ? mn : 0.0); unchecked(roiOut[4] = n > 0.0 ? mx : 0.0);
}

// (b) HU profile along a ray inside the current slice (pixel coordinates), nearest-pixel sampling, n <= 1024 samples
export function lineProfile(x0: f64, y0: f64, x1: f64, y1: f64, n: i32): void {
  if (n > 1024) n = 1024; if (n < 2) n = 2;
  for (let i = 0; i < n; i++) {
    let t = <f64>i / <f64>(n - 1);
    let x = x0 + (x1 - x0) * t; let y = y0 + (y1 - y0) * t;
    let px = <i32>Math.floor(x); let py = <i32>Math.floor(y);
    if (px < 0) px = 0; if (px > N - 1) px = N - 1; if (py < 0) py = 0; if (py > N - 1) py = N - 1;
    unchecked(profVal[i] = <f64>unchecked(hu[py * N + px]));
  }
}
export function lineProfileLabels(x0: f64, y0: f64, x1: f64, y1: f64, n: i32, z: f64): void {
  if (n > 1024) n = 1024; if (n < 2) n = 2;
  let k = <i32>Math.floor(z * 2.0 + 0.5); if (k < 0) k = 0; if (k > NZ - 1) k = NZ - 1;
  for (let i = 0; i < n; i++) {
    let t = <f64>i / <f64>(n - 1);
    let px = <i32>Math.floor(x0 + (x1 - x0) * t); let py = <i32>Math.floor(y0 + (y1 - y0) * t);
    if (px < 0) px = 0; if (px > N - 1) px = N - 1; if (py < 0) py = 0; if (py > N - 1) py = N - 1;
    unchecked(profLab[i] = unchecked(labels[k * NN + py * N + px]));
  }
}

