'use client';

import React from 'react';
import PageHeader from '../../PageHeader';
import SectionCard from '../../SectionCard';
import KeyPoints from '../../KeyPoints';
import SimulatorContainer from '../../SimulatorContainer';
import RadiationDoseSimulator from '../../RadiationDoseSimulator';

// 从JSON文件导入数据
import doseData from '../../dose.json';

export default function DosePage() {
  return (
    <div className="space-y-8 animate-fadeIn">
      <PageHeader 
        title={doseData.title} 
        description={doseData.description} 
      />
      
      {doseData.sections.map((section) => (
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
      
      <SimulatorContainer title="CT剂量模拟器">
        <RadiationDoseSimulator />
      </SimulatorContainer>
    </div>
  );
}