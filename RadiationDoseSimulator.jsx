import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SimulatorContainer from './ui/SimulatorContainer';
import Select from './ui/Select';
import Slider from './ui/Slider';

const RadiationDoseSimulator = () => {
  const [gatingType, setGatingType] = useState('prospective');
  const [patientSize, setPatientSize] = useState('medium');
  const [chartData, setChartData] = useState([]);
  
  const gatingTypes = [
    { id: 'prospective', name: '前瞻性门控' },
    { id: 'retrospective', name: '回顾性门控' },
    { id: 'retrospective-modulation', name: '带ECG调制的回顾性门控' }
  ];
  
  const patientSizes = [
    { id: 'small', name: '小型患者' },
    { id: 'medium', name: '中型患者' },
    { id: 'large', name: '大型患者' }
  ];
  
  // 生成模拟数据
  useEffect(() => {
    const generateData = () => {
      // 基础剂量值（单位：mSv）
      const baseDose = {
        'prospective': 3,
        'retrospective': 12,
        'retrospective-modulation': 8
      };
      
      // 患者大小影响因子
      const sizeFactors = {
        'small': 0.8,
        'medium': 1.0,
        'large': 1.5
      };
      
      // 计算实际剂量
      const actualDose = baseDose[gatingType] * sizeFactors[patientSize];
      
      // 生成比较数据
      const data = [
        {
          name: '前瞻性门控',
          dose: baseDose['prospective'] * sizeFactors[patientSize],
          active: gatingType === 'prospective'
        },
        {
          name: '带ECG调制的回顾性门控',
          dose: baseDose['retrospective-modulation'] * sizeFactors[patientSize],
          active: gatingType === 'retrospective-modulation'
        },
        {
          name: '回顾性门控',
          dose: baseDose['retrospective'] * sizeFactors[patientSize],
          active: gatingType === 'retrospective'
        }
      ];
      
      setChartData(data);
    };
    
    generateData();
  }, [gatingType, patientSize]);

  return (
    <SimulatorContainer title="辐射剂量模拟器">
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select 
            label="门控类型" 
            options={gatingTypes} 
            value={gatingType} 
            onChange={setGatingType} 
          />
          
          <Select 
            label="患者大小" 
            options={patientSizes} 
            value={patientSize} 
            onChange={setPatientSize} 
          />
        </div>
        
        <div className="rounded-md border border-border bg-bg-100 p-4">
          <div className="mb-2 text-sm font-medium text-text-100">有效剂量比较 (mSv)</div>
          <div className="h-64 w-full md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: '有效剂量 (mSv)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => [`${value.toFixed(1)} mSv`, '有效剂量']} />
                <Legend />
                <Bar 
                  dataKey="dose" 
                  name="有效剂量" 
                  fill={(data) => data.active ? '#FF8C00' : '#cccccc'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border border-border bg-bg-100 p-4">
            <h3 className="mb-2 text-sm font-medium text-text-100">剂量比较</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-200">胸部X光片</span>
                <span className="font-medium text-text-100">0.1 mSv</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-200">常规胸部CT</span>
                <span className="font-medium text-text-100">7 mSv</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-200">当前心脏CT设置</span>
                <span className="font-medium text-primary-100">
                  {chartData.find(item => item.active)?.dose.toFixed(1) || 0} mSv
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-200">年自然背景辐射</span>
                <span className="font-medium text-text-100">3 mSv</span>
              </div>
            </div>
          </div>
          
          <div className="rounded-md border border-border bg-bg-100 p-4">
            <h3 className="mb-2 text-sm font-medium text-text-100">风险评估</h3>
            <div className="space-y-2">
              {(() => {
                const currentDose = chartData.find(item => item.active)?.dose || 0;
                let riskLevel, riskText;
                
                if (currentDose < 5) {
                  riskLevel = '低';
                  riskText = '相当于约1.5年的自然背景辐射';
                } else if (currentDose < 10) {
                  riskLevel = '中';
                  riskText = '相当于约3年的自然背景辐射';
                } else {
                  riskLevel = '高';
                  riskText = '相当于约4年的自然背景辐射';
                }
                
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-200">风险等级</span>
                      <span className={`font-medium ${
                        riskLevel === '低' ? 'text-green-500' : 
                        riskLevel === '中' ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {riskLevel}
                      </span>
                    </div>
                    <div className="text-sm text-text-200">
                      <p>{riskText}</p>
                      <p className="mt-2">辐射剂量应遵循ALARA原则：合理可行尽量低 (As Low As Reasonably Achievable)</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      
      <div className="rounded-md bg-200 p-4 text-sm text-text-200">
        <h3 className="mb-2 font-medium text-text-100">说明</h3>
        <p>此模拟器展示了不同心脏CT扫描协议的辐射剂量比较：</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li><span className="font-medium">前瞻性门控</span>：辐射剂量最低，但不能评估心脏功能</li>
          <li><span className="font-medium">带ECG调制的回顾性门控</span>：在心动周期的非关键阶段降低管电流，减少辐射剂量</li>
          <li><span className="font-medium">回顾性门控</span>：辐射剂量最高，但可以评估心脏功能</li>
        </ul>
        <p className="mt-2">患者大小也会影响辐射剂量，较大的患者需要更高的辐射剂量才能获得相同质量的图像。</p>
      </div>
    </SimulatorContainer>
  );
};

export default RadiationDoseSimulator;
