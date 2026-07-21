// PCCT Physics Utilities and Multi-energy Calculations
export interface PCCTParams {
  kVp: number;                  // 80 to 140 kVp
  photonFlux: number;           // Photon count rate / flux (Mcps/mm2) - trigger for Pulse Pile-up
  bmi: number;                  // Patient size index (obesity level)
  calciumDensity: number;       // For blooming demo (0 to 100)
  stentDiameter: number;        // Stent wire thickness in mm (0.05 to 0.25)
  contrastConcentration: number;// Contrast concentration (mg/mL)
  pixelSize: number;            // Pixel size in mm (0.1 to 0.3)
  threshold1: number;           // Low threshold (keV)
  threshold2: number;           // Mid threshold (keV)
  threshold3: number;           // High threshold (keV)
  enableElectronicNoise: boolean;// Switch for demonstrating zero noise thresholding
  activeMaterialChannel: 'composite' | 'iodine' | 'calcium' | 'residual';
  contrastAgent: 'iodine' | 'gadolinium' | 'bismuth';
}

export interface SpectrumPoint {
  energy: number;
  intensity: number;
}

/**
 * Calculates simplified diagnostic X-ray spectrum (Birch and Marshall model)
 */
export const calculatePCCTSpectrum = (kVp: number, filtrationAl: number = 2.5): SpectrumPoint[] => {
  const spectrum: SpectrumPoint[] = [];
  const minEnergy = 10;
  for (let e = minEnergy; e <= kVp; e += 2) {
    // Kramers law bremsstrahlung approximation
    let intensity = (kVp - e) * e;
    // Aluminum filtration attenuation factor e^(-mu(E)*x)
    const alAttenuation = Math.exp(-0.8 * Math.pow(30 / e, 3) * filtrationAl);
    intensity *= alAttenuation;
    spectrum.push({ energy: e, intensity: Math.max(0, intensity) });
  }
  return spectrum;
};

/**
 * Simulates detector pulse pile-up effect
 * True count rate n = N * e^(-N * tau) where tau is dead time
 * Measured energy shift due to pulse overlap
 */
export const simulatePulsePileUp = (idealCount: number, fluxMcps: number) => {
  const deadTime = 0.05; // dead time in microseconds (50ns)
  const rate = fluxMcps * deadTime;
  const countLossFactor = Math.exp(-rate);
  const realCount = idealCount * countLossFactor;
  // Energy spectrum distortion: pile-up causes energy shift to higher end
  const energyShiftPercent = Math.min(40, rate * 15);
  return { realCount, countLossFactor, energyShiftPercent };
};

/**
 * Computes energy-dependent attenuation for PCCT materials
 */
export const getMaterialAttenuation = (material: string, energy: number, concentration: number = 5): number => {
  const kEdgeIodine = 33.2;
  const kEdgeGadolinium = 50.2;
  const kEdgeBismuth = 90.5;

  let base = 0.15;
  if (material === 'water') base = 0.2 * Math.pow(40 / energy, 2.8);
  else if (material === 'calcium' || material === 'bone') base = 0.7 * Math.pow(50 / energy, 3.1);
  else if (material === 'soft_tissue') base = 0.18 * Math.pow(40 / energy, 2.9);
  else if (material === 'iodine') {
    base = 1.6 * Math.pow(45 / energy, 3.2);
    if (energy >= kEdgeIodine) base *= 3.2; // K-edge jump
    base *= (concentration / 5);
  } else if (material === 'gadolinium') {
    base = 2.0 * Math.pow(55 / energy, 3.2);
    if (energy >= kEdgeGadolinium) base *= 4.0; // K-edge jump
    base *= (concentration / 5);
  } else if (material === 'bismuth') {
    base = 3.5 * Math.pow(80 / energy, 3.2);
    if (energy >= kEdgeBismuth) base *= 5.2; // K-edge jump
    base *= (concentration / 5);
  } else if (material === 'stent_metal') {
    base = 4.5 * Math.pow(80 / energy, 2.5); // High Z metal
  }
  return Math.max(0.01, base);
};

/**
 * Models PCCT vs EID image metrics
 */
export const calculatePCCTMetrics = (params: PCCTParams) => {
  // EID suffers from electronic noise (fixed amplitude)
  // PCCT features zero electronic noise if low threshold > ~20 keV
  const thresholdFloor = params.enableElectronicNoise ? 0 : 20;
  const pcctElectronicNoise = params.threshold1 < thresholdFloor ? 15 : 0;
  const eidElectronicNoise = 18; // inherent in silicon/EID photodiode

  // High spatial resolution: EID has septa (geometric dead space, pixel limit)
  // PCCT direct conversion has smaller pixel size
  const pcctResolutionMm = params.pixelSize;
  const eidResolutionMm = Math.max(0.6, params.pixelSize * 2.2);

  // Calcium Blooming Severity
  const pcctBlooming = Math.max(5, Math.round(params.calciumDensity * 0.25 * (params.pixelSize / 0.1)));
  const eidBlooming = Math.max(25, Math.round(params.calciumDensity * 0.9 * (eidResolutionMm / 0.1)));

  // Stent lumen visibility (%)
  const pcctStentLumen = Math.min(95, Math.max(10, 100 - params.stentDiameter * 200 * (params.pixelSize / 0.1)));
  const eidStentLumen = Math.min(60, Math.max(0, 100 - params.stentDiameter * 600 * (eidResolutionMm / 0.1)));

  // Material Decomposition precision (spectral CNR)
  const kEdgeMatch = (params.contrastAgent === 'iodine' && params.threshold2 >= 32 && params.threshold2 <= 35) ||
                      (params.contrastAgent === 'gadolinium' && params.threshold2 >= 49 && params.threshold2 <= 52) ||
                      (params.contrastAgent === 'bismuth' && params.threshold2 >= 89 && params.threshold2 <= 92);
  const decompositionCnr = kEdgeMatch ? 12.5 : 6.0;

  return {
    pcctResolutionMm: Number(pcctResolutionMm.toFixed(2)),
    eidResolutionMm: Number(eidResolutionMm.toFixed(2)),
    pcctBlooming,
    eidBlooming,
    pcctStentLumen: Math.round(pcctStentLumen),
    eidStentLumen: Math.round(eidStentLumen),
    pcctElectronicNoise,
    eidElectronicNoise,
    decompositionCnr: Number((decompositionCnr * (params.photonFlux > 15 ? 0.6 : 1.0)).toFixed(1)),
  };
};

/**
 * Generates a simulated Sinogram for a specific Energy Bin
 */
export const generatePCCTSinogramData = (
  params: PCCTParams,
  binIndex: number, // 1, 2, or 3
  projections: number = 64,
  detectors: number = 64
): number[][] => {
  const sinogram: number[][] = Array.from({ length: projections }, () => new Array(detectors).fill(0));
  
  // Energy selection based on Bin
  let avgEnergy = 40;
  if (binIndex === 1) avgEnergy = (20 + params.threshold1) / 2;
  else if (binIndex === 2) avgEnergy = (params.threshold1 + params.threshold2) / 2;
  else avgEnergy = (params.threshold2 + 120) / 2;

  // Attenuation coefficient for contrast agent and bone/calcium
  const attContrast = getMaterialAttenuation(params.contrastAgent, avgEnergy, params.contrastConcentration);
  const attCalcium = getMaterialAttenuation('calcium', avgEnergy, params.calciumDensity / 5);
  const attWater = getMaterialAttenuation('water', avgEnergy, 5);

  const pulseDeadTime = 0.05;
  const rate = params.photonFlux * pulseDeadTime;
  const pileUpFactor = Math.exp(-rate);

  for (let p = 0; p < projections; p++) {
    const angle = (p / projections) * Math.PI;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let d = 0; d < detectors; d++) {
      const u = (d - detectors / 2) / (detectors / 2); // detector position [-1, 1]

      let thicknessWater = 0;
      let thicknessContrast = 0;
      let thicknessCalcium = 0;

      // Simulated object: main circle (water-like body)
      if (Math.abs(u) < 0.6) {
        thicknessWater = 2 * Math.sqrt(0.36 - u * u);
        
        // Add off-center contrast lumen trace in sinogram (moving as a sine wave)
        const contrastCenter = 0.15 * cosA;
        if (Math.abs(u - contrastCenter) < 0.18) {
          thicknessContrast = 2 * Math.sqrt(0.0324 - Math.pow(u - contrastCenter, 2));
        }

        // Add calcified plaque trace
        const calciumCenter = -0.15 * sinA;
        if (Math.abs(u - calciumCenter) < 0.1) {
          thicknessCalcium = 2 * Math.sqrt(0.01 - Math.pow(u - calciumCenter, 2));
        }
      }

      // Compute total line-integral attenuation
      let lineIntegral = thicknessWater * attWater + 
                         thicknessContrast * attContrast + 
                         thicknessCalcium * attCalcium;

      // Translate attenuation to transmitted photon counts
      let incidentPhotons = 1000 * (1 / (1 + params.bmi * 0.01));
      
      // Energy bin partitioning
      if (binIndex === 1) incidentPhotons *= 0.5;
      else if (binIndex === 2) incidentPhotons *= 0.3;
      else incidentPhotons *= 0.2;

      let transmitted = incidentPhotons * Math.exp(-lineIntegral);

      // Non-ideal effects distortion
      if (binIndex === 1 && params.enableElectronicNoise && params.threshold1 < 20) {
        transmitted += 120; // electronic noise leakage count
      }
      
      // Pulse pile-up losses
      transmitted *= pileUpFactor;

      // Compute negative log to get sinogram projection value
      let projValue = -Math.log(Math.max(1, transmitted) / incidentPhotons);
      projValue = Math.min(1.0, Math.max(0, projValue * 0.4));

      // Quantum noise (Poisson noise simulation)
      const noiseAmp = 0.05 * (1 + params.bmi * 0.02) / (Math.sqrt(Math.max(10, transmitted)));
      sinogram[p][d] = Math.min(1.0, Math.max(0, projValue + (Math.random() - 0.5) * noiseAmp));
    }
  }

  return sinogram;
};

/**
 * Generates attenuation data points for a set of materials across an energy spectrum (10 to 120 keV)
 */
export interface AttenuationPoint {
  energy: number;
  iodine: number;
  gadolinium: number;
  bismuth: number;
  calcium: number;
  water: number;
}

export const getKEdgeCurveData = (): AttenuationPoint[] => {
  const data: AttenuationPoint[] = [];
  for (let e = 10; e <= 120; e += 2) {
    data.push({
      energy: e,
      iodine: getMaterialAttenuation('iodine', e, 5),
      gadolinium: getMaterialAttenuation('gadolinium', e, 5),
      bismuth: getMaterialAttenuation('bismuth', e, 5),
      calcium: getMaterialAttenuation('calcium', e, 5),
      water: getMaterialAttenuation('water', e, 5),
    });
  }
  return data;
};
