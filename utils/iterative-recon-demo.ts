import {
  FBP_KERNELS,
  NOISE_ROI,
  PwlsReconstructor,
  Projector,
  addPoissonNoise,
  analyticSinogram,
  betaFromStrength,
  edgeWidth1090,
  fbp,
  makePhantom,
  rasterize,
  rmse,
  roiStats,
  toHU,
  WATER_MU,
  type FbpKernel,
} from './iterative-recon';

/**
 * Orchestrates one run of the IR-vs-FBP teaching demo (pure; used by the Web Worker and by unit tests).
 * All numbers produced here are measured on the toy phantom and say nothing about any specific commercial algorithm.
 */
export interface DemoParams {
  /** image size n × n and n detector bins */
  n: number;
  nAngles: number;
  /** relative dose in percent (100 % = `I0_AT_100` photons per detector bin and view) */
  dosePct: number;
  /** regularisation strength 0 … 10 (0 = unregularised weighted least squares) */
  strength: number;
  seed: number;
  nIter: number;
}

export const I0_AT_100 = 2000;
export const DEMO_DEFAULTS: DemoParams = { n: 64, nAngles: 90, dosePct: 25, strength: 3, seed: 7, nIter: 100 };
export const HUBER_DELTA = 0.05;

export interface ImageMetrics {
  /** RMS error against the known phantom inside the field of view, in HU-equivalent units */
  rmseHU: number;
  /** standard deviation in a uniform region, HU */
  noiseHU: number;
  /** 10–90 % edge-spread width of the high-contrast disc, pixels */
  edgePx: number;
}

export interface DemoResult {
  params: DemoParams;
  truth: Float32Array;
  /** noisy line integrals (nAngles × n) */
  sinogram: Float32Array;
  fbp: Record<FbpKernel, Float32Array>;
  fbpMetrics: Record<FbpKernel, ImageMetrics>;
  /** iteration snapshots, index k = image after k iterations (k = 0 is the zero image) */
  snaps: Float32Array[];
  series: {
    rmseHU: number[];
    noiseHU: number[];
    edgePx: number[];
    /** weighted data residual  Σ w (y − A x)² / N; ≈ 1 when the fit is consistent with the counting noise */
    chi2: number[];
  };
}

export function imageMetrics(img: Float32Array, truth: Float32Array, n: number, proj: Projector): ImageMetrics {
  return {
    rmseHU: 1000 * rmse(img, truth, proj.mask),
    noiseHU: 1000 * roiStats(img, n, NOISE_ROI).std,
    edgePx: edgeWidth1090(img, n),
  };
}

const projectorCache = new Map<string, Projector>();
export function getProjector(n: number, nAngles: number): Projector {
  const key = `${n}x${nAngles}`;
  let p = projectorCache.get(key);
  if (!p) {
    p = new Projector({ n, nAngles });
    projectorCache.set(key, p);
  }
  return p;
}

export function computeDemo(params: DemoParams): DemoResult {
  const { n, nAngles, dosePct, strength, seed, nIter } = params;
  const g = { n, nAngles };
  const proj = getProjector(n, nAngles);
  const phantom = makePhantom();
  const truth = rasterize(phantom, n);
  const clean = analyticSinogram(phantom, g);
  const noisy = addPoissonNoise(clean, (I0_AT_100 * dosePct) / 100, seed);

  const fbpImgs = {} as Record<FbpKernel, Float32Array>;
  const fbpMetrics = {} as Record<FbpKernel, ImageMetrics>;
  for (const k of FBP_KERNELS) {
    fbpImgs[k] = fbp(noisy.y, proj, k);
    fbpMetrics[k] = imageMetrics(fbpImgs[k], truth, n, proj);
  }

  const rec = new PwlsReconstructor(proj, noisy.y, noisy.w, {
    beta: betaFromStrength(strength, noisy.w),
    delta: HUBER_DELTA,
  });
  const snaps: Float32Array[] = [];
  const series = { rmseHU: [] as number[], noiseHU: [] as number[], edgePx: [] as number[], chi2: [] as number[] };
  const ax = new Float32Array(proj.nData);
  const record = (): void => {
    const img = Float32Array.from(rec.x);
    snaps.push(img);
    const m = imageMetrics(img, truth, n, proj);
    series.rmseHU.push(m.rmseHU);
    series.noiseHU.push(m.noiseHU);
    series.edgePx.push(m.edgePx);
    proj.forward(img, ax);
    let chi = 0;
    for (let i = 0; i < ax.length; i++) chi += noisy.w[i] * (noisy.y[i] - ax[i]) ** 2;
    series.chi2.push(chi / ax.length);
  };
  record();
  for (let k = 0; k < nIter; k++) {
    rec.step();
    record();
  }
  return { params, truth, sinogram: noisy.y, fbp: fbpImgs, fbpMetrics, snaps, series };
}

/** Display window: HU (centre / width) → 0…255. */
export function huToGray(mu: number, centerHU: number, widthHU: number): number {
  const hu = toHU(mu);
  const v = (hu - (centerHU - widthHU / 2)) / widthHU;
  return Math.round(255 * Math.min(1, Math.max(0, v)));
}
export { WATER_MU };
