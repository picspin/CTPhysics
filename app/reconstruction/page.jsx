'use client';

import React from 'react';
import PageHeader from '../../PageHeader';
import SectionCard from '../../SectionCard';
import KeyPoints from '../../KeyPoints';
import SimulatorContainer from '../../SimulatorContainer';
import TabGroup from '../../TabGroup';
import BackprojectionSimulator from '../../BackprojectionSimulator';
import HelicalCTSimulator from '../../HelicalCTSimulator';

// 从JSON文件导入数据
import reconstructionData from '../../reconstruction.json';

export default function ReconstructionPage() {
  return (
    <div className="space-y-8 animate-fadeIn">
      <PageHeader 
        title={reconstructionData.title} 
        description={reconstructionData.description} 
      />
      
      {reconstructionData.sections.map((section) => (
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
      
      <SimulatorContainer title="CT重建模拟器">
        <TabGroup
          tabs={[
            { id: 'backprojection', label: '反投影重建' },
            { id: 'helical', label: '螺旋CT' },
          ]}
        >
          <div id="backprojection" className="p-4">
            <BackprojectionSimulator />
          </div>
          <div id="helical" className="p-4">
            <HelicalCTSimulator />
          </div>
        </TabGroup>
      </SimulatorContainer>
    </div>
  );
}