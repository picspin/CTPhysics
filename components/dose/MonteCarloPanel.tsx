'use client';

import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import {
  runIllustrativeMC,
  buildPerRegionConvergence,
  BodyRegionId,
  MC_PHOTON_ENERGY_KEV,
} from '@/utils/dose-physics';
import { useLanguage } from '@/context/LanguageContext';
import { MC_REGION_KEY } from '@/i18n/labels';

// ---------------------------------------------------------------------------
// MonteCarloPanel — runs the illustrative MC estimator and plots per-region
// convergence with ±1σ band.
//
// Educational framing in the UI: this is NOT a real MC photon-transport
// engine. It demonstrates the central MC idea — statistical noise shrinks
// as √N. We say so explicitly so users don't mistake it for a calibrated
// dose estimator.
// ---------------------------------------------------------------------------

const REGION_COLORS: Record<BodyRegionId, string> = {
  head: '#88ccff',
  neck: '#ffd866',
  cardiothoracic: '#ff7a4a',
  abdomen: '#c879ff',
  peripheral: '#7fffaf',
};

export interface MonteCarloPanelProps {
  /** Optional default seed for reproducibility. */
  seed?: number;
}

export const MonteCarloPanel: React.FC<MonteCarloPanelProps> = ({ seed = 7 }) => {
  const { t } = useLanguage();
  const [totalPhotons, setTotalPhotons] = useState(8000);
  const [runSeed, setRunSeed] = useState(seed);

  // runIllustrativeMC is O(N) so even 50k photons runs in <50 ms. No
  // need for web workers; recompute on params change synchronously.
  const run = useMemo(
    () => runIllustrativeMC(totalPhotons, runSeed),
    [totalPhotons, runSeed],
  );

  const perRegion = buildPerRegionConvergence(run);

  // Build a single recharts data series. One row per photon-count sample.
  // Each row has per-region mean columns. We sample at the union of N's
  // across all regions so the chart aligns.
  const seriesData = useMemo(() => {
    const allN = new Set<number>();
    for (const arr of Object.values(perRegion)) {
      for (const pt of arr) allN.add(pt.n);
    }
    const sortedN = Array.from(allN).sort((a, b) => a - b);
    return sortedN.map((n) => {
      const row: { n: number; [k: string]: number | null } = { n };
      for (const [rid, arr] of Object.entries(perRegion)) {
        const hit = arr.find((p) => p.n === n);
        row[rid] = hit ? hit.mean : null;
      }
      return row;
    });
  }, [perRegion]);

  // Sigma band — sampled at log-spaced N to keep the chart legible.
  const sigmaData = useMemo(() => {
    const traces: Record<
      BodyRegionId,
      { n: number; mean: number; upper: number; lower: number }[]
    > = { head: [], neck: [], cardiothoracic: [], abdomen: [], peripheral: [] };
    for (const [rid, arr] of Object.entries(perRegion)) {
      traces[rid as BodyRegionId] = arr.map((p) => ({
        n: p.n,
        mean: p.mean,
        upper: p.mean + p.sigma,
        lower: Math.max(0, p.mean - p.sigma),
      }));
    }
    return traces;
  }, [perRegion]);

  return (
    <div className="rounded-lg bg-bg-200 border border-white/10 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="font-medium text-text-100 text-sm">
          {t('mc_title')}
        </h4>
        <button
          onClick={() => setRunSeed((s) => s + 1)}
          className="text-xs px-2 py-1 rounded bg-primary-100 text-white hover:opacity-90"
        >
          {t('mc_rerun')}
        </button>
      </div>

      <p className="text-xs text-text-200 mb-3 leading-relaxed">
        {t('mc_desc', { energy: MC_PHOTON_ENERGY_KEV })}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <label className="text-xs text-text-200">
          {t('mc_photon_count')}
          <input
            type="range"
            min={500}
            max={50000}
            step={500}
            value={totalPhotons}
            onChange={(e) => setTotalPhotons(Number(e.target.value))}
            className="w-full mt-1"
          />
          <div className="font-mono text-[var(--sim-accent)] text-sm">
            {totalPhotons.toLocaleString()}
          </div>
        </label>
        <label className="text-xs text-text-200">
          {t('mc_seed')}
          <input
            type="number"
            min={1}
            value={runSeed}
            onChange={(e) => setRunSeed(Number(e.target.value) || 1)}
            className="w-full mt-1 bg-[#222] border border-[#555] rounded px-2 py-1 text-sm"
          />
          <div className="text-[10px] text-text-200 mt-0.5">
            {t('mc_seed_hint')}
          </div>
        </label>
        <div className="text-xs text-text-200">
          {t('mc_final_means')}
          <ul className="mt-1 font-mono text-xs space-y-0.5">
            {(Object.keys(run.final) as BodyRegionId[]).map((rid) => (
              <li key={rid} className="flex justify-between">
                <span style={{ color: REGION_COLORS[rid] }}>
                  {t(MC_REGION_KEY[rid])}:
                </span>
                <span className="text-text-100">
                  {run.final[rid].mean.toFixed(3)} ± {run.final[rid].sigma.toFixed(3)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={seriesData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="n"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="log"
              tickFormatter={(v: number) => v.toLocaleString()}
              stroke="#888"
              label={{ value: t('mc_axis_x'), position: 'insideBottom', offset: -2, fill: '#888', fontSize: 11 }}
            />
            <YAxis
              stroke="#888"
              label={{ value: t('mc_axis_y'), angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#222', border: '1px solid #444', color: '#eee' }}
              labelFormatter={(v: number) => t('mc_tooltip_photons', { n: v.toLocaleString() })}
              formatter={(value: number | string | Array<number | string>) => {
                if (typeof value === 'number') {
                  return [value.toFixed(4), ''];
                }
                if (Array.isArray(value)) {
                  const first = value[0];
                  if (typeof first === 'number') {
                    return [first.toFixed(4), ''];
                  }
                  return [String(first), ''];
                }
                return [String(value), ''];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {(Object.keys(REGION_COLORS) as BodyRegionId[]).map((rid) => (
              <Line
                key={rid}
                type="monotone"
                dataKey={rid}
                name={t(MC_REGION_KEY[rid])}
                stroke={REGION_COLORS[rid]}
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-2 text-xs text-text-200">
        <summary className="cursor-pointer hover:text-text-100">
          {t('mc_sigma_summary')}
        </summary>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {(Object.keys(sigmaData) as BodyRegionId[]).map((rid) => (
            <div key={rid} className="bg-bg-100 rounded p-2">
              <div
                className="font-mono text-[11px] mb-1"
                style={{ color: REGION_COLORS[rid] }}
              >
                {t(MC_REGION_KEY[rid])}
              </div>
              <table className="w-full text-[10px] text-text-200 font-mono">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-0.5">N</th>
                    <th className="text-right py-0.5">{t('mc_col_mean')}</th>
                    <th className="text-right py-0.5">σ</th>
                  </tr>
                </thead>
                <tbody>
                  {sigmaData[rid].slice(-5).map((p) => (
                    <tr key={p.n} className="border-b border-white/5">
                      <td className="py-0.5">{p.n.toLocaleString()}</td>
                      <td className="text-right py-0.5">{p.mean.toFixed(4)}</td>
                      <td className="text-right py-0.5">{p.upper.toFixed(4)}–{p.lower.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};
