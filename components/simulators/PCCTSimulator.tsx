'use client';

import React, { useState, useEffect, useRef } from 'react';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';

import { Card } from '@/components/ui/Card';
import { calculatePCCTMetrics, getMaterialAttenuation, PCCTParams } from '@/utils/pcct-physics';

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

  const metrics = calculatePCCTMetrics(params);
  

  const pulseDeadTime = 0.05;
  const pulseRate = params.photonFlux * pulseDeadTime;
  const pileUpFraction = Math.round((1 - Math.exp(-pulseRate)) * 100);

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
  }, [params, metrics, activeTab, pileUpFraction]);

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col items-center">
                <canvas
                  ref={eidCanvasRef}
                  width={200}
                  height={200}
                  className="w-full aspect-square bg-slate-950 rounded border border-purple-500/20 shadow-inner"
                />
                <div className="mt-2 text-xs text-purple-300 space-y-1 w-full p-2 bg-purple-950/20 rounded border border-purple-500/10">
                  <p>• 电子噪声：~18 HU (无法消除)</p>
                  <p>• 钙化膨胀 (Blooming) 指标：{metrics.eidBlooming}%</p>
                  <p>• 支架内通畅显示率：{metrics.eidStentLumen}%</p>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <canvas
                  ref={pcctCanvasRef}
                  width={200}
                  height={200}
                  className="w-full aspect-square bg-slate-950 rounded border border-emerald-500/20 shadow-inner"
                />
                <div className="mt-2 text-xs text-emerald-300 space-y-1 w-full p-2 bg-emerald-950/20 rounded border border-emerald-500/10">
                  <p>• 电子噪声：{metrics.pcctElectronicNoise} HU (零电子噪声)</p>
                  <p>• 钙化膨胀 (Blooming) 指标：{metrics.pcctBlooming}%</p>
                  <p>• 支架内通畅显示率：{metrics.pcctStentLumen}%</p>
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
