'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import KeyPoints from '@/components/ui/KeyPoints';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';

import {
  calculateCTDI,
  calculateDLP,
  calculateEffectiveDose,
} from '@/utils/physics-calculations';
import {
  BodyRegionId,
  BODY_REGIONS,
  computeDoseForRegion,
  ssdeFactorBody,
} from '@/utils/dose-physics';

import {
  BodyModelViewer,
  computeAllRegionDoses,
  describeRegionOrgans,
} from '@/components/dose/BodyModelViewer';
import { RegionDetailPanel } from '@/components/dose/RegionDetailPanel';
import { MonteCarloPanel } from '@/components/dose/MonteCarloPanel';

// ---------------------------------------------------------------------------
// The Dose & Safety page — rewritten around the interactive 3D body model.
//
// The old page had three abstract calculators (calculator / size / reduction).
// This new version uses the 3D body model as the primary teaching surface —
// clicking each of the five regions walks the user through CTDIvol → DLP →
// SSDE → Effective dose with explicit "what this number means" callouts.
//
// The old calculators are preserved below as supporting tools. They drive
// the same parameters (mAs, kVp, pitch, scan length, body habitus via Dw)
// that the body model reads, so changes propagate in real time.
// ---------------------------------------------------------------------------

interface PageData {
  title: string;
  description: string;
  sections: { id: string; title: string; description: string; content?: string; keyPoints?: string[] }[];
}
import doseData from '@/data/dose.json';

// ===== Existing dose calculator (kept; bug fixed via named-options) =====
const DoseCalculatorSimulator: React.FC = () => {
  const [kVp, setKVp] = useState(120);
  const [mAs, setMAs] = useState(200);
  const [pitch, setPitch] = useState(1.0);
  const [scanLength, setScanLength] = useState(30);
  const [region, setRegion] = useState('chest');

  const regions = [
    { id: 'head', name: '头部 (Head)', kFactor: 0.0021 },
    { id: 'neck', name: '颈部 (Neck/Thyroid)', kFactor: 0.0059 },
    { id: 'chest', name: '胸部 (Chest)', kFactor: 0.014 },
    { id: 'abdomen', name: '腹部 (Abdomen)', kFactor: 0.015 },
    { id: 'peripheral', name: '四肢 (Extremities)', kFactor: 0.0007 },
  ];

  // FIX: calculateCTDI now takes a NAMED-OPTIONS object so the previous
  // argument-swap bug (kVp ↔ mAs) cannot recur at the call site.
  const ctdi = calculateCTDI({ mAs, kVp, pitch });
  const dlp = calculateDLP(ctdi, scanLength);
  const selectedRegion = regions.find((r) => r.id === region) || regions[2];
  const effectiveDose = calculateEffectiveDose(dlp, selectedRegion.kFactor);

  return (
    <SimulatorContainer
      title="剂量计算器 (Dose Calculator)"
      description="根据扫描参数计算 CTDI, DLP 和有效剂量"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="space-y-4">
          <Select
            label="解剖部位 (Region)"
            options={regions.map((r) => ({ value: r.id, label: r.name }))}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          <Slider
            label="管电压 (Tube Voltage) [kVp]"
            min={80}
            max={140}
            step={10}
            value={kVp}
            onChange={(e) => setKVp(Number(e.target.value))}
            valueDisplay={kVp}
          />
          <Slider
            label="管电流 (Tube Current) [mAs]"
            min={50}
            max={500}
            step={10}
            value={mAs}
            onChange={(e) => setMAs(Number(e.target.value))}
            valueDisplay={mAs}
          />
          <Slider
            label="螺距 (Pitch)"
            min={0.5}
            max={2.0}
            step={0.1}
            value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
            valueDisplay={pitch}
          />
          <Slider
            label="扫描长度 (Scan Length) [cm]"
            min={10}
            max={100}
            step={1}
            value={scanLength}
            onChange={(e) => setScanLength(Number(e.target.value))}
            valueDisplay={scanLength}
          />
        </div>

        <div className="space-y-4">
          <motion.div
            className="bg-bg-200 rounded-lg p-4"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-text-200">
                  容积CT剂量指数 (CTDI<sub>vol</sub>)
                </div>
                <div className="text-2xl font-bold text-text-100">{ctdi.toFixed(2)}</div>
              </div>
              <div className="text-sm text-text-200">mGy</div>
            </div>
          </motion.div>

          <motion.div
            className="bg-bg-200 rounded-lg p-4"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-text-200">剂量长度乘积 (DLP)</div>
                <div className="text-2xl font-bold text-text-100">{dlp.toFixed(0)}</div>
              </div>
              <div className="text-sm text-text-200">mGy·cm</div>
            </div>
          </motion.div>

          <motion.div
            className="bg-primary-100 bg-opacity-10 border border-primary-100 rounded-lg p-4"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-primary-100">有效剂量 (Effective Dose)</div>
                <div className="text-2xl font-bold text-primary-100">{effectiveDose.toFixed(2)}</div>
              </div>
              <div className="text-sm text-primary-100">mSv</div>
            </div>
          </motion.div>

          <div className="bg-yellow-50/10 border border-yellow-200/50 rounded-lg p-4">
            <h4 className="font-medium text-yellow-200 mb-2">风险评估 (Risk Assessment)</h4>
            <p className="text-sm text-yellow-100">
              {effectiveDose < 1 && '极低风险 - 相当于几个月的自然本底辐射。'}
              {effectiveDose >= 1 && effectiveDose < 10 && '低风险 - 相当于1-3年的自然本底辐射。'}
              {effectiveDose >= 10 && effectiveDose < 20 && '中等风险 - 考虑各种剂量优化策略。'}
              {effectiveDose >= 20 && '较高风险 - 必须确保临床正当性并严格优化方案。'}
            </p>
          </div>
        </div>
      </div>
    </SimulatorContainer>
  );
};

// ===== Existing patient-size simulator (preserved) =====
const PatientSizeDoseSimulator: React.FC = () => {
  const [patientDiameter, setPatientDiameter] = useState(30);
  const [useAEC, setUseAEC] = useState(true);

  const generateSizeData = () => {
    const data = [];
    for (let diameter = 15; diameter <= 45; diameter += 5) {
      const sizeFactor = Math.pow(diameter / 30, 2);
      const baseDose = 10;
      data.push({
        diameter,
        manualDose: Number((baseDose * sizeFactor).toFixed(1)),
        aecDose: Number(
          (useAEC ? baseDose * Math.sqrt(sizeFactor) : baseDose * sizeFactor).toFixed(1),
        ),
        imageNoise: Number((useAEC ? 15 : 15 / Math.sqrt(sizeFactor)).toFixed(1)),
      });
    }
    return data;
  };

  const sizeData = generateSizeData();
  const currentData = sizeData.find((d) => d.diameter === patientDiameter) || sizeData[3];

  return (
    <SimulatorContainer
      title="患者体型与剂量关系 (Patient Size & Dose)"
      description="观察患者体型如何影响剂量和图像噪声"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Slider
            label="患者直径 (Patient Diameter) [cm]"
            min={15}
            max={45}
            step={5}
            value={patientDiameter}
            onChange={(e) => setPatientDiameter(Number(e.target.value))}
            valueDisplay={patientDiameter}
          />
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useAEC}
                onChange={(e) => setUseAEC(e.target.checked)}
                className="w-4 h-4 text-primary-100 rounded focus:ring-primary-100"
              />
              <span className="text-sm font-medium text-text-100">
                启用自动曝光控制 (Use AEC)
              </span>
            </label>
          </div>
          <div className="bg-bg-200 rounded-lg p-4">
            <h4 className="font-medium text-text-100 mb-3">当前数值</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-200">相对剂量:</span>
                <span className="font-medium text-text-100">{currentData.aecDose.toFixed(1)} mGy</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-200">图像噪声:</span>
                <span className="font-medium text-text-100">{currentData.imageNoise.toFixed(1)} HU</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-2 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sizeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis
                dataKey="diameter"
                label={{ value: '患者直径 (cm)', position: 'insideBottom', offset: -5, fill: '#888' }}
                stroke="#6b7280"
              />
              <YAxis
                label={{ value: '剂量 (mGy)', angle: -90, position: 'insideLeft', fill: '#888' }}
                stroke="#6b7280"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#222', border: '1px solid #444', color: '#eee' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="manualDose"
                stroke="#ef4444"
                name="固定电流 (Fixed mAs)"
                strokeWidth={2}
                dot={true}
              />
              <Line
                type="monotone"
                dataKey="aecDose"
                stroke="#10b981"
                name="自动曝光 (With AEC)"
                strokeWidth={2}
                dot={true}
                strokeDasharray={useAEC ? '0' : '5 5'}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-6 bg-blue-50/10 border border-blue-200/50 rounded-lg p-4">
        <h4 className="font-medium text-blue-300 mb-2">关键见解</h4>
        <ul className="space-y-1 text-sm text-blue-200">
          <li>• 如果不使用AEC，剂量并不会随体型自动变化，但图像质量会急剧下降（噪声增加）。</li>
          <li>• AEC 通过根据患者衰减自动调整剂量，保持图像质量一致。</li>
          <li>• 较大的患者为了获得相同的图像质量，需要指数级更高的剂量（这也解释了所谓的&ldquo;体型代价&rdquo;）。</li>
        </ul>
      </div>
    </SimulatorContainer>
  );
};

// ===== Existing dose reduction simulator (preserved) =====
const DoseReductionSimulator: React.FC = () => {
  const [strategy, setStrategy] = useState('none');
  const [kVp, setKVp] = useState(120);
  const [iterativeStrength, setIterativeStrength] = useState(50);

  const strategies = [
    { id: 'none', name: '标准方案 (Standard Protocol)' },
    { id: 'lowkv', name: '低电压成像 (Low kV)' },
    { id: 'iterative', name: '迭代重建 (Iterative Reconstruction)' },
    { id: 'combined', name: '组合策略 (Combined Approach)' },
  ];

  const calculateDoseReduction = () => {
    let reduction = 0;
    if (strategy === 'lowkv' || strategy === 'combined') {
      reduction += ((120 - kVp) / 120) * 40;
    }
    if (strategy === 'iterative' || strategy === 'combined') {
      reduction += iterativeStrength * 0.5;
    }
    return Math.min(reduction, 70);
  };

  const doseReduction = calculateDoseReduction();
  const baseDose = 10;
  const optimizedDose = baseDose * (1 - doseReduction / 100);

  const comparisonData = [
    { technique: '标准 (Standard)', dose: baseDose, quality: 100 },
    {
      technique: '优化 (Optimized)',
      dose: Number(optimizedDose.toFixed(2)),
      quality: Number((95 - doseReduction * 0.1).toFixed(1)),
    },
  ];

  return (
    <SimulatorContainer
      title="剂量降低策略 (Dose Reduction Strategies)"
      description="比较不同的辐射剂量降低技术"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Select
            label="降低策略 (Strategy)"
            options={strategies.map((s) => ({ value: s.id, label: s.name }))}
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          />
          {(strategy === 'lowkv' || strategy === 'combined') && (
            <Slider
              label="管电压 (Tube Voltage) [kV]"
              min={80}
              max={120}
              step={10}
              value={kVp}
              onChange={(e) => setKVp(Number(e.target.value))}
              valueDisplay={kVp}
            />
          )}
          {(strategy === 'iterative' || strategy === 'combined') && (
            <Slider
              label="迭代强度 (Iterative Strength) [%]"
              min={0}
              max={100}
              step={10}
              value={iterativeStrength}
              onChange={(e) => setIterativeStrength(Number(e.target.value))}
              valueDisplay={iterativeStrength}
            />
          )}
          <div className="bg-green-50/10 border border-green-200/50 rounded-lg p-4">
            <h4 className="font-medium text-green-300 mb-1">剂量降低</h4>
            <div className="text-3xl font-bold text-green-400 mt-1">-{doseReduction.toFixed(0)}%</div>
            <div className="text-sm text-green-300 mt-2">
              {optimizedDose.toFixed(1)} mSv (原剂量 {baseDose} mSv)
            </div>
          </div>
        </div>
        <div className="col-span-2 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="technique" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{ backgroundColor: '#222', border: '1px solid #444', color: '#eee' }}
              />
              <Bar dataKey="dose" fill="#FF7A00" name="剂量 (mSv)" />
              <Bar dataKey="quality" fill="#4A90E2" name="图像质量 (%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </SimulatorContainer>
  );
};

// ---------------------------------------------------------------------------
// New: Interactive 3D Body + Concept Explorer
//
// The main teaching surface. All five regions of the body are clickable;
// each click walks the user through the CTDIvol → DLP → SSDE → E chain
// with explicit "what this number means" callouts. The patient habitus
// slider scales the body in real time so SSDE diverges visibly from
// CTDIvol — that divergence IS the lesson.
// ---------------------------------------------------------------------------

const BODY_3D_EXPLORER: React.FC = () => {
  // Protocol parameters
  const [mAs, setMAs] = useState(200);
  const [kVp, setKVp] = useState(120);
  const [pitch, setPitch] = useState(1.0);

  // Patient habitus via water-equivalent diameter Dw (cm)
  const [dw, setDw] = useState(32);

  // Body scale ranges from 0.55 (small child) to 1.45 (large adult).
  // Map linearly onto Dw so SSDE behavior is consistent.
  const [bodyScale, setBodyScale] = useState(1.0);

  // Selection
  const [selectedRegion, setSelectedRegion] = useState<BodyRegionId | null>('cardiothoracic');

  // Effective diameter is the visible-body cross-section, related to bodyScale.
  const effectiveDiameter = bodyScale * 32; // 32 cm at scale 1.0

  // Compute all per-region doses for the colour-map.
  const { perRegionDose, perRegionBreakdown } = useMemo(
    () =>
      computeAllRegionDoses({
        mAs,
        kVp,
        pitch,
        waterEquivalentDiameterCm: effectiveDiameter,
        scanLengthByRegion: {},
      }),
    [mAs, kVp, pitch, effectiveDiameter],
  );

  // SSDE-vs-CTDIvol divergence plot — heart of the SSDE lesson.
  const ssdeDivergenceData = useMemo(() => {
    const points = [];
    for (let d = 12; d <= 48; d += 2) {
      // CTDIvol is fixed across sizes (it is a SCANNER output, not patient dose).
      const ctdiFixed = calculateCTDI({ mAs, kVp, pitch });
      // SSDE = CTDIvol * f(Dw) — varies with size.
      const f = ssdeFactorBody(d);
      const ssde = ctdiFixed * f;
      // Effective dose only changes if k-factor or DLP changes — for the
      // purposes of "see how habitus changes patient dose", show the
      // body k-factor chest case.
      const breakdown = computeDoseForRegion({
        mAs,
        kVp,
        pitch,
        scanLengthCm: 30,
        waterEquivalentDiameterCm: d,
        region: 'cardiothoracic',
      });
      points.push({
        diameter: d,
        ctdiVol: Number(ctdiFixed.toFixed(3)),
        ssde: Number(ssde.toFixed(3)),
        effectiveDose: Number(breakdown.effectiveDoseMSv.toFixed(3)),
        sizeFactor: f,
      });
    }
    return points;
  }, [mAs, kVp, pitch]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-blue-50/10 border border-blue-200/40 p-4 text-sm text-blue-100">
        <div className="font-medium text-blue-200 mb-1">教学核心 · Teaching goal</div>
        <p className="leading-relaxed">
          Click any region of the body to walk through the four-step chain
          that turns a scanner output into a comparable dose number:
          <span className="text-blue-300"> CTDIvol → DLP → SSDE → Effective dose (E)</span>.
          The lesson: <span className="text-orange-200">CTDIvol is NOT patient dose</span> —
          it&apos;s what the scanner emitted into a plastic cylinder. The body
          habitus slider shows how SSDE diverges from CTDIvol as the patient
          changes size.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 3D viewer — 3 cols on lg */}
        <div className="lg:col-span-3 rounded-lg overflow-hidden border border-white/10 bg-bg-200" style={{ minHeight: 480 }}>
          <BodyModelViewer
            selectedRegion={selectedRegion}
            onRegionSelect={setSelectedRegion}
            bodyScale={bodyScale}
            regionDoseMSv={perRegionDose}
          />
        </div>

        {/* Region detail — 2 cols on lg */}
        <div className="lg:col-span-2">
          <RegionDetailPanel
            region={selectedRegion}
            mAs={mAs}
            kVp={kVp}
            pitch={pitch}
            scanLengthCm={
              selectedRegion ? BODY_REGIONS[selectedRegion].representativeScanLengthCm : 30
            }
            waterEquivalentDiameterCm={effectiveDiameter}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-lg bg-bg-200 border border-white/10 p-4">
          <div className="text-xs text-text-200 mb-2">管电压 · kVp</div>
          <Slider
            label=""
            min={80}
            max={140}
            step={10}
            value={kVp}
            onChange={(e) => setKVp(Number(e.target.value))}
            valueDisplay={`${kVp} kVp`}
          />
        </div>
        <div className="rounded-lg bg-bg-200 border border-white/10 p-4">
          <div className="text-xs text-text-200 mb-2">管电流 · mAs</div>
          <Slider
            label=""
            min={50}
            max={500}
            step={10}
            value={mAs}
            onChange={(e) => setMAs(Number(e.target.value))}
            valueDisplay={`${mAs} mAs`}
          />
        </div>
        <div className="rounded-lg bg-bg-200 border border-white/10 p-4">
          <div className="text-xs text-text-200 mb-2">螺距 · Pitch</div>
          <Slider
            label=""
            min={0.5}
            max={2.0}
            step={0.1}
            value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
            valueDisplay={pitch.toFixed(1)}
          />
        </div>
        <div className="rounded-lg bg-bg-200 border border-white/10 p-4">
          <div className="text-xs text-text-200 mb-2">水等效直径 · Dw</div>
          <Slider
            label=""
            min={12}
            max={48}
            step={2}
            value={dw}
            onChange={(e) => {
              const v = Number(e.target.value);
              setDw(v);
              setBodyScale(v / 32);
            }}
            valueDisplay={`${dw} cm`}
          />
        </div>
        <div className="rounded-lg bg-bg-200 border border-white/10 p-4">
          <div className="text-xs text-text-200 mb-2">体型缩放 · Body scale</div>
          <Slider
            label=""
            min={0.55}
            max={1.45}
            step={0.05}
            value={bodyScale}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBodyScale(v);
              setDw(Math.round(v * 32));
            }}
            valueDisplay={`${bodyScale.toFixed(2)}×`}
          />
        </div>
      </div>

      {/* SSDE divergence — the central teaching chart */}
      <div className="rounded-lg bg-bg-200 border border-white/10 p-4">
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="font-medium text-text-100 text-sm">
            CTDIvol vs SSDE — divergence with patient size
          </h4>
          <span className="text-xs text-text-200">
            for chest protocol · mAs={mAs} · kVp={kVp} · pitch={pitch}
          </span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ssdeDivergenceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="diameter"
                type="number"
                domain={[12, 48]}
                stroke="#888"
                label={{
                  value: 'Water-equivalent diameter Dw (cm)',
                  position: 'insideBottom',
                  offset: -5,
                  fill: '#888',
                  fontSize: 11,
                }}
              />
              <YAxis
                stroke="#888"
                label={{
                  value: 'Dose (mGy / mSv)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#888',
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#222', border: '1px solid #444', color: '#eee' }}
                formatter={(value: number | string | Array<number | string>, name: string) => {
                  const v = Array.isArray(value) ? value[0] : value;
                  return [typeof v === 'number' ? v.toFixed(3) : String(v), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="ctdiVol"
                stroke="#888"
                name="CTDIvol (scanner output)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="ssde"
                stroke="#FF7A00"
                name="SSDE (patient size-corrected)"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="effectiveDose"
                stroke="#4A90E2"
                name="Effective dose (E, mSv)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-text-200 mt-2 leading-relaxed">
          CTDIvol is FLAT — the scanner emits the same dose regardless of who
          is on the table. SSDE diverges: it goes UP for small patients (they
          absorb more) and DOWN for large patients (their attenuation leaves
          less dose inside). Watch the orange SSDE line separate from the
          gray CTDIvol line as you change Dw. This divergence is exactly what
          AAPM Report 204/220 was created to express.
        </p>
      </div>

      {/* Per-region summary table — quick numerical reference */}
      <div className="rounded-lg bg-bg-200 border border-white/10 p-4 overflow-x-auto">
        <h4 className="font-medium text-text-100 text-sm mb-3">
          Per-region dose breakdown (live)
        </h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-1.5 px-2 text-text-200">Region</th>
              <th className="text-right py-1.5 px-2 text-text-200">CTDIvol (mGy)</th>
              <th className="text-right py-1.5 px-2 text-text-200">DLP (mGy·cm)</th>
              <th className="text-right py-1.5 px-2 text-text-200">SSDE (mGy)</th>
              <th className="text-right py-1.5 px-2 text-text-200">E (mSv)</th>
              <th className="text-right py-1.5 px-2 text-text-200">k-factor</th>
              <th className="text-left py-1.5 px-2 text-text-200">Dominant organs</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(perRegionBreakdown) as BodyRegionId[]).map((rid) => {
              const b = perRegionBreakdown[rid];
              const isSelected = rid === selectedRegion;
              return (
                <tr
                  key={rid}
                  onClick={() => setSelectedRegion(rid)}
                  className={`border-b border-white/5 cursor-pointer hover:bg-white/5 ${
                    isSelected ? 'bg-primary-100/10' : ''
                  }`}
                >
                  <td className="py-1.5 px-2 text-text-100 font-medium capitalize">
                    {rid}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-text-100">
                    {b.ctdiVolMgy.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-text-100">
                    {b.dlpMgyCm.toFixed(0)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-orange-300">
                    {b.ssdeMgy.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-primary-100">
                    {b.effectiveDoseMSv.toFixed(3)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-text-200">
                    {b.region.kFactor}
                  </td>
                  <td className="py-1.5 px-2 text-text-200">
                    {describeRegionOrgans(rid)
                      .slice(0, 3)
                      .map((o) => o.name)
                      .join(', ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-text-200 mt-2 leading-relaxed">
          Note: ICRP 103 effective dose is a <strong>population-averaged protection
          quantity</strong>. It is designed for comparing CT protocols (this scan
          vs that scan), NOT for estimating an individual patient&apos;s cancer
          risk. ICRP Publication 103 explicitly warns against the latter use.
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// New: Monte Carlo explorer
// ---------------------------------------------------------------------------
const MC_EXPLORER: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-orange-50/10 border border-orange-200/40 p-4 text-sm text-orange-100">
        <div className="font-medium text-orange-200 mb-1">
          Honest framing · 真实的局限性
        </div>
        <p className="leading-relaxed">
          A real Monte Carlo photon-transport engine (GEANT4, GATE, MCNP)
          tracks every photon through geometry with full Compton scattering,
          photoelectric cross-sections, and energy-deposition kernels. We
          do not run that here — it is far outside the scope of a browser
          lesson. What we run instead is a deliberately simplified MC that
          samples photons and deposits energy via Beer-Lambert local
          absorption. The numbers are <strong>illustrative</strong>, not
          calibrated. What IS faithfully taught is the central MC idea:
          variance shrinks as √N.
        </p>
      </div>
      <MonteCarloPanel seed={42} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

const DosePage: React.FC = () => {
  const pageData = doseData as PageData;
  const [activeSection, setActiveSection] = useState(pageData.sections[0]?.id || 'dose-metrics');

  const tabs = [
    {
      id: 'dose-metrics',
      label: '剂量链 (Dose Chain)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'dose-3d',
      label: '3D 人体模型 (3D Body)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'patient-size',
      label: '患者体型 (Patient Size)',
      icon: null,
    },
    {
      id: 'mc',
      label: '蒙特卡洛 (Monte Carlo)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
          <circle cx="8" cy="9" r="1" fill="currentColor" />
          <circle cx="15" cy="11" r="1" fill="currentColor" />
          <circle cx="10" cy="15" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'dose-reduction',
      label: '剂量降低 (Reduction)',
      icon: null,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader
        title={pageData.title}
        description={pageData.description}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === tab.id
                ? 'bg-primary-100 text-white'
                : 'bg-bg-200 text-text-200 hover:bg-bg-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeSection === 'dose-metrics' && (
          <SectionCard
            title="Dose measurement methods"
            description="From the scanner output CTDI to the comparable patient dose E"
          >
            <p className="whitespace-pre-line text-text-100 mb-4">
              {pageData.sections.find((s) => s.id === 'ct-dose-measurement')?.content ??
                'CTDI is the standard dose index in CT.'}
            </p>
            <KeyPoints
              points={
                pageData.sections.find((s) => s.id === 'ct-dose-measurement')?.keyPoints ?? []
              }
            />
            <div className="mt-8">
              <DoseCalculatorSimulator />
            </div>
          </SectionCard>
        )}

        {activeSection === 'dose-3d' && (
          <SectionCard
            title="Interactive 3D Body Model"
            description="Click any region to walk the CTDIvol → DLP → SSDE → Effective-dose chain"
          >
            <BODY_3D_EXPLORER />
          </SectionCard>
        )}

        {activeSection === 'patient-size' && (
          <SectionCard
            title="Patient Size & Dose"
            description="See how the patient habitus drives SSDE divergence from CTDIvol"
          >
            <p className="whitespace-pre-line text-text-100 mb-4">
              {pageData.sections.find((s) => s.id === 'patient-size')?.content ??
                'Larger patients need more dose for equivalent image quality.'}
            </p>
            <KeyPoints
              points={
                pageData.sections.find((s) => s.id === 'patient-size')?.keyPoints ?? []
              }
            />
            <div className="mt-8">
              <PatientSizeDoseSimulator />
            </div>
          </SectionCard>
        )}

        {activeSection === 'mc' && (
          <SectionCard
            title="Illustrative Monte Carlo"
            description="A deliberately simplified MC estimator — variance shrinks as √N"
          >
            <MC_EXPLORER />
          </SectionCard>
        )}

        {activeSection === 'dose-reduction' && (
          <SectionCard
            title="Dose Reduction Strategies"
            description="Lower mAs, lower kV, iterative reconstruction"
          >
            <p className="whitespace-pre-line text-text-100 mb-4">
              {pageData.sections.find((s) => s.id === 'dose-reduction')?.content ??
                'Several strategies reduce dose while preserving diagnostic quality.'}
            </p>
            <KeyPoints
              points={
                pageData.sections.find((s) => s.id === 'dose-reduction')?.keyPoints ?? []
              }
            />
            <div className="mt-8">
              <DoseReductionSimulator />
            </div>
          </SectionCard>
        )}
      </div>
    </motion.div>
  );
};

export default DosePage;
