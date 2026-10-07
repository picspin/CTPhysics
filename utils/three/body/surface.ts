/* eslint-disable */
// Ported from the CTPhysics 3D prototype v3.1 (src/body-surface.js).
// PROCEDURAL MOCK body surface: ONE set of cross-section curves drives the lofted skin mesh.
// Nothing here is real anatomy or anthropometric data: hand-tuned teaching proportions for a ~175 cm adult.
// Coordinates in cm: x patient LEFT is +x, y anterior is +y, z from the top of the head toward the feet.
// A section row is [z, rx, ry, cy, kx, sq]: semi-axes, centre y, lateral offset (mirrored by sgn), squareness 0..1.
// Rows are interpolated with monotone cubic Hermite (PCHIP), so the silhouette is C1-smooth with no overshoot.
export const COLS = 6;

// dome rows at the start of a part: radius grows like a sphere cap over height h (z0 is the pole)
function dome(z0: number, h: number, rx: number, ry: number, cy: number, kx: number, sq: number, fr: number[]): number[][] {
  return fr.map((f: number) => { const u = 1 - f, r = Math.sqrt(1 - u * u); return [z0 + f * h, rx * r, ry * r, cy, kx, sq]; });
}

export type PartKind = 'body' | 'arm' | 'leg';
export const SECTION_ROWS: Record<PartKind, number[][]> = {
  // head, neck, trunk (one lofted tube; nose and ears are separate small ellipsoids in model.js)
  body: [
    ...dome(0, 10.5, 8.0, 9.6, 1.2, 0, 0, [0, 0.02, 0.08, 0.18, 0.32, 0.5, 0.72]),
    [10.5, 8.0, 9.6, 1.2, 0, 0], [14, 7.8, 9.4, 1.1, 0, 0], [17, 7.0, 8.6, 1.8, 0, 0], [19.5, 6.0, 7.4, 2.4, 0, 0], [21.3, 4.9, 6.0, 2.6, 0, 0],
    [22.6, 4.2, 5.6, 1.4, 0, 0], [24, 5.1, 5.9, -0.6, 0, 0], [28, 5.5, 6.0, -0.7, 0, 0],
    [30.5, 7.8, 7.0, -0.9, 0, 0.1], [32.5, 11.8, 8.2, -0.6, 0, 0.2], [34.5, 14.6, 9.2, -0.2, 0, 0.3],
    [38, 16.0, 10.2, 0.2, 0, 0.35], [46, 16.3, 10.9, 0.4, 0, 0.35], [54, 16.0, 11.0, 0.5, 0, 0.3], [62, 15.0, 10.8, 0.4, 0, 0.25],
    [71, 14.4, 10.2, 0.3, 0, 0.25], [80, 15.0, 10.4, 0.0, 0, 0.25], [90, 16.3, 11.0, -0.3, 0, 0.3], [97, 16.6, 11.3, -0.4, 0, 0.3],
    [103, 15.0, 10.0, 0.0, 0, 0.3], [106, 11.0, 8.0, 0.2, 0, 0.2], [107.6, 6.5, 5.0, 0.2, 0, 0], [108.6, 3.0, 2.4, 0.2, 0, 0], [109, 0, 0, 0.2, 0, 0]
  ],
  // one arm (hanging at the side, palm toward the thigh); mirrored with sgn = +1 / -1
  arm: [
    [32.3, 0, 0, -2.5, 17.0, 0], [32.9, 2.4, 2.9, -2.6, 17.8, 0], [34, 3.8, 4.6, -2.8, 18.9, 0], [36.5, 4.6, 5.2, -3.3, 19.9, 0],
    [41, 4.4, 5.0, -3.6, 20.4, 0], [50, 4.0, 4.6, -3.9, 20.5, 0], [58, 3.6, 4.0, -4.0, 20.7, 0], [65, 3.3, 3.6, -4.1, 20.7, 0],
    [71, 3.5, 3.9, -4.3, 21.0, 0], [80, 3.0, 3.2, -4.5, 21.6, 0], [90, 2.2, 2.2, -4.6, 22.1, 0],
    [91.5, 2.0, 2.4, -4.7, 22.3, 0], [94, 1.7, 4.0, -4.8, 22.5, 0], [100, 1.6, 4.2, -5.0, 22.6, 0], [106, 1.4, 3.6, -5.0, 22.6, 0],
    [109.5, 0.9, 2.0, -5.0, 22.6, 0], [110.6, 0, 0, -5.0, 22.6, 0]
  ],
  // one leg incl. the foot (supine: toes point anteriorly, so the foot sections stretch along +y)
  leg: [
    [88, 0, 0, -3.0, 8.6, 0], [89, 4.5, 5.0, -3.0, 8.6, 0], [91, 7.0, 7.6, -3.0, 8.7, 0], [96, 8.3, 8.8, -3.2, 8.8, 0],
    [104, 8.5, 8.8, -3.2, 8.9, 0], [114, 7.6, 7.8, -3.1, 9.0, 0], [124, 5.9, 6.0, -3.0, 9.1, 0], [127, 5.3, 5.4, -3.2, 9.2, 0],
    [135, 5.3, 6.0, -4.2, 9.4, 0], [141, 5.4, 6.3, -4.6, 9.5, 0], [152, 4.5, 5.2, -4.4, 9.5, 0], [162, 3.5, 4.2, -4.2, 9.6, 0],
    [167, 3.2, 3.6, -4.0, 9.6, 0], [169.5, 3.5, 4.4, -2.6, 9.7, 0], [172, 4.0, 7.5, 0.8, 9.8, 0], [174, 4.2, 10.0, 3.5, 9.8, 0],
    [175.1, 3.8, 9.2, 4.2, 9.8, 0], [175.5, 0, 0, 4.2, 9.8, 0]
  ]
};

// ---- evaluation on a flat Float64Array table (the same layout the kernels use: COLS doubles per row) ----
function tangent(K: Float64Array, off: number, n: number, i: number, c: number): number {
  const at = (j: number) => K[(off + j) * COLS];
  const v = (j: number) => K[(off + j) * COLS + c];
  if (i === 0) return (v(1) - v(0)) / (at(1) - at(0));
  if (i === n - 1) return (v(n - 1) - v(n - 2)) / (at(n - 1) - at(n - 2));
  const h0 = at(i) - at(i - 1), h1 = at(i + 1) - at(i);
  const d0 = (v(i) - v(i - 1)) / h0, d1 = (v(i + 1) - v(i)) / h1;
  if (d0 * d1 <= 0) return 0;
  const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
  return (w1 + w2) / (w1 / d0 + w2 / d1);
}
// out = [rx, ry, cy, kx, sq]; returns false outside (z0, zLast)
export function evalSection(K: Float64Array, off: number, n: number, z: number, out: number[]): boolean {
  const last = off + n - 1;
  if (z <= K[off * COLS] || z >= K[last * COLS]) return false;
  let i = 0;
  for (let j = 0; j < n - 1; j++) { if (z >= K[(off + j) * COLS] && z <= K[(off + j + 1) * COLS]) { i = j; break; } }
  const za = K[(off + i) * COLS], zb = K[(off + i + 1) * COLS], h = zb - za, u = (z - za) / h;
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (let c = 1; c < COLS; c++) {
    const va = K[(off + i) * COLS + c], vb = K[(off + i + 1) * COLS + c];
    out[c - 1] = h00 * va + h10 * h * tangent(K, off, n, i, c) + h01 * vb + h11 * h * tangent(K, off, n, i + 1, c);
  }
  if (out[0] < 0) out[0] = 0; if (out[1] < 0) out[1] = 0;
  if (out[4] < 0) out[4] = 0; if (out[4] > 1) out[4] = 1;
  return true;
}

// flat table of all three part types + offsets (shared by the kernel input and by the mesh loft)
export interface SurfaceTable { kps: Float64Array; off: Record<PartKind, [number, number]>; nk: number }
export function buildTable(): SurfaceTable {
  const names: PartKind[] = ['body', 'arm', 'leg']; let nk = 0; const off = {} as Record<PartKind, [number, number]>; const kps = new Float64Array(2048 * COLS);
  names.forEach((k) => { off[k] = [nk, SECTION_ROWS[k].length]; SECTION_ROWS[k].forEach((r) => { kps.set(r, nk * COLS); nk++; }); });
  return { kps, off, nk };
}
const TABLE = buildTable();
export const SURFACE_TABLE = TABLE;

// boundary point of the section in direction angle a (relative to the centre), for the mesh; same shape law as the voxel test
export function sectionPoint(rx: number, ry: number, sq: number, a: number): [number, number] {
  const c = Math.cos(a), s = Math.sin(a), q = c * c * c * c + s * s * s * s, A = sq * q, B = 1 - sq;
  const t2 = A > 1e-9 ? (-B + Math.sqrt(B * B + 4 * A)) / (2 * A) : 1 / B, t = Math.sqrt(t2);
  return [rx * t * c, ry * t * s];
}

// Ring z-list of a part: every key row plus extra rings so no gap is wider than `step` cm.
export function ringZs(kind: PartKind, step: number): number[] {
  const rows = SECTION_ROWS[kind], zs: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i][0], b = rows[i + 1][0], n = Math.max(1, Math.ceil((b - a) / step));
    for (let j = 0; j < n; j++) zs.push(a + (b - a) * j / n);
  }
  zs.push(rows[rows.length - 1][0]); return zs;
}
// Lofted triangle mesh of one part (outward-facing winding). Returns plain arrays so this file stays DOM-free.
export interface Loft { pos: Float32Array; idx: Uint32Array; zs: number[]; M: number }
export function buildLoft(kind: PartKind, sgn: number, M: number, step: number): Loft {
  const [off, n] = TABLE.off[kind], zs = ringZs(kind, step), out = [0, 0, 0, 0, 0], pos = new Float32Array(zs.length * M * 3), idx: number[] = [];
  zs.forEach((z, r) => {
    let e: number[];
    if (!evalSection(TABLE.kps, off, n, z, out)) { const row = SECTION_ROWS[kind][z <= SECTION_ROWS[kind][0][0] ? 0 : n - 1]; e = [0, 0, row[3], row[4], 0]; } else e = out;
    for (let m = 0; m < M; m++) { const p = sectionPoint(e[0], e[1], e[4], m / M * Math.PI * 2); const o = (r * M + m) * 3; pos[o] = sgn * e[3] + p[0]; pos[o + 1] = e[2] + p[1]; pos[o + 2] = z; }
  });
  for (let r = 0; r < zs.length - 1; r++) for (let m = 0; m < M; m++) {
    const a = r * M + m, b = r * M + (m + 1) % M, c = (r + 1) * M + m, d = (r + 1) * M + (m + 1) % M;
    idx.push(a, b, c, b, d, c);
  }
  return { pos, idx: new Uint32Array(idx), zs, M };
}
export const PART_Z = (kind: PartKind): [number, number] => [SECTION_ROWS[kind][0][0], SECTION_ROWS[kind][SECTION_ROWS[kind].length - 1][0]];

// Small closed ellipsoid (nose, ears) with the same ring layout / winding as buildLoft. Mesh only (the voxel side uses primitive kind 1).
export function buildEllipsoid(cx: number, cy: number, rx: number, ry: number, z0: number, z1: number, M: number, H: number): { pos: Float32Array; idx: Uint32Array } {
  const pos = new Float32Array((H + 1) * M * 3), idx: number[] = []; const zc = (z0 + z1) / 2, hz = (z1 - z0) / 2;
  for (let j = 0; j <= H; j++) { const u = -1 + 2 * j / H, f = Math.sqrt(Math.max(0, 1 - u * u));
    for (let m = 0; m < M; m++) { const a = m / M * Math.PI * 2, o = (j * M + m) * 3; pos[o] = cx + rx * f * Math.cos(a); pos[o + 1] = cy + ry * f * Math.sin(a); pos[o + 2] = zc + hz * u; } }
  for (let r = 0; r < H; r++) for (let m = 0; m < M; m++) { const a = r * M + m, b = r * M + (m + 1) % M, c = (r + 1) * M + m, d = (r + 1) * M + (m + 1) % M; idx.push(a, b, c, b, d, c); }
  return { pos, idx: new Uint32Array(idx) };
}
