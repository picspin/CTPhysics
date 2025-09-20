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
export const calculateCTDI = (
  mAs: number,
  kVp: number,
  pitch: number = 1
): number => {
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
  const ctdi = params.ctdi || calculateCTDI(params.mAs, params.kVp, params.pitch);
  const dlp = calculateDLP(ctdi, scanLength);
  const effectiveDose = calculateEffectiveDose(dlp, kFactor);
  
  return {
    ctdi,
    dlp,
    effectiveDose
  };
};

// Reconstruction calculations
export const generateSinogram = (
  image: number[][],
  numProjections: number,
  fanBeamAngle: number
): number[][] => {
  const sinogram: number[][] = [];
  const imageSize = image.length;
  const center = imageSize / 2;
  
  for (let i = 0; i < numProjections; i++) {
    const angle = (i / numProjections) * Math.PI;
    const projection: number[] = [];
    
    // Simulate fan-beam projection
    const numDetectors = Math.floor(imageSize * (fanBeamAngle / 90));
    for (let d = 0; d < numDetectors; d++) {
      let sum = 0;
      const detectorAngle = ((d / numDetectors) - 0.5) * (fanBeamAngle * Math.PI / 180);
      
      // Ray tracing through the image
      for (let t = 0; t < imageSize; t++) {
        const x = center + t * Math.cos(angle + detectorAngle) - center;
        const y = center + t * Math.sin(angle + detectorAngle) - center;
        
        if (x >= 0 && x < imageSize && y >= 0 && y < imageSize) {
          // Bilinear interpolation
          const x0 = Math.floor(x);
          const x1 = Math.ceil(x);
          const y0 = Math.floor(y);
          const y1 = Math.ceil(y);
          
          if (x1 < imageSize && y1 < imageSize) {
            const fx = x - x0;
            const fy = y - y0;
            
            const value = (1 - fx) * (1 - fy) * image[y0][x0] +
                         fx * (1 - fy) * image[y0][x1] +
                         (1 - fx) * fy * image[y1][x0] +
                         fx * fy * image[y1][x1];
            sum += value;
          }
        }
      }
      projection.push(sum);
    }
    sinogram.push(projection);
  }
  
  return sinogram;
};

// Apply ramp filter for filtered backprojection
export const applyRampFilter = (projection: number[]): number[] => {
  const n = projection.length;
  const filtered = new Array(n).fill(0);
  
  // Simple ramp filter implementation
  for (let i = 0; i < n; i++) {
    filtered[i] = projection[i];
    if (i > 0) {
      filtered[i] -= projection[i - 1] * 0.5;
    }
    if (i < n - 1) {
      filtered[i] -= projection[i + 1] * 0.5;
    }
  }
  
  return filtered;
};

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