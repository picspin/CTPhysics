import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import SimulatorContainer from './ui/SimulatorContainer';
import Select from './ui/Select';
import Slider from './ui/Slider';

const BackprojectionSimulator = () => {
  const [selectedImage, setSelectedImage] = useState('phantom');
  const [fanBeamAngle, setFanBeamAngle] = useState(60);
  const [projectionCount, setProjectionCount] = useState(4);
  
  const images = [
    { id: 'phantom', name: '模型' },
    { id: 'abdomen', name: '腹部' }
  ];
  
  const fanBeamAngles = [
    { value: 30, name: '30度' },
    { value: 60, name: '60度' },
    { value: 90, name: '90度' }
  ];

  // 生成投影角度
  const generateProjectionAngles = (count) => {
    const angles = [];
    const step = 180 / count;
    for (let i = 0; i < count; i++) {
      angles.push(i * step);
    }
    return angles;
  };

  const projectionAngles = generateProjectionAngles(projectionCount);

  return (
    <SimulatorContainer title="反投影模拟器">
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select 
            label="选择图像" 
            options={images} 
            value={selectedImage} 
            onChange={setSelectedImage} 
          />
          
          <Select 
            label="扇形束角度" 
            options={fanBeamAngles} 
            value={fanBeamAngle} 
            onChange={(value) => setFanBeamAngle(parseInt(value))} 
          />
        </div>
        
        <Slider 
          label={`投影数量: ${projectionCount}`} 
          min={1} 
          max={16} 
          value={projectionCount} 
          onChange={setProjectionCount} 
          step={1} 
        />
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-md border border-border bg-bg-100 p-4">
            <div className="mb-2 text-sm font-medium text-text-100">原始图像</div>
            <div className="aspect-square w-full overflow-hidden rounded-md bg-black">
              <div className="flex h-full items-center justify-center text-white">
                {selectedImage === 'phantom' ? (
                  <div className="h-3/4 w-3/4 rounded-full border-4 border-white">
                    <div className="mx-auto mt-8 h-1/3 w-1/2 rounded-full border-4 border-white"></div>
                  </div>
                ) : (
                  <div className="h-3/4 w-3/4 rounded-md border-4 border-white">
                    <div className="mx-auto mt-8 h-1/3 w-1/2 rounded-full border-4 border-white"></div>
                    <div className="mx-auto mt-4 h-1/6 w-2/3 rounded-md border-4 border-white"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="rounded-md border border-border bg-bg-100 p-4">
            <div className="mb-2 text-sm font-medium text-text-100">反投影重建</div>
            <div className="aspect-square w-full overflow-hidden rounded-md bg-black">
              <div className="relative h-full w-full">
                {projectionAngles.map((angle, index) => (
                  <motion.div
                    key={index}
                    className="absolute inset-0 bg-primary-100 opacity-20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.2 }}
                    transition={{ duration: 0.5, delay: index * 0.2 }}
                    style={{
                      transform: `rotate(${angle}deg)`,
                      width: '100%',
                      height: fanBeamAngle === 90 ? '100%' : `${fanBeamAngle}%`,
                      marginTop: fanBeamAngle === 90 ? 0 : `${(100 - fanBeamAngle) / 2}%`
                    }}
                  />
                ))}
                
                {selectedImage === 'phantom' ? (
                  <div className="absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white opacity-30">
                    <div className="mx-auto mt-8 h-1/3 w-1/2 rounded-full border-4 border-white opacity-30"></div>
                  </div>
                ) : (
                  <div className="absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-md border-4 border-white opacity-30">
                    <div className="mx-auto mt-8 h-1/3 w-1/2 rounded-full border-4 border-white opacity-30"></div>
                    <div className="mx-auto mt-4 h-1/6 w-2/3 rounded-md border-4 border-white opacity-30"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <h3 className="mb-2 font-medium text-text-100">说明</h3>
        <p>此模拟器展示了CT重建中的反投影过程。左侧是原始图像，右侧是使用不同数量的投影角度进行反投影重建的结果。</p>
        <p className="mt-2">注意观察：随着投影数量的增加，重建图像变得更加清晰，但仍然存在模糊。这就是为什么实际CT重建中需要使用滤波反投影技术。</p>
      </div>
    </SimulatorContainer>
  );
};

export default BackprojectionSimulator;
