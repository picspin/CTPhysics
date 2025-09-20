import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import SimulatorContainer from '../../ui/SimulatorContainer';
import Select from '../../ui/Select';
import Slider from '../../ui/Slider';
import { generateAttenuationDataset } from '../../lib/physics/attenuation';

const XrayAttenuationSimulator = () => {
  const [selectedTissue, setSelectedTissue] = useState('soft_tissue');
  const [iodineConcentration, setIodineConcentration] = useState(5);
  const [chartData, setChartData] = useState([]);
  const [highlightKEdge, setHighlightKEdge] = useState(true);
  
  const tissues = [
    { id: 'soft_tissue', name: '软组织（如肌肉）' },
    { id: 'fat', name: '脂肪' },
    { id: 'bone', name: '骨骼' },
    { id: 'iodine', name: '碘造影剂' },
    { id: 'iodine_enhanced', name: '碘增强器官' },
    { id: 'water', name: '水' },
    { id: 'air', name: '空气' }
  ];
  
  // 生成模拟数据
  useEffect(() => {
    const energies = Array.from({ length: ((140 - 20) / 5) + 1 }, (_, i) => 20 + i * 5);
    setChartData(generateAttenuationDataset(energies, iodineConcentration));
  }, [iodineConcentration]);
  
  // 计算逻辑已集中到 lib/physics/attenuation
  
  // 获取图表中显示的线条颜色
  const getLineColor = (tissue) => {
    const colors = {
      soft_tissue: '#FF8C00', // 主题色
      fat: '#FFC107',
      bone: '#795548',
      iodine: '#4A90E2', // 强调色
      iodine_enhanced: '#003a80',
      water: '#00BCD4',
      air: '#9E9E9E'
    };
    return colors[tissue] || '#000000';
  };

  return (
    <SimulatorContainer title="X射线衰减模拟器">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select 
            label="选择组织类型" 
            options={tissues} 
            value={selectedTissue} 
            onChange={setSelectedTissue} 
          />
          
          {(selectedTissue === 'iodine' || selectedTissue === 'iodine_enhanced') && (
            <Slider 
              label="碘浓度 (mg/ml)" 
              min={1} 
              max={10} 
              value={iodineConcentration} 
              onChange={setIodineConcentration} 
              step={1} 
            />
          )}
        </div>
        
        <div className="mt-4 rounded-md border border-border bg-bg-100 p-4">
          <div className="mb-4 text-sm font-medium text-text-100">X射线能量与衰减系数关系</div>
          <div className="h-72 w-full md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="energy" 
                  label={{ value: 'X射线能量 (keV)', position: 'insideBottomRight', offset: -10 }} 
                />
                <YAxis 
                  label={{ value: '衰减系数 (cm⁻¹)', angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip formatter={(value) => [value.toFixed(2), '衰减系数']} />
                <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ paddingTop: 10 }} />
                {highlightKEdge && (
                  <ReferenceArea x1={33} x2={40} y1={0} y2={Number.MAX_VALUE} strokeOpacity={0.3} fill="#4A90E2" fillOpacity={0.05} />
                )}
                {tissues.map(tissue => (
                  <Line
                    key={tissue.id}
                    type="monotone"
                    dataKey={tissue.id}
                    name={tissue.name}
                    stroke={getLineColor(tissue.id)}
                    dot={false}
                    strokeWidth={selectedTissue === tissue.id ? 3 : 1}
                    opacity={selectedTissue === tissue.id || selectedTissue === 'all' ? 1 : 0.3}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="mt-4 rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <h3 className="mb-2 font-medium text-text-100">说明</h3>
        <p>此模拟器展示了不同组织在不同X射线能量下的衰减特性。注意碘在33 keV处的K边缘效应，这是双能CT的基础。</p>
        <p className="mt-2">图表中的衰减系数是模拟值，用于教育目的。在实际临床应用中，这些值会根据具体的组织成分和密度而变化。</p>
        <div className="mt-3 flex items-center space-x-3">
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="h-4 w-4" checked={highlightKEdge} onChange={(e) => setHighlightKEdge(e.target.checked)} />
            <span>高亮碘K边缘 (33–40 keV)</span>
          </label>
        </div>
      </div>
    </SimulatorContainer>
  );
};

export default XrayAttenuationSimulator;
