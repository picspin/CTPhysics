import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildSliceInit, ORGAN_LABEL, NN } from './volume';
import { JsSliceEngine, WasmSliceEngine, zToK } from './engines';

describe('CT slice kernel: WASM vs JS fallback parity (MOCK volume)', () => {
  it('labels, HU and RGBA are bit-identical at several z', async () => {
    const d = buildSliceInit();
    const bytes = fs.readFileSync(path.join(process.cwd(), 'public/wasm/ct_kernel.wasm'));
    const w = await WasmSliceEngine.fromBytes(bytes, d);
    const j = new JsSliceEngine(d);
    for (const z of [5, 12.5, 27, 50, 66, 72.5, 90, 101, 130, 170]) {
      for (const noise of [false, true]) {
        const sel = ORGAN_LABEL.liver;
        const a = w.render(z, 400, 40, sel, noise), b = j.render(z, 400, 40, sel, noise);
        expect(Buffer.from(a.labels).equals(Buffer.from(b.labels))).toBe(true);
        expect(Buffer.from(a.hu.buffer, a.hu.byteOffset, NN * 2).equals(Buffer.from(b.hu.buffer, b.hu.byteOffset, NN * 2))).toBe(true);
        expect(Buffer.from(a.rgba.buffer, a.rgba.byteOffset, NN * 4).equals(Buffer.from(b.rgba.buffer, b.rgba.byteOffset, NN * 4))).toBe(true);
      }
    }
  }, 60000);
  it('slices contain the expected key organs at their z (MOCK geometry)', () => {
    const j = new JsSliceEngine(buildSliceInit());
    const has = (z: number, id: string) => j.render(z, 400, 40, 0).labels.includes(ORGAN_LABEL[id]);
    expect(has(10, 'brain')).toBe(true);
    expect(has(28, 'thyroid')).toBe(true);
    expect(has(52, 'heart')).toBe(true);
    expect(has(52, 'lungs')).toBe(true);
    expect(has(70, 'liver')).toBe(true);
    expect(has(76, 'kidneys')).toBe(true);
    expect(has(140, 'limbbones')).toBe(true);
    expect(has(140, 'liver')).toBe(false);
  });
  it('zToK clamps to the volume', () => {
    expect(zToK(-5)).toBe(0); expect(zToK(500)).toBe(350); expect(zToK(10.2)).toBe(20);
  });
});
