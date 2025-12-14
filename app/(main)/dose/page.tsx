'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import KeyPoints from '@/components/ui/KeyPoints';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import TabGroup from '@/components/ui/TabGroup';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { PageData } from '@/types';
import { calculateCTDI, calculateDLP, calculateEffectiveDose } from '@/utils/physics-calculations';
import doseData from '@/data/dose.json';

// Dose Calculator Simulator
const DoseCalculatorSimulator: React.FC = () => {
  const [kVp, setKVp] = useState(120);
  const [mAs, setMAs] = useState(200);
  const [pitch, setPitch] = useState(1.0);
  const [scanLength, setScanLength] = useState(30); // cm
  const [region, setRegion] = useState('chest');

  const regions = [
    { id: 'head', name: '头部 (Head)', kFactor: 0.0021 },
    { id: 'chest', name: '胸部 (Chest)', kFactor: 0.014 },
    { id: 'abdomen', name: '腹部 (Abdomen)', kFactor: 0.015 },
    { id: 'pelvis', name: '盆腔 (Pelvis)', kFactor: 0.015 }
  ];

  // Calculate dose metrics
  const ctdi = calculateCTDI(kVp, mAs, pitch);
  const dlp = calculateDLP(ctdi, scanLength);
  const selectedRegion = regions.find(r => r.id === region) || regions[1];
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
            options={regions.map(r => ({ value: r.id, label: r.name }))}
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
                <div className="text-sm text-text-200">容积CT剂量指数 (CTDI<sub>vol</sub>)</div>
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

          {/* Risk assessment */}
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

// Patient Size Dose Simulator
const PatientSizeDoseSimulator: React.FC = () => {
  const [patientDiameter, setPatientDiameter] = useState(30); // cm
  const [useAEC, setUseAEC] = useState(true);

  // Generate data for visualization
  const generateSizeData = () => {
    const data = [];
    for (let diameter = 15; diameter <= 45; diameter += 5) {
      const sizeFactor = Math.pow(diameter / 30, 2); // Square law approximation
      const baseDose = 10; // mGy
      data.push({
        diameter,
        manualDose: Number((baseDose * sizeFactor).toFixed(1)),
        aecDose: Number((useAEC ? baseDose * Math.sqrt(sizeFactor) : baseDose * sizeFactor).toFixed(1)),
        imageNoise: Number((useAEC ? 15 : 15 / Math.sqrt(sizeFactor)).toFixed(1))
      });
    }
    return data;
  };

  const sizeData = generateSizeData();
  const currentData = sizeData.find(d => d.diameter === patientDiameter) || sizeData[3];

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
                <span className="font-medium text-text-100">
                  {currentData.aecDose.toFixed(1)} mGy
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-200">图像噪声:</span>
                <span className="font-medium text-text-100">
                  {currentData.imageNoise.toFixed(1)} HU
                </span>
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
                strokeDasharray={useAEC ? "0" : "5 5"}
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
          <li>• 较大的患者为了获得相同的图像质量，需要指数级更高的剂量（这也解释了所谓的“体型代价”）。</li>
        </ul>
      </div>
    </SimulatorContainer>
  );
};

// Dose Reduction Strategies Simulator
const DoseReductionSimulator: React.FC = () => {
  const [strategy, setStrategy] = useState('none');
  const [kVp, setKVp] = useState(120);
  const [iterativeStrength, setIterativeStrength] = useState(50);

  const strategies = [
    { id: 'none', name: '标准方案 (Standard Protocol)' },
    { id: 'lowkv', name: '低电压成像 (Low kV)' },
    { id: 'iterative', name: '迭代重建 (Iterative Reconstruction)' },
    { id: 'combined', name: '组合策略 (Combined Approach)' }
  ];

  // Calculate dose reduction
  const calculateDoseReduction = () => {
    let reduction = 0;

    if (strategy === 'lowkv' || strategy === 'combined') {
      reduction += (120 - kVp) / 120 * 40; // Up to 40% reduction with low kV
    }

    if (strategy === 'iterative' || strategy === 'combined') {
      reduction += iterativeStrength * 0.5; // Up to 50% reduction with IR
    }

    return Math.min(reduction, 70); // Max 70% reduction
  };

  const doseReduction = calculateDoseReduction();
  const baseDose = 10; // mSv
  const optimizedDose = baseDose * (1 - doseReduction / 100);

  // Generate comparison data
  const comparisonData = [
    { technique: '标准 (Standard)', dose: baseDose, quality: 100 },
    { technique: '优化 (Optimized)', dose: Number(optimizedDose.toFixed(2)), quality: Number((95 - (doseReduction * 0.1)).toFixed(1)) }
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
            options={strategies.map(s => ({ value: s.id, label: s.name }))}
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          />

          {(strategy === 'lowkv' || strategy === 'combined') && (
            <Slider
              label="管电压 (Tube Voltage) [kVp]"
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
            <div className="text-3xl font-bold text-green-400 mt-1">
              -{doseReduction.toFixed(0)}%
            </div>
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

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-200 rounded-lg p-4">
          <h4 className="font-medium text-text-100 mb-2">策略优势</h4>
          <ul className="space-y-1 text-sm text-text-200">
            {strategy === 'lowkv' && (
              <>
                <li>• 增加碘对比度</li>
                <li>• 适合体型较小的患者</li>
                <li>• 非常适合CT血管造影 (CTA)</li>
              </>
            )}
            {strategy === 'iterative' && (
              <>
                <li>• 保持空间分辨率</li>
                <li>• 显著降低图像噪声</li>
                <li>• 适用于所有体型的患者</li>
              </>
            )}
            {strategy === 'combined' && (
              <>
                <li>• 最大程度的剂量降低</li>
                <li>• 协同效应</li>
                <li>• 灵活的优化方案</li>
              </>
            )}
            {strategy === 'none' && (
              <li>• 请选择一种策略以查看其优势</li>
            )}
          </ul>
        </div>

        <div className="bg-bg-200 rounded-lg p-4">
          <h4 className="font-medium text-text-100 mb-2">注意事项</h4>
          <ul className="space-y-1 text-sm text-text-200">
            {(strategy === 'lowkv' || strategy === 'combined') && kVp < 100 && (
              <li className="text-orange-400">• 可能会增加图像噪声（尤其在大体型患者中）</li>
            )}
            {(strategy === 'iterative' || strategy === 'combined') && iterativeStrength > 70 && (
              <li className="text-orange-400">• 过高的强度可能会改变图像纹理（“蜡状”感）</li>
            )}
            {strategy !== 'none' && (
              <li>• 必须验证诊断质量是否得到维持</li>
            )}
          </ul>
        </div>
      </div>
    </SimulatorContainer>
  );
};

const DosePage: React.FC = () => {
  const pageData = doseData as PageData;
  const [activeSection, setActiveSection] = useState(pageData.sections[0]?.id || 'dose-metrics');

  const tabs = pageData.sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: section.id === 'dose-metrics' ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ) : null
  }));

  const activeContent = pageData.sections.find(section => section.id === activeSection);

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

      <TabGroup
        tabs={tabs}
        activeTab={activeSection}
        onChange={setActiveSection}
      />

      <div className="mt-8">
        {activeContent && (
          <motion.div
            key={activeContent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SectionCard
              title={activeContent.title}
              description={activeContent.description}
            >
              {activeContent.content && (
                <div className="prose prose-sm max-w-none text-text-100 mb-6">
                  <p className="whitespace-pre-line">{activeContent.content}</p>
                </div>
              )}

              {activeContent.keyPoints && (
                <KeyPoints points={activeContent.keyPoints} />
              )}

              {activeContent.id === 'dose-metrics' && (
                <div className="mt-8">
                  <DoseCalculatorSimulator />
                </div>
              )}

              {activeContent.id === 'patient-size' && (
                <div className="mt-8">
                  <PatientSizeDoseSimulator />
                </div>
              )}

              {activeContent.id === 'dose-reduction' && (
                <div className="mt-8">
                  <DoseReductionSimulator />
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default DosePage;