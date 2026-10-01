'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { useLanguage, type MessageKey } from '@/context/LanguageContext';

const XrayAttenuationSimulator = () => {
    const { t } = useLanguage();
    const [selectedTissue, setSelectedTissue] = useState('soft_tissue');
    const [iodineConcentration, setIodineConcentration] = useState(5);
    interface ChartData {
        energy: number;
        soft_tissue: number;
        fat: number;
        bone: number;
        iodine: number;
        iodine_enhanced: number;
        water: number;
        air: number;
        [key: string]: number; // Allow index signature for dynamic access
    }

    const [chartData, setChartData] = useState<ChartData[]>([]);

    const tissues: { id: string; name: string }[] = ([
        ['soft_tissue', 'att_tissue_soft_tissue'],
        ['fat', 'att_tissue_fat'],
        ['bone', 'att_tissue_bone'],
        ['iodine', 'att_tissue_iodine'],
        ['iodine_enhanced', 'att_tissue_iodine_enhanced'],
        ['water', 'att_tissue_water'],
        ['air', 'att_tissue_air'],
    ] as [string, MessageKey][]).map(([id, key]) => ({ id, name: t(key) }));

    // Attenuation coefficient of each material vs. energy (simulated data)
    const calculateAttenuation = (tissue: string, energy: number, concentration = 5) => {
        // Illustrative values only; real applications must use measured physical data
        const baseValues: Record<string, number> = {
            soft_tissue: 0.3,
            fat: 0.2,
            bone: 0.7,
            iodine: 1.5,
            iodine_enhanced: 0.4,
            water: 0.25,
            air: 0.01
        };

        // Model the energy dependence of the photoelectric effect, (Z/E)^3
        let attenuation = baseValues[tissue] * Math.pow(80 / energy, 2.5);

        // Add the iodine K-edge (33 keV)
        if ((tissue === 'iodine' || tissue === 'iodine_enhanced') && energy >= 33 && energy < 40) {
            attenuation *= 2.5 - (energy - 33) * 0.2; // falls off quickly above the K-edge
        }

        // Add concentration dependence for iodine contrast
        if (tissue === 'iodine') {
            attenuation *= concentration / 5;
        } else if (tissue === 'iodine_enhanced') {
            // Iodine-enhanced organ = soft tissue + iodine contribution
            attenuation = baseValues.soft_tissue * Math.pow(80 / energy, 2.5) +
                (concentration / 10) * baseValues.iodine * Math.pow(80 / energy, 2.5);

            if (energy >= 33 && energy < 40) {
                attenuation += (concentration / 10) * baseValues.iodine * (2.5 - (energy - 33) * 0.2);
            }
        }

        return attenuation;
    };

    // Generate the simulated data
    useEffect(() => {
        const generateData = () => {
            const data = [];
            // Generate data points from 20 to 140 keV
            for (let energy = 20; energy <= 140; energy += 5) {
                const dataPoint = {
                    energy,
                    soft_tissue: calculateAttenuation('soft_tissue', energy),
                    fat: calculateAttenuation('fat', energy),
                    bone: calculateAttenuation('bone', energy),
                    iodine: calculateAttenuation('iodine', energy, iodineConcentration),
                    iodine_enhanced: calculateAttenuation('iodine_enhanced', energy, iodineConcentration),
                    water: calculateAttenuation('water', energy),
                    air: calculateAttenuation('air', energy)
                };
                data.push(dataPoint);
            }
            setChartData(data);
        };

        generateData();
    }, [iodineConcentration]);

    // Line colour used in the chart
    const getLineColor = (tissue: string) => {
        const colors: Record<string, string> = {
            soft_tissue: '#FF8C00', // theme colour
            fat: '#FFC107',
            bone: '#795548',
            iodine: '#4A90E2', // accent colour
            iodine_enhanced: '#003a80',
            water: '#00BCD4',
            air: '#9E9E9E'
        };
        return colors[tissue] || '#000000';
    };

    return (
        <SimulatorContainer title={t('att_title')}>
            <div className="mb-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Select
                        label={t('att_tissue_select')}
                        options={tissues.map(x => ({ value: x.id, label: x.name }))}
                        value={selectedTissue}
                        onChange={(e) => setSelectedTissue(e.target.value)}
                    />

                    {(selectedTissue === 'iodine' || selectedTissue === 'iodine_enhanced') && (
                        <Slider
                            label={t('att_iodine_conc')}
                            min={1}
                            max={10}
                            value={iodineConcentration}
                            onChange={(e) => setIodineConcentration(Number(e.target.value))}
                            step={1}
                        />
                    )}
                </div>

                <div className="rounded-md border border-border bg-bg-100 p-3 sm:p-4">
                    <div className="mb-2 text-sm font-medium text-text-100">{t('att_chart_title')}</div>
                    <div className="h-64 w-full md:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={chartData}
                                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="energy"
                                    label={{ value: t('att_axis_x'), position: 'insideBottomRight', offset: -10 }}
                                />
                                <YAxis
                                    label={{ value: t('att_axis_y'), angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip formatter={(value: number) => [value.toFixed(2), t('att_tooltip')]} />
                                <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ paddingTop: 10 }} />
                                {tissues.map(tissue => (
                                    <Line
                                        key={tissue.id}
                                        type="monotone"
                                        dataKey={tissue.id}
                                        name={tissue.name}
                                        stroke={getLineColor(tissue.id)}
                                        dot={false}
                                        strokeWidth={selectedTissue === tissue.id ? 3 : 1}
                                        opacity={selectedTissue === tissue.id || selectedTissue === 'all' ? 1 : 0.3}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="rounded-md bg-bg-200 p-3 text-sm text-text-200 sm:p-4">
                <h3 className="mb-2 font-medium text-text-100">{t('att_note_title')}</h3>
                <p>{t('att_note_1')}</p>
                <p className="mt-2">{t('att_note_2')}</p>
            </div>
        </SimulatorContainer>
    );
};

export default XrayAttenuationSimulator;
