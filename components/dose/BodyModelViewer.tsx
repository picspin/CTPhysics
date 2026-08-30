'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createProceduralEnvironment } from '@/utils/three/proceduralEnvironment';
import { createMedicalLightingRig } from '@/utils/three/sceneLighting';
import { createPostFX } from '@/utils/three/postFX';
import {
  createRegionSegmentedBodyModel,
  BodyModel,
  BodyRegionMesh,
} from '@/utils/three/bodyModel';
import {
  BodyRegionId,
  ICRP103_ORGANS,
  ICRP103_ORGAN_NAMES,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const [, setHoveredRegion] = useState<BodyRegionId | null>(null);

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

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    // Clamp DPR to 2. setSize() is always given CSS pixels — three.js
    // multiplies by the pixel ratio internally to size the drawing buffer.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    const body = createRegionSegmentedBodyModel({ tier: 'standard' });
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
    const getPixelRatio = () => Math.min(window.devicePixelRatio, 2);

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
      const meshes = Object.values(body.regions);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length === 0) {
        onRegionSelect(null);
        return;
      }
      const regionId = (hits[0].object as BodyRegionMesh).userData.regionId;
      onRegionSelect(regionId);
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
      const hits = raycaster.intersectObjects(Object.values(body.regions), false);
      if (hits.length === 0) {
        setHoveredRegion(null);
        renderer.domElement.style.cursor = 'default';
        return;
      }
      const regionId = (hits[0].object as BodyRegionMesh).userData.regionId;
      setHoveredRegion(regionId);
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
        sceneRef.current.postFX.composer.render();
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
  useEffect(() => {
    sceneRef.current?.body.setBodyScale(bodyScale);
  }, [bodyScale]);

  // Highlight + color tint
  useEffect(() => {
    const body = sceneRef.current?.body;
    if (!body) return;
    body.highlightRegion(selectedRegion);

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
    for (const [rid, mesh] of Object.entries(body.regions)) {
      const t = doseColorScalar(regionDoseMSv[rid as BodyRegionId] ?? 0);
      // Cool→warm ramp: blue (low) → cyan → green → yellow → red (high),
      // via hue 0.6 → 0.0. Blended with base skin so the model still
      // reads as a body rather than a pure heatmap. Blend strength also
      // rises with t, so high-dose regions read as saturated rather than
      // being washed back toward skin tone.
      const tint = new THREE.Color().setHSL(0.6 - 0.6 * t, 0.55, 0.5);
      const blended = new THREE.Color()
        .copy(baseSkin)
        .lerp(tint, 0.35 + 0.45 * t);
      // Selection brightens the region on top of its dose colour.
      if (selectedRegion === rid) {
        blended.multiplyScalar(1.35);
      }
      (mesh.material as THREE.MeshPhysicalMaterial).color.copy(blended);
    }
  }, [selectedRegion, regionDoseMSv]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-[#0a0d12] rounded-lg overflow-hidden ${
        className ?? ''
      }`}
      style={{ height: 480 }}
    >
      <div
        className="absolute top-0 left-0 right-0 z-10 px-4 py-2 text-xs font-mono text-[var(--sim-accent)] pointer-events-none bg-gradient-to-b from-black/70 to-transparent"
        style={{ paddingTop: PADDING_TOP_PX / 4 }}
      >
        <div className="text-sm">交互式人体模型 · Interactive 3D Body</div>
        <div className="text-[10px] text-text-200 opacity-80 mt-0.5">
          拖拽旋转 · 滚轮缩放 · 点击区域查看剂量
        </div>
      </div>
      {/* Absolute dose colour legend. Essential now the ramp is anchored
          to fixed mSv values rather than the per-protocol max — without
          it, the colours are unreadable as quantities. */}
      <div className="absolute top-14 right-3 z-10 pointer-events-none">
        <div className="text-[9px] font-mono text-text-200 mb-1 text-right">
          Effective dose (mSv)
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
          log scale · absolute
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-10 px-3 py-1 text-[10px] font-mono text-gray-400 pointer-events-none bg-gradient-to-t from-black/60 to-transparent"
        style={{ paddingBottom: PADDING_BOTTOM_PX / 4 }}
      >
        Drag to orbit · Scroll to zoom · Click a region to inspect its dose
      </div>
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

// ---------------------------------------------------------------------------
// ICRP 103 organ contribution share for the selected region.
// Returns a sorted list of (organ, w_T) pairs so the UI can show
// "this region's effective dose is dominated by...".
// ---------------------------------------------------------------------------

export function describeRegionOrgans(regionId: BodyRegionId): Array<{
  organ: keyof typeof ICRP103_ORGANS;
  wT: number;
  name: string;
  sharePercent: number;
}> {
  const region = BODY_REGIONS[regionId];
  const total = region.dominantOrgans.reduce((acc, o) => acc + ICRP103_ORGANS[o], 0);
  return region.dominantOrgans
    .map((organ) => ({
      organ,
      wT: ICRP103_ORGANS[organ],
      name: ICRP103_ORGAN_NAMES[organ],
      sharePercent: total > 0 ? (ICRP103_ORGANS[organ] / total) * 100 : 0,
    }))
    .sort((a, b) => b.wT - a.wT);
}
