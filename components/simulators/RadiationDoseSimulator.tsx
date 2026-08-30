'use client';

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import {
  BodyModelViewer,
  computeAllRegionDoses,
} from '@/components/dose/BodyModelViewer';
import { RegionDetailPanel } from '@/components/dose/RegionDetailPanel';
import { BodyRegionId } from '@/utils/dose-physics';

// ---------------------------------------------------------------------------
// RadiationDoseSimulator — the original abstract bar-chart simulator,
// extended with the new interactive 3D body model so this file is no
// longer dead code. The legacy gatingType/patientSize bar chart is
// preserved as a quick "protocol-level" comparison; the 3D body model
// provides the per-region teaching surface.
// ---------------------------------------------------------------------------

const RadiationDoseSimulator: React.FC = () => {
  const [gatingType, setGatingType] = useState('prospective');
  const [patientSize, setPatientSize] = useState('medium');
  const [mAs, setMAs] = useState(200);
  const [kVp, setKVp] = useState(120);
  const [selectedRegion, setSelectedRegion] = useState<BodyRegionId | null>('cardiothoracic');
  const [bodyScale, setBodyScale] = useState(1.0);

  const gatingTypes = [
    { id: 'prospective', name: '前瞻性门控' },
    { id: 'retrospective', name: '回顾性门控' },
    { id: 'retrospective-modulation', name: '带ECG调制的回顾性门控' },
  ];

  const patientSizes = [
    { id: 'small', name: '小型患者', dw: 16, scale: 0.7 },
    { id: 'medium', name: '中型患者', dw: 32, scale: 1.0 },
    { id: 'large', name: '大型患者', dw: 42, scale: 1.35 },
  ];

  // Bar chart data — abstract protocol comparison.
  const chartData = useMemo(() => {
    const baseDose: Record<string, number> = {
      'prospective': 3,
      'retrospective-modulation': 8,
      'retrospective': 15,
    };
    const sizeFactors: Record<string, number> = {
      'small': 0.7,
      'medium': 1.0,
      'large': 1.5,
    };
    return [
      { name: '前瞻性', dose: baseDose['prospective'] * sizeFactors[patientSize], active: gatingType === 'prospective' },
      { name: '回顾性(调制)', dose: baseDose['retrospective-modulation'] * sizeFactors[patientSize], active: gatingType === 'retrospective-modulation' },
      { name: '回顾性', dose: baseDose['retrospective'] * sizeFactors[patientSize], active: gatingType === 'retrospective' },
    ];
  }, [gatingType, patientSize]);

  // Per-region doses — drives the body-model colour map.
  const effectiveDiameter = bodyScale * 32;
  const { perRegionDose } = useMemo(
    () =>
      computeAllRegionDoses({
        mAs,
        kVp,
        pitch: 1.0,
        waterEquivalentDiameterCm: effectiveDiameter,
        scanLengthByRegion: {},
      }),
    [mAs, kVp, effectiveDiameter],
  );

  const currentDose = chartData.find((item) => item.active)?.dose ?? 0;

  return (
    <SimulatorContainer title="辐射剂量模拟器 · Radiation Dose Simulator">
      {/* Protocol controls */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select
          label="门控类型"
          options={gatingTypes.map((g) => ({ value: g.id, label: g.name }))}
          value={gatingType}
          onChange={(e) => setGatingType(e.target.value)}
        />
        <Select
          label="患者大小"
          options={patientSizes.map((p) => ({ value: p.id, label: p.name }))}
          value={patientSize}
          onChange={(e) => {
            setPatientSize(e.target.value);
            const m = patientSizes.find((x) => x.id === e.target.value);
            if (m) setBodyScale(m.scale);
          }}
        />
        <div className="md:col-span-2">
          <Slider
            label="管电流 (mAs)"
            min={50}
            max={500}
            step={10}
            value={mAs}
            onChange={(e) => setMAs(Number(e.target.value))}
            valueDisplay={`${mAs} mAs @ ${kVp} kVp`}
          />
        </div>
        <div className="md:col-span-2">
          <Slider
            label="管电压 (kVp)"
            min={80}
            max={140}
            step={10}
            value={kVp}
            onChange={(e) => setKVp(Number(e.target.value))}
            valueDisplay={`${kVp} kVp`}
          />
        </div>
      </div>

      {/* Legacy abstract bar chart */}
      <div className="rounded-md border border-border bg-bg-100 p-4 mb-4">
        <div className="mb-2 text-sm font-medium text-text-100">
          协议级有效剂量比较 · Abstract protocol comparison (mSv)
        </div>
        <div className="h-64 w-full md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: '有效剂量 (mSv)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(v: number | string | Array<number | string>) => {
                const x = Array.isArray(v) ? v[0] : v;
                return [typeof x === 'number' ? `${x.toFixed(1)} mSv` : String(x), '有效剂量'];
              }} />
              <Legend />
              <Bar dataKey="dose" name="有效剂量" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.active ? '#FF8C00' : '#cccccc'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* NEW: 3D body + region detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div
          className="lg:col-span-3 rounded-md overflow-hidden border border-border bg-bg-100"
          style={{ minHeight: 480 }}
        >
          <BodyModelViewer
            selectedRegion={selectedRegion}
            onRegionSelect={setSelectedRegion}
            bodyScale={bodyScale}
            regionDoseMSv={perRegionDose}
          />
        </div>
        <div className="lg:col-span-2">
          <RegionDetailPanel
            region={selectedRegion}
            mAs={mAs}
            kVp={kVp}
            pitch={1.0}
            scanLengthCm={selectedRegion ? 30 : 30}
            waterEquivalentDiameterCm={effectiveDiameter}
          />
        </div>
      </div>

      {/* Risk assessment panel — kept from original */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="rounded-md border border-border bg-bg-100 p-4">
          <h3 className="mb-2 text-sm font-medium text-text-100">剂量比较</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-200">胸部X光片</span>
              <span className="font-medium text-text-100">0.1 mSv</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-200">常规胸部CT</span>
              <span className="font-medium text-text-100">7 mSv</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-200">当前心脏CT设置</span>
              <span className="font-medium text-primary-100">{currentDose.toFixed(1)} mSv</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-200">年自然背景辐射</span>
              <span className="font-medium text-text-100">3 mSv</span>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-border bg-bg-100 p-4">
          <h3 className="mb-2 text-sm font-medium text-text-100">风险评估</h3>
          <div className="space-y-2">
            {(() => {
              const v = currentDose;
              const riskLevel = v < 5 ? '低' : v < 10 ? '中' : '高';
              const riskText =
                v < 5
                  ? '相当于约1.5年的自然背景辐射'
                  : v < 10
                  ? '相当于约3年的自然背景辐射'
                  : '相当于约4年的自然背景辐射';
              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-200">风险等级</span>
                    <span
                      className={`font-medium ${
                        riskLevel === '低' ? 'text-green-500' : riskLevel === '中' ? 'text-amber-500' : 'text-red-500'
                      }`}
                    >
                      {riskLevel}
                    </span>
                  </div>
                  <div className="text-sm text-text-200">
                    <p>{riskText}</p>
                    <p className="mt-2">辐射剂量应遵循ALARA原则：合理可行尽量低 (As Low As Reasonably Achievable)</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <h3 className="mb-2 font-medium text-text-100">说明</h3>
        <p>此模拟器展示了不同心脏CT扫描协议的辐射剂量比较：</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <span className="font-medium">前瞻性门控</span>：辐射剂量最低，但不能评估心脏功能
          </li>
          <li>
            <span className="font-medium">带ECG调制的回顾性门控</span>：在心动周期的非关键阶段降低管电流，减少辐射剂量
          </li>
          <li>
            <span className="font-medium">回顾性门控</span>：辐射剂量最高，但可以评估心脏功能
          </li>
        </ul>
        <p className="mt-2">患者大小也会影响辐射剂量，较大的患者需要更高的辐射剂量才能获得相同质量的图像。</p>
      </div>
    </SimulatorContainer>
  );
};

export default RadiationDoseSimulator;
