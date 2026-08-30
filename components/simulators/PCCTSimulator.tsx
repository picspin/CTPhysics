'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Card } from '@/components/ui/Card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { calculatePCCTSpectrum, calculatePCCTMetrics, getMaterialAttenuation, generatePCCTSinogramData, PCCTParams, getKEdgeCurveData } from '@/utils/pcct-physics';

import { useLanguage } from '@/context/LanguageContext';
import { createDetectorMaterials, disposeDetectorMaterials } from '@/utils/three/detectorMaterials';
import { createPCDDetector, DetectorViewMode, PCDDetectorStats } from './_fx/PCDDetector';

const PCCTSimulator: React.FC = () => {
  const { t } = useLanguage();
  const [params, setParams] = useState<PCCTParams>({
    kVp: 120,
    photonFlux: 5, // Mcps/mm2
    bmi: 24,
    calciumDensity: 50,
    stentDiameter: 0.12,
    contrastConcentration: 6,
    pixelSize: 0.15,
    threshold1: 25,
    threshold2: 50,
    threshold3: 80,
    enableElectronicNoise: false,
    activeMaterialChannel: 'composite',
    contrastAgent: 'iodine',
  });

  const [activeTab, setActiveTab] = useState<'acquisition' | 'detector' | '3dview' | 'decomposition'>('acquisition');
  
  const eidCanvasRef = useRef<HTMLCanvasElement>(null);
  const pcctCanvasRef = useRef<HTMLCanvasElement>(null);
  const sinogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBin, setSelectedBin] = useState<number>(2);
  const [vmiEnergy, setVmiEnergy] = useState<number>(70); // 40, 60, 70, 100 keV

  // --- 3D scene refs (Phase 6) ---
  const det3dContainerRef = useRef<HTMLDivElement | null>(null);
  const det3dSceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    detector: ReturnType<typeof createPCDDetector>;
    materials: ReturnType<typeof createDetectorMaterials>;
  }>();
  const det3dFrameRef = useRef<number>();
  // The animation loop reads params through a ref so that moving a
  // slider does not tear down and restart the loop on every keystroke.
  const paramsRef = useRef<PCCTParams>(params);
  const [detectorView, setDetectorView] = useState<DetectorViewMode>('both');
  // Mirrors detectorView so the init effect can apply the current mode
  // to a freshly built scene without listing it as a dependency.
  const detectorViewRef = useRef<DetectorViewMode>('both');
  // Which container generation the scene is attached to. Bumped whenever
  // the 3D tab is (re)mounted, so the init effect rebuilds against the
  // freshly mounted div rather than a detached one.
  const [det3dMountKey, setDet3dMountKey] = useState(0);
  const [detStats, setDetStats] = useState<PCDDetectorStats>({
    bin1: 0,
    bin2: 0,
    bin3: 0,
    subThreshold: 0,
    pileUp: 0,
    eidIntegral: 0,
    eidPhotons: 0,
  });

  const metrics = calculatePCCTMetrics(params);
  

  const pulseDeadTime = 0.05;
  const pulseRate = params.photonFlux * pulseDeadTime;
  const pileUpFraction = Math.round((1 - Math.exp(-pulseRate)) * 100);
  const rawSpectrum = calculatePCCTSpectrum(params.kVp);

  // Generate energy spectrum chart data
  const chartData = rawSpectrum.map((pt) => {
    const energy = pt.energy;
    const idealIntensity = pt.intensity;

    // Pulse pile-up causes spectrum shifting towards higher energy
    // and overall count reduction
    
    

    // Find the ideal intensity at corresponding shifted location
    // We approximate it by scaling the ideal spectrum shape
    const scaleFactor = Math.exp(-params.photonFlux * 0.04);
    let distortedIntensity = idealIntensity * scaleFactor;

    // Charge sharing adds a low-energy hump/scatter contribution
    if (energy < 40) {
      const chargeSharingHump = Math.max(0, (40 - energy) * params.photonFlux * 1.5);
      distortedIntensity += chargeSharingHump;
    }

    // Electronic noise adds high-frequency scatter at ultra low energy
    if (params.enableElectronicNoise && energy < 25) {
      distortedIntensity += 80;
    }

    return {
      energy,
      'Ideal Spectrum (理想能谱)': Math.round(idealIntensity),
      'Distorted (堆积+电荷共享畸变谱)': Math.round(distortedIntensity),
    };
  });

  useEffect(() => {
    const drawCTSlice = (canvas: HTMLCanvasElement | null, type: 'EID' | 'PCCT') => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const imgData = ctx.createImageData(w, h);

      let noiseLevel = type === 'EID' ? 0.08 : 0.03;
      noiseLevel *= (1 + (params.bmi - 22) * 0.08);
      if (type === 'EID') {
        noiseLevel += (metrics.eidElectronicNoise / 250);
      } else {
        if (params.enableElectronicNoise && params.threshold1 < 20) {
          noiseLevel += (metrics.pcctElectronicNoise / 250);
        }
      }
      if (type === 'PCCT') {
        noiseLevel += (pileUpFraction / 250);
      }

      // VMI physics scaling factor based on selected keV
      const vmiScale = vmiEnergy === 40 ? 1.7 : vmiEnergy === 60 ? 1.2 : vmiEnergy === 70 ? 1.0 : 0.6;
      // Metal streak artifact severity decays with energy
      const metalStreakSeverity = vmiEnergy === 40 ? 0.30 : vmiEnergy === 60 ? 0.14 : vmiEnergy === 70 ? 0.08 : 0.01;
      // Blooming decays with energy
      const bloomingEnergyScale = vmiEnergy === 40 ? 1.6 : vmiEnergy === 60 ? 1.2 : vmiEnergy === 70 ? 1.0 : 0.55;

      for (let y = 0; y < h; y++) {
        const ny = (y - h / 2) / (h / 2);
        for (let x = 0; x < w; x++) {
          const nx = (x - w / 2) / (w / 2);
          const r2 = nx * nx + ny * ny;

          let baseVal = 0.15;

          if (r2 < 0.6) {
            baseVal = 0.22;
            const angle = Math.atan2(ny, nx);
            const numWires = 10;
            const wireAngleStep = (2 * Math.PI) / numWires;
            
            const nearestWireAngle = Math.round(angle / wireAngleStep) * wireAngleStep;
            const distToWire = Math.hypot(nx - 0.4 * Math.cos(nearestWireAngle), ny - 0.4 * Math.sin(nearestWireAngle));
            const isMetal = distToWire < (params.stentDiameter * 0.4);

            const distToPlaque = Math.hypot(nx - 0.15, ny + 0.15);
            const isCalcium = distToPlaque < 0.12;

            const distToLumen = Math.hypot(nx, ny);
            const isLumen = distToLumen < 0.35 && !isCalcium;

            if (isMetal) {
              baseVal = 0.95;
            } else if (isCalcium) {
              baseVal = (0.4 + (params.calciumDensity / 200)) * vmiScale;
            } else if (isLumen) {
              // Apply monoenergetic attenuation at specific VMI keV
              const attVal = getMaterialAttenuation(params.contrastAgent, vmiEnergy, params.contrastConcentration);
              baseVal = 0.25 + Math.min(0.65, attVal * 0.2) * vmiScale;
            }

            if (isMetal) {
              // Streak artifacts centered around metal (decays at higher keV)
              const streak = Math.sin(angle * 12) * metalStreakSeverity;
              baseVal = Math.min(1.0, Math.max(0, baseVal + streak));
            }
          }

          if (type === 'PCCT' && activeTab === 'decomposition') {
            const distToPlaque = Math.hypot(nx - 0.15, ny + 0.15);
            const isCalcium = distToPlaque < 0.12;
            const distToLumen = Math.hypot(nx, ny);
            const isLumen = distToLumen < 0.35 && !isCalcium;

            if (params.activeMaterialChannel === 'iodine') {
              baseVal = isLumen ? (params.contrastConcentration / 10) * 0.8 * vmiScale : 0.05;
            } else if (params.activeMaterialChannel === 'calcium') {
              baseVal = isCalcium ? (params.calciumDensity / 100) * 0.8 * vmiScale : 0.05;
            } else if (params.activeMaterialChannel === 'residual') {
              baseVal = (r2 < 0.6) ? 0.08 + (Math.random() - 0.5) * 0.04 : 0.02;
            }
          }

          let pixelVal = baseVal;
          if (type === 'EID') {
            const distToPlaque = Math.hypot(nx - 0.15, ny + 0.15);
            if (distToPlaque < 0.25) {
              // EID has massive blooming due to lower resolution
              const bloomingScale = (metrics.eidBlooming / 100) * bloomingEnergyScale;
              pixelVal += (0.15 * bloomingScale * (1.0 - distToPlaque / 0.25));
            }
            if (Math.abs(Math.sqrt(r2) - 0.4) < 0.08) {
              pixelVal = pixelVal * 0.8 + 0.2 * 0.6;
            }
          } else {
            const distToPlaque = Math.hypot(nx - 0.15, ny + 0.15);
            if (distToPlaque < 0.16) {
              // PCCT has minimal blooming, further suppressed at high keV
              const bloomingScale = (metrics.pcctBlooming / 100) * bloomingEnergyScale;
              pixelVal += (0.05 * bloomingScale * (1.0 - distToPlaque / 0.16));
            }
          }

          const randomNoise = (Math.random() - 0.5) * noiseLevel;
          const finalVal = Math.min(255, Math.max(0, Math.round((pixelVal + randomNoise) * 255)));

          const idx = (y * w + x) * 4;
          if (type === 'PCCT' && activeTab === 'decomposition' && params.activeMaterialChannel === 'composite') {
            const distToPlaque = Math.hypot(nx - 0.15, ny + 0.15);
            const isCalcium = distToPlaque < 0.12;
            const distToLumen = Math.hypot(nx, ny);
            const isLumen = distToLumen < 0.35 && !isCalcium;

            let r = 20;
            let g = 20;
            let b = 50;

            if (isCalcium) {
              r = Math.round((0.5 + params.calciumDensity / 200 + randomNoise) * vmiScale * 255);
              g = 30;
              b = 30;
            } else if (isLumen) {
              r = 30;
              g = Math.round((0.4 + params.contrastConcentration / 15 + randomNoise) * vmiScale * 255);
              b = 40;
            } else if (r2 < 0.6) {
              r = 40;
              g = 40;
              b = Math.round((baseVal + randomNoise) * 255);
            } else {
              r = g = b = Math.round((0.1 + randomNoise) * 255);
            }

            imgData.data[idx] = Math.min(255, Math.max(0, r));
            imgData.data[idx + 1] = Math.min(255, Math.max(0, g));
            imgData.data[idx + 2] = Math.min(255, Math.max(0, b));
            imgData.data[idx + 3] = 255;
          } else {
            imgData.data[idx] = finalVal;
            imgData.data[idx + 1] = finalVal;
            imgData.data[idx + 2] = finalVal;
            imgData.data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);

      ctx.fillStyle = type === 'PCCT' ? '#34d399' : '#a78bfa';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(type === 'PCCT' ? '光子计数 CT (PCCT)' : '传统积分 CT (EID)', 10, 20);
    };

    drawCTSlice(eidCanvasRef.current, 'EID');
    drawCTSlice(pcctCanvasRef.current, 'PCCT');

    // Draw PCCT Sinogram (Projection Layer)
    const sinoCanvas = sinogramCanvasRef.current;
    if (sinoCanvas) {
      const ctx = sinoCanvas.getContext('2d');
      if (ctx) {
        const w = sinoCanvas.width;
        const h = sinoCanvas.height;
        const sinoData = generatePCCTSinogramData(params, selectedBin, h, w);
        const imgData = ctx.createImageData(w, h);
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const val = sinoData[y][x];
            const pixelVal = Math.round((1.0 - val) * 255);
            const idx = (y * w + x) * 4;
            imgData.data[idx] = pixelVal;
            imgData.data[idx + 1] = pixelVal;
            imgData.data[idx + 2] = pixelVal;
            imgData.data[idx + 3] = 255;
          }
        }
        ctx.putImageData(imgData, 0, 0);

        ctx.fillStyle = '#34d399';
        ctx.font = '10px sans-serif';
        ctx.fillText(`Sinogram (Bin ${selectedBin})`, 10, 20);
      }
    }
  }, [params, metrics, activeTab, pileUpFraction, selectedBin, vmiEnergy]);

  // =================================================================
  // PHASE 6 — 3D detector-perspective scene (EID vs PCD)
  // =================================================================
  //
  // The scene lives inside the "3D 视图" tab, so its container div only
  // exists while that tab is selected. We therefore key the init effect
  // on a mount counter that the tab's callback ref bumps — the effect
  // runs against a div that is actually in the document, and tears the
  // renderer down again when the user leaves the tab.

  // Keep the animation loop's view of params current without restarting
  // the loop (which would reset the elapsed-time origin every frame a
  // slider moves).
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  // The 3D container mounts/unmounts with the tab. A callback ref lets
  // us notice the mount and trigger the init effect.
  const attachDet3dContainer = React.useCallback((node: HTMLDivElement | null) => {
    det3dContainerRef.current = node;
    if (node) setDet3dMountKey((k) => k + 1);
  }, []);

  // --- Init effect: build renderer/scene/camera when the tab mounts ---
  useEffect(() => {
    if (activeTab !== '3dview') return;
    const container = det3dContainerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05080d);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 2.6, 6.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, -0.2, 0);
    controls.update();

    // A modest two-light rig is enough — this scene is small, no IBL
    // needed. The only high-metalness materials are the electrode and
    // the septa, which read fine under ambient + key without an
    // environment map.
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffe6c8, 1.4);
    key.position.set(4, 5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xa6c8ff, 0.6);
    fill.position.set(-4, 2, -2);
    scene.add(fill);

    // Subtle floor for orientation
    const floorGeo = new THREE.PlaneGeometry(16, 10);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c1014, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.0;
    scene.add(floor);

    // Detector materials + scene
    const detMaterials = createDetectorMaterials();
    const detector = createPCDDetector(detMaterials);
    scene.add(detector.group);
    detector.setViewMode(detectorViewRef.current);

    det3dSceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      detector,
      materials: detMaterials,
    };

    // Render one frame immediately so the panel is never blank while the
    // animation effect is still spinning up.
    detector.update(paramsRef.current, 0);
    renderer.render(scene, camera);

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      detector.dispose();
      disposeDetectorMaterials(detMaterials);
      floorGeo.dispose();
      floorMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      controls.dispose();
      renderer.dispose();
      det3dSceneRef.current = undefined;
    };
    // detectorView is applied via a ref + its own effect so that changing
    // the toggle does not rebuild the whole renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, det3dMountKey]);

  // --- Apply the EID/PCD/both toggle to the live scene ---
  useEffect(() => {
    detectorViewRef.current = detectorView;
    det3dSceneRef.current?.detector.setViewMode(detectorView);
  }, [detectorView]);

  // --- Animation loop: only runs while the 3D tab is active ---
  useEffect(() => {
    if (activeTab !== '3dview') return;
    if (!det3dSceneRef.current) return;

    const start = performance.now();
    let lastStatsPush = 0;
    const animate = () => {
      det3dFrameRef.current = requestAnimationFrame(animate);
      const sceneObj = det3dSceneRef.current;
      if (!sceneObj) return;
      const elapsed = (performance.now() - start) / 1000;
      sceneObj.controls.update();
      sceneObj.detector.update(paramsRef.current, elapsed);
      sceneObj.renderer.render(sceneObj.scene, sceneObj.camera);

      // Push counters to React at ~4 Hz — often enough to feel live,
      // rare enough not to re-render the tree every frame.
      if (elapsed - lastStatsPush > 0.25) {
        lastStatsPush = elapsed;
        setDetStats(sceneObj.detector.getStats());
      }
    };
    det3dFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (det3dFrameRef.current) cancelAnimationFrame(det3dFrameRef.current);
    };
  }, [activeTab, det3dMountKey]);

  return (
    <SimulatorContainer title="光子计数 CT (PCCT) 物理孪生模拟器">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-4 space-y-4">
            <h3 className="text-lg font-bold text-emerald-400">物理与解剖控制参数</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">光子通量 (Photon Flux)</span>
                <span className="text-emerald-400 font-bold">{params.photonFlux} Mcps/mm²</span>
              </div>
              <Slider
                min={1}
                max={30}
                step={1}
                value={params.photonFlux}
                onChange={(e) => setParams((prev) => ({ ...prev, photonFlux: Number(e.target.value) }))}
              />
              <p className="text-xs text-gray-500">高通量会导致半导体探测器脉冲堆积 (Pile-up) 和计数饱和。</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">{t('overview')}</span>
                <span className="text-emerald-400 font-bold">{params.bmi} kg/m²</span>
              </div>
              <Slider
                min={18}
                max={40}
                step={1}
                value={params.bmi}
                onChange={(e) => setParams((prev) => ({ ...prev, bmi: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">对比剂浓度 ({params.contrastAgent})</span>
                <span className="text-emerald-400 font-bold">{params.contrastConcentration} mg/mL</span>
              </div>
              <Slider
                min={1}
                max={15}
                step={1}
                value={params.contrastConcentration}
                onChange={(e) => setParams((prev) => ({ ...prev, contrastConcentration: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">钙化斑块密度</span>
                <span className="text-emerald-400 font-bold">{params.calciumDensity} HU</span>
              </div>
              <Slider
                min={10}
                max={100}
                step={5}
                value={params.calciumDensity}
                onChange={(e) => setParams((prev) => ({ ...prev, calciumDensity: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">支架线径 (Stent Struts)</span>
                <span className="text-emerald-400 font-bold">{params.stentDiameter} mm</span>
              </div>
              <Slider
                min={0.05}
                max={0.25}
                step={0.01}
                value={params.stentDiameter}
                onChange={(e) => setParams((prev) => ({ ...prev, stentDiameter: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">{t('pcct_contrast_agent_label')}</label>
              <Select
                value={params.contrastAgent}
                onChange={(e) => setParams((prev) => ({ ...prev, contrastAgent: e.target.value as 'iodine' | 'gadolinium' | 'bismuth' }))}
                options={[
                  { value: 'iodine', label: 'Iodine (碘 - K-edge: 33 keV)' },
                  { value: 'gadolinium', label: 'Gadolinium (钆 - K-edge: 50 keV)' },
                  { value: 'bismuth', label: 'Bismuth (铋 - K-edge: 90 keV)' },
                ]}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-300">{t('pcct_noise_option')}</span>
              <input
                type="checkbox"
                checked={params.enableElectronicNoise}
                onChange={(e) => setParams((prev) => ({ ...prev, enableElectronicNoise: e.target.checked }))}
                className="w-4 h-4 text-emerald-500 rounded bg-gray-900 border-gray-700"
              />
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-emerald-400">重建图像对比：冠状动脉 CTA 与斑块、金属支架</h3>
              <div className="flex space-x-1 p-1 bg-white/5 rounded-lg border border-white/10">
                <button
                  onClick={() => setActiveTab('acquisition')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${activeTab === 'acquisition' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  物理采集
                </button>
                <button
                  onClick={() => setActiveTab('detector')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${activeTab === 'detector' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  探测器层
                </button>
                <button
                  onClick={() => setActiveTab('3dview')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${activeTab === '3dview' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {t('pcct_tab_3d')}
                </button>
                <button
                  onClick={() => setActiveTab('decomposition')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${activeTab === 'decomposition' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  物质分解
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col items-center">
                <canvas
                  ref={eidCanvasRef}
                  width={150}
                  height={150}
                  className="w-full aspect-square bg-slate-950 rounded border border-purple-500/20 shadow-inner"
                />
                <div className="mt-2 text-xs text-purple-300 space-y-1 w-full p-2 bg-purple-950/20 rounded border border-purple-500/10">
                  <p>• 电子噪声：~18 HU (EID限制)</p>
                  <p>• 钙化膨胀 (Blooming)：{metrics.eidBlooming}%</p>
                  <p>• 支架评估通畅率：{metrics.eidStentLumen}%</p>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <canvas
                  ref={pcctCanvasRef}
                  width={150}
                  height={150}
                  className="w-full aspect-square bg-slate-950 rounded border border-emerald-500/20 shadow-inner"
                />
                <div className="mt-2 text-xs text-emerald-300 space-y-1 w-full p-2 bg-emerald-950/20 rounded border border-emerald-500/10">
                  <p>• 电子噪声：{metrics.pcctElectronicNoise} HU (零噪声)</p>
                  <p>• 钙化膨胀 (Blooming)：{metrics.pcctBlooming}%</p>
                  <p>• 支架评估通畅率：{metrics.pcctStentLumen}%</p>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <canvas
                  ref={sinogramCanvasRef}
                  width={150}
                  height={150}
                  className="w-full aspect-square bg-slate-950 rounded border border-sky-500/20 shadow-inner"
                />
                <div className="mt-2 text-xs text-sky-300 w-full p-2 bg-sky-950/20 rounded border border-sky-500/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span>• 能级通道:</span>
                    <div className="flex space-x-1 bg-white/5 p-0.5 rounded">
                      {[1, 2, 3].map((bin) => (
                        <button
                          key={bin}
                          onClick={() => setSelectedBin(bin)}
                          className={`px-1.5 py-0.5 text-[10px] rounded ${selectedBin === bin ? 'bg-sky-500 text-white' : 'text-gray-400'}`}
                        >
                          Bin{bin}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">选择不同 Bin 可观察高低能量下物质投影的衰减反差变化。</p>
                </div>
              </div>
            </div>
          </Card>

          {activeTab === 'detector' && (
            <Card className="p-4 space-y-4">
              <h3 className="text-base font-bold text-emerald-400">探测器能级分桶 (Energy Binning) 与非理想效应</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 p-3 bg-white/5 rounded border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">阈值 1 (Low Bin)</span>
                    <span className="text-emerald-400 font-bold">{params.threshold1} keV</span>
                  </div>
                  <Slider
                    min={20}
                    max={49}
                    step={1}
                    value={params.threshold1}
                    onChange={(e) => setParams((prev) => ({ ...prev, threshold1: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-500">用于剔除低能量的暗电荷与电子基线噪声。</p>
                </div>

                <div className="space-y-2 p-3 bg-white/5 rounded border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">阈值 2 (Mid Bin)</span>
                    <span className="text-emerald-400 font-bold">{params.threshold2} keV</span>
                  </div>
                  <Slider
                    min={50}
                    max={79}
                    step={1}
                    value={params.threshold2}
                    onChange={(e) => setParams((prev) => ({ ...prev, threshold2: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-500">配合 K-edge 边界实现对特定重元素的精确提取。</p>
                </div>

                <div className="space-y-2 p-3 bg-white/5 rounded border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">阈值 3 (High Bin)</span>
                    <span className="text-emerald-400 font-bold">{params.threshold3} keV</span>
                  </div>
                  <Slider
                    min={80}
                    max={120}
                    step={1}
                    value={params.threshold3}
                    onChange={(e) => setParams((prev) => ({ ...prev, threshold3: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-500">提取高能量康普顿衰减信息。</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="p-3 bg-white/5 rounded border border-white/5">
                  <p className="text-[10px] text-gray-400">脉冲叠加比</p>
                  <p className="text-base font-bold text-amber-400">{pileUpFraction}%</p>
                  <p className="text-[9px] text-gray-500">高通量引起计数丢失</p>
                </div>
                <div className="p-3 bg-white/5 rounded border border-white/5">
                  <p className="text-[10px] text-gray-400">电荷共享比</p>
                  <p className="text-base font-bold text-red-400">14.2%</p>
                  <p className="text-[9px] text-gray-500">电荷云被邻近像素平分</p>
                </div>
                <div className="p-3 bg-white/5 rounded border border-white/5">
                  <p className="text-[10px] text-gray-400">K-escape 比</p>
                  <p className="text-base font-bold text-sky-400">8.5%</p>
                  <p className="text-[9px] text-gray-500">CdTe 荧光逃逸引起谱偏移</p>
                </div>
                <div className="p-3 bg-white/5 rounded border border-white/5">
                  <p className="text-[10px] text-gray-400">能量分辨率退化</p>
                  <p className="text-base font-bold text-gray-200">~6.2 keV</p>
                  <p className="text-[9px] text-gray-500">物理谱宽的拓宽畸变</p>
                </div>
              </div>

              {/* Direct vs Indirect Conversion Physics Illustration */}
              <div className="mt-4 p-3 bg-slate-950 rounded border border-white/10">
                <h4 className="text-xs font-bold text-emerald-400 mb-2 text-center">
                  物理层直接转换 (Direct) vs 间接转换 (Indirect / EID) 机制对比
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Indirect */}
                  <div className="p-2 bg-black/40 rounded flex flex-col items-center">
                    <p className="text-[10px] font-bold text-purple-300 mb-1">间接转换 (EID / 闪烁体)</p>
                    <svg className="w-full h-24" viewBox="0 0 200 80">
                      {/* X-ray */}
                      <path d="M 50,0 Q 45,10 55,20 T 45,40" stroke="#f43f5e" fill="none" strokeWidth="1.5" strokeDasharray="3 3" />
                      {/* Scintillator layer */}
                      <rect x="20" y="40" width="60" height="20" fill="#6b21a8" opacity="0.3" stroke="#a855f7" strokeWidth="1" />
                      <text x="50" y="52" fill="#d8b4fe" fontSize="8" textAnchor="middle">闪烁体 (可见光散)</text>
                      {/* Light diffusion */}
                      <circle cx="50" cy="50" r="10" fill="#fef08a" opacity="0.3" />
                      {/* Photodiode */}
                      <rect x="20" y="60" width="60" height="10" fill="#3b0764" stroke="#a855f7" strokeWidth="1" />
                      {/* Septa separator */}
                      <line x1="20" y1="40" x2="20" y2="70" stroke="#f43f5e" strokeWidth="2" />
                      <line x1="80" y1="40" x2="80" y2="70" stroke="#f43f5e" strokeWidth="2" />
                      <text x="50" y="77" fill="#c084fc" fontSize="7" textAnchor="middle">像素元 (存在几何死区)</text>
                    </svg>
                  </div>
                  {/* Direct */}
                  <div className="p-2 bg-black/40 rounded flex flex-col items-center">
                    <p className="text-[10px] font-bold text-emerald-300 mb-1">直接转换 (PCCT / 半导体)</p>
                    <svg className="w-full h-24" viewBox="0 0 200 80">
                      {/* X-ray */}
                      <path d="M 50,0 Q 45,10 55,20 T 45,40" stroke="#10b981" fill="none" strokeWidth="1.5" />
                      {/* Semiconductor substrate */}
                      <rect x="20" y="40" width="60" height="20" fill="#065f46" opacity="0.3" stroke="#10b981" strokeWidth="1" />
                      <text x="50" y="52" fill="#a7f3d0" fontSize="8" textAnchor="middle">CdTe / CZT 介质</text>
                      {/* Electric drift line */}
                      <line x1="50" y1="45" x2="50" y2="60" stroke="#34d399" strokeWidth="1.5" markerEnd="url(#arrow)" />
                      {/* Electrodes */}
                      <rect x="20" y="60" width="60" height="10" fill="#022c22" stroke="#10b981" strokeWidth="1" />
                      {/* Tiny electrode pixel units (high density) */}
                      <rect x="25" y="60" width="10" height="3" fill="#34d399" />
                      <rect x="40" y="60" width="10" height="3" fill="#34d399" />
                      <rect x="55" y="60" width="10" height="3" fill="#34d399" />
                      <rect x="70" y="60" width="10" height="3" fill="#34d399" />
                      <text x="50" y="77" fill="#6ee7b7" fontSize="7" textAnchor="middle">微像素 (几何剂量效率极高)</text>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Energy Spectrum Distortion Chart */}
              <div className="h-64 mt-4 bg-black/40 p-2 rounded-lg border border-white/5">
                <p className="text-xs font-bold text-emerald-400 mb-2 text-center">
                  X射线入射能谱畸变模拟 (理想 vs 非理想探测响应)
                </p>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="energy" stroke="#666" fontSize={10} label={{ value: '能量 (keV)', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis stroke="#666" fontSize={10} label={{ value: '光子数 (Counts)', angle: -90, position: 'insideLeft', offset: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="Ideal Spectrum (理想能谱)" stroke="#34d399" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Distorted (堆积+电荷共享畸变谱)" stroke="#f43f5e" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                    <ReferenceLine x={params.contrastAgent === 'iodine' ? 33 : params.contrastAgent === 'gadolinium' ? 50 : 90} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: 'K-edge', fill: '#fbbf24', fontSize: 9, position: 'top' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {activeTab === '3dview' && (
            <Card className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-emerald-400">3D 探测器层结构 (EID vs PCD)</h3>
                <span className="text-[10px] text-gray-500 font-mono">
                  {t('pcct_3d_hint')}
                </span>
              </div>

              {/* EID / PCD / side-by-side view toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">对比视图:</span>
                <div className="flex space-x-1 p-1 bg-white/5 rounded-lg border border-white/10">
                  {([
                    { mode: 'both' as const, label: '并排对比 (Both)', color: 'bg-emerald-500' },
                    { mode: 'eid' as const, label: 'EID 间接转换', color: 'bg-purple-500' },
                    { mode: 'pcd' as const, label: 'PCD 直接转换', color: 'bg-emerald-500' },
                  ]).map(({ mode, label, color }) => (
                    <button
                      key={mode}
                      onClick={() => setDetectorView(mode)}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${detectorView === mode ? `${color} text-white` : 'text-gray-400 hover:text-white'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <div
                    ref={attachDet3dContainer}
                    className="w-full h-[460px] bg-slate-950 rounded border border-emerald-500/20 shadow-inner relative overflow-hidden"
                  >
                    <div className="absolute top-2 left-2 font-mono text-[10px] text-emerald-400/70 z-10 pointer-events-none">
                      {t('pcct_3d_caption')}
                    </div>
                    <div className="absolute bottom-2 right-2 font-mono text-[10px] text-gray-500 z-10 pointer-events-none">
                      Flux: {params.photonFlux} Mcps/mm² | Noise: {params.enableElectronicNoise ? 'ON' : 'OFF'}
                    </div>
                  </div>

                  {/* Live readout comparison — the numeric half of the
                      same contrast the 3D scene shows geometrically. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="p-3 bg-purple-950/20 rounded border border-purple-500/20 space-y-1">
                      <p className="text-[10px] font-bold text-purple-300">EID 读出：单一积分值</p>
                      <div className="flex justify-between text-[10px] text-gray-300">
                        <span>累计积分信号</span>
                        <span className="font-mono text-purple-300">{Math.round(detStats.eidIntegral)} a.u.</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-300">
                        <span>参与积分的光子数</span>
                        <span className="font-mono text-purple-300">{detStats.eidPhotons}</span>
                      </div>
                      <p className="text-[9px] text-gray-500">
                        无论入射光子能量高低，全部并入同一个数字 — 能谱信息在读出瞬间即被丢弃。
                      </p>
                    </div>

                    <div className="p-3 bg-emerald-950/20 rounded border border-emerald-500/20 space-y-1">
                      <p className="text-[10px] font-bold text-emerald-300">PCD 读出：按脉冲高度分桶计数</p>
                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        <div>
                          <span className="text-gray-500">Bin1</span>
                          <p className="font-mono text-[#66ff99]">{detStats.bin1}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Bin2</span>
                          <p className="font-mono text-[#ffd166]">{detStats.bin2}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Bin3</span>
                          <p className="font-mono text-[#ff8866]">{detStats.bin3}</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-300 pt-1 border-t border-white/5">
                        <span>低于阈值1 丢失 (电荷共享)</span>
                        <span className="font-mono text-red-400">{detStats.subThreshold}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-300">
                        <span>脉冲堆积合并事件</span>
                        <span className="font-mono text-amber-400">{detStats.pileUp}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-white/5 rounded border border-purple-500/20 space-y-2">
                    <p className="text-xs font-bold text-purple-300">{t('pcct_3d_eid_title')}</p>
                    <ul className="text-[10px] text-gray-400 space-y-1">
                      <li>• {t('pcct_3d_eid_l1')}</li>
                      <li>• {t('pcct_3d_eid_l2')}</li>
                      <li>• {t('pcct_3d_eid_l3')}</li>
                      <li>• {t('pcct_3d_eid_l4')}</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-white/5 rounded border border-emerald-500/20 space-y-2">
                    <p className="text-xs font-bold text-emerald-300">{t('pcct_3d_pcd_title')}</p>
                    <ul className="text-[10px] text-gray-400 space-y-1">
                      <li>• {t('pcct_3d_pcd_l1')}</li>
                      <li>• {t('pcct_3d_pcd_l2')}</li>
                      <li>• {t('pcct_3d_pcd_l3')}</li>
                      <li>• {t('pcct_3d_pcd_l4')}</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-white/5 rounded border border-amber-500/20 space-y-2">
                    <p className="text-xs font-bold text-amber-300">{t('pcct_3d_nonideal_title')}</p>
                    <p className="text-[10px] text-gray-400">
                      <span className="text-red-400">Charge sharing</span>: {t('pcct_3d_share_desc')}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      <span className="text-amber-400">Pulse pile-up</span>: {t('pcct_3d_pileup_desc')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 bg-black/30 rounded border border-white/5">
                      <p className="text-gray-500">{t('pcct_pileup')}</p>
                      <p className="text-base font-bold text-amber-400">{pileUpFraction}%</p>
                    </div>
                    <div className="p-2 bg-black/30 rounded border border-white/5">
                      <p className="text-gray-500">{t('pcct_charge')}</p>
                      <p className="text-base font-bold text-red-400">~{Math.min(50, Math.round(params.photonFlux * 1.8))}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'decomposition' && (
            <div className="space-y-6">
              {/* Material Separation Controls */}
              <Card className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-emerald-400">能谱物质分解 (Material Decomposition)</h3>
                  <div className="flex space-x-1 p-1 bg-white/5 rounded-lg border border-white/10">
                    {['composite', 'iodine', 'calcium', 'residual'].map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setParams((prev) => ({ ...prev, activeMaterialChannel: ch as 'composite' | 'iodine' | 'calcium' | 'residual' }))}
                        className={`px-3 py-1 text-xs rounded-md transition-all capitalize ${params.activeMaterialChannel === ch ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {params.activeMaterialChannel === 'composite' && '复合色彩视图：红色代表钙化斑块 (骨骼成分)，绿色代表碘造影剂 (血管腔)，蓝色代表背景软组织。'}
                  {params.activeMaterialChannel === 'iodine' && '纯碘密度图 (Iodine Map)：彻底分离钙化，仅显示冠脉血池。'}
                  {params.activeMaterialChannel === 'calcium' && '纯钙密度图 (Calcium Map)：清晰展现冠脉壁上的硬化斑块形态。'}
                  {params.activeMaterialChannel === 'residual' && '残差与伪影分布图：显示基线物质分解模型无法解释的系统非理想噪声分量。'}
                </p>
              </Card>

              {/* VMI Energy Switch controls and dynamic HU rendering */}
              <Card className="p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                  <div>
                    <h3 className="text-base font-bold text-emerald-400">VMI 虚拟单色能成像 (Virtual Monoenergetic Images)</h3>
                    <p className="text-xs text-gray-400">观察低 keV 血管增强与高 keV 抑制金属/硬化伪影的工程权衡</p>
                  </div>
                  <div className="flex space-x-2 bg-white/5 p-1 rounded-lg border border-white/10 self-start">
                    {[40, 60, 70, 100].map((energy) => (
                      <button
                        key={energy}
                        onClick={() => setVmiEnergy(energy)}
                        className={`px-3 py-1 text-xs rounded-md transition-all font-bold ${vmiEnergy === energy ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                        {energy} keV
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2 text-xs text-gray-300">
                    <p className="font-bold text-emerald-400">能谱物理效应表现：</p>
                    {vmiEnergy === 40 && (
                      <p className="text-red-400">• 低能 40 keV：造影剂（碘/钆）的衰减极高，血管腔获得显著的对比度增强。但高 Z 物质会引起极其严重的硬化条纹伪影（Streaking Artifact）与钙化 Blooming 边缘膨胀。</p>
                    )}
                    {vmiEnergy === 60 && (
                      <p className="text-amber-400">• 60 keV：在管腔对比度与伪影之间取得折中，这是临床能谱血管造影的常用高对比能级。</p>
                    )}
                    {vmiEnergy === 70 && (
                      <p className="text-gray-300">• 70 keV：标准模拟参考能级，接近常规 120 kVp 多色混合射线重建图像的软组织反差表现。</p>
                    )}
                    {vmiEnergy === 100 && (
                      <p className="text-sky-400">• 高能 100 keV：光子穿透力极强，X射线硬化伪影（Beam Hardening）被彻底消除。支架管腔通畅度极佳，Blooming 彻底消失，但碘造影剂对比度被大幅削弱（血管反差变淡）。</p>
                    )}
                    
                    {/* Visual energy scale rendering details */}
                    <div className="p-3 bg-black/40 rounded border border-white/5 space-y-1">
                      <p className="text-[10px] text-gray-400">当前 VMI 物理因子：</p>
                      <div className="flex justify-between"><span>血管腔强度倍率:</span> <span className="text-emerald-400 font-mono">{(vmiEnergy === 40 ? 1.7 : vmiEnergy === 60 ? 1.2 : vmiEnergy === 70 ? 1.0 : 0.6).toFixed(1)}x</span></div>
                      <div className="flex justify-between"><span>硬化伪影严重度:</span> <span className="text-red-400 font-mono">{(vmiEnergy === 40 ? 100 : vmiEnergy === 60 ? 47 : vmiEnergy === 70 ? 27 : 3).toFixed(0)}%</span></div>
                      <div className="flex justify-between"><span>硬斑块 Blooming 膨胀率:</span> <span className="text-amber-400 font-mono">{(vmiEnergy === 40 ? 160 : vmiEnergy === 60 ? 120 : vmiEnergy === 70 ? 100 : 55).toFixed(0)}%</span></div>
                    </div>
                  </div>

                  {/* Histogram Chart showing HU values */}
                  <div className="h-44 bg-black/20 p-2 rounded-lg border border-white/5">
                    <p className="text-[10px] font-bold text-center text-emerald-400 mb-1">各组织与支架 HU 衰减值对比图</p>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart
                        data={[
                          { name: '碘造影剂', value: Math.round((vmiEnergy === 40 ? 680 : vmiEnergy === 60 ? 420 : vmiEnergy === 70 ? 350 : 180) * (params.contrastConcentration / 6)) },
                          { name: '钙化斑块', value: Math.round((vmiEnergy === 40 ? 590 : vmiEnergy === 60 ? 460 : vmiEnergy === 70 ? 380 : 250) * (params.calciumDensity / 50)) },
                          { name: '软组织', value: Math.round((vmiEnergy === 40 ? 90 : vmiEnergy === 60 ? 65 : vmiEnergy === 70 ? 50 : 40)) },
                          { name: '支架金属', value: Math.round(vmiEnergy === 40 ? 1200 : vmiEnergy === 60 ? 980 : vmiEnergy === 70 ? 850 : 650) }
                        ]}
                        margin={{ top: 5, right: 5, left: -25, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" stroke="#888" fontSize={9} tickLine={false} />
                        <YAxis stroke="#888" fontSize={9} />
                        <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', fontSize: 10 }} />
                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]}>
                          {[0, 1, 2, 3].map((entry, index) => {
                            const colors = ['#34d399', '#fbbf24', '#a78bfa', '#f43f5e'];
                            return <Cell key={`cell-${index}`} fill={colors[index]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              {/* K-edge teaching and mass attenuation curves */}
              <Card className="p-4 space-y-4">
                <h3 className="text-base font-bold text-emerald-400">重元素 K-edge 教学与吸收光谱突跃对比</h3>
                <p className="text-xs text-gray-400">展示特定元素在 K-edge 临界能量点发生的光电吸收骤增，能谱 CT 正是基于此原理进行特异性造影成像</p>
                <div className="h-64 bg-black/40 p-2 rounded-lg border border-white/5">
                  <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={getKEdgeCurveData()} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="energy" stroke="#666" fontSize={9} label={{ value: '能量 (keV)', position: 'insideBottomRight', offset: -5 }} />
                      <YAxis stroke="#666" fontSize={9} label={{ value: '质量衰减系数', angle: -90, position: 'insideLeft', offset: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', fontSize: 10 }} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      <Line type="monotone" dataKey="iodine" name="碘 (Iodine - K: 33 keV)" stroke="#34d399" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="gadolinium" name="钆 (Gadolinium - K: 50 keV)" stroke="#fbbf24" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="bismuth" name="铋 (Bismuth - K: 90 keV)" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="calcium" name="钙 (Calcium - 骨骼)" stroke="#a78bfa" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="water" name="水" stroke="#38bdf8" strokeWidth={1} dot={false} strokeDasharray="2 2" />
                      <ReferenceLine x={33} stroke="#34d399" strokeDasharray="3 3" label={{ value: 'I K-edge (33 keV)', fill: '#34d399', fontSize: 8, position: 'top' }} />
                      <ReferenceLine x={50} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: 'Gd K-edge (50 keV)', fill: '#fbbf24', fontSize: 8, position: 'top' }} />
                      <ReferenceLine x={90} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Bi K-edge (90 keV)', fill: '#f43f5e', fontSize: 8, position: 'top' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </SimulatorContainer>
  );
};

export default PCCTSimulator;
