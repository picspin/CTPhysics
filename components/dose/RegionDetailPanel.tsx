'use client';

import React from 'react';

import {
  BodyRegionId,
  BODY_REGIONS,
  ICRP103_ORGANS,
  ICRP103_TOTAL_WT,
  computeDoseForRegion,
} from '@/utils/dose-physics';
import { useLanguage } from '@/context/LanguageContext';
import { DOSE_REGION_KEY, ORGAN_KEY } from '@/i18n/labels';

// ---------------------------------------------------------------------------
// RegionDetailPanel — what shows in the right column when a region is
// clicked. Walks the user through the CTDIvol → DLP → SSDE → E chain
// with explicit "what this number means" callouts.
// ---------------------------------------------------------------------------

export interface RegionDetailPanelProps {
  region: BodyRegionId | null;
  mAs: number;
  kVp: number;
  pitch: number;
  scanLengthCm: number;
  waterEquivalentDiameterCm: number;
}

export const RegionDetailPanel: React.FC<RegionDetailPanelProps> = ({
  region,
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

  const meta = BODY_REGIONS[region];
  const breakdown = computeDoseForRegion({
    mAs,
    kVp,
    pitch,
    scanLengthCm,
    waterEquivalentDiameterCm,
    region,
  });
  const dominantWeight = breakdown.dominantWT;
  // Round trip the k-factor so the UI shows the value it actually used.
  const dominantOrgansList = meta.dominantOrgans
    .slice()
    .sort((a, b) => ICRP103_ORGANS[b] - ICRP103_ORGANS[a]);

  return (
    <div className="rounded-lg bg-bg-200 border border-white/10 p-4 space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-text-200">
          {t('region_selected')}
        </div>
        <div className="text-lg font-medium text-text-100">
          {t(DOSE_REGION_KEY[region])}
        </div>
        <div className="text-xs text-text-200 mt-0.5">
          {t('region_scan_info', { len: meta.representativeScanLengthCm, k: meta.kFactor })}
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
          {t('region_step2_body', { len: scanLengthCm })}
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

      {/* Step 4: Effective dose */}
      <div className="rounded bg-primary-100/10 border border-primary-100/40 p-3">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-primary-100">
              {t('region_step', { n: 4 })}
            </div>
            <div className="text-sm font-medium text-primary-100">
              {t('region_step4_title')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary-100">
              {breakdown.effectiveDoseMSv.toFixed(2)}
            </div>
            <div className="text-[10px] text-primary-100/80">mSv</div>
          </div>
        </div>
        <p className="text-xs text-text-200 mt-2 leading-relaxed">
          {t('region_step4_body', { wt: dominantWeight.toFixed(2), total: ICRP103_TOTAL_WT.toFixed(2) })}
        </p>
        <p className="text-[10px] text-orange-200/90 mt-2 leading-relaxed italic">
          {t('region_reminder')}
        </p>
      </div>

      {/* ICRP 103 organ dominance */}
      <div className="rounded bg-bg-100 p-3">
        <div className="text-sm font-medium text-text-100 mb-2">
          {t('region_organs_title')}
        </div>
        <ul className="space-y-1">
          {dominantOrgansList.map((organ) => {
            const wT = ICRP103_ORGANS[organ];
            const sharePct = (wT / dominantWeight) * 100;
            return (
              <li key={organ} className="text-xs flex justify-between">
                <span className="text-text-200">{t(ORGAN_KEY[organ])}</span>
                <span className="font-mono text-text-100">
                  w<sub>T</sub> = {wT.toFixed(2)} · {sharePct.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-text-200 mt-2 leading-relaxed">
          {t('region_organs_note')}
        </p>
      </div>
    </div>
  );
};
