import { describe, it, expect } from 'vitest';
import {
  Projector,
  PwlsReconstructor,
  addPoissonNoise,
  analyticSinogram,
  betaFromStrength,
  circleMask,
  edgeWidth1090,
  fbp,
  makePhantom,
  mulberry32,
  poisson,
  pwlsCost,
  rasterize,
  reconKernel,
  rmse,
  roiStats,
  NOISE_ROI,
} from '@/utils/iterative-recon';
import { computeDemo, huToGray } from '@/utils/iterative-recon-demo';

const n = 64;
const g = { n, nAngles: 90 };
const phantom = makePhantom();
const truth = rasterize(phantom, n);
const proj = new Projector(g);
const clean = analyticSinogram(phantom, g);

describe('projector', () => {
  it('forward and back projection are an exact adjoint pair', () => {
    const rand = mulberry32(1);
    const x = new Float32Array(n * n);
    for (let p = 0; p < x.length; p++) x[p] = proj.mask[p] ? rand() : 0;
    const y = new Float32Array(proj.nData).map(() => rand());
    const ax = new Float32Array(proj.nData);
    const aty = new Float32Array(n * n);
    proj.forward(x, ax);
    proj.back(y, aty);
    let lhs = 0;
    let rhs = 0;
    for (let i = 0; i < ax.length; i++) lhs += ax[i] * y[i];
    for (let i = 0; i < x.length; i++) rhs += x[i] * aty[i];
    expect(Math.abs(lhs - rhs) / Math.abs(lhs)).toBeLessThan(1e-4);
  });

  it('numerical projection of the rasterised phantom matches the analytic sinogram', () => {
    const num = new Float32Array(proj.nData);
    proj.forward(truth, num);
    let err = 0;
    let ref = 0;
    for (let i = 0; i < num.length; i++) {
      err += (num[i] - clean[i]) ** 2;
      ref += clean[i] ** 2;
    }
    expect(Math.sqrt(err / ref)).toBeLessThan(0.06);
  });

  it('the support mask is a disc inside the field of view', () => {
    const m = circleMask(n);
    expect(m[0]).toBe(0); // corner outside
    expect(m[(n / 2) * n + n / 2]).toBe(1); // centre inside
  });
});

describe('noise model', () => {
  it('PRNG is deterministic and Poisson has mean ≈ variance ≈ λ', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    for (const lambda of [4, 200]) {
      const rand = mulberry32(3);
      let s = 0;
      let s2 = 0;
      const N = 20000;
      for (let i = 0; i < N; i++) {
        const v = poisson(lambda, rand);
        s += v;
        s2 += v * v;
      }
      const mean = s / N;
      const variance = s2 / N - mean * mean;
      expect(mean / lambda).toBeGreaterThan(0.97);
      expect(mean / lambda).toBeLessThan(1.03);
      expect(variance / lambda).toBeGreaterThan(0.93);
      expect(variance / lambda).toBeLessThan(1.07);
    }
  });

  it('lower dose → larger line-integral noise (std ∝ 1/√I0)', () => {
    const flat = new Float32Array(20000).fill(0.5);
    const sd = (i0: number) => {
      const { y } = addPoissonNoise(flat, i0, 5);
      const m = y.reduce((a, v) => a + v, 0) / y.length;
      return Math.sqrt(y.reduce((a, v) => a + (v - m) ** 2, 0) / y.length);
    };
    const ratio = sd(250) / sd(1000);
    expect(ratio).toBeGreaterThan(1.85);
    expect(ratio).toBeLessThan(2.15);
  });
});

describe('FBP', () => {
  it('ramp kernel has the expected Ram-Lak values and ~zero DC gain', () => {
    const tau = 1;
    const k = reconKernel(16, tau, 'ramlak');
    const c = 15; // m = 0
    expect(k[c]).toBeCloseTo(1 / 4, 6);
    expect(k[c + 1]).toBeCloseTo(-1 / (Math.PI * Math.PI), 6);
    expect(k[c + 2]).toBeCloseTo(0, 9);
    const sum = Array.from(k).reduce((a, v) => a + v, 0);
    expect(Math.abs(sum)).toBeLessThan(0.05);
  });

  it('reconstructs the noiseless phantom with small error (HU scale)', () => {
    const img = fbp(clean, proj, 'ramlak');
    expect(1000 * rmse(img, truth, proj.mask)).toBeLessThan(70);
    const roi = roiStats(img, n, NOISE_ROI);
    expect(Math.abs(roi.mean - 1)).toBeLessThan(0.02); // water stays water
  });

  it('smoother kernel → lower noise, wider edge at the same data', () => {
    const noisy = addPoissonNoise(clean, 500, 11);
    const ram = fbp(noisy.y, proj, 'ramlak');
    const hann = fbp(noisy.y, proj, 'hann');
    expect(roiStats(hann, n, NOISE_ROI).std).toBeLessThan(0.6 * roiStats(ram, n, NOISE_ROI).std);
    expect(edgeWidth1090(hann, n)).toBeGreaterThan(edgeWidth1090(ram, n));
  });
});

describe('iterative (weighted SIRT / PWLS) reconstruction', () => {
  it('noiseless data: the error to the truth shrinks with iterations and the data fit converges', () => {
    const w = new Float32Array(clean.length).fill(1);
    const rec = new PwlsReconstructor(proj, clean, w, { beta: 0, delta: 0.05 });
    const errAt: number[] = [rmse(rec.x, truth, proj.mask)];
    const ax = new Float32Array(proj.nData);
    const resid = (): number => {
      proj.forward(rec.x, ax);
      let s = 0;
      for (let i = 0; i < ax.length; i++) s += (clean[i] - ax[i]) ** 2;
      return s;
    };
    const r0 = resid();
    for (let k = 1; k <= 60; k++) {
      rec.step();
      if (k === 3 || k === 10 || k === 60) errAt.push(rmse(rec.x, truth, proj.mask));
    }
    expect(errAt[1]).toBeLessThan(errAt[0]);
    expect(errAt[2]).toBeLessThan(errAt[1]);
    expect(errAt[3]).toBeLessThan(errAt[2]);
    expect(resid()).toBeLessThan(0.01 * r0);
  });

  it('the penalised objective never increases (monotone majorise-minimise update)', () => {
    const noisy = addPoissonNoise(clean, 500, 21);
    const opt = { beta: betaFromStrength(4, noisy.w), delta: 0.05 };
    const rec = new PwlsReconstructor(proj, noisy.y, noisy.w, opt);
    let prev = pwlsCost(rec.x, proj, noisy.y, noisy.w, opt);
    for (let k = 0; k < 25; k++) {
      rec.step();
      const c = pwlsCost(rec.x, proj, noisy.y, noisy.w, opt);
      expect(c).toBeLessThanOrEqual(prev * (1 + 1e-5));
      prev = c;
    }
  });

  it('x stays non-negative and is exactly zero outside the support', () => {
    const noisy = addPoissonNoise(clean, 200, 2);
    const rec = new PwlsReconstructor(proj, noisy.y, noisy.w, { beta: 0, delta: 0.05 });
    for (let k = 0; k < 10; k++) rec.step();
    for (let p = 0; p < rec.x.length; p++) {
      expect(rec.x[p]).toBeGreaterThanOrEqual(0);
      if (!proj.mask[p]) expect(rec.x[p]).toBe(0);
    }
  });
});

describe('demo orchestration (low dose, same data for FBP and IR)', () => {
  const base = { n, nAngles: 90, dosePct: 25, seed: 7, nIter: 60 };
  const reg = computeDemo({ ...base, strength: 6 });
  const none = computeDemo({ ...base, strength: 0 });

  it('returns nIter+1 snapshots and aligned metric series', () => {
    expect(reg.snaps.length).toBe(61);
    expect(reg.series.rmseHU.length).toBe(61);
    expect(reg.series.chi2[0]).toBeGreaterThan(reg.series.chi2[60]);
  });

  it('regularised IR beats FBP noise at the same dose while staying sharp enough', () => {
    const fbpRam = reg.fbpMetrics.ramlak;
    const ir = { noise: reg.series.noiseHU[40], edge: reg.series.edgePx[40], err: reg.series.rmseHU[40] };
    expect(ir.noise).toBeLessThan(0.5 * fbpRam.noiseHU);
    expect(ir.err).toBeLessThan(fbpRam.rmseHU);
    expect(ir.edge).toBeLessThan(fbpRam.edgePx + 1.5);
  });

  it('noise grows with iteration when unregularised (semi-convergence) and regularisation tames it', () => {
    expect(none.series.noiseHU[60]).toBeGreaterThan(1.5 * none.series.noiseHU[10]);
    expect(reg.series.noiseHU[60]).toBeLessThan(none.series.noiseHU[60]);
    const best = Math.min(...none.series.rmseHU.slice(1));
    expect(none.series.rmseHU[60]).toBeGreaterThan(best * 1.05);
  });

  it('stronger regularisation trades resolution: edge width does not shrink', () => {
    expect(reg.series.edgePx[60]).toBeGreaterThanOrEqual(none.series.edgePx[60] - 0.05);
  });

  it('lower dose → higher FBP noise', () => {
    const hi = computeDemo({ ...base, dosePct: 100, strength: 0, nIter: 1 });
    expect(reg.fbpMetrics.ramlak.noiseHU).toBeGreaterThan(1.5 * hi.fbpMetrics.ramlak.noiseHU);
  });

  it('display window maps HU to 0…255', () => {
    expect(huToGray(1, 0, 500)).toBe(128); // water = 0 HU at window centre
    expect(huToGray(0, 0, 500)).toBe(0); // air
    expect(huToGray(2, 0, 500)).toBe(255);
  });
});
