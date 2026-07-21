import React from 'react';
import CBCTSimulator from '@/components/simulators/CBCTSimulator';
import PageHeader from '@/components/ui/PageHeader';
import KeyPoints from '@/components/ui/KeyPoints';

export default function CBCTPage() {
  const keyPoints = [
    '锥形束CT (CBCT) 采用三维锥形射线与面探测器进行单次旋转采集。',
    '空间分辨率取决于探测器像元尺寸与几何放大率，牙科CBCT可达0.1mm级别。',
    '三维重建常用 FDK (Feldkamp-Davis-Kress) 算法，这是一种滤波反投影的3D扩展。',
    '圆锥角增大时，由于拉东数据不完备性，会导致偏轴体素产生严重的锥束伪影。'
  ];

  return (
    <div className='space-y-6 max-w-7xl mx-auto px-4 py-6'>
      <PageHeader
        title='锥形束CT (CBCT) 物理原理'
        description='探索锥形射线几何、面探测器二维采样以及基于三维 FDK 算法的体数据重建过程，深入理解非平面对称性所带来的锥束伪影与空间分辨率的工程权衡。'
      />
      <KeyPoints points={keyPoints} />
      <CBCTSimulator />
    </div>
  );
}
