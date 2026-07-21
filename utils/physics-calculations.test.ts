import { describe, it, expect } from 'vitest';
import {
  calculateLinearAttenuationCoefficient,
  calculateHounsfieldUnit,
  simulateBeamHardening,
  calculateCTDI,
  calculateDLP,
  calculateEffectiveDose,
  performDoseCalculation,
  generateFanBeamSinogram,
  generateKernel,
  convolveSinogram,
  backprojectFanBeam,
  addFanBeamProjectionToImage,
  generateSinogram,
  applyRampFilter,
  helicalInterpolation,
  calculateOptimalPhase,
  calculateTemporalResolution,
  materialDecomposition,
  calculateImageNoise,
  calculateMTF,
} from '@/utils/physics-calculations';
import { Tissue, CTParameters } from '@/types';

describe('physics-calculations', () => {
  describe('Attenuation and HU calculations', () => {
    it('calculates linear attenuation coefficient correctly with zeff and density', () => {
      const tissue: Tissue = { id: 'bone', name: 'Bone', density: 1.8, zeff: 13.8 };
      const energy = 60; // keV
      const mu = calculateLinearAttenuationCoefficient(tissue, energy);
      
      const expectedPhotoelectric = (13.8 / 10) ** 3 / (60 ** 3);
      const expectedCompton = 1.8 * (1 / (1 + 60 / 511));
      expect(mu).toBeCloseTo(expectedPhotoelectric + expectedCompton, 5);
    });

    it('handles tissue without zeff in linear attenuation calculation', () => {
      const tissue: Tissue = { id: 'water', name: 'Water', density: 1.0 };
      const energy = 60;
      const mu = calculateLinearAttenuationCoefficient(tissue, energy);
      const expectedCompton = 1.0 * (1 / (1 + 60 / 511));
      expect(mu).toBeCloseTo(expectedCompton, 5);
    });

    it('calculates Hounsfield Unit correctly', () => {
      const waterMu = 0.2;
      const boneMu = 0.4;
      const airMu = 0.0;
      
      expect(calculateHounsfieldUnit(waterMu, waterMu)).toBe(0);
      expect(calculateHounsfieldUnit(boneMu, waterMu)).toBe(1000);
      expect(calculateHounsfieldUnit(airMu, waterMu)).toBe(-1000);
    });
  });

  describe('Beam Hardening', () => {
    it('attenuates initial spectrum through material thickness', () => {
      const initialSpectrum = [100, 100, 100]; // at index 0 (20 keV), index 1 (21 keV), index 2 (22 keV)
      const material: Tissue = { id: 'soft_tissue', name: 'Soft Tissue', density: 1.0, zeff: 7.4 };
      const thickness = 2.0;

      const hardened = simulateBeamHardening(initialSpectrum, material, thickness);
      expect(hardened.length).toBe(3);
      hardened.forEach((intensity, idx) => {
        const energy = idx + 20;
        const mu = calculateLinearAttenuationCoefficient(material, energy);
        const expected = 100 * Math.exp(-mu * thickness);
        expect(intensity).toBeCloseTo(expected, 5);
        expect(intensity).toBeLessThan(100);
      });
    });
  });

  describe('Dose calculations', () => {
    it('calculates CTDI correctly', () => {
      const mAs = 200;
      const kVp = 120;
      const pitch = 1.0;
      // baseCTDI = 0.01 * 200 * (120/120)^2.5 = 2.0
      expect(calculateCTDI(mAs, kVp, pitch)).toBeCloseTo(2.0, 5);

      // test with pitch 2
      expect(calculateCTDI(mAs, kVp, 2.0)).toBeCloseTo(1.0, 5);
    });

    it('calculates DLP correctly', () => {
      const ctdi = 10; // mGy
      const scanLength = 30; // cm
      expect(calculateDLP(ctdi, scanLength)).toBe(300);
    });

    it('calculates Effective Dose correctly', () => {
      const dlp = 300;
      const defaultKFactor = 0.015;
      expect(calculateEffectiveDose(dlp)).toBeCloseTo(4.5, 5);
      expect(calculateEffectiveDose(dlp, 0.02)).toBeCloseTo(6.0, 5);
    });

    it('performs complete DoseCalculation with parameters', () => {
      const params: CTParameters = {
        kVp: 120,
        mAs: 100,
        pitch: 1,
        collimation: 10,
        rotationTime: 0.5,
      };
      const scanLength = 20;

      const result = performDoseCalculation(params, scanLength);
      // baseCTDI = 0.01 * 100 * (1) = 1
      expect(result.ctdi).toBeCloseTo(1.0, 5);
      expect(result.dlp).toBeCloseTo(20.0, 5);
      expect(result.effectiveDose).toBeCloseTo(20.0 * 0.015, 5);
    });

    it('uses existing ctdi if present in CTParameters', () => {
      const params: CTParameters = {
        kVp: 120,
        mAs: 100,
        pitch: 1,
        collimation: 10,
        rotationTime: 0.5,
        ctdi: 5.0,
      };
      const result = performDoseCalculation(params, 10, 0.01);
      expect(result.ctdi).toBe(5.0);
      expect(result.dlp).toBe(50.0);
      expect(result.effectiveDose).toBeCloseTo(0.5, 5);
    });
  });

  describe('Reconstruction calculations & Kernels', () => {
    it('generates kernel of correct size and properties for smooth, standard, sharp', () => {
      const numDetectors = 16;
      const smoothKernel = generateKernel(numDetectors, 'smooth');
      const standardKernel = generateKernel(numDetectors, 'standard');
      const sharpKernel = generateKernel(numDetectors, 'sharp');

      expect(smoothKernel.length).toBe(numDetectors * 2 - 1);
      expect(standardKernel.length).toBe(numDetectors * 2 - 1);
      expect(sharpKernel.length).toBe(numDetectors * 2 - 1);

      const centerIdx = numDetectors - 1;
      expect(sharpKernel[centerIdx]).toBe(0.25);
    });

    it('convolves sinogram properly', () => {
      const sinogram = [
        [0, 0, 1, 0, 0],
        [0, 1, 1, 1, 0],
      ];
      const kernel = [0.5, 1.0, 0.5]; // center at index 1
      const filtered = convolveSinogram(sinogram, kernel);

      expect(filtered.length).toBe(2);
      expect(filtered[0].length).toBe(5);
    });

    it('generates fan beam sinogram and performs backprojection', () => {
      const image = [
        [0, 0, 0, 0],
        [0, 100, 100, 0],
        [0, 100, 100, 0],
        [0, 0, 0, 0],
      ];
      const numProjections = 4;
      const numDetectors = 8;
      const fanAngleDeg = 30;

      const sinogram = generateFanBeamSinogram(image, numProjections, numDetectors, fanAngleDeg);
      expect(sinogram.length).toBe(numProjections);
      expect(sinogram[0].length).toBe(numDetectors);

      const recon = backprojectFanBeam(sinogram, 4, fanAngleDeg);
      expect(recon.length).toBe(4);
      expect(recon[0].length).toBe(4);
    });

    it('addFanBeamProjectionToImage updates accumulator in place', () => {
      const imageSize = 4;
      const accumulator = new Float32Array(imageSize * imageSize);
      const projection = [0, 10, 10, 0];
      const fanAngleDeg = 30;

      addFanBeamProjectionToImage(projection, accumulator, imageSize, 0, fanAngleDeg, 4);
      const sumAcc = accumulator.reduce((a, b) => a + b, 0);
      expect(sumAcc).toBeGreaterThan(0);
    });

    it('wrappers generateSinogram and applyRampFilter execute', () => {
      const image = [[1, 1], [1, 1]];
      const sinogram = generateSinogram(image, 2, 30);
      expect(sinogram.length).toBe(2);

      const proj = [1, 2, 3];
      const result = applyRampFilter(proj);
      expect(result).toEqual(proj);
    });
  });

  describe('Helical Interpolation', () => {
    it('interpolates projections based on zPosition and pitch', () => {
      const projections = [
        [10, 20],
        [30, 40],
        [50, 60],
      ];
      const zPosition = 0.5;
      const pitch = 1.0;

      const result = helicalInterpolation(projections, zPosition, pitch);
      expect(result.length).toBe(3);
    });
  });

  describe('Cardiac gating calculations', () => {
    it('calculates optimal phase depending on heart rate', () => {
      const lowHR = 60;
      const highHR = 80;
      const rotationTime = 0.35;

      const phaseLow = calculateOptimalPhase(lowHR, rotationTime);
      const phaseHigh = calculateOptimalPhase(highHR, rotationTime);

      // RR for lowHR: 60/60 = 1.0s. 75% -> 0.75s
      expect(phaseLow).toBeCloseTo(0.75, 5);
      // RR for highHR: 60/80 = 0.75s. 45% -> 0.3375s
      expect(phaseHigh).toBeCloseTo(0.3375, 5);
    });

    it('calculates temporal resolution for single-source and multi-source CT', () => {
      const rotationTime = 0.33;
      expect(calculateTemporalResolution(rotationTime, false)).toBeCloseTo(0.165, 5);
      expect(calculateTemporalResolution(rotationTime, true)).toBeCloseTo(0.0825, 5);
    });
  });

  describe('Dual energy calculations', () => {
    it('decomposes material fractions for water-calcium and other pairs', () => {
      const result = materialDecomposition(100, 120, 'water', 'calcium');
      expect(result).toHaveProperty('material1Fraction');
      expect(result).toHaveProperty('material2Fraction');
      expect(result.material1Fraction + result.material2Fraction).toBeCloseTo(1.0, 5);

      const resultUnknown = materialDecomposition(100, 100, 'water', 'fat');
      expect(resultUnknown.material1Fraction).toBeGreaterThanOrEqual(0);
      expect(resultUnknown.material1Fraction).toBeLessThanOrEqual(1);
    });
  });

  describe('Noise and MTF calculations', () => {
    it('calculates image noise correctly for smooth, standard, sharp kernels', () => {
      const dose = 100;
      const voxelSize = 1.0;

      const noiseSmooth = calculateImageNoise(dose, voxelSize, 'smooth');
      const noiseStandard = calculateImageNoise(dose, voxelSize, 'standard');
      const noiseSharp = calculateImageNoise(dose, voxelSize, 'sharp');

      expect(noiseSmooth).toBeLessThan(noiseStandard);
      expect(noiseStandard).toBeLessThan(noiseSharp);
      expect(noiseStandard).toBeCloseTo(20 * 1.0 * (1 / 10) * 1, 5);
    });

    it('calculates MTF above and below cutoff frequencies', () => {
      // standard cutoff is 0.5
      const mtfBelow = calculateMTF(0.25, 'standard');
      const mtfAbove = calculateMTF(0.75, 'standard');

      expect(mtfBelow).toBeCloseTo(1 - (0.25 / 0.5) ** 2 * 0.5, 5);
      expect(mtfAbove).toBeCloseTo(0.1 * Math.exp(-(0.75 - 0.5) * 2), 5);
    });
  });
});
