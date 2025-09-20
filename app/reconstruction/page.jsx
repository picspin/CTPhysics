'use client';

import React from 'react';
import PageHeader from '../../ui/PageHeader'; // Adjusted path
import SectionCard from '../../ui/SectionCard'; // Adjusted path
import KeyPoints from '../../ui/KeyPoints'; // Adjusted path
import SimulatorContainer from '../../ui/SimulatorContainer'; // Adjusted path
import TabGroup from '../../ui/TabGroup'; // Adjusted path
import BackprojectionSimulator from '../../components/simulators/BackprojectionSimulator'; // Adjusted path
import HelicalCTSimulator from '../../components/simulators/HelicalCTSimulator'; // Adjusted path
import SinogramSimulator from '../../components/simulators/SinogramSimulator';

// 从JSON文件导入数据
import reconstructionData from '../../reconstruction.json'; // Adjusted path

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
            { id: 'sinogram', label: '正弦图' },
            { id: 'backprojection', label: '反投影重建' },
            { id: 'helical', label: '螺旋CT' },
          ]}
          defaultTab="sinogram"
        >
          {(activeTab) => (
            <div className="p-4">
              {activeTab === 'sinogram' && <SinogramSimulator />}
              {activeTab === 'backprojection' && <BackprojectionSimulator options={reconstructionData.sections.find(s => s.id === 'backprojection')?.simulator?.options} />}
              {activeTab === 'helical' && <HelicalCTSimulator options={reconstructionData.sections.find(s => s.id === 'helical-ct')?.simulator?.options} />}
            </div>
          )}
        </TabGroup>
      </SimulatorContainer>
    </div>
  );
}