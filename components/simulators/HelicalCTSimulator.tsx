'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';

const HelicalCTSimulator: React.FC = () => {
  // --- State ---
  const [params, setParams] = useState({
    speed: 0.5,
    pitch: 1.0,
    kv: 120,
    ma: 200,
    kernel: 'soft',
    dualEnergy: false,
    scanning: false,
  });

  const [dose, setDose] = useState(0);
  const [logs, setLogs] = useState<string[]>(['> System Booting...']);

  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    gantryGroup: THREE.Group;
    tableGroup: THREE.Group;
    laser: THREE.Mesh;
    controls: OrbitControls;
  }>();

  // --- Helper: Log ---
  const addLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-4), `> ${msg}`]);
  };

  // --- 3D Initialization ---
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.Fog(0x111111, 5, 15);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(5, 3, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    const ambient = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Models
    // 1. Gantry Housing
    const coverGeo = new THREE.TorusGeometry(3.2, 1.2, 16, 50);
    const coverMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 });
    const housing = new THREE.Mesh(coverGeo, coverMat);
    scene.add(housing);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    scene.add(floor);

    // 2. Rotating Gantry
    const gantryGroup = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(2.5, 0.2, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    gantryGroup.add(ring);

    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), new THREE.MeshStandardMaterial({ color: 0xffaa00 }));
    tube.position.y = 2.0;
    gantryGroup.add(tube);

    const det = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x0088ff }));
    det.position.y = -2.0;
    gantryGroup.add(det);
    scene.add(gantryGroup);

    // 3. Table & Phantom
    const tableGroup = new THREE.Group();
    const bedGeo = new THREE.BoxGeometry(1.2, 0.1, 8);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    tableGroup.add(bed);

    const phGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32);
    const phMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const phantom = new THREE.Mesh(phGeo, phMat);
    phantom.rotation.x = Math.PI / 2;
    phantom.position.y = 0.3;
    tableGroup.add(phantom);

    tableGroup.position.y = -0.5;
    tableGroup.position.z = 4;
    scene.add(tableGroup);

    // Laser
    const laserGeo = new THREE.PlaneGeometry(0.05, 5);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    laser.rotation.z = Math.PI / 2;
    laser.visible = false;
    scene.add(laser);

    sceneRef.current = { scene, camera, renderer, gantryGroup, tableGroup, laser, controls };

    // Cleanup
    return () => {
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // --- Animation Loop ---
  useEffect(() => {
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);

      if (sceneRef.current) {
        const { renderer, scene, camera, gantryGroup, tableGroup, controls } = sceneRef.current;
        controls.update();

        if (params.scanning) {
          // Rotate Gantry
          const rotSpeed = (Math.PI * 2) / (params.speed * 60);
          gantryGroup.rotation.z -= rotSpeed;

          // Move Table
          const moveSpeed = (params.pitch * 0.1) * (rotSpeed / (Math.PI * 2));
          tableGroup.position.z -= moveSpeed;
          if (tableGroup.position.z < -4) {
            tableGroup.position.z = 4;
          }
        }

        renderer.render(scene, camera);
      }

      // Draw 2D continuously if scanning or just once if static (handled by effect below)
      if (params.scanning) {
        drawPhantom();
      }
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [params.scanning, params.speed, params.pitch]); // Re-bind when scanning params change

  // --- 2D Drawing Logic ---
  const drawPhantom = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 200;

    // Clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Helper
    const ellipse = (x: number, y: number, rw: number, rh: number, ang: number, col: string) => {
      ctx.beginPath();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang * Math.PI / 180);
      ctx.scale(rw, rh);
      ctx.arc(0, 0, 1, 0, 2 * Math.PI);
      ctx.restore();
      ctx.fillStyle = col;
      ctx.fill();
    };

    // Bone
    const boneColor = params.dualEnergy ? "#88ccff" : "#cccccc";
    ellipse(cx, cy, 0.9 * scale, 0.92 * scale, 0, boneColor);

    // Brain
    ellipse(cx, cy, 0.85 * scale, 0.87 * scale, 0, "#222");

    // Ventricles
    ellipse(cx - 0.2 * scale, cy, 0.15 * scale, 0.25 * scale, -15, "#444");
    ellipse(cx + 0.2 * scale, cy, 0.15 * scale, 0.25 * scale, 15, "#444");

    // Noise
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const signalStrength = (params.ma * Math.pow(params.kv, 2)) / 1000000;
    const noiseFactor = Math.max(0, 60 - signalStrength * 2);

    for (let i = 0; i < data.length; i += 4) {
      const val = data[i];
      if (val > 10) {
        const noise = (Math.random() - 0.5) * noiseFactor;
        data[i] = val + noise;
        data[i + 1] = val + noise;
        data[i + 2] = val + noise;

        if (params.dualEnergy && val > 150) {
          data[i + 2] += 50; // Blue boost
        }
      } else {
        const airNoise = (Math.random()) * (noiseFactor * 0.2);
        data[i] = airNoise;
        data[i + 1] = airNoise;
        data[i + 2] = airNoise;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Filters
    let filters = [];
    if (params.kernel === 'soft') filters.push('blur(1px)');
    if (params.kernel === 'bone') filters.push('contrast(1.3)');
    if (params.kernel === 'lung') filters.push('contrast(2.0) brightness(0.8)');
    if (params.scanning && params.pitch > 1.5) filters.push('blur(2px)');

    ctx.filter = filters.join(' ');
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  };

  // Trigger draw on param change
  useEffect(() => {
    drawPhantom();
    // Update Dose
    const newDose = (params.ma * Math.pow(params.kv / 100, 2) / params.pitch);
    setDose(parseFloat(newDose.toFixed(1)));

    if (sceneRef.current) {
      sceneRef.current.laser.visible = params.scanning;
    }
  }, [params]);

  // --- Handlers ---
  const toggleScan = () => {
    setParams(p => ({ ...p, scanning: !p.scanning }));
    addLog(params.scanning ? "Scan stopped." : "Scan started.");
  };

  const toggleDualEnergy = () => {
    setParams(p => ({ ...p, dualEnergy: !p.dualEnergy }));
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[var(--sim-bg)] text-[var(--sim-text)] font-sans overflow-hidden">
      {/* Main Display */}
      <div className="flex flex-1 min-h-0 border-b-4 border-black">
        {/* 3D View */}
        <div ref={containerRef} className="flex-1 relative bg-[#111] border-r-2 border-[#333]">
          <div className="absolute top-4 left-4 font-mono text-sm text-[var(--sim-accent)] z-10 pointer-events-none">
            GANTRY ROOM VIEW<br />
            STATUS: <span className={params.scanning ? "text-red-500" : ""}>{params.scanning ? "EXPOSURE" : "STANDBY"}</span>
          </div>
        </div>

        {/* Image View */}
        <div className="flex-1 bg-black flex flex-col items-center justify-center relative">
          <div className="absolute top-4 left-4 font-mono text-sm text-[var(--sim-accent)] pointer-events-none">
            REAL-TIME RECONSTRUCTION
          </div>
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            className="bg-black shadow-[0_0_20px_rgba(255,255,255,0.1)] max-w-[90%] max-h-[80%] aspect-square"
          />
          <div className="mt-2 font-mono text-xs text-gray-500">
            Dose: {dose} mGy
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="h-[300px] bg-[var(--sim-panel)] grid grid-cols-4 gap-4 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.5)] z-20">

        {/* Motion Control */}
        <Card title="Motion Control" className="bg-transparent border-[#444] !p-0">
          <div className="p-3 flex flex-col gap-4">
            <Slider
              label="Rotation Time (s)"
              valueDisplay={params.speed}
              min={0.2} max={2.0} step={0.1}
              value={params.speed}
              onChange={(e) => setParams({ ...params, speed: parseFloat(e.target.value) })}
            />
            <Slider
              label="Pitch"
              valueDisplay={params.pitch}
              min={0.1} max={2.0} step={0.1}
              value={params.pitch}
              onChange={(e) => setParams({ ...params, pitch: parseFloat(e.target.value) })}
            />
            <Button
              variant={params.scanning ? "danger" : "neon"}
              className="mt-auto w-full"
              onClick={toggleScan}
            >
              {params.scanning ? "STOP SCAN" : "START SCAN"}
            </Button>
          </div>
        </Card>

        {/* Exposure */}
        <Card title="Exposure" className="bg-transparent border-[#444] !p-0">
          <div className="p-3 flex flex-col gap-4">
            <Slider
              label="Tube Voltage (kV)"
              valueDisplay={params.kv}
              min={80} max={140} step={10}
              value={params.kv}
              onChange={(e) => setParams({ ...params, kv: parseInt(e.target.value) })}
            />
            <Slider
              label="Tube Current (mA)"
              valueDisplay={params.ma}
              min={50} max={800} step={50}
              value={params.ma}
              onChange={(e) => setParams({ ...params, ma: parseInt(e.target.value) })}
            />
          </div>
        </Card>

        {/* Reconstruction */}
        <Card title="Reconstruction" className="bg-transparent border-[#444] !p-0">
          <div className="p-3 flex flex-col gap-4">
            <Select
              label="Kernel"
              options={[
                { value: 'soft', label: 'Standard (Soft)' },
                { value: 'bone', label: 'Bone (Sharp)' },
                { value: 'lung', label: 'Lung (High Contrast)' },
              ]}
              value={params.kernel}
              onChange={(e) => {
                setParams({ ...params, kernel: e.target.value });
                addLog(`Kernel changed to: ${e.target.value}`);
              }}
            />
            <Button
              variant={params.dualEnergy ? "neon" : "outline"}
              className="mt-auto w-full"
              onClick={toggleDualEnergy}
            >
              {params.dualEnergy ? "Dual Energy: ON" : "Dual Energy: OFF"}
            </Button>
          </div>
        </Card>

        {/* System Log */}
        <Card title="System Log" className="bg-transparent border-[#444] !p-0">
          <div className="p-3 h-full overflow-y-auto font-mono text-[10px] text-green-500">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default HelicalCTSimulator;