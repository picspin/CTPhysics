'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Slider } from '../ui/Slider';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useLanguage, type MessageKey } from '@/context/LanguageContext';
import { FBP_KERNELS, type FbpKernel } from '@/utils/iterative-recon';
import { computeDemo, huToGray, DEMO_DEFAULTS, type DemoParams, type DemoResult } from '@/utils/iterative-recon-demo';
import type { WorkerRequest, WorkerResponse } from './_workers/iterativeRecon.worker';

const KERNEL_KEY: Record<FbpKernel, MessageKey> = {
  ramlak: 'ir_kernel_ramlak',
  sheppLogan: 'ir_kernel_shepp',
  hann: 'ir_kernel_hann',
};
const KERNEL_SHORT: Record<FbpKernel, string> = { ramlak: 'Ram-Lak', sheppLogan: 'Shepp-Logan', hann: 'Hann' };
const WIN_CENTER = 0;
const WIN_WIDTH = 400;

/** Paint a square float image (attenuation, water = 1) into a canvas using the HU window. */
function paintImage(canvas: HTMLCanvasElement | null, img: Float32Array | undefined, n: number): void {
  if (!canvas || !img) return;
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const data = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const g = huToGray(img[i], WIN_CENTER, WIN_WIDTH);
    data.data[i * 4] = g;
    data.data[i * 4 + 1] = g;
    data.data[i * 4 + 2] = g;
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
}

function paintSinogram(canvas: HTMLCanvasElement | null, sino: Float32Array | undefined, n: number, nAngles: number): void {
  if (!canvas || !sino) return;
  canvas.width = n;
  canvas.height = nAngles;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let max = 0;
  for (let i = 0; i < sino.length; i++) if (sino[i] > max) max = sino[i];
  max = Math.max(max, 1e-6);
  const data = ctx.createImageData(n, nAngles);
  for (let i = 0; i < sino.length; i++) {
    const v = Math.round(255 * Math.min(1, Math.max(0, sino[i] / max)));
    data.data[i * 4] = v;
    data.data[i * 4 + 1] = v;
    data.data[i * 4 + 2] = v;
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
}

const fmt = (v: number, d = 0): string => (Number.isFinite(v) ? v.toFixed(d) : '–');

const IterativeReconSimulator: React.FC = () => {
  const { t, language } = useLanguage();
  const [dose, setDose] = useState(DEMO_DEFAULTS.dosePct);
  const [strength, setStrength] = useState(DEMO_DEFAULTS.strength);
  const [seed, setSeed] = useState(DEMO_DEFAULTS.seed);
  const [iter, setIter] = useState(40);
  const [kernel, setKernel] = useState<FbpKernel>('sheppLogan');
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  const truthRef = useRef<HTMLCanvasElement>(null);
  const sinoRef = useRef<HTMLCanvasElement>(null);
  const fbpRef = useRef<HTMLCanvasElement>(null);
  const irRef = useRef<HTMLCanvasElement>(null);

  const params: DemoParams = useMemo(
    () => ({ ...DEMO_DEFAULTS, dosePct: dose, strength, seed }),
    [dose, strength, seed],
  );

  // Worker life-cycle
  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setFallback(true);
      return;
    }
    try {
      const w = new Worker(new URL('./_workers/iterativeRecon.worker.ts', import.meta.url));
      w.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id !== reqId.current) return; // stale
        setResult(e.data.result);
        setBusy(false);
      };
      w.onerror = () => setFallback(true);
      workerRef.current = w;
    } catch {
      setFallback(true);
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Recompute when the physical parameters change (debounced; the iteration slider does NOT trigger it)
  useEffect(() => {
    setBusy(true);
    const id = ++reqId.current;
    const timer = setTimeout(() => {
      const w = workerRef.current;
      if (w && !fallback) {
        const msg: WorkerRequest = { id, params };
        w.postMessage(msg);
      } else {
        // main-thread fallback (no Worker support or worker failed to load)
        // NOTE: computeDemo() runs the whole reconstruction (FBP + all SIRT iterations) synchronously on the
        // main thread, so with large n / nAngles / nIter this can block the UI for a noticeable time. The
        // setTimeout(0) below only defers the work past the current paint; it does not chunk it or yield during it.
        setTimeout(() => {
          if (id !== reqId.current) return;
          setResult(computeDemo(params));
          setBusy(false);
        }, 0);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [params, fallback]);

  // Playback
  useEffect(() => {
    if (!playing) return;
    const max = params.nIter;
    const timer = setInterval(() => {
      setIter((k) => {
        if (k >= max) {
          setPlaying(false);
          return max;
        }
        return k + 1;
      });
    }, 70);
    return () => clearInterval(timer);
  }, [playing, params.nIter]);

  const n = params.n;
  useEffect(() => paintImage(truthRef.current, result?.truth, n), [result, n]);
  useEffect(() => paintSinogram(sinoRef.current, result?.sinogram, n, params.nAngles), [result, n, params.nAngles]);
  useEffect(() => paintImage(fbpRef.current, result?.fbp[kernel], n), [result, kernel, n]);
  useEffect(() => paintImage(irRef.current, result?.snaps[iter], n), [result, iter, n]);

  const togglePlay = useCallback(() => {
    if (!playing && iter >= params.nIter) setIter(0);
    setPlaying((p) => !p);
  }, [playing, iter, params.nIter]);

  const convData = useMemo(() => {
    if (!result) return [];
    return result.series.rmseHU.map((_, k) => ({
      k,
      rmse: result.series.rmseHU[k],
      noise: result.series.noiseHU[k],
    }));
  }, [result]);

  const tradeoff = useMemo(() => {
    if (!result) return { ir: [], fbp: [], cur: [] };
    const ir = result.series.edgePx
      .map((e, k) => ({ edge: e, noise: result.series.noiseHU[k], k }))
      .filter((p, k) => k >= 1 && Number.isFinite(p.edge));
    const fbpPts = FBP_KERNELS.map((kn) => ({
      edge: result.fbpMetrics[kn].edgePx,
      noise: result.fbpMetrics[kn].noiseHU,
      name: KERNEL_SHORT[kn],
    })).filter((p) => Number.isFinite(p.edge));
    const c = ir.find((p) => p.k === iter);
    return { ir, fbp: fbpPts, cur: c ? [c] : [] };
  }, [result, iter]);

  const irNoise = result?.series.noiseHU[iter] ?? NaN;
  const irEdge = result?.series.edgePx[iter] ?? NaN;
  const irRmse = result?.series.rmseHU[iter] ?? NaN;
  const fm = result?.fbpMetrics[kernel];

  const canvasCls = 'w-full h-auto rounded border border-border-100 bg-black [image-rendering:pixelated] aspect-square';

  return (
    <div className="space-y-6" data-testid="ir-demo">
      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Slider
          label={t('ir_ctl_dose', { v: dose })}
          min={5}
          max={100}
          step={5}
          value={dose}
          onChange={(e) => setDose(Number(e.target.value))}
          aria-label={t('ir_ctl_dose', { v: dose })}
        />
        <Slider
          label={t('ir_ctl_strength', { v: strength })}
          min={0}
          max={10}
          step={0.5}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
          aria-label={t('ir_ctl_strength', { v: strength })}
        />
        <Slider
          label={t('ir_ctl_iter', { k: iter, max: params.nIter })}
          min={0}
          max={params.nIter}
          step={1}
          value={iter}
          onChange={(e) => {
            setPlaying(false);
            setIter(Number(e.target.value));
          }}
          aria-label={t('ir_ctl_iter', { k: iter, max: params.nIter })}
        />
        <Select
          label={t('ir_ctl_kernel')}
          options={FBP_KERNELS.map((k) => ({ value: k, label: t(KERNEL_KEY[k]) }))}
          value={kernel}
          onChange={(e) => setKernel(e.target.value as FbpKernel)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant={playing ? 'danger' : 'primary'} onClick={togglePlay}>
          {playing ? t('ir_btn_pause') : t('ir_btn_play')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSeed((s) => s + 1)}>
          {t('ir_btn_noise')}
        </Button>
        {busy && <span className="text-xs text-text-300" role="status">{t('ir_computing')}</span>}
        {fallback && <span className="text-xs text-yellow-300">{t('ir_worker_fallback')}</span>}
      </div>

      {/* Images */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['truth', truthRef, t('ir_img_truth')],
          ['sino', sinoRef, t('ir_img_sino')],
          ['fbp', fbpRef, `${t('ir_img_fbp')} · ${KERNEL_SHORT[kernel]}`],
          ['ir', irRef, t('ir_img_ir', { k: iter })],
        ] as const).map(([id, ref, label]) => (
          <figure key={id} className="space-y-1">
            <canvas
              ref={ref}
              className={id === 'sino' ? 'w-full rounded border border-border-100 bg-black [image-rendering:pixelated] aspect-square object-fill' : canvasCls}
              data-testid={`ir-canvas-${id}`}
              role="img"
              aria-label={label}
            />
            <figcaption className="text-xs text-text-200 text-center">{label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="text-xs text-text-300 text-center">{t('ir_window_note')}</p>

      {/* Metrics */}
      <div className="overflow-x-auto">
        <h4 className="text-sm font-semibold text-text-100 mb-2">{t('ir_metrics_title')}</h4>
        <table className="w-full text-sm text-text-200 border-collapse" data-testid="ir-metrics">
          <thead>
            <tr className="text-left text-text-300 border-b border-border-100">
              <th className="py-1 pr-3 font-medium">{t('ir_col_method')}</th>
              <th className="py-1 pr-3 font-medium">{t('ir_col_noise')}</th>
              <th className="py-1 pr-3 font-medium">{t('ir_col_edge')}</th>
              <th className="py-1 font-medium">{t('ir_col_rmse')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border-100/50">
              <td className="py-1 pr-3">{t('ir_row_fbp', { kernel: KERNEL_SHORT[kernel] })}</td>
              <td className="py-1 pr-3 font-mono">{fmt(fm?.noiseHU ?? NaN)}</td>
              <td className="py-1 pr-3 font-mono">{fmt(fm?.edgePx ?? NaN, 1)}</td>
              <td className="py-1 font-mono">{fmt(fm?.rmseHU ?? NaN)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-3">{t('ir_row_ir', { k: iter })}</td>
              <td className="py-1 pr-3 font-mono">{fmt(irNoise)}</td>
              <td className="py-1 pr-3 font-mono">{fmt(irEdge, 1)}</td>
              <td className="py-1 font-mono">{fmt(irRmse)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-text-100">{t('ir_chart_conv_title')}</h4>
          <p className="text-xs text-text-300 mb-2">{t('ir_chart_conv_hint')}</p>
          <div className="h-56" key={`conv-${language}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={convData} margin={{ top: 5, right: 10, left: 0, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="k" stroke="#9CA3AF" tick={{ fontSize: 11 }} label={{ value: t('ir_axis_iter'), position: 'insideBottom', offset: -8, fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} width={40} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 12 }} />
                <Line type="monotone" dataKey="rmse" name={t('ir_col_rmse')} stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line type="monotone" dataKey="noise" name={t('ir_col_noise')} stroke="#fb923c" dot={false} strokeWidth={2} isAnimationActive={false} />
                <ReferenceLine x={iter} stroke="#e5e7eb" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text-100">{t('ir_chart_tradeoff_title')}</h4>
          <p className="text-xs text-text-300 mb-2">{t('ir_chart_tradeoff_hint')}</p>
          <div className="h-56" key={`trade-${language}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" dataKey="edge" domain={['auto', 'auto']} stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(1)} label={{ value: t('ir_axis_edge'), position: 'insideBottom', offset: -8, fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis type="number" dataKey="noise" domain={[0, 'auto']} stroke="#9CA3AF" tick={{ fontSize: 11 }} width={40} tickFormatter={(v: number) => v.toFixed(0)} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 12 }} formatter={(v: number) => v.toFixed(1)} />
                <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={20} />
                <Scatter name={t('ir_legend_ir')} data={tradeoff.ir} fill="#38bdf8" line={{ stroke: '#38bdf8', strokeWidth: 1.5 }} shape="circle" isAnimationActive={false} legendType="line" />
                <Scatter name={t('ir_legend_fbp')} data={tradeoff.fbp} fill="#fb923c" shape="square" isAnimationActive={false} />
                <Scatter data={tradeoff.cur} fill="#ffffff" shape="circle" legendType="none" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Things to try */}
      <div className="bg-bg-200 rounded-lg p-4 text-sm text-text-200">
        <h4 className="font-semibold text-text-100 mb-2">{t('ir_try_title')}</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>{t('ir_try_1')}</li>
          <li>{t('ir_try_2')}</li>
          <li>{t('ir_try_3')}</li>
          <li>{t('ir_try_4')}</li>
        </ul>
        <p className="mt-3 text-xs text-text-300">
          <strong>{t('ir_limits_t')}</strong> {t('ir_limits')}
        </p>
      </div>
    </div>
  );
};

export default IterativeReconSimulator;
