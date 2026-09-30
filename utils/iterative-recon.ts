/**
 * Small 2D parallel-beam CT toy used by the "iterative reconstruction" teaching demo.
 *
 * Everything here is pure (no React / DOM) so it can be unit-tested:
 *  - analytic Shepp-Logan-style phantom (sum of ellipses) and its exact line integrals
 *  - Poisson counting noise with a seeded PRNG (deterministic)
 *  - matched pixel-driven projector pair A / Aᵀ
 *  - FBP (Ram-Lak / Shepp-Logan / Hann apodisation)
 *  - weighted, regularised SIRT-type iteration for the penalised weighted least-squares (PWLS) objective
 *      Φ(x) = ½ (y − A x)ᵀ W (y − A x) + β Σ_{neighbour pairs} ψ(x_j − x_k)     (ψ = Huber)
 *    with the diagonal "separable-surrogate" preconditioner  d_j = [Aᵀ W A 1]_j  (+ β · curvature bound).
 *
 * Units: image in "attenuation per unit length" where water = 1 (so HU ≈ 1000·(x − 1)); the field of view is
 * the square [-1, 1]²; the detector has `n` bins of width h = 2/n.
 * It is a teaching model: mono-energetic, parallel-beam, no scatter, no beam hardening, no detector blur.
 */

// ---------------------------------------------------------------- phantom
export interface Ellipse {
  cx: number;
  cy: number;
  /** semi-axis along the (rotated) x' axis */
  a: number;
  /** semi-axis along the (rotated) y' axis */
  b: number;
  /** rotation in degrees (counter-clockwise) */
  phiDeg: number;
  /** ADDITIVE attenuation value */
  mu: number;
}

export const WATER_MU = 1;
/** HU-equivalent of an attenuation value in the toy phantom (water = 0 HU, air = −1000 HU). */
export const toHU = (mu: number): number => 1000 * (mu - WATER_MU);

/** Geometry of the demo insert used to measure edge sharpness (high-contrast disc). */
export const EDGE_INSERT = { cx: -0.5, cy: -0.45, r: 0.16 } as const;
/** Geometry of a uniform region used to measure noise. */
export const NOISE_ROI = { cx: 0.0, cy: 0.42, r: 0.17 } as const;

/** Soft-tissue body with lung-like regions, a dense block, low-contrast lesions and a high-contrast disc. */
export function makePhantom(): Ellipse[] {
  return [
    // body (soft tissue, water-like); ellipses are ADDITIVE layers
    { cx: 0, cy: 0, a: 0.92, b: 0.78, phiDeg: 0, mu: 1.0 },
    // spine-like dense block
    { cx: 0, cy: -0.55, a: 0.16, b: 0.14, phiDeg: 0, mu: 0.8 },
    // air pockets (lungs/bowel-like), μ ≈ 0 → −1 relative to body
    { cx: -0.42, cy: 0.12, a: 0.22, b: 0.3, phiDeg: 15, mu: -0.75 },
    { cx: 0.42, cy: 0.12, a: 0.22, b: 0.3, phiDeg: -15, mu: -0.75 },
    // high-contrast disc used for the edge-spread measurement (bone/contrast-like, +800 HU)
    { cx: EDGE_INSERT.cx, cy: EDGE_INSERT.cy, a: EDGE_INSERT.r, b: EDGE_INSERT.r, phiDeg: 0, mu: 0.8 },
    // low-contrast lesions: +50 HU, −50 HU and a small +60 HU
    { cx: 0.45, cy: -0.42, a: 0.12, b: 0.12, phiDeg: 0, mu: 0.05 },
    { cx: 0.0, cy: -0.05, a: 0.1, b: 0.1, phiDeg: 0, mu: -0.05 },
    { cx: -0.35, cy: 0.55, a: 0.05, b: 0.05, phiDeg: 0, mu: 0.06 },
    // two tiny high-contrast dots (resolution cue)
    { cx: 0.22, cy: -0.2, a: 0.03, b: 0.03, phiDeg: 0, mu: 0.6 },
    { cx: 0.3, cy: -0.2, a: 0.03, b: 0.03, phiDeg: 0, mu: 0.6 },
  ];
}

/** Pixel centre coordinates: row 0 is the top (y = +1 side). */
export const pixelX = (j: number, n: number): number => -1 + ((j + 0.5) * 2) / n;
export const pixelY = (i: number, n: number): number => 1 - ((i + 0.5) * 2) / n;

function ellipseContains(e: Ellipse, x: number, y: number): boolean {
  const phi = (e.phiDeg * Math.PI) / 180;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const dx = x - e.cx;
  const dy = y - e.cy;
  const u = dx * c + dy * s;
  const v = -dx * s + dy * c;
  return (u * u) / (e.a * e.a) + (v * v) / (e.b * e.b) <= 1;
}

/** Rasterise with `ss × ss` supersampling (anti-aliased edges). */
export function rasterize(ellipses: Ellipse[], n: number, ss = 3): Float32Array {
  const img = new Float32Array(n * n);
  const h = 2 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let acc = 0;
      for (let a = 0; a < ss; a++) {
        for (let b = 0; b < ss; b++) {
          const x = -1 + j * h + ((b + 0.5) * h) / ss;
          const y = 1 - i * h - ((a + 0.5) * h) / ss;
          let v = 0;
          for (const e of ellipses) if (ellipseContains(e, x, y)) v += e.mu;
          acc += v;
        }
      }
      img[i * n + j] = acc / (ss * ss);
    }
  }
  return img;
}

// ---------------------------------------------------------------- geometry
export interface Geometry {
  /** image is n × n, detector has n bins */
  n: number;
  nAngles: number;
}
export const binWidth = (g: Geometry): number => 2 / g.n;
export const angleOf = (g: Geometry, a: number): number => (a * Math.PI) / g.nAngles;

/** Boolean support mask: pixels whose centre lies inside the reconstruction circle. */
export function circleMask(n: number, radius = 1 - 1 / n): Uint8Array {
  const m = new Uint8Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = pixelX(j, n);
      const y = pixelY(i, n);
      m[i * n + j] = x * x + y * y <= radius * radius ? 1 : 0;
    }
  return m;
}

/** Exact line integrals of the ellipse phantom: sinogram[a * n + k]. */
export function analyticSinogram(ellipses: Ellipse[], g: Geometry): Float32Array {
  const { n, nAngles } = g;
  const h = binWidth(g);
  const sino = new Float32Array(nAngles * n);
  for (let ia = 0; ia < nAngles; ia++) {
    const th = angleOf(g, ia);
    const ct = Math.cos(th);
    const st = Math.sin(th);
    for (let k = 0; k < n; k++) {
      const s = (k - (n - 1) / 2) * h;
      let sum = 0;
      for (const e of ellipses) {
        const phi = (e.phiDeg * Math.PI) / 180;
        const alpha = th - phi;
        const t2 = e.a * e.a * Math.cos(alpha) ** 2 + e.b * e.b * Math.sin(alpha) ** 2;
        const s0 = s - (e.cx * ct + e.cy * st);
        if (s0 * s0 < t2) sum += e.mu * ((2 * e.a * e.b) / t2) * Math.sqrt(t2 - s0 * s0);
      }
      sino[ia * n + k] = sum;
    }
  }
  return sino;
}

// ---------------------------------------------------------------- noise
/** Small deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function poisson(lambda: number, rand: () => number): number {
  if (lambda <= 0) return 0;
  if (lambda < 30) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rand();
    } while (p > L);
    return k - 1;
  }
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gaussian(rand)));
}

export interface NoisyData {
  /** noisy line integrals  −ln(N / I0) */
  y: Float32Array;
  /** statistical weights (≈ detected counts, ≥ 1) */
  w: Float32Array;
  i0: number;
}

/** Transmission measurement with Poisson counting noise: N ~ Poisson(I0·exp(−p)). */
export function addPoissonNoise(sino: Float32Array, i0: number, seed: number): NoisyData {
  const rand = mulberry32(seed);
  const y = new Float32Array(sino.length);
  const w = new Float32Array(sino.length);
  for (let i = 0; i < sino.length; i++) {
    const count = Math.max(1, poisson(i0 * Math.exp(-sino[i]), rand));
    y[i] = -Math.log(count / i0);
    w[i] = count;
  }
  return { y, w, i0 };
}

// ---------------------------------------------------------------- projector pair
/**
 * Matched pixel-driven projector. Forward: A x (line integrals, includes the pixel size h);
 * back: Aᵀ y. The pair is an exact adjoint (verified in the unit tests).
 */
export class Projector {
  readonly n: number;
  readonly nAngles: number;
  readonly h: number;
  readonly active: Int32Array; // indices of pixels inside the mask
  private readonly k0: Int16Array; // [angle * nActive + p]
  private readonly frac: Float32Array;
  readonly mask: Uint8Array;

  constructor(g: Geometry, mask: Uint8Array = circleMask(g.n)) {
    this.n = g.n;
    this.nAngles = g.nAngles;
    this.h = binWidth(g);
    this.mask = mask;
    const act: number[] = [];
    for (let p = 0; p < mask.length; p++) if (mask[p]) act.push(p);
    this.active = Int32Array.from(act);
    const nA = this.active.length;
    this.k0 = new Int16Array(g.nAngles * nA);
    this.frac = new Float32Array(g.nAngles * nA);
    const n = g.n;
    for (let ia = 0; ia < g.nAngles; ia++) {
      const th = angleOf(g, ia);
      const ct = Math.cos(th);
      const st = Math.sin(th);
      for (let q = 0; q < nA; q++) {
        const p = this.active[q];
        const x = pixelX(p % n, n);
        const y = pixelY(Math.floor(p / n), n);
        const u = (x * ct + y * st) / this.h + (n - 1) / 2;
        let k = Math.floor(u);
        let f = u - k;
        // The mask keeps every footprint inside [0, n-1]; clamp defensively.
        if (k < 0) { k = 0; f = 0; }
        if (k > n - 2) { k = n - 2; f = 1; }
        this.k0[ia * nA + q] = k;
        this.frac[ia * nA + q] = f;
      }
    }
  }

  get nData(): number {
    return this.nAngles * this.n;
  }

  /** out = A x  (length nAngles·n). Optionally only for a subset of angles. */
  forward(x: Float32Array, out: Float32Array): void {
    const nA = this.active.length;
    const n = this.n;
    out.fill(0);
    for (let ia = 0; ia < this.nAngles; ia++) {
      const base = ia * nA;
      const ob = ia * n;
      for (let q = 0; q < nA; q++) {
        const v = x[this.active[q]] * this.h;
        if (v === 0) continue;
        const k = this.k0[base + q];
        const f = this.frac[base + q];
        out[ob + k] += v * (1 - f);
        out[ob + k + 1] += v * f;
      }
    }
  }

  /** out = Aᵀ y (length n·n, zero outside the mask). */
  back(y: Float32Array, out: Float32Array): void {
    const nA = this.active.length;
    const n = this.n;
    out.fill(0);
    for (let ia = 0; ia < this.nAngles; ia++) {
      const base = ia * nA;
      const ob = ia * n;
      for (let q = 0; q < nA; q++) {
        const k = this.k0[base + q];
        const f = this.frac[base + q];
        out[this.active[q]] += this.h * (y[ob + k] * (1 - f) + y[ob + k + 1] * f);
      }
    }
  }
}

// ---------------------------------------------------------------- FBP
export type FbpKernel = 'ramlak' | 'sheppLogan' | 'hann';
export const FBP_KERNELS: readonly FbpKernel[] = ['ramlak', 'sheppLogan', 'hann'];

/** Window applied to the ramp in the frequency domain; `r` = f / f_Nyquist ∈ [0, 1]. */
export function kernelWindow(kernel: FbpKernel, r: number): number {
  if (kernel === 'ramlak') return 1;
  if (kernel === 'sheppLogan') {
    const a = (Math.PI * r) / 2;
    return a === 0 ? 1 : Math.sin(a) / a;
  }
  return 0.5 * (1 + Math.cos(Math.PI * r));
}

/**
 * Spatial-domain reconstruction kernel g[m], m = −(n−1) … (n−1), for detector spacing τ.
 * Start from the band-limited Ram-Lak kernel and apply the window via a length-L DFT.
 */
export function reconKernel(n: number, tau: number, kernel: FbpKernel): Float32Array {
  const L = 1 << Math.ceil(Math.log2(2 * n));
  const base = new Float64Array(L); // circular layout
  for (let m = -L / 2; m < L / 2; m++) {
    let v: number;
    if (m === 0) v = 1 / (4 * tau * tau);
    else if (Math.abs(m) % 2 === 1) v = -1 / (Math.PI * Math.PI * m * m * tau * tau);
    else v = 0;
    base[(m + L) % L] = v;
  }
  let ker = base;
  if (kernel !== 'ramlak') {
    // DFT (real & even kernel → real spectrum), apply window, inverse DFT
    const spec = new Float64Array(L);
    for (let k = 0; k < L; k++) {
      let s = 0;
      for (let m = 0; m < L; m++) s += base[m] * Math.cos((2 * Math.PI * k * m) / L);
      const kk = k <= L / 2 ? k : L - k;
      spec[k] = s * kernelWindow(kernel, kk / (L / 2));
    }
    ker = new Float64Array(L);
    for (let m = 0; m < L; m++) {
      let s = 0;
      for (let k = 0; k < L; k++) s += spec[k] * Math.cos((2 * Math.PI * k * m) / L);
      ker[m] = s / L;
    }
  }
  const out = new Float32Array(2 * n - 1);
  for (let m = -(n - 1); m <= n - 1; m++) out[m + n - 1] = ker[(m + L) % L];
  return out;
}

/** Filtered backprojection of a parallel-beam sinogram. Returns the n × n image (zero outside the mask). */
export function fbp(y: Float32Array, proj: Projector, kernel: FbpKernel): Float32Array {
  const { n, nAngles, h } = proj;
  const g = reconKernel(n, h, kernel);
  const q = new Float32Array(nAngles * n);
  for (let ia = 0; ia < nAngles; ia++) {
    const b = ia * n;
    for (let k = 0; k < n; k++) {
      let s = 0;
      for (let m = 0; m < n; m++) s += y[b + m] * g[k - m + n - 1];
      q[b + k] = s * h;
    }
  }
  const img = new Float32Array(n * n);
  proj.back(q, img); // includes a factor h (from A); undo it and apply π/nAngles
  const scale = Math.PI / nAngles / h;
  for (let i = 0; i < img.length; i++) img[i] *= scale;
  return img;
}

// ---------------------------------------------------------------- PWLS / weighted SIRT iteration
export interface PwlsOptions {
  /** absolute regularisation weight β (use `betaFromStrength`) */
  beta: number;
  /** Huber transition in attenuation units (differences below δ are smoothed quadratically) */
  delta: number;
}

/** Map the UI strength (0 … 10) to an absolute β that is comparable across dose levels. */
export function betaFromStrength(strength: number, w: Float32Array): number {
  let mean = 0;
  for (let i = 0; i < w.length; i++) mean += w[i];
  mean /= w.length;
  return strength * 0.03 * mean;
}

const huberGrad = (t: number, d: number): number => (t > d ? d : t < -d ? -d : t);
const huberVal = (t: number, d: number): number => {
  const a = Math.abs(t);
  return a <= d ? 0.5 * t * t : d * (a - 0.5 * d);
};

/** Penalised weighted least-squares objective Φ(x). */
export function pwlsCost(
  x: Float32Array,
  proj: Projector,
  y: Float32Array,
  w: Float32Array,
  opt: PwlsOptions,
): number {
  const ax = new Float32Array(proj.nData);
  proj.forward(x, ax);
  let data = 0;
  for (let i = 0; i < ax.length; i++) {
    const r = y[i] - ax[i];
    data += 0.5 * w[i] * r * r;
  }
  const n = proj.n;
  let reg = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const p = i * n + j;
      if (!proj.mask[p]) continue;
      if (j + 1 < n && proj.mask[p + 1]) reg += huberVal(x[p] - x[p + 1], opt.delta);
      if (i + 1 < n && proj.mask[p + n]) reg += huberVal(x[p] - x[p + n], opt.delta);
    }
  return data + opt.beta * reg;
}

/**
 * Stateful iterative reconstructor. `step()` performs one full pass:
 *   x ← max(0, x + [Aᵀ W (y − A x) − β ∇R(x)] / (d + β c))
 * where d = Aᵀ W A 1 and c = 2·(number of neighbours) bound the curvature (separable surrogate).
 */
export class PwlsReconstructor {
  readonly x: Float32Array;
  private readonly res: Float32Array;
  private readonly grad: Float32Array;
  private readonly d: Float32Array;
  private readonly cBound: Float32Array;

  constructor(
    private readonly proj: Projector,
    private readonly y: Float32Array,
    private readonly w: Float32Array,
    private readonly opt: PwlsOptions,
    x0?: Float32Array,
  ) {
    const n = proj.n;
    this.x = x0 ? Float32Array.from(x0) : new Float32Array(n * n);
    this.res = new Float32Array(proj.nData);
    this.grad = new Float32Array(n * n);
    // d = Aᵀ (w ⊙ (A·1))
    const ones = new Float32Array(n * n);
    for (let p = 0; p < ones.length; p++) ones[p] = proj.mask[p];
    const a1 = new Float32Array(proj.nData);
    proj.forward(ones, a1);
    for (let i = 0; i < a1.length; i++) a1[i] *= w[i];
    this.d = new Float32Array(n * n);
    proj.back(a1, this.d);
    this.cBound = new Float32Array(n * n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const p = i * n + j;
        if (!proj.mask[p]) continue;
        let c = 0;
        if (j > 0 && proj.mask[p - 1]) c++;
        if (j + 1 < n && proj.mask[p + 1]) c++;
        if (i > 0 && proj.mask[p - n]) c++;
        if (i + 1 < n && proj.mask[p + n]) c++;
        this.cBound[p] = 2 * c;
      }
  }

  step(): void {
    const { proj, y, w, res, grad, d, cBound, x, opt } = this;
    const n = proj.n;
    proj.forward(x, res);
    for (let i = 0; i < res.length; i++) res[i] = w[i] * (y[i] - res[i]);
    proj.back(res, grad);
    const beta = opt.beta;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const p = i * n + j;
        if (!proj.mask[p]) continue;
        let reg = 0;
        if (beta > 0) {
          const xp = x[p];
          if (j > 0 && proj.mask[p - 1]) reg += huberGrad(xp - x[p - 1], opt.delta);
          if (j + 1 < n && proj.mask[p + 1]) reg += huberGrad(xp - x[p + 1], opt.delta);
          if (i > 0 && proj.mask[p - n]) reg += huberGrad(xp - x[p - n], opt.delta);
          if (i + 1 < n && proj.mask[p + n]) reg += huberGrad(xp - x[p + n], opt.delta);
        }
        const denom = d[p] + beta * cBound[p];
        const next = x[p] + (grad[p] - beta * reg) / (denom > 0 ? denom : 1);
        x[p] = next > 0 ? next : 0;
      }
  }
}

/** Convenience: run `nIter` iterations and return snapshots [x⁰ … x^nIter]. */
export function runPwls(
  proj: Projector,
  y: Float32Array,
  w: Float32Array,
  opt: PwlsOptions,
  nIter: number,
): Float32Array[] {
  const rec = new PwlsReconstructor(proj, y, w, opt);
  const snaps: Float32Array[] = [Float32Array.from(rec.x)];
  for (let k = 0; k < nIter; k++) {
    rec.step();
    snaps.push(Float32Array.from(rec.x));
  }
  return snaps;
}

// ---------------------------------------------------------------- image metrics
export interface RoiStats {
  mean: number;
  std: number;
}

export function roiStats(img: Float32Array, n: number, roi: { cx: number; cy: number; r: number }): RoiStats {
  let s = 0;
  let s2 = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const dx = pixelX(j, n) - roi.cx;
      const dy = pixelY(i, n) - roi.cy;
      if (dx * dx + dy * dy <= roi.r * roi.r) {
        const v = img[i * n + j];
        s += v;
        s2 += v * v;
        cnt++;
      }
    }
  if (cnt === 0) return { mean: 0, std: 0 };
  const mean = s / cnt;
  return { mean, std: Math.sqrt(Math.max(0, s2 / cnt - mean * mean)) };
}

export function rmse(a: Float32Array, b: Float32Array, mask: Uint8Array): number {
  let s = 0;
  let cnt = 0;
  for (let i = 0; i < a.length; i++)
    if (mask[i]) {
      s += (a[i] - b[i]) ** 2;
      cnt++;
    }
  return Math.sqrt(s / Math.max(1, cnt));
}

/**
 * 10 %–90 % edge-spread width (in pixels) across the circular high-contrast insert. Pixels are binned by
 * signed distance to the disc boundary (0.25 px bins) — averaging around the circle suppresses noise.
 * Returns NaN if the profile never crosses both levels.
 */
export function edgeWidth1090(
  img: Float32Array,
  n: number,
  disc: { cx: number; cy: number; r: number } = EDGE_INSERT,
): number {
  const h = 2 / n;
  const bin = 0.25;
  const span = 6; // pixels on each side
  const nb = Math.round((2 * span) / bin);
  const sum = new Float64Array(nb);
  const cnt = new Float64Array(nb);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const dx = pixelX(j, n) - disc.cx;
      const dy = pixelY(i, n) - disc.cy;
      const d = (Math.sqrt(dx * dx + dy * dy) - disc.r) / h; // pixels, >0 outside
      if (d < -span || d >= span) continue;
      const b = Math.floor((d + span) / bin);
      sum[b] += img[i * n + j];
      cnt[b]++;
    }
  const prof: number[] = [];
  for (let b = 0; b < nb; b++) prof.push(cnt[b] > 0 ? sum[b] / cnt[b] : NaN);
  // plateau levels: inside (first 2 px) and outside (last 2 px from the boundary, but clear of neighbours)
  const mean = (lo: number, hi: number): number => {
    let s = 0;
    let c = 0;
    for (let b = 0; b < nb; b++) {
      const d = -span + (b + 0.5) * bin;
      if (d >= lo && d < hi && !Number.isNaN(prof[b])) {
        s += prof[b];
        c++;
      }
    }
    return c ? s / c : NaN;
  };
  const inside = mean(-span, -2.5);
  const outside = mean(2.5, span);
  const lo = outside + 0.1 * (inside - outside);
  const hi = outside + 0.9 * (inside - outside);
  // outside → inside: profile decreases in d. Find crossing positions (linear interpolation).
  const cross = (level: number): number => {
    for (let b = 0; b + 1 < nb; b++) {
      const p0 = prof[b];
      const p1 = prof[b + 1];
      if (Number.isNaN(p0) || Number.isNaN(p1)) continue;
      if ((p0 - level) * (p1 - level) <= 0 && p0 !== p1) {
        const t = (level - p0) / (p1 - p0);
        return -span + (b + 0.5 + t) * bin;
      }
    }
    return NaN;
  };
  // search from the outside inwards for stability
  const crossFromOutside = (level: number): number => {
    for (let b = nb - 2; b >= 0; b--) {
      const p0 = prof[b];
      const p1 = prof[b + 1];
      if (Number.isNaN(p0) || Number.isNaN(p1)) continue;
      if ((p0 - level) * (p1 - level) <= 0 && p0 !== p1) {
        const t = (level - p0) / (p1 - p0);
        return -span + (b + 0.5 + t) * bin;
      }
    }
    return cross(level);
  };
  const dHi = crossFromOutside(hi); // 90 % of the way to the inside plateau → closer to the inside
  const dLo = crossFromOutside(lo);
  if (Number.isNaN(dHi) || Number.isNaN(dLo)) return NaN;
  return Math.abs(dLo - dHi);
}
