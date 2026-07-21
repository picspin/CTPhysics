'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  ReferenceLine
} from 'recharts';
import { calculatePCCTSpectrum, calculatePCCTMetrics, getMaterialAttenuation, generatePCCTSinogramData, PCCTParams } from '@/utils/pcct-physics';

const PCCTSimulator: React.FC = () => {
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

  const [activeTab, setActiveTab] = useState<'acquisition' | 'detector' | 'decomposition'>('acquisition');
  
  const eidCanvasRef = useRef<HTMLCanvasElement>(null);
  const pcctCanvasRef = useRef<HTMLCanvasElement>(null);
  const sinogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBin, setSelectedBin] = useState<number>(2); // Default to Mid Bin (Bin 2)

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
              baseVal = 0.4 + (params.calciumDensity / 200);
            } else if (isLumen) {
              const energyAvg = (params.threshold1 + params.threshold2) / 2;
              const attVal = getMaterialAttenuation(params.contrastAgent, energyAvg, params.contrastConcentration);
              baseVal = 0.25 + Math.min(0.65, attVal * 0.2);
            }

            if (isMetal) {
              const streak = Math.sin(angle * 12) * 0.12;
              baseVal = Math.min(1.0, Math.max(0, baseVal + streak));
            }
          }

          if (type === 'PCCT' && activeTab === 'decomposition') {
            const distToPlaque = Math.hypot(nx - 0.15, ny + 0.15);
            const isCalcium = distToPlaque < 0.12;
            const distToLumen = Math.hypot(nx, ny);
            const isLumen = distToLumen < 0.35 && !isCalcium;

            if (params.activeMaterialChannel === 'iodine') {
              baseVal = isLumen ? (params.contrastConcentration / 10) * 0.8 : 0.05;
            } else if (params.activeMaterialChannel === 'calcium') {
              baseVal = isCalcium ? (params.calciumDensity / 100) * 0.8 : 0.05;
            } else if (params.activeMaterialChannel === 'residual') {
              baseVal = (r2 < 0.6) ? 0.08 + (Math.random() - 0.5) * 0.04 : 0.02;
            }
          }

          let pixelVal = baseVal;
          if (type === 'EID') {
            const distToPlaque = Math.hypot(nx - 0.15, ny + 0.15);
            if (distToPlaque < 0.25) {
              const bloomingScale = metrics.eidBlooming / 100;
              pixelVal += (0.15 * bloomingScale * (1.0 - distToPlaque / 0.25));
            }
            if (Math.abs(Math.sqrt(r2) - 0.4) < 0.08) {
              pixelVal = pixelVal * 0.8 + 0.2 * 0.6;
            }
          } else {
            const distToPlaque = Math.hypot(nx - 0.15, ny + 0.15);
            if (distToPlaque < 0.16) {
              const bloomingScale = metrics.pcctBlooming / 100;
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
              r = Math.round((0.5 + params.calciumDensity / 200 + randomNoise) * 255);
              g = 30;
              b = 30;
            } else if (isLumen) {
              r = 30;
              g = Math.round((0.4 + params.contrastConcentration / 15 + randomNoise) * 255);
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
  }, [params, metrics, activeTab, pileUpFraction, selectedBin]);

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
                <span className="text-gray-300">患者体型 (BMI)</span>
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
              <label className="text-sm font-medium text-gray-300">造影剂造影元素</label>
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
              <span className="text-sm text-gray-300">演示电子噪声 (低能阈值)</span>
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

          {activeTab === 'decomposition' && (
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
          )}
        </div>
      </div>
    </SimulatorContainer>
  );
};

export default PCCTSimulator;
