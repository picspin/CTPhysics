'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Select from '../../ui/Select';
import Slider from '../../ui/Slider';
import Button from '../../ui/Button';

const BackprojectionSimulator = ({ options }) => {
  // 使用options中的配置，如果没有则使用默认值
  const defaultImages = [
    { id: 'phantom', name: '模型' },
    { id: 'abdomen', name: '腹部' }
  ];
  
  const defaultFanBeamAngles = [
    { value: 30, name: '30度' },
    { value: 60, name: '60度' },
    { value: 90, name: '90度' }
  ];
  
  const images = options?.images || defaultImages;
  const fanBeamAngles = options?.fanBeamAngles || defaultFanBeamAngles;
  
  const [selectedImage, setSelectedImage] = useState(images[0]?.id || 'phantom');
  const [fanBeamAngle, setFanBeamAngle] = useState(fanBeamAngles[0]?.value || 60);
  const [projectionCount, setProjectionCount] = useState(4);
  const [isFiltered, setIsFiltered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  
  // 用于动画的引用
  const animationRef = useRef(null);

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
  
  // 开始动画
  const startAnimation = () => {
    console.log('startAnimation called. Current state:', { isAnimating }); // Add log
    if (isAnimating) {
      // 如果已经在动画中，则停止
      clearTimeout(animationRef.current);
      setIsAnimating(false);
      return;
    }
    
    setIsAnimating(true);
    setCurrentAngle(0); // 重置角度
    
    // 启动动画
    const animate = () => {
      setCurrentAngle(prevAngle => {
        const newAngle = (prevAngle + 2) % 180; // 每次增加2度，最大180度
        return newAngle;
      });
      
      animationRef.current = setTimeout(() => {
        if (currentAngle >= 178) {
          // 动画完成
          setIsAnimating(false);
          return;
        }
        requestAnimationFrame(animate);
      }, 50); // 约20帧/秒
    };
    
    animate();
  };

  // 停止动画
  useEffect(() => {
    return () => {
      clearTimeout(animationRef.current);
    };
  }, []);

  // 获取内核图像
  const getKernelImage = () => {
    if (!isFiltered) return 'kernel_unfilt.png';
    return 'kernel_med.png';
  };
  
  // 获取重建图像路径
  const getReconstructionImagePath = () => {
    // 尝试使用从xrayphysics.com爬取的图像
    // 如果图像不存在，将回退到默认图像
    return `/images/${selectedImage}_${isFiltered ? 'filtered' : 'unfiltered'}_${projectionCount}.png`;
  };

  // Handler for checkbox
  const handleFilterChange = (e) => {
    console.log('Filter checkbox changed:', e.target.checked); // Add log
    setIsFiltered(e.target.checked);
  };
  // 动态生成投影线的样式
  const getProjectionLineStyle = (angle, beamAngle) => {
    return {
      transform: `rotate(${angle}deg)`,
      width: '100%',
      height: beamAngle === 90 ? '100%' : `${beamAngle}%`,
      marginTop: beamAngle === 90 ? 0 : `${(100 - beamAngle) / 2}%`
    };
  };

  // 计算当前应该显示的投影线
  const getVisibleProjections = () => {
    if (isAnimating) {
      // 动画中，只显示当前角度的投影线
      return [currentAngle];
    } else {
      // 静态显示，显示所有投影线
      return projectionAngles;
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select 
            label="选择图像" 
            options={images} 
            value={selectedImage} 
            onChange={(value) => {
              console.log('Image selected:', value); // Add log
              setSelectedImage(value);
            }} 
          />
          
          <Select 
            label="扇形束角度" 
            options={fanBeamAngles} 
            value={fanBeamAngle} 
            onChange={(value) => {
              console.log('Fan beam angle selected:', value); // Add log
              setFanBeamAngle(parseInt(value));
            }} 
          />
        </div>
        
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-4 sm:space-y-0">
          <div className="flex-grow">
            <Slider 
              label={`投影数量: ${projectionCount}`} 
              min={1} 
              max={16} 
              value={projectionCount}
              onChange={(value) => {
                console.log('Projection count changed:', value); // Add log
                setProjectionCount(value);
              }} 
              step={1} 
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isFiltered}
                onChange={handleFilterChange} // Use handler
                className="h-4 w-4 rounded border-gray-300 text-primary-100 focus:ring-primary-100"
              />
              <span className="text-sm font-medium text-text-100">滤波反投影</span>
            </label>
            
            <Button 
              onClick={startAnimation} 
              disabled={false}
              size="sm"
            >
              {isAnimating ? '停止动画' : '开始重建'}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-md border border-border bg-bg-100 p-4">
            <div className="mb-2 text-sm font-medium text-text-100">原始图像</div>
            <div className="aspect-square w-full overflow-hidden rounded-md bg-black">
              <div className="relative h-full w-full">
                <img 
                  src={`/images/${selectedImage}.png`} 
                  alt={selectedImage === 'phantom' ? '模型' : '腹部'}
                  className="absolute inset-0 h-full w-full object-contain"
                  onError={(e) => {
                    // 如果图像加载失败，显示占位符
                    e.target.style.display = 'none';
                  }}
                />
                
                {/* 占位图像（当真实图像不可用时） */}
                <div className="absolute inset-0 flex h-full w-full items-center justify-center">
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
          </div>
          
          <div className="rounded-md border border-border bg-bg-100 p-4">
            <div className="mb-2 text-sm font-medium text-text-100">
              {isFiltered ? '滤波反投影重建' : '反投影重建'}
            </div>
            <div className="aspect-square w-full overflow-hidden rounded-md bg-black">
              <div className="relative h-full w-full">
                {/* 动态投影线 */}
                {isAnimating ? (
                  <motion.div
                    key="animation-line"
                    className="absolute inset-0 bg-primary-100"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.15 }}
                    style={getProjectionLineStyle(currentAngle, fanBeamAngle)}
                  />
                ) : (
                  projectionAngles.map((angle, index) => (
                    <motion.div
                      key={index}
                      className="absolute inset-0 bg-primary-100"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.15 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      style={getProjectionLineStyle(angle, fanBeamAngle)}
                    />
                  ))
                )}
                
                {/* 重建结果 */}
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isAnimating ? 0.5 : 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <img 
                    src={getReconstructionImagePath()} 
                    alt={`${isFiltered ? '滤波' : ''}反投影重建结果`}
                    className="h-full w-full object-contain opacity-70"
                    onError={(e) => {
                      // 如果特定重建图像不可用，显示占位符
                      e.target.style.display = 'none';
                    }}
                  />
                  
                  {/* 占位图像（当真实图像不可用时） */}
                  <div className="absolute inset-0 flex h-full w-full items-center justify-center">
                    {selectedImage === 'phantom' ? (
                      <div className="h-3/4 w-3/4 rounded-full border-4 border-white opacity-30">
                        <div className="mx-auto mt-8 h-1/3 w-1/2 rounded-full border-4 border-white"></div>
                      </div>
                    ) : (
                      <div className="h-3/4 w-3/4 rounded-md border-4 border-white opacity-30">
                        <div className="mx-auto mt-8 h-1/3 w-1/2 rounded-full border-4 border-white"></div>
                        <div className="mx-auto mt-4 h-1/6 w-2/3 rounded-md border-4 border-white"></div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <h3 className="mb-2 font-medium text-text-100">说明</h3>
        <p>此模拟器展示了CT重建中的反投影过程。左侧是原始图像，右侧是使用不同数量的投影角度进行反投影重建的结果。</p>
        <p className="mt-2">注意观察：</p>
        <ul className="mt-1 list-inside list-disc space-y-1">
          <li>随着投影数量的增加，重建图像变得更加清晰</li>
          <li>标准反投影会产生模糊的图像</li>
          <li>滤波反投影通过应用高通滤波器减少模糊，提高空间分辨率</li>
          <li>扇形束角度影响投影的覆盖范围</li>
        </ul>
        <div className="mt-4 flex items-center justify-center">
          <div className="rounded-md border border-border bg-bg-100 p-2">
            <img 
              src={`/images/${getKernelImage()}`} 
              alt="滤波内核" 
              className="h-24 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <p className="mt-1 text-center text-xs">{isFiltered ? '滤波内核' : '无滤波'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackprojectionSimulator;
