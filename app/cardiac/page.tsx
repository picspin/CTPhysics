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
                    title="Temporal Resolution Calculator"
                    description="Calculate temporal resolution based on rotation time and reconstruction method"
                  >
                    <TemporalResolutionCalculator />
                  </SimulatorContainer>
                </div>
              )}
              
              {activeContent.id === 'radiation-dose' && (
                <div className="mt-8">
                  <SimulatorContainer 
                    title="Cardiac CT Dose Calculator"
                    description="Compare radiation doses between different gating techniques"
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
  
  const temporalResolution = isMultisource ? rotationTime / 4 : rotationTime / 2;
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-text-100 mb-2">
            Rotation Time (seconds)
          </label>
          <input
            type="number"
            value={rotationTime}
            onChange={(e) => setRotationTime(parseFloat(e.target.value))}
            step={0.1}
            min={0.2}
            max={2.0}
            className="w-full px-4 py-2 border border-border-100 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-transparent"
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
              Dual-source CT Scanner
            </span>
          </label>
        </div>
      </div>
      
      <div className="bg-bg-200 rounded-lg p-6">
        <div className="text-center">
          <div className="text-sm text-text-200 mb-2">Temporal Resolution</div>
          <div className="text-4xl font-bold text-primary-100">
            {(temporalResolution * 1000).toFixed(0)} ms
          </div>
          <div className="text-sm text-text-200 mt-2">
            {isMultisource ? 'Quarter-scan reconstruction' : 'Half-scan reconstruction'}
          </div>
        </div>
      </div>
      
      <div className="text-sm text-text-200">
        <p>
          <strong>Note:</strong> Temporal resolution determines the ability to freeze cardiac motion.
          For reliable cardiac imaging, temporal resolution should be less than 100ms for heart rates
          up to 70 bpm.
        </p>
      </div>
    </div>
  );
};

// Cardiac Dose Calculator Component
const CardiacDoseCalculator: React.FC = () => {
  const [gatingType, setGatingType] = useState<'prospective' | 'retrospective'>('prospective');
  const [heartRate, setHeartRate] = useState(70);
  const [scanLength, setScanLength] = useState(12); // cm
  
  const baseDose = gatingType === 'prospective' ? 3 : 12; // mSv
  const heartRateFactor = heartRate > 70 ? 1.2 : 1.0;
  const estimatedDose = baseDose * heartRateFactor;
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-text-100 mb-2">
            Gating Type
          </label>
          <select
            value={gatingType}
            onChange={(e) => setGatingType(e.target.value as 'prospective' | 'retrospective')}
            className="w-full px-4 py-2 border border-border-100 rounded-lg focus:ring-2 focus:ring-primary-100"
          >
            <option value="prospective">Prospective ECG-triggering</option>
            <option value="retrospective">Retrospective ECG-gating</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-text-100 mb-2">
            Heart Rate (bpm)
          </label>
          <input
            type="number"
            value={heartRate}
            onChange={(e) => setHeartRate(parseInt(e.target.value))}
            min={40}
            max={120}
            className="w-full px-4 py-2 border border-border-100 rounded-lg focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          className="bg-bg-200 rounded-lg p-4 text-center"
          whileHover={{ scale: 1.02 }}
        >
          <div className="text-sm text-text-200">Estimated Dose</div>
          <div className="text-2xl font-bold text-primary-100 mt-1">
            {estimatedDose.toFixed(1)} mSv
          </div>
        </motion.div>
        
        <motion.div
          className="bg-bg-200 rounded-lg p-4 text-center"
          whileHover={{ scale: 1.02 }}
        >
          <div className="text-sm text-text-200">Dose Reduction</div>
          <div className="text-2xl font-bold text-green-500 mt-1">
            {gatingType === 'prospective' ? '70-80%' : 'Baseline'}
          </div>
        </motion.div>
        
        <motion.div
          className="bg-bg-200 rounded-lg p-4 text-center"
          whileHover={{ scale: 1.02 }}
        >
          <div className="text-sm text-text-200">Image Quality</div>
          <div className="text-2xl font-bold text-accent-100 mt-1">
            {heartRate <= 65 ? 'Excellent' : heartRate <= 80 ? 'Good' : 'Fair'}
          </div>
        </motion.div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Recommendation:</strong> 
          {heartRate > 70 && ' Consider beta-blockers to reduce heart rate.'}
          {gatingType === 'retrospective' && ' Use ECG-controlled tube current modulation to reduce dose.'}
          {gatingType === 'prospective' && heartRate <= 65 && ' Excellent conditions for low-dose cardiac CT.'}
        </p>
      </div>
    </div>
  );
};

export default CardiacPage;