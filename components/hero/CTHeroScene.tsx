import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// --- Shaders ---

// --- Shaders ---

// Simplex Noise for Curl Noise
const CurlNoiseShader = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857; 
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); 
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );  
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

vec3 curlNoise(vec3 p) {
  const float e = 0.5;
  float n1 = snoise(vec3(p.x, p.y + e, p.z));
  float n2 = snoise(vec3(p.x, p.y - e, p.z));
  float n3 = snoise(vec3(p.x, p.y, p.z + e));
  float n4 = snoise(vec3(p.x, p.y, p.z - e));
  float n5 = snoise(vec3(p.x + e, p.y, p.z));
  float n6 = snoise(vec3(p.x - e, p.y, p.z));
  float x = n2 - n1;
  float y = n4 - n3;
  float z = n6 - n5;
  return vec3(x, y, z);
}
`;

const FlowShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 0.5 },
        uColor: { value: new THREE.Color(0x00ffff) }
    },
    vertexShader: `
    ${CurlNoiseShader}
    
    uniform float uTime;
    uniform float uSpeed;
    varying vec2 vUv;
    varying float vNoise;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float t = uTime * uSpeed * 0.5;
      vec3 noise = curlNoise(vec3(pos.x * 0.1, pos.y * 0.1, pos.z * 0.1 + t));
      pos += noise * 0.5;
      vNoise = noise.r;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
    fragmentShader: `
    uniform vec3 uColor;
    varying vec2 vUv;
    varying float vNoise;
    
    void main() {
      float alpha = smoothstep(0.0, 0.5, abs(vNoise)) * smoothstep(0.4, 0.6, abs(vUv.y - 0.5) * 2.0);
      float packet = sin(vUv.x * 30.0 + vNoise * 5.0);
      alpha += smoothstep(0.9, 1.0, packet) * 0.5;
      gl_FragColor = vec4(uColor, alpha);
    }
  `
};

const GlowRingShader = {
    uniforms: {
        uColor: { value: new THREE.Color(0x40e0d0) },
        uTime: { value: 0 }
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    uniform vec3 uColor;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      float dist = distance(vUv, vec2(0.5));
      float ring = smoothstep(0.3, 0.35, dist) * smoothstep(0.5, 0.4, dist);
      float pulse = 0.8 + 0.2 * sin(uTime * 3.0);
      gl_FragColor = vec4(uColor, ring * pulse * 0.8);
    }
  `
};

// --- Components ---

// Image Plane removed in favor of CSS Background


const LightBeamCurve = ({ index, total, speed }: { index: number, total: number, speed: number }) => {
    const curveRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    // Create a CatmullRomCurve3
    const curve = useMemo(() => {
        // Curve passing through center (0,0,0) with random entry/exit
        const entryAngle = (index / total) * Math.PI * 2;
        const radius = 15; // Wider radius to envelop the view

        // Pushing points to create a "funnel" through the center
        const p1 = new THREE.Vector3(Math.cos(entryAngle) * radius, Math.sin(entryAngle) * radius, 15);
        const p2 = new THREE.Vector3(Math.cos(entryAngle + 0.2) * 2, Math.sin(entryAngle + 0.2) * 2, 5); // Tighter choke point
        const center = new THREE.Vector3(0, 0, 0); // The Isocenter
        const p3 = new THREE.Vector3(Math.cos(entryAngle + Math.PI) * 2, Math.sin(entryAngle + Math.PI) * 2, -5);
        const p4 = new THREE.Vector3(Math.cos(entryAngle + Math.PI) * radius, Math.sin(entryAngle + Math.PI) * radius, -15);

        return new THREE.CatmullRomCurve3([p1, p2, center, p3, p4], false, 'catmullrom', 0.5);
    }, [index, total]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uSpeed.value = speed;
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <mesh ref={curveRef}>
            <tubeGeometry args={[curve, 128, 0.1, 8, false]} />
            <shaderMaterial
                ref={materialRef}
                args={[FlowShaderMaterial]}
                transparent
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
                depthWrite={false}
            />
        </mesh>
    );
};

const CenterGlow = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    useFrame((state) => {
        if (meshRef.current && materialRef.current) {
            meshRef.current.rotation.z -= 0.02;
            const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
            meshRef.current.scale.set(s, s, s);
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <group>
            {/* Inner Core - High Intensity */}
            <mesh>
                <sphereGeometry args={[0.8, 32, 32]} />
                <meshBasicMaterial color={new THREE.Color(0.8, 1.0, 1.0)} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
            </mesh>
            {/* Secondary Core - Color Halo */}
            <mesh>
                <sphereGeometry args={[2.5, 32, 32]} />
                <meshBasicMaterial color={new THREE.Color(0.0, 0.5, 1.0)} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Outer Ring Glow using Shader */}
            <mesh ref={meshRef} rotation={[0, 0, 0]}>
                <ringGeometry args={[3.0, 5.0, 64]} />
                <shaderMaterial
                    ref={materialRef}
                    args={[GlowRingShader]}
                    transparent
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
};


const ElectricFlow = () => {
    // Simulated electric arcs on sides
    const arcs = useMemo(() => {
        return Array(4).fill(0).map((_, i) => {
            const rot = (i / 4) * Math.PI * 2 + Math.PI / 4;
            return {
                rotation: [0, 0, rot] as [number, number, number],
                position: [Math.cos(rot) * 8, Math.sin(rot) * 8, 0] as [number, number, number]
            };
        });
    }, []);

    return (
        <group>
            {arcs.map((arc, i) => (
                <Float key={i} speed={15} rotationIntensity={0.2} floatIntensity={0.5}>
                    <mesh position={arc.position} rotation={arc.rotation}>
                        <planeGeometry args={[0.3, 6]} />
                        <meshBasicMaterial color={0xaaddff} transparent opacity={0.6} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
                    </mesh>
                </Float>
            ))}
        </group>
    );
};

const CTHeroScene = () => {
    // Fixed speed, interaction is now handled by Satellite Orbit acceleration
    const speed = 0.8;

    return (
        <div
            className="w-full h-screen absolute top-0 left-0 -z-10 bg-black overflow-hidden group"
            style={{
                backgroundImage: 'url(/images/ct-hero.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            }}
        >
            <div className="absolute inset-0 bg-black/60" /> {/* Overlay to darken background for neon contrast */}

            <Canvas camera={{ position: [0, 0, 15], fov: 35 }} gl={{ alpha: true, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}>
                {/* Reduced fog to ensure background is visible but depth is maintained */}
                {/* Fog matching the dark overlay */}
                <fog attach="fog" args={['#000000', 30, 100]} />
                <ambientLight intensity={2.0} />

                {/* LightBeams - Oxygen/Data Flow */}
                {Array.from({ length: 20 }).map((_, i) => (
                    <LightBeamCurve key={i} index={i} total={20} speed={speed} />
                ))}

                {/* Center Glow */}
                <CenterGlow />

                {/* Electric Flow */}
                <ElectricFlow />

                <EffectComposer enableNormalPass={false}>
                    <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} height={300} intensity={2.0} />
                </EffectComposer>

                <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 1.5} minPolarAngle={Math.PI / 3} />
            </Canvas>
        </div>
    );
};

export default CTHeroScene;
