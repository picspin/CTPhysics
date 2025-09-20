import React, { useState, useEffect, useMemo, useRef } from 'react';
import SimulatorContainer from '../../ui/SimulatorContainer';
import Select from '../../ui/Select';
import Slider from '../../ui/Slider';
import { generateAttenuationDataset } from '../../lib/physics/attenuation';
import { scaleLinear, line as d3Line } from 'd3';

const XrayAttenuationSimulator = () => {
  const [selectedTissue, setSelectedTissue] = useState('soft_tissue');
  const [iodineConcentration, setIodineConcentration] = useState(5);
  const [chartData, setChartData] = useState([]);
  const [highlightKEdge, setHighlightKEdge] = useState(true);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 640, height: 320 });
  
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

  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setSize({ width: Math.max(300, w), height: 320 });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  
  // 计算逻辑已集中到 lib/physics/attenuation
  
  // 获取图表中显示的线条颜色
  const getLineColor = (tissue) => {
    const colors = {
      soft_tissue: '#111827',
      fat: '#6B7280',
      bone: '#1F2937',
      iodine: '#2563EB',
      iodine_enhanced: '#0EA5E9',
      water: '#059669',
      air: '#9CA3AF'
    };
    return colors[tissue] || '#000000';
  };

  const paths = useMemo(() => {
    if (!chartData.length) return { lines: {}, x: null, y: null };
    const padding = { top: 10, right: 12, bottom: 30, left: 40 };
    const innerW = size.width - padding.left - padding.right;
    const innerH = size.height - padding.top - padding.bottom;
    const x = scaleLinear().domain([20, 140]).range([0, innerW]);
    const maxY = Math.max(
      ...chartData.flatMap(d => [d.soft_tissue, d.fat, d.bone, d.iodine, d.iodine_enhanced, d.water, d.air])
    );
    const y = scaleLinear().domain([0, maxY * 1.1]).range([innerH, 0]);
    const mk = (key) => d3Line().x(d => x(d.energy)).y(d => y(d[key]))(chartData);
    const lines = {
      soft_tissue: mk('soft_tissue'),
      fat: mk('fat'),
      bone: mk('bone'),
      iodine: mk('iodine'),
      iodine_enhanced: mk('iodine_enhanced'),
      water: mk('water'),
      air: mk('air')
    };
    return { lines, x, y, padding, innerW, innerH };
  }, [chartData, size]);

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
        
        <div className="mt-4 rounded-md border border-border bg-bg-100 p-4" ref={containerRef}>
          <div className="mb-2 text-sm font-medium text-text-100">X射线能量与衰减系数关系</div>
          <svg ref={svgRef} width={size.width} height={size.height} role="img" aria-label="X射线能量与衰减系数关系">
            {paths.x && (
              <g transform={`translate(${paths.padding.left},${paths.padding.top})`}>
                {highlightKEdge && (
                  <rect x={paths.x(33)} y={0} width={paths.x(40) - paths.x(33)} height={paths.innerH} fill="#2563EB" opacity={0.06} />
                )}
                {tissues.map(t => (
                  <path key={t.id} d={paths.lines[t.id]} fill="none" stroke={getLineColor(t.id)} strokeWidth={selectedTissue === t.id ? 2.5 : 1} opacity={selectedTissue === t.id ? 1 : 0.35} />
                ))}
                <line x1={0} y1={paths.innerH} x2={paths.innerW} y2={paths.innerH} stroke="#e5e7eb" />
                <line x1={0} y1={0} x2={0} y2={paths.innerH} stroke="#e5e7eb" />
                <text x={paths.innerW} y={paths.innerH + 20} textAnchor="end" className="text-[10px] fill-text-300">能量 (keV)</text>
                <text x={0} y={-4} className="text-[10px] fill-text-300">衰减 (cm⁻¹)</text>
              </g>
            )}
          </svg>
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
