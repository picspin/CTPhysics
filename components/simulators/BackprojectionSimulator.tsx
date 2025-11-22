'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Select } from '../ui/Select';
import { Slider } from '../ui/Slider';
import { Button } from '../ui/Button';
import { BackprojectionOptions } from '@/types';
import { generateSinogram, applyRampFilter } from '@/utils/physics-calculations';
import { AnimationController } from '@/utils/animation-utils';

interface Props {
  options?: BackprojectionOptions;
}

const BackprojectionSimulator: React.FC<Props> = ({ options }) => {
  const defaultImages = [
    { id: 'phantom', name: 'Shepp-Logan Phantom' },
    { id: 'abdomen', name: 'Abdomen CT' },
    { id: 'chest', name: 'Chest CT' }
  ];

  const defaultFanBeamAngles = [
    { value: 30, name: '30°' },
    { value: 60, name: '60°' },
    { value: 90, name: '90°' }
  ];

  const images = options?.images || defaultImages;
  const fanBeamAngles = options?.fanBeamAngles || defaultFanBeamAngles;

  const [selectedImage, setSelectedImage] = useState(images[0]?.id || 'phantom');
  const [fanBeamAngle, setFanBeamAngle] = useState(fanBeamAngles[1]?.value || 60);
  const [projectionCount, setProjectionCount] = useState(36);
  const [isFiltered, setIsFiltered] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [reconstructionProgress, setReconstructionProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationController = useRef(new AnimationController());
  const imageDataRef = useRef<number[][]>([]);
  const sinogramRef = useRef<number[][]>([]);

  // Generate phantom image data
  const generatePhantomData = useCallback(() => {
    const size = 256;
    const data: number[][] = Array(size).fill(null).map(() => Array(size).fill(0));
    const center = size / 2;

    // Main ellipse
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - center) / (size * 0.35);
        const dy = (y - center) / (size * 0.25);
        if (dx * dx + dy * dy <= 1) {
          data[y][x] = 1.0;
        }
      }
    }

    // Add smaller ellipses for Shepp-Logan phantom
    const ellipses = [
      { cx: 0.0, cy: -0.0184, a: 0.6624, b: 0.874, theta: 0, value: -0.98 },
      { cx: 0.0, cy: -0.0184, a: 0.41, b: 0.16, theta: 0, value: -0.02 },
      { cx: 0.22, cy: 0.0, a: 0.11, b: 0.31, theta: -18, value: -0.02 },
      { cx: -0.22, cy: 0.0, a: 0.16, b: 0.41, theta: 18, value: -0.02 }
    ];

    ellipses.forEach(ellipse => {
      const { cx, cy, a, b, theta, value } = ellipse;
      const rad = theta * Math.PI / 180;
      const cos_t = Math.cos(rad);
      const sin_t = Math.sin(rad);

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = (x - center) / (size * 0.5) - cx;
          const dy = (y - center) / (size * 0.5) - cy;
          const x_rot = dx * cos_t + dy * sin_t;
          const y_rot = -dx * sin_t + dy * cos_t;

          if ((x_rot / a) ** 2 + (y_rot / b) ** 2 <= 1) {
            data[y][x] += value;
          }
        }
      }
    });

    return data;
  }, []);

  // Draw reconstruction
  const drawReconstruction = useCallback((ctx: CanvasRenderingContext2D, size: number) => {
    const reconstruction = Array(size).fill(null).map(() => Array(size).fill(0));
    const sinogram = sinogramRef.current;
    const numProjections = Math.floor(projectionCount * reconstructionProgress);

    for (let p = 0; p < numProjections; p++) {
      const angle = (p / projectionCount) * Math.PI;
      let projection = sinogram[p];

      if (isFiltered) {
        projection = applyRampFilter(projection);
      }

      // Backproject
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const xRot = (x - size / 2) * Math.cos(angle) + (y - size / 2) * Math.sin(angle);
          const detectorIndex = Math.floor(xRot + projection.length / 2);

          if (detectorIndex >= 0 && detectorIndex < projection.length) {
            reconstruction[y][x] += projection[detectorIndex];
          }
        }
      }
    }

    // Normalize and draw
    const reconstructionImageData = ctx.createImageData(size, size);
    let min = Infinity, max = -Infinity;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        min = Math.min(min, reconstruction[y][x]);
        max = Math.max(max, reconstruction[y][x]);
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const value = Math.floor(((reconstruction[y][x] - min) / (max - min)) * 255);
        reconstructionImageData.data[idx] = value;
        reconstructionImageData.data[idx + 1] = value;
        reconstructionImageData.data[idx + 2] = value;
        reconstructionImageData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(reconstructionImageData, 0, size + 10);
  }, [projectionCount, reconstructionProgress, isFiltered]);

  // Draw images on canvas
  const drawImages = useCallback(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const imageData = imageDataRef.current;
    const size = imageData.length;

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw original image
    const originalImageData = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const value = Math.floor(imageData[y][x] * 255);
        originalImageData.data[idx] = value;
        originalImageData.data[idx + 1] = value;
        originalImageData.data[idx + 2] = value;
        originalImageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(originalImageData, 0, 0);

    // Draw sinogram
    const sinogram = sinogramRef.current;
    if (sinogram.length > 0) {
      const sinogramImageData = ctx.createImageData(sinogram[0].length, sinogram.length);
      for (let y = 0; y < sinogram.length; y++) {
        for (let x = 0; x < sinogram[0].length; x++) {
          const idx = (y * sinogram[0].length + x) * 4;
          const value = Math.floor(Math.abs(sinogram[y][x]) * 255 / 10);
          sinogramImageData.data[idx] = value;
          sinogramImageData.data[idx + 1] = value;
          sinogramImageData.data[idx + 2] = value;
          sinogramImageData.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(sinogramImageData, size + 10, 0);
    }

    // Draw reconstruction
    if (reconstructionProgress > 0) {
      drawReconstruction(ctx, size);
    }
  }, [reconstructionProgress, drawReconstruction]);

  // Load or generate image data
  useEffect(() => {
    if (selectedImage === 'phantom') {
      imageDataRef.current = generatePhantomData();
    } else {
      // Load real CT image data (simplified for demo)
      const size = 256;
      imageDataRef.current = Array(size).fill(null).map(() =>
        Array(size).fill(0).map(() => Math.random())
      );
    }

    // Generate sinogram
    sinogramRef.current = generateSinogram(
      imageDataRef.current,
      projectionCount,
      fanBeamAngle
    );

    // Reset and redraw
    setReconstructionProgress(0);
    drawImages();
  }, [selectedImage, projectionCount, fanBeamAngle, generatePhantomData, drawImages]);

  // Start animation
  const startAnimation = () => {
    if (isAnimating) {
      animationController.current.stopAll();
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    setReconstructionProgress(0);

    animationController.current.start(
      'reconstruction',
      0,
      1,
      { duration: 3000, easing: 'easeInOut' },
      (value) => {
        setReconstructionProgress(value);
        drawImages();
      },
      () => {
        setIsAnimating(false);
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Select Image"
          options={images.map(img => ({ value: img.id, label: img.name }))}
          value={selectedImage}
          onChange={(e) => setSelectedImage(e.target.value)}
        />

        <Select
          label="Fan Beam Angle"
          options={fanBeamAngles.map(angle => ({
            value: angle.value.toString(),
            label: angle.name
          }))}
          value={fanBeamAngle.toString()}
          onChange={(e) => setFanBeamAngle(parseInt(e.target.value))}
        />
      </div>

      <div className="space-y-4">
        <Slider
          label="Number of Projections"
          min={4}
          max={180}
          value={projectionCount}
          onChange={(e) => setProjectionCount(Number(e.target.value))}
          step={4}
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFiltered}
              onChange={(e) => setIsFiltered(e.target.checked)}
              className="w-4 h-4 text-primary-100 rounded focus:ring-primary-100"
            />
            <span className="text-sm font-medium text-text-100">
              Filtered Backprojection
            </span>
          </label>

          <Button onClick={startAnimation} variant="primary">
            {isAnimating ? 'Stop Animation' : 'Start Reconstruction'}
          </Button>
        </div>
      </div>

      {/* Visualization */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={522}
          height={522}
          className="w-full max-w-2xl mx-auto border border-border-100 rounded-lg bg-black"
        />

        {/* Progress indicator */}
        <AnimatePresence>
          {isAnimating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 right-4 bg-bg-100 rounded-lg p-2 shadow-lg"
            >
              <div className="text-sm font-medium text-text-100">
                Progress: {Math.round(reconstructionProgress * 100)}%
              </div>
              <div className="mt-1 w-32 h-2 bg-bg-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary-100"
                  style={{ width: `${reconstructionProgress * 100}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Labels */}
        <div className="grid grid-cols-3 gap-4 mt-4 text-center text-sm text-text-200">
          <div>Original Image</div>
          <div>Sinogram</div>
          <div>{isFiltered ? 'Filtered' : 'Unfiltered'} Reconstruction</div>
        </div>
      </div>

      {/* Information panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-bg-200 rounded-lg p-4 space-y-2"
      >
        <h4 className="font-medium text-text-100">Key Observations:</h4>
        <ul className="space-y-1 text-sm text-text-200">
          <li>• More projections lead to better reconstruction quality</li>
          <li>• Filtered backprojection reduces blurring significantly</li>
          <li>• The sinogram shows the projection data at different angles</li>
          <li>• Fan beam angle affects the field of view</li>
        </ul>
      </motion.div>
    </div>
  );
};

export default BackprojectionSimulator;