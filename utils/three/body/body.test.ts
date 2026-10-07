import { describe, it, expect } from 'vitest';
import { ICRP103_WT, REGION_TISSUES, REGION_IDS, regionWtSum, regionAt, REMAINDER_MEMBERS } from './regions';
import { cmToLocal, localToCm, regionOfSkinPoint, clampSkinOpacity, SKIN_OPACITY_DEFAULT } from './geometryMath';
import { buildLoft, evalSection, SURFACE_TABLE, SECTION_ROWS } from './surface';
import { ORGANS } from './organs';
import { ICRP103_ORGANS } from '@/utils/dose-physics';

describe('ICRP 103 wT allocation (5 coarse regions)', () => {
  it('all 27 tissues sum to 1', () => {
    const total = Object.values(ICRP103_WT).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
  it('remainder has 13 members of 0.12/13 each', () => {
    expect(REMAINDER_MEMBERS).toHaveLength(13);
    expect(REMAINDER_MEMBERS.reduce((a, t) => a + ICRP103_WT[t], 0)).toBeCloseTo(0.12, 10);
  });
  it('every tissue is in exactly one bucket and buckets sum to 1', () => {
    const all = [...REGION_IDS, 'unassigned' as const].flatMap((r) => REGION_TISSUES[r]);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(Object.keys(ICRP103_WT).length);
    const sum = [...REGION_IDS, 'unassigned' as const].reduce((a, r) => a + regionWtSum(r), 0);
    expect(sum).toBeCloseTo(1, 10);
  });
  it('thyroid is in head & neck; named wT values match utils/dose-physics', () => {
    expect(REGION_TISSUES.neck).toContain('thyroid');
    for (const k of ['lung', 'colon', 'stomach', 'breast', 'gonads', 'liver', 'thyroid', 'brain', 'skin'] as const) {
      expect(ICRP103_WT[k]).toBe(ICRP103_ORGANS[k]);
    }
  });
});

describe('region classification', () => {
  it('maps trunk z to coarse regions', () => {
    expect(regionAt(5)).toBe('head');
    expect(regionAt(27)).toBe('neck');
    expect(regionAt(50)).toBe('cardiothoracic');
    expect(regionAt(80)).toBe('abdomen');
    expect(regionAt(140, 'leg')).toBe('peripheral');
    expect(regionAt(50, 'arm')).toBe('peripheral');
  });
  it('skin points on the arm are peripheral', () => {
    expect(regionOfSkinPoint(21, 60)).toBe('peripheral');
    expect(regionOfSkinPoint(0, 60)).toBe('cardiothoracic');
  });
  it('organs carry a valid region and the thyroid organ is head & neck', () => {
    for (const o of ORGANS) expect(REGION_IDS).toContain(o.region);
    expect(ORGANS.find((o) => o.id === 'thyroid')!.region).toBe('neck');
  });
});

describe('frame mapping and surface', () => {
  it('cm <-> local round-trips for both orientations', () => {
    for (const anterior of [1, -1] as const) {
      const f = { s: 0.027, topY: 2.6, anterior };
      const [x, y, z] = localToCm(f, ...cmToLocal(f, 3, -4, 50));
      expect(x).toBeCloseTo(3); expect(y).toBeCloseTo(-4); expect(z).toBeCloseTo(50);
    }
  });
  it('PCHIP section does not overshoot key rows (trunk width bounded)', () => {
    const out = [0, 0, 0, 0, 0];
    const [off, n] = SURFACE_TABLE.off.body;
    const maxRx = Math.max(...SECTION_ROWS.body.map((r) => r[1]));
    for (let z = 0.5; z < 108; z += 0.5) {
      expect(evalSection(SURFACE_TABLE.kps, off, n, z, out)).toBe(true);
      expect(out[0]).toBeLessThanOrEqual(maxRx + 1e-9);
    }
  });
  it('loft produces closed ring topology', () => {
    const l = buildLoft('leg', 1, 24, 2.5);
    expect(l.pos.length / 3).toBe(l.zs.length * 24);
    expect(l.idx.length).toBe((l.zs.length - 1) * 24 * 6);
  });
  it('skin opacity is clamped to 5%..90%', () => {
    expect(clampSkinOpacity(0)).toBe(0.05);
    expect(clampSkinOpacity(2)).toBe(0.9);
    expect(clampSkinOpacity(NaN)).toBe(SKIN_OPACITY_DEFAULT);
  });
});

describe('review fixes (#14)', () => {
  it('every organ and ICRP tissue has zh/en label keys', async () => {
    const { zh } = await import('@/i18n/zh');
    const { en } = await import('@/i18n/en');
    for (const o of ORGANS) {
      expect(zh).toHaveProperty(`body3_o_${o.id}`);
      expect(en).toHaveProperty(`body3_o_${o.id}`);
      if (o.icrp) { expect(zh).toHaveProperty(`body3_t_${o.icrp}`); expect(en).toHaveProperty(`body3_t_${o.icrp}`); }
    }
  });
  it('legs (incl. thighs) are always peripheral', () => {
    for (const z of [88, 95, 105, 120, 160]) expect(regionAt(z, 'leg')).toBe('peripheral');
  });
  it('skin triangles face outward in both upright and mirrored frames', async () => {
    const THREE = await import('three');
    const { createBodyV3 } = await import('./bodyV3');
    for (const anterior of [1, -1] as const) {
      const b = createBodyV3({ frame: { anterior }, organs: false });
      const m = b.group.children.find((c) => c.userData.organId === 'skin') as InstanceType<typeof THREE.Mesh>;
      const p = m.geometry.attributes.position; const ix = m.geometry.index!;
      const a = new THREE.Vector3(), q = new THREE.Vector3(), c = new THREE.Vector3();
      let out = 0, tot = 0;
      for (let k = 0; k < ix.count; k += 3) {
        a.fromBufferAttribute(p, ix.getX(k)); q.fromBufferAttribute(p, ix.getX(k + 1)); c.fromBufferAttribute(p, ix.getX(k + 2));
        const cen = a.clone().add(q).add(c).divideScalar(3);
        if (Math.abs(cen.x) > 0.2) continue;
        const n = q.clone().sub(a).cross(c.clone().sub(a));
        tot++; if (n.x * cen.x + n.z * cen.z > 0) out++;
      }
      expect(out / tot).toBeGreaterThan(0.6);
      b.dispose();
    }
  });
});
