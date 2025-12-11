'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useSpring } from 'framer-motion';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { CardiacGatingOptions } from '@/types';

interface Props {
  options?: CardiacGatingOptions;
}

const CardiacGatingSimulator: React.FC<Props> = ({ options }) => {
  const defaultGatingTypes = [
    { id: 'prospective', name: '前瞻性门控 (Prospective - Step & Shoot)' },
    { id: 'retrospective', name: '回顾性门控 (Retrospective - Helical)' }
  ];

  const gatingTypes = options?.gatingTypes || defaultGatingTypes;

  const [gatingType, setGatingType] = useState('prospective');
  const [heartRate, setHeartRate] = useState(75);
  const [isScanning, setIsScanning] = useState(false);
  const [ecgData, setEcgData] = useState<{ time: number; value: number }[]>([]);
  const [acquisitionPoints, setAcquisitionPoints] = useState<{ time: number; phase: string }[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Spring animations for heart visual
  const heartScale = useSpring(1);
  const heartOpacity = useSpring(0.8);

  // Generate ECG Signal
  useEffect(() => {
    const generateECG = () => {
      const data: { time: number; value: number }[] = [];
      const duration = 10; // 10 seconds buffer
      const samplesPerSecond = 60;
      const totalSamples = duration * samplesPerSecond;
      const rrInterval = 60 / heartRate; // seconds

      for (let i = 0; i < totalSamples; i++) {
        const time = i / samplesPerSecond;
        const cycleTime = time % rrInterval;
        const normalizedTime = cycleTime / rrInterval;

        let value = 0;
        // Simple PQRST simulation
        if (normalizedTime < 0.1) value = 0.1; // P
        else if (normalizedTime < 0.15) value = 0;
        else if (normalizedTime < 0.2) value = -0.1; // Q
        else if (normalizedTime < 0.25) value = 1.0; // R
        else if (normalizedTime < 0.3) value = -0.2; // S
        else if (normalizedTime < 0.6) value = 0.2; // T
        else value = 0;

        // Add noise
        value += (Math.random() - 0.5) * 0.05;
        data.push({ time, value });
      }
      setEcgData(data);
    };

    generateECG();
  }, [heartRate]);

  // Animation Loop
  useEffect(() => {
    if (isScanning) {
      const startTime = Date.now();
      const rrIntervalMs = (60 / heartRate) * 1000;

      const animate = () => {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000; // seconds
        setCurrentTime(elapsed);

        // Heart Beat Visual
        const cyclePos = (now % rrIntervalMs) / rrIntervalMs;
        if (cyclePos < 0.15) {
          heartScale.set(1.2);
          heartOpacity.set(1.0);
        } else {
          heartScale.set(1.0);
          heartOpacity.set(0.8);
        }

        // Acquisition Logic
        // Prospective: Scan at 75% of RR (Diastole)
        // Retrospective: Scan continuously, but highlight phases
        const cycleTime = elapsed % (60 / heartRate);
        const normCycle = cycleTime / (60 / heartRate);

        if (gatingType === 'prospective') {
          if (normCycle > 0.7 && normCycle < 0.8) {
            // Trigger Window
            // Check if we already acquired in this cycle to avoid dupes
            if (acquisitionPoints.length === 0 || (elapsed - acquisitionPoints[acquisitionPoints.length - 1].time) > 0.2) {
              setAcquisitionPoints(prev => [...prev, { time: elapsed, phase: 'Diastole' }]);
            }
          }
        } else {
          // Retrospective - Continuous
          // Record points every 0.1s
          if (acquisitionPoints.length === 0 || (elapsed - acquisitionPoints[acquisitionPoints.length - 1].time) > 0.1) {
            setAcquisitionPoints(prev => [...prev, { time: elapsed, phase: normCycle < 0.4 ? 'Systole' : 'Diastole' }]);
          }
        }

        if (elapsed < 5) { // 5 second scan duration
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsScanning(false);
        }
      };
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isScanning, heartRate, gatingType, acquisitionPoints, heartScale, heartOpacity]);

  // Draw Function
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    ctx.stroke();

    // Draw ECG (scrolling)
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const visibleWindow = 3.0; // 3 seconds visible
    const startDrawTime = Math.max(0, currentTime - visibleWindow);

    let first = true;
    ecgData.forEach(pt => {
      if (pt.time >= startDrawTime && pt.time <= currentTime) {
        const x = ((pt.time - startDrawTime) / visibleWindow) * w;
        const y = h / 2 - (pt.value * h / 4);
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw Acquisition Markers
    acquisitionPoints.forEach(pt => {
      if (pt.time >= startDrawTime && pt.time <= currentTime) {
        const x = ((pt.time - startDrawTime) / visibleWindow) * w;
        const isDiastole = pt.phase === 'Diastole';
        ctx.fillStyle = gatingType === 'prospective'
          ? 'rgba(255, 255, 0, 0.5)' // Yellow for Beam On
          : (isDiastole ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'); // Green/Red for tagging

        ctx.fillRect(x - 2, 0, 4, h);
      }
    });

  }, [ecgData, currentTime, acquisitionPoints, gatingType]);

  const toggleScan = () => {
    if (isScanning) {
      setIsScanning(false);
    } else {
      setAcquisitionPoints([]);
      setCurrentTime(0);
      setIsScanning(true);
    }
  };

  return (
    <SimulatorContainer
      title="心脏门控模拟器 (Cardiac Gating)"
      description="比较不同心率下的前瞻性门控与回顾性门控模式。"
      enableLiquidEffect={false}
    >
      <div className="space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="门控模式 (Mode)"
            options={gatingTypes.map(t => ({ value: t.id, label: t.name }))}
            value={gatingType}
            onChange={(e) => setGatingType(e.target.value)}
          />
          <Slider
            label={`心率 (Heart Rate): ${heartRate} BPM`}
            min={40}
            max={120}
            step={1}
            value={heartRate}
            onChange={(e) => setHeartRate(Number(e.target.value))}
          />
        </div>

        {/* Visuals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ECG Monitor */}
          <div className="md:col-span-2 bg-black rounded-lg border border-border-100 p-2 relative h-48">
            <div className="absolute top-2 right-2 text-xs text-green-500 font-mono">心电监护 (ECG MONITOR)</div>
            <canvas ref={canvasRef} width={600} height={200} className="w-full h-full" />
          </div>

          {/* Heart Status */}
          <div className="bg-bg-200 rounded-lg p-6 flex flex-col items-center justify-center space-y-4">
            <motion.div
              style={{ scale: heartScale, opacity: heartOpacity }}
              className="text-6xl"
            >
              ❤️
            </motion.div>
            <div className="text-center">
              <div className="text-2xl font-bold text-text-100">{heartRate}</div>
              <div className="text-xs text-text-300">BPM</div>
            </div>
            <Button onClick={toggleScan} variant={isScanning ? 'danger' : 'primary'} className="w-full">
              {isScanning ? '停止采集 (Stop)' : '开始采集 (Start)'}
            </Button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-bg-200 p-4 rounded-lg text-sm text-text-200">
          <h4 className="font-semibold text-text-100 mb-2">技术指南 (Guide)</h4>
          {gatingType === 'prospective' ? (
            <p>
              <strong>步进扫描 (Step & Shoot):</strong> X射线仅在舒张期开启（黄色条）。
              <br />剂量低，但需要稳定且较低的心率（&lt;65 BPM）以保证图像质量。
            </p>
          ) : (
            <p>
              <strong>螺旋回顾性扫描 (Helical):</strong> X射线连续开启。数据标记有ECG相位。
              <br />剂量较高。允许在任意相位（收缩期/舒张期）重建以观察运动或选择最佳静止期。
            </p>
          )}
        </div>

      </div>
    </SimulatorContainer>
  );
};

export default CardiacGatingSimulator;