'use client';

import React, { useState, useEffect, useRef } from 'react';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';

const BeamHardeningSimulator: React.FC = () => {
    const [params, setParams] = useState({
        material: 'bone',
        thickness: 20, // cm
        kv: 120, // kVp
        filtration: 2.5 // mm Al
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Physics Helpers (Simplified for visualization)
    // Spectrum Generation
    const generateSpectrum = (kv: number, filtration: number) => {
        const bins = 100;
        const spectrum: { energy: number; intensity: number }[] = [];
        // const meanEnergy = kv * 0.4; // Rough Approx (Removed unused)

        for (let e = 10; e <= kv; e += (kv - 10) / bins) {
            // Kramer's Law approx: I(E) ~ K * Z * (E_max - E)
            // Then applying filtration attenuation: I_out = I_in * exp(-mu * x)
            let intensity = (kv - e);

            // Filtration (Aluminum)
            // Mu for Al approx: mu(E) ~ E^-3
            const muAl = 1000 * Math.pow(e, -3);
            intensity *= Math.exp(-muAl * filtration);

            if (intensity < 0) intensity = 0;

            spectrum.push({ energy: e, intensity });
        }
        return spectrum;
    };

    // Material Attenuation
    const getMaterialMu = (energy: number, material: string) => {
        // Very rough approximations for demo
        // Water: ~ Z=7.4
        // Bone: ~ Z=13.8, denser
        if (material === 'water') return 3000 * Math.pow(energy, -3.2) + 0.15; // Photoelectric + Compton
        if (material === 'bone') return 15000 * Math.pow(energy, -3.2) + 0.25;
        if (material === 'iodine') return 40000 * Math.pow(energy, -3) * (energy > 33 ? 4 : 1) + 0.1; // K-edge at 33
        return 0;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const p = 40; // padding

        // 1. Calculate Spectra
        // Initial Spectrum (I0)
        const spectrumIn = generateSpectrum(params.kv, params.filtration);

        // Attenuated Spectrum (I)
        const spectrumOut = spectrumIn.map(pt => {
            const mu = getMaterialMu(pt.energy, params.material);
            const transmitted = pt.intensity * Math.exp(-mu * (params.thickness / 10)); // thick in cm, mu in 1/cm approx scale
            return { energy: pt.energy, intensity: transmitted };
        });

        // Normalize for display
        const maxI = Math.max(...spectrumIn.map(s => s.intensity));

        // Stats
        const calcMean = (spec: { energy: number, intensity: number }[]) => {
            let sumI = 0;
            let sumIE = 0;
            spec.forEach(s => { sumI += s.intensity; sumIE += (s.intensity * s.energy); });
            return sumI > 0 ? sumIE / sumI : 0;
        };

        const meanIn = calcMean(spectrumIn);
        const meanOut = calcMean(spectrumOut);

        // Clear
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);

        // Axes
        ctx.strokeStyle = '#444';
        ctx.beginPath();
        ctx.moveTo(p, p); ctx.lineTo(p, h - p); ctx.lineTo(w - p, h - p);
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#888';
        ctx.font = '10px Roboto';
        ctx.fillText('0', p - 10, h - p + 10);
        ctx.fillText('能量 Energy (keV)', w / 2, h - 10);
        ctx.fillText('强度 Intensity', 10, h / 2);
        ctx.fillText(`${params.kv}`, w - p, h - p + 10);

        // Draw Graphs
        const drawGraph = (spec: typeof spectrumIn, color: string, fill: boolean) => {
            ctx.beginPath();
            spec.forEach((pt, i) => {
                const x = p + ((pt.energy) / 150) * (w - 2 * p); // Max 150 keV display range
                const y = (h - p) - (pt.intensity / maxI) * (h - 2 * p);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });

            if (fill) {
                ctx.lineTo(p + ((spec[spec.length - 1].energy) / 150) * (w - 2 * p), h - p);
                ctx.lineTo(p + ((spec[0].energy) / 150) * (w - 2 * p), h - p);
                ctx.fillStyle = color + '44'; // transparent
                ctx.fill();
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        };

        drawGraph(spectrumIn, '#4488ff', true); // Blue I0
        drawGraph(spectrumOut, '#ffaa00', true); // Orange I_out

        // Annotations - Mean Energy Shift
        const xIn = p + (meanIn / 150) * (w - 2 * p);
        const xOut = p + (meanOut / 150) * (w - 2 * p);

        // Arrow showing hardening
        ctx.beginPath();
        ctx.moveTo(xIn, p / 2);
        ctx.lineTo(xOut, p / 2);
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(xOut, p / 2);
        ctx.lineTo(xOut - 5, p / 2 - 3);
        ctx.lineTo(xOut - 5, p / 2 + 3);
        ctx.fillStyle = '#fff';
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.fillText(`平均能量: ${meanIn.toFixed(1)} -> ${meanOut.toFixed(1)} keV`, (xIn + xOut) / 2 - 30, p / 2 - 10);
        ctx.fillText('束硬化 (Beam Hardening)', (xIn + xOut) / 2 - 25, p / 2 + 15);

    }, [params]);


    return (
        <SimulatorContainer
            title="束硬化模拟器 (Beam Hardening)"
            description="可视化多色X射线束在穿过物体时平均能量如何增加。"
            enableLiquidEffect={false}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Controls */}
                <div className="space-y-6">
                    <Card title="射线参数 (Beam Params)" className="bg-bg-200 border-none">
                        <div className="space-y-4 p-2">
                            <Slider
                                label="管电压 (Tube Voltage) [kVp]"
                                value={params.kv} min={60} max={140} step={10}
                                onChange={(e) => setParams({ ...params, kv: Number(e.target.value) })}
                            />
                            <Slider
                                label="固有过滤 (Filter) [mm Al]"
                                value={params.filtration} min={0} max={5} step={0.5}
                                onChange={(e) => setParams({ ...params, filtration: Number(e.target.value) })}
                            />
                        </div>
                    </Card>

                    <Card title="衰减体 (Attenuator)" className="bg-bg-200 border-none">
                        <div className="space-y-4 p-2">
                            <Select
                                label="材料 (Material)"
                                value={params.material}
                                options={[
                                    { value: 'water', label: '水 / 软组织 (Water)' },
                                    { value: 'bone', label: '骨骼 (Bone/Ca)' },
                                    { value: 'iodine', label: '碘对比剂 (Iodine)' }
                                ]}
                                onChange={(e) => setParams({ ...params, material: e.target.value })}
                            />
                            <Slider
                                label="厚度 (Thickness) [cm]"
                                value={params.thickness} min={5} max={40} step={1}
                                onChange={(e) => setParams({ ...params, thickness: Number(e.target.value) })}
                            />
                        </div>
                    </Card>
                </div>

                {/* Visualization */}
                <div className="md:col-span-2 bg-black rounded-lg border border-border-100 p-4 relative">
                    <div className="absolute top-2 right-2 flex flex-col text-xs space-y-1">
                        <div className="flex items-center"><span className="w-3 h-3 bg-blue-500 mr-2 rounded-full"></span> 入射能谱 (Input)</div>
                        <div className="flex items-center"><span className="w-3 h-3 bg-orange-500 mr-2 rounded-full"></span> 出射能谱 (Output)</div>
                    </div>
                    <canvas ref={canvasRef} width={600} height={350} className="w-full h-full" />
                </div>

            </div>

            <div className="mt-4 bg-bg-200 p-4 rounded-lg text-sm text-text-200">
                <h4 className="font-semibold text-text-100">物理原理 (Physics Note)</h4>
                <p>
                    低能光子比高能光子更容易被衰减（光电效应与 1/E³ 成正比）。
                    因此，当射线穿过物体时，“软”射线被滤除，留下“硬”（平均能量更高）的射线。
                    这会导致杯状伪影 (Cupping) 或条状伪影 (Streaks)。
                </p>
            </div>

        </SimulatorContainer>
    );
};

export default BeamHardeningSimulator;
