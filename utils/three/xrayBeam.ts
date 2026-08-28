import * as THREE from 'three';

/**
 * X-ray cone beam visualization.
 *
 * Replaces the old red PlaneGeometry "laser" with a proper cone that
 * widens from the tube window out to the detector face. Uses a custom
 * ShaderMaterial with additive blending so it visually reads as a beam
 * of photons rather than a flat sheet:
 *
 *   - ConeGeometry (open-ended) — no caps, so the inside of the cone is
 *     visible from any angle as a translucent volume.
 *   - AdditiveBlending + depthWrite: false — beam doesn't occlude or
 *     z-fight with the gantry / phantom geometry.
 *   - Distance-based falloff — alpha is brightest at the tube apex and
 *     dims toward the detector, simulating beam intensity attenuation
 *     through air + patient (visual hint; not a physics calc).
 *   - Color stays in the cyan-cool range (#8ec8ff) to differentiate from
 *     the warm tube-emissive bloom.
 *
 * The cone's local +Y axis is aligned with (target - origin) via a
 * quaternion. ConeGeometry's apex is at +Y / 2 and base at -Y / 2, so
 * we flip the model so the apex sits at the tube (origin).
 */

export interface XRayBeamOptions {
  coneLength?: number; // default 12
  coneTopRadius?: number; // default 0.05
  coneBottomRadius?: number; // default 0.6
  color?: THREE.Color; // default #8ec8ff
}

export interface XRayBeam {
  mesh: THREE.Mesh;
  setEnabled(v: boolean): void;
  setEnergy(kv: number): void; // 80→0.35, 140→0.95
  lookAt(origin: THREE.Vector3, target: THREE.Vector3): void;
  update(elapsedSeconds: number): void; // pump time uniform
  dispose(): void;
}

// Pre-bake the alpha-distribution fragment logic as a constant string.
const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying float vDistance;

  void main() {
    vUv = uv;
    // ConeGeometry uv.y goes 0 at base → 1 at apex.
    // We want vDistance = 0 at apex (tube), 1 at base (detector).
    vDistance = 1.0 - uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;

  varying vec2 vUv;
  varying float vDistance;

  void main() {
    // Beam color * intensity (HDR — gets bloomed post-effect).
    vec3 color = uColor * uIntensity;
    // Distance falloff: brightest at apex (vDistance=0), dimmest at base.
    float distFactor = smoothstep(0.0, 1.0, vDistance);
    float alpha = (1.0 - distFactor) * 0.6;

    // Slight time-based shimmer — gives the beam life without being
    // distracting.
    float shimmer = 0.95 + 0.05 * sin(uTime * 3.0 + vUv.y * 12.0);
    color *= shimmer;

    // Additive blend — final color carries through, alpha modulates
    // contribution.
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

export function createXRayBeam(
  origin: THREE.Vector3,
  target: THREE.Vector3,
  options: XRayBeamOptions = {},
): XRayBeam {
  const coneLength = options.coneLength ?? 12;
  const coneTopRadius = options.coneTopRadius ?? 0.05;
  const coneBottomRadius = options.coneBottomRadius ?? 0.6;
  const baseColor = options.color ?? new THREE.Color(0x8ec8ff);

  // ConeGeometry signature:
  // ConeGeometry(radius, height, radialSegments, heightSegments, openEnded)
  // Note: ConeGeometry's "radius" parameter sets the base radius; the apex
  // is always at the top (no separate topRadius). To get a frustum we use
  // CylinderGeometry(topR, bottomR, h, ...) and place the apex at +Y.
  const geom = new THREE.CylinderGeometry(
    coneTopRadius, // top radius (apex side)
    coneBottomRadius, // bottom radius (detector side)
    coneLength, // height
    32, // radial segments
    1, // height segments
    true, // open-ended (no caps)
  );

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: baseColor.clone() },
      uIntensity: { value: 0.5 },
      uTime: { value: 0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geom, material);
  mesh.name = 'XRayBeam';
  mesh.visible = false;

  // Helper: align cone's +Y axis to the direction vector (target - origin).
  // CylinderGeometry's local +Y is the "top" (apex side), so after this
  // rotation, the apex points toward origin (tube) and the base toward
  // target (detector). We then translate so apex sits at origin.
  const axisY = new THREE.Vector3(0, 1, 0);
  const _tmpDir = new THREE.Vector3();
  const _tmpQuat = new THREE.Quaternion();

  function alignTo(originVec: THREE.Vector3, targetVec: THREE.Vector3) {
    // CylinderGeometry has the smaller radius (apex) at +Y/2 and the
    // larger radius (base/detector side) at -Y/2. We want the apex to
    // point FROM the detector TOWARD the tube (i.e. the beam shoots
    // out of the tube). So local +Y should align with (origin - target),
    // NOT (target - origin).
    _tmpDir.copy(originVec).sub(targetVec).normalize();
    _tmpQuat.setFromUnitVectors(axisY, _tmpDir);
    mesh.quaternion.copy(_tmpQuat);
    // After rotation, local +Y points from target → origin. The apex
    // sits at mesh.position + dir * (length/2). To put the apex at
    // origin (tube), we set mesh.position = origin - dir * (length/2).
    const offset = _tmpDir.clone().multiplyScalar(coneLength / 2);
    mesh.position.copy(originVec).sub(offset);
  }

  alignTo(origin, target);

  return {
    mesh,

    setEnabled(v: boolean) {
      mesh.visible = v;
    },

    setEnergy(kv: number) {
      // Linear mapping: 80 kV → 0.35, 140 kV → 0.95 (with headroom for
      // bloom kick at high energy).
      const clamped = Math.max(80, Math.min(140, kv));
      const t = (clamped - 80) / (140 - 80);
      material.uniforms.uIntensity.value = 0.35 + t * (0.95 - 0.35);
    },

    lookAt(originVec: THREE.Vector3, targetVec: THREE.Vector3) {
      alignTo(originVec, targetVec);
    },

    update(elapsedSeconds: number) {
      material.uniforms.uTime.value = elapsedSeconds;
    },

    dispose() {
      geom.dispose();
      material.dispose();
    },
  };
}