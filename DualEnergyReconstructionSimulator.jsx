import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SimulatorContainer from './ui/SimulatorContainer';
import Select from './ui/Select';
import TabGroup from './TabGroup';
import Button from './ui/Button';

const DualEnergyReconstructionSimulator = () => {
  const [reconstructionType, setReconstructionType] = useState('virtual_noncontrast');
  const [selectedCase, setSelectedCase] = useState('liver');
  const [materialComposition, setMaterialComposition] = useState([]);
  
  const reconstructionTypes = [
    { id: 'virtual_noncontrast', label: '虚拟平扫' },
    { id: 'iodine_overlay', label: '碘叠加' },
    { id: 'bone_subtraction', label: '骨骼减除' },
    { id: 'lung_perfusion', label: '肺灌注' }
  ];
  
  const cases = [
    { id: 'liver', name: '肝脏病变' },
    { id: 'lung', name: '肺栓塞' },
    { id: 'kidney', name: '肾结石' }
  ];
  
  // 生成模拟材料分解数据
  useEffect(() => {
    const generateMaterialData = () => {
      // 不同病例的材料组成（模拟数据）
      const compositions = {
        'liver': [
          { name: '软组织', conventional: 65, virtual_noncontrast: 65, iodine_overlay: 65, bone_subtraction: 70, lung_perfusion: 65 },
          { name: '脂肪', conventional: 15, virtual_noncontrast: 15, iodine_overlay: 15, bone_subtraction: 15, lung_perfusion: 15 },
          { name: '碘', conventional: 15, virtual_noncontrast: 0, iodine_overlay: 15, bone_subtraction: 15, lung_perfusion: 15 },
          { name: '骨骼', conventional: 5, virtual_noncontrast: 5, iodine_overlay: 5, bone_subtraction: 0, lung_perfusion: 5 },
          { name: '空气', conventional: 0, virtual_noncontrast: 0, iodine_overlay: 0, bone_subtraction: 0, lung_perfusion: 0 }
        ],
        'lung': [
          { name: '软组织', conventional: 30, virtual_noncontrast: 30, iodine_overlay: 30, bone_subtraction: 35, lung_perfusion: 30 },
          { name: '脂肪', conventional: 5, virtual_noncontrast: 5, iodine_overlay: 5, bone_subtraction: 5, lung_perfusion: 5 },
          { name: '碘', conventional: 10, virtual_noncontrast: 0, iodine_overlay: 10, bone_subtraction: 10, lung_perfusion: 10 },
          { name: '骨骼', conventional: 15, virtual_noncontrast: 15, iodine_overlay: 15, bone_subtraction: 0, lung_perfusion: 15 },
          { name: '空气', conventional: 40, virtual_noncontrast: 40, iodine_overlay: 40, bone_subtraction: 50, lung_perfusion: 40 }
        ],
        'kidney': [
          { name: '软组织', conventional: 60, virtual_noncontrast: 60, iodine_overlay: 60, bone_subtraction: 65, lung_perfusion: 60 },
          { name: '脂肪', conventional: 20, virtual_noncontrast: 20, iodine_overlay: 20, bone_subtraction: 20, lung_perfusion: 20 },
          { name: '碘', conventional: 10, virtual_noncontrast: 0, iodine_overlay: 10, bone_subtraction: 10, lung_perfusion: 10 },
          { name: '骨骼', conventional: 5, virtual_noncontrast: 5, iodine_overlay: 5, bone_subtraction: 0, lung_perfusion: 5 },
          { name: '钙（结石）', conventional: 5, virtual_noncontrast: 15, iodine_overlay: 5, bone_subtraction: 5, lung_perfusion: 5 }
        ]
      };
      
      setMaterialComposition(compositions[selectedCase]);
    };
    
    generateMaterialData();
  }, [selectedCase]);
  
  // 获取图表中显示的条形颜色
  const getBarColor = (material) => {
    const colors = {
      '软组织': '#FF8C00', // 主题色
      '脂肪': '#FFC107',
      '碘': '#4A90E2', // 强调色
      '骨骼': '#795548',
      '空气': '#9E9E9E',
      '钙（结石）': '#8e3000' // 深橙色
    };
    return colors[material] || '#000000';
  };

  return (
    <SimulatorContainer title="双能重建模拟器">
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select 
            label="选择病例" 
            options={cases} 
            value={selectedCase} 
            onChange={setSelectedCase} 
          />
        </div>
        
        <TabGroup 
          tabs={reconstructionTypes} 
          activeTab={reconstructionType} 
          onChange={setReconstructionType} 
        />
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-md border border-border bg-bg-100 p-4">
            <div className="mb-2 text-sm font-medium text-text-100">常规CT图像</div>
            <div className="aspect-square w-full overflow-hidden rounded-md bg-black">
              <div className="relative h-full w-full">
                {/* 模拟CT图像 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {selectedCase === 'liver' && (
                    <div className="h-3/4 w-3/4 rounded-full bg-gray-700">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/4 w-1/4 rounded-full bg-gray-500"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/6 w-1/6 rounded-full bg-gray-500"></div>
                      </div>
                    </div>
                  )}
                  
                  {selectedCase === 'lung' && (
                    <div className="h-3/4 w-3/4 rounded-md bg-gray-900">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/3 w-1/3 rounded-full bg-gray-800"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/3 w-1/3 rounded-full bg-gray-800"></div>
                        <div className="absolute left-1/2 top-1/2 h-1/6 w-1/6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-600"></div>
                      </div>
                    </div>
                  )}
                  
                  {selectedCase === 'kidney' && (
                    <div className="h-3/4 w-3/4 rounded-md bg-gray-700">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/3 w-1/4 rounded-full bg-gray-600"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/3 w-1/4 rounded-full bg-gray-600"></div>
                        <div className="absolute left-1/2 top-1/2 h-1/8 w-1/8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"></div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="absolute bottom-2 left-2 rounded bg-black bg-opacity-50 px-2 py-1 text-xs text-white">
                  常规单能CT
                </div>
              </div>
            </div>
          </div>
          
          <div className="rounded-md border border-border bg-bg-100 p-4">
            <div className="mb-2 text-sm font-medium text-text-100">双能CT重建</div>
            <div className="aspect-square w-full overflow-hidden rounded-md bg-black">
              <div className="relative h-full w-full">
                {/* 模拟双能CT重建图像 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {selectedCase === 'liver' && reconstructionType === 'virtual_noncontrast' && (
                    <div className="h-3/4 w-3/4 rounded-full bg-gray-600">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/4 w-1/4 rounded-full bg-gray-500"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/6 w-1/6 rounded-full bg-gray-500"></div>
                      </div>
                    </div>
                  )}
                  
                  {selectedCase === 'liver' && reconstructionType === 'iodine_overlay' && (
                    <div className="h-3/4 w-3/4 rounded-full bg-gray-700">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/4 w-1/4 rounded-full bg-blue-500"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/6 w-1/6 rounded-full bg-blue-500"></div>
                      </div>
                    </div>
                  )}
                  
                  {selectedCase === 'lung' && reconstructionType === 'lung_perfusion' && (
                    <div className="h-3/4 w-3/4 rounded-md bg-gray-900">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/3 w-1/3 rounded-full bg-gray-800"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/3 w-1/3 rounded-full bg-gray-800"></div>
                        <div className="absolute left-1/2 top-1/2 h-1/6 w-1/6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600"></div>
                      </div>
                    </div>
                  )}
                  
                  {selectedCase === 'kidney' && reconstructionType === 'virtual_noncontrast' && (
                    <div className="h-3/4 w-3/4 rounded-md bg-gray-600">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/3 w-1/4 rounded-full bg-gray-500"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/3 w-1/4 rounded-full bg-gray-500"></div>
                        <div className="absolute left-1/2 top-1/2 h-1/8 w-1/8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"></div>
                      </div>
                    </div>
                  )}
                  
                  {/* 默认显示 */}
                  {((selectedCase === 'liver' && (reconstructionType === 'bone_subtraction' || reconstructionType === 'lung_perfusion')) ||
                    (selectedCase === 'lung' && (reconstructionType === 'virtual_noncontrast' || reconstructionType === 'iodine_overlay' || reconstructionType === 'bone_subtraction')) ||
                    (selectedCase === 'kidney' && (reconstructionType === 'iodine_overlay' || reconstructionType === 'bone_subtraction' || reconstructionType === 'lung_perfusion'))) && (
                    <div className="flex h-full w-full items-center justify-center text-white">
                      <p>此重建类型不适用于当前病例</p>
                    </div>
                  )}
                </div>
                
                <div className="absolute bottom-2 left-2 rounded bg-black bg-opacity-50 px-2 py-1 text-xs text-white">
                  {reconstructionTypes.find(type => type.id === reconstructionType)?.label || ''}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="rounded-md border border-border bg-bg-100 p-4">
          <div className="mb-2 text-sm font-medium text-text-100">材料分解</div>
          <div className="h-64 w-full md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={materialComposition}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} label={{ value: '百分比 (%)', position: 'insideBottom', offset: -5 }} />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip formatter={(value) => [`${value}%`, '比例']} />
                <Legend />
                <Bar 
                  dataKey="conventional" 
                  name="常规CT" 
                  fill="#cccccc" 
                  radius={[0, 4, 4, 0]}
                />
                <Bar 
                  dataKey={reconstructionType} 
                  name={reconstructionTypes.find(type => type.id === reconstructionType)?.label || ''} 
                  fill="#FF8C00" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
<<<<<<< HEAD
      <div className="rounded-md bg-200 p-4 text-sm text-text-200">
=======
      <div className="rounded-md bg-bg-200 p-4 text-sm text-text-200">
>>>>>>> 5cc269c7d7bb3e0f9bea78d37883bea822dffc4c
        <h3 className="mb-2 font-medium text-text-100">说明</h3>
        <p>此模拟器展示了双能CT的不同重建类型：</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li><span className="font-medium">虚拟平扫</span>：移除碘造影剂的影响，模拟未注射造影剂的图像</li>
          <li><span className="font-medium">碘叠加</span>：突出显示含碘区域，有助于识别高血供病变</li>
          <li><span className="font-medium">骨骼减除</span>：移除骨骼，便于观察血管和软组织</li>
          <li><span className="font-medium">肺灌注</span>：评估肺部血流，有助于诊断肺栓塞</li>
        </ul>
        <p className="mt-2">不同的重建类型适用于不同的临床情况，材料分解图表显示了各种重建方法如何改变图像中不同材料的表现。</p>
      </div>
    </SimulatorContainer>
  );
};

export default DualEnergyReconstructionSimulator;
