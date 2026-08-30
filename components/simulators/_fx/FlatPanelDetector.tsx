import * as THREE from 'three';

/**
 * Flat-panel detector (FPD) for CBCT visualization.
 *
 * Distinct from the curved multi-row arc used in conventional CT: a CBCT
 * detector is a flat 2D matrix of scintillator pixels (typically a-Si
 * coupled to CsI or Gd2O2S). For the simulator, we render:
 *
 *   - a backing plate (detector housing material from shared pool),
 *   - the scintillator face (dark panel material),
 *   - a visible pixel grid (InstancedMesh of small tiles) so the user
 *     can SEE the discrete sampling structure rather than just a
 *     continuous surface.
 *
 * Pixel intensity is driven by the live projection sample (a 2D number
 * matrix passed in as Float32Array or number[][]). Pixels that the user
 * can see "light up" on the detector face as the gantry rotates.
 *
 * Uses one InstancedMesh for the pixel grid (one draw call regardless
 * of pixel count) and one Mesh for the housing/face.
 */

export interface FlatPanelDetectorOptions {
  panelWidth?: number; // X-extent of the scintillator face (default 0.5)
  panelHeight?: number; // Z-extent of the scintillator face (default 0.5)
  pixelGridX?: number; // number of pixels along X (default 32)
  pixelGridZ?: number; // number of pixels along Z (default 32)
}

export interface FlatPanelDetector {
  group: THREE.Group;
  setProjection: (data: Float32Array | number[][] | null) => void;
  setEnabled: (v: boolean) => void;
  dispose: () => void;
}

export function createFlatPanelDetector(
  housingMaterial: THREE.Material,
  panelMaterial: THREE.Material,
  options: FlatPanelDetectorOptions = {},
): FlatPanelDetector {
  const panelWidth = options.panelWidth ?? 0.5;
  const panelHeight = options.panelHeight ?? 0.5;
  const gridX = options.pixelGridX ?? 32;
  const gridZ = options.pixelGridZ ?? 32;

  const group = new THREE.Group();
  group.name = 'FlatPanelDetector';

  // Backing housing — slightly larger than the panel face so the
  // scintillator sits inside a bezel.
  const housingGeo = new THREE.BoxGeometry(panelWidth + 0.05, 0.04, panelHeight + 0.05);
  const housing = new THREE.Mesh(housingGeo, housingMaterial);
  housing.castShadow = true;
  housing.receiveShadow = true;
  group.add(housing);

  // Scintillator face — flat plane, slight inset from housing front.
  const faceGeo = new THREE.PlaneGeometry(panelWidth, panelHeight);
  const face = new THREE.Mesh(faceGeo, panelMaterial);
  // Plane default faces +Z; we keep it at z = +0.021 so it sits just
  // in front of the housing centerline.
  face.position.z = 0.021;
  group.add(face);

  // Pixel grid via InstancedMesh — single draw call for all pixels.
  // Each pixel is a small tile; we set per-instance scale (slightly
  // smaller than cell so there's a visible gap) and per-instance color
  // (driven by setProjection).
  const pixelSize = 0.85 / gridX; // 85% fill factor leaves visible seams
  const pixelGeo = new THREE.PlaneGeometry(pixelSize, pixelSize);
  // Use a basic unlit material for performance; we'll color each
  // instance via instanceColor.
  const pixelMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const pixelMesh = new THREE.InstancedMesh(pixelGeo, pixelMat, gridX * gridZ);
  pixelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Initialize colors buffer.
  const colorBuf = new Float32Array(gridX * gridZ * 3);
  pixelMesh.instanceColor = new THREE.InstancedBufferAttribute(colorBuf, 3);
  pixelMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

  const tmpMatrix = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3(1, 1, 1);
  const tmpColor = new THREE.Color();

  // Lay out the pixel grid centered on the panel face. Pixel (i, j)
  // maps to local X = (i / gridX - 0.5) * panelWidth, Z = ...
  // Pixel planes default to +Z facing, so no rotation needed.
  let idx = 0;
  for (let j = 0; j < gridZ; j++) {
    for (let i = 0; i < gridX; i++) {
      const x = (i / (gridX - 1) - 0.5) * panelWidth;
      const z = (j / (gridZ - 1) - 0.5) * panelHeight;
      tmpPos.set(x, 0, z + 0.022); // sit just above the face plane
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      pixelMesh.setMatrixAt(idx, tmpMatrix);
      // Default color: dim
      colorBuf[idx * 3 + 0] = 0.2;
      colorBuf[idx * 3 + 1] = 0.25;
      colorBuf[idx * 3 + 2] = 0.3;
      idx++;
    }
  }
  pixelMesh.instanceMatrix.needsUpdate = true;
  pixelMesh.instanceColor.needsUpdate = true;

  group.add(pixelMesh);

  function setProjection(data: Float32Array | number[][] | null): void {
    if (!data) {
      // Reset to dim baseline.
      for (let i = 0; i < colorBuf.length; i += 3) {
        colorBuf[i] = 0.2;
        colorBuf[i + 1] = 0.25;
        colorBuf[i + 2] = 0.3;
      }
      if (pixelMesh.instanceColor) pixelMesh.instanceColor.needsUpdate = true;
      return;
    }

    let k = 0;
    for (let j = 0; j < gridZ; j++) {
      for (let i = 0; i < gridX; i++) {
        // Map our pixel (i, j) into the source data index. The
        // simulator's projection is 2D [row y][col x]. We sample the
        // source at (i/gridX * W, j/gridZ * H).
        let v = 0;
        if (Array.isArray(data) && data.length > 0) {
          const srcRow = data[j] ?? [];
          const srcCol = srcRow[i] ?? 0;
          v = srcCol;
        } else if (data instanceof Float32Array) {
          v = data[k] ?? 0;
        }

        // Inverse-grayscale (bright = more attenuation like X-ray film).
        const t = Math.max(0, Math.min(1, 1.0 - v));
        // Map to a cool-to-warm ramp so the user sees energy land on
        // different rows of the panel distinctly.
        tmpColor.setHSL(0.6 - t * 0.55, 0.6, 0.15 + t * 0.55);
        colorBuf[k * 3 + 0] = tmpColor.r;
        colorBuf[k * 3 + 1] = tmpColor.g;
        colorBuf[k * 3 + 2] = tmpColor.b;
        k++;
      }
    }
    if (pixelMesh.instanceColor) pixelMesh.instanceColor.needsUpdate = true;
  }

  function setEnabled(v: boolean): void {
    group.visible = v;
  }

  function dispose(): void {
    housingGeo.dispose();
    faceGeo.dispose();
    pixelGeo.dispose();
    pixelMat.dispose();
  }

  return {
    group,
    setProjection,
    setEnabled,
    dispose,
  };
}