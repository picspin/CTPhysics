'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { CardiacGatingOptions } from '@/types';
import { useLanguage, type MessageKey } from '@/context/LanguageContext';
import {
  MOTION_RISK_START_PCT,
  SYSTOLIC_WINDOW_MS,
  TURBO_FLASH,
  buildPlan,
  diastolicWindowMs,
  ecgValue,
  pctToMs,
  recommendPhase,
  rrMs,
  turboFlashBlock,
  turboFlashStatus,
  type AcqMode,
  type Gating,
  type PhaseChoice,
} from '@/utils/cardiac-windows';

interface Props {
  options?: CardiacGatingOptions;
}

const PRE_ROLL_S = 0.2; // seconds of ECG shown before the first R-wave (so the P wave is visible)
const SWEEP_SECONDS = 6;

const MODES: { id: AcqMode; label: MessageKey }[] = [
  { id: 'standard', label: 'card_mode_standard' },
  { id: 'turboFlash', label: 'card_mode_flash' },
  { id: 'oneBeat', label: 'card_mode_onebeat' },
];

const C = {
  dia: 'rgba(34,197,94,0.30)',
  diaEdge: 'rgba(34,197,94,0.95)',
  sys: 'rgba(239,68,68,0.30)',
  sysEdge: 'rgba(239,68,68,0.95)',
  flash: 'rgba(56,189,248,0.35)',
  flashEdge: 'rgba(56,189,248,1)',
  one: 'rgba(192,132,252,0.22)',
  oneEdge: 'rgba(192,132,252,1)',
  tube: 'rgba(250,204,21,0.85)',
  tubeLow: 'rgba(250,204,21,0.35)',
  risk: 'rgba(148,163,184,0.25)',
};

const CardiacGatingSimulator: React.FC<Props> = ({ options }) => {
  const { t, language } = useLanguage();
  const gatingTypes: { id: string; name: string }[] = options?.gatingTypes || [
    { id: 'prospective', name: t('card_gate_prospective') },
    { id: 'retrospective', name: t('card_gate_retrospective') },
  ];

  const [mode, setMode] = useState<AcqMode>('standard');
  const [gating, setGating] = useState<Gating>('prospective');
  const [phase, setPhase] = useState<PhaseChoice>('diastole');
  const [ecgPulsing, setEcgPulsing] = useState(false);
  const [heartRate, setHeartRate] = useState(65);
  const [isScanning, setIsScanning] = useState(false);
  const [sweep, setSweep] = useState<number | null>(null); // 0..1 while/after a scan, null = static full view
  const [width, setWidth] = useState(640);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const heartScale = useSpring(1);
  const heartOpacity = useSpring(0.8);

  const rr = rrMs(heartRate);
  const plan = useMemo(
    () => buildPlan({ mode, gating, phase, hr: heartRate, ecgPulsing }),
    [mode, gating, phase, heartRate, ecgPulsing],
  );
  const dia = diastolicWindowMs(heartRate);
  const rec = recommendPhase(heartRate);
  const flashStatus = turboFlashStatus(heartRate);
  const flashBlock = turboFlashBlock(heartRate);

  // Responsive canvas width
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setWidth(Math.max(280, Math.floor(el.clientWidth)));
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scan animation: a cursor sweeps over the displayed strip
  useEffect(() => {
    if (!isScanning) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (SWEEP_SECONDS * 1000));
      setSweep(p);
      const stripMs = PRE_ROLL_S * 1000 + plan.beats * rr;
      const tMs = p * stripMs - PRE_ROLL_S * 1000;
      const cyc = (((tMs % rr) + rr) % rr) / rr;
      heartScale.set(cyc < 0.15 ? 1.2 : 1);
      heartOpacity.set(cyc < 0.15 ? 1 : 0.8);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setIsScanning(false);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isScanning, rr, plan.beats, heartScale, heartOpacity]);

  // Any parameter change resets the animation to the static full view
  useEffect(() => {
    setIsScanning(false);
    setSweep(null);
  }, [mode, gating, phase, heartRate, ecgPulsing]);

  // ---- drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const narrow = width < 560;
    const H = narrow ? 250 : 300;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fs = narrow ? 10 : 11;
    ctx.font = `${fs}px ui-sans-serif, system-ui, sans-serif`;

    const stripS = PRE_ROLL_S + (plan.beats * rr) / 1000;
    const padL = 8;
    const padR = 8;
    const plotW = width - padL - padR;
    const xOfMs = (ms: number): number => padL + ((ms / 1000 + PRE_ROLL_S) / stripS) * plotW;
    const tubeTop = 10;
    const tubeBot = 50;
    const ecgTop = 58;
    const axisY = H - (narrow ? 46 : 52);
    const ecgMid = (ecgTop + axisY) / 2 + 6;
    const ecgAmp = (axisY - ecgTop) * 0.38;
    const cursorMs = sweep === null ? Infinity : (sweep * stripS - PRE_ROLL_S) * 1000;

    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, width, H);

    const beatStart = (b: number): number => b * rr;

    // motion-risk zone (Turbo Flash only)
    if (mode === 'turboFlash') {
      for (let b = 0; b < plan.beats; b++) {
        const x0 = xOfMs(beatStart(b) + pctToMs(MOTION_RISK_START_PCT, heartRate));
        const x1 = xOfMs(beatStart(b) + rr);
        ctx.fillStyle = C.risk;
        ctx.fillRect(x0, ecgTop, x1 - x0, axisY - ecgTop);
      }
    }

    // target windows (clipped to the animation cursor)
    const clipTo = (x: number): number => Math.min(x, xOfMs(Math.max(cursorMs, -PRE_ROLL_S * 1000)));
    const drawBox = (x0: number, x1: number, fill: string, edge: string, dashed = false): void => {
      const xe = sweep === null ? x1 : clipTo(x1);
      if (xe <= x0) return;
      ctx.fillStyle = fill;
      ctx.fillRect(x0, ecgTop, xe - x0, axisY - ecgTop);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(dashed ? [4, 3] : []);
      ctx.strokeRect(x0 + 0.5, ecgTop + 0.5, Math.max(1, xe - x0 - 1), axisY - ecgTop - 1);
      ctx.setLineDash([]);
    };
    for (const tg of plan.targets) {
      const s = beatStart(tg.beat) + tg.startMs;
      const e = beatStart(tg.beat) + tg.endMs;
      if (!tg.durationKnown) {
        // ONE BEAT: duration unknown -> dashed marker of fixed visual width, with a "?" label
        const x = xOfMs(s);
        drawBox(x - 10, x + 10, C.one, C.oneEdge, true);
        ctx.fillStyle = C.oneEdge;
        ctx.textAlign = 'center';
        ctx.fillText('?', x, ecgTop + 14);
      } else if (mode === 'turboFlash') {
        drawBox(xOfMs(s), xOfMs(e), C.flash, C.flashEdge);
      } else if (phase === 'diastole') {
        drawBox(xOfMs(s), xOfMs(e), C.dia, C.diaEdge);
      } else {
        drawBox(xOfMs(s), xOfMs(e), C.sys, C.sysEdge);
      }
    }

    // tube-current band
    ctx.fillStyle = '#111827';
    ctx.fillRect(padL, tubeTop, plotW, tubeBot - tubeTop);
    for (const seg of plan.tube) {
      const s = beatStart(seg.beat) + seg.startMs;
      const e = beatStart(seg.beat) + seg.endMs;
      const x0 = xOfMs(s);
      const x1 = sweep === null ? xOfMs(e) : clipTo(xOfMs(e));
      if (x1 <= x0) continue;
      const hgt = (tubeBot - tubeTop - 4) * seg.level;
      ctx.fillStyle = seg.level >= 1 ? C.tube : C.tubeLow;
      ctx.fillRect(x0, tubeBot - 2 - hgt, x1 - x0, hgt);
    }
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.strokeRect(padL + 0.5, tubeTop + 0.5, plotW - 1, tubeBot - tubeTop - 1);

    // ECG trace
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const steps = Math.max(200, Math.floor(plotW));
    for (let i = 0; i <= steps; i++) {
      const tS = -PRE_ROLL_S + (i / steps) * stripS;
      const v = ecgValue(tS, rr / 1000);
      const x = padL + (i / steps) * plotW;
      const y = ecgMid - v * ecgAmp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // R-wave markers + trigger
    for (let b = 0; b < plan.beats; b++) {
      const x = xOfMs(beatStart(b));
      ctx.strokeStyle = 'rgba(229,231,235,0.35)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, ecgTop);
      ctx.lineTo(x, axisY + 18);
      ctx.stroke();
      ctx.setLineDash([]);
      if (plan.triggerBeat === b) {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(x, ecgTop - 2);
        ctx.lineTo(x - 5, ecgTop - 10);
        ctx.lineTo(x + 5, ecgTop - 10);
        ctx.closePath();
        ctx.fill();
      }
    }

    // axes: % R-R (upper scale) and ms after R (lower scale)
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, axisY);
    ctx.lineTo(padL + plotW, axisY);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    const pcts = narrow ? [0, 50] : [0, 25, 50, 75];
    for (let b = 0; b < plan.beats; b++) {
      for (const pc of pcts) {
        const ms = pctToMs(pc, heartRate);
        const x = xOfMs(beatStart(b) + ms);
        ctx.beginPath();
        ctx.moveTo(x, axisY);
        ctx.lineTo(x, axisY + 4);
        ctx.stroke();
        if (x > padL + 14 && x < padL + plotW - 14) {
          ctx.fillText(`${pc}%`, x, axisY + 6 + fs);
          ctx.fillText(`${Math.round(ms)} ms`, x, axisY + 8 + 2 * fs);
        }
      }
    }
    // axis tag at left
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText('R = 0', padL + 2, tubeBot + 12);

    // animation cursor
    if (sweep !== null && sweep < 1) {
      const x = xOfMs(cursorMs);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, tubeTop);
      ctx.lineTo(x, axisY);
      ctx.stroke();
    }
  }, [plan, width, sweep, rr, heartRate, mode, phase, language]);

  const toggleScan = (): void => {
    if (isScanning) setIsScanning(false);
    else {
      setSweep(0);
      setIsScanning(true);
    }
  };

  const btn = (active: boolean): string =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
      active ? 'bg-primary-100 text-white border-primary-100' : 'bg-bg-300 text-text-200 border-border-100 hover:bg-bg-400'
    }`;

  const srcText = (): string => {
    if (dia.source === 'table') return t('card_win_src_table');
    if (dia.source === 'interpolated') return t('card_win_src_interp');
    if (dia.source === 'below-table') return t('card_win_src_below');
    return t('card_win_src_above');
  };
  const recText = rec === 'diastole' ? t('card_rec_dia') : rec === 'systole' ? t('card_rec_sys') : t('card_rec_either');
  const sys = TURBO_FLASH.systems;

  return (
    <SimulatorContainer title={t('card_gating_title')} description={t('card_gating_desc')} enableLiquidEffect={false}>
      <div className="space-y-6" data-testid="cardiac-sim">
        {/* Mode toggle */}
        <div>
          <div className="text-xs text-text-300 mb-2" id="card-mode-label">{t('card_acq_mode')}</div>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="card-mode-label">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                data-testid={`card-mode-${m.id}`}
                className={btn(mode === m.id)}
                onClick={() => setMode(m.id)}
              >
                {t(m.label)}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Slider
            label={t('card_heart_rate_bpm', { hr: heartRate })}
            min={40}
            max={120}
            step={1}
            value={heartRate}
            onChange={(e) => setHeartRate(Number(e.target.value))}
            aria-label={t('card_heart_rate_bpm', { hr: heartRate })}
          />
          {mode === 'standard' && (
            <Select
              label={t('card_mode')}
              options={gatingTypes.map((g) => ({ value: g.id, label: g.name }))}
              value={gating}
              onChange={(e) => setGating(e.target.value as Gating)}
            />
          )}
          {mode !== 'turboFlash' && (
            <div>
              <div className="text-xs text-text-300 mb-2" id="card-phase-label">{t('card_phase_label')}</div>
              <div className="flex gap-2" role="group" aria-labelledby="card-phase-label">
                {(['diastole', 'systole'] as PhaseChoice[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={phase === p}
                    data-testid={`card-phase-${p}`}
                    className={btn(phase === p)}
                    onClick={() => setPhase(p)}
                  >
                    {p === 'diastole' ? t('card_phase_diastole') : t('card_phase_systole')}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mode === 'standard' && gating === 'retrospective' && (
            <label className="flex items-center gap-2 text-sm text-text-200">
              <input type="checkbox" checked={ecgPulsing} onChange={(e) => setEcgPulsing(e.target.checked)} />
              {t('card_ecg_pulsing')}
            </label>
          )}
        </div>

        {/* Chart + heart */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3">
            <div className="flex items-baseline justify-between mb-1">
              <h4 className="text-sm font-semibold text-text-100">{t('card_chart_title')}</h4>
              <span className="text-xs text-green-500 font-mono">{t('card_ecg_monitor')}</span>
            </div>
            <div ref={wrapRef} className="bg-black rounded-lg border border-border-100 overflow-hidden">
              <canvas
                ref={canvasRef}
                className="block w-full"
                data-testid="card-chart"
                role="img"
                aria-label={t('card_chart_title')}
              />
            </div>
            <p className="text-xs text-text-300 mt-2">{t('card_axis_caption')}</p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-200" data-testid="card-legend">
              {mode === 'standard' && (
                <li><span className="inline-block w-3 h-3 mr-1 align-middle rounded-sm" style={{ background: phase === 'diastole' ? C.diaEdge : C.sysEdge }} />{phase === 'diastole' ? t('card_leg_dia') : t('card_leg_sys')}</li>
              )}
              {mode === 'turboFlash' && (
                <>
                  <li><span className="inline-block w-3 h-3 mr-1 align-middle rounded-sm" style={{ background: C.flashEdge }} />{t('card_leg_flash')}</li>
                  <li><span className="inline-block w-3 h-3 mr-1 align-middle rounded-sm" style={{ background: '#f97316' }} />{t('card_leg_trigger')}</li>
                  <li><span className="inline-block w-3 h-3 mr-1 align-middle rounded-sm" style={{ background: C.risk }} />{t('card_leg_risk')}</li>
                </>
              )}
              {mode === 'oneBeat' && (
                <>
                  <li><span className="inline-block w-3 h-3 mr-1 align-middle rounded-sm border border-dashed" style={{ borderColor: C.oneEdge }} />{t('card_leg_onebeat')}</li>
                  <li><span className="inline-block w-3 h-3 mr-1 align-middle rounded-sm" style={{ background: '#f97316' }} />{t('card_leg_trigger')}</li>
                </>
              )}
              <li><span className="inline-block w-3 h-3 mr-1 align-middle rounded-sm" style={{ background: C.tube }} />{t('card_leg_tube_full')}</li>
              {mode === 'standard' && gating === 'retrospective' && ecgPulsing && (
                <li><span className="inline-block w-3 h-3 mr-1 align-middle rounded-sm" style={{ background: C.tubeLow }} />{t('card_leg_tube_low')}</li>
              )}
            </ul>
          </div>

          <div className="bg-bg-200 rounded-lg p-4 flex flex-col items-center justify-center space-y-3">
            <motion.div style={{ scale: heartScale, opacity: heartOpacity }} className="text-5xl">❤️</motion.div>
            <div className="text-center">
              <div className="text-2xl font-bold text-text-100">{heartRate}</div>
              <div className="text-xs text-text-300">{t('card_bpm')}</div>
              <div className="text-xs text-text-300 mt-1">{t('card_rr_info', { rr: Math.round(rr) })}</div>
            </div>
            <Button onClick={toggleScan} variant={isScanning ? 'danger' : 'primary'} className="w-full">
              {isScanning ? t('card_stop_acq') : t('card_start_acq')}
            </Button>
          </div>
        </div>

        {/* Mode-specific information */}
        {mode === 'standard' && (
          <div className="bg-bg-200 p-4 rounded-lg text-sm text-text-200 space-y-2" data-testid="card-info-standard">
            <h4 className="font-semibold text-text-100">{t('card_win_title')}</h4>
            <p>{t('card_win_dia', { ms: Math.round(dia.ms) })} <span className="text-text-300">{srcText()}</span></p>
            <p>{t('card_win_sys', { ms: SYSTOLIC_WINDOW_MS })}</p>
            <p className="font-medium text-text-100">{recText}</p>
            <p className="text-xs text-text-300">{t('card_rec_caveat')}</p>
            <hr className="border-border-100" />
            <h4 className="font-semibold text-text-100">{t('card_guide')}</h4>
            {gating === 'prospective' ? (
              <p><strong>{t('card_guide_pro_t')}</strong> {t('card_guide_pro_1')}<br />{t('card_guide_pro_2')}</p>
            ) : (
              <p><strong>{t('card_guide_retro_t')}</strong> {t('card_guide_retro_1')}<br />{t('card_guide_retro_2')}</p>
            )}
          </div>
        )}

        {mode === 'turboFlash' && (
          <div className="bg-bg-200 p-4 rounded-lg text-sm text-text-200 space-y-2" data-testid="card-info-flash">
            <h4 className="font-semibold text-text-100">{t('card_flash_title')}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-300 border-b border-border-100">
                    <th className="py-1 pr-3 font-medium">{t('card_flash_system')}</th>
                    <th className="py-1 font-medium">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border-100/50 align-top">
                    <td className="py-1 pr-3 font-mono whitespace-nowrap">Definition Flash</td>
                    <td className="py-1">
                      {t('card_flash_pitch', { v: sys.flash.pitch })} · {t('card_flash_bed', { v: sys.flash.bedSpeedMmPerS })}<br />
                      {t('card_flash_tr', { v: sys.flash.temporalResolutionMs, rot: sys.flash.rotationMs })}
                    </td>
                  </tr>
                  <tr className="align-top">
                    <td className="py-1 pr-3 font-mono whitespace-nowrap">SOMATOM Force</td>
                    <td className="py-1">
                      {t('card_flash_pitch', { v: sys.force.pitch })}<br />
                      {t('card_flash_tr', { v: sys.force.temporalResolutionMs, rot: sys.force.rotationMs })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('card_flash_phase', { v: TURBO_FLASH.startPhasePct })}</li>
              <li>{t('card_flash_hr', { rec: TURBO_FLASH.maxHrRecommended, field: TURBO_FLASH.maxHrFieldExperience })}</li>
            </ul>
            <p
              data-testid="card-flash-status"
              className={
                flashStatus === 'ok' ? 'text-green-400' : flashStatus === 'field-experience' ? 'text-yellow-300' : 'text-red-400'
              }
            >
              {flashStatus === 'ok'
                ? t('card_flash_status_ok', { hr: heartRate })
                : flashStatus === 'field-experience'
                  ? t('card_flash_status_field', { hr: heartRate })
                  : t('card_flash_status_out', { hr: heartRate })}
            </p>
            {flashBlock.intoMotionZone && <p className="text-yellow-300">{t('card_flash_motion')}</p>}
            <p className="text-xs text-text-300">{t('card_flash_trigger_note')}</p>
            <p className="text-xs text-text-300">{t('card_flash_schematic')}</p>
          </div>
        )}

        {mode === 'oneBeat' && (
          <div className="bg-bg-200 p-4 rounded-lg text-sm text-text-200 space-y-2" data-testid="card-info-onebeat">
            <h4 className="font-semibold text-text-100">{t('card_ob_title')}</h4>
            <p>{t('card_ob_desc')}</p>
            <p>{t('card_ob_rhythm')}</p>
            <p>{t('card_ob_benefit')}</p>
            <p className="text-yellow-300">
              <strong>{t('card_ob_tbc_t')}</strong> {t('card_ob_tbc')}
            </p>
          </div>
        )}
      </div>
    </SimulatorContainer>
  );
};

export default CardiacGatingSimulator;
