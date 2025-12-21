'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import BackprojectionSimulator from '@/components/simulators/BackprojectionSimulator';
import HelicalCTSimulator from '@/components/simulators/HelicalCTSimulator';

export default function ReconstructionPage() {
  const [activeTab, setActiveTab] = useState('fbp');

  return (
    <div className="min-h-screen pb-20">
      <PageHeader
        title="图像重建 (Image Reconstruction)"
        description="了解将探测器原始数据转换为诊断图像的数学原理。"
      />

      <main className="container mx-auto px-4 space-y-8 -mt-8 relative z-10">

        {/* Navigation Tabs */}
        <div className="flex justify-center space-x-4 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('fbp')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'fbp' ? 'bg-primary-100 text-white' : 'bg-bg-200 text-text-200 hover:bg-bg-300'}`}
          >
            BP & FBP 模拟器
          </button>
          <button
            onClick={() => setActiveTab('cbct')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'cbct' ? 'bg-primary-100 text-white' : 'bg-bg-200 text-text-200 hover:bg-bg-300'}`}
          >
            锥束CT (CBCT)
          </button>
          <button
            onClick={() => setActiveTab('helical')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'helical' ? 'bg-primary-100 text-white' : 'bg-bg-200 text-text-200 hover:bg-bg-300'}`}
          >
            螺旋CT与螺距
          </button>
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {activeTab === 'fbp' && (
            <>
              <SectionCard title="CT重建原理 (The Reconstruction Problem)">
                <div className="prose prose-invert max-w-none text-text-200">
                  <p>
                    CT扫描仪从多个不同角度测量穿过人体的X射线衰减量。
                    这些原始数据被称为<strong>正弦图 (Sinogram)</strong>（或Radon变换），必须经过处理才能生成用于诊断的横断面图像。
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="反投影与滤波反投影 (BP & FBP)">
                <div className="space-y-6">
                  <div className="prose prose-invert max-w-none text-text-200">
                    <p>
                      此模拟器展示了现代重建算法的两个核心步骤。
                      <strong>直接反投影 (Raw Backprojection)</strong> 简单地将数据沿射线路径涂抹回去，导致图像模糊（1/r 模糊）。
                      <strong>滤波反投影 (Filtered Backprojection, FBP)</strong> 首先应用数学滤波器（如Ramp核或Shepp-Logan核）锐化数据，从而恢复正确的图像边缘和密度。
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-text-300">
                      <li><strong>矩阵大小 (Matrix Size):</strong> 决定了重建图像的分辨率（如 512x512 为高保真模式）。</li>
                      <li><strong>扇束角度 (Fan Angle):</strong> 模拟真实的X射线源发散几何。</li>
                      <li><strong>探测器 (Detectors):</strong> 决定了采样精度。</li>
                    </ul>
                  </div>

                  <SimulatorContainer title="重建模拟器 (Reconstruction Simulator)" description="比较 原始反投影 与 滤波反投影 的效果" enableLiquidEffect={false}>
                    <BackprojectionSimulator />
                  </SimulatorContainer>
                </div>
              </SectionCard>
            </>
          )}

          {activeTab === 'cbct' && (
            <SectionCard title="锥束CT (Cone Beam CT)">
              <div className="space-y-6">
                <div className="prose prose-invert max-w-none text-text-200">
                  <p>
                    <strong>锥束CT (CBCT)</strong> 使用锥形X射线束（而不是传统的扇形束）和平面探测器，在一次旋转中即可获取整个体积的数据。
                  </p>
                  <h4 className="text-lg font-semibold text-text-100 mt-4">FDK 算法 (Feldkamp-Davis-Kress)</h4>
                  <p>
                    FDK 是最为经典的 CBCT 重建算法，它是 FBP 算法在 3D 锥束几何下的近似推广。其主要步骤包括：
                  </p>
                  <ul className="list-decimal list-inside space-y-2 mt-2">
                    <li><strong>加权 (Weighting):</strong> 对投影数据进行由几何带来的位置加权（Cosine 加权）。</li>
                    <li><strong>滤波 (Filtering):</strong> 对每一行探测器数据应用一维 Ramp 滤波器（类似于 2D FBP）。</li>
                    <li><strong>反投影 (Backprojection):</strong> 沿 3D 锥体几何光路将数据反投影到体素网格中。</li>
                  </ul>
                  <div className="bg-bg-300 p-4 rounded-lg mt-4 text-sm border-l-4 border-primary-100">
                    <strong>注：</strong> CBCT 在远离中心平面的位置（大锥角）会产生由近似算法导致的 Feldman 伪影（Feldkamp artifacts）。
                  </div>
                </div>
                {/* Future: Add a 3D visualization of Cone Beam vs Fan Beam geometry here */}
              </div>
            </SectionCard>
          )}

          {activeTab === 'helical' && (
            <SectionCard title="螺旋CT与螺距 (Helical Scan & Pitch)">
              <div className="prose prose-invert max-w-none text-text-200 mb-6">
                <p>
                  在螺旋CT中，检查床连续移动的同时机架进行旋转，围绕患者扫描出螺旋路径。
                  <strong>螺距 (Pitch)</strong> 参数控制这个螺旋的“紧密”程度。
                </p>
                <ul className="list-disc list-inside">
                  <li><strong>Pitch &lt; 1:</strong> 采样重叠 (高剂量，高质量，减少运动伪影)。</li>
                  <li><strong>Pitch &gt; 1:</strong> 采样间隙 (低剂量，快速扫描，可能降低Z轴分辨率)。</li>
                  <li><strong>Pitch = 1:</strong> 连续取样。</li>
                </ul>
              </div>
              <SimulatorContainer title="螺旋CT模拟器 (Helical Simulator)" description="调整螺距和速度以观察螺旋路径" enableLiquidEffect={false}>
                <HelicalCTSimulator />
              </SimulatorContainer>
            </SectionCard>
          )}

        </motion.div>
      </main>
    </div>
  );
}