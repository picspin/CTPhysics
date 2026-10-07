'use client';

// Axial CT slice linked to a body z position (couch / gantry plane in Helical CT, slice slider in the Dose viewer).
// The slice is computed by the WASM kernel (public/wasm/ct_kernel.wasm) or its JS twin; both are lazy-loaded the first
// time the panel mounts. Phones / low-memory devices default to the on-demand JS engine (no 23 MB volume).
// Geometry and HU values are MOCK (procedural organs from utils/three/body/organs.ts).

import React, { useEffect, useRef, useState } from 'react';
import { useLanguage, type MessageKey } from '@/context/LanguageContext';
import type { SliceEngine, SliceEngineKind } from '@/utils/three/body/slice/engines';

export interface CtSlicePanelProps {
  /** body z in cm from the vertex */
  zCm: number;
  /** organ id to highlight in the slice */
  selectedOrganId?: string | null;
  /** canvas that receives the slice with transparent air, for the 3D slice plane texture */
  onPlaneCanvas?: (canvas: HTMLCanvasElement | null) => void;
  /** fires after each render so 3D can refresh its texture */
  onRendered?: () => void;
  compact?: boolean;
}

const PRESETS: Array<{ key: MessageKey; ww: number; wl: number }> = [
  { key: 'slice_win_soft', ww: 400, wl: 40 },
  { key: 'slice_win_lung', ww: 1500, wl: -600 },
  { key: 'slice_win_bone', ww: 1800, wl: 400 },
  { key: 'slice_win_brain', ww: 80, wl: 40 },
];

type Lib = typeof import('@/utils/three/body/slice/engines') & typeof import('@/utils/three/body/slice/volume');

export const CtSlicePanel: React.FC<CtSlicePanelProps> = ({ zCm, selectedOrganId, onPlaneCanvas, onRendered, compact }) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planeRef = useRef<HTMLCanvasElement | null>(null);
  const libRef = useRef<Lib | null>(null);
  const engineRef = useRef<SliceEngine | null>(null);
  const [engineKind, setEngineKind] = useState<SliceEngineKind | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [win, setWin] = useState({ ww: 400, wl: 40 });
  const [hover, setHover] = useState<{ hu: number; organ: string } | null>(null);
  const [prefer, setPrefer] = useState<SliceEngineKind | null>(null);
  const lastRef = useRef<{ hu: Int16Array; labels: Uint8Array } | null>(null);

  // lazy-load the engine
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [eng, vol] = await Promise.all([import('@/utils/three/body/slice/engines'), import('@/utils/three/body/slice/volume')]);
      const lib = { ...eng, ...vol } as Lib;
      libRef.current = lib;
      const want = prefer ?? lib.preferredEngine();
      const { engine, fallbackReason } = await lib.createSliceEngine(lib.buildSliceInit(), { prefer: want });
      if (cancelled) { engine.dispose(); return; }
      engineRef.current?.dispose();
      engineRef.current = engine;
      setEngineKind(engine.kind);
      setFallback(fallbackReason ?? null);
    })();
    return () => { cancelled = true; };
  }, [prefer]);

  useEffect(() => {
    if (!planeRef.current && typeof document !== 'undefined') {
      planeRef.current = document.createElement('canvas');
      planeRef.current.width = 256; planeRef.current.height = 256;
    }
    onPlaneCanvas?.(planeRef.current);
    return () => onPlaneCanvas?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = null; }, []);

  // render on z / window / selection / engine change
  useEffect(() => {
    const lib = libRef.current, engine = engineRef.current, c = canvasRef.current;
    if (!lib || !engine || !c) return;
    const sel = selectedOrganId ? lib.ORGAN_LABEL[selectedOrganId] ?? 0 : 0;
    const r = engine.render(zCm, win.ww, win.wl, sel, false);
    lastRef.current = { hu: r.hu.slice(), labels: r.labels.slice() };
    setMs(r.ms);
    const ctx = c.getContext('2d'); if (!ctx) return;
    const img = new ImageData(new Uint8ClampedArray(r.rgba), lib.N, lib.N);
    ctx.putImageData(img, 0, 0);
    const p = planeRef.current;
    if (p) {
      const pi = new ImageData(new Uint8ClampedArray(r.rgba), lib.N, lib.N);
      for (let i = 0; i < r.labels.length; i++) if (r.labels[i] === 0 || r.labels[i] === lib.TABLE_IDX) pi.data[i * 4 + 3] = r.labels[i] === 0 ? 0 : 90;
      p.getContext('2d')?.putImageData(pi, 0, 0);
      onRendered?.();
    }
  }, [zCm, win, selectedOrganId, engineKind, onRendered]);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const lib = libRef.current, last = lastRef.current, c = canvasRef.current;
    if (!lib || !last || !c) return;
    const r = c.getBoundingClientRect();
    const px = Math.floor(((e.clientX - r.left) / r.width) * lib.N), py = Math.floor(((e.clientY - r.top) / r.height) * lib.N);
    if (px < 0 || py < 0 || px >= lib.N || py >= lib.N) return;
    const o = py * lib.N + px;
    setHover({ hu: last.hu[o], organ: lib.LABEL_ORGAN[last.labels[o]] ?? 'air' });
  };

  const organName = (id: string) => (['air', 'soft', 'table', 'skin'].includes(id) ? t(`slice_label_${id}` as MessageKey) : t(`body3_o_${id}` as MessageKey));

  return (
    <div className="rounded-lg border border-white/10 bg-black/60 p-2 text-[11px] text-text-200" data-testid="ct-slice-panel">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-text-100">{t('slice_title', { z: zCm.toFixed(1) })}</span>
        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-200" data-testid="ct-slice-engine">
          {engineKind ? t(engineKind === 'wasm' ? 'slice_engine_wasm' : 'slice_engine_js', { ms: ms === null ? '–' : ms.toFixed(1) }) : t('slice_loading')}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        className={`mx-auto block aspect-square w-full ${compact ? 'max-w-[200px]' : 'max-w-[256px]'} rounded bg-black [image-rendering:pixelated]`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={t('slice_aria', { z: zCm.toFixed(1), ww: win.ww, wl: win.wl })}
      />
      <div className="mt-1 h-4 font-mono text-[10px]">
        {hover ? t('slice_hover', { organ: organName(hover.organ), hu: hover.hu }) : t('slice_hover_hint')}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setWin({ ww: p.ww, wl: p.wl })}
            aria-pressed={win.ww === p.ww && win.wl === p.wl}
            className={`rounded px-1.5 py-0.5 text-[10px] ${win.ww === p.ww && win.wl === p.wl ? 'bg-sky-400 text-black' : 'bg-white/10 text-text-100'}`}
          >
            {t(p.key)}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px]">{t('slice_window', { ww: win.ww, wl: win.wl })}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px]">
        <span>{t('slice_engine_label')}</span>
        {(['wasm', 'js'] as SliceEngineKind[]).map((k) => (
          <label key={k} className="flex items-center gap-0.5">
            <input type="radio" name="slice-engine" checked={engineKind === k} onChange={() => setPrefer(k)} />
            {t(k === 'wasm' ? 'slice_engine_opt_wasm' : 'slice_engine_opt_js')}
          </label>
        ))}
      </div>
      {fallback && <p className="mt-1 text-[10px] text-amber-300">{t('slice_fallback', { reason: fallback })}</p>}
      <p className="mt-1 text-[9px] leading-snug text-amber-300/90">{t('slice_mock_notice')}</p>
    </div>
  );
};

export default CtSlicePanel;
