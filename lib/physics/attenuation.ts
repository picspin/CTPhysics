export type TissueId = 'soft_tissue' | 'fat' | 'bone' | 'iodine' | 'iodine_enhanced' | 'water' | 'air';

const BASE_VALUES: Record<TissueId, number> = {
  soft_tissue: 0.3,
  fat: 0.2,
  bone: 0.7,
  iodine: 1.5,
  iodine_enhanced: 0.4,
  water: 0.25,
  air: 0.01,
};

export function calculateAttenuation(tissue: TissueId, energyKeV: number, options?: { iodineConcentration?: number }): number {
  const concentration = options?.iodineConcentration ?? 5;
  const base = BASE_VALUES[tissue];
  let attenuation = base * Math.pow(80 / energyKeV, 2.5);

  if ((tissue === 'iodine' || tissue === 'iodine_enhanced') && energyKeV >= 33 && energyKeV < 40) {
    attenuation *= 2.5 - (energyKeV - 33) * 0.2;
  }

  if (tissue === 'iodine') {
    attenuation *= concentration / 5;
  } else if (tissue === 'iodine_enhanced') {
    attenuation = BASE_VALUES.soft_tissue * Math.pow(80 / energyKeV, 2.5) + (concentration / 10) * BASE_VALUES.iodine * Math.pow(80 / energyKeV, 2.5);
    if (energyKeV >= 33 && energyKeV < 40) {
      attenuation += (concentration / 10) * BASE_VALUES.iodine * (2.5 - (energyKeV - 33) * 0.2);
    }
  }

  return attenuation;
}

export function generateAttenuationDataset(energies: number[], iodineConcentration: number): Array<Record<TissueId | 'energy', number>> {
  return energies.map((energy) => ({
    energy,
    soft_tissue: calculateAttenuation('soft_tissue', energy),
    fat: calculateAttenuation('fat', energy),
    bone: calculateAttenuation('bone', energy),
    iodine: calculateAttenuation('iodine', energy, { iodineConcentration }),
    iodine_enhanced: calculateAttenuation('iodine_enhanced', energy, { iodineConcentration }),
    water: calculateAttenuation('water', energy),
    air: calculateAttenuation('air', energy),
  }));
}

