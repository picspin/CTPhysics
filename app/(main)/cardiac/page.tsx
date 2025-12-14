'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import KeyPoints from '@/components/ui/KeyPoints';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import TabGroup from '@/components/ui/TabGroup';
import CardiacGatingSimulator from '@/components/simulators/CardiacGatingSimulator';
import { PageData } from '@/types';
import cardiacData from '@/data/cardiac.json';

const CardiacPage: React.FC = () => {
  const pageData = cardiacData as PageData;
  const [activeSection, setActiveSection] = useState(pageData.sections[0]?.id || 'cardiac-gating');

  const tabs = pageData.sections.map(section => ({
    id: section.id,
    label: section.title
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
              <div className="prose prose-sm max-w-none text-text-100">
                <p>{activeContent.content}</p>
              </div>

              {activeContent.keyPoints && (
                <KeyPoints points={activeContent.keyPoints} />
              )}

              {activeContent.id === 'cardiac-gating' && (
                <div className="mt-8">
                  <CardiacGatingSimulator />
                </div>
              )}

              {activeContent.id === 'temporal-resolution' && (
                <div className="mt-8">
                  <SimulatorContainer
                    title="时间分辨率计算器 (Temporal Resolution Calculator)"
                    description="根据旋转时间和重建方法计算时间分辨率"
                  >
                    <TemporalResolutionCalculator />
                  </SimulatorContainer>
                </div>
              )}

              {activeContent.id === 'radiation-dose' && (
                <div className="mt-8">
                  <SimulatorContainer
                    title="心脏CT剂量计算器 (Cardiac Dose Calculator)"
                    description="比较不同门控技术下的辐射剂量"
                  >
                    <CardiacDoseCalculator />
                  </SimulatorContainer>
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Temporal Resolution Calculator Component
const TemporalResolutionCalculator: React.FC = () => {
  const [rotationTime, setRotationTime] = useState(0.5);
  const [isMultisource, setIsMultisource] = useState(false);

  // For single source half-scan: T_res = T_rot / 2
  // For dual source quarter-scan: T_res = T_rot / 4
  const temporalResolution = isMultisource ? rotationTime / 4 : rotationTime / 2;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-text-100 mb-2">
            机架旋转时间 (Rotation Time) [秒]
          </label>
          <input
            type="number"
            value={rotationTime}
            onChange={(e) => setRotationTime(parseFloat(e.target.value))}
            step={0.1}
            min={0.2}
            max={2.0}
            className="w-full px-4 py-2 border border-border-100 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-transparent bg-bg-200 text-text-100"
          />
        </div>

        <div>
          <label className="flex items-center space-x-3 mt-8">
            <input
              type="checkbox"
              checked={isMultisource}
              onChange={(e) => setIsMultisource(e.target.checked)}
              className="w-4 h-4 text-primary-100 rounded focus:ring-primary-100"
            />
            <span className="text-sm font-medium text-text-100">
              双源CT (Dual-source CT)
            </span>
          </label>
        </div>
      </div>

      <div className="bg-bg-200 rounded-lg p-6">
        <div className="text-center">
          <div className="text-sm text-text-200 mb-2">时间分辨率 (Temporal Resolution)</div>
          <div className="text-4xl font-bold text-primary-100">
            {(temporalResolution * 1000).toFixed(0)} ms
          </div>
          <div className="text-sm text-text-200 mt-2">
            {isMultisource ? '四分之一扇区重建 (Quarter-scan reconstruction)' : '半扇区重建 (Half-scan reconstruction)'}
          </div>
        </div>
      </div>

      <div className="text-sm text-text-200">
        <p>
          <strong>注：</strong> 时间分辨率决定了冻结心脏运动的能力。
          对于可靠的心脏成像，在心率达到 70 bpm 时，时间分辨率应小于 100ms。
        </p>
      </div>
    </div>
  );
};

// Cardiac Dose Calculator Component
const CardiacDoseCalculator: React.FC = () => {
  const [gatingType, setGatingType] = useState<'prospective' | 'retrospective'>('prospective');
  const [heartRate, setHeartRate] = useState(70);

  const baseDose = gatingType === 'prospective' ? 3 : 12; // mSv
  const heartRateFactor = heartRate > 70 ? 1.2 : 1.0;
  const estimatedDose = baseDose * heartRateFactor;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-text-100 mb-2">
            门控类型 (Gating Type)
          </label>
          <select
            value={gatingType}
            onChange={(e) => setGatingType(e.target.value as 'prospective' | 'retrospective')}
            className="w-full px-4 py-2 border border-border-100 rounded-lg focus:ring-2 focus:ring-primary-100 bg-bg-200 text-text-100"
          >
            <option value="prospective">前瞻性心电触发 (Prospective)</option>
            <option value="retrospective">回顾性心电门控 (Retrospective)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-100 mb-2">
            心率 (Heart Rate) [bpm]
          </label>
          <input
            type="number"
            value={heartRate}
            onChange={(e) => setHeartRate(parseInt(e.target.value))}
            min={40}
            max={120}
            className="w-full px-4 py-2 border border-border-100 rounded-lg focus:ring-2 focus:ring-primary-100 bg-bg-200 text-text-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          className="bg-bg-200 rounded-lg p-4 text-center border border-border-100"
          whileHover={{ scale: 1.02 }}
        >
          <div className="text-sm text-text-200">估算剂量 (Estimated Dose)</div>
          <div className="text-2xl font-bold text-primary-100 mt-1">
            {estimatedDose.toFixed(1)} mSv
          </div>
        </motion.div>

        <motion.div
          className="bg-bg-200 rounded-lg p-4 text-center border border-border-100"
          whileHover={{ scale: 1.02 }}
        >
          <div className="text-sm text-text-200">剂量降低 (Dose Reduction)</div>
          <div className="text-2xl font-bold text-green-500 mt-1">
            {gatingType === 'prospective' ? '70-80%' : '基准 (Baseline)'}
          </div>
        </motion.div>

        <motion.div
          className="bg-bg-200 rounded-lg p-4 text-center border border-border-100"
          whileHover={{ scale: 1.02 }}
        >
          <div className="text-sm text-text-200">图像质量 (Image Quality)</div>
          <div className="text-2xl font-bold text-accent-100 mt-1">
            {heartRate <= 65 ? '优秀 (Excellent)' : heartRate <= 80 ? '良好 (Good)' : '一般 (Fair)'}
          </div>
        </motion.div>
      </div>

      <div className="bg-yellow-50/10 border border-yellow-200/50 rounded-lg p-4">
        <p className="text-sm text-yellow-200">
          <strong>推荐：</strong>
          {heartRate > 70 && ' 考虑使用β受体阻滞剂降低心率。'}
          {gatingType === 'retrospective' && ' 使用心电管电流调制技术以降低剂量。'}
          {gatingType === 'prospective' && heartRate <= 65 && ' 这是低剂量心脏CT的最佳条件。'}
        </p>
      </div>
    </div>
  );
};

export default CardiacPage;