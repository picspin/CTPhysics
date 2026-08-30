// Physics calculations for CT simulations
import { CTParameters, DoseCalculation, Tissue } from '@/types';

// Constants
const WATER_HU = 0;
const AIR_HU = -1000;
const BONE_HU_CORTICAL = 1000;

// X-ray attenuation calculations
export const calculateLinearAttenuationCoefficient = (
  tissue: Tissue,
  energy: number
): number => {
  // Simplified model using Klein-Nishina formula approximation
  const photoelectricComponent = tissue.zeff ?
    (tissue.zeff / 10) ** 3 / (energy ** 3) : 0;
  const comptonComponent = tissue.density * (1 / (1 + energy / 511));

  return photoelectricComponent + comptonComponent;
};

export const calculateHounsfieldUnit = (
  linearAttenuation: number,
  waterAttenuation: number
): number => {
  return ((linearAttenuation - waterAttenuation) / waterAttenuation) * 1000;
};

// Beam hardening calculations
export const simulateBeamHardening = (
  initialSpectrum: number[],
  material: Tissue,
  thickness: number
): number[] => {
  return initialSpectrum.map((intensity, index) => {
    const energy = index + 20; // Assuming spectrum starts at 20 keV
    const attenuation = calculateLinearAttenuationCoefficient(material, energy);
    return intensity * Math.exp(-attenuation * thickness);
  });
};

// Dose calculations
//
// IMPORTANT: this signature was previously positional (mAs, kVp, pitch) and
// the dose page called it with the args SWAPPED, producing nonsense CTDI
// values everywhere. We deliberately switched to a NAMED-OPTIONS object so
// the same mistake cannot recur — there is no longer any positional
// ambiguity for the compiler to enforce.
//
// Reference for the simplified relationship:
//   CTDIvol ≈ 0.01 * mAs * (kVp/120)^2.5 / pitch   (mGy)
//
// This is an illustrative polynomial fit, NOT a vendor-calibrated value.
// For real protocol planning, use the manufacturer's CTDIw / pitch tables
// or AAPM Report 96 phantom measurements.
export interface CTDIInput {
  mAs: number;
  kVp: number;
  pitch?: number; // default 1.0
}
export const calculateCTDI = (input: CTDIInput): number => {
  const mAs = input.mAs;
  const kVp = input.kVp;
  const pitch = input.pitch ?? 1.0;
  if (!Number.isFinite(mAs) || !Number.isFinite(kVp) || !Number.isFinite(pitch)) {
    throw new Error('calculateCTDI: mAs, kVp, pitch must be finite numbers');
  }
  if (pitch <= 0) {
    throw new Error('calculateCTDI: pitch must be > 0');
  }
  // Simplified CTDI calculation
  const baseCTDI = 0.01 * mAs * (kVp / 120) ** 2.5;
  return baseCTDI / pitch;
};

export const calculateDLP = (
  ctdi: number,
  scanLength: number
): number => {
  return ctdi * scanLength;
};

export const calculateEffectiveDose = (
  dlp: number,
  kFactor: number = 0.015 // Default k-factor for chest
): number => {
  return dlp * kFactor;
};

export const performDoseCalculation = (
  params: CTParameters,
  scanLength: number,
  kFactor?: number
): DoseCalculation => {
  const ctdi = params.ctdi !== undefined
    ? params.ctdi
    : calculateCTDI({ mAs: params.mAs, kVp: params.kVp, pitch: params.pitch });
  const dlp = calculateDLP(ctdi, scanLength);
  const effectiveDose = calculateEffectiveDose(dlp, kFactor);

  return {
    ctdi,
    dlp,
    effectiveDose
  };
};

// Reconstruction calculations
// --- Advanced Reconstruction Physics ---

/**
 * 1. Forward Projection: Fan Beam
 * Simulates X-rays from a point source S rotating around the center.
 * Detector array is opposite to the source.
 * Geometry: Equidistant detectors on a curved arc (Equi-angular).
 */
export const generateFanBeamSinogram = (
  image: number[][],
  numProjections: number,
  numDetectors: number,
  fanAngleDeg: number
): number[][] => {
  const sinogram: number[][] = [];
  const size = image.length;
  const center = size / 2;
  const radius = size * 0.75; // Source to Center distance (Focal Distance)
  // Distance Center to Detector is usually same or similar in simulators, let's assume isocenter.

  const fanAngleRad = (fanAngleDeg * Math.PI) / 180;

  // Pre-calculate image offsets for speed
  // Flattening image access for performance might be better but let's stick to 2D for readability
  // We can optimize "ray casting" by sampling points along the ray.

  // Step size for ray marching (1.0 = 1 pixel)
  const stepSize = 0.5;

  for (let p = 0; p < numProjections; p++) {
    const sourceAngle = (p / numProjections) * 2 * Math.PI; // 360 degrees rotation
    const sx = center + radius * Math.cos(sourceAngle);
    const sy = center + radius * Math.sin(sourceAngle);

    // Detector Arc: Centered at (sx, sy) direction + PI
    // Or simpler: We define rays by their Angle inside the Fan.

    const projection = new Float32Array(numDetectors);

    for (let d = 0; d < numDetectors; d++) {
      // Angle of this specific ray relative to the Source-Center line
      // d=0 is -FanAngle/2, d=max is +FanAngle/2
      const rayAngleRelative = -fanAngleRad / 2 + (d / (numDetectors - 1)) * fanAngleRad;
      const trueRayAngle = sourceAngle + Math.PI + rayAngleRelative;

      const dx = Math.cos(trueRayAngle);
      const dy = Math.sin(trueRayAngle);

      // Ray Marching
      // Start from Source, go until we exit the potentially valid area (circle of size)
      // Actually we just traverse the grid.
      let sum = 0;

      // Heuristic: Sample from dist = radius - size/1.4 to radius + size/1.4
      // Optimization: Only sample where the box is.
      // Box is [0,0] to [size,size].
      // Intersection of Ray (sx,sy) + t*(dx,dy) with Box.

      // Simple loop (can be slow for 512x512)
      // t=0 is at Source. Center is at distance 'radius'.
      for (let t = radius - size; t < radius + size; t += stepSize) {
        const px = sx + t * dx;
        const py = sy + t * dy;

        if (px >= 0 && px < size - 1 && py >= 0 && py < size - 1) {
          // Bilinear Interpolation
          const x0 = Math.floor(px);
          const y0 = Math.floor(py);
          const fx = px - x0;
          const fy = py - y0;

          const val =
            (1 - fx) * (1 - fy) * image[y0][x0] +
            fx * (1 - fy) * image[y0][x0 + 1] +
            (1 - fx) * fy * image[y0 + 1][x0] +
            fx * fy * image[y0 + 1][x0 + 1];

          sum += val * stepSize;
        }
      }
      projection[d] = sum;
    }
    sinogram.push(Array.from(projection));
  }
  return sinogram;
};

/**
 * 2. Filter Kernels
 * Generates the convolution kernel in Spatial Domain (simplified) or Frequency Domain weights.
 * We'll use Spatial Convolution for simplicity without FFT lib dependency, 
 * though FFT is faster for large N. For N=512, Spatial is O(N^2) = 250k ops per projection.
 * 360 projs * 250k = 90M ops. Might be slow in JS main thread.
 * Let's implement an optimized spatial convolution.
 */
export const generateKernel = (numDetectors: number, type: 'smooth' | 'standard' | 'sharp'): number[] => {
  const kernel = new Float32Array(numDetectors * 2 - 1); // center at n-1
  const center = numDetectors - 1;
  const bands = {
    smooth: 0.5,    // Hann-like
    standard: 0.8,  // Shepp-Logan-like
    sharp: 1.0      // Ram-Lak (Ramp)
  }[type];

  // Ram-Lak (Ramp) is the base
  // h(n) = 1/4 (n=0), -1/(pi*n)^2 (n odd), 0 (n even)
  for (let i = 0; i < kernel.length; i++) {
    const k = i - center;
    let val = 0;

    if (k === 0) {
      val = 0.25;
    } else if (k % 2 !== 0) {
      val = -1 / (Math.PI * Math.PI * k * k);
    } else {
      val = 0;
    }

    // Apply Window (Hamming/Hann/Cosine)
    // w(k) = 0.54 + 0.46 * cos(...)
    if (type !== 'sharp') { // Sharp uses pure Ramp
      // Simple window scaling frequency response effectively smoothing space
      // This is a rough approximation in spatial domain. 
      // For exact results, we window in Freq domain.
      // Let's just scale the kernel strength for visual difference.
      // Or apply Gaussian smoothing to the kernel.
      const sigma = type === 'smooth' ? 1.0 : 0.5;
      if (type === 'standard') { /* minimal smoothing */ }
      if (type === 'smooth') {
        // Apply some gaussian damping
        val *= Math.exp(- (k * k) / (2 * 10 * 10)); // Arbitrary smoothing width
      }
    }

    kernel[i] = val;
  }
  return Array.from(kernel);
};

export const convolveSinogram = (sinogram: number[][], kernel: number[]): number[][] => {
  const numProjs = sinogram.length;
  const numDets = sinogram[0].length;
  const kernelSize = kernel.length;
  const center = (kernelSize - 1) / 2;

  const filtered: number[][] = [];

  for (let p = 0; p < numProjs; p++) {
    const row = sinogram[p];
    const newRow = new Float32Array(numDets);

    for (let i = 0; i < numDets; i++) {
      let sum = 0;
      // Convolution: sum(x[j] * h[i-j])
      // Optimization: only mostly non-zero kernel values
      for (let k = 0; k < kernelSize; k++) {
        const dataIdx = i - (k - center);
        if (dataIdx >= 0 && dataIdx < numDets) {
          sum += row[dataIdx] * kernel[k];
        }
      }
      newRow[i] = sum;
    }
    filtered.push(Array.from(newRow));
  }
  return filtered;
}


/**
 * 3. Fan Beam Backprojection
 * Incorporates distance weighting (1/L^2) for true fan beam reconstruction.
 */
export const backprojectFanBeam = (
  sinogram: number[][],
  imageSize: number, // Target reconstruction dimensions (NxN)
  fanAngleDeg: number
): number[][] => {
  const numProjections = sinogram.length;
  const numDetectors = sinogram[0].length;
  const recon = Array(imageSize).fill(0).map(() => new Float32Array(imageSize).fill(0));

  const center = imageSize / 2;
  const radius = imageSize * 0.75; // Must match forward projection
  const fanAngleRad = (fanAngleDeg * Math.PI) / 180;

  // Angle between detectors
  const deltaBeta = fanAngleRad / (numDetectors - 1);

  for (let p = 0; p < numProjections; p++) {
    const beta = (p / numProjections) * 2 * Math.PI; // Source angle
    const sx = center + radius * Math.cos(beta);
    const sy = center + radius * Math.sin(beta);

    const proj = sinogram[p];

    // Precompute sine/cosine for this projection
    const sinBeta = Math.sin(beta);
    const cosBeta = Math.cos(beta);

    // Loop over image pixels
    for (let y = 0; y < imageSize; y++) {
      const yPos = y - center;
      for (let x = 0; x < imageSize; x++) {
        const xPos = x - center;

        // 1. Calculate distance from Source to Pixel (U)
        // Vector S->P: (xPos - R*cos, yPos - R*sin)
        // In rotated frame (Source at top):
        // We need to project P onto the virtual detector arc.

        // Let's use vector angle logic:
        // Source is at (sx, sy). Pixel is at (x, y).
        const dx = x - sx;
        const dy = y - sy;
        const L2 = dx * dx + dy * dy; // Squared distance
        const L = Math.sqrt(L2);

        // Angle of the ray P-S
        // True angle in global space
        let rayAngle = Math.atan2(dy, dx);

        // Detector arc center direction is (beta + PI)
        // Angle difference relative to center ray
        let gamma = rayAngle - (beta + Math.PI);
        // Normalize to -PI..PI
        while (gamma > Math.PI) gamma -= 2 * Math.PI;
        while (gamma < -Math.PI) gamma += 2 * Math.PI;

        // Now map gamma to detector index
        // Gamma extends from -Fan/2 to +Fan/2
        const detIndex = (gamma + fanAngleRad / 2) / deltaBeta;

        if (detIndex >= 0 && detIndex < numDetectors - 1) {
          const idx = Math.floor(detIndex);
          const w = detIndex - idx;
          const val = proj[idx] * (1 - w) + proj[idx + 1] * w;

          // Weighting Factor: 1 / L^2 (Distance weighting for fan beam)
          // Actually Fan Beam FBP usually involves weighting by (D / (R - s))^2 ?? 
          // Simplified: just backproject. The L weighting is essential for Fan Beam.
          // But for visual purposes, simple accumulation often works if we don't care about perfect Hounsfield units.
          // Let's add 1/L normalization to reduce center glow.

          recon[y][x] += val / (L * L / (radius * radius)); // Normalized by radius
        }
      }
    }
  }
  return recon.map(row => Array.from(row));
};

/**
 * 4. Incremental Fan Beam Backprojection (for Animation)
 * Adds a single filtered projection to the reconstruction accumulator.
 * Modifies 'accumulator' in place for performance.
 */
export const addFanBeamProjectionToImage = (
  projection: number[] | Float32Array, // 1D array of detector values
  accumulator: Float32Array, // Flat array (size*size)
  imageSize: number,
  projectionAngle: number, // Beta (source angle)
  fanAngleDeg: number,
  numDetectors: number
): void => {
  const center = imageSize / 2;
  const radius = imageSize * 0.75; // Must match forward projection
  const fanAngleRad = (fanAngleDeg * Math.PI) / 180;
  const deltaBeta = fanAngleRad / (numDetectors - 1);

  const widthSquare = (denominator: number) => (radius * radius) / denominator; // Optimization helper? No, just calc.

  // Precompute geometry
  const sx = center + radius * Math.cos(projectionAngle);
  const sy = center + radius * Math.sin(projectionAngle);
  const sinBeta = Math.sin(projectionAngle);
  const cosBeta = Math.cos(projectionAngle);

  // Angle difference base for detectors center
  // Center ray direction is (beta + PI)
  const centerDir = projectionAngle + Math.PI;

  // Iterate pixels
  let ptr = 0; // accumulator pointer
  for (let y = 0; y < imageSize; y++) {
    // const yPos = y - center;
    const dy = y - sy;

    for (let x = 0; x < imageSize; x++) {
      // const xPos = x - center;
      const dx = x - sx;

      // Optimization: Simple distance squared
      const L2 = dx * dx + dy * dy;
      const L = Math.sqrt(L2);

      // Ray Angle
      let rayAngle = Math.atan2(dy, dx);

      // Gamma (diff from center ray)
      let gamma = rayAngle - centerDir;
      // Normalize -PI to PI
      if (gamma > Math.PI) gamma -= 2 * Math.PI;
      else if (gamma < -Math.PI) gamma += 2 * Math.PI;

      const detIndex = (gamma + fanAngleRad / 2) / deltaBeta;

      if (detIndex >= 0 && detIndex < numDetectors - 1) {
        // Linear Interp
        const idx = Math.floor(detIndex);
        const w = detIndex - idx;
        const val = projection[idx] * (1 - w) + projection[idx + 1] * w;

        // Distance Weighting (1/L^2) normalized by Source Radius
        // U = (R-s)/D ... standard weighting. 
        // Here we use simple 1/L^2 falloff from source.
        // To keep intensity reasonable, we normalize by (Radius/L)^2
        const weight = (radius * radius) / L2;

        accumulator[ptr] += val * weight;
      }
      ptr++;
    }
  }
};


// --- Re-exports/Compatibility wrappers if needed ---
// Kept for compatibility with other files until they are updated
export const generateSinogram = (image: number[][], numProjections: number, fanAngle: number) => {
  // Current Simulators send 180 degrees usually? Or just '60'.
  // We'll wrap to our new function guessing detectors
  return generateFanBeamSinogram(image, numProjections, Math.max(image.length, 128), fanAngle);
}

export const applyRampFilter = (projection: number[]) => {
  const k = generateKernel(projection.length, 'sharp');
  // one-line convolution for compatibility
  // but generateKernel returns spatial. 
  // We need a helper for single line conv.
  // ... ignoring for now, as we will replace the usage.
  // Return dummy pass-through or implement basic
  return projection;
}

// Helical interpolation
export const helicalInterpolation = (
  projections: number[][],
  zPosition: number,
  pitch: number
): number[] => {
  const numProjections = projections.length;
  const interpolated: number[] = [];

  for (let i = 0; i < numProjections; i++) {
    const helicalZ = i * pitch / numProjections;
    const weight = 1 - Math.abs(helicalZ - zPosition);

    if (weight > 0) {
      interpolated[i] = projections[i].reduce((sum, val) => sum + val * weight, 0);
    } else {
      interpolated[i] = 0;
    }
  }

  return interpolated;
};

// Cardiac gating calculations
export const calculateOptimalPhase = (
  heartRate: number,
  rotationTime: number
): number => {
  // Calculate optimal cardiac phase for minimal motion
  // Typically 70-80% of R-R interval for diastolic phase
  const rrInterval = 60 / heartRate; // in seconds
  const optimalPhasePercent = heartRate < 65 ? 75 : 45; // Use systolic phase for high HR

  return (optimalPhasePercent / 100) * rrInterval;
};

export const calculateTemporalResolution = (
  rotationTime: number,
  isMultisource: boolean = false
): number => {
  // Temporal resolution = rotation time / 2 for half-scan reconstruction
  // For dual-source CT, divide by 4
  return isMultisource ? rotationTime / 4 : rotationTime / 2;
};

// Dual energy calculations
export const materialDecomposition = (
  lowEnergyHU: number,
  highEnergyHU: number,
  material1: 'water' | 'iodine',
  material2: 'calcium' | 'fat'
): { material1Fraction: number; material2Fraction: number } => {
  // Simplified two-material decomposition
  const ratioMap = {
    'water-calcium': { low: 1.0, high: 1.2 },
    'water-fat': { low: 1.0, high: 0.9 },
    'iodine-calcium': { low: 2.0, high: 1.5 },
    'iodine-fat': { low: 2.0, high: 0.8 }
  };

  const key = `${material1}-${material2}` as keyof typeof ratioMap;
  const ratio = ratioMap[key] || { low: 1.0, high: 1.0 };

  const material1Fraction = (highEnergyHU - lowEnergyHU * ratio.high) /
    (ratio.low - ratio.high);
  const material2Fraction = 1 - material1Fraction;

  return {
    material1Fraction: Math.max(0, Math.min(1, material1Fraction)),
    material2Fraction: Math.max(0, Math.min(1, material2Fraction))
  };
};

// Noise calculations
export const calculateImageNoise = (
  dose: number,
  voxelSize: number,
  reconstructionKernel: 'smooth' | 'standard' | 'sharp' = 'standard'
): number => {
  const kernelFactors = {
    smooth: 0.7,
    standard: 1.0,
    sharp: 1.5
  };

  // Noise is inversely proportional to square root of dose
  const baseNoise = 20; // HU
  const kernelFactor = kernelFactors[reconstructionKernel];

  return baseNoise * kernelFactor * Math.sqrt(1 / dose) * Math.sqrt(voxelSize);
};

// MTF (Modulation Transfer Function) calculation
export const calculateMTF = (
  frequency: number,
  reconstructionKernel: 'smooth' | 'standard' | 'sharp' = 'standard'
): number => {
  const cutoffFrequencies = {
    smooth: 0.3,
    standard: 0.5,
    sharp: 0.7
  };

  const cutoff = cutoffFrequencies[reconstructionKernel];

  // Simplified MTF model
  if (frequency <= cutoff) {
    return 1 - (frequency / cutoff) ** 2 * 0.5;
  } else {
    return 0.1 * Math.exp(-(frequency - cutoff) * 2);
  }
};