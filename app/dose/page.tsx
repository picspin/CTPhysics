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
    { id: 'head', name: 'Head', kFactor: 0.0021 },
    { id: 'chest', name: 'Chest', kFactor: 0.014 },
    { id: 'abdomen', name: 'Abdomen', kFactor: 0.015 },
    { id: 'pelvis', name: 'Pelvis', kFactor: 0.015 }
  ];

  // Calculate dose metrics
  const ctdi = calculateCTDI(kVp, mAs, pitch);
  const dlp = calculateDLP(ctdi, scanLength);
  const selectedRegion = regions.find(r => r.id === region) || regions[1];
  const effectiveDose = calculateEffectiveDose(dlp, selectedRegion.kFactor);

  return (
    <SimulatorContainer
      title="Dose Calculator"
      description="Calculate CTDI, DLP, and Effective Dose based on scan parameters"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="space-y-4">
          <Select
            label="Anatomical Region"
            options={regions.map(r => ({ value: r.id, label: r.name }))}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          <Slider
            label="Tube Voltage (kVp)"
            min={80}
            max={140}
            step={10}
            value={kVp}
            onChange={(e) => setKVp(Number(e.target.value))}
            valueDisplay={kVp}
          />
          <Slider
            label="Tube Current (mAs)"
            min={50}
            max={500}
            step={10}
            value={mAs}
            onChange={(e) => setMAs(Number(e.target.value))}
            valueDisplay={mAs}
          />
          <Slider
            label="Pitch"
            min={0.5}
            max={2.0}
            step={0.1}
            value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
            valueDisplay={pitch}
          />
          <Slider
            label="Scan Length (cm)"
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
                <div className="text-sm text-text-200">CTDI<sub>vol</sub></div>
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
                <div className="text-sm text-text-200">DLP</div>
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
                <div className="text-sm text-primary-100">Effective Dose</div>
                <div className="text-2xl font-bold text-primary-100">{effectiveDose.toFixed(2)}</div>
              </div>
              <div className="text-sm text-primary-100">mSv</div>
            </div>
          </motion.div>

          {/* Risk assessment */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Risk Assessment</h4>
            <p className="text-sm text-yellow-700">
              {effectiveDose < 1 && 'Minimal risk - comparable to a few months of natural background radiation.'}
              {effectiveDose >= 1 && effectiveDose < 10 && 'Low risk - comparable to 1-3 years of natural background radiation.'}
              {effectiveDose >= 10 && effectiveDose < 20 && 'Moderate risk - consider dose optimization strategies.'}
              {effectiveDose >= 20 && 'Higher risk - ensure clinical justification and optimize protocol.'}
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
        manualDose: baseDose * sizeFactor,
        aecDose: useAEC ? baseDose * Math.sqrt(sizeFactor) : baseDose * sizeFactor,
        imageNoise: useAEC ? 15 : 15 / Math.sqrt(sizeFactor)
      });
    }
    return data;
  };

  const sizeData = generateSizeData();
  const currentData = sizeData.find(d => d.diameter === patientDiameter) || sizeData[3];

  return (
    <SimulatorContainer
      title="Patient Size & Dose Relationship"
      description="See how patient size affects dose and image noise"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Slider
            label="Patient Diameter (cm)"
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
                Use Automatic Exposure Control (AEC)
              </span>
            </label>
          </div>

          <div className="bg-bg-200 rounded-lg p-4">
            <h4 className="font-medium text-text-100 mb-3">Current Values</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-200">Relative Dose:</span>
                <span className="font-medium text-text-100">
                  {currentData.aecDose.toFixed(1)} mGy
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-200">Image Noise:</span>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="diameter"
                label={{ value: 'Patient Diameter (cm)', position: 'insideBottom', offset: -5 }}
                stroke="#6b7280"
              />
              <YAxis
                label={{ value: 'Dose (mGy)', angle: -90, position: 'insideLeft' }}
                stroke="#6b7280"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="manualDose"
                stroke="#ef4444"
                name="Fixed mAs"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="aecDose"
                stroke="#10b981"
                name="With AEC"
                strokeWidth={2}
                dot={false}
                strokeDasharray={useAEC ? "0" : "5 5"}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Key Insights</h4>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>• Without AEC, dose increases quadratically with patient size</li>
          <li>• AEC maintains consistent image quality by adjusting dose based on patient attenuation</li>
          <li>• Larger patients require exponentially more dose for the same image quality</li>
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
    { id: 'none', name: 'Standard Protocol' },
    { id: 'lowkv', name: 'Low kV Imaging' },
    { id: 'iterative', name: 'Iterative Reconstruction' },
    { id: 'combined', name: 'Combined Approach' }
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
    { technique: 'Standard', dose: baseDose, quality: 100 },
    { technique: 'Optimized', dose: optimizedDose, quality: 95 - (doseReduction * 0.1) }
  ];

  return (
    <SimulatorContainer
      title="Dose Reduction Strategies"
      description="Compare different techniques for reducing radiation dose"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Select
            label="Reduction Strategy"
            options={strategies.map(s => ({ value: s.id, label: s.name }))}
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          />

          {(strategy === 'lowkv' || strategy === 'combined') && (
            <Slider
              label="Tube Voltage (kVp)"
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
              label="Iterative Strength (%)"
              min={0}
              max={100}
              step={10}
              value={iterativeStrength}
              onChange={(e) => setIterativeStrength(Number(e.target.value))}
              valueDisplay={iterativeStrength}
            />
          )}

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-1">Dose Reduction</h4>
            <div className="text-3xl font-bold text-green-700 mt-1">
              {doseReduction.toFixed(0)}%
            </div>
            <div className="text-sm text-green-600 mt-2">
              {optimizedDose.toFixed(1)} mSv (from {baseDose} mSv)
            </div>
          </div>
        </div>

        <div className="col-span-2 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="technique" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="dose" fill="#FF7A00" name="Dose (mSv)" />
              <Bar dataKey="quality" fill="#4A90E2" name="Image Quality (%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-200 rounded-lg p-4">
          <h4 className="font-medium text-text-100 mb-2">Strategy Benefits</h4>
          <ul className="space-y-1 text-sm text-text-200">
            {strategy === 'lowkv' && (
              <>
                <li>• Increased iodine contrast</li>
                <li>• Better for smaller patients</li>
                <li>• Useful for CT angiography</li>
              </>
            )}
            {strategy === 'iterative' && (
              <>
                <li>• Maintains spatial resolution</li>
                <li>• Reduces image noise</li>
                <li>• Works for all patient sizes</li>
              </>
            )}
            {strategy === 'combined' && (
              <>
                <li>• Maximum dose reduction</li>
                <li>• Synergistic effects</li>
                <li>• Flexible optimization</li>
              </>
            )}
            {strategy === 'none' && (
              <li>• Select a strategy to see benefits</li>
            )}
          </ul>
        </div>

        <div className="bg-bg-200 rounded-lg p-4">
          <h4 className="font-medium text-text-100 mb-2">Considerations</h4>
          <ul className="space-y-1 text-sm text-text-200">
            {(strategy === 'lowkv' || strategy === 'combined') && kVp < 100 && (
              <li className="text-orange-600">• May increase image noise</li>
            )}
            {(strategy === 'iterative' || strategy === 'combined') && iterativeStrength > 70 && (
              <li className="text-orange-600">• May affect image texture</li>
            )}
            {strategy !== 'none' && (
              <li>• Verify diagnostic quality is maintained</li>
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