import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  ANATOMY,
  ANATOMY_TIER_SEGMENTS,
  AnatomyTier,
  disposeAnatomyGeometryCache,
  getAnatomyPrimitiveGeometry,
} from '@/utils/three/anatomy';
import { BodyRegionId, BODY_REGIONS } from '@/utils/dose-physics';

describe('anatomy spec', () => {
  it('declares a tier-segment table with the three canonical tiers', () => {
    const tiers: AnatomyTier[] = ['low', 'standard', 'hero'];
    for (const t of tiers) {
      const [w, h] = ANATOMY_TIER_SEGMENTS[t];
      expect(w).toBeGreaterThanOrEqual(8);
      expect(h).toBeGreaterThanOrEqual(6);
      expect(w).toBeLessThanOrEqual(64);
      expect(h).toBeLessThanOrEqual(48);
    }
  });

  it('produces a recognisably human set of parts (head + neck + ribcage + waist + pelvis + 4 limbs)', () => {
    const ids = ANATOMY.map((p) => p.id);
    // Trunk
    expect(ids).toContain('head');
    expect(ids).toContain('neck');
    expect(ids).toContain('shoulders');
    expect(ids).toContain('ribcage');
    expect(ids).toContain('waist');
    expect(ids).toContain('pelvis');
    // 4 limbs × 3 segments (upper/fore + hand for arms; thigh/calf + foot for legs)
    for (const side of ['L', 'R']) {
      expect(ids).toContain(`upperArm${side}`);
      expect(ids).toContain(`forearm${side}`);
      expect(ids).toContain(`hand${side}`);
      expect(ids).toContain(`thigh${side}`);
      expect(ids).toContain(`calf${side}`);
      expect(ids).toContain(`foot${side}`);
    }
  });

  it('assigns every part to either a valid regionId or null', () => {
    const valid = new Set<BodyRegionId>(['head', 'neck', 'cardiothoracic', 'abdomen', 'peripheral']);
    for (const part of ANATOMY) {
      if (part.regionId !== null) {
        expect(valid.has(part.regionId)).toBe(true);
      }
    }
  });

  it('covers all 5 dose regions across its parts', () => {
    const seen = new Set<BodyRegionId>();
    for (const part of ANATOMY) {
      if (part.regionId) seen.add(part.regionId);
    }
    expect(seen.size).toBe(5);
    for (const rid of Object.keys(BODY_REGIONS) as BodyRegionId[]) {
      expect(seen.has(rid)).toBe(true);
    }
  });

  it('lays the body in a monotonic head-down order along Y (head highest)', () => {
    const head = ANATOMY.find((p) => p.id === 'head')!;
    const feetL = ANATOMY.find((p) => p.id === 'footL')!;
    expect(head.position[1]).toBeGreaterThan(feetL.position[1]);
    // Pelvis below waist, waist below ribcage.
    const ribcage = ANATOMY.find((p) => p.id === 'ribcage')!;
    const waist = ANATOMY.find((p) => p.id === 'waist')!;
    const pelvis = ANATOMY.find((p) => p.id === 'pelvis')!;
    expect(ribcage.position[1]).toBeGreaterThan(waist.position[1]);
    expect(waist.position[1]).toBeGreaterThan(pelvis.position[1]);
  });

  it('produces valid THREE BufferGeometry for every part kind and tier', () => {
    // Wipe cache so this run is hermetic.
    disposeAnatomyGeometryCache();
    const tiers: AnatomyTier[] = ['low', 'standard', 'hero'];
    const kinds = ['sphere', 'capsule', 'cylinder', 'box'] as const;
    for (const t of tiers) {
      for (const k of kinds) {
        const geo = getAnatomyPrimitiveGeometry(k, t, [1, 1, 1]);
        expect(geo).toBeInstanceOf(THREE.BufferGeometry);
        // BufferGeometry must have a position attribute.
        expect(geo.attributes.position).toBeDefined();
        expect(geo.attributes.position.count).toBeGreaterThan(0);
      }
    }
    disposeAnatomyGeometryCache();
  });

  it('memoises geometries — same kind+tier+extra returns the same instance', () => {
    disposeAnatomyGeometryCache();
    const a = getAnatomyPrimitiveGeometry('sphere', 'standard', [1, 1, 1]);
    const b = getAnatomyPrimitiveGeometry('sphere', 'standard', [1, 1, 1]);
    expect(a).toBe(b);
    disposeAnatomyGeometryCache();
  });
});
