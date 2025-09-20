import { z } from 'zod';
import type { PageConfig } from './types';

export const ImageOptionSchema = z.object({ id: z.string(), name: z.string(), src: z.string().optional() });

export const BackprojectionOptionsSchema = z.object({
  images: z.array(ImageOptionSchema),
  fanBeamAngles: z.array(z.object({ value: z.number(), name: z.string() })),
});

export const HelicalCTOptionsSchema = z.object({
  images: z.array(ImageOptionSchema),
  pitchValues: z.array(z.object({ value: z.number(), name: z.string(), description: z.string().optional() })),
});

export const CardiacGatingOptionsSchema = z.object({
  gatingTypes: z.array(z.object({ id: z.string(), name: z.string() })),
  heartRates: z.array(z.number()).optional(),
});

export const RadiationDoseOptionsSchema = z.object({
  gatingTypes: z.array(z.object({ id: z.string(), name: z.string() })),
  patientSizes: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const DualEnergyOptionsSchema = z.object({
  reconstructionTypes: z.array(z.object({ id: z.string(), name: z.string() })),
  cases: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const XrayAttenuationOptionsSchema = z.object({
  tissues: z.array(z.object({ id: z.string(), name: z.string() })),
  iodineConcentrations: z.array(z.number()).optional(),
});

export const SectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
  simulator: z.object({ type: z.string(), options: z.unknown().optional() }).optional(),
});

export const PageConfigSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  sections: z.array(SectionSchema),
});

export function parsePageConfig(json: unknown): PageConfig {
  const result = PageConfigSchema.safeParse(json);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid page config: ${message}`);
  }
  return result.data;
}

