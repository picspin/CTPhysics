'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/context/LanguageContext';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createProceduralEnvironment } from '@/utils/three/proceduralEnvironment';
import { createMedicalLightingRig } from '@/utils/three/sceneLighting';
import { createPostFX } from '@/utils/three/postFX';
import { createRegionSegmentedBodyModel, BodyModel } from '@/utils/three/bodyModel';
import { ORGANS, organCenter } from '@/utils/three/body/organs';
import { INTERACTIVE_ORGANS, ICRP103_WT_TABLE, isRemainder, REMAINDER_TISSUES } from '@/utils/organ-dose';
import { SKIN_OPACITY_DEFAULT } from '@/utils/three/body/geometryMath';
import type { MessageKey } from '@/i18n';
// lazy: the slice engines (WASM + JS twin) are only fetched when the user turns the slice on
const CtSlicePanel = dynamic(() => import('@/components/body/CtSlicePanel'), { ssr: false });
import {
  BodyRegionId,
  computeDoseForRegion,
  doseColorScalar,
  DOSE_COLOR_MIN_MSV,
  DOSE_COLOR_MAX_MSV,
  BODY_REGIONS,
} from '@/utils/dose-physics';

// ---------------------------------------------------------------------------
// 3D viewer for the region-segmented body model used by the Dose page.
//
// Owns its own scene/renderer/camera/controls (per the Phase 2 idiom in
// HelicalCTSimulator.tsx). All scene handles live in `sceneRef` so
// React effects can mutate them without re-initialising.
//
// Click flow:
//   1. Pointer-down records pointer position.
//   2. Pointer-up if movement < 5 px → treat as click.
//   3. Cast THREE.Raycaster against region meshes; first hit's
//      userData.regionId becomes `selectedRegion`.
//   4. Hover drives `hoveredRegion` from a separate raycast on move.
// ---------------------------------------------------------------------------

export interface BodyModelViewerProps {
  /** Currently selected region. Controlled by parent. */
  selectedRegion: BodyRegionId | null;
  /** Notifies parent of click events on a region. */
  onRegionSelect: (region: BodyRegionId | null) => void;
  /** Patient habitus multiplier (1.0 = adult). Drives body scale. */
  bodyScale: number;
  /**
   * Per-region dose values (mSv). If provided, regions are color-mapped
   * from low (cool) → high (warm) along this scale.
   */
  regionDoseMSv: Partial<Record<BodyRegionId, number>>;
  /** Optional className for the outer container. */
  className?: string;
}

const PADDING_TOP_PX = 56; // header overlay above canvas
const PADDING_BOTTOM_PX = 36; // footer hint

export const BodyModelViewer: React.FC<BodyModelViewerProps> = ({
  selectedRegion,
  onRegionSelect,
  bodyScale,
  regionDoseMSv,
  className,
}) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const [, setHoveredRegion] = useState<BodyRegionId | null>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [skinOpacity, setSkinOpacity] = useState(SKIN_OPACITY_DEFAULT);
  const [showOrgans, setShowOrgans] = useState(true);
  const invalidateRef = useRef<() => void>(() => {});
  const [sliceOn, setSliceOn] = useState(false);
  const [sliceZ, setSliceZ] = useState(52);
  const sliceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const onPlaneCanvas = useCallback((c: HTMLCanvasElement | null) => { sliceCanvasRef.current = c; }, []);
  const onSliceRendered = useCallback(() => {
    const body = sceneRef.current?.body;
    if (!body) return;
    body.setSlice(sliceZRef.current, sliceCanvasRef.current);
    body.refreshSliceTexture();
    invalidateRef.current();
  }, []);
  const sliceZRef = useRef(sliceZ);
  sliceZRef.current = sliceZ;

  type SceneRef = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    env: ReturnType<typeof createProceduralEnvironment>;
    lighting: ReturnType<typeof createMedicalLightingRig>;
    postFX: ReturnType<typeof createPostFX>;
    body: BodyModel;
    raycaster: THREE.Raycaster;
    pointer: THREE.Vector2;
  };

  const sceneRef = useRef<SceneRef | undefined>(undefined);
  const requestRef = useRef<number | undefined>(undefined);

  // -----------------------------------------------------------------
  // Initialize the scene once. Cleanup disposes everything.
  // -----------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d12);
    scene.fog = new THREE.Fog(0x0a0d12, 8, 22);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(3.6, 1.6, 5.0);

    const isSmall = window.innerWidth < 640;
    const renderer = new THREE.WebGLRenderer({ antialias: !isSmall });
    // Clamp DPR to 2. setSize() is always given CSS pixels — three.js
    // multiplies by the pixel ratio internally to size the drawing buffer.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.6, 0); // aim at chest height
    controls.minDistance = 2.0;
    controls.maxDistance = 12.0;
    controls.update();

    const env = createProceduralEnvironment(renderer);
    scene.environment = env.texture;

    const lighting = createMedicalLightingRig();
    lighting.configureKeyShadow();
    scene.add(lighting.group);

    const postFX = createPostFX(renderer, scene, camera, {
      bloomIntensity: 0.4,
      bloomThreshold: 0.9,
      ssaoEnabled: false, // SSAO over-occludes the soft body silhouette
      ssaoRadius: 0.4,
      vignetteDarkness: 0.4,
    });

    // Floor — gives the body shadow a surface to land on.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.92 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.05;
    floor.receiveShadow = true;
    scene.add(floor);

    // Body model
    const body = createRegionSegmentedBodyModel({ ringPoints: isSmall ? 28 : 40, ringStep: isSmall ? 3.5 : 2.5 });
    body.group.position.y = 0;
    scene.add(body.group);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      env,
      lighting,
      postFX,
      body,
      raycaster,
      pointer,
    };

    const currentContainer = container;

    // ----- Sizing -----
    //
    // SIZING BUG FIX. `createPostFX` initialises its composer with
    //
    //     composer.setSize(renderer.domElement.width, renderer.domElement.height)
    //
    // but `domElement.width/height` is the DRAWING BUFFER size, i.e.
    // cssWidth × dpr. postprocessing's `EffectComposer.setSize()` expects
    // CSS pixels and derives the buffer size itself via
    // `renderer.getDrawingBufferSize()`. So the DPR gets applied twice:
    // at dpr = 2 with a 518 × 480 container the composer called
    // `renderer.setSize(1036, 960)`, which set the canvas CSS box to
    // 1036 × 960 px (2× the parent, overflowing it) and the buffer to
    // 2072 × 1920 (a further 2×) — ~4M px of canvas driving ~10M px per
    // frame. postFX.ts is shared, so the correction lives here: we call
    // `postFX.resize()` with CSS pixels immediately after construction,
    // which re-runs `composer.setSize()` with the correct units and
    // resets the renderer.
    //
    // Invariant this maintains, asserted in the browser:
    //   canvas CSS box   == container content box
    //   canvas buffer    == CSS box × clamped DPR   (NOT × dpr²)
    // Render on demand: only draw when the camera moved or something changed.
    let dirty = true;
    const invalidate = () => { dirty = true; };
    invalidateRef.current = invalidate;
    controls.addEventListener('change', invalidate);

    const getPixelRatio = () => Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2);

    const applySize = () => {
      // Always measure the container; never the canvas (the canvas is
      // what we're about to resize, so reading it would be circular).
      const w = currentContainer.clientWidth;
      const h = currentContainer.clientHeight;
      // Guard the pre-layout case where the container reports 0.
      if (w === 0 || h === 0) return;
      const dpr = getPixelRatio();
      // postFX.resize() calls renderer.setPixelRatio(dpr) then
      // composer.setSize(w, h) — both in CSS pixels. It subsumes the
      // renderer.setSize() call, so we must NOT also call it ourselves
      // or we reintroduce a double-size.
      postFX.resize(w, h, dpr);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      invalidate();
    };

    // Correct the composer's mis-initialised size before the first frame.
    applySize();

    // The viewer sits in a responsive grid (lg:col-span-3), so the
    // container can change size without the window doing so — a plain
    // window 'resize' listener would miss that. ResizeObserver tracks the
    // element itself.
    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(currentContainer);
    window.addEventListener('resize', applySize);

    // ----- Pointer/click handlers -----
    // Track press/release to distinguish click from drag.
    const onPointerDown = (e: PointerEvent) => {
      pointerDownRef.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const down = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!down) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 5) return; // dragged — ignore
      if (!currentContainer) return;
      const rect = currentContainer.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const py = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(px, py);
      raycaster.setFromCamera(pointer, camera);
      const hit = body.pick(raycaster);
      setSelectedOrgan(hit?.organId ?? null);
      body.setSelectedOrgan(hit?.organId ?? null);
      invalidate();
      onRegionSelectRef.current(hit ? hit.region : null);
    };
    const onPointerMove = (e: PointerEvent) => {
      // Hover detection — only when not dragging.
      if (pointerDownRef.current) return;
      if (!currentContainer) return;
      const rect = currentContainer.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const py = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(px, py);
      raycaster.setFromCamera(pointer, camera);
      const hit = body.pick(raycaster);
      if (!hit) {
        setHoveredRegion(null);
        renderer.domElement.style.cursor = 'default';
        return;
      }
      setHoveredRegion(hit.region);
      renderer.domElement.style.cursor = 'pointer';
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // ----- Animation loop -----
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      if (sceneRef.current) {
        sceneRef.current.controls.update();
        if (dirty) {
          dirty = false;
          sceneRef.current.postFX.composer.render();
        }
      }
    };
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', applySize);
      resizeObserver.disconnect();
      if (currentContainer) {
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        currentContainer.removeChild(renderer.domElement);
      }
      if (requestRef.current !== undefined) {
        cancelAnimationFrame(requestRef.current);
      }
      env.dispose();
      lighting.dispose();
      postFX.dispose();
      body.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      sceneRef.current = undefined;
    };
    // Init effect intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------
  // Prop-driven side effects — keep separate effects, no re-init.
  // -----------------------------------------------------------------

  // Body habitus
  const onRegionSelectRef = useRef(onRegionSelect);
  onRegionSelectRef.current = onRegionSelect;

  useEffect(() => {
    sceneRef.current?.body.group.scale.setScalar(bodyScale);
    invalidateRef.current();
  }, [bodyScale]);

  useEffect(() => {
    const body = sceneRef.current?.body;
    if (!body) return;
    body.setSlice(sliceOn ? sliceZ : null, sliceOn ? sliceCanvasRef.current : undefined);
    invalidateRef.current();
  }, [sliceOn, sliceZ]);

  // selecting a key organ moves the linked slice to it
  useEffect(() => {
    if (!sliceOn || !selectedOrgan) return;
    const o = ORGANS.find((x) => x.id === selectedOrgan);
    if (o) setSliceZ(Math.round(organCenter(o)[2] * 2) / 2);
  }, [selectedOrgan, sliceOn]);

  useEffect(() => {
    sceneRef.current?.body.setSkinOpacity(skinOpacity);
    invalidateRef.current();
  }, [skinOpacity]);

  useEffect(() => {
    sceneRef.current?.body.setOrgansVisible(showOrgans);
    if (!showOrgans) setSelectedOrgan(null);
    invalidateRef.current();
  }, [showOrgans]);

  // Highlight + color tint
  useEffect(() => {
    const body = sceneRef.current?.body;
    if (!body) return;
    body.setHighlightRegion(selectedRegion);
    const colors: Partial<Record<BodyRegionId, THREE.Color>> = {};

    // Colour-map each region by its ABSOLUTE effective dose.
    //
    // The previous implementation normalised by the max dose across
    // regions (`dose / maxDose`). That is scale-invariant: every region's
    // E is CTDIvol × (scanLength × k_region) and CTDIvol is linear in mAs
    // and a pure power of kVp, so the ratio cancels mAs and kVp exactly.
    // 200 mAs @ 80 kVp rendered pixel-identically to 500 mAs @ 140 kVp
    // despite ~10× the dose — telling the student that cranking the dose
    // changes nothing. `doseColorScalar` anchors to a fixed log window
    // (0.01 → 10 mSv) so a given colour always means the same dose.
    // See utils/dose-physics.ts and its regression test.
    const baseSkin = new THREE.Color(0xd49a6c);
    for (const rid of ['head', 'neck', 'cardiothoracic', 'abdomen', 'peripheral'] as BodyRegionId[]) {
      const doseT = doseColorScalar(regionDoseMSv[rid] ?? 0);
      // Cool→warm ramp: blue (low) → cyan → green → yellow → red (high),
      // via hue 0.6 → 0.0. Blended with base skin so the model still
      // reads as a body rather than a pure heatmap. Blend strength also
      // rises with doseT, so high-dose regions read as saturated rather than
      // being washed back toward skin tone.
      const tint = new THREE.Color().setHSL(0.6 - 0.6 * doseT, 0.55, 0.5);
      const blended = new THREE.Color()
        .copy(baseSkin)
        .lerp(tint, 0.35 + 0.45 * doseT);
      // Selection brightens the region on top of its dose colour.
      if (selectedRegion === rid) {
        blended.multiplyScalar(1.35);
      }
      colors[rid] = blended;
    }
    body.setRegionColors(colors);
    invalidateRef.current();
  }, [selectedRegion, regionDoseMSv]);

  const organ = selectedOrgan ? ORGANS.find((o) => o.id === selectedOrgan) : undefined;
  const organTissueText = (id: string) => {
    const tissue = INTERACTIVE_ORGANS[id]?.tissue;
    if (!tissue) return t('body3_limbs_tissues');
    const name = t(`body3_t_${tissue}` as MessageKey);
    if (isRemainder(tissue)) return t('body3_icrp_remainder', { tissue: name, n: REMAINDER_TISSUES.length });
    return t('body3_icrp_wt', { tissue: name, wt: ICRP103_WT_TABLE[tissue].toFixed(2) });
  };

  return (
    <div className={className}>
    <div
      ref={containerRef}
      className="relative w-full bg-[#0a0d12] rounded-lg overflow-hidden"
      style={{ height: 480 }}
      data-testid="body-v3-viewer"
    >
      <div
        className="absolute top-0 left-0 right-0 z-10 px-4 py-2 text-xs font-mono text-[var(--sim-accent)] pointer-events-none bg-gradient-to-b from-black/70 to-transparent"
        style={{ paddingTop: PADDING_TOP_PX / 4 }}
      >
        <div className="text-sm">{t('body_title')}</div>
        <div className="text-[10px] text-text-200 opacity-80 mt-0.5">
          {t('body_controls')}
        </div>
      </div>
      {/* Absolute dose colour legend. Essential now the ramp is anchored
          to fixed mSv values rather than the per-protocol max — without
          it, the colours are unreadable as quantities. */}
      <div className="absolute top-14 right-3 z-10 pointer-events-none">
        <div className="text-[9px] font-mono text-text-200 mb-1 text-right">
          {t('body_legend_title')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-gray-400">
            {DOSE_COLOR_MIN_MSV}
          </span>
          <div
            className="h-2 w-24 rounded-sm border border-white/20"
            style={{
              // Matches the hue 0.6 → 0.0 HSL sweep applied to the meshes.
              backgroundImage:
                'linear-gradient(to right, hsl(216,55%,50%), hsl(180,55%,50%), hsl(108,55%,50%), hsl(43,55%,50%), hsl(0,55%,50%))',
            }}
          />
          <span className="text-[9px] font-mono text-gray-400">
            {DOSE_COLOR_MAX_MSV}
          </span>
        </div>
        <div className="text-[8px] font-mono text-gray-500 mt-0.5 text-right">
          {t('body_legend_scale')}
        </div>
      </div>

      <div className="absolute left-3 top-16 z-10 w-44 space-y-2 rounded-md bg-black/55 p-2 text-[10px] text-text-200">
        <label className="block">
          <span className="flex justify-between">
            <span>{t('body3_skin_opacity')}</span>
            <span className="font-mono">{Math.round(skinOpacity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0.05}
            max={0.9}
            step={0.05}
            value={skinOpacity}
            onChange={(e) => setSkinOpacity(parseFloat(e.target.value))}
            aria-valuetext={t('body3_skin_opacity_aria', { v: Math.round(skinOpacity * 100) })}
            className="w-full accent-[var(--sim-accent)]"
            data-testid="body3-skin-opacity"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showOrgans} onChange={(e) => setShowOrgans(e.target.checked)} data-testid="body3-show-organs" />
          <span>{t('body3_show_organs')}</span>
        </label>
        <p className="text-[9px] leading-snug text-amber-300/90">{t('body3_mock_notice')}</p>
      </div>

      {organ && (
        <div className="absolute bottom-9 left-3 z-10 max-w-[17rem] rounded-md bg-black/75 p-2 text-[11px] text-text-100" data-testid="body3-organ-info" aria-live="polite">
          <div className="font-semibold">{t(`body3_o_${organ.id}` as MessageKey)}</div>
          <div className="text-text-200">
            {t('body3_region', { r: t(`dose_region_${organ.region}` as MessageKey) })}
          </div>
          <div className="text-text-200">{organTissueText(organ.id)}</div>
          <div className="mt-0.5 text-[9px] text-amber-300/90">{t('body3_mock_geometry')}</div>
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 z-10 px-3 py-1 text-[10px] font-mono text-gray-400 pointer-events-none bg-gradient-to-t from-black/60 to-transparent"
        style={{ paddingBottom: PADDING_BOTTOM_PX / 4 }}
      >
        {t('body_footer')}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-black/40 px-3 py-2 text-[11px] text-text-200">
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={sliceOn} onChange={(e) => setSliceOn(e.target.checked)} data-testid="body3-slice-toggle" />
        <span>{t('slice_toggle')}</span>
      </label>
      {sliceOn && (
        <label className="flex min-w-[12rem] flex-1 items-center gap-2">
          <span>{t('slice_z_label')}</span>
          <input
            type="range" min={0} max={175} step={0.5} value={sliceZ}
            onChange={(e) => setSliceZ(parseFloat(e.target.value))}
            className="flex-1 accent-[var(--sim-accent)]"
            aria-valuetext={`${sliceZ.toFixed(1)} cm`}
            data-testid="body3-slice-z"
          />
          <span className="font-mono">{sliceZ.toFixed(1)} cm</span>
        </label>
      )}
    </div>
    {sliceOn && (
      <div className="p-2">
        <CtSlicePanel zCm={sliceZ} selectedOrganId={selectedOrgan} onPlaneCanvas={onPlaneCanvas} onRendered={onSliceRendered} />
      </div>
    )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helper hook: takes the user's protocol inputs (mAs, kVp, pitch, scan
// length, body habitus via Dw) and returns the per-region dose breakdown.
// Memoised in the parent; this hook just computes synchronously.
//
// We compute the dose for ALL regions up-front so the colour-map on the
// body shows the full dose distribution. The selected region drives the
// detail panel.
// ---------------------------------------------------------------------------

export interface BodyModelViewerDoseInputs {
  mAs: number;
  kVp: number;
  pitch: number;
  /** Patient water-equivalent diameter Dw in cm */
  waterEquivalentDiameterCm: number;
  /** Scan length per region (cm). If null we use each region's representative length. */
  scanLengthByRegion: Partial<Record<BodyRegionId, number>>;
}

export function computeAllRegionDoses(input: BodyModelViewerDoseInputs): {
  perRegionDose: Record<BodyRegionId, number>;
  perRegionBreakdown: Record<BodyRegionId, ReturnType<typeof computeDoseForRegion>>;
} {
  const regionIds: BodyRegionId[] = [
    'head',
    'neck',
    'cardiothoracic',
    'abdomen',
    'peripheral',
  ];
  const perRegionDose = {} as Record<BodyRegionId, number>;
  const perRegionBreakdown = {} as Record<BodyRegionId, ReturnType<typeof computeDoseForRegion>>;
  for (const region of regionIds) {
    const scanLength =
      input.scanLengthByRegion[region] ?? BODY_REGIONS[region].representativeScanLengthCm;
    const breakdown = computeDoseForRegion({
      mAs: input.mAs,
      kVp: input.kVp,
      pitch: input.pitch,
      scanLengthCm: scanLength,
      waterEquivalentDiameterCm: input.waterEquivalentDiameterCm,
      region,
    });
    perRegionBreakdown[region] = breakdown;
    perRegionDose[region] = breakdown.effectiveDoseMSv;
  }
  return { perRegionDose, perRegionBreakdown };
}
