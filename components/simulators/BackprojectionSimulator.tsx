'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Select } from '../ui/Select';
import { Slider } from '../ui/Slider';
import { Button } from '../ui/Button';
import { BackprojectionOptions } from '@/types';
import { generateSinogram, applyRampFilter } from '@/utils/physics-calculations';
import { AnimationController } from '@/utils/animation-utils';
import FracturePhantom from './FracturePhantom';

interface Props {
  options?: BackprojectionOptions;
}

const BackprojectionSimulator: React.FC<Props> = ({ options }) => {
  const defaultImages = [
    { id: 'phantom', name: 'Shepp-Logan Phantom' },
    { id: 'abdomen', name: 'Abdomen CT (Simulated)' },
    { id: 'fracture', name: 'Bone Fracture (3D)' }
  ];

  const defaultFanBeamAngles = [
    { value: 30, name: '30°' },
    { value: 60, name: '60°' },
    { value: 90, name: '90°' },
    { value: 120, name: '120°' }
  ];

  const images = options?.images || defaultImages;
  const fanBeamAngles = options?.fanBeamAngles || defaultFanBeamAngles;

  const [selectedImage, setSelectedImage] = useState(images[0]?.id || 'phantom');
  const [fanBeamAngle, setFanBeamAngle] = useState(fanBeamAngles[1]?.value || 60);
  const [projectionCount, setProjectionCount] = useState(36);
  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Canvas refs for the 4 windows
  const phantomCanvasRef = useRef<HTMLCanvasElement>(null);
  const acquisitionCanvasRef = useRef<HTMLCanvasElement>(null);
  const rawBpCanvasRef = useRef<HTMLCanvasElement>(null);
  const filteredBpCanvasRef = useRef<HTMLCanvasElement>(null);

  // Data refs
  const imageDataRef = useRef<number[][]>([]);
  const sinogramRef = useRef<number[][]>([]);
  const animationController = useRef(new AnimationController());

  // Generate phantom data based on selection
  const generateData = useCallback(() => {
    const size = 256;
    const data: number[][] = Array(size).fill(null).map(() => Array(size).fill(0));
    const center = size / 2;

    if (selectedImage === 'phantom') {
      // Shepp-Logan Phantom generation (simplified)
      const ellipses = [
        { cx: 0, cy: 0, a: 0.92, b: 0.69, theta: 90, val: 2.0 },
        { cx: 0, cy: -0.0184, a: 0.874, b: 0.6624, theta: 90, val: -0.98 },
        { cx: 0.22, cy: 0, a: 0.31, b: 0.11, theta: 72, val: -0.02 },
        { cx: -0.22, cy: 0, a: 0.41, b: 0.16, theta: 108, val: -0.02 },
        { cx: 0, cy: 0.35, a: 0.25, b: 0.21, theta: 90, val: 0.01 },
        { cx: 0, cy: 0.1, a: 0.046, b: 0.046, theta: 0, val: 0.01 },
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
    } else if (selectedImage === 'abdomen') {
      // Procedural Abdomen
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = (x - center) / (size * 0.4);
          const dy = (y - center) / (size * 0.3);
          if (dx * dx + dy * dy <= 1) {
            data[y][x] = 0.5; // Body

            // Spine
            const sx = (x - center) / (size * 0.08);
            const sy = (y - center - size * 0.15) / (size * 0.08);
            if (sx * sx + sy * sy <= 1) data[y][x] = 0.9;

            // Liver (approx)
            const lx = (x - center + size * 0.15) / (size * 0.15);
            const ly = (y - center + size * 0.05) / (size * 0.12);
            if (lx * lx + ly * ly <= 1) data[y][x] = 0.6;
          }
        }
      }
    } else {
      // Fracture (Placeholder for 3D shader implementation)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = (x - center) / (size * 0.1);
          const dy = (y - center) / (size * 0.3);
          if (dx * dx + dy * dy <= 1) {
            // Bone with fracture
            if (Math.abs(y - center) < 2 && Math.abs(x - center) < size * 0.08) {
              data[y][x] = 0; // Fracture line
            } else {
              data[y][x] = 0.9;
            }
          }
        }
      }
    }

    return data;
  }, [selectedImage]);

  // Draw functions for each window
  const drawPhantomWindow = useCallback((ctx: CanvasRenderingContext2D, angle: number) => {
    const size = 256;
    const scale = ctx.canvas.width / size;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.scale(scale, scale);

    // Draw Phantom
    const imageData = ctx.createImageData(size, size);
    const data = imageDataRef.current;
    for (let i = 0; i < size * size; i++) {
      const val = Math.floor(data[Math.floor(i / size)][i % size] * 255);
      imageData.data[i * 4] = val;
      imageData.data[i * 4 + 1] = val;
      imageData.data[i * 4 + 2] = val;
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw Source and Detector
    const center = size / 2;
    const radius = size * 0.45;
    const sourceX = center + radius * Math.cos(angle);
    const sourceY = center + radius * Math.sin(angle);
    const detX = center - radius * Math.cos(angle);
    const detY = center - radius * Math.sin(angle);

    ctx.beginPath();
    ctx.arc(sourceX, sourceY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700'; // Gold source
    ctx.fill();

    // Fan beam
    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY);
    const fanRad = (fanBeamAngle * Math.PI) / 180 / 2;
    ctx.lineTo(
      center - radius * Math.cos(angle + fanRad),
      center - radius * Math.sin(angle + fanRad)
    );
    ctx.lineTo(
      center - radius * Math.cos(angle - fanRad),
      center - radius * Math.sin(angle - fanRad)
    );
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.fill();

    ctx.restore();
  }, [fanBeamAngle]);

  const drawAcquisitionWindow = useCallback((ctx: CanvasRenderingContext2D, currentProj: number) => {
    const sinogram = sinogramRef.current;
    if (!sinogram.length) return;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Draw Sinogram being built
    const scaleX = width / sinogram[0].length;
    const scaleY = height / sinogram.length;

    for (let p = 0; p <= currentProj; p++) {
      for (let d = 0; d < sinogram[0].length; d++) {
        const val = Math.floor(sinogram[p][d] * 255);
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(d * scaleX, p * scaleY, scaleX, scaleY);
      }
    }

    // Highlight current line
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(0, currentProj * scaleY, width, 2);

  }, []);

  const drawReconstructionWindow = useCallback((ctx: CanvasRenderingContext2D, currentProj: number, filtered: boolean) => {
    const size = 256;
    const reconstruction = Array(size).fill(null).map(() => Array(size).fill(0));
    const sinogram = sinogramRef.current;
    const center = size / 2;

    // Perform backprojection up to current projection
    for (let p = 0; p <= currentProj; p++) {
      const angle = (p / projectionCount) * Math.PI;
      let projection = sinogram[p];

      if (filtered) {
        projection = applyRampFilter(projection);
      }

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const xRot = (x - center) * Math.cos(angle) + (y - center) * Math.sin(angle);
          const detIdx = Math.floor(xRot + projection.length / 2);
          if (detIdx >= 0 && detIdx < projection.length) {
            reconstruction[y][x] += projection[detIdx];
          }
        }
      }
    }

    // Normalize and draw
    const imgData = ctx.createImageData(size, size);
    let max = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) max = Math.max(max, reconstruction[y][x]);

    for (let i = 0; i < size * size; i++) {
      const val = Math.floor((reconstruction[Math.floor(i / size)][i % size] / (max || 1)) * 255);
      imgData.data[i * 4] = val;
      imgData.data[i * 4 + 1] = val;
      imgData.data[i * 4 + 2] = val;
      imgData.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);

    // Scale to canvas size
    ctx.drawImage(ctx.canvas, 0, 0, size, size, 0, 0, ctx.canvas.width, ctx.canvas.height);

  }, [projectionCount]);

  // Main update loop
  useEffect(() => {
    imageDataRef.current = generateData();
    sinogramRef.current = generateSinogram(imageDataRef.current, projectionCount, fanBeamAngle);

    // Initial draw
    if (phantomCanvasRef.current && selectedImage !== 'fracture') drawPhantomWindow(phantomCanvasRef.current.getContext('2d')!, 0);
    if (acquisitionCanvasRef.current) drawAcquisitionWindow(acquisitionCanvasRef.current.getContext('2d')!, 0);
    if (rawBpCanvasRef.current) drawReconstructionWindow(rawBpCanvasRef.current.getContext('2d')!, 0, false);
    if (filteredBpCanvasRef.current) drawReconstructionWindow(filteredBpCanvasRef.current.getContext('2d')!, 0, true);

  }, [selectedImage, projectionCount, fanBeamAngle, generateData, drawPhantomWindow, drawAcquisitionWindow, drawReconstructionWindow]);

  const startAnimation = () => {
    if (isAnimating) {
      animationController.current.stopAll();
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    setProgress(0);

    animationController.current.start(
      'recon',
      0,
      projectionCount - 1,
      { duration: 5000, easing: 'linear' },
      (val) => {
        const currentProj = Math.floor(val);
        const angle = (currentProj / projectionCount) * Math.PI;

        setProgress(val / projectionCount);

        if (phantomCanvasRef.current && selectedImage !== 'fracture') drawPhantomWindow(phantomCanvasRef.current.getContext('2d')!, angle);
        if (acquisitionCanvasRef.current) drawAcquisitionWindow(acquisitionCanvasRef.current.getContext('2d')!, currentProj);

        // Update reconstructions less frequently for performance
        if (currentProj % 2 === 0) {
          if (rawBpCanvasRef.current) drawReconstructionWindow(rawBpCanvasRef.current.getContext('2d')!, currentProj, false);
          if (filteredBpCanvasRef.current) drawReconstructionWindow(filteredBpCanvasRef.current.getContext('2d')!, currentProj, true);
        }
      },
      () => setIsAnimating(false)
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Select Image"
          options={images.map(img => ({ value: img.id, label: img.name }))}
          value={selectedImage}
          onChange={(e) => setSelectedImage(e.target.value)}
        />
        <Select
          label="Fan Beam Angle"
          options={fanBeamAngles.map(a => ({ value: a.value.toString(), label: a.name }))}
          value={fanBeamAngle.toString()}
          onChange={(e) => setFanBeamAngle(parseInt(e.target.value))}
        />
        <div className="flex items-end">
          <Button onClick={startAnimation} variant="primary" className="w-full">
            {isAnimating ? 'Stop' : 'Start Reconstruction'}
          </Button>
        </div>
      </div>

      <Slider
        label={`Number of Projections: ${projectionCount}`}
        min={18}
        max={180}
        step={1}
        value={projectionCount}
        onChange={(e) => setProjectionCount(parseInt(e.target.value))}
      />

      {/* 4-Window Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top Left: Phantom & Geometry */}
        <div className="bg-black rounded-lg border border-border-100 p-2 relative aspect-square overflow-hidden">
          <div className="absolute top-2 left-2 text-xs text-white bg-black/50 px-2 rounded z-10">Phantom & Geometry</div>
          {selectedImage === 'fracture' ? (
            <FracturePhantom />
          ) : (
            <canvas ref={phantomCanvasRef} width={256} height={256} className="w-full h-full" />
          )}
        </div>

        {/* Top Right: Data Acquisition */}
        <div className="bg-black rounded-lg border border-border-100 p-2 relative aspect-square">
          <div className="absolute top-2 left-2 text-xs text-white bg-black/50 px-2 rounded">Data Acquisition (Sinogram)</div>
          <canvas ref={acquisitionCanvasRef} width={256} height={256} className="w-full h-full" />
        </div>

        {/* Bottom Left: Raw Backprojection */}
        <div className="bg-black rounded-lg border border-border-100 p-2 relative aspect-square">
          <div className="absolute top-2 left-2 text-xs text-white bg-black/50 px-2 rounded">Raw Backprojection</div>
          <canvas ref={rawBpCanvasRef} width={256} height={256} className="w-full h-full" />
        </div>

        {/* Bottom Right: Filtered Backprojection */}
        <div className="bg-black rounded-lg border border-border-100 p-2 relative aspect-square">
          <div className="absolute top-2 left-2 text-xs text-white bg-black/50 px-2 rounded">Filtered Backprojection</div>
          <canvas ref={filteredBpCanvasRef} width={256} height={256} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

export default BackprojectionSimulator;