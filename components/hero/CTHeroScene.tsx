import React, { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// --- Disturbed-particle golden funnel through the CT bore ---
//
// Design intent: a stream of disturbed particles flowing left -> right
// inside a variable-width beam. The beam width is field-controlled:
//   - wide at the source (left side)
//   - pinched at an off-centre attractor zone (right of screen centre,
//     near where the visible CT bore sits in the hero image)
//   - asymmetric recovery on the right side: the post-pinch half fans
//     out at a different rate than the pre-pinch half, so the funnel
//     silhouette is asymmetric (the user asked for "right side wider
//     than left" of the pinch)
//   - particles are individually jittered so the cloud reads as a
//     swarm of points rather than a sheet or a ray.
//
// World scale: visible height at z=0 with camera z=10 fov=35 is ~6.3
// world units, so:
//   0.25 H = 0.79 world units (max scatter)
//   0.04 H = 0.13 world units (pinch floor)

const FLOW_X_MIN = -6;
const FLOW_X_MAX = 5;

// Attractor position: where the beam pinches. The bore corresponds to
// the focal point of the magnetic field — particles entering from the
// left get pulled into a converging funnel here.
const PINCH_X = 0.5;
const PINCH_SIGMA = 0.95; // gaussian width of the magnetic attractor

// Maximum half-width of the beam on the source (left) side. The
// magnetic-field zone reads as a wide flare here.
const BASE_HALF_WIDTH = 1.05;

// Floor at the attractor centre. Slightly above 1/20 H so the narrow
// region still has visible density instead of vanishing to nothing.
const PINCH_HALF_WIDTH = 0.18;

// Electric-field acceleration: kicks in immediately after the pinch
// and pushes the beam to flare MUCH wider than the source side — the
// post-pinch dispersion reads as particles escaping after acceleration.
const ELECTRIC_FAN_GAIN = 1.85;

// Where the electric field zone begins (immediately past the pinch)
// and how quickly the dispersion ramps in.
const ELECTRIC_RAMP_POWER = 0.45; // <1 = fast initial dispersion

// Vertical micro-jitter so even particles on the same lane are spread
// into a soft cloud rather than a sharp line. The right-side lanes get
// extra Y-jitter to read as more violent dispersion after acceleration.
const Y_JITTER = 0.10;
const Y_JITTER_ELECTRIC = 0.28;
// Small z spread gives parallax depth.
const Z_JITTER = 0.25;

// --- Width field ----------------------------------------------------
//
// At world x, the beam half-width is:
//   w(x) = PINCH_HALF_WIDTH
//        + (BASE_HALF_WIDTH - PINCH_HALF_WIDTH) * (1 - attractor(x))
//        * leftExpand(x) * rightExpand(x)
//
// attractor(x): gauss centred at PINCH_X — pulls width toward PINCH_HALF_WIDTH.
// leftExpand / rightExpand: independent scale functions on each side of
// the attractor so the silhouette is asymmetric.
const attractor = (x: number) =>
  Math.exp(-Math.pow((x - PINCH_X) / PINCH_SIGMA, 2));

// Recovery on the left of the pinch: gradual, modest.
const leftExpand = (x: number) => {
  if (x >= PINCH_X) return 1.0;
  const d = PINCH_X - x;
  // 0 at pinch, 1 at x = -4. Curve: gentle slow start, broader at the
  // far end so the source side reads as a wide open mouth.
  return Math.min(1.0, Math.pow(d / (PINCH_X - FLOW_X_MIN), 0.55));
};

// Electric-field zone: starts at the pinch and ramps UP to the
// ELECTRIC_MAX_WIDTH very quickly so the dispersion is dramatic.
// The exponent < 1 makes most of the widening happen close to the
// pinch; farther right the curve plateaus toward the max.
const electricExpand = (x: number) => {
  if (x <= PINCH_X) return 1.0;
  const d = x - PINCH_X;
  const base = Math.min(1.0, Math.pow(d / (FLOW_X_MAX - PINCH_X), ELECTRIC_RAMP_POWER));
  // The width here is relative to BASE_HALF_WIDTH; we interpolate
  // between BASE_HALF_WIDTH (gain=1) and ELECTRIC_MAX_WIDTH (gain=
  // ELECTRIC_FAN_GAIN).
  return 1.0 + (ELECTRIC_FAN_GAIN - 1.0) * base;
};

const halfWidthAtX = (x: number) => {
  const a = attractor(x);
  // The base width field (without per-side modulation) is the pinch
  // gauss pulling width toward PINCH_HALF_WIDTH.
  const w = PINCH_HALF_WIDTH + (BASE_HALF_WIDTH - PINCH_HALF_WIDTH) * (1 - a);
  // Apply magnetic-side (left) and electric-side (right) modulation.
  // On the right side, leftExpand returns 1.0 by definition; the
  // electricExpand function then ramps up to ELECTRIC_FAN_GAIN.
  return w * leftExpand(x) * electricExpand(x);
};

// Sample one particle's position at world x with lane in [-1, 1].
// We use a CatmullRomCurve3 per lane so the particle's path along x
// is a smooth curve through the field.
//
// On the right side (past the pinch) the y-jitter is amplified so
// individual particles visibly scatter as they accelerate out of the
// electric field — selling the "escape after acceleration" feel.
const samplePoint = (
  x: number,
  lane: number,
  yJitter: number,
  zJitter: number,
  electricYJitter: number,
  electricZJitter: number,
) => {
  const w = halfWidthAtX(x);
  // Past the bore, particles get extra y jitter proportional to how
  // far they've travelled through the electric field zone. The
  // per-lane jitter offsets are stable across x so each particle's
  // path is a smooth curve.
  const electricProgress = Math.max(
    0,
    Math.min(1, (x - PINCH_X) / (FLOW_X_MAX - PINCH_X)),
  );
  const y = lane * w + yJitter + electricProgress * electricYJitter;
  // z bows gently forward as particles move right, with a per-particle
  // offset so the cloud has depth. Past the bore, z bows out further
  // so the dispersion has 3D presence rather than reading as a flat fan.
  const zBase = -0.15 + 0.30 * ((x - FLOW_X_MIN) / (FLOW_X_MAX - FLOW_X_MIN));
  const z = zBase + zJitter + electricProgress * electricZJitter;
  return new THREE.Vector3(x, y, z);
};

const buildStreamCurve = (
  lane: number,
  yJitter: number,
  zJitter: number,
  electricYJitter: number,
  electricZJitter: number,
) => {
  const xs = [FLOW_X_MIN, -3, -2, -1, 0, PINCH_X, 2, 3, FLOW_X_MAX];
  const pts = xs.map((x) =>
    samplePoint(x, lane, yJitter, zJitter, electricYJitter, electricZJitter),
  );
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25);
};

// =========================================================
// Disturbed particle cloud
//
// 10000 particles distributed across 400 lanes. Each lane has its own
// persistent y/z jitter so the swarm has organic spread. Particle alpha
// is modulated by the local width so the cloud visibly thins where the
// beam pinches (and brightens there as the centre attractor boosts).
// =========================================================
const ParticleCloud = ({ count = 26000, speed = 1.0 }: { count?: number; speed?: number }) => {
  const laneCount = 400;

  // Persistent per-lane jitter so the swarm stays stable across frames.
  // The right-side electric jitter offsets are per-lane random values
  // that get applied ONLY past the bore (in samplePoint) — they read as
  // each particle's individual "scatter kick" from the electric field.
  const laneData = useMemo(() => {
    const arr: {
      yJitter: number;
      zJitter: number;
      electricYJitter: number;
      electricZJitter: number;
    }[] = [];
    for (let i = 0; i < laneCount; i++) {
      arr.push({
        yJitter: (Math.random() - 0.5) * 2 * Y_JITTER,
        zJitter: (Math.random() - 0.5) * 2 * Z_JITTER,
        electricYJitter: (Math.random() - 0.5) * 2 * Y_JITTER_ELECTRIC,
        electricZJitter: (Math.random() - 0.5) * 2 * 0.40,
      });
    }
    return arr;
  }, []);

  const curves = useMemo(() => {
    const list: THREE.CatmullRomCurve3[] = [];
    for (let i = 0; i < laneCount; i++) {
      // Lane in [-1, 1] with a small per-lane bias so the distribution
      // isn't perfectly uniform — a touch denser toward the centre.
      const u = (i + 0.5) / laneCount;
      const laneBias = 0.35;
      const lane = (u * 2 - 1) * (1 - laneBias) + laneBias * (1 - 2 * Math.abs(u * 2 - 1)) * (u * 2 - 1);
      const { yJitter, zJitter, electricYJitter, electricZJitter } = laneData[i];
      list.push(buildStreamCurve(lane, yJitter, zJitter, electricYJitter, electricZJitter));
    }
    return list;
  }, [laneData]);

  const { geometry, phases, curveIndex } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const progress = new Float32Array(count);
    const phase = new Float32Array(count);
    const curveIdx = new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      const ci = Math.floor(Math.random() * curves.length);
      curveIdx[i] = ci;
      const t0 = Math.random();
      phase[i] = t0;
      const p = curves[ci].getPoint(t0);
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      progress[i] = t0;
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1));
    return { geometry: g, phases: phase, curveIndex: curveIdx };
  }, [curves, count]);

  useFrame((state) => {
    const dt = state.clock.getDelta();
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const prog = geometry.getAttribute('aProgress') as THREE.BufferAttribute;
    // Particles speed up in the pinch region so the swarm visibly
    // accelerates as it threads the attractor.
    const step = (dt * speed) / 3.5;
    for (let i = 0; i < count; i++) {
      const tLocal = phases[i];
      // Boost factor peaks at PINCH_X (which maps to progress t =
      // (PINCH_X - FLOW_X_MIN) / FLOW_X_RANGE).
      const tPinch = (PINCH_X - FLOW_X_MIN) / (FLOW_X_MAX - FLOW_X_MIN);
      const boost = 1.0 + 0.9 * Math.exp(-Math.pow((tLocal - tPinch) / 0.10, 2));
      const next = phases[i] + step * boost;
      const t = ((next % 1) + 1) % 1;
      phases[i] = t;
      prog.array[i] = t;
      const p = curves[curveIndex[i]].getPoint(t);
      (pos.array as Float32Array)[i * 3 + 0] = p.x;
      (pos.array as Float32Array)[i * 3 + 1] = p.y;
      (pos.array as Float32Array)[i * 3 + 2] = p.z;
    }
    pos.needsUpdate = true;
    prog.needsUpdate = true;
  });

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColorCore: { value: new THREE.Color(0xfff0c0) },
        uColorMid: { value: new THREE.Color(0xffaa28) },
        uColorEdge: { value: new THREE.Color(0xff5a14) },
        uSize: { value: 14.0 },
        uTLeft: { value: (PINCH_X - FLOW_X_MIN) / (FLOW_X_MAX - FLOW_X_MIN) },
      },
      vertexShader: `
        attribute float aProgress;
        uniform float uSize;
        uniform float uTLeft;
        varying float vProgress;
        varying float vDepth;
        varying float vWidthRel;
        void main(){
          vProgress = aProgress;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vDepth = mvPosition.z;
          // Pinch boost: brighten & enlarge where the beam narrows so
          // the eye reads the attractor as a bright knot.
          float distFromPinch = abs(vProgress - uTLeft);
          float pinchBoost = 1.0 + 1.5 * exp(-pow(distFromPinch/0.08, 2.0));
          // Width-relative brightness: dim where the beam is wide
          // (lower particle density per unit area), bright where it's
          // pinched (concentrated particles). Cheap approximation:
          // the same gaussian that drives the width also drives the
          // per-particle brightness.
          float w = 0.55 + 0.55 * exp(-pow(distFromPinch/0.18, 2.0));
          vWidthRel = w;
          float size = uSize * (1.0 / max(0.001, -mvPosition.z)) * pinchBoost;
          gl_PointSize = size;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform vec3 uColorEdge;
        varying float vProgress;
        varying float vDepth;
        varying float vWidthRel;
        float hash(float n){ return fract(sin(n)*43758.5453123); }
        float noise(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main(){
          vec2 uv = gl_PointCoord.xy;
          float r = length(uv - 0.5) * 2.0;
          float core = smoothstep(0.0, 0.20, 1.0 - r);
          float halo = smoothstep(0.0, 1.0, 1.0 - r);
          float depthFactor = clamp(mix(0.55, 1.0, smoothstep(-18.0, -6.0, vDepth)), 0.5, 1.0);
          float flicker = noise(uv * 50.0 + vec2(vProgress * 6.0));
          // Soft ends so the cloud fades in/out instead of hard cut.
          float fadeIn = smoothstep(0.0, 0.10, vProgress);
          float fadeOut = smoothstep(1.0, 0.90, vProgress);
          // Three-stop gradient: deep amber edge -> bright gold mid ->
          // warm cream core. Lowered the per-particle alpha so additive
          // accumulation doesn't saturate the overlap regions to white —
          // keeps the cloud reading as golden rather than chalky.
          vec3 color = mix(uColorEdge, uColorMid, halo);
          color = mix(color, uColorCore, core * 0.55);
          float alpha = halo * 0.55 * fadeIn * fadeOut * vWidthRel;
          alpha *= mix(0.85, 1.25, flicker);
          alpha *= depthFactor;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
        }
      `,
    });
  }, []);

  return <points geometry={geometry} material={material} />;
};

const CTHeroScene = () => {
  return (
    <div
      data-testid="hero-background"
      data-flow-style="bore-funnel"
      className="w-full h-screen absolute inset-0 z-0 bg-black overflow-hidden group"
      style={{
        backgroundImage: 'url(/images/ct-hero.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 z-0 bg-black/55" />

      <Canvas className="relative z-10" camera={{ position: [0, 0, 10], fov: 35 }} gl={{ alpha: true }}>
        <ambientLight intensity={1.0} />
        <ParticleCloud count={26000} speed={1.0} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
    </div>
  );
};

export default CTHeroScene;