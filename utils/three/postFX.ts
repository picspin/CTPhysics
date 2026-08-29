import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  SMAAEffect,
  SSAOEffect,
  BloomEffect,
  VignetteEffect,
  KernelSize,
} from 'postprocessing';

/**
 * Postprocessing chain for the HelicalCTSimulator.
 *
 * Wraps native `postprocessing` 6.38 (already in package.json — no new deps).
 * Order matters and is chosen deliberately:
 *
 *   RenderPass → EffectPass(SMAA, SSAO, Bloom, Vignette)
 *
 * - SMAA first (cheap, cleans up geometric / SSAO noise before subsequent
 *   effects read from the color buffer).
 * - SSAO second (operates on the depth buffer; needs the rendered scene
 *   geometry, benefits from SMAA having denoised the underlying color
 *   signal it's actually darkening).
 * - Bloom third (operates on luminance above the threshold; vignette after
 *   bloom is fine — bloom regions are already local in HDR space).
 * - Vignette last (darkens frame corners after all lighting decisions).
 *
 * A single EffectPass is used to combine all four effects into one
 * render pass — postprocessing compiles them into one shader, avoiding
 * the cost of 4 separate passes / RT round-trips.
 *
 * Composer target uses HalfFloatType (when supported) so Bloom's HDR
 * threshold operates on actual luminance, not clamped 8-bit color.
 */

export interface PostFXOptions {
  bloomIntensity?: number; // default 0.6
  bloomThreshold?: number; // default 0.85
  ssaoEnabled?: boolean; // default true
  ssaoRadius?: number; // default 0.5
  vignetteDarkness?: number; // default 0.45
}

export interface PostFX {
  composer: EffectComposer;
  setBloomIntensity(v: number): void;
  setSSAOEnabled(v: boolean): void;
  setVignetteDarkness(v: number): void;
  resize(w: number, h: number, pixelRatio: number): void;
  dispose(): void;
}

export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: PostFXOptions = {},
): PostFX {
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;

  const bloomIntensity = options.bloomIntensity ?? 0.6;
  const bloomThreshold = options.bloomThreshold ?? 0.85;
  const ssaoEnabled = options.ssaoEnabled ?? true;
  const ssaoRadius = options.ssaoRadius ?? 0.5;
  const vignetteDarkness = options.vignetteDarkness ?? 0.45;

  // Half-float RT when supported — keeps Bloom accurate (no clamping).
  const halfFloatSupported = renderer.capabilities.isWebGL2;
  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    type: halfFloatSupported ? THREE.HalfFloatType : THREE.UnsignedByteType,
    colorSpace: THREE.NoColorSpace,
    depthBuffer: true,
    stencilBuffer: false,
  });

  const composer = new EffectComposer(renderer, {
    frameBufferType: halfFloatSupported ? THREE.HalfFloatType : THREE.UnsignedByteType,
  });
  composer.setSize(width, height);

  // RenderPass — writes the raw scene to the composer's input buffer.
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Build the 4-effect chain.
  const smaa = new SMAAEffect();
  // SSAO: medium sample count (11) is the default sweet spot for IBL
  // scenes with moderate geometric complexity. radius expressed as a
  // scale relative to resolution [0..1]; 0.1825 is the default.
  const ssao = new SSAOEffect(camera, undefined, {
    samples: 11,
    rings: 7,
    radius: ssaoRadius,
    bias: 0.025,
    fade: 0.01,
    luminanceInfluence: 0.7,
  });
  const bloom = new BloomEffect({
    intensity: bloomIntensity,
    luminanceThreshold: bloomThreshold,
    luminanceSmoothing: 0.025,
    kernelSize: KernelSize.LARGE,
    mipmapBlur: true,
  });
  const vignette = new VignetteEffect({
    offset: 0.5,
    darkness: vignetteDarkness,
  });

  // Combine into a single EffectPass — one fullscreen draw call.
  const effectPass = new EffectPass(camera, smaa, ssao, bloom, vignette);
  // SSAO requires the depth texture; EffectPass handles that automatically
  // when SSAOEffect is in the chain (it inspects the effect list).
  composer.addPass(effectPass);

  return {
    composer,

    setBloomIntensity(v: number) {
      bloom.intensity = v;
    },

    setSSAOEnabled(v: boolean) {
      // SSAO toggle: `effects` is declared private in the postprocessing
      // d.ts but is a plain public array at runtime, and `setEffects()`
      // is the public mutator. Cast through any to access the runtime
      // surface without TS complaining about the typed private field.
      const ep = effectPass as unknown as {
        effects: any[];
        setEffects(e: any[]): void;
      };
      if (v) {
        if (!ep.effects.includes(ssao)) {
          ep.setEffects([...ep.effects, ssao]);
        }
      } else {
        ep.setEffects(ep.effects.filter((e) => e !== ssao));
      }
    },

    setVignetteDarkness(v: number) {
      vignette.darkness = v;
    },

    resize(w: number, h: number, pixelRatio: number) {
      renderer.setPixelRatio(pixelRatio);
      // EffectComposer reads pixelRatio from the renderer on next
      // setSize() call; setSize alone covers the composer RT sizing.
      composer.setSize(w, h);
    },

    dispose() {
      composer.removePass(renderPass);
      composer.removePass(effectPass);
      smaa.dispose();
      ssao.dispose();
      bloom.dispose();
      vignette.dispose();
      composer.dispose();
      renderTarget.dispose();
    },
  };
}