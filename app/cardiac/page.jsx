'use client';

import React from 'react';
import PageHeader from '../../PageHeader';
import SectionCard from '../../SectionCard';
import KeyPoints from '../../KeyPoints';
import SimulatorContainer from '../../SimulatorContainer';
import CardiacGatingSimulator from '../../CardiacGatingSimulator';

// 从JSON文件导入数据
import cardiacData from '../../cardiac.json';

export default function CardiacPage() {
  return (
    <div className="space-y-8 animate-fadeIn">
      <PageHeader 
        title={cardiacData.title} 
        description={cardiacData.description} 
      />
      
      {cardiacData.sections.map((section) => (
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
      
      <SimulatorContainer title="心脏CT门控模拟器">
        <CardiacGatingSimulator />
      </SimulatorContainer>
    </div>
  );
}