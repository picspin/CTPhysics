'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import SimulatorContainer from '../ui/SimulatorContainer';
import Select from '../ui/Select';
import Slider from '../ui/Slider';
import { Button } from '../ui/Button';
import { CardiacGatingOptions } from '@/types';
import { calculateOptimalPhase, calculateTemporalResolution } from '@/utils/physics-calculations';
import { drawSmoothLine, Particle } from '@/utils/animation-utils';

interface Props {
  options?: CardiacGatingOptions;
}

const CardiacGatingSimulator: React.FC<Props> = ({ options }) => {
  const defaultGatingTypes = [
    { id: 'prospective', name: 'Prospective Gating' },
    { id: 'retrospective', name: 'Retrospective Gating' }
  ];

  const gatingTypes = options?.gatingTypes || defaultGatingTypes;
  const heartRateRange = options?.heartRateRange || { min: 40, max: 120, step: 5 };

  const [gatingType, setGatingType] = useState('prospective');
  const [heartRate, setHeartRate] = useState(70);
  const [isScanning, setIsScanning] = useState(false);
  const [ecgData, setEcgData] = useState<{ time: number; value: number }[]>([]);
  const [acquisitionPoints, setAcquisitionPoints] = useState<{ time: number; phase: string }[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [scanQuality, setScanQuality] = useState(100);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);

  // Spring animations for heart
  const heartScale = useSpring(1);
  const heartOpacity = useSpring(0.8);

  // Generate realistic ECG data
  useEffect(() => {
    const generateECG = () => {
      const data: { time: number; value: number }[] = [];
      const duration = 10; // 10 seconds
      const samplesPerSecond = 100;
      const totalSamples = duration * samplesPerSecond;
      const rrInterval = 60 / heartRate; // R-R interval in seconds

      for (let i = 0; i < totalSamples; i++) {
        const time = i / samplesPerSecond;
        const cycleTime = time % rrInterval;
        const normalizedTime = cycleTime / rrInterval;

        let value = 0;

        // P wave (5-10% of cycle)
        if (normalizedTime < 0.1) {
          value = 0.2 * Math.sin((normalizedTime / 0.1) * Math.PI);
        }
        // PR segment (10-15%)
        else if (normalizedTime < 0.15) {
          value = 0;
        }
        // QRS complex (15-25%)
        else if (normalizedTime < 0.25) {
          const qrsTime = (normalizedTime - 0.15) / 0.1;
          if (qrsTime < 0.2) {
            // Q wave
            value = -0.1;
          } else if (qrsTime < 0.5) {
            // R wave
            value = 1.0 * Math.sin((qrsTime - 0.2) * Math.PI / 0.3);
          } else {
            // S wave
            value = -0.2 * Math.sin((qrsTime - 0.5) * Math.PI / 0.5);
          }
        }
        // ST segment (25-35%)
        else if (normalizedTime < 0.35) {
          value = 0;
        }
        // T wave (35-45%)
        else if (normalizedTime < 0.45) {
          value = 0.3 * Math.sin((normalizedTime - 0.35) * Math.PI / 0.1);
        }
        // Baseline (45-100%)
        else {
          value = 0;
        }

        // Add some noise
        value += (Math.random() - 0.5) * 0.02;

        data.push({ time, value });
      }

      setEcgData(data);
    };

    generateECG();
  }, [heartRate]);

  // Draw ECG and acquisition visualization
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw ECG
      if (ecgData.length > 0) {
        const visibleDuration = 5; // Show 5 seconds
        const startTime = Math.max(0, currentTime - visibleDuration);
        const endTime = currentTime;

        const points = ecgData
          .filter(point => point.time >= startTime && point.time <= endTime)
          .map(point => ({
            x: ((point.time - startTime) / visibleDuration) * canvas.width,
            y: canvas.height / 2 - point.value * canvas.height * 0.3
          }));

        drawSmoothLine(ctx, points, '#4A90E2', 2);

        // Draw current time indicator
        if (isScanning) {
          ctx.strokeStyle = '#FF7A00';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(canvas.width, 0);
          ctx.lineTo(canvas.width, canvas.height);
          ctx.stroke();
        }
      }

      // Draw acquisition points
      acquisitionPoints.forEach(point => {
        const x = ((point.time - Math.max(0, currentTime - 5)) / 5) * canvas.width;
        if (x >= 0 && x <= canvas.width) {
          ctx.fillStyle = gatingType === 'prospective' ? '#00FF00' : '#FFFF00';
          ctx.beginPath();
          ctx.arc(x, canvas.height / 2, 5, 0, Math.PI * 2);
          ctx.fill();

          // Add label
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px sans-serif';
          ctx.fillText(point.phase, x - 10, canvas.height / 2 + 20);
        }
      });

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.update(16); // Assuming 60fps

        if (!particle.isDead()) {
          particle.draw(ctx);
          return true;
        }
        return false;
      });
    };

    draw();
  }, [ecgData, currentTime, acquisitionPoints, gatingType, isScanning]);

  // Animation loop
  useEffect(() => {
    if (isScanning) {
      const startTime = Date.now();
      const rrInterval = 60000 / heartRate; // R-R interval in ms

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const newTime = elapsed / 1000;
        setCurrentTime(newTime);

        // Heart beat animation
        const cycleTime = elapsed % rrInterval;
        const normalizedTime = cycleTime / rrInterval;

        if (normalizedTime < 0.1) {
          heartScale.set(1.2);
          heartOpacity.set(1);

          // Add particles on heartbeat
          if (canvasRef.current && particlesRef.current.length < 50) {
            const canvas = canvasRef.current;
            for (let i = 0; i < 5; i++) {
              particlesRef.current.push(new Particle(
                canvas.width,
                canvas.height / 2,
                {
                  vx: -Math.random() * 5 - 2,
                  vy: (Math.random() - 0.5) * 2,
                  color: '#FF7A00',
                  size: Math.random() * 3 + 1
                }
              ));
            }
          }
        } else {
          heartScale.set(1);
          heartOpacity.set(0.8);
        }

        // Determine acquisition windows
        if (gatingType === 'prospective') {
          // Acquire only during diastole (70-80% of R-R interval)
          if (normalizedTime >= 0.7 && normalizedTime <= 0.8) {
            const lastAcquisition = acquisitionPoints[acquisitionPoints.length - 1];
            if (!lastAcquisition || newTime - lastAcquisition.time > 0.1) {
              setAcquisitionPoints(prev => [...prev, { time: newTime, phase: 'Diastole' }]);
            }
          }
        } else {
          // Retrospective: continuous acquisition
          const lastAcquisition = acquisitionPoints[acquisitionPoints.length - 1];
          if (!lastAcquisition || newTime - lastAcquisition.time > 0.05) {
            const phase = normalizedTime < 0.5 ? 'Systole' : 'Diastole';
            setAcquisitionPoints(prev => [...prev, { time: newTime, phase }]);
          }
        }

        // Calculate scan quality based on heart rate variability
        const optimalPhase = calculateOptimalPhase(heartRate, 0.5);
        const quality = heartRate < 65 ? 100 : Math.max(50, 100 - (heartRate - 65));
        setScanQuality(quality);

        if (newTime < 10) { // 10 second scan
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsScanning(false);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScanning, heartRate, gatingType, acquisitionPoints, heartScale, heartOpacity]);

  const startScan = () => {
    if (isScanning) {
      setIsScanning(false);
    } else {
      setCurrentTime(0);
      setAcquisitionPoints([]);
      particlesRef.current = [];
      setIsScanning(true);
    }
  };

  const temporalResolution = calculateTemporalResolution(0.5, false);

  return (
    <SimulatorContainer
      title="Cardiac CT Gating Simulator"
      description="Visualize how ECG-synchronized acquisition works in cardiac CT"
      helpContent={
        <div>
          <p className="mb-3">This simulator demonstrates two cardiac gating techniques:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Prospective Gating:</strong> X-ray is turned on only during the optimal cardiac phase (usually diastole), resulting in lower radiation dose but limited functional assessment.</li>
            <li><strong>Retrospective Gating:</strong> Continuous data acquisition throughout the cardiac cycle, allowing reconstruction at any phase but with higher radiation dose.</li>
          </ul>
          <p className="mt-3">The green dots indicate prospective acquisition windows, while yellow dots show continuous retrospective acquisition.</p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Gating Type"
            options={gatingTypes}
            value={gatingType}
            onChange={setGatingType}
          />

          <Slider
            label="Heart Rate"
            min={heartRateRange.min}
            max={heartRateRange.max}
            value={heartRate}
            onChange={setHeartRate}
            step={heartRateRange.step}
            unit=" bpm"
          />
        </div>

        {/* ECG Visualization */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={300}
            className="w-full h-64 border border-border-100 rounded-lg"
          />

          {/* Heart animation */}
          <motion.div
            className="absolute top-4 right-4"
            style={{ scale: heartScale, opacity: heartOpacity }}
          >
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                fill="#FF0000"
                stroke="#AA0000"
                strokeWidth="2"
              />
            </svg>
          </motion.div>
        </div>

        {/* Scan button and status */}
        <div className="flex items-center justify-between">
          <Button onClick={startScan} variant="primary" size="lg">
            {isScanning ? 'Stop Scan' : 'Start Cardiac Scan'}
          </Button>

          <div className="text-right">
            <div className="text-sm text-text-200">Temporal Resolution</div>
            <div className="text-lg font-semibold text-text-100">{temporalResolution * 1000}ms</div>
          </div>
        </div>

        {/* Results and metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-bg-200 rounded-lg p-4"
          >
            <h4 className="text-sm font-medium text-text-200 mb-1">Acquisition Points</h4>
            <div className="text-2xl font-bold text-primary-100">
              {acquisitionPoints.length}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-bg-200 rounded-lg p-4"
          >
            <h4 className="text-sm font-medium text-text-200 mb-1">Scan Quality</h4>
            <div className="text-2xl font-bold" style={{
              color: scanQuality > 80 ? '#00FF00' : scanQuality > 60 ? '#FFAA00' : '#FF0000'
            }}>
              {scanQuality}%
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-bg-200 rounded-lg p-4"
          >
            <h4 className="text-sm font-medium text-text-200 mb-1">Estimated Dose</h4>
            <div className="text-2xl font-bold text-text-100">
              {gatingType === 'prospective' ? '3-5' : '10-15'} mSv
            </div>
          </motion.div>
        </div>

        {/* Recommendations */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-accent-100 bg-opacity-10 border border-accent-100 border-opacity-30 rounded-lg p-4"
        >
          <h4 className="font-medium text-accent-100 mb-2">Recommendations</h4>
          <ul className="space-y-1 text-sm text-text-100">
            {heartRate > 70 && (
              <li>• Consider beta-blockers to reduce heart rate below 65 bpm for optimal image quality</li>
            )}
            {gatingType === 'retrospective' && (
              <li>• Use ECG dose modulation to reduce radiation during systole</li>
            )}
            {heartRate < 60 && gatingType === 'prospective' && (
              <li>• Excellent conditions for prospective gating - low dose with high quality</li>
            )}
          </ul>
        </motion.div>
      </div>
    </SimulatorContainer>
  );
};

export default CardiacGatingSimulator;