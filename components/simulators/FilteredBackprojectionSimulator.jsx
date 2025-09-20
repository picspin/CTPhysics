import React, { useMemo, useState } from 'react';
import SimulatorContainer from '../../ui/SimulatorContainer';
import Slider from '../../ui/Slider';
import Select from '../../ui/Select';
import Button from '../../ui/Button';

function generatePhantom(N) {
  const img = Array.from({ length: N }, () => Array(N).fill(0));
  const c = N / 2;
  const addCircle = (cx, cy, r, v) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx*dx + dy*dy <= r*r) img[y][x] += v;
    }
  };
  addCircle(c, c, N*0.22, 1.0);
  addCircle(c-10, c-5, N*0.08, 0.7);
  return img;
}

function radon(image, angles, detCount) {
  const N = image.length; const c = N/2; const sinogram = [];
  for (let ai=0; ai<angles.length; ai++) {
    const th = angles[ai]*Math.PI/180; const co=Math.cos(th), si=Math.sin(th);
    const row = new Array(detCount).fill(0);
    for (let d=0; d<detCount; d++) {
      const t = (d/(detCount-1))*2-1; let sum=0;
      for (let s=-c; s<c; s+=0.5) {
        const x=c + t*c*(-si) + s*co; const y=c + t*c*(co) + s*si;
        const xi=Math.floor(x), yi=Math.floor(y);
        if (xi>=0&&xi<N&&yi>=0&&yi<N) sum += image[yi][xi];
      }
      row[d]=sum;
    }
    sinogram.push(row);
  }
  return sinogram;
}

function rampKernel(len) {
  // Simple discrete ramp |f| kernel approximation for filtering
  const k = new Array(len).fill(0);
  const mid = Math.floor(len/2);
  k[mid] = 1;
  for (let n=1; n<=mid; n++) {
    const idxp = mid + n, idxm = mid - n;
    const val = (n % 2 === 1) ? -1/(Math.PI*Math.PI*n*n) : 0;
    if (idxp < len) k[idxp] = val; if (idxm >=0) k[idxm] = val;
  }
  return k;
}

function convolve(row, kernel) {
  const n = row.length; const m = kernel.length; const mid = Math.floor(m/2);
  const out = new Array(n).fill(0);
  for (let i=0; i<n; i++) {
    let sum=0;
    for (let j=0; j<m; j++) {
      const idx = i + j - mid;
      if (idx>=0 && idx<n) sum += row[idx]*kernel[j];
    }
    out[i]=sum;
  }
  return out;
}

function backproject(filteredSinogram, angles, N) {
  const c = N/2; const img = Array.from({ length: N }, ()=>Array(N).fill(0));
  const dets = filteredSinogram[0].length;
  for (let ai=0; ai<angles.length; ai++) {
    const th = angles[ai]*Math.PI/180; const co=Math.cos(th), si=Math.sin(th);
    const row = filteredSinogram[ai];
    for (let y=0; y<N; y++) {
      for (let x=0; x<N; x++) {
        const xt = (x - c); const yt = (y - c);
        const t = (xt*(-si) + yt*(co)) / c; // -1..1
        const u = Math.max(0, Math.min(dets-1, Math.floor((t+1)*0.5*(dets-1))));
        img[y][x] += row[u];
      }
    }
  }
  // Normalize
  const scale = Math.PI / angles.length;
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) img[y][x] *= scale;
  return img;
}

export default function FilteredBackprojectionSimulator() {
  const [N, setN] = useState(64);
  const [projections, setProjections] = useState(60);
  const [detectors, setDetectors] = useState(64);
  const [kernelType, setKernelType] = useState('ramp');
  const [step, setStep] = useState(0); // progressive backprojection

  const phantom = useMemo(() => generatePhantom(N), [N]);
  const angles = useMemo(() => Array.from({ length: projections }, (_, i) => i * (180 / projections)), [projections]);
  const sino = useMemo(() => radon(phantom, angles, detectors), [phantom, angles, detectors]);
  const kernel = useMemo(() => rampKernel(detectors), [detectors, kernelType]);
  const filtered = useMemo(() => sino.map(row => convolve(row, kernel)), [sino, kernel]);
  const recon = useMemo(() => backproject(filtered.slice(0, Math.max(1, step)), angles.slice(0, Math.max(1, step)), N), [filtered, angles, step, N]);

  return (
    <SimulatorContainer title="滤波反投影 (FBP) 交互步骤">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4">
          <Slider label={`图像尺寸: ${N}×${N}`} min={32} max={96} step={32} value={N} onChange={setN} />
          <Slider label={`投影数: ${projections}`} min={30} max={180} step={15} value={projections} onChange={setProjections} />
          <Slider label={`探测器数: ${detectors}`} min={32} max={128} step={16} value={detectors} onChange={setDetectors} />
          <Select label="滤波核" options={[{id:'ramp',name:'Ramp'}]} value={kernelType} onChange={setKernelType} />
          <Slider label={`反投影进度: 使用前 ${Math.min(step, projections)} 个角度`} min={1} max={projections} step={1} value={Math.min(step, projections)} onChange={setStep} />
          <div className="text-xs text-text-200">拖动“反投影进度”观察角度累积如何改善重建。
          </div>
        </div>
        <div className="grid grid-rows-2 gap-3">
          <div className="rounded-md border border-border bg-bg-100 p-2">
            <div className="mb-2 text-sm font-medium text-text-100">正弦图 (滤波前)</div>
            <div className="aspect-square w-full overflow-hidden bg-black">
              <div className="grid h-full w-full" style={{gridTemplateColumns:`repeat(${detectors},1fr)`, gridTemplateRows:`repeat(${sino.length},1fr)`}}>
                {sino.flat().map((v, i) => (
                  <div key={i} style={{ backgroundColor: `rgba(156,163,175,${Math.min(1, v/50)})` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-md border border-border bg-bg-100 p-2">
            <div className="mb-2 text-sm font-medium text-text-100">正弦图 (滤波后)</div>
            <div className="aspect-square w-full overflow-hidden bg-black">
              <div className="grid h-full w-full" style={{gridTemplateColumns:`repeat(${detectors},1fr)`, gridTemplateRows:`repeat(${filtered.length},1fr)`}}>
                {filtered.flat().map((v, i) => (
                  <div key={i} style={{ backgroundColor: `rgba(255,140,0,${Math.min(1, Math.abs(v)/50)})` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-border bg-bg-100 p-2">
          <div className="mb-2 text-sm font-medium text-text-100">重建图像 (进行中)</div>
          <div className="aspect-square w-full overflow-hidden bg-black">
            <div className="grid h-full w-full" style={{gridTemplateColumns:`repeat(${N},1fr)`, gridTemplateRows:`repeat(${N},1fr)`}}>
              {recon.flat().map((v, i) => (
                <div key={i} style={{ backgroundColor: `rgba(255,255,255,${Math.max(0, Math.min(1, v/200))})` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <div className="font-medium text-text-100">说明</div>
        <p className="mt-1">步骤：1) 采集正弦图；2) 应用Ramp滤波核增强高频；3) 将滤波后的投影按角度反投影并累积。</p>
      </div>
    </SimulatorContainer>
  );
}

