import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import SimulatorContainer from './ui/SimulatorContainer';
import Select from './ui/Select';
import Slider from './ui/Slider';
import Button from './ui/Button';

const CardiacGatingSimulator = () => {
  const [gatingType, setGatingType] = useState('prospective');
  const [heartRate, setHeartRate] = useState(70);
  const [isScanning, setIsScanning] = useState(false);
  const [ecgData, setEcgData] = useState([]);
  const [acquisitionPoints, setAcquisitionPoints] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  
  // 响应式设计：检测视口宽度
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    // 初始检查
    checkMobile();
    
    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  // 生成ECG数据
  useEffect(() => {
    const generateEcgData = () => {
      const data = [];
      const cycleLength = 60 / heartRate; // 心动周期长度（秒）
      const pointsPerCycle = 50; // 每个心动周期的数据点数
      const totalPoints = 5 * pointsPerCycle; // 总共5个心动周期
      
      for (let i = 0; i < totalPoints; i++) {
        const time = (i / pointsPerCycle) * cycleLength;
        const cyclePosition = (i % pointsPerCycle) / pointsPerCycle;
        
        // 模拟ECG波形
        let value = 0;
        if (cyclePosition < 0.1) {
          // P波
          value = 0.3 * Math.sin(cyclePosition * Math.PI / 0.1);
        } else if (cyclePosition >= 0.2 && cyclePosition < 0.3) {
          // QRS波群
          if (cyclePosition < 0.22) {
            // Q波
            value = -0.2;
          } else if (cyclePosition < 0.25) {
            // R波
            value = 1.0;
          } else {
            // S波
            value = -0.3;
          }
        } else if (cyclePosition >= 0.35 && cyclePosition < 0.45) {
          // T波
          value = 0.4 * Math.sin((cyclePosition - 0.35) * Math.PI / 0.1);
        }
        
        // 添加一些随机噪声
        value += (Math.random() - 0.5) * 0.05;
        
        data.push({ time, value });
      }
      
      setEcgData(data);
    };
    
    generateEcgData();
  }, [heartRate]);
  
  // 开始扫描动画
  const startScan = () => {
    setIsScanning(true);
    setCurrentTime(0);
    setAcquisitionPoints([]);
  };
  
  // 扫描进度更新
  useEffect(() => {
    let animationFrame;
    
    if (isScanning) {
      const animate = () => {
        setCurrentTime((prev) => {
          const cycleLength = 60 / heartRate; // 心动周期长度（秒）
          const next = prev + 0.02;
          
          // 确定是否需要采集数据
          if (gatingType === 'prospective') {
            // 前瞻性门控：只在舒张中期（心动周期的70%左右）采集数据
            const currentCycle = Math.floor(next / cycleLength);
            const previousCycle = Math.floor(prev / cycleLength);
            const cyclePosition = (next % cycleLength) / cycleLength;
            
            if (currentCycle > previousCycle || (currentCycle === previousCycle && cyclePosition >= 0.7 && prev % cycleLength / cycleLength < 0.7)) {
              setAcquisitionPoints((prevPoints) => [...prevPoints, { time: next, value: getEcgValueAtTime(next) }]);
            }
          } else {
            // 回顾性门控：连续采集数据
            if (Math.floor(next * 20) > Math.floor(prev * 20)) {
              setAcquisitionPoints((prevPoints) => [...prevPoints, { time: next, value: getEcgValueAtTime(next) }]);
            }
          }
          
          if (next >= 5 * cycleLength) {
            setIsScanning(false);
            return 0;
          }
          return next;
        });
        
        if (currentTime < 5 * 60 / heartRate) {
          animationFrame = requestAnimationFrame(animate);
        }
      };
      
      animationFrame = requestAnimationFrame(animate);
    }
    
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isScanning, currentTime, heartRate, gatingType]);
  
  // 根据时间获取ECG值
  const getEcgValueAtTime = (time) => {
    const cycleLength = 60 / heartRate;
    const pointsPerCycle = 50;
    const index = Math.floor((time % (5 * cycleLength)) / (5 * cycleLength) * ecgData.length);
    return ecgData[index]?.value || 0;
  };

  return (
    <SimulatorContainer title="心脏门控模拟器">
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select 
            label="门控类型" 
            options={gatingTypes} 
            value={gatingType} 
            onChange={setGatingType} 
          />
          
          <Slider 
            label={`心率: ${heartRate} bpm`} 
            min={50} 
            max={100} 
            value={heartRate} 
            onChange={setHeartRate} 
            step={5} 
          />
        </div>
        
        <div className="rounded-md border border-border-100 bg-bg-100 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text-100">ECG波形与数据采集</span>
            <Button 
              onClick={startScan} 
              disabled={isScanning}
              size={isMobile ? "sm" : "md"}
            >
              {isScanning ? '扫描中...' : '开始扫描'}
            </Button>
          </div>
          
          <div className="relative h-56 w-full overflow-hidden rounded-md bg-black p-2 sm:h-64">
            {/* ECG网格背景 */}
            <div className="absolute inset-0 grid grid-cols-10 grid-rows-10">
              {Array.from({ length: 100 }).map((_, i) => (
                <div key={i} className="border border-gray-800" />
              ))}
            </div>
            
            {/* ECG波形 */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 500" preserveAspectRatio="none">
              <polyline
                points={ecgData.map((point, i) => `${(point.time / (5 * 60 / heartRate)) * 1000},${250 - point.value * 200}`).join(' ')}
                fill="none"
                stroke="#4A90E2"
                strokeWidth="2"
              />
              
              {/* 当前时间指示器 */}
              {isScanning && (
                <line
                  x1={(currentTime / (5 * 60 / heartRate)) * 1000}
                  y1="0"
                  x2={(currentTime / (5 * 60 / heartRate)) * 1000}
                  y2="500"
                  stroke="#FF8C00"
                  strokeWidth="2"
                />
              )}
              
              {/* 数据采集点 */}
              {acquisitionPoints.map((point, i) => (
                <circle
                  key={i}
                  cx={(point.time / (5 * 60 / heartRate)) * 1000}
                  cy={250 - point.value * 200}
                  r={isMobile ? "3" : "4"}
                  fill={gatingType === 'prospective' ? '#FF8C00' : '#dc7000'}
                />
              ))}
            </svg>
            
            {/* 心脏示意图 */}
            <motion.div
              className="absolute bottom-4 right-4 h-12 w-12 rounded-full bg-red-500 opacity-70 sm:h-16 sm:w-16"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.7, 0.9, 0.7]
              }}
              transition={{ 
                duration: 60 / heartRate,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>
          
          <div className="mt-4 flex flex-col justify-between space-y-2 text-sm text-text-200 sm:flex-row sm:space-y-0">
            <span>采集点数量: {acquisitionPoints.length}</span>
            <span className="text-xs sm:text-sm">
              {gatingType === 'prospective' 
                ? '前瞻性门控: 仅在舒张中期采集数据' 
                : '回顾性门控: 连续采集整个心动周期的数据'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="rounded-md bg-bg-200 p-3 text-sm text-text-200 sm:p-4">
        <h3 className="mb-2 font-medium text-text-100">说明</h3>
        <p>此模拟器展示了心脏CT中的门控技术：</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li><span className="font-medium">前瞻性门控</span>：仅在预测的心动周期特定阶段（通常是舒张中期）获取数据，辐射剂量较低</li>
          <li><span className="font-medium">回顾性门控</span>：在整个心动周期连续获取数据，然后在重建时选择最佳相位，辐射剂量较高但可以评估心脏功能</li>
        </ul>
        <p className="mt-2">心率越高，心动周期越短，获取清晰图像的难度越大。</p>
      </div>
    </SimulatorContainer>
  );
};

export default CardiacGatingSimulator;
