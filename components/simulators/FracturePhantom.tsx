'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const FractureShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;

    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec2 uv = vUv * 2.0 - 1.0;
      float r = length(uv);
      
      // Bone structure (ring)
      float bone = smoothstep(0.5, 0.48, r) - smoothstep(0.3, 0.28, r);
      
      // Marrow / Inner structure
      float marrow = smoothstep(0.28, 0.0, r) * 0.5;
      
      // Fracture line (noise based)
      float noise = snoise(uv * 5.0 + uTime * 0.1);
      float fracture = smoothstep(0.02, 0.03, abs(uv.y - noise * 0.1));
      
      // Combine
      float density = (bone + marrow);
      
      // Apply fracture mask only to bone area
      if (r > 0.28 && r < 0.5) {
          // Simple fracture cut
          if (abs(uv.x) < 0.8 && abs(uv.y + noise * 0.1) < 0.02) {
              density = 0.0;
          }
      }

      // Add some noise texture to bone
      density += bone * snoise(uv * 20.0) * 0.1;

      gl_FragColor = vec4(vec3(density), 1.0);
    }
  `
};

const PhantomMesh = () => {
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    const shaderMaterial = useMemo(() => new THREE.ShaderMaterial(FractureShaderMaterial), []);

    return (
        <mesh>
            <planeGeometry args={[2, 2]} />
            <primitive object={shaderMaterial} ref={materialRef} />
        </mesh>
    );
};

const FracturePhantom = () => {
    return (
        <div className="w-full h-full bg-black">
            <Canvas camera={{ position: [0, 0, 1] }}>
                <PhantomMesh />
            </Canvas>
        </div>
    );
};

export default FracturePhantom;
