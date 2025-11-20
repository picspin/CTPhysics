'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Button } from '@/components/ui/Button';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Background Animation (Three.js) ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    // Dark background matching the theme
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.002);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Particles representing X-rays/Photons
    const geometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 100;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const material = new THREE.PointsMaterial({
      size: 0.1,
      color: 0x00d2ff, // Neon Blue
      transparent: true,
      opacity: 0.8,
    });
    const particlesMesh = new THREE.Points(geometry, material);
    scene.add(particlesMesh);

    // Abstract Gantry Ring
    const ringGeo = new THREE.TorusGeometry(15, 0.2, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 0.3 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ring);

    const ring2Geo = new THREE.TorusGeometry(12, 0.1, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.2 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 2;
    scene.add(ring2);

    // Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);

      particlesMesh.rotation.y += 0.001;
      particlesMesh.rotation.x += 0.0005;

      ring.rotation.z -= 0.005;
      ring.rotation.y += 0.002;

      ring2.rotation.x += 0.005;
      ring2.rotation.z += 0.002;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const modules = [
    { href: '/reconstruction', title: 'CT Reconstruction', desc: 'Helical CT, Backprojection & Pitch', color: 'border-orange-500' },
    { href: '/dose', title: 'Dose Measurement', desc: 'CTDI, DLP & Safety', color: 'border-blue-500' },
    { href: '/cardiac', title: 'Cardiac CT', desc: 'Gating & Temporal Resolution', color: 'border-red-500' },
    { href: '/dual-energy', title: 'Dual Energy', desc: 'Spectral Imaging & Tissue Characterization', color: 'border-purple-500' },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      {/* Background Canvas */}
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full -z-10" />

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-blue-500">
            CT PHYSICS
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-8 font-light">
            Interactive Simulation & Advanced Imaging Principles
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Link href="/reconstruction">
              <Button variant="neon" size="lg" className="min-w-[200px]">
                Start Simulation
              </Button>
            </Link>
            <Link href="/questions">
              <Button variant="outline" size="lg" className="min-w-[200px] border-gray-500 text-gray-300 hover:text-white hover:border-white">
                Review Questions
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Module Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          {modules.map((mod, idx) => (
            <Link key={idx} href={mod.href}>
              <motion.div
                whileHover={{ scale: 1.05, translateY: -5 }}
                className={`h-full p-6 rounded-xl bg-white/5 backdrop-blur-sm border ${mod.color} border-opacity-50 hover:border-opacity-100 transition-all cursor-pointer group`}
              >
                <h3 className="text-xl font-bold mb-2 group-hover:text-white text-gray-200">{mod.title}</h3>
                <p className="text-sm text-gray-400 group-hover:text-gray-300">{mod.desc}</p>
              </motion.div>
            </Link>
          ))}
        </motion.div>
      </div>
    </main>
  );
}