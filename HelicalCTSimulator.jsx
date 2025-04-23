import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import SimulatorContainer from '../ui/SimulatorContainer';
import Select from '../ui/Select';
import Slider from '../ui/Slider';
import Button from '../ui/Button';

const HelicalCTSimulator = () => {
  const [selectedImage, setSelectedImage] = useState('fracture');
  const [pitch, setPitch] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [slices, setSlices] = useState([]);
  
  const images = [
    { id: 'fracture', name: '骨折' },
    { id: 'liverLesions', name: '肝脏病变' }
  ];
  
  const pitchValues = [
    { value: 0.5, name: '0.5 (重叠)' },
    { value: 1, name: '1.0 (无间隙)' },
    { value: 1.5, name: '1.5 (小间隙)' },
    { value: 2, name: '2.0 (大间隙)' }
  ];

  // 开始扫描动画
  const startScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setSlices([]);
  };

  // 扫描进度更新
  useEffect(() => {
    let animationFrame;
    let timer;
    
    if (isScanning) {
      const animate = () => {
        setScanProgress((prev) => {
          const next = prev + 0.5;
          
          // 每当扫描到一个新的切片位置时添加切片
          if (Math.floor(next / 10) > Math.floor(prev / 10)) {
            const newSlicePosition = Math.floor(next / 10) * 10;
            
            // 根据螺距决定是否添加切片（螺距越大，切片越少）
            if (newSlicePosition % (pitch * 10) < 1) {
              setSlices((prevSlices) => [...prevSlices, newSlicePosition]);
            }
          }
          
          if (next >= 100) {
            setIsScanning(false);
            return 100;
          }
          return next;
        });
        
        if (scanProgress < 100) {
          animationFrame = requestAnimationFrame(animate);
        }
      };
      
      timer = setTimeout(() => {
        animationFrame = requestAnimationFrame(animate);
      }, 500);
    }
    
    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timer);
    };
  }, [isScanning, scanProgress, pitch]);

  return (
    <SimulatorContainer title="螺旋CT模拟器">
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select 
            label="选择扫描对象" 
            options={images} 
            value={selectedImage} 
            onChange={setSelectedImage} 
          />
          
          <Select 
            label="螺距 (Pitch)" 
            options={pitchValues} 
            value={pitch} 
            onChange={(value) => setPitch(parseFloat(value))} 
          />
        </div>
        
        <div className="rounded-md border border-border bg-bg-100 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text-100">扫描进度</span>
            <Button 
              onClick={startScan} 
              disabled={isScanning}
              size="sm"
            >
              {isScanning ? '扫描中...' : '开始扫描'}
            </Button>
          </div>
          
          <div className="h-8 w-full overflow-hidden rounded-full bg-bg-200">
            <motion.div 
              className="h-full bg-primary-100"
              style={{ width: `${scanProgress}%` }}
              initial={{ width: '0%' }}
              animate={{ width: `${scanProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          <div className="mt-6 flex flex-col items-center">
            <div className="relative h-64 w-full max-w-md overflow-hidden rounded-md bg-black">
              {/* 患者体模 */}
              <div className="absolute left-1/2 top-0 h-full w-24 -translate-x-1/2 bg-bg-300 opacity-30" />
              
              {/* CT扫描环 */}
              <motion.div 
                className="absolute left-1/2 top-0 z-10 h-12 w-48 -translate-x-1/2 rounded-full border-4 border-primary-100"
                style={{ 
                  top: `${scanProgress}%`,
                  display: isScanning || scanProgress > 0 ? 'block' : 'none'
                }}
                animate={{ 
                  rotate: isScanning ? 360 : 0 
                }}
                transition={{ 
                  duration: 1,
                  repeat: isScanning ? Infinity : 0,
                  ease: "linear"
                }}
              >
                {/* X射线源 */}
                <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-accent-100" />
                {/* 探测器 */}
                <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-accent-100" />
              </motion.div>
              
              {/* 扫描切片 */}
              {slices.map((position, index) => (
                <motion.div
                  key={index}
                  className="absolute left-1/2 z-0 h-2 w-24 -translate-x-1/2 bg-primary-100 opacity-40"
                  style={{ top: `${position}%` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
            
            <div className="mt-4 text-center text-sm text-text-200">
              {slices.length > 0 ? (
                <p>已获取 {slices.length} 个切片</p>
              ) : (
                <p>点击"开始扫描"按钮开始模拟螺旋CT扫描</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <h3 className="mb-2 font-medium text-text-100">说明</h3>
        <p>此模拟器展示了螺旋CT的扫描过程。螺距是指床移动距离与准直器宽度的比值：</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>螺距 = 0.5：相邻螺旋之间有50%的重叠，图像质量高但辐射剂量大</li>
          <li>螺距 = 1.0：相邻螺旋之间刚好无间隙</li>
          <li>螺距 = 1.5 或 2.0：相邻螺旋之间有间隙，扫描速度快但可能丢失信息</li>
        </ul>
      </div>
    </SimulatorContainer>
  );
};

export default HelicalCTSimulator;
