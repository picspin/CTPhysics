'use client';

import React, { useState, useEffect, useRef } from 'react';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { useLanguage } from '@/context/LanguageContext';

const BeamHardeningSimulator: React.FC = () => {
    const { t, language } = useLanguage();
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
        ctx.fillText(t('bh_axis_energy'), w / 2, h - 10);
        ctx.fillText(t('bh_axis_intensity'), 10, h / 2);
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
        ctx.textAlign = 'center';
        ctx.fillText(t('bh_mean_energy', { a: meanIn.toFixed(1), b: meanOut.toFixed(1) }), (xIn + xOut) / 2, p / 2 - 10);
        ctx.fillText(t('bh_label_hardening'), (xIn + xOut) / 2, p / 2 + 15);
        ctx.textAlign = 'start';

    // `language` is a dependency so canvas-baked text re-renders on toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params, language]);


    return (
        <SimulatorContainer
            title={t('bh_title')}
            description={t('bh_desc')}
            enableLiquidEffect={false}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Controls */}
                <div className="space-y-6">
                    <Card title={t('bh_card_beam')} className="bg-bg-200 border-none">
                        <div className="space-y-4 p-2">
                            <Slider
                                label={t('bh_kvp')}
                                value={params.kv} min={60} max={140} step={10}
                                onChange={(e) => setParams({ ...params, kv: Number(e.target.value) })}
                            />
                            <Slider
                                label={t('bh_filter')}
                                value={params.filtration} min={0} max={5} step={0.5}
                                onChange={(e) => setParams({ ...params, filtration: Number(e.target.value) })}
                            />
                        </div>
                    </Card>

                    <Card title={t('bh_card_att')} className="bg-bg-200 border-none">
                        <div className="space-y-4 p-2">
                            <Select
                                label={t('bh_material')}
                                value={params.material}
                                options={[
                                    { value: 'water', label: t('bh_mat_water') },
                                    { value: 'bone', label: t('bh_mat_bone') },
                                    { value: 'iodine', label: t('bh_mat_iodine') }
                                ]}
                                onChange={(e) => setParams({ ...params, material: e.target.value })}
                            />
                            <Slider
                                label={t('bh_thickness')}
                                value={params.thickness} min={5} max={40} step={1}
                                onChange={(e) => setParams({ ...params, thickness: Number(e.target.value) })}
                            />
                        </div>
                    </Card>
                </div>

                {/* Visualization */}
                <div className="md:col-span-2 bg-black rounded-lg border border-border-100 p-4 relative">
                    <div className="absolute top-2 right-2 flex flex-col text-xs space-y-1">
                        <div className="flex items-center"><span className="w-3 h-3 bg-blue-500 mr-2 rounded-full"></span> {t('bh_in')}</div>
                        <div className="flex items-center"><span className="w-3 h-3 bg-orange-500 mr-2 rounded-full"></span> {t('bh_out')}</div>
                    </div>
                    <canvas ref={canvasRef} width={600} height={350} className="w-full h-full" />
                </div>

            </div>

            <div className="mt-4 bg-bg-200 p-4 rounded-lg text-sm text-text-200">
                <h4 className="font-semibold text-text-100">{t('bh_note_title')}</h4>
                <p>
                    {t('bh_note')}
                </p>
            </div>

        </SimulatorContainer>
    );
};

export default BeamHardeningSimulator;
