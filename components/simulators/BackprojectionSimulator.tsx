'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Select } from '../ui/Select';
import { Slider } from '../ui/Slider';
import { Button } from '../ui/Button';
import {
  generateFanBeamSinogram,
  generateKernel,
  convolveSinogram,
  addFanBeamProjectionToImage
} from '@/utils/physics-calculations';
import { AnimationController } from '@/utils/animation-utils';

const BackprojectionSimulator: React.FC = () => {
  // --- Constants & Config ---
  const defaultImages = [
    { id: 'phantom', name: 'Shepp-Logan Phantom (体模)', src: '' },
    { id: 'abdomen', name: 'Abdomen (腹部 - 软组织)', src: '/images/abdomen_generated.png' },
    { id: 'fracture', name: 'Bone Fracture (骨折 - 高对比)', src: '/images/fracture_generated.png' },
    { id: 'lung', name: 'Lung (肺部 - 空气/主要)', src: '/images/lung_generated.png' },
  ];

  // --- State ---
  // Configuration
  const [selectedImageId, setSelectedImageId] = useState('phantom');
  const [customImage, setCustomImage] = useState<string | null>(null);

  // Physics Parameters
  const [matrixSize, setMatrixSize] = useState(256); // 128, 256, 512
  const [stepAngle, setStepAngle] = useState(1.0); // degree per projection
  const [fanAngle, setFanAngle] = useState(60); // degrees 30-180
  const [numDetectors, setNumDetectors] = useState(256); // 128-512
  const [kernelType, setKernelType] = useState<'smooth' | 'standard' | 'sharp'>('standard');

  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState(0);

  // --- Refs ---
  const phantomCanvasRef = useRef<HTMLCanvasElement>(null);
  const acquisitionCanvasRef = useRef<HTMLCanvasElement>(null);
  const rawBpCanvasRef = useRef<HTMLCanvasElement>(null);
  const filteredBpCanvasRef = useRef<HTMLCanvasElement>(null);

  // Data Stores (Large arrays, kept in refs to avoid re-renders)
  const imageDataRef = useRef<number[][]>([]);  // Source Image (MatrixSize x MatrixSize)
  const sinogramRef = useRef<number[][]>([]);   // Raw Sinogram (Projections x Detectors)
  const filteredSinogramRef = useRef<number[][]>([]); // Filtered Sinogram

  // Accumulators for Progressive Rendering
  // Using Float32Array for performance (Flat array)
  const rawReconBuffer = useRef<Float32Array | null>(null);
  const filteredReconBuffer = useRef<Float32Array | null>(null);

  const animationController = useRef(new AnimationController());

  // Derived Values
  const numProjections = Math.floor(360 / stepAngle); // Full 360 scan simulation

  // --- Helpers ---

  // Load Image as Greyscale Matrix
  const loadImageToMatrix = useCallback((src: string, size: number): Promise<number[][]> => {
    return new Promise((resolve) => {
      if (!src) { resolve([]); return; }
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve([]); return; }
        // Draw and Resize
        ctx.drawImage(img, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size);
        const data: number[][] = [];
        for (let y = 0; y < size; y++) {
          const row: number[] = [];
          for (let x = 0; x < size; x++) {
            // Green channel for precision
            const val = imgData.data[(y * size + x) * 4 + 1] / 255;
            row.push(val);
          }
          data.push(row);
        }
        resolve(data);
      };
      img.onerror = () => resolve([]);
      img.src = src;
    });
  }, []);

  // Generate Internal Data
  const generateData = useCallback(async () => {
    if (customImage) return await loadImageToMatrix(customImage, matrixSize);

    const selectedObj = defaultImages.find(img => img.id === selectedImageId);
    if (selectedObj && selectedObj.src) return await loadImageToMatrix(selectedObj.src, matrixSize);

    // Default Shepp-Logan Phantom
    const size = matrixSize;
    const data: number[][] = Array(size).fill(null).map(() => Array(size).fill(0));
    const center = size / 2;
    // Standard Shepp-Logan Ellipses
    const ellipses = [
      { cx: 0, cy: 0, a: 0.92, b: 0.69, theta: 90, val: 2.0 },
      { cx: 0, cy: -0.0184, a: 0.874, b: 0.6624, theta: 90, val: -0.98 },
      { cx: 0.22, cy: 0, a: 0.31, b: 0.11, theta: 72, val: -0.02 },
      { cx: -0.22, cy: 0, a: 0.41, b: 0.16, theta: 108, val: -0.02 },
      { cx: 0, cy: 0.35, a: 0.25, b: 0.21, theta: 90, val: 0.01 },
      { cx: 0, cy: 0.1, a: 0.046, b: 0.046, theta: 0, val: 0.01 },
      // Small tumors/features
      { cx: 0, cy: -0.1, a: 0.046, b: 0.046, theta: 0, val: 0.01 },
      { cx: -0.08, cy: -0.605, a: 0.046, b: 0.023, theta: 0, val: 0.01 },
      { cx: 0, cy: -0.605, a: 0.023, b: 0.023, theta: 0, val: 0.01 },
      { cx: 0.06, cy: -0.605, a: 0.046, b: 0.023, theta: 90, val: 0.01 }
    ];

    ellipses.forEach(e => {
      const cos = Math.cos(e.theta * Math.PI / 180);
      const sin = Math.sin(e.theta * Math.PI / 180);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = (x - center) / (size / 2);
          const dy = (y - center) / (size / 2);
          const tdx = (dx - e.cx) * cos + (dy - e.cy) * sin;
          const tdy = -(dx - e.cx) * sin + (dy - e.cy) * cos;
          if ((tdx * tdx) / (e.a * e.a) + (tdy * tdy) / (e.b * e.b) <= 1) {
            data[y][x] += e.val;
          }
        }
      }
    });
    return data;
  }, [selectedImageId, customImage, matrixSize]);


  // --- Visualization Helpers ---

  // Draw Matrix to Canvas
  const renderMatrix = (ctx: CanvasRenderingContext2D, data: number[] | Float32Array, width: number, height: number, normalize: boolean = false) => {
    const output = ctx.createImageData(width, height);
    let max = 1;
    if (normalize) {
      // Find max in first pass/sample
      for (let i = 0; i < data.length; i += 10) if (data[i] > max) max = data[i];
      // Safe ceiling
      max = max || 1;
    }

    for (let i = 0; i < width * height; i++) {
      let val = data[i];
      if (normalize) val /= max;
      // Apply gamma or contrast if needed
      val = Math.max(0, Math.min(1, val));
      const p = Math.floor(val * 255);
      output.data[i * 4] = p;
      output.data[i * 4 + 1] = p;
      output.data[i * 4 + 2] = p;
      output.data[i * 4 + 3] = 255;
    }
    // Draw to temporary canvas for scaling if context size differs? 
    // Assuming context size matches matrixSize for 1:1 fidelity
    ctx.putImageData(output, 0, 0);
  };

  const clearCanvas = (ref: React.RefObject<HTMLCanvasElement>) => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  };

  // --- Effects ---

  // 1. Initialization (Run once on params change)
  useEffect(() => {
    let active = true;
    setIsAnimating(false);
    setProgress(0);
    // Clear Buffers
    rawReconBuffer.current = new Float32Array(matrixSize * matrixSize).fill(0);
    filteredReconBuffer.current = new Float32Array(matrixSize * matrixSize).fill(0);

    // Clear Canvases
    clearCanvas(acquisitionCanvasRef);
    clearCanvas(rawBpCanvasRef);
    clearCanvas(filteredBpCanvasRef);

    generateData().then(data => {
      if (!active) return;
      imageDataRef.current = data;

      // Render Phantom
      if (phantomCanvasRef.current) {
        const ctx = phantomCanvasRef.current.getContext('2d');
        if (ctx) {
          // Flatten and render
          const flat = new Float32Array(matrixSize * matrixSize);
          data.forEach((row, y) => row.forEach((v, x) => flat[y * matrixSize + x] = v));
          renderMatrix(ctx, flat, matrixSize, matrixSize, false);
        }
      }

      // Generate Sinogram (Expensive, maybe do in chunks or Loading state?)
      // For 512x512, this is HEAVY.
      // We'll trust the user's powerful machine or they must wait a sec.
      const sino = generateFanBeamSinogram(data, numProjections, numDetectors, fanAngle);
      sinogramRef.current = sino;

      // Apply Filtering immediately
      const kernel = generateKernel(numDetectors, kernelType);
      filteredSinogramRef.current = convolveSinogram(sino, kernel);

      // Draw Initial Sinogram (Static)
      // Helper to draw sinogram
      if (acquisitionCanvasRef.current) {
        const ctx = acquisitionCanvasRef.current.getContext('2d');
        if (ctx) {
          // Draw full sinogram
          // Need to flatten
          const flatSino = new Float32Array(numProjections * numDetectors);
          sino.forEach((row, r) => row.forEach((v, c) => flatSino[r * numDetectors + c] = v));
          // Render squeezed?
          // Simple render:
          const imgData = ctx.createImageData(numDetectors, numProjections);
          // Need to scale to canvas size... 
          // Let's just draw 1:1 to canvas size (scaled via CSS)
          // But canvas resolution is fixed to matrixSize for consistency?
          // No, Sinogram has different dimensions (Angles x Detectors).
          // We should resize Acquisition Canvas to match Sinogram dims or scale.
          acquisitionCanvasRef.current.width = numDetectors;
          acquisitionCanvasRef.current.height = numProjections;

          let max = 0;
          for (let i = 0; i < flatSino.length; i += 10) if (flatSino[i] > max) max = flatSino[i];

          for (let i = 0; i < flatSino.length; i++) {
            const val = (flatSino[i] / (max || 1)) * 255;
            imgData.data[i * 4] = val;
            imgData.data[i * 4 + 1] = val;
            imgData.data[i * 4 + 2] = val;
            imgData.data[i * 4 + 3] = 255;
          }
          ctx.putImageData(imgData, 0, 0);
        }
      }

    });

    return () => { active = false; };
  }, [selectedImageId, customImage, matrixSize, stepAngle, fanAngle, numDetectors, kernelType, generateData, numProjections]);


  // 2. Animation Loop
  const startSimulation = () => {
    if (isAnimating) {
      setIsAnimating(false);
      animationController.current.stopAll();
      return;
    }

    if (!imageDataRef.current.length) return;

    // Reset Buffers
    rawReconBuffer.current = new Float32Array(matrixSize * matrixSize).fill(0);
    filteredReconBuffer.current = new Float32Array(matrixSize * matrixSize).fill(0);

    setIsAnimating(true);

    const batchSize = 1; // Projections per frame (increase for speed)
    // At 60fps, 360 projections takes 6 seconds with batch=1. Good.

    animationController.current.start(
      'sim',
      0,
      numProjections - 1,
      { duration: numProjections * 20, easing: 'linear' }, // approx 20ms per proj
      (val) => {
        const frameIndex = Math.floor(val);
        if (frameIndex >= numProjections) return;

        // Progressive Update
        // We need to verify we haven't already processed this frame?
        // AnimationController gives interpolated value.
        // We should just run the loop from 'lastProcessed' to 'current'.
        // But simplification: assumes calls are sequential enough.

        // Only update if we have new integer frames
        // Actually, safer to run loop logic or just process [floor(val)]
        // Let's assume sequential for the visual "sweeping".

        // NOTE: Re-running everything up to `val` is O(N^2) * N = O(N^3).
        // We MUST use the accumulator.
        // But `start` callback gets called with current time value. 
        // It doesn't guarantee sequential single steps.

        // FIX: We'll manually manage the "lastProjected" index in a Ref
        // But we can't easily adhere to the 'val' from controller if it skips.
        // Instead, we just Backproject the specific Index `frameIndex`.
        // WARNING: If we skip frames (lag), we miss backprojections -> Artifacts.
        // Solution: Loop from LastIndex+1 to CurrentIndex.
      },
      () => setIsAnimating(false)
    );

    // Better Approach: explicit frequent interval/loop
    let processedIdx = -1;

    const tick = () => {
      if (!isAnimating) return; // Stale closure check?
      // Actually this closure captures initial isAnimating=true. 
      // Use Ref for active state? No, controller handles stop.
    }
    // We will stick to AnimationController but modify the callback to catch up
  };

  // Custom Animation Driver
  // Using requestAnimationFrame directly for customized "Catch up" logic
  const animationRef = useRef<number>();

  const runAnimationStep = useCallback(() => {
    let currentIdx = 0;
    const startTime = performance.now();
    const speed = 0.03; // Projections per ms

    const loop = (time: number) => {
      const elapsed = time - startTime;
      const targetIdx = Math.min(numProjections - 1, Math.floor(elapsed * speed));

      if (targetIdx > currentIdx) {
        // Catch up logic
        for (let i = currentIdx; i <= targetIdx; i++) {
          // 1. Backproject Raw
          if (rawReconBuffer.current && sinogramRef.current[i]) {
            addFanBeamProjectionToImage(
              sinogramRef.current[i],
              rawReconBuffer.current,
              matrixSize,
              (i / numProjections) * 2 * Math.PI, // Angle
              fanAngle,
              numDetectors
            );
          }
          // 2. Backproject Filtered
          if (filteredReconBuffer.current && filteredSinogramRef.current[i]) {
            addFanBeamProjectionToImage(
              filteredSinogramRef.current[i],
              filteredReconBuffer.current,
              matrixSize,
              (i / numProjections) * 2 * Math.PI,
              fanAngle,
              numDetectors
            );
          }
        }

        // Update Canvas (Last state)
        // Only draw every X frames to save UI thread?
        if (rawBpCanvasRef.current && rawReconBuffer.current) {
          renderMatrix(rawBpCanvasRef.current.getContext('2d')!, rawReconBuffer.current, matrixSize, matrixSize, true);
        }
        if (filteredBpCanvasRef.current && filteredReconBuffer.current) {
          renderMatrix(filteredBpCanvasRef.current.getContext('2d')!, filteredReconBuffer.current, matrixSize, matrixSize, true);
        }
        if (acquisitionCanvasRef.current) {
          // Draw cursor line
          // ... reusing logic or simple overlay
          const ctx = acquisitionCanvasRef.current.getContext('2d')!;
          // We need to redraw the image to clear old line? 
          // Or just use XOR?
          // Simple: Draw Semi-transparent rect over previous? No.
          // Just draw a red line at y=targetIdx
          const h = ctx.canvas.height;
          // Our canvas height is numProjections.
          ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.fillRect(0, targetIdx, ctx.canvas.width, 1);
        }

        currentIdx = targetIdx + 1;
        setProgress(currentIdx / numProjections);
      }

      if (currentIdx < numProjections) {
        animationRef.current = requestAnimationFrame(loop);
      } else {
        setIsAnimating(false);
      }
    };
    animationRef.current = requestAnimationFrame(loop);
  }, [matrixSize, fanAngle, numDetectors, numProjections]);

  useEffect(() => {
    if (isAnimating) {
      runAnimationStep();
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isAnimating, runAnimationStep]);

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* Parameters Panel */}
      <div className="bg-bg-200 p-6 rounded-lg border border-border-200 shadow-sm transition-all hover:shadow-md">
        <div className="flex flex-col space-y-4">
          {/* Top Row: Basic Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Phantom Case (体模选择)"
              value={selectedImageId}
              onChange={(e) => setSelectedImageId(e.target.value)}
              options={[...defaultImages.map(img => ({ value: img.id, label: img.name })), { value: 'custom', label: 'Custom Upload (上传)...' }]}
            />
            {selectedImageId === 'custom' && (
              <input type="file" onChange={(e) => { /* handle */ }} className="text-sm text-text-200" />
            )}
          </div>

          {/* Advanced Physics Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-bg-300 rounded-md">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-100 uppercase">Matrix Size (矩阵大小)</label>
              <div className="flex space-x-2">
                {[128, 256, 512].map(s => (
                  <button
                    key={s}
                    onClick={() => !isAnimating && setMatrixSize(s)}
                    className={`px-3 py-1 text-xs rounded border ${matrixSize === s ? 'bg-primary-100 text-white border-primary-100' : 'bg-bg-100 text-text-200 border-border-100'}`}
                  >
                    {s}x{s}
                  </button>
                ))}
              </div>
            </div>

            <Slider
              label="Fan Angle (扇束角度)"
              value={fanAngle} min={30} max={180} step={10}
              onChange={(e) => setFanAngle(Number(e.target.value))}
              valueDisplay={`${fanAngle}°`}
              disabled={isAnimating}
            />

            <Slider
              label="Detectors (探测器数量)"
              value={numDetectors} min={128} max={512} step={64}
              onChange={(e) => setNumDetectors(Number(e.target.value))}
              valueDisplay={`${numDetectors}`}
              disabled={isAnimating}
            />

            <Select
              label="Recon Kernel (滤波核)"
              value={kernelType}
              onChange={(e) => setKernelType(e.target.value as any)}
              options={[
                { value: 'smooth', label: 'Smooth (Soft Tissue) - 柔和' },
                { value: 'standard', label: 'Standard (General) - 标准' },
                { value: 'sharp', label: 'Sharp (Bone/High Res) - 锐利' },
              ]}
              disabled={isAnimating}
            />
          </div>

          <Button variant="primary" onClick={() => setIsAnimating(!isAnimating)} className="w-full">
            {isAnimating ? 'Stop Simulation (停止)' : 'Start Reconstruction (开始重建)'}
          </Button>
        </div>
      </div>

      {/* 4-Window Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DisplayWindow title="1. Phantom (体模)" label="Original" ref={phantomCanvasRef} size={matrixSize} />
        <DisplayWindow title="2. Sinogram (正弦图)" label="Radon Space" ref={acquisitionCanvasRef} size={matrixSize} rect />
        <DisplayWindow title="3. Raw BP (直接反投影)" label="Unfiltered (Blurry)" ref={rawBpCanvasRef} size={matrixSize} />
        <DisplayWindow title="4. Filtered BP (滤波反投影)" label={`FBP (${kernelType})`} ref={filteredBpCanvasRef} size={matrixSize} />
      </div>

      {/* Progress */}
      {isAnimating && (
        <div className="w-full h-1 bg-bg-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary-100 transition-all duration-75" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
};

// Sub-component for windows
const DisplayWindow = React.forwardRef<HTMLCanvasElement, any>(({ title, label, size, rect = false }, ref) => (
  <div className="space-y-2">
    <h3 className="text-sm font-medium text-text-200 text-center">{title}</h3>
    <div className="aspect-square bg-black rounded-lg border border-border-100 overflow-hidden shadow-inner relative group">
      <canvas ref={ref} width={size} height={size} className={`w-full h-full ${rect ? 'object-fill' : 'object-contain'}`} />
      <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-[10px] text-white rounded opacity-50 group-hover:opacity-100 transition-opacity">
        {label}
      </div>
    </div>
  </div>
));
DisplayWindow.displayName = 'DisplayWindow';

export default BackprojectionSimulator;