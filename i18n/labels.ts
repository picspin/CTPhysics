import type { MessageKey } from './keys';

/**
 * Typed id -> message-key maps, so components can translate domain ids
 * (organs, regions, tissues, ...) without building keys from template
 * strings (which would defeat the compile-time key check).
 */

export const ORGAN_KEY = {
  gonads: 'organ_gonads',
  redBoneMarrow: 'organ_redBoneMarrow',
  colon: 'organ_colon',
  lung: 'organ_lung',
  stomach: 'organ_stomach',
  breast: 'organ_breast',
  bladder: 'organ_bladder',
  oesophagus: 'organ_oesophagus',
  liver: 'organ_liver',
  thyroid: 'organ_thyroid',
  boneSurface: 'organ_boneSurface',
  brain: 'organ_brain',
  salivaryGlands: 'organ_salivaryGlands',
  skin: 'organ_skin',
  remainder: 'organ_remainder',
} as const satisfies Record<string, MessageKey>;

export const DOSE_REGION_KEY = {
  head: 'dose_region_head',
  neck: 'dose_region_neck',
  cardiothoracic: 'dose_region_cardiothoracic',
  abdomen: 'dose_region_abdomen',
  peripheral: 'dose_region_peripheral',
} as const satisfies Record<string, MessageKey>;

export const MC_REGION_KEY = {
  head: 'mc_region_head',
  neck: 'mc_region_neck',
  cardiothoracic: 'mc_region_cardiothoracic',
  abdomen: 'mc_region_abdomen',
  peripheral: 'mc_region_peripheral',
} as const satisfies Record<string, MessageKey>;

export const TISSUE_KEY = {
  air: 'tissue_air',
  fat: 'tissue_fat',
  soft: 'tissue_soft',
  lung: 'tissue_lung',
  marrow: 'tissue_marrow',
  bone: 'tissue_bone',
} as const satisfies Record<string, MessageKey>;
