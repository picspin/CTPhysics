'use client';

import React from 'react';

import {
  BodyRegionId,
  BODY_REGIONS,
  ICRP103_ORGANS,
  ICRP103_ORGAN_NAMES,
  ICRP103_TOTAL_WT,
  computeDoseForRegion,
} from '@/utils/dose-physics';

// ---------------------------------------------------------------------------
// RegionDetailPanel — what shows in the right column when a region is
// clicked. Walks the user through the CTDIvol → DLP → SSDE → E chain
// with explicit "what this number means" callouts.
// ---------------------------------------------------------------------------

const REGION_DISPLAY: Record<BodyRegionId, { zh: string; en: string }> = {
  head: { zh: '头部', en: 'Head' },
  neck: { zh: '颈部 / 甲状腺', en: 'Neck (Thyroid)' },
  cardiothoracic: { zh: '心胸', en: 'Cardiothoracic' },
  abdomen: { zh: '腹部', en: 'Abdomen' },
  peripheral: { zh: '四肢 / 周围', en: 'Peripheral' },
};

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
  if (!region) {
    return (
      <div className="rounded-lg bg-bg-200 border border-white/10 p-4 text-sm text-text-200">
        <div className="font-medium text-text-100 mb-1">
          点击区域 (Click a region)
        </div>
        <p>
          Click any of the five colored regions on the body model to see
          the CTDIvol → DLP → SSDE → Effective dose chain for that region,
          along with which ICRP 103 organs dominate the dose.
        </p>
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
          Selected region
        </div>
        <div className="text-lg font-medium text-text-100">
          {REGION_DISPLAY[region].en} · {REGION_DISPLAY[region].zh}
        </div>
        <div className="text-xs text-text-200 mt-0.5">
          Representative scan length {meta.representativeScanLengthCm} cm ·
          k-factor {meta.kFactor} mSv/mGy·cm
        </div>
      </div>

      {/* Step 1: CTDIvol */}
      <div className="rounded bg-bg-100 p-3">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-200">
              Step 1
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
          <span className="text-orange-300 font-medium">Important:</span> CTDIvol
          is what the scanner MEASURED in a standard PMMA phantom (16 cm head
          / 32 cm body). It is NOT patient dose. It tells you what the machine
          emitted, not what this body absorbed.
        </p>
      </div>

      {/* Step 2: DLP */}
      <div className="rounded bg-bg-100 p-3">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-200">
              Step 2
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
          DLP = CTDIvol × scan length ({scanLengthCm} cm). Represents the
          total energy the scanner imparted to the phantom over the scan
          range.
        </p>
      </div>

      {/* Step 3: SSDE */}
      <div className="rounded bg-bg-100 p-3">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-200">
              Step 3
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
          SSDE = CTDIvol × f(Dw) — the patient-specific correction from
          AAPM Report 204/220. At Dw = {waterEquivalentDiameterCm} cm the
          conversion factor f is {breakdown.ssdeFactor.toFixed(2)}. Smaller
          patients get larger f → SSDE diverges UPWARD from CTDIvol. Larger
          patients: SSDE diverges DOWNWARD. That divergence is the lesson.
        </p>
      </div>

      {/* Step 4: Effective dose */}
      <div className="rounded bg-primary-100/10 border border-primary-100/40 p-3">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-primary-100">
              Step 4
            </div>
            <div className="text-sm font-medium text-primary-100">
              Effective dose E
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
          E = DLP × k<sub>region</sub>. The k-factor folds in ICRP 103 tissue-
          weighting factors for the organs in the scan range. The dominant
          contributors for this region sum to w<sub>T</sub> ≈{' '}
          {dominantWeight.toFixed(2)} of the total {ICRP103_TOTAL_WT.toFixed(2)}.
        </p>
        <p className="text-[10px] text-orange-200/90 mt-2 leading-relaxed italic">
          Reminder: effective dose is a population-averaged protection quantity
          for comparing protocols — NOT an individual patient&apos;s risk estimate.
          ICRP 103 explicitly warns against using E to estimate an individual&apos;s
          cancer risk.
        </p>
      </div>

      {/* ICRP 103 organ dominance */}
      <div className="rounded bg-bg-100 p-3">
        <div className="text-sm font-medium text-text-100 mb-2">
          ICRP 103 organs dominating this region
        </div>
        <ul className="space-y-1">
          {dominantOrgansList.map((organ) => {
            const wT = ICRP103_ORGANS[organ];
            const sharePct = (wT / dominantWeight) * 100;
            return (
              <li key={organ} className="text-xs flex justify-between">
                <span className="text-text-200">{ICRP103_ORGAN_NAMES[organ]}</span>
                <span className="font-mono text-text-100">
                  w<sub>T</sub> = {wT.toFixed(2)} · {sharePct.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-text-200 mt-2 leading-relaxed">
          ICRP 103 (2007) raised breast (0.05→0.12) and lowered gonads
          (0.20→0.08) vs. ICRP 60. Thyroid stays at 0.04 — small individually,
          but high effective dose per mGy because of concentrated deposition
          on the gland during neck CT.
        </p>
      </div>
    </div>
  );
};
