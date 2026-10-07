// The Dose page body model is now the shared v3.1 body (semi-transparent Fresnel skin over
// procedural MOCK organs). See ./body/bodyV3.ts. Kept as a stable import path.
export { createBodyV3 as createRegionSegmentedBodyModel } from './body/bodyV3';
export type { BodyV3 as BodyModel, BodyPick } from './body/bodyV3';
