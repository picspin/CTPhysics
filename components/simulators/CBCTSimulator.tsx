'use client';

import React, { useState, useEffect, useRef } from 'react';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { calculateCBCTMetrics, generateCBCTProjectionData, CBCTParams } from '@/utils/cbct-physics';

const CBCTSimulator: React.FC = () => {
  const [params, setParams] = useState<CBCTParams>({
    coneAngle: 15,
    pitchRotationAngle: 0,
    detectorPixelSize: 0.3,
    kVp: 90,
    dose: 50,
    phantomType: 'dental',
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Canvases
  const projectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const reconAxialCanvasRef = useRef<HTMLCanvasElement>(null);
  const reconCoronalCanvasRef = useRef<HTMLCanvasElement>(null);

  // Derived metrics
  const metrics = calculateCBCTMetrics(params);

  // Handle animation
  useEffect(() => {
    if (isPlaying) {
      const tick = () => {
        setParams((prev) => ({
          ...prev,
          pitchRotationAngle: (prev.pitchRotationAngle + 2) % 360,
        }));
        animationRef.current = requestAnimationFrame(tick);
      };
      animationRef.current = requestAnimationFrame(tick);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  // Update canvases
  useEffect(() => {
    // 1. Draw projection
    const pCanvas = projectionCanvasRef.current;
    if (pCanvas) {
      const ctx = pCanvas.getContext('2d');
      if (ctx) {
        const width = pCanvas.width;
        const height = pCanvas.height;
        const projData = generateCBCTProjectionData(params, width, height);

        const imgData = ctx.createImageData(width, height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const val = projData[y][x];
            // Inverse grayscale display (like X-ray film)
            const pixelVal = Math.round((1.0 - val) * 255);
            const idx = (y * width + x) * 4;
            imgData.data[idx] = pixelVal;     // R
            imgData.data[idx + 1] = pixelVal; // G
            imgData.data[idx + 2] = pixelVal; // B
            imgData.data[idx + 3] = 255;      // A
          }
        }
        ctx.putImageData(imgData, 0, 0);

        // Grid lines overlay to represent Detector Pixels
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.08)';
        ctx.lineWidth = 1;
        const step = Math.max(2, Math.round(params.detectorPixelSize * 25));
        for (let i = 0; i < width; i += step) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, height);
          ctx.stroke();
        }
        for (let j = 0; j < height; j += step) {
          ctx.beginPath();
          ctx.moveTo(0, j);
          ctx.lineTo(width, j);
          ctx.stroke();
        }
      }
    }

    // 2. Draw reconstructed slices (axial / coronal)
    const axCanvas = reconAxialCanvasRef.current;
    const corCanvas = reconCoronalCanvasRef.current;

    // Simulate 3D Reconstruction with analytical artifacts
    const drawReconstructedSlice = (canvas: HTMLCanvasElement | null, mode: 'axial' | 'coronal') => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const imgData = ctx.createImageData(w, h);

      for (let y = 0; y < h; y++) {
        const ny = (y - h / 2) / (h / 2); // [-1, 1]
        for (let x = 0; x < w; x++) {
          const nx = (x - w / 2) / (w / 2); // [-1, 1]

          let density = 0.1; // background air

          if (mode === 'axial') {
            const r2 = nx * nx + ny * ny;
            if (r2 < 0.65) {
              density = 0.35; // Soft tissue
              if (params.phantomType === 'dental') {
                if (Math.abs(r2 - 0.25) < 0.08 && ny > -0.1) density = 0.75;
                if (Math.hypot(nx - 0.25, ny - 0.2) < 0.08) density = 0.95;
              } else if (params.phantomType === 'skull') {
                if (r2 > 0.55 && r2 < 0.64) density = 0.85;
                if (Math.hypot(nx, ny + 0.2) < 0.18) density = 0.15;
              } else {
                if (nx * nx + ny * ny < 0.06) density = 0.85;
                if (Math.hypot(nx - 0.35, ny) < 0.12) density = 0.65;
              }
            }

            const distCenter = Math.hypot(nx, ny);
            const blur = (metrics.artifactSeverity / 150) * distCenter;
            if (blur > 0.05) {
              density = density * (1 - blur) + 0.3 * blur;
            }
          } else {
            const nz = ny;
            const r2 = nx * nx + nz * nz * 0.5;
            if (r2 < 0.6) {
              density = 0.35;
              if (params.phantomType === 'dental') {
                if (Math.abs(nx) < 0.4 && nz > -0.3 && nz < 0.3) density = 0.65;
              } else if (params.phantomType === 'skull') {
                if (r2 > 0.5 && r2 < 0.58) density = 0.85;
                if (Math.abs(nx) < 0.12 && nz < -0.3) density = 0.8;
              } else {
                if (Math.abs(nx) < 0.15) density = 0.85;
              }
            }

            const offAxisFactor = Math.abs(nz) * Math.sin((params.coneAngle * Math.PI) / 180);
            if (offAxisFactor > 0.1) {
              const artifactVal = Math.sin(nx * 10) * offAxisFactor * 0.2;
              density = Math.min(1.0, Math.max(0, density + artifactVal));
            }
          }

          const noiseAmp = (metrics.relativeNoise / 100) * 0.15;
          const noiseVal = (Math.random() - 0.5) * noiseAmp;
          const finalVal = Math.min(255, Math.max(0, Math.round((density + noiseVal) * 255)));

          const idx = (y * w + x) * 4;
          imgData.data[idx] = finalVal;
          imgData.data[idx + 1] = finalVal;
          imgData.data[idx + 2] = finalVal;
          imgData.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px sans-serif';
      ctx.fillText(mode === 'axial' ? 'Axial (轴位)' : 'Coronal (冠状位)', 10, 20);
    };

    drawReconstructedSlice(axCanvas, 'axial');
    drawReconstructedSlice(corCanvas, 'coronal');

  }, [params, metrics.relativeNoise, metrics.artifactSeverity]);

  return (
    <SimulatorContainer title="锥形束CT (CBCT) 物理建模模拟器">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-4 space-y-4">
            <h3 className="text-lg font-bold text-sky-400">采集与几何参数</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">体模选择 (Phantom)</label>
              <Select
                value={params.phantomType}
                onChange={(e) => setParams((prev) => ({ ...prev, phantomType: e.target.value as 'dental' | 'skull' | 'cylinder' }))}
                options={[
                  { value: 'dental', label: 'Dental Phantom (牙科/下颌)' },
                  { value: 'skull', label: 'Skull Phantom (颅脑/鼻窦)' },
                  { value: 'cylinder', label: 'Cylinder Phantom (圆柱QA体模)' },
                ]}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">锥角 (Cone Angle)</span>
                <span className="text-sky-400 font-bold">{params.coneAngle}°</span>
              </div>
              <Slider
                min={5}
                max={35}
                step={1}
                value={params.coneAngle}
                onChange={(e) => setParams((prev) => ({ ...prev, coneAngle: Number(e.target.value) }))}
              />
              <p className="text-xs text-gray-500">较大的锥角会导致严重的非平面对称性伪影（FDK退化）。</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">探测器像素大小 (Pixel Size)</span>
                <span className="text-sky-400 font-bold">{params.detectorPixelSize} mm</span>
              </div>
              <Slider
                min={0.1}
                max={1.0}
                step={0.05}
                value={params.detectorPixelSize}
                onChange={(e) => setParams((prev) => ({ ...prev, detectorPixelSize: Number(e.target.value) }))}
              />
              <p className="text-xs text-gray-500">微小像素提供高空间分辨率。</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">管电压 (kVp)</span>
                <span className="text-sky-400 font-bold">{params.kVp} kVp</span>
              </div>
              <Slider
                min={60}
                max={120}
                step={5}
                value={params.kVp}
                onChange={(e) => setParams((prev) => ({ ...prev, kVp: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">辐射剂量 (Dose/mAs)</span>
                <span className="text-sky-400 font-bold">{params.dose} mAs</span>
              </div>
              <Slider
                min={5}
                max={100}
                step={5}
                value={params.dose}
                onChange={(e) => setParams((prev) => ({ ...prev, dose: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">扫描角度 (Rotation)</span>
                <span className="text-sky-400 font-bold">{params.pitchRotationAngle}°</span>
              </div>
              <Slider
                min={0}
                max={359}
                step={1}
                value={params.pitchRotationAngle}
                onChange={(e) => setParams((prev) => ({ ...prev, pitchRotationAngle: Number(e.target.value) }))}
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <Button
                variant={isPlaying ? 'danger' : 'primary'}
                className="w-full"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? '暂停扫描' : '启动自动扫描'}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setParams((prev) => ({ ...prev, pitchRotationAngle: 0 }))}
              >
                重置角度
              </Button>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-lg font-bold text-sky-400">物理性能指标</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <p className="text-xs text-gray-400">空间分辨率</p>
                <p className="text-lg font-bold text-gray-200">{metrics.spatialResolutionMm} mm</p>
                <p className="text-xs text-sky-400/80">{metrics.lpPerMm} lp/mm</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <p className="text-xs text-gray-400">FDK锥束伪影</p>
                <p className="text-lg font-bold text-gray-200">{metrics.artifactSeverity}%</p>
                <p className="text-xs text-red-400/80">{metrics.artifactSeverity > 40 ? '高偏轴伪影' : '可接受'}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <p className="text-xs text-gray-400">对比度噪声比 (CNR)</p>
                <p className="text-lg font-bold text-gray-200">{metrics.cnr}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <p className="text-xs text-gray-400">相对图像噪声</p>
                <p className="text-lg font-bold text-gray-200">{metrics.relativeNoise}%</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4 space-y-4">
            <h3 className="text-base font-bold text-sky-400">3D 锥形束投影光路模拟</h3>
            <div className="relative w-full h-64 bg-slate-950 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 600 240">
                <defs>
                  <linearGradient id="coneGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
                  </linearGradient>
                  <radialGradient id="phantomGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#475569" />
                    <stop offset="80%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </radialGradient>
                </defs>

                <path d="M 0,20 L 600,20 M 0,60 L 600,60 M 0,100 L 600,100 M 0,140 L 600,140 M 0,180 L 600,180 M 0,220 L 600,220" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                <ellipse cx="300" cy="180" rx="90" ry="25" fill="none" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="2" strokeDasharray="5,5" />
                
                <g transform={`translate(${150 + 40 * Math.sin((params.pitchRotationAngle * Math.PI)/180)}, ${70 + 10 * Math.cos((params.pitchRotationAngle * Math.PI)/180)})`}>
                  <rect x="-15" y="-10" width="30" height="20" rx="3" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                  <circle cx="0" cy="0" r="5" fill="#f43f5e" />
                  <text x="-25" y="-18" fill="#94a3b8" fontSize="10">X-Ray Tube</text>
                </g>

                <g transform={`translate(${430 - 40 * Math.sin((params.pitchRotationAngle * Math.PI)/180)}, ${140 - 10 * Math.cos((params.pitchRotationAngle * Math.PI)/180)})`}>
                  <rect x="-10" y="-50" width="20" height="100" fill="#0f172a" stroke="#0ea5e9" strokeWidth="2" />
                  <path d="M -10,-50 L 10,-50 L 10,100" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" />
                  <text x="-20" y="-58" fill="#94a3b8" fontSize="10">2D Flat Panel</text>
                </g>

                <polygon
                  points={`${150 + 40 * Math.sin((params.pitchRotationAngle * Math.PI)/180)},${70 + 10 * Math.cos((params.pitchRotationAngle * Math.PI)/180)} ${420 - 40 * Math.sin((params.pitchRotationAngle * Math.PI)/180)},${90 - 10 * Math.cos((params.pitchRotationAngle * Math.PI)/180) - params.coneAngle * 1.5} ${420 - 40 * Math.sin((params.pitchRotationAngle * Math.PI)/180)},${90 - 10 * Math.cos((params.pitchRotationAngle * Math.PI)/180) + params.coneAngle * 1.5}`}
                  fill="url(#coneGrad)"
                />

                <g transform="translate(300, 140)">
                  <ellipse cx="0" cy="0" rx="30" ry="40" fill="url(#phantomGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                  <circle cx="-10" cy="-10" r="8" fill="#64748b" opacity="0.8" />
                  <circle cx="12" cy="15" r="5" fill="#e2e8f0" opacity="0.9" />
                </g>
              </svg>
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-gray-400">
                源-Isocenter: 500mm | 源-探测器: 1000mm
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-3 flex flex-col items-center">
              <h4 className="text-sm font-bold text-sky-400 mb-2">2D 探测器投影 (Projection)</h4>
              <canvas
                ref={projectionCanvasRef}
                width={128}
                height={128}
                className="w-full aspect-square bg-black rounded border border-white/10 shadow-inner"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">FPD 实时采样得到的 2D 衰减图</p>
            </Card>

            <Card className="p-3 flex flex-col items-center">
              <h4 className="text-sm font-bold text-sky-400 mb-2">3D FDK 重建 - 轴位</h4>
              <canvas
                ref={reconAxialCanvasRef}
                width={128}
                height={128}
                className="w-full aspect-square bg-black rounded border border-white/10 shadow-inner"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">中平面 z = 0 处的二维反投影</p>
            </Card>

            <Card className="p-3 flex flex-col items-center">
              <h4 className="text-sm font-bold text-sky-400 mb-2">3D FDK 重建 - 冠状位</h4>
              <canvas
                ref={reconCoronalCanvasRef}
                width={128}
                height={128}
                className="w-full aspect-square bg-black rounded border border-white/10 shadow-inner"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">展现偏轴 (Off-axis) 的锥束几何伪影</p>
            </Card>
          </div>
        </div>
      </div>

      <Card className="mt-6 p-4">
        <h3 className="text-lg font-bold text-sky-400 mb-2">CBCT 与三维 FDK 滤波反投影原理</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
          <div>
            <p className="mb-2">
              <strong>1. 锥形束几何 (Cone-Beam Geometry)：</strong>
              与传统扇形束（Fan-beam）逐层扫描不同，CBCT 使用面探测器（Flat Panel Detector）以及锥形 X-ray 射束，在一次旋转中直接获取整个三维体积的二维投影。这大大缩短了扫描时间并提高了空间分辨率（非常适合高对比度的牙科与骨骼显像）。
            </p>
            <p>
              <strong>2. 空间分辨率 vs 探测器像素：</strong>
              CBCT 的空间分辨率受探测器元尺寸（d）与几何放大率（M）的限制。有效三维体素大小极限约为 d / M。调整参数可以看到空间分辨率的变化。
            </p>
          </div>
          <div>
            <p className="mb-2">
              <strong>3. Feldkamp-Davis-Kress (FDK) 算法：</strong>
              这是 CBCT 重建的核心数学基石。其主要步骤为：
              <br />
              <span className="text-sky-400 font-mono">1. 投影加权：</span> 根据射线斜角对探测器数据加权：W = D0 / sqrt(D0^2 + u^2 + v^2)。
              <br />
              <span className="text-sky-400 font-mono">2. 一维滤波：</span> 对加权投影沿探测器行方向（水平面）进行 Ramp 滤波。
              <br />
              <span className="text-sky-400 font-mono">3. 三维加权反投影：</span> 沿锥形束三维射线路径反投影回体素网格。
            </p>
            <p>
              <strong>4. 锥束伪影 (Cone-beam Artifacts)：</strong>
              因为 FDK 假设射线仅在倾斜平面中传播，这是一种近似算法。对于偏离中心平面（z &gt;&gt; 0）的体素，以及圆锥角较大的情况下，数据会出现不完备性，在重建图像中产生明显的“下阴影”和“V型模糊”伪影。
            </p>
          </div>
        </div>
      </Card>
    </SimulatorContainer>
  );
};

export default CBCTSimulator;
