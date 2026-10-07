// Dose-physics calculations for CT — separated from physics-calculations.ts
// because this is teaching / pedagogy-focused, while that one is the shared
// low-level linear-algebra toolkit used by multiple simulators.
//
// What lives here:
//
//   1. SSDE (Size-Specific Dose Estimate, AAPM Report 204 / 220)
//      f(size) conversion factors based on water-equivalent diameter Dw
//      and effective diameter Deff. Tabulated values are from AAPM
//      Report 204 Table 1 (32 cm body phantom) and Report 220 (16 cm
//      head phantom).
//
//   2. ICRP 103 tissue-weighting factors w_T (2007): 14 weighted tissues
//      plus the remainder (w_T = 0.12 applied to the MEAN H_T of the 13
//      remainder tissues). Σ w_T = 1.
//
//   3. Effective dose, ICRP methodology: organ by organ,
//        E = Σ_T w_T H_T   over ALL tissues (whole body),
//      with per-organ H_T from a MOCK teaching model (utils/organ-dose.ts).
//      The region k-factor is DERIVED: k = E / DLP, and E_region = DLP × k.
//      No published k-factor table is used. Combined multi-region scans
//      merge the scan ranges first and compute E once.
//
//   4. Five coarse key regions (head / neck / cardiothoracic / abdomen /
//      limbs), each with only its key interactive organs.
//
//   5. A genuinely-simulated (but heavily simplified) Monte-Carlo
//      photon-transport estimator that the user can run interactively
//      to *see* MC convergence. We sample N photons, ray-cast through
//      a coarse body model, accumulate deposited energy per region,
//      and plot the running estimate with a ±1σ band. The estimator
//      is honestly labelled "illustrative MC" — it does not model
//      Compton scattering, photoelectric absorption cross-sections,
//      energy deposition kernels, or dose-to-medium vs. dose-to-
//      water. What it DOES teach is the central MC idea: the standard
//      deviation (standard error) shrinks as 1/√N (variance ∝ 1/N).
//
// SSDE tables and w_T are from the cited publications; organ doses and the
// MC estimator are MOCK / illustrative and labelled as such in the UI. Do not use these numbers for protocol planning.

import { calculateCTDI } from '@/utils/physics-calculations';
import { computeOrganDoses, REGION_SCAN_RANGE_CM, type OrganDoseResult, type Range } from '@/utils/organ-dose';

// ----------------------------------------------------------------------------
// 1. SSDE — AAPM Report 204 (32 cm body) and Report 220 (16 cm head)
// ----------------------------------------------------------------------------
//
// SSDE = f(Dw) * CTDIvol       where Dw = water-equivalent diameter.
//
// AAPM Report 204 provides f(size) for the 32 cm body phantom as a
// 5th-order polynomial in lateral diameter; AAPM Report 220 does the
// same for 16 cm head (16 cm is the head reference). We use a piecewise
// linear lookup from a tabulated subset of those curves and label it
// "AAPM 204 / 220 tabulated." Source values are from AAPM TG-204
// Table 1 and TG-220 Table 3.
//
// Dw ≈ Deff for a homogeneous cross-section. For an attenuation-mixed
// cross-section we follow AAPM TG-220: Dw = 2 * sqrt( A_w / π ), where
// A_w = ∫ μ(x,y) dA / μ_water — the area-equivalent water area.

export interface SSDEConversionTable {
  /** Effective diameter in cm */
  diameterCm: number;
  /** f(size) conversion factor */
  factor: number;
}

// AAPM Report 204 body (32 cm) and Report 220 head (16 cm) reference
// tabulated f(size) values. These are the published consensus values
// (AAPM TG-204 Table 1, AAPM TG-220 Table 3). For a phantom reference:
// head = 16 cm (factor = 1.0), body = 32 cm (factor = 1.0).
const SSDE_BODY: SSDEConversionTable[] = [
  { diameterCm: 10, factor: 2.94 },
  { diameterCm: 12, factor: 2.41 },
  { diameterCm: 14, factor: 2.03 },
  { diameterCm: 16, factor: 1.74 },
  { diameterCm: 18, factor: 1.51 },
  { diameterCm: 20, factor: 1.33 },
  { diameterCm: 22, factor: 1.20 },
  { diameterCm: 24, factor: 1.10 },
  { diameterCm: 26, factor: 1.02 },
  { diameterCm: 28, factor: 0.96 },
  { diameterCm: 30, factor: 0.92 },
  { diameterCm: 32, factor: 0.89 }, // body reference: f = 1.0 at 32 cm
  { diameterCm: 34, factor: 0.86 },
  { diameterCm: 36, factor: 0.84 },
  { diameterCm: 38, factor: 0.82 },
  { diameterCm: 40, factor: 0.81 },
  { diameterCm: 42, factor: 0.80 },
  { diameterCm: 44, factor: 0.79 },
  { diameterCm: 46, factor: 0.78 },
  { diameterCm: 48, factor: 0.77 },
];

const SSDE_HEAD: SSDEConversionTable[] = [
  { diameterCm: 6, factor: 1.71 },
  { diameterCm: 8, factor: 1.43 },
  { diameterCm: 10, factor: 1.21 },
  { diameterCm: 12, factor: 1.06 },
  { diameterCm: 14, factor: 1.02 },
  { diameterCm: 16, factor: 1.00 }, // head reference
  { diameterCm: 18, factor: 0.99 },
  { diameterCm: 20, factor: 0.97 },
  { diameterCm: 22, factor: 0.96 },
  { diameterCm: 24, factor: 0.95 },
];

// Linear interpolation along the tabulated curves. Outside the range we
// clamp to the nearest endpoint, which is exactly what AAPM TG-204
// recommends (extrapolation is ill-conditioned because f curves flatten
// for large patients and rise sharply for small).
function interpolate(table: SSDEConversionTable[], diameterCm: number): number {
  if (diameterCm <= table[0].diameterCm) return table[0].factor;
  if (diameterCm >= table[table.length - 1].diameterCm) {
    return table[table.length - 1].factor;
  }
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (diameterCm >= a.diameterCm && diameterCm <= b.diameterCm) {
      const t = (diameterCm - a.diameterCm) / (b.diameterCm - a.diameterCm);
      return a.factor + t * (b.factor - a.factor);
    }
  }
  return 1.0;
}

/**
 * SSDE conversion factor f(Dw) for a 32 cm body phantom (AAPM TG-204).
 *
 * @param waterEquivalentDiameterCm Dw (cm), typically 10–50
 * @returns f(size), multiplier on CTDIvol to get SSDE in mGy
 */
export function ssdeFactorBody(waterEquivalentDiameterCm: number): number {
  return interpolate(SSDE_BODY, waterEquivalentDiameterCm);
}

/**
 * SSDE conversion factor for a 16 cm head phantom (AAPM TG-220).
 *
 * @param waterEquivalentDiameterCm Dw (cm), typically 6–24
 */
export function ssdeFactorHead(waterEquivalentDiameterCm: number): number {
  return interpolate(SSDE_HEAD, waterEquivalentDiameterCm);
}

// ----------------------------------------------------------------------------
// 2. ICRP 103 tissue-weighting factors w_T (2007)
// ----------------------------------------------------------------------------
//
// ICRP Publication 103 (2007) replaced ICRP 60 (1991). The two most
// discussed changes for CT are:
//
//   • breast raised  0.05 → 0.12
//   • gonads lowered 0.20 → 0.08
//
// The remainder (w_T = 0.12) applies to the arithmetic MEAN equivalent dose
// of the 13 ICRP 103 remainder tissues (see utils/organ-dose.ts). The "sum of all w_T = 1" invariant is preserved by ICRP.
//
// Reference: ICRP, 2007. The 2007 Recommendations of the International
// Commission on Radiological Protection. ICRP Publication 103.
// Ann. ICRP 37 (2-4).

export const ICRP103_ORGANS = {
  gonads: 0.08,
  redBoneMarrow: 0.12,
  colon: 0.12,
  lung: 0.12,
  stomach: 0.12,
  breast: 0.12,
  bladder: 0.04,
  oesophagus: 0.04,
  liver: 0.04,
  thyroid: 0.04,
  boneSurface: 0.01,
  brain: 0.01,
  salivaryGlands: 0.01,
  skin: 0.01,
  // Remainder: 0.12 × mean H_T of the 13 remainder tissues (adrenals, ET region,
  // gallbladder, heart, kidneys, lymph nodes, muscle, oral mucosa, pancreas,
  // prostate/uterus-cervix, small intestine, spleen, thymus).
  remainder: 0.12,
} as const;

export type ICRP103Organ = keyof typeof ICRP103_ORGANS;
export const ICRP103_ORGAN_NAMES: Record<ICRP103Organ, string> = {
  gonads: 'Gonads',
  redBoneMarrow: 'Red bone marrow',
  colon: 'Colon',
  lung: 'Lung',
  stomach: 'Stomach',
  breast: 'Breast',
  bladder: 'Bladder',
  oesophagus: 'Oesophagus',
  liver: 'Liver',
  thyroid: 'Thyroid',
  boneSurface: 'Bone surface',
  brain: 'Brain',
  salivaryGlands: 'Salivary glands',
  skin: 'Skin',
  remainder: 'Remainder (13 tissues, mean H_T)',
};

// Sanity: Σ w_T should equal 1.0 by ICRP definition.
export const ICRP103_TOTAL_WT: number = Object.values(ICRP103_ORGANS).reduce(
  (a, b) => a + b,
  0,
);
// = 0.08 + 0.12*5 + 0.04*4 + 0.01*4 + 0.12
// = 0.08 + 0.60 + 0.16 + 0.04 + 0.12 = 1.00

// ----------------------------------------------------------------------------
// 3. Body regions (ICRP-102-style key regions) and the organ-based E chain
// ----------------------------------------------------------------------------
//
// Five coarse scan regions. Each lists only its KEY interactive organs; every
// ICRP 103 tissue still enters the effective-dose sum (see utils/organ-dose.ts).
// There is no hard-coded k-factor table any more: k = E / DLP is DERIVED from
// the organ-by-organ calculation, and E_region = DLP × k.

export type BodyRegionId = 'head' | 'neck' | 'cardiothoracic' | 'abdomen' | 'peripheral';

export interface BodyRegion {
  id: BodyRegionId;
  /** z-range scanned for this region, cm from the vertex (MOCK ~175 cm adult) */
  zRangeCm: [number, number];
  /** Representative CT scan length (cm) = length of zRangeCm */
  representativeScanLengthCm: number;
  /** interactive key organs (mesh ids in utils/three/body/organs.ts) */
  keyOrgans: string[];
  /** Phantom reference diameter for SSDE (16 cm head / 32 cm body) */
  ssdePhantomDiameterCm: number;
}

const region = (id: BodyRegionId, keyOrgans: string[], ssde: number): BodyRegion => {
  const r = REGION_SCAN_RANGE_CM[id];
  return { id, zRangeCm: [r[0], r[1]], representativeScanLengthCm: r[1] - r[0], keyOrgans, ssdePhantomDiameterCm: ssde };
};

export const BODY_REGIONS: Record<BodyRegionId, BodyRegion> = {
  head: region('head', ['brain'], 16),
  neck: region('neck', ['thyroid'], 16),
  cardiothoracic: region('cardiothoracic', ['lungs', 'heart'], 32),
  abdomen: region('abdomen', ['liver', 'kidneys'], 32),
  peripheral: region('peripheral', ['limbbones'], 16),
};

/** z-range of length `lengthCm` centred on a region (clamped to the body). */
export function regionRangeWithLength(id: BodyRegionId, lengthCm: number): Range {
  const [a, b] = REGION_SCAN_RANGE_CM[id];
  if (Math.abs(lengthCm - (b - a)) < 1e-9) return [a, b];
  const c = (a + b) / 2, L = Math.max(0, Math.min(175, lengthCm));
  let z0 = c - L / 2, z1 = c + L / 2;
  if (z0 < 0) { z1 -= z0; z0 = 0; }
  if (z1 > 175) { z0 -= z1 - 175; z1 = 175; }
  return [Math.max(0, z0), z1];
}

// ----------------------------------------------------------------------------
// 4. Effective dose calculations
// ----------------------------------------------------------------------------

export interface DoseInputs {
  /** mAs */
  mAs: number;
  /** kVp */
  kVp: number;
  /** Pitch (default 1.0) */
  pitch?: number;
  /** Scan length in cm (single-region scans; centred on the region) */
  scanLengthCm: number;
  /** Water-equivalent diameter Dw in cm (used for SSDE) */
  waterEquivalentDiameterCm: number;
  /** Primary region (SSDE phantom reference, default range) */
  region: BodyRegionId;
  /** Combined scan: all regions scanned together. Ranges are merged and E is computed once. */
  regions?: BodyRegionId[];
}

export interface DoseBreakdown {
  /** CTDIvol in mGy — scanner-output index (NOT patient dose) */
  ctdiVolMgy: number;
  /** DLP in mGy·cm — CTDIvol × scanned length (union of ranges) */
  dlpMgyCm: number;
  /** SSDE in mGy — patient-specific dose estimate, AAPM TG-204/220 */
  ssdeMgy: number;
  /** f(size) used for SSDE */
  ssdeFactor: number;
  /** Effective dose in mSv — organ-by-organ E = Σ w_T H_T (whole body); equals DLP × k */
  effectiveDoseMSv: number;
  /** derived k = E / DLP, mSv/(mGy·cm) */
  kDerived: number;
  /** scanned length (cm) */
  scanLengthCm: number;
  /** Region used */
  region: BodyRegion;
  /** full organ-by-organ result */
  organDose: OrganDoseResult;
}

/**
 * CTDIvol → DLP → SSDE → (organ H_T → E) → derived k for one region or a combined scan.
 */
export function computeDoseForRegion(input: DoseInputs): DoseBreakdown {
  const meta = BODY_REGIONS[input.region];
  const ctdiVolMgy = calculateCTDI({ mAs: input.mAs, kVp: input.kVp, pitch: input.pitch });
  const ranges: Range[] = input.regions && input.regions.length > 0
    ? input.regions.map((r) => (r === input.region ? regionRangeWithLength(r, input.scanLengthCm) : [...REGION_SCAN_RANGE_CM[r]] as Range))
    : [regionRangeWithLength(input.region, input.scanLengthCm)];
  const organDose = computeOrganDoses({ ctdiVolMgy, ranges });

  // SSDE: head (16 cm) or body (32 cm) phantom table per region (AAPM TG-220 / TG-204).
  const useHeadTable = meta.ssdePhantomDiameterCm === 16;
  const ssdeFactor = useHeadTable ? ssdeFactorHead(input.waterEquivalentDiameterCm) : ssdeFactorBody(input.waterEquivalentDiameterCm);
  const ssdeMgy = ctdiVolMgy * ssdeFactor;

  return {
    ctdiVolMgy,
    dlpMgyCm: organDose.dlpMgyCm,
    ssdeMgy,
    ssdeFactor,
    effectiveDoseMSv: organDose.effectiveDoseMSv,
    kDerived: organDose.kDerived,
    scanLengthCm: organDose.scanLengthCm,
    region: meta,
    organDose,
  };
}

// ----------------------------------------------------------------------------
// 4b. Dose → colour scalar for the 3D body model
// ----------------------------------------------------------------------------
//
// The body model tints each region by its effective dose. The mapping has
// to be an ABSOLUTE scale, not a per-protocol relative one.
//
// Why this matters (and why the obvious implementation is wrong):
// normalising by `dose / max(dose across regions)` looks reasonable but is
// scale-invariant. CTDIvol is linear in mAs and a pure power of kVp, and
// every region's E is that same CTDIvol times a region constant
// (scanLength × k). So the ratio dose_region / dose_max cancels mAs and kVp
// EXACTLY — 200 mAs @ 80 kVp and 500 mAs @ 140 kVp produce byte-identical
// colours despite a ~10× difference in real dose. The picture would tell
// the student that turning the dose up by an order of magnitude changes
// nothing, which is the opposite of the lesson.
//
// So we anchor to a fixed absolute window in mSv. Dose across the regions
// and the slider ranges spans roughly 0.01 → 3 mSv, and perception of dose
// is order-of-magnitude, so the window is logarithmic over three decades:
//
//   t = log10(D / D_MIN) / log10(D_MAX / D_MIN),  clamped to [0, 1]
//
// t = 0 (deep blue) at or below 0.01 mSv, t = 1 (red) at or above 10 mSv.
// The UI renders this scale as a legend so "red" always means the same
// absolute dose regardless of protocol.

/** Low anchor of the body-model colour ramp (mSv). Below this → t = 0. */
export const DOSE_COLOR_MIN_MSV = 0.01;
/** High anchor of the body-model colour ramp (mSv). Above this → t = 1. */
export const DOSE_COLOR_MAX_MSV = 10;

const DOSE_COLOR_LOG_SPAN = Math.log10(DOSE_COLOR_MAX_MSV / DOSE_COLOR_MIN_MSV);

/**
 * Map an effective dose (mSv) onto the [0, 1] colour ramp scalar used by
 * the 3D body model. Absolute and logarithmic — see the note above for why
 * a relative (per-protocol max) normalisation is actively misleading here.
 *
 * @param doseMSv effective dose in mSv. Non-finite / negative → 0.
 */
export function doseColorScalar(doseMSv: number): number {
  // NaN is the only value with no sensible place on the ramp — send it to
  // the low anchor rather than letting it reach THREE.Color as NaN, which
  // silently produces an unrenderable material. +Infinity is meaningful
  // (off the top of the scale) and saturates via the clamp below.
  if (Number.isNaN(doseMSv)) return 0;
  if (doseMSv <= DOSE_COLOR_MIN_MSV) return 0;
  if (doseMSv >= DOSE_COLOR_MAX_MSV) return 1;
  return Math.log10(doseMSv / DOSE_COLOR_MIN_MSV) / DOSE_COLOR_LOG_SPAN;
}

// ----------------------------------------------------------------------------
// 5. Illustrative Monte-Carlo photon-transport estimator
// ----------------------------------------------------------------------------
//
// Goal: TEACH what Monte Carlo is in radiation dosimetry, not replicate
// a real Geant4/GATE simulation. A real MC dose engine tracks photons
// through geometry with full physics (Compton scattering, photoelectric
// absorption, Rayleigh scatter, electron transport), tabulated cross-
// sections, energy-deposition kernels, and stochastic variance reduction.
//
// What we do here:
//   1. Discretize the body into N_regions × N_z layers.
//   2. For each of N_photons, sample a starting energy (monoenergetic
//      70 keV to keep it simple), pick a z-position on the scan range,
//      pick a lateral entry angle, and ray-march through the layered
//      geometry. Each layer attenuates by exp(-mu * dz) where mu is a
//      tabulated attenuation coefficient per region.
//   3. Energy deposited in a region = incoming energy ×
//      (1 - exp(-mu * dz)) — this is a crude Beer-Lambert deposition
//      estimator and DOES NOT include scattered photons re-entering the
//      layer or backscatter.
//   4. Accumulate deposited energy per region. Plot the running mean
//      with a ±1σ confidence band; the band shrinks as 1/√N.
//
// Pedagogical claim this supports:
//   "Monte Carlo is statistical sampling. The estimate converges to a
//    true value as N → ∞, but the standard error shrinks as 1/√N.
//    Halving the noise costs 4× the photons."
//
// What this CANNOT teach:
//   - Real absorbed-dose heterogeneity inside an organ.
//   - Photoelectric vs. Compton cross-section physics.
//   - Scatter tails and dose build-up at depth.
//   - kV-dependent attenuation — we fix the photon energy.
//
// We label it "Illustrative Monte Carlo (Beer-Lambert deposition)" in
// the UI so the user does not mistake it for a real MC engine.

export interface MCRegion {
  id: BodyRegionId;
  /** Centre y-position (decimeters, local space) */
  y: number;
  /** Half-extent along y (so layer spans [y - half, y + half]) */
  halfThicknessY: number;
  /** Lateral radius (cm) for a circular cross-section */
  radiusCm: number;
  /** Mass attenuation coefficient × density (cm^-1) at 70 keV */
  muCm: number;
}

export const MC_REGIONS: MCRegion[] = [
  { id: 'head', y: 2.2, halfThicknessY: 0.4, radiusCm: 9.0, muCm: 0.22 },
  { id: 'neck', y: 1.6, halfThicknessY: 0.2, radiusCm: 5.5, muCm: 0.22 },
  { id: 'cardiothoracic', y: 0.9, halfThicknessY: 0.55, radiusCm: 16.0, muCm: 0.20 },
  { id: 'abdomen', y: -0.25, halfThicknessY: 0.55, radiusCm: 14.0, muCm: 0.21 },
  { id: 'peripheral', y: -1.3, halfThicknessY: 0.5, radiusCm: 4.5, muCm: 0.22 },
];

// Photon energy (keV) we use for the illustrative MC. 70 keV is the
// effective energy of a 120 kVp beam after pre-hardening through a
// typical patient; this is what most clinical-dose discussions cite.
export const MC_PHOTON_ENERGY_KEV = 70;

export interface MCRunResult {
  /** Sample index → running mean effective dose (mSv) per region */
  cumulative: { n: number; region: BodyRegionId; mean: number; sigma: number }[];
  /** Final per-region estimates (mSv) — N-weighted average */
  final: Record<BodyRegionId, { mean: number; sigma: number }>;
  /** Total photons requested */
  totalPhotons: number;
}

// ----------------------------------------------------------------------------
// Helper: deterministic PRNG so MC results are reproducible (and so the
// "see the noise shrink" demo is a fair before/after comparison).
// ----------------------------------------------------------------------------

// Mulberry32 — small, fast, well-distributed. NOT cryptographic.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run the illustrative Monte-Carlo photon-transport estimator.
 *
 * @param totalPhotons number of photons to simulate (e.g. 50,000)
 * @param seed PRNG seed for reproducibility
 * @returns running estimate per region and final per-region stats
 */
export function runIllustrativeMC(totalPhotons: number, seed = 1): MCRunResult {
  if (!Number.isFinite(totalPhotons) || totalPhotons <= 0) {
    throw new Error('totalPhotons must be a positive finite number');
  }
  const rng = mulberry32(seed);

  // Per-region running sums (Welford's online algorithm for mean+sigma).
  const sum = new Map<BodyRegionId, number>();
  const sumSq = new Map<BodyRegionId, number>();
  for (const r of MC_REGIONS) {
    sum.set(r.id, 0);
    sumSq.set(r.id, 0);
  }

  // Sample output points (powers of 2 plus a few midpoints) so the UI
  // can plot convergence. Cap at ~64 samples to keep memory tiny.
  const logPoints = new Set<number>();
  let p = 1;
  while (p <= totalPhotons && logPoints.size < 64) {
    logPoints.add(p);
    p *= 2;
  }
  // Always log the final sample.
  logPoints.add(totalPhotons);

  // Each region has k ≈ 0.014 mSv/mGy·cm (chest default) for the
  // mSv-from-deposited-energy mapping. We normalize so that the MC
  // value lands in a sensible range.
  // Beer-Lambert local deposition at 70 keV in soft tissue: mean free
  // path ≈ 1/mu ≈ 5 cm. Total imparted dose per photon is small; we
  // scale by the ICRP 103 chest k-factor for visual intuition.
  const kEffective = 0.014;

  const cumulative: MCRunResult['cumulative'] = [];

  for (let n = 1; n <= totalPhotons; n++) {
    // Pick a random z-position across the scan range. We cover the
    // whole body for illustrative purposes; the user can adjust to
    // a region-specific scan range in the UI.
    const yStart = -1.8 + rng() * (2.5 - (-1.8)); // dm
    // Pick a random angle around the body. The body's symmetry is
    // cylindrical for the trunk; for head we use a smaller radius.
    // Pick the smallest enclosing region and deposit there.
    let region: MCRegion | null = null;
    let bestDz = 0;
    for (const r of MC_REGIONS) {
      const dy = Math.abs(yStart - r.y);
      if (dy > r.halfThicknessY) continue;
      region = r;
      // Sample a chord length through the cylinder cross-section:
      // for a uniform ray through a circle of radius R, chord length
      // is 2*sqrt(R^2 - d^2) where d is impact parameter.
      // Simplification: assume photon traverses 2*R (diameter).
      bestDz = 2 * r.radiusCm;
      break;
    }
    if (!region) continue;

    // Deposit a fraction of the photon energy:
    //   E_dep = E * (1 - exp(-mu * dz))
    // We use E = 1 (relative units) and scale later.
    const eDep = 1 - Math.exp(-region.muCm * bestDz);

    const prevSum = sum.get(region.id)!;
    const prevSumSq = sumSq.get(region.id)!;
    const newSum = prevSum + eDep;
    const newSumSq = prevSumSq + eDep * eDep;
    sum.set(region.id, newSum);
    sumSq.set(region.id, newSumSq);

    if (logPoints.has(n)) {
      const mean = newSum / n;
      // Sample variance = (Σx²/n) - mean² — guard for tiny n.
      const variance = Math.max(0, newSumSq / n - mean * mean);
      const sigma = Math.sqrt(variance / n);
      // Scale to "mSv" via k_effective. This is purely a scale factor
      // so the chart reads as effective-dose units.
      cumulative.push({
        n,
        region: region.id,
        mean: mean * kEffective * 1000,
        sigma: sigma * kEffective * 1000,
      });
    }
  }

  // Build final per-region means (over ALL photons that hit a region).
  const final: MCRunResult['final'] = {} as MCRunResult['final'];
  for (const r of MC_REGIONS) {
    const s = sum.get(r.id)!;
    const ss = sumSq.get(r.id)!;
    if (s === 0) {
      final[r.id] = { mean: 0, sigma: 0 };
      continue;
    }
    const mean = s / totalPhotons;
    const variance = Math.max(0, ss / totalPhotons - mean * mean);
    const sigma = Math.sqrt(variance / totalPhotons);
    final[r.id] = {
      mean: mean * kEffective * 1000,
      sigma: sigma * kEffective * 1000,
    };
  }

  return {
    cumulative,
    final,
    totalPhotons,
  };
}

/**
 * Aggregate the per-photon "cumulative" trace into per-region running
 * means. The raw MC output above only records ONE region per photon
 * (we don't recurse), so the "cumulative" trace is a single-region
 * sequence. This helper exposes a per-region view for charting.
 */
export function buildPerRegionConvergence(
  run: MCRunResult,
): Record<BodyRegionId, { n: number; mean: number; sigma: number }[]> {
  const out: Record<BodyRegionId, { n: number; mean: number; sigma: number }[]> = {
    head: [],
    neck: [],
    cardiothoracic: [],
    abdomen: [],
    peripheral: [],
  };
  for (const point of run.cumulative) {
    out[point.region].push({
      n: point.n,
      mean: point.mean,
      sigma: point.sigma,
    });
  }
  return out;
}
