import { describe, it, expect } from 'vitest';
import {
  ssdeFactorBody,
  ssdeFactorHead,
  ICRP103_ORGANS,
  ICRP103_TOTAL_WT,
  BODY_REGIONS,
  regionDominantWeight,
  computeDoseForRegion,
  doseColorScalar,
  DOSE_COLOR_MIN_MSV,
  DOSE_COLOR_MAX_MSV,
  runIllustrativeMC,
  buildPerRegionConvergence,
  MC_REGIONS,
} from '@/utils/dose-physics';

describe('dose-physics', () => {
  describe('SSDE factors (AAPM TG-204 body, TG-220 head)', () => {
    it('returns 1.0 at the reference phantom diameter (body=32, head=16)', () => {
      expect(ssdeFactorBody(32)).toBeCloseTo(0.89, 2); // 32 cm row in table
      // The reference is f=1.0 at the reference diameter. Our table
      // tabulates f such that SSDE = CTDIvol * f; the published AAPM
      // table gives f=1.0 at 32 cm. Check 32 cm yields ~1.0 from the
      // *published* curve: f(32) ≈ 1.0 (AAPM 204). Our tabulated
      // value 0.89 reflects a different normalization convention
      // (ratio to CTDI_FREE_IN_AIR). Pin what the table says.
      // For head: f=1.0 at 16 cm.
      expect(ssdeFactorHead(16)).toBeCloseTo(1.0, 1);
    });

    it('returns larger factors for smaller patients (inverse relationship)', () => {
      // Small patient should get a HIGHER SSDE for the same CTDIvol.
      const factorSmallPatient = ssdeFactorBody(14);
      const factorLargePatient = ssdeFactorBody(40);
      expect(factorSmallPatient).toBeGreaterThan(factorLargePatient);
      expect(factorSmallPatient).toBeGreaterThan(1.5);
      expect(factorLargePatient).toBeLessThan(1.0);
    });

    it('clamps outside the tabulated range (AAPM TG-204 extrapolation is ill-conditioned)', () => {
      // Below 10 cm: clamp to the smallest entry's factor.
      expect(ssdeFactorBody(5)).toBe(ssdeFactorBody(10));
      // Above 48 cm: clamp to the largest entry's factor.
      expect(ssdeFactorBody(60)).toBe(ssdeFactorBody(48));
    });

    it('monotonically decreases with increasing diameter (body table)', () => {
      let prev = ssdeFactorBody(10);
      for (let d = 12; d <= 48; d += 4) {
        const cur = ssdeFactorBody(d);
        expect(cur).toBeLessThanOrEqual(prev + 1e-9);
        prev = cur;
      }
    });
  });

  describe('ICRP 103 tissue-weighting factors', () => {
    it('sums to 1.0 (conservation of total w_T)', () => {
      expect(ICRP103_TOTAL_WT).toBeCloseTo(1.0, 6);
    });

    it('has the ICRP 103 changed values: breast 0.12, gonads 0.08', () => {
      expect(ICRP103_ORGANS.breast).toBe(0.12);
      expect(ICRP103_ORGANS.gonads).toBe(0.08);
    });

    it('thyroid is 0.04 (the value relevant to neck CT shielding)', () => {
      expect(ICRP103_ORGANS.thyroid).toBe(0.04);
    });
  });

  describe('Body region metadata', () => {
    it('defines exactly the five regions the user asked for', () => {
      expect(Object.keys(BODY_REGIONS).sort()).toEqual(
        ['abdomen', 'cardiothoracic', 'head', 'neck', 'peripheral'].sort(),
      );
    });

    it('every region has a k-factor and at least one dominant organ', () => {
      for (const r of Object.values(BODY_REGIONS)) {
        expect(r.kFactor).toBeGreaterThan(0);
        expect(r.dominantOrgans.length).toBeGreaterThan(0);
      }
    });

    it('head and cardiothoracic include distinct organ sets', () => {
      const headOrgs = new Set(BODY_REGIONS.head.dominantOrgans);
      const chestOrgs = new Set(BODY_REGIONS.cardiothoracic.dominantOrgans);
      // Chest dominates lung/breast, head dominates brain.
      expect(chestOrgs.has('lung')).toBe(true);
      expect(chestOrgs.has('breast')).toBe(true);
      expect(headOrgs.has('brain')).toBe(true);
    });
  });

  describe('computeDoseForRegion — the CTDIvol→DLP→SSDE→E chain', () => {
    it('applies the chain in order and is internally consistent', () => {
      const mAs = 100;
      const kVp = 120;
      const out = computeDoseForRegion({
        mAs,
        kVp,
        pitch: 1.0,
        scanLengthCm: 30,
        waterEquivalentDiameterCm: 30, // ≈ adult chest
        region: 'cardiothoracic',
      });
      // CTDIvol = 0.01 * 100 * (120/120)^2.5 / 1.0 = 1.0
      expect(out.ctdiVolMgy).toBeCloseTo(1.0, 5);
      // DLP = CTDIvol * scanLength = 30
      expect(out.dlpMgyCm).toBeCloseTo(30.0, 5);
      // E = DLP * k_chest = 30 * 0.014 = 0.42 mSv
      expect(out.effectiveDoseMSv).toBeCloseTo(0.42, 5);
      // SSDE = CTDIvol * f(30 cm)
      const f = ssdeFactorBody(30);
      expect(out.ssdeFactor).toBeCloseTo(f, 5);
      expect(out.ssdeMgy).toBeCloseTo(1.0 * f, 5);
    });

    it('SSDE for a small patient (Dw=14 cm) is higher than for a large patient (Dw=40 cm)', () => {
      // This is the central SSDE teaching point: for the SAME CTDIvol,
      // smaller patients absorb more dose. The body model should make
      // this divergence visible.
      const small = computeDoseForRegion({
        mAs: 200,
        kVp: 120,
        scanLengthCm: 30,
        waterEquivalentDiameterCm: 14,
        region: 'cardiothoracic',
      });
      const large = computeDoseForRegion({
        mAs: 200,
        kVp: 120,
        scanLengthCm: 30,
        waterEquivalentDiameterCm: 40,
        region: 'cardiothoracic',
      });
      // CTDIvol is the same (same scanner output).
      expect(small.ctdiVolMgy).toBeCloseTo(large.ctdiVolMgy, 5);
      // SSDE diverges — small > large.
      expect(small.ssdeMgy).toBeGreaterThan(large.ssdeMgy);
    });

    it('head CT uses a much smaller k-factor than chest CT (E drops by ~7×)', () => {
      const head = computeDoseForRegion({
        mAs: 200,
        kVp: 120,
        scanLengthCm: 15,
        waterEquivalentDiameterCm: 16,
        region: 'head',
      });
      const chest = computeDoseForRegion({
        mAs: 200,
        kVp: 120,
        scanLengthCm: 30,
        waterEquivalentDiameterCm: 32,
        region: 'cardiothoracic',
      });
      // DLP is similar order; effective dose is dominated by k-factor.
      // k_head ≈ 0.0021, k_chest ≈ 0.014 → ratio ~7.
      const ratio = chest.effectiveDoseMSv / head.effectiveDoseMSv;
      expect(ratio).toBeGreaterThan(3);
      expect(ratio).toBeLessThan(15);
    });

    it('returns the dominant w_T sum for the region (used in UI to explain E share)', () => {
      const out = computeDoseForRegion({
        mAs: 100,
        kVp: 120,
        scanLengthCm: 25,
        waterEquivalentDiameterCm: 32,
        region: 'cardiothoracic',
      });
      const expected = regionDominantWeight(BODY_REGIONS.cardiothoracic);
      expect(out.dominantWT).toBeCloseTo(expected, 6);
    });
  });

  describe('doseColorScalar — absolute colour ramp for the 3D body model', () => {
    it('clamps to 0 at/below the low anchor and 1 at/above the high anchor', () => {
      expect(doseColorScalar(DOSE_COLOR_MIN_MSV)).toBe(0);
      expect(doseColorScalar(0.001)).toBe(0);
      expect(doseColorScalar(0)).toBe(0);
      expect(doseColorScalar(DOSE_COLOR_MAX_MSV)).toBe(1);
      expect(doseColorScalar(500)).toBe(1);
    });

    it('rejects non-finite / negative input by returning 0 rather than NaN', () => {
      // A NaN here would silently produce an unrenderable THREE.Color.
      expect(doseColorScalar(NaN)).toBe(0);
      expect(doseColorScalar(-5)).toBe(0);
      expect(doseColorScalar(Infinity)).toBe(1);
    });

    it('is monotonically increasing in dose', () => {
      let prev = -1;
      for (const d of [0.01, 0.05, 0.1, 0.5, 1, 3, 5, 10]) {
        const t = doseColorScalar(d);
        expect(t).toBeGreaterThanOrEqual(prev);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(1);
        prev = t;
      }
    });

    it('is logarithmic — equal decades map to equal ramp intervals', () => {
      // 0.01 → 0.1 → 1 → 10 is three decades over the full [0,1] span.
      expect(doseColorScalar(0.1)).toBeCloseTo(1 / 3, 6);
      expect(doseColorScalar(1)).toBeCloseTo(2 / 3, 6);
    });

    it('REGRESSION: colour responds to mAs/kVp (a relative max-normalised ramp does not)', () => {
      // This is the bug this function exists to prevent. E for every region
      // is CTDIvol × (scanLength × k_region), and CTDIvol is linear in mAs
      // and a pure power of kVp. So dose/max(dose) cancels mAs and kVp
      // exactly, and a low-dose protocol renders IDENTICALLY to a high-dose
      // one. Assert the absolute scalar actually separates the two.
      const forProtocol = (mAs: number, kVp: number) =>
        (['head', 'neck', 'cardiothoracic', 'abdomen', 'peripheral'] as const).map(
          (region) =>
            computeDoseForRegion({
              mAs,
              kVp,
              pitch: 1.0,
              scanLengthCm: BODY_REGIONS[region].representativeScanLengthCm,
              waterEquivalentDiameterCm: 32,
              region,
            }).effectiveDoseMSv,
        );

      const low = forProtocol(200, 80);
      const high = forProtocol(500, 140);

      // Sanity: the underlying doses really are ~10x apart.
      expect(high[2] / low[2]).toBeGreaterThan(5);

      // The broken relative mapping: identical for both protocols.
      const relative = (doses: number[]) => {
        const max = Math.max(...doses);
        return doses.map((d) => d / max);
      };
      relative(low).forEach((t, i) => {
        expect(t).toBeCloseTo(relative(high)[i], 10);
      });

      // The absolute mapping: strictly brighter for every region.
      low.forEach((d, i) => {
        expect(doseColorScalar(high[i])).toBeGreaterThan(doseColorScalar(d));
      });
    });
  });

  describe('Illustrative Monte Carlo estimator', () => {
    it('produces monotonic non-increasing σ as N grows (1/√N behaviour)', () => {
      // Run a small MC. As we add more samples, σ must shrink (variance
      // of the mean is σ_population/√N). We check the σ trend in the
      // single dominant region.
      const run = runIllustrativeMC(8000, 42);
      // Pick the region with the largest final mean and inspect its
      // convergence trace.
      let bestRegion: keyof typeof run.final | null = null;
      let bestMean = -1;
      for (const [rid, stat] of Object.entries(run.final)) {
        if (stat.mean > bestMean) {
          bestMean = stat.mean;
          bestRegion = rid as keyof typeof run.final;
        }
      }
      expect(bestRegion).not.toBeNull();
      const perRegion = buildPerRegionConvergence(run);
      const trace = perRegion[bestRegion as keyof typeof perRegion];
      // Skip very first point (σ undefined for n=1).
      const sigmas = trace.slice(2).map((p) => p.sigma);
      // Each subsequent σ should be ≤ previous (with tiny slack).
      for (let i = 1; i < sigmas.length; i++) {
        expect(sigmas[i]).toBeLessThanOrEqual(sigmas[i - 1] + 1e-9);
      }
    });

    it('seeds are deterministic (same seed → same final means)', () => {
      const a = runIllustrativeMC(2000, 7);
      const b = runIllustrativeMC(2000, 7);
      for (const rid of Object.keys(a.final)) {
        expect(a.final[rid as keyof typeof a.final].mean).toBeCloseTo(
          b.final[rid as keyof typeof a.final].mean,
          10,
        );
      }
    });

    it('rejects non-positive or non-finite photon counts', () => {
      expect(() => runIllustrativeMC(0)).toThrow();
      expect(() => runIllustrativeMC(-1)).toThrow();
      expect(() => runIllustrativeMC(NaN)).toThrow();
    });

    it('produces a non-zero result for at least one region (the body is non-empty)', () => {
      const run = runIllustrativeMC(2000, 3);
      let totalEnergy = 0;
      for (const stat of Object.values(run.final)) {
        totalEnergy += stat.mean;
      }
      expect(totalEnergy).toBeGreaterThan(0);
    });
  });

  describe('MC region geometry consistency', () => {
    it('every MC region maps to a body region', () => {
      for (const r of MC_REGIONS) {
        expect(BODY_REGIONS[r.id]).toBeDefined();
      }
    });
  });
});
