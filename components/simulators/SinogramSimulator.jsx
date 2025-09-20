import React, { useMemo, useState } from 'react';
import SimulatorContainer from '../../ui/SimulatorContainer';
import Slider from '../../ui/Slider';
import Select from '../../ui/Select';

function generatePhantom(type) {
  // Simple 2D phantom on N x N grid
  const N = 64;
  const img = Array.from({ length: N }, () => Array(N).fill(0));
  const center = N / 2;
  const addCircle = (cx, cy, r, v) => {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx*dx + dy*dy <= r*r) img[y][x] += v;
      }
    }
  };
  // Shepp-Logan-esque
  addCircle(center, center, N*0.22, 1.0);
  addCircle(center-10, center-5, N*0.08, 0.8);
  addCircle(center+12, center+6, N*0.06, 0.6);
  if (type === 'two_circles') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) img[y][x] = 0;
    addCircle(center-10, center, N*0.12, 1.0);
    addCircle(center+10, center, N*0.12, 0.6);
  }
  return img;
}

function radonTransform(image, anglesDeg, detCount) {
  const N = image.length;
  const center = N / 2;
  const dets = detCount;
  const sinogram = Array.from({ length: anglesDeg.length }, () => Array(dets).fill(0));
  for (let a = 0; a < anglesDeg.length; a++) {
    const theta = anglesDeg[a] * Math.PI / 180;
    const cos = Math.cos(theta), sin = Math.sin(theta);
    for (let d = 0; d < dets; d++) {
      const t = (d / (dets - 1)) * 2 - 1; // -1..1 offset along detector
      // integrate along a line parameter s
      let sum = 0;
      for (let s = -center; s < center; s += 0.5) {
        const x = center + t * center * (-sin) + s * cos;
        const y = center + t * center * (cos) + s * sin;
        const xi = Math.floor(x), yi = Math.floor(y);
        if (xi >= 0 && xi < N && yi >= 0 && yi < N) sum += image[yi][xi];
      }
      sinogram[a][d] = sum;
    }
  }
  return sinogram;
}

export default function SinogramSimulator() {
  const [phantomType, setPhantomType] = useState('shepp_logan');
  const [projections, setProjections] = useState(60);
  const [detectors, setDetectors] = useState(64);

  const phantom = useMemo(() => generatePhantom(phantomType), [phantomType]);
  const angles = useMemo(() => Array.from({ length: projections }, (_, i) => i * (180 / projections)), [projections]);
  const sino = useMemo(() => radonTransform(phantom, angles, detectors), [phantom, angles, detectors]);

  return (
    <SimulatorContainer title="正弦图 (Sinogram) 可视化">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Select label="体模" options={[{id:'shepp_logan',name:'Shepp-Logan简化'},{id:'two_circles',name:'双圆体模'}]} value={phantomType} onChange={setPhantomType} />
          <Slider label={`投影数: ${projections}`} min={15} max={180} step={15} value={projections} onChange={setProjections} />
          <Slider label={`探测器数: ${detectors}`} min={32} max={128} step={16} value={detectors} onChange={setDetectors} />
        </div>
        <div className="grid grid-rows-2 gap-4">
          <div className="rounded-md border border-border bg-bg-100 p-2">
            <div className="mb-2 text-sm font-medium text-text-100">体模 (缩略)</div>
            <div className="aspect-square w-full overflow-hidden bg-black">
              <div className="grid h-full w-full" style={{gridTemplateColumns:`repeat(${phantom.length},1fr)`, gridTemplateRows:`repeat(${phantom.length},1fr)`}}>
                {phantom.flat().map((v, i) => (
                  <div key={i} style={{ backgroundColor: `rgba(255,255,255,${Math.min(1, v)})` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-md border border-border bg-bg-100 p-2">
            <div className="mb-2 text-sm font-medium text-text-100">正弦图</div>
            <div className="aspect-square w-full overflow-hidden bg-black">
              <div className="grid h-full w-full" style={{gridTemplateColumns:`repeat(${detectors},1fr)`, gridTemplateRows:`repeat(${sino.length},1fr)`}}>
                {sino.flat().map((v, i) => (
                  <div key={i} style={{ backgroundColor: `rgba(255,140,0,${Math.min(1, v / 50)})` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <div className="font-medium text-text-100">说明</div>
        <p className="mt-1">正弦图展示随角度变化的投影数据。圆形结构在正弦图上表现为正弦曲线。</p>
      </div>
    </SimulatorContainer>
  );
}

