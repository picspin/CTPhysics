# Linked CT slice (WASM) and organ-by-organ effective dose

## 1. CT slice kernel

| Item | Location |
|---|---|
| Kernel source (AssemblyScript) | `wasm/ct-kernel/assembly/index.ts` (ported unchanged from the 3D prototype v3.1) |
| Built binary (committed, 7 425 bytes) | `public/wasm/ct_kernel.wasm` |
| Build script | `npm run build:wasm` → `scripts/build-wasm.sh` |
| JS fallback (same arithmetic) | `utils/three/body/slice/engines.ts` (`JsSliceEngine`, `rasterizeSlice`, `shadeSlice`) |
| Kernel inputs (primitive table, MOCK HU) | `utils/three/body/slice/volume.ts` |
| UI | `components/body/CtSlicePanel.tsx` |
| Parity test | `utils/three/body/slice/slice.test.ts` (labels / HU / RGBA bit-identical WASM vs JS) |

**Toolchain.** AssemblyScript **0.28.20**, invoked through `npx --package assemblyscript@0.28.20` (pure npm, no
Rust/Emscripten). Flags: `--runtime stub --optimizeLevel 3 --shrinkLevel 1 --noAssert`. Node ≥ 18 and network on first
run. The `.wasm` is committed, so `npm run build` / Vercel never compile it. Rebuilding produces a byte-identical file
(sha256 `3cfa3247…f8f23183`).

**Runtime.**
* Lazy: `CtSlicePanel` is loaded with `next/dynamic` only when the user ticks "Linked CT slice"; the kernel is fetched
  from `/wasm/ct_kernel.wasm` at that moment.
* WASM path voxelises a 256 × 256 × 351 label volume (0.195 cm pixels, 0.5 cm slices, z = 0–175 cm) once in linear
  memory (~23 MB), then renders any axial slice in ~1–2 ms.
* Mobile-safe: on screens ≤ 768 px or `navigator.deviceMemory < 4` the default is the JS engine, which rasterises
  **only the requested slice** (64 kB, 24-slice LRU) — no full volume. Any WASM failure (fetch, CSP, old browser) falls
  back to JS automatically and the panel says so. The user can switch engines.
* Only numbers cross the JS/WASM boundary; slice HU/RGBA/labels are read through typed-array views on `memory.buffer`.

**Linking.**
* Helical CT: each frame the gantry plane (world z = 0) is transformed into the patient's local frame
  (`body.group.worldToLocal` → `localToCm`), giving the body z currently in the gantry. The slice follows the couch;
  outside 0–175 cm the panel says the plane is outside the patient. The illustrative kV overlay is hidden while linked.
* Dose 3D viewer: slice z slider (0–175 cm); selecting a key organ moves the slice to the organ centre.
* In both, the slice is also drawn as a textured axial plane inside the body (`BodyV3.setSlice`), with air transparent.

Everything in the volume is **MOCK**: procedural ellipsoids/tubes and illustrative HU values.

## 2. Organ-by-organ effective dose (`utils/organ-dose.ts`)

ICRP methodology: effective dose for CT must be computed organ by organ with tissue weighting.

* `E = Σ_T w_T H_T` over **all** tissues (whole body), w_T from ICRP 103 (table below, Σ = 1.00).
* Remainder: `0.12 × mean(H_T)` over the 13 ICRP 103 remainder tissues (adrenals, extrathoracic region, gall bladder,
  **heart**, **kidneys**, lymphatic nodes, muscle, oral mucosa, pancreas, prostate or uterus/cervix, small intestine,
  spleen, thymus).
* Region k is **derived**: `k = E / DLP`; `E_region = DLP × k`. No published k-factor table is used anywhere.
* Combined scans: scan ranges are merged first; each organ's H_T comes from its coverage by the union; E is computed
  once. Per-region E values are never added (naive addition double-counts the out-of-field share and any overlap).

| w_T | Tissues |
|---|---|
| 0.12 | red bone marrow, colon, stomach, lung, breast, remainder |
| 0.08 | gonads |
| 0.04 | bladder, oesophagus, liver, thyroid |
| 0.01 | bone surface, brain, salivary glands, skin |

**MOCK teaching model for H_T:** `H_T = CTDIvol × [f_T + s (1 − f_T)]`, f_T = fraction of the tissue's mass inside the
scanned z-range, s = 0.01 flat out-of-field scatter. Organ z-extents come from the procedural body
(`utils/three/body/organs.ts`, mass ∝ cross-section) or a hand-made table for tissues without a mesh
(`TISSUE_SEGMENTS_MOCK`: marrow, bone surface, skin, muscle, lymph nodes, breast, gonads, salivary glands, ET region,
oral mucosa, thymus, prostate/uterus). No tube-current modulation, spectrum, size or depth dependence.
Resulting derived k (CTDIvol-independent): head 0.0020, neck 0.0052, cardiothoracic 0.0116, abdomen 0.0118, limbs 0.0009
mSv/(mGy·cm) — same order as published values, but **derived from a mock model, not sourced**.

**Interactive organs (ICRP-102-style key regions):** head → brain; neck → thyroid; cardiothoracic → lungs, heart;
abdomen → liver, kidneys; limbs/trunk → limb bones (skin/bone/marrow/muscle). All other organs render dimmed and are
not pickable, but every tissue still enters E.
