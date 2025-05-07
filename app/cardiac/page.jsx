'use client';

import React from 'react';
import PageHeader from '../../ui/PageHeader';
import SectionCard from '../../ui/SectionCard';
import KeyPoints from '../../ui/KeyPoints';
import SimulatorContainer from '../../ui/SimulatorContainer';
import dynamic from 'next/dynamic';

// 使用dynamic导入组件，禁用SSR以避免导入错误
const CardiacGatingSimulator = dynamic(
  () => import('../../CardiacGatingSimulator'),
  { ssr: false }
);

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