import React, { useMemo, useRef, useEffect, useState } from 'react';
import SimulatorContainer from '../../ui/SimulatorContainer';
import Select from '../../ui/Select';
import Slider from '../../ui/Slider';
import { scaleLinear, area as d3Area } from 'd3';

const MATERIALS = [
  { id: 'aluminum', name: '铝 (2.5mm)', muLow: 0.35, muHigh: 0.18 },
  { id: 'titanium', name: '钛 (5mm)', muLow: 0.55, muHigh: 0.28 },
  { id: 'bone', name: '骨骼 (1cm)', muLow: 0.7, muHigh: 0.4 },
];

function spectrum(peakKeV) {
  const points = [];
  const maxE = peakKeV;
  for (let e = 10; e <= maxE; e += 2) {
    const intensity = Math.max(0, (e / maxE) * (1 - e / maxE));
    points.push({ e, I0: intensity });
  }
  return points;
}

function harden(spectrumPoints, muLow, muHigh, thickness) {
  const maxE = spectrumPoints[spectrumPoints.length - 1].e;
  return spectrumPoints.map(p => {
    const muE = muHigh + (muLow - muHigh) * Math.pow((maxE - p.e) / maxE, 1.2);
    const I = p.I0 * Math.exp(-muE * thickness);
    return { e: p.e, I0: p.I0, I };
  });
}

export default function BeamHardeningSimulator() {
  const [kvp, setKvp] = useState(120);
  const [material, setMaterial] = useState('bone');
  const [thickness, setThickness] = useState(1.0);
  const mat = MATERIALS.find(m => m.id === material) || MATERIALS[2];
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ width: 640, height: 280 });

  const data = useMemo(() => {
    const spec = spectrum(kvp);
    const hardened = harden(spec, mat.muLow, mat.muHigh, thickness);
    const totalI0 = spec.reduce((s, p) => s + p.I0, 0);
    const totalI = hardened.reduce((s, p) => s + p.I, 0);
    const meanE0 = spec.reduce((s, p) => s + p.e * p.I0, 0) / (totalI0 || 1);
    const meanE = hardened.reduce((s, p) => s + p.e * p.I, 0) / (totalI || 1);
    const curve = hardened.map(h => ({ energy: h.e, I0: spec.find(x => x.e === h.e).I0, I: h.I }));
    return { curve, totalI0, totalI, meanE0, meanE };
  }, [kvp, material, thickness]);

  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setSize({ width: Math.max(300, w), height: 280 });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <SimulatorContainer title="束硬化可视化">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Select label="材料" options={MATERIALS} value={material} onChange={setMaterial} />
          <Select label="管电压 (kVp)" options={[80,100,120,140].map(v=>({id:String(v),name:String(v)}))} value={String(kvp)} onChange={(v)=>setKvp(parseInt(v))} />
          <Slider label={`厚度 (${material==='bone'?'cm':'mm'}): ${thickness}`} min={material==='bone'?0.5:0.5} max={material==='bone'?3:10} step={material==='bone'?0.1:0.5} value={thickness} onChange={setThickness} />
          <div className="rounded-md border border-border bg-bg-100 p-3 text-sm text-text-200">
            <div>平均能量：<span className="font-medium text-text-100">{data.meanE0.toFixed(1)} keV → {data.meanE.toFixed(1)} keV</span></div>
            <div className="mt-1">强度总量：<span className="font-medium text-text-100">{data.totalI0.toFixed(2)} → {data.totalI.toFixed(2)}</span></div>
          </div>
        </div>
        <div className="rounded-md border border-border bg-bg-100 p-3" ref={containerRef}>
          <div className="mb-2 text-sm font-medium text-text-100">入射谱 vs 束硬化后谱</div>
          <svg ref={svgRef} width={size.width} height={size.height} role="img" aria-label="入射谱与束硬化后谱">
            {(() => {
              const padding = { top: 10, right: 10, bottom: 26, left: 36 };
              const innerW = size.width - padding.left - padding.right;
              const innerH = size.height - padding.top - padding.bottom;
              const energies = data.curve.map(d => d.energy);
              const x = scaleLinear().domain([Math.min(...energies), Math.max(...energies)]).range([0, innerW]);
              const y = scaleLinear().domain([0, Math.max(...data.curve.map(d => Math.max(d.I0, d.I))) * 1.1]).range([innerH, 0]);
              const areaI0 = d3Area().x(d => x(d.energy)).y0(innerH).y1(d => y(d.I0))(data.curve);
              const areaI = d3Area().x(d => x(d.energy)).y0(innerH).y1(d => y(d.I))(data.curve);
              return (
                <g transform={`translate(${padding.left},${padding.top})`}>
                  <rect x={0} y={0} width={innerW} height={innerH} fill="none" />
                  <path d={areaI0} fill="#9CA3AF" opacity={0.35} stroke="#9CA3AF" />
                  <path d={areaI} fill="#2563EB" opacity={0.25} stroke="#2563EB" />
                  <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#e5e7eb" />
                  <line x1={0} y1={0} x2={0} y2={innerH} stroke="#e5e7eb" />
                  <text x={innerW} y={innerH + 20} textAnchor="end" className="text-[10px] fill-text-300">能量 (keV)</text>
                  <text x={0} y={-4} className="text-[10px] fill-text-300">强度 (arb.)</text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>
      <div className="mt-4 rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <div className="font-medium text-text-100">说明</div>
        <p className="mt-1">低能光子被优先吸收，透过束的平均能量升高（束硬化）。在高密度材料与软组织交界处可出现伪影。</p>
      </div>
    </SimulatorContainer>
  );
}

