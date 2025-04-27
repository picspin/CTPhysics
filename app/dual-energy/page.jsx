'use client';

import React from 'react';
import PageHeader from '../../PageHeader';
import SectionCard from '../../SectionCard';
import KeyPoints from '../../KeyPoints';
import SimulatorContainer from '../../SimulatorContainer';
import DualEnergyReconstructionSimulator from '../../DualEnergyReconstructionSimulator';
import XrayAttenuationSimulator from '../../XrayAttenuationSimulator';
import TabGroup from '../../TabGroup';

// 从JSON文件导入数据
import dualEnergyData from '../../dual-energy.json';

export default function DualEnergyPage() {
  return (
    <div className="space-y-8 animate-fadeIn">
      <PageHeader 
        title={dualEnergyData.title} 
        description={dualEnergyData.description} 
      />
      
      {dualEnergyData.sections.map((section) => (
        <SectionCard 
          key={section.id}
          title={section.title}
          description={section.description}
          className="hover-lift"
        >
          <div className="space-y-4">
            <p className="text-text-200">{section.content}</p>
            
            {section.keyPoints && (
              <KeyPoints points={section.keyPoints} />
            )}
          </div>
        </SectionCard>
      ))}
      
      <SimulatorContainer title="束硬化与双能CT模拟器">
        <TabGroup
          tabs={[
            { id: 'attenuation', label: 'X射线衰减' },
            { id: 'dual-energy', label: '双能CT' },
          ]}
        >
          <div id="attenuation" className="p-4">
            <XrayAttenuationSimulator />
          </div>
          <div id="dual-energy" className="p-4">
            <DualEnergyReconstructionSimulator />
          </div>
        </TabGroup>
      </SimulatorContainer>
    </div>
  );
}