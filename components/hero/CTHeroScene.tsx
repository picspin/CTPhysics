import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// --- Shaders ---

// --- Shaders ---

// removed complex noise shader

// removed noisy shader in favor of calm simple fiber shader

// removed glow shader for minimalist aesthetic

// --- Components ---

// Image Plane removed in favor of CSS Background


// removed complex light-beam curve in favor of FlowFiber

// Particle-based S curve flow using THREE.Points
const ParticleFlow = ({ count = 12000, speed = 0.7 }: { count?: number; speed?: number }) => {
    const pointsRef = useRef<THREE.Points>(null);

    const curves = useMemo(() => {
        const k = 0.8; // swirl frequency
        const phaseBase = Math.random() * Math.PI * 2;
        const radiusAtX = (x: number) => {
            if (x <= 0) {
                const t = (x + 10) / 10; // [-10,0] -> [0,1]
                return 5 * (1 - t) + 1.5 * t; // 5 -> 1.5
            } else {
                const t = x / 10; // [0,10] -> [0,1]
                return 1.5 * (1 - t) + 8 * t; // 1.5 -> 8
            }
        };
        const zBaseAtX = (x: number) => -6 * (1 - (x + 10) / 20) + 2 * ((x + 10) / 20); // -6 -> 2
        const makePoint = (x: number, offset: number) => {
            const r = radiusAtX(x);
            const y = r * Math.cos(k * x + offset);
            const z = zBaseAtX(x) + r * Math.sin(k * x + offset);
            return new THREE.Vector3(x, y, z);
        };
        const makeCurve = (offset: number) => {
            const xs = [-10, -7, -4, -2, 0, 2, 5, 8, 10];
            const pts = xs.map((x) => makePoint(x, offset));
            return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25);
        };
        const list: THREE.CatmullRomCurve3[] = [];
        const curvesCount = 1000; // 1000 independent braided curves
        for (let i = 0; i < curvesCount; i++) {
            const off = phaseBase + (i * 2 * Math.PI) / curvesCount;
            list.push(makeCurve(off));
        }
        return list;
    }, []);

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
        const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
        const prog = geometry.getAttribute('aProgress') as THREE.BufferAttribute;
        const time = state.clock.elapsedTime;
        for (let i = 0; i < count; i++) {
            const t = (phases[i] + time * speed) % 1;
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
                uTime: { value: 0 },
                uColorDim: { value: new THREE.Color(0xffaa00) },
                uColorBright: { value: new THREE.Color(0xffd700) },
                uSize: { value: 2.2 },
            },
            vertexShader: `
                attribute float aProgress;
                uniform float uSize;
                varying float vProgress;
                varying float vDepth;
                void main(){
                    vProgress = aProgress;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vDepth = mvPosition.z;
                    float centerScale = 1.0 + 0.8 * exp(-pow((vProgress - 0.5)/0.18, 2.0));
                    float size = uSize * (1.0 / max(0.001, -mvPosition.z)) * centerScale;
                    gl_PointSize = size;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                precision highp float;
                uniform float uTime;
                uniform vec3 uColorDim;
                uniform vec3 uColorBright;
                varying float vProgress;
                varying float vDepth;
                float hash(float n){ return fract(sin(n)*43758.5453123); }
                float noise(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
                void main(){
                    vec2 uv = gl_PointCoord.xy;
                    float circle = smoothstep(1.0, 0.0, length(uv - 0.5) * 2.0);
                    float depthFactor = clamp(mix(0.6, 1.0, smoothstep(-16.0, -6.0, vDepth)), 0.5, 1.0);
                    float flicker = noise(uv * 80.0 + vec2(uTime*2.0, uTime*3.0));
                    float fadeIn = smoothstep(0.0, 0.35, vProgress);
                    float fadeOut = smoothstep(1.0, 0.75, vProgress);
                    float centerBoost = 0.9 + 0.6 * exp(-pow((vProgress - 0.5)/0.18, 2.0));
                    float edgeFactor = 1.0 - smoothstep(0.3, 0.7, vProgress);
                    float grainAmp = mix(1.0, 1.6, edgeFactor);
                    float baseAlpha = 0.5;
                    float alpha = baseAlpha * fadeIn * fadeOut * centerBoost;
                    alpha *= circle;
                    alpha *= mix(0.7, 1.3, flicker * grainAmp);
                    alpha *= depthFactor;
                    vec3 color = mix(uColorDim, uColorBright, vProgress);
                    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
                }
            `,
        });
    }, []);

    return <points ref={pointsRef} geometry={geometry} material={material} />;
};

const CTHeroScene = () => {
    // Fixed speed, interaction is now handled by Satellite Orbit acceleration
    const speedFixed = 0.8;

    return (
        <div
            data-testid="hero-background"
            data-flow-style="particle-s-curve"
            className="w-full h-screen absolute inset-0 z-0 bg-black overflow-hidden group"
            style={{
                backgroundImage: 'url(/images/ct-hero.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            }}
        >
            <div className="absolute inset-0 z-0 bg-black/70" />

            <Canvas className="relative z-10" camera={{ position: [0, 0, 10], fov: 35 }} gl={{ alpha: true }}>
                <ambientLight intensity={1.0} />
                <ParticleFlow count={12000} speed={speedFixed} />

                {/* No center glow and no postprocessing for a calm aesthetic */}

                <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 1.5} minPolarAngle={Math.PI / 3} />
            </Canvas>
        </div>
    );
};

export default CTHeroScene;
