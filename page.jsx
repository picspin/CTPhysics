import React from 'react';
import Layout from '../../components/layout/Layout';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import KeyPoints from '../../components/ui/KeyPoints';
import SimulatorContainer from '../../components/ui/SimulatorContainer';
import TabGroup from '../../components/ui/TabGroup';

// 模拟数据，实际应用中会从API或JSON文件获取
const pageData = {
  title: "心脏CT",
  description: "本页面介绍心脏CT的基本原理，包括前瞻性和回顾性门控技术、时间分辨率和辐射剂量考虑。",
  sections: [
    {
      id: "cardiac-gating",
      title: "心脏门控技术",
      description: "心脏CT扫描需要特殊的门控技术来减少心脏运动引起的伪影。",
      content: "心脏是一个不断运动的器官，这给CT成像带来了挑战。为了获得清晰的心脏图像，需要使用特殊的门控技术来减少心脏运动引起的伪影。有两种主要的门控技术：前瞻性门控和回顾性门控。",
      keyPoints: [
        "前瞻性门控在预测的心动周期特定阶段（通常是舒张中期）获取数据",
        "回顾性门控在整个心动周期连续获取数据，然后在重建时选择最佳相位",
        "前瞻性门控辐射剂量较低，但对心率不规则的患者效果较差"
      ]
    },
    {
      id: "temporal-resolution",
      title: "时间分辨率",
      description: "时间分辨率是指CT扫描仪捕获移动物体清晰图像的能力，对心脏成像尤为重要。",
      content: "时间分辨率是指CT扫描仪捕获移动物体清晰图像的能力。对于心脏成像，高时间分辨率至关重要，因为心脏不断运动。时间分辨率主要取决于旋转时间（X射线管绕患者旋转一周所需的时间）。",
      keyPoints: [
        "时间分辨率对心脏成像至关重要",
        "旋转时间是决定时间分辨率的主要因素",
        "部分扫描重建可以提高有效时间分辨率",
        "双源CT扫描仪通过使用两个X射线管进一步提高时间分辨率"
      ]
    },
    {
      id: "radiation-dose",
      title: "辐射剂量",
      description: "心脏CT扫描的辐射剂量取决于多种因素，包括门控技术、扫描范围和患者特征。",
      content: "心脏CT扫描的辐射剂量取决于多种因素，包括门控技术、扫描范围和患者特征。回顾性门控通常比前瞻性门控的辐射剂量高3-4倍，因为它在整个心动周期连续获取数据。",
      keyPoints: [
        "回顾性门控的辐射剂量通常比前瞻性门控高3-4倍",
        "ECG调制可以在心动周期的非关键阶段降低管电流，减少辐射剂量",
        "迭代重建和低kV成像可以进一步减少辐射剂量"
      ]
    },
    {
      id: "clinical-applications",
      title: "临床应用",
      description: "心脏CT在多种临床情况下有重要应用，包括冠状动脉疾病评估、结构性心脏病和术前规划。",
      content: "心脏CT在多种临床情况下有重要应用。最常见的应用是冠状动脉疾病的评估，特别是对于有中等冠心病风险的患者。心脏CT还可用于评估心脏结构（如心脏瓣膜、心房和心室）、先天性心脏病和心脏肿瘤。",
      keyPoints: [
        "冠状动脉疾病评估是心脏CT最常见的应用",
        "心脏CT可用于评估心脏结构和先天性心脏病",
        "心脏CT在术前规划中发挥重要作用",
        "心脏CT的高阴性预测值使其成为排除冠状动脉疾病的有效工具"
      ]
    }
  ]
};

const CardiacPage = () => {
  const [activeSection, setActiveSection] = React.useState('cardiac-gating');
  
  const tabs = pageData.sections.map(section => ({
    id: section.id,
    label: section.title
  }));
  
  const activeContent = pageData.sections.find(section => section.id === activeSection);

  return (
    <Layout>
      <PageHeader title={pageData.title} description={pageData.description} />
      
      <TabGroup 
        tabs={tabs} 
        activeTab={activeSection} 
        onChange={setActiveSection} 
      />
      
      {activeContent && (
        <SectionCard 
          title={activeContent.title} 
          description={activeContent.description}
        >
          <div className="prose prose-sm max-w-none text-text-100">
            <p>{activeContent.content}</p>
          </div>
          
          <KeyPoints points={activeContent.keyPoints} />
          
          {activeContent.id === 'cardiac-gating' && (
            <SimulatorContainer title="心脏门控模拟器">
              <div className="flex flex-col items-center justify-center p-4 text-center text-text-200">
                <p>心脏门控模拟器将在这里实现</p>
                <p className="mt-2 text-sm">（交互功能将在下一步实现）</p>
              </div>
            </SimulatorContainer>
          )}
          
          {activeContent.id === 'radiation-dose' && (
            <SimulatorContainer title="辐射剂量模拟器">
              <div className="flex flex-col items-center justify-center p-4 text-center text-text-200">
                <p>辐射剂量模拟器将在这里实现</p>
                <p className="mt-2 text-sm">（交互功能将在下一步实现）</p>
              </div>
            </SimulatorContainer>
          )}
        </SectionCard>
      )}
    </Layout>
  );
};

export default CardiacPage;
