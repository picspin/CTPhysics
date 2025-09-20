export type Option = { id: string; name: string } | { value: number; name: string };

export type ImageOption = { id: string; name: string; src?: string };

export type BackprojectionOptions = {
  images: ImageOption[];
  fanBeamAngles: { value: number; name: string }[];
};

export type HelicalCTOptions = {
  images: ImageOption[];
  pitchValues: { value: number; name: string; description?: string }[];
};

export type CardiacGatingOptions = {
  gatingTypes: { id: string; name: string }[];
  heartRates?: number[];
};

export type RadiationDoseOptions = {
  gatingTypes: { id: string; name: string }[];
  patientSizes: { id: string; name: string }[];
};

export type DualEnergyOptions = {
  reconstructionTypes: { id: string; name: string }[];
  cases: { id: string; name: string }[];
};

export type XrayAttenuationOptions = {
  tissues: { id: string; name: string }[];
  iodineConcentrations?: number[];
};

export type Section = {
  id: string;
  title: string;
  description?: string;
  content?: string;
  keyPoints?: string[];
  simulator?: { type: string; options?: unknown };
};

export type PageConfig = {
  title: string;
  description?: string;
  sections: Section[];
};
