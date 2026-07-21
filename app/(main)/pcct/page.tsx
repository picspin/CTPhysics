import React from 'react';
import PCCTSimulator from '@/components/simulators/PCCTSimulator';
import PageHeader from '@/components/ui/PageHeader';
import KeyPoints from '@/components/ui/KeyPoints';

export default function PCCTPage() {
  const keyPoints = [
    '光子计数CT (PCCT) 使用半导体直接转换探测器，将穿过的X射线光子直接转换为电信号脉冲，不存在可见光散射能量损失。',
    '物理上实现“零电子噪声”：通过低能电平阈值过滤，将环境背景热噪声彻底消除，使超低剂量成像成为可能。',
    'PCCT 具备多能谱/能级分桶 (Energy Binning) 特性，能实现超高分辨率的高保真物质分解（Material Decomposition）与 K-edge 成像。',
    '冠脉临床应用中，PCCT 表现出极强的钙化 Blooming 抑制性能以及超细金属支架微小梁管腔的通畅度评估能力。'
  ];

  return (
    <div className='space-y-6 max-w-7xl mx-auto px-4 py-6'>
      <PageHeader
        title='光子计数CT (PCCT) 物理孪生模拟'
        description='探索半导体直接转换、多能谱分桶、脉冲堆积 (Pulse Pile-up) 等特有非理想效应，了解 PCCT 如何从底层物理机制变革临床 CCTA 冠脉影像。'
      />
      <KeyPoints points={keyPoints} />
      <PCCTSimulator />
    </div>
  );
}
