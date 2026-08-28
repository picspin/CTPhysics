import * as THREE from 'three';

/**
 * Procedural PMREM environment for IBL (image-based lighting).
 *
 * No external HDRI download — gradient + scan-line noise baked once
 * into a PMREM mipmap chain. Pattern lifted from the anatomy viewer
 * (CanvasTexture gradient → PMREMGenerator.fromEquirectangular).
 *
 * Usage:
 *   const env = createProceduralEnvironment(renderer);
 *   scene.environment = env.texture;
 *   // ...later:
 *   env.dispose();
 */

export interface ProceduralEnvironment {
  texture: THREE.Texture;
  dispose: () => void;
}

const WIDTH = 1024;
const HEIGHT = 512;

// Two-stop equirectangular gradient: warm top → cool bottom.
// Values picked for medical-grade scene (warm rose to cool teal),
// matching the anatomy viewer's palette intent.
const TOP_COLOR = '#3a2530';
const BOTTOM_COLOR = '#1a2a35';

function buildGradientCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('proceduralEnvironment: 2D context unavailable');

  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, TOP_COLOR);
  gradient.addColorStop(1, BOTTOM_COLOR);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Faint scan-line noise to break up uniform bands.
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const data = imageData.data;
  for (let y = 0; y < HEIGHT; y++) {
    const lineNoise = Math.sin((y / HEIGHT) * Math.PI * 80) * 4; // ±4
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      const n = (Math.random() - 0.5) * 2 + lineNoise;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

export function createProceduralEnvironment(
  renderer: THREE.WebGLRenderer,
): ProceduralEnvironment {
  const canvas = buildGradientCanvas();
  const equirect = new THREE.CanvasTexture(canvas);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(equirect);

  equirect.dispose();
  pmrem.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
