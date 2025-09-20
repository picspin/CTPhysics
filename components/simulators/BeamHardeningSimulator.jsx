import React, { useMemo, useState } from 'react';
import SimulatorContainer from '../../ui/SimulatorContainer';
import Select from '../../ui/Select';
import Slider from '../../ui/Slider';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart } from 'recharts';

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
        <div className="rounded-md border border-border bg-bg-100 p-3">
          <div className="mb-2 text-sm font-medium text-text-100">入射谱 vs 束硬化后谱</div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.curve} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="energy" label={{ value: '能量 (keV)', position: 'insideBottomRight', offset: -5 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="I0" name="入射谱 I0" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.3} />
                <Area type="monotone" dataKey="I" name="束硬化后 I" stroke="#FF8C00" fill="#FF8C00" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <div className="font-medium text-text-100">说明</div>
        <p className="mt-1">低能光子被优先吸收，透过束的平均能量升高（束硬化）。在高密度材料与软组织交界处可出现伪影。</p>
      </div>
    </SimulatorContainer>
  );
}

