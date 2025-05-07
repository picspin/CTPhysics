import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import SimulatorContainer from '../../ui/SimulatorContainer';
import Select from '../../ui/Select';
import Slider from '../../ui/Slider';
import Button from '../../ui/Button';

const HelicalCTSimulator = ({ options }) => {
  const [selectedImage, setSelectedImage] = useState(options?.images?.[0]?.id || 'body');
  const [pitch, setPitch] = useState(1.0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [slices, setSlices] = useState([]);
  
  const images = options?.images || [
    { id: 'body', name: '人体模型' },
    { id: 'helical_30', name: '螺旋CT 30°' },
    { id: 'helical_60', name: '螺旋CT 60°' },
    { id: 'helical_90', name: '螺旋CT 90°' }
  ];
  
  const pitchValues = options?.pitchValues || [
    { value: 0.5, name: '0.5 (重叠扫描)', description: '相邻螺旋之间有50%的重叠，图像质量高但辐射剂量大' },
    { value: 1.0, name: '1.0 (无间隙扫描)', description: '相邻螺旋之间刚好无间隙，平衡了图像质量和辐射剂量' },
    { value: 1.5, name: '1.5 (小间隙扫描)', description: '相邻螺旋之间有小间隙，扫描速度较快，可能有轻微信息丢失' },
    { value: 2.0, name: '2.0 (大间隙扫描)', description: '相邻螺旋之间有大间隙，扫描速度快但可能丢失信息' }
  ];
  
  // 获取当前螺距的描述
  const getCurrentPitchDescription = () => {
    const pitchValue = parseFloat(pitch);
    const pitchOption = pitchValues.find(p => parseFloat(p.value) === pitchValue);
    return pitchOption?.description || '';
  };

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
          // 调整速度，使动画更平滑
          const increment = 0.5; // 每帧增加0.5%
          const next = prev + increment;
          
          // 每当扫描到一个新的切片位置时添加切片
          if (Math.floor(next / 5) > Math.floor(prev / 5)) {
            const newSlicePosition = Math.floor(next / 5) * 5;
            
            // 根据螺距决定是否添加切片
            // 螺距越小，切片越多（重叠越多）
            // 螺距越大，切片越少（间隙越大）
            const sliceThreshold = pitch * 5;
            if (newSlicePosition % sliceThreshold < increment * 10) {
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
      
      // 短暂延迟后开始动画，给用户视觉反馈
      timer = setTimeout(() => {
        animationFrame = requestAnimationFrame(animate);
      }, 300);
    }
    
    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timer);
    };
  }, [isScanning, scanProgress, pitch]);

  return (
    <SimulatorContainer title="螺旋CT模拟器">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select 
            label="选择扫描对象" 
            options={images} 
            value={selectedImage} 
            onChange={setSelectedImage} 
          />
          
          <Select 
            label="螺距 (Pitch)" 
            options={pitchValues.map(p => ({ id: p.value, name: p.name }))} 
            value={pitch} 
            onChange={(value) => setPitch(parseFloat(value))} 
          />
        </div>
        
        <div className="mt-4 rounded-md border border-border bg-bg-100 p-4">
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
            <div className="relative h-72 w-full max-w-md overflow-hidden rounded-md bg-black md:h-80">
              {/* 患者体模 */}
              {selectedImage && (
                <div className="absolute left-1/2 top-0 h-full w-full -translate-x-1/2 flex justify-center items-center">
                  <img 
                    src={`/images/${selectedImage}.${selectedImage.includes('helical_') ? 'gif' : 'png'}`} 
                    alt={images.find(img => img.id === selectedImage)?.name || '扫描对象'}
                    className="h-full object-contain"
                    onError={(e) => {
                      // 尝试多种可能的文件名格式和扩展名
                      const possibleExtensions = ['png', 'gif', 'jpg', 'jpeg'];
                      const currentExt = e.target.src.split('.').pop();
                      const basePath = `/images/${selectedImage}`;
                      
                      // 尝试不同的扩展名
                      const nextExtIndex = possibleExtensions.indexOf(currentExt) + 1;
                      if (nextExtIndex < possibleExtensions.length) {
                        const nextExt = possibleExtensions[nextExtIndex];
                        console.log(`尝试加载图像: ${basePath}.${nextExt}`);
                        e.target.src = `${basePath}.${nextExt}`;
                      } else {
                        // 如果所有扩展名都尝试过，尝试备用图像
                        const fallbackImage = 'body';
                        if (selectedImage !== fallbackImage) {
                          console.log(`尝试加载备用图像: ${fallbackImage}`);
                          e.target.src = `/images/${fallbackImage}.png`;
                          e.target.onerror = () => {
                            console.error(`无法加载任何图像`);
                            e.target.style.display = 'none';
                          };
                        } else {
                          console.error(`无法加载图像`);
                          e.target.style.display = 'none';
                        }
                      }
                    }}
                  />
                </div>
              )}
              
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
                <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-accent-100">
                  {/* X射线束 - 仅在扫描时显示 */}
                  {isScanning && (
                    <div className="absolute left-1/2 top-1/2 h-1 w-24 -translate-x-0 -translate-y-1/2 bg-accent-100/30 animate-pulse" 
                      style={{ transformOrigin: 'left center' }}
                    />
                  )}
                </div>
                {/* 探测器 */}
                <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-accent-100" />
              </motion.div>
              
              {/* 扫描切片 */}
              {slices.map((position, index) => (
                <motion.div
                  key={index}
                  className="absolute left-1/2 z-0 -translate-x-1/2"
                  style={{ top: `${position}%` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* 切片可视化 - 根据螺距调整宽度和颜色 */}
                  <div 
                    className={`h-2 rounded-full ${pitch <= 1 ? 'bg-green-500' : pitch < 2 ? 'bg-blue-500' : 'bg-red-500'}`}
                    style={{ 
                      width: `${Math.max(24, 48 / pitch)}px`, // 螺距越小，切片越宽（表示重叠）
                      opacity: pitch <= 1 ? 0.6 : 0.4 // 螺距越小，切片越明显
                    }}
                  />
                </motion.div>
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
      
      <div className="mt-4 rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <h3 className="mb-2 font-medium text-text-100">说明</h3>
        <p>此模拟器展示了螺旋CT的扫描过程。在螺旋CT中，X射线管和探测器连续旋转，同时患者床持续移动，形成螺旋扫描路径。</p>
        
        <div className="mt-2 space-y-2">
          <p><strong>螺距</strong>是指床移动距离与准直器宽度的比值：</p>
          <ul className="list-inside list-disc space-y-1">
            {pitchValues.map((pv) => (
              <li key={pv.value}>螺距 = {pv.value}：{pv.description}</li>
            ))}
          </ul>
        </div>
        
        <div className="mt-3">
          <p><strong>当前螺距：</strong> {getCurrentPitchDescription()}</p>
          <p className="mt-1"><strong>获取的切片数：</strong> {slices.length} 个</p>
        </div>
      </div>
    </SimulatorContainer>
  );
};

export default HelicalCTSimulator;
