// CBCT Physics Utilities and Reconstruction Calculations

export interface CBCTParams {
  coneAngle: number;         // in degrees (e.g. 5 to 35 deg)
  pitchRotationAngle: number; // in degrees (0 to 360 deg)
  detectorPixelSize: number; // in mm (e.g. 0.1 to 1.0 mm)
  kVp: number;               // in kV (e.g. 60 to 120 kV)
  dose: number;              // mAs or arbitrary relative dose unit
  phantomType: 'dental' | 'skull' | 'cylinder';
}

export interface ReconstructedVoxel {
  x: number;
  y: number;
  z: number;
  hu: number; // Hounsfield Unit / relative density
}

/**
 * Feldkamp-Davis-Kress (FDK) algorithm geometry weighting factor
 * W(x, y, z, theta) = D0 / sqrt(D0^2 + u^2 + v^2)
 * D0: Source to Isocenter Distance
 */
export const calculateFDKWeight = (
  x: number,
  y: number,
  z: number,
  angleRad: number,
  sourceToIso: number = 500
): number => {
  // Rotate (x, y) by angleRad to projection coordinate system (u, v)
  const u = x * Math.cos(angleRad) + y * Math.sin(angleRad);
  const v = -x * Math.sin(angleRad) + y * Math.cos(angleRad);
  const distance = Math.sqrt(sourceToIso * sourceToIso + u * u + z * z);
  return sourceToIso / Math.max(distance, 1e-5);
};

/**
 * Calculates 3D CBCT Cone-beam geometry parameters
 */
export const calculateCBCTGeometry = (coneAngleDeg: number, sourceToDetector: number = 1000) => {
  const coneAngleRad = (coneAngleDeg * Math.PI) / 180;
  const detectorHeight = 2 * sourceToDetector * Math.tan(coneAngleRad / 2);
  const coneBeamVolumeRadius = (sourceToDetector / 2) * Math.tan(coneAngleRad / 2);
  
  return {
    coneAngleRad,
    detectorHeight,
    coneBeamVolumeRadius,
  };
};

/**
 * Calculates CBCT spatial resolution and cone-beam artifact index based on cone angle
 */
export const calculateCBCTMetrics = (params: CBCTParams) => {
  // Cone beam artifacts (FDK degradation at larger z-offsets/cone angles)
  // Feldkamp approximation suffers from cone-beam artifacts off the mid-plane z=0 as cone angle increases
  const artifactSeverity = Math.min(100, Math.max(0, (params.coneAngle - 10) * 3.5)); // % severity
  
  // Spatial resolution limit governed by detector pixel size and geometric magnification (~1.5x)
  const magnification = 1.5;
  const spatialResolutionMm = params.detectorPixelSize / magnification; // effective voxel limit
  const lpPerMm = 1 / (2 * spatialResolutionMm); // Line pairs per mm
  
  // Noise vs Dose & kVp approximation
  // Relative noise ~ 1 / sqrt(Dose * (kVp / 90)^1.5)
  const relativeNoise = (1 / Math.sqrt(Math.max(params.dose, 1) * Math.pow(params.kVp / 90, 1.5))) * 100;
  
  // Contrast-to-Noise Ratio (CNR)
  const cnr = Math.max(0.5, (100 / (relativeNoise + 1)) * (params.kVp / 100));

  return {
    artifactSeverity: Math.round(artifactSeverity),
    spatialResolutionMm: Number(spatialResolutionMm.toFixed(3)),
    lpPerMm: Number(lpPerMm.toFixed(2)),
    relativeNoise: Number(relativeNoise.toFixed(1)),
    cnr: Number(cnr.toFixed(1)),
  };
};

/**
 * Generates a simulated 2D Flat Panel Detector image (projection) for given angle & phantom
 */
export const generateCBCTProjectionData = (
  params: CBCTParams,
  width: number = 128,
  height: number = 128
): number[][] => {
  const projection: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));
  const angleRad = (params.pitchRotationAngle * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const cx = width / 2;
  const cy = height / 2;

  // Simple phantom ray-marching/analytical projection
  for (let y = 0; y < height; y++) {
    const v = (y - cy) / cy; // vertical normalized coordinate [-1, 1]
    for (let x = 0; x < width; x++) {
      const u = (x - cx) / cx; // horizontal normalized coordinate [-1, 1]

      let opacity = 0;
      if (params.phantomType === 'dental') {
        // Dental arch phantom: elliptical arc + teeth + jawbone + metal crown
        const r2 = u * u + v * v;
        if (r2 < 0.64) {
          // Jawbone structure (varies with rotation)
          const rotU = u * cosA - v * sinA;
          const rotV = u * sinA + v * cosA;

          // Outer jaw boundary
          if (rotU * rotU + rotV * rotV < 0.5) opacity += 0.3;
          // Teeth arch (high attenuation)
          if (Math.abs(rotU * rotU + rotV * rotV - 0.25) < 0.08 && rotV > -0.1) {
            opacity += 0.5;
          }
          // Metal crown / filling (high Z material causing streak artifacts)
          if (Math.hypot(rotU - 0.25, rotV - 0.2) < 0.08) {
            opacity += 0.9;
          }
          // High cone angle field edge geometric attenuation
          const coneFactor = 1.0 - 0.3 * Math.abs(v) * Math.sin((params.coneAngle * Math.PI) / 180);
          opacity *= coneFactor;
        }
      } else if (params.phantomType === 'skull') {
        // Skull phantom: outer cranial shell + brain tissue + sinus cavity + spine base
        const r2 = u * u + (v * 1.1) * (v * 1.1);
        if (r2 < 0.7) {
          opacity += 0.25; // Brain soft tissue
          if (r2 > 0.5 && r2 < 0.68) opacity += 0.55; // Cranial bone shell
          
          // Sinus air cavity (low attenuation)
          const rotU = u * cosA - v * sinA;
          const rotV = u * sinA + v * cosA;
          if (Math.hypot(rotU, rotV + 0.2) < 0.18) {
            opacity -= 0.2;
          }
          // Cervical spine at base
          if (Math.abs(rotU) < 0.12 && rotV < -0.3) {
            opacity += 0.6;
          }
        }
      } else {
        // Cylindrical phantom (uniform outer cylinder + central high-density rod + off-center rod)
        const r2 = u * u + v * v;
        if (r2 < 0.7) {
          opacity += 0.3; // Water-like body
          const rotU = u * cosA - v * sinA;
          const rotV = u * sinA + v * cosA;
          // Dense bone insert
          if (rotU * rotU + rotV * rotV < 0.06) opacity += 0.5;
          // Contrast insert
          if (Math.hypot(rotU - 0.35, rotV) < 0.12) opacity += 0.4;
        }
      }

      // Add noise scaled inversely by dose and kVp
      const noiseAmp = (12 / Math.sqrt(Math.max(params.dose, 1))) * (100 / params.kVp);
      const randomNoise = (Math.random() - 0.5) * noiseAmp * 0.05;

      projection[y][x] = Math.min(1.0, Math.max(0, opacity + randomNoise));
    }
  }

  return projection;
};
