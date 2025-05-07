import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SimulatorContainer from '../../ui/SimulatorContainer';
import Select from '../../ui/Select';
import Slider from '../../ui/Slider';

const XrayAttenuationSimulator = () => {
  const [selectedTissue, setSelectedTissue] = useState('soft_tissue');
  const [iodineConcentration, setIodineConcentration] = useState(5);
  const [chartData, setChartData] = useState([]);
  
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
    const generateData = () => {
      const data = [];
      // 从20到140 keV生成数据点
      for (let energy = 20; energy <= 140; energy += 5) {
        const dataPoint = {
          energy,
          soft_tissue: calculateAttenuation('soft_tissue', energy),
          fat: calculateAttenuation('fat', energy),
          bone: calculateAttenuation('bone', energy),
          iodine: calculateAttenuation('iodine', energy, iodineConcentration),
          iodine_enhanced: calculateAttenuation('iodine_enhanced', energy, iodineConcentration),
          water: calculateAttenuation('water', energy),
          air: calculateAttenuation('air', energy)
        };
        data.push(dataPoint);
      }
      setChartData(data);
    };
    
    generateData();
  }, [iodineConcentration]);
  
  // 计算不同材料在不同能量下的衰减系数（模拟数据）
  const calculateAttenuation = (tissue, energy, concentration = 5) => {
    // 这些是模拟值，实际应用中应使用真实物理数据
    const baseValues = {
      soft_tissue: 0.3,
      fat: 0.2,
      bone: 0.7,
      iodine: 1.5,
      iodine_enhanced: 0.4,
      water: 0.25,
      air: 0.01
    };
    
    // 模拟光电效应的能量依赖性 (Z/E)^3
    let attenuation = baseValues[tissue] * Math.pow(80/energy, 2.5);
    
    // 为碘添加K边缘效应（33 keV）
    if ((tissue === 'iodine' || tissue === 'iodine_enhanced') && energy >= 33 && energy < 40) {
      attenuation *= 2.5 - (energy - 33) * 0.2; // K边缘后迅速下降
    }
    
    // 为碘造影剂添加浓度依赖性
    if (tissue === 'iodine') {
      attenuation *= concentration / 5;
    } else if (tissue === 'iodine_enhanced') {
      // 碘增强器官 = 软组织 + 碘的贡献
      attenuation = baseValues.soft_tissue * Math.pow(80/energy, 2.5) + 
                    (concentration / 10) * baseValues.iodine * Math.pow(80/energy, 2.5);
      
      if (energy >= 33 && energy < 40) {
        attenuation += (concentration / 10) * baseValues.iodine * (2.5 - (energy - 33) * 0.2);
      }
    }
    
    return attenuation;
  };
  
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
      </div>
    </SimulatorContainer>
  );
};

export default XrayAttenuationSimulator;
