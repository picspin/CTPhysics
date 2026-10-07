'use client';

import React from 'react';

import { BodyRegionId, BODY_REGIONS, computeDoseForRegion } from '@/utils/dose-physics';
import { INTERACTIVE_ORGANS, WT_TABLE_ROWS, isRemainder, topContributors } from '@/utils/organ-dose';
import { useLanguage, type MessageKey } from '@/context/LanguageContext';
import { DOSE_REGION_KEY } from '@/i18n/labels';

// ---------------------------------------------------------------------------
// RegionDetailPanel — what shows in the right column when a region is
// clicked. Walks the user through the CTDIvol → DLP → SSDE → E chain
// with explicit "what this number means" callouts.
// ---------------------------------------------------------------------------

export interface RegionDetailPanelProps {
  region: BodyRegionId | null;
  /** all regions in the (combined) scan, incl. `region`; ranges are merged and E is computed once */
  scanRegions?: BodyRegionId[];
  mAs: number;
  kVp: number;
  pitch: number;
  scanLengthCm: number;
  waterEquivalentDiameterCm: number;
}

const fmtW = (w: number) => (w < 0.01 ? w.toFixed(4) : w.toFixed(2));

export const RegionDetailPanel: React.FC<RegionDetailPanelProps> = ({
  region,
  scanRegions,
  mAs,
  kVp,
  pitch,
  scanLengthCm,
  waterEquivalentDiameterCm,
}) => {
  const { t } = useLanguage();
  if (!region) {
    return (
      <div className="rounded-lg bg-bg-200 border border-white/10 p-4 text-sm text-text-200">
        <div className="font-medium text-text-100 mb-1">
          {t('region_click_title')}
        </div>
        <p>{t('region_click_body')}</p>
      </div>
    );
  }

  const regionsInScan = Array.from(new Set([region, ...(scanRegions ?? [])]));
  const combined = regionsInScan.length > 1;
  const breakdown = computeDoseForRegion({
    mAs,
    kVp,
    pitch,
    scanLengthCm,
    waterEquivalentDiameterCm,
    region,
    regions: combined ? regionsInScan : undefined,
  });
  const od = breakdown.organDose;
  const keyOrgans = regionsInScan.flatMap((r) => BODY_REGIONS[r].keyOrgans);
  const tissueRow = (tissue: string) => od.tissues.find((x) => x.tissue === tissue);
  const top = topContributors(od, 6);
  const rangesText = od.ranges.map(([a, b]) => `${a.toFixed(0)}–${b.toFixed(0)}`).join(', ');

  return (
    <div className="rounded-lg bg-bg-200 border border-white/10 p-4 space-y-3" data-testid="region-detail">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-text-200">
          {t(combined ? 'region_selected_combined' : 'region_selected')}
        </div>
        <div className="text-lg font-medium text-text-100">
          {regionsInScan.map((r) => t(DOSE_REGION_KEY[r])).join(' + ')}
        </div>
        <div className="text-xs text-text-200 mt-0.5">
          {t('region_scan_info', { len: od.scanLengthCm.toFixed(0), z: rangesText })}
        </div>
      </div>

      {/* Step 1: CTDIvol */}
      <div className="rounded bg-bg-100 p-3">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-200">
              {t('region_step', { n: 1 })}
            </div>
            <div className="text-sm font-medium text-text-100">
              CTDI<sub>vol</sub>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-text-100">
              {breakdown.ctdiVolMgy.toFixed(2)}
            </div>
            <div className="text-[10px] text-text-200">mGy</div>
          </div>
        </div>
        <p className="text-xs text-text-200 mt-2 leading-relaxed">
          <span className="text-orange-300 font-medium">{t('region_important')}</span>{' '}
          {t('region_step1_body')}
        </p>
      </div>

      {/* Step 2: DLP */}
      <div className="rounded bg-bg-100 p-3">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-200">
              {t('region_step', { n: 2 })}
            </div>
            <div className="text-sm font-medium text-text-100">DLP</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-text-100">
              {breakdown.dlpMgyCm.toFixed(0)}
            </div>
            <div className="text-[10px] text-text-200">mGy·cm</div>
          </div>
        </div>
        <p className="text-xs text-text-200 mt-2 leading-relaxed">
          {t('region_step2_body', { len: od.scanLengthCm.toFixed(0) })}
        </p>
      </div>

      {/* Step 3: SSDE */}
      <div className="rounded bg-bg-100 p-3">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-200">
              {t('region_step', { n: 3 })}
            </div>
            <div className="text-sm font-medium text-text-100">SSDE</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-text-100">
              {breakdown.ssdeMgy.toFixed(2)}
            </div>
            <div className="text-[10px] text-text-200">
              f = {breakdown.ssdeFactor.toFixed(2)}
            </div>
          </div>
        </div>
        <p className="text-xs text-text-200 mt-2 leading-relaxed">
          {t('region_step3_body', { dw: waterEquivalentDiameterCm, f: breakdown.ssdeFactor.toFixed(2) })}
        </p>
      </div>

      {/* Step 4: organ doses H_T for the key organs */}
      <div className="rounded bg-bg-100 p-3">
        <div className="text-[10px] uppercase tracking-wide text-text-200">{t('region_step', { n: 4 })}</div>
        <div className="text-sm font-medium text-text-100 mb-1">{t('region_step_ht_title')}</div>
        <ul className="space-y-1" data-testid="region-key-organs">
          {keyOrgans.map((id) => {
            const info = INTERACTIVE_ORGANS[id];
            const row = info.tissue ? tissueRow(info.tissue) : undefined;
            return (
              <li key={id} className="text-xs flex justify-between gap-2">
                <span className="text-text-200">
                  {t(`body3_o_${id}` as MessageKey)}
                  {info.tissue && isRemainder(info.tissue) && (
                    <span className="ml-1 rounded bg-amber-400/15 px-1 text-[10px] text-amber-200">{t('organ_dose_remainder_badge')}</span>
                  )}
                </span>
                <span className="font-mono text-text-100">
                  {row ? t('region_ht_value', { f: (row.f * 100).toFixed(0), h: row.H.toFixed(2) }) : t('region_ht_limbs')}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-text-200 mt-2 leading-relaxed">{t('region_step_ht_body')}</p>
      </div>

      {/* Step 5: effective dose E = Σ wT HT, derived k */}
      <div className="rounded bg-primary-100/10 border border-primary-100/40 p-3">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-primary-100">
              {t('region_step', { n: 5 })}
            </div>
            <div className="text-sm font-medium text-primary-100">
              {t('region_step4_title')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary-100" data-testid="region-effective-dose">
              {breakdown.effectiveDoseMSv.toFixed(2)}
            </div>
            <div className="text-[10px] text-primary-100/80">mSv</div>
          </div>
        </div>
        <p className="text-xs text-text-200 mt-2 leading-relaxed">
          {t('region_step4_body', {
            rem: od.remainderMeanH.toFixed(2),
            remc: od.remainderContribution.toFixed(3),
            k: breakdown.kDerived.toFixed(4),
            dlp: breakdown.dlpMgyCm.toFixed(0),
            e: breakdown.effectiveDoseMSv.toFixed(2),
          })}
        </p>
        {combined && <p className="text-xs text-sky-200/90 mt-2 leading-relaxed">{t('region_combined_note')}</p>}
        <p className="text-[11px] text-amber-200/90 mt-2 leading-relaxed">{t('organ_dose_icrp_note')}</p>
        <p className="text-[10px] text-orange-200/90 mt-2 leading-relaxed italic">
          {t('region_reminder')}
        </p>
      </div>

      {/* Top contributors */}
      <div className="rounded bg-bg-100 p-3">
        <div className="text-sm font-medium text-text-100 mb-2">{t('region_organs_title')}</div>
        <ul className="space-y-1">
          {top.map((x) => (
            <li key={x.tissue} className="text-xs flex justify-between gap-2">
              <span className="text-text-200">{t(`body3_t_${x.tissue}` as MessageKey)}</span>
              <span className="font-mono text-text-100">
                {fmtW(x.wEff)} × {x.H.toFixed(2)} = {x.contribution.toFixed(3)} mSv
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-text-200 mt-2 leading-relaxed">{t('region_organs_note')}</p>
      </div>

      <WtTable />
      <p className="text-[10px] text-amber-300/90">{t('organ_dose_mock_note')}</p>
    </div>
  );
};

/** ICRP 103 tissue weighting factors (shown in the UI). */
export const WtTable: React.FC = () => {
  const { t } = useLanguage();
  const total = WT_TABLE_ROWS.reduce((a, r) => a + r.wT * r.tissues.length, 0);
  return (
    <div className="rounded bg-bg-100 p-3" data-testid="wt-table">
      <div className="text-sm font-medium text-text-100 mb-2">{t('wt_table_title')}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10 text-text-200">
            <th className="text-left py-1">{t('wt_table_tissue')}</th>
            <th className="text-right py-1">w<sub>T</sub></th>
            <th className="text-right py-1">Σ w<sub>T</sub></th>
          </tr>
        </thead>
        <tbody>
          {WT_TABLE_ROWS.map((r) => (
            <tr key={r.wT} className="border-b border-white/5">
              <td className="py-1 pr-2 text-text-100">{r.tissues.map((x) => t(x === 'remainder' ? 'wt_remainder' : (`body3_t_${x}` as MessageKey))).join(t('list_sep'))}</td>
              <td className="py-1 text-right font-mono">{r.wT.toFixed(2)}</td>
              <td className="py-1 text-right font-mono">{(r.wT * r.tissues.length).toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-1 font-medium text-text-100">{t('wt_table_total')}</td>
            <td />
            <td className="py-1 text-right font-mono font-medium">{total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-text-200 mt-2 leading-relaxed">{t('wt_remainder_rule')}</p>
    </div>
  );
};
