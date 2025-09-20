export type GatingType = 'prospective' | 'retrospective' | 'retrospective-modulation';
export type PatientSize = 'small' | 'medium' | 'large';

const BASE_DOSE_MSV: Record<GatingType, number> = {
  prospective: 3,
  'retrospective-modulation': 8,
  retrospective: 12,
};

const SIZE_FACTOR: Record<PatientSize, number> = {
  small: 0.8,
  medium: 1.0,
  large: 1.5,
};

export function effectiveDose(gating: GatingType, size: PatientSize): number {
  return BASE_DOSE_MSV[gating] * SIZE_FACTOR[size];
}

export function computeDoseComparison(gating: GatingType, size: PatientSize) {
  return [
    { name: '前瞻性门控', dose: effectiveDose('prospective', size), active: gating === 'prospective' },
    { name: '带ECG调制的回顾性门控', dose: effectiveDose('retrospective-modulation', size), active: gating === 'retrospective-modulation' },
    { name: '回顾性门控', dose: effectiveDose('retrospective', size), active: gating === 'retrospective' },
  ];
}

export function riskLevelForDose(dose: number): { level: '低' | '中' | '高'; text: string } {
  if (dose < 5) return { level: '低', text: '相当于约1.5年的自然背景辐射' };
  if (dose < 10) return { level: '中', text: '相当于约3年的自然背景辐射' };
  return { level: '高', text: '相当于约4年的自然背景辐射' };
}

