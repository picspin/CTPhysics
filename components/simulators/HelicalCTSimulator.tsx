'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { createProceduralEnvironment } from '@/utils/three/proceduralEnvironment';
import { createMedicalLightingRig } from '@/utils/three/sceneLighting';
import { createScannerMaterials } from '@/utils/three/scannerMaterials';
import { createParametricPhantomMesh, disposeParametricPhantom } from '@/utils/three/parametricPhantom';
import { createAttenuationOverlay } from './_fx/AttenuationOverlay';
import { createPostFX } from '@/utils/three/postFX';
import { createXRayBeam } from '@/utils/three/xrayBeam';
import { createLabelSprite, type LabelSprite } from '@/utils/three/labelTexture';
import { useLanguage, type MessageKey } from '@/context/LanguageContext';

// Log entries store a message key (+ kernel key) rather than rendered text,
// so the log re-renders in the current language after a toggle.
type LogEntry = { key: MessageKey; kernelKey?: MessageKey };

const KERNEL_KEY = {
  soft: 'hel_kernel_soft',
  bone: 'hel_kernel_bone',
  lung: 'hel_kernel_lung',
} as const satisfies Record<string, MessageKey>;

const HelicalCTSimulator: React.FC = () => {
  const { t } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;
  // --- State ---
  const [params, setParams] = useState({
    speed: 1.0,
    pitch: 1.0,
    kv: 120,
    ma: 200,
    kernel: 'soft',
    dualEnergy: false,
    scanning: false,
  });

  const [dose, setDose] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([{ key: 'hel_log_boot' }]);

  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    gantryGroup: THREE.Group;
    tableGroup: THREE.Group;
    helixLine: THREE.Line;
    laser: THREE.Mesh;
    controls: OrbitControls;
    env: ReturnType<typeof createProceduralEnvironment>;
    lighting: ReturnType<typeof createMedicalLightingRig>;
    materials: ReturnType<typeof createScannerMaterials>;
    phantom: THREE.Group;
    attenuation: ReturnType<typeof createAttenuationOverlay>;
    attenuationLabel: LabelSprite;
    postFX: ReturnType<typeof createPostFX>;
    xrayBeam: ReturnType<typeof createXRayBeam>;
  }>();

  // --- Helper: Log ---
  const addLog = (entry: LogEntry) => {
    setLogs((prev) => [...prev.slice(-4), entry]);
  };

  // --- 3D Initialization ---
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d12);
    scene.fog = new THREE.Fog(0x0a0d12, 8, 22);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    // Pulled back and raised so the full gantry + table + phantom fit
    // inside the viewport (previous (5, 3, 6) cropped the patient to the
    // bottom edge). Target is set below after OrbitControls is created.
    camera.position.set(6, 4.5, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    // PBR-correct tone mapping (lifted from anatomy viewer).
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Scene centroid: the bore sits at (0,0,0) but the table extends along
    // +Z to ~+6. Aim the orbit pivot at the table mid-point so dragging
    // keeps both the gantry and the patient in frame.
    controls.target.set(0, 0.5, 3);
    controls.update();

    // PostFX chain (Phase 2): Bloom + SSAO + SMAA + Vignette. Created
    // before sceneRef assignment so it's available on first render.
    const postFX = createPostFX(renderer, scene, camera, {
      bloomIntensity: 0.6,
      bloomThreshold: 0.85,
      ssaoEnabled: true,
      ssaoRadius: 0.5,
      vignetteDarkness: 0.45,
    });

    // PBR materials (shared across meshes in the scene).
    const materials = createScannerMaterials();

    // Procedural environment for IBL — needed by metalness / clearcoat /
    // transmission / sheen channels to render correctly.
    const env = createProceduralEnvironment(renderer);
    scene.environment = env.texture;

    // Three-point + hemisphere lighting rig.
    const lighting = createMedicalLightingRig();
    lighting.configureKeyShadow();
    scene.add(lighting.group);

    // Models
    // 1. Gantry Housing — polished chrome (PBR). The ring is the outer
    // torus; the inside surface (bore) is also chrome but with higher
    // roughness so it doesn't read as a mirror.
    const coverGeo = new THREE.TorusGeometry(3.2, 1.2, 32, 64);
    const housing = new THREE.Mesh(coverGeo, materials.gantryChrome);
    housing.castShadow = true;
    housing.receiveShadow = true;
    scene.add(housing);

    // Inner bore ring (slightly smaller torus inside the housing) —
    // brushed-steel feel.
    const boreGeo = new THREE.TorusGeometry(2.4, 0.85, 24, 48);
    const bore = new THREE.Mesh(boreGeo, materials.gantryBore);
    bore.castShadow = true;
    bore.receiveShadow = true;
    scene.add(bore);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floor = new THREE.Mesh(floorGeo, materials.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    floor.receiveShadow = true;
    scene.add(floor);

    // 2. Rotating Gantry (inner ring + tube + detector assembly).
    const gantryGroup = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(2.5, 0.2, 24, 100);
    const ring = new THREE.Mesh(ringGeo, materials.gantryBore);
    ring.castShadow = true;
    gantryGroup.add(ring);

    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 0.6),
      materials.tubeHousing,
    );
    tube.castShadow = true;
    tube.position.y = 2.0;
    gantryGroup.add(tube);

    // X-ray tube window (glass + slight warm emissive) attached to tube
    // housing face. Small disc, oriented to point inward toward bore.
    const tubeGlass = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 32),
      materials.tubeGlass,
    );
    tubeGlass.position.set(0, 0, 0.31);
    tube.add(tubeGlass);

    const det = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.3, 0.8),
      materials.detectorHousing,
    );
    det.castShadow = true;
    det.position.y = -2.0;
    gantryGroup.add(det);

    // Detector scintillator face — matte dark panel on the inside of the
    // detector housing. Reads as a flat dark plate facing the bore.
    const detPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.7),
      materials.detectorPanel,
    );
    detPanel.position.set(0, 0, 0.41);
    det.add(detPanel);

    scene.add(gantryGroup);

    // 3. Table & Phantom
    const tableGroup = new THREE.Group();
    const bedGeo = new THREE.BoxGeometry(1.2, 0.1, 8);
    const bed = new THREE.Mesh(bedGeo, materials.tableVinyl);
    bed.castShadow = true;
    bed.receiveShadow = true;
    tableGroup.add(bed);

    // Table chassis (the structural rail beneath the vinyl).
    const chassisGeo = new THREE.BoxGeometry(0.8, 0.18, 7.6);
    const chassis = new THREE.Mesh(chassisGeo, materials.tableChassis);
    chassis.position.y = -0.14;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    tableGroup.add(chassis);

    // Phantom: shared v3.1 body (lofted skin surface + MOCK procedural organs),
    // see utils/three/body/.
    const phantom = createParametricPhantomMesh({
      tier: 'standard',
      material: materials.skinPhantom,
    });
    // Position so the torso center sits on the bed top (y = 0).
    phantom.position.y = 0.05;
    phantom.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        // Semi-transparent skin must not cast a solid shadow; organs and other meshes still do.
        m.castShadow = m.userData.organId !== 'skin';
        m.receiveShadow = true;
      }
    });
    tableGroup.add(phantom);

    tableGroup.position.y = -0.5;
    tableGroup.position.z = 4;
    scene.add(tableGroup);

    // Attenuation overlay — exploded-view slice plane that visualizes the
    // HU field at the current kV. Moved OUTSIDE the gantry to the front-
    // right of the bore (positive Z toward camera, positive X to the right)
    // so it stays clearly visible from the default orbit camera angle
    // (5, 3, 6) instead of being hidden behind the bore / detector.
    //
    // The plane is horizontal (rotation.x = -PI/2) so it reads as a
    // floating diagnostic slice, with a thin leader line back to the
    // phantom's chest.
    const initialKv = params.kv;
    const attenuation = createAttenuationOverlay(initialKv, {
      width: 1.4,
      depth: 1.4,
    });
    // Position is in WORLD space. We place the slice in front of and
    // slightly above the gantry bore so it sits in the viewport's
    // foreground without intersecting the bore, the bed, or the phantom.
    // The plane is horizontal (rotation.x = -PI/2) so it reads as a
    // floating diagnostic slice.
    attenuation.mesh.position.set(2.5, 1.4, 4.5);
    attenuation.mesh.rotation.set(-Math.PI / 2, 0, 0);

    // Leader line: from slice center to chest center. Chest in world
    // space: tableGroup.z=4 + phantom.rotation.x=PI/2 mapping local y→z,
    // plus phantom.position.y=0.05 and tableGroup y=-0.5 → chest ≈
    // (0,-0.45,5). We connect slice to chest with a 2-point line that
    // stays in front of the bore in the foreground.
    const leaderPoints: THREE.Vector3[] = [
      new THREE.Vector3(2.5, 1.4, 4.5),     // slice center
      new THREE.Vector3(0, -0.45, 5.0),     // chest center
    ];
    const leaderGeo = new THREE.BufferGeometry().setFromPoints(leaderPoints);
    const leaderMat = new THREE.LineBasicMaterial({
      color: 0xffaa66,
      transparent: true,
      opacity: 0.6,
    });
    const leaderLine = new THREE.Line(leaderGeo, leaderMat);
    leaderLine.name = 'AttenuationLeader';

    // Sprite label — uses CanvasTexture (no new deps) to draw a small
    // "Slice @ kV=120" tag floating above the slice plane.
    const labelHandle = createLabelSprite(tRef.current('hel_slice_label', { kv: initialKv }), {
      color: '#ffaa66',
      width: 256,
      height: 64,
      fontPx: 28,
      minFontPx: 12,
      borderPx: 2,
      worldWidth: 1.4,
    });
    const label = labelHandle.sprite;
    label.position.set(2.5, 2.2, 4.5);

    // Mount overlay + leader + label to the scene directly (NOT tableGroup)
    // so the slice stays put during scanning — it's a UI/exploded view.
    scene.add(attenuation.mesh);
    scene.add(leaderLine);
    scene.add(label);

    // 4. Helix Visualization
    // Create a spiral line
    const helixPoints = [];
    const helixRadius = 2.5;
    const helixTurns = 10;
    for (let i = 0; i <= helixTurns * 36; i++) {
      const angle = (i * 10 * Math.PI) / 180;
      helixPoints.push(new THREE.Vector3(
        Math.cos(angle) * helixRadius,
        Math.sin(angle) * helixRadius,
        -5 // Start z
      ));
    }
    const helixGeo = new THREE.BufferGeometry().setFromPoints(helixPoints);
    const helixMat = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 });
    const helixLine = new THREE.Line(helixGeo, helixMat);
    scene.add(helixLine);


    // Laser — Phase 2: replaced the red PlaneGeometry sheet with a true
    // cone beam (ConeGeometry + custom ShaderMaterial, additive). Origin
    // is the world position of the tube housing window; target is the
    // detector face. Both positions live inside gantryGroup which rotates
    // each frame, so we capture references and re-align in the animate
    // loop (see lookAtWorld below).
    //
    // We use the tube's LOCAL position (0, 2, 0) inside gantryGroup; we
    // sample world positions with `.getWorldPosition()` per frame so the
    // beam rotates with the gantry.
    const tubeLocalPos = tube.position.clone();
    const detLocalPos = det.position.clone();

    // Initial world positions (gantryGroup hasn't rotated yet).
    const initialTubeWorld = tubeLocalPos.clone();
    const initialDetWorld = detLocalPos.clone();

    const xrayBeam = createXRayBeam(initialTubeWorld, initialDetWorld);
    xrayBeam.setEnabled(false);
    scene.add(xrayBeam.mesh);

    // Keep a stable alias so downstream code (param effect) can still
    // toggle visibility through a familiar name.
    const laser = xrayBeam.mesh;

    sceneRef.current = {
      scene,
      camera,
      renderer,
      gantryGroup,
      tableGroup,
      helixLine,
      laser,
      controls,
      env,
      lighting,
      materials,
      phantom,
      attenuation,
      attenuationLabel: labelHandle,
      postFX,
      xrayBeam,
    };

    const currentContainer = containerRef.current;

    // Resize handler — pipes resize events through to both the WebGL
    // renderer and the postFX composer. Listens to BOTH window resize
    // and parent re-layout (e.g. sidebar toggle, font-load reflow) via
    // ResizeObserver; window-only would miss late layout shifts.
    //
    // NOTE: we run the FIRST applySize inside requestAnimationFrame so
    // that the parent has finished its flex/grid layout pass. Reading
    // clientWidth synchronously here can return pre-layout values (e.g.
    // 1002 px before the flex column settles to 501 px), which would
    // persist as a stale inline canvas style and overflow the parent.
    const applySize = () => {
      if (!currentContainer) return;
      // Re-resolve the container on every tick — React StrictMode may
      // re-mount the parent div while the effect closure still holds a
      // stale reference, which would prevent the observer from firing.
      const live = containerRef.current ?? currentContainer;
      const w = live.clientWidth;
      const h = live.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(dpr);
      // updateStyle = true (default) so the canvas inline style is
      // always refreshed. Without this, a 1002 px initial measurement
      // persists as `style="width:1002px"` even after the parent flex
      // column settles to 501 px and overflows the canvas.
      renderer.setSize(w, h);
      postFX.resize(w, h, dpr);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    applySize();
    requestAnimationFrame(() => applySize());
    const ro = new ResizeObserver(applySize);
    ro.observe(currentContainer);
    window.addEventListener('resize', applySize);
    // Safety-net poll for the first 3 s — ResizeObserver doesn't always
    // fire when a flex/grid parent resizes due to sibling reflow rather
    // than its own intrinsic size change. Re-applying size cheaply on a
    // short interval catches the stale 1002 px → 501 px case until
    // layout has truly settled.
    let polls = 0;
    const pollId = window.setInterval(() => {
      applySize();
      if (++polls >= 12) window.clearInterval(pollId);
    }, 250);

    // Cleanup
    return () => {
      window.clearInterval(pollId);
      ro.disconnect();
      window.removeEventListener('resize', applySize);
      env.dispose();
      lighting.dispose();
      attenuation.dispose();
      disposeParametricPhantom(phantom);
      // Dispose exploded-view leader line + label (CanvasTexture/Sprite).
      leaderGeo.dispose();
      leaderMat.dispose();
      labelHandle.dispose();
      // Phase 2: dispose postFX chain + X-ray beam.
      xrayBeam.dispose();
      postFX.dispose();
      // Dispose shared materials.
      for (const m of Object.values(materials)) {
        m.dispose();
      }
      if (currentContainer) {
        currentContainer.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
    // params.kv is read once for the initial attenuation bake; later
    // changes are handled by the param-change effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Update Helix based on Pitch ---
  useEffect(() => {
    if (sceneRef.current) {
      const { helixLine } = sceneRef.current;
      const points = [];
      const helixRadius = 2.0; // Slightly smaller than gantry
      const turns = 10;
      // length was unused

      // Pitch definition: Table movement per rotation / Beam Width.
      // Here we visualize the path relative to the table/patient Z-axis
      // Higher pitch = more spread out.
      const spread = params.pitch * 0.5; // Visual scale factor

      for (let i = 0; i <= turns * 60; i++) {
        const t = i / 60; // rotations
        const angle = t * Math.PI * 2;
        const z = (t * spread) - (turns * spread) / 2; // Center it

        points.push(new THREE.Vector3(
          Math.cos(angle) * helixRadius,
          Math.sin(angle) * helixRadius,
          z
        ));
      }
      helixLine.geometry.setFromPoints(points);
      (helixLine.material as THREE.LineBasicMaterial).color.setHex(params.pitch > 1.2 ? 0xff0000 : 0x00ff00); // Red if high pitch (gaps)
    }
  }, [params.pitch]);


  // --- 2D Drawing Logic ---
  const drawPhantom = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 200;

    // Clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Helper
    const ellipse = (x: number, y: number, rw: number, rh: number, ang: number, col: string) => {
      ctx.beginPath();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang * Math.PI / 180);
      ctx.scale(rw, rh);
      ctx.arc(0, 0, 1, 0, 2 * Math.PI);
      ctx.restore();
      ctx.fillStyle = col;
      ctx.fill();
    };

    // Bone
    const boneColor = params.dualEnergy ? "#88ccff" : "#cccccc";
    ellipse(cx, cy, 0.9 * scale, 0.92 * scale, 0, boneColor);

    // Brain
    ellipse(cx, cy, 0.85 * scale, 0.87 * scale, 0, "#222");

    // Ventricles
    ellipse(cx - 0.2 * scale, cy, 0.15 * scale, 0.25 * scale, -15, "#444");
    ellipse(cx + 0.2 * scale, cy, 0.15 * scale, 0.25 * scale, 15, "#444");

    // Noise
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const signalStrength = (params.ma * Math.pow(params.kv, 2)) / 1000000;
    const noiseFactor = Math.max(0, 60 - signalStrength * 2);

    for (let i = 0; i < data.length; i += 4) {
      const val = data[i];
      if (val > 10) {
        const noise = (Math.random() - 0.5) * noiseFactor;
        data[i] = val + noise;
        data[i + 1] = val + noise;
        data[i + 2] = val + noise;

        if (params.dualEnergy && val > 150) {
          data[i + 2] += 50; // Blue boost
        }
      } else {
        const airNoise = (Math.random()) * (noiseFactor * 0.2);
        data[i] = airNoise;
        data[i + 1] = airNoise;
        data[i + 2] = airNoise;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Filters
    const filters = [];
    if (params.kernel === 'soft') filters.push('blur(1px)');
    if (params.kernel === 'bone') filters.push('contrast(1.3)');
    if (params.kernel === 'lung') filters.push('contrast(2.0) brightness(0.8)');
    if (params.scanning && params.pitch > 1.5) filters.push('blur(2px)');

    ctx.filter = filters.join(' ');
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }, [params]);

  // --- Animation Loop ---
  useEffect(() => {
    // Track elapsed time so the beam's shader uTime uniform can pulse.
    let elapsed = 0;
    const start = performance.now();
    const tmpTube = new THREE.Vector3();
    const tmpDet = new THREE.Vector3();
    const localTube = new THREE.Vector3(0, 2, 0);
    const localDet = new THREE.Vector3(0, -2, 0);

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      elapsed = (performance.now() - start) / 1000;

      if (sceneRef.current) {
        const {
          gantryGroup,
          tableGroup,
          controls,
          postFX,
          xrayBeam,
        } = sceneRef.current;
        controls.update();

        if (params.scanning) {
          // Rotate Gantry
          const rotSpeed = (Math.PI * 2) / (params.speed * 60);
          gantryGroup.rotation.z -= rotSpeed;

          // Move Table
          const moveSpeed = (params.pitch * 0.1) * (rotSpeed / (Math.PI * 2));
          tableGroup.position.z -= moveSpeed;
          if (tableGroup.position.z < -4) {
            tableGroup.position.z = 4;
          }
        }

        // Phase 2: re-aim the XR cone beam each frame so it tracks the
        // rotating gantry. Tube + detector both live at fixed LOCAL
        // positions inside gantryGroup — we transform those locals
        // through gantryGroup.matrixWorld to get the current world
        // endpoints.
        gantryGroup.updateMatrixWorld();
        tmpTube.copy(localTube).applyMatrix4(gantryGroup.matrixWorld);
        tmpDet.copy(localDet).applyMatrix4(gantryGroup.matrixWorld);
        xrayBeam.lookAt(tmpTube, tmpDet);
        xrayBeam.update(elapsed);

        // Phase 2: render through the postFX composer.
        postFX.composer.render();
      }

      // Draw 2D continuously if scanning or just once if static (handled by effect below)
      if (params.scanning) {
        drawPhantom();
      }
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [params.scanning, params.speed, params.pitch, drawPhantom]); // Re-bind when scanning params change

  // Trigger draw on param change
  useEffect(() => {
    drawPhantom();
    // Update Dose
    const newDose = (params.ma * Math.pow(params.kv / 100, 2) / params.pitch);
    setDose(parseFloat(newDose.toFixed(1)));

    if (sceneRef.current) {
      // Phase 2: laser alias points at the XR cone beam mesh now.
      sceneRef.current.laser.visible = params.scanning;
      sceneRef.current.xrayBeam.setEnabled(params.scanning);
      sceneRef.current.xrayBeam.setEnergy(params.kv);
      // Re-bake the attenuation overlay when kV changes — the slice plane
      // shows the same anatomy but its coloring shifts as energy changes.
      sceneRef.current.attenuation.updateAttenuationTexture(params.kv);
      // Re-render the floating "Slice @ kV" label so it tracks the slider.
      sceneRef.current.attenuationLabel.setText(t('hel_slice_label', { kv: params.kv }));
    }
    // `t` changes with the language, re-baking the label text on toggle.
  }, [params, drawPhantom, t]);

  const toggleScan = () => {
    setParams(p => ({ ...p, scanning: !p.scanning }));
    addLog({ key: params.scanning ? 'hel_log_scan_stop' : 'hel_log_scan_start' });
  };

  const toggleDualEnergy = () => {
    setParams(p => ({ ...p, dualEnergy: !p.dualEnergy }));
  };

  return (
    <div className="flex flex-col h-[600px] bg-[var(--sim-bg)] text-[var(--sim-text)] font-sans overflow-hidden rounded-lg shadow-2xl">
      {/* Main Display */}
      <div className="flex flex-1 min-h-0 border-b-4 border-black">
        {/* 3D View */}
        <div ref={containerRef} className="flex-1 relative bg-[#111] border-r-2 border-[#333]">
          <div className="absolute top-4 left-4 font-mono text-sm text-[var(--sim-accent)] z-10 pointer-events-none">
            {t('hel_view_gantry')}<br />
            {t('hel_status')} <span className={params.scanning ? "text-red-500" : ""}>{params.scanning ? t('hel_status_exposure') : t('hel_status_standby')}</span>
          </div>
        </div>

        {/* Image View */}
        <div className="flex-1 bg-black flex flex-col items-center justify-center relative">
          <div className="absolute top-4 left-4 font-mono text-sm text-[var(--sim-accent)] pointer-events-none">
            {t('hel_view_recon')}
          </div>
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            className="bg-black shadow-[0_0_20px_rgba(255,255,255,0.1)] max-w-[90%] max-h-[80%] aspect-square"
          />
          <div className="mt-2 font-mono text-xs text-gray-500">
            {t('hel_dose', { dose })}
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="h-[250px] bg-bg-200 grid grid-cols-4 gap-4 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.5)] z-20">

        {/* Motion Control */}
        <Card title={t('hel_card_motion')} className="bg-transparent border-[#444] !p-0">
          <div className="p-3 flex flex-col gap-4">
            <Slider
              label={t('hel_rot_time')}
              valueDisplay={params.speed}
              min={0.2} max={2.0} step={0.1}
              value={params.speed}
              onChange={(e) => setParams({ ...params, speed: parseFloat(e.target.value) })}
            />
            <Slider
              label={t('hel_pitch')}
              valueDisplay={params.pitch}
              min={0.1} max={2.0} step={0.1}
              value={params.pitch}
              onChange={(e) => setParams({ ...params, pitch: parseFloat(e.target.value) })}
            />
            <Button
              variant={params.scanning ? "danger" : "primary"}
              className="mt-auto w-full"
              onClick={toggleScan}
            >
              {params.scanning ? t('hel_btn_stop') : t('hel_btn_start')}
            </Button>
          </div>
        </Card>

        {/* Exposure */}
        <Card title={t('hel_card_exposure')} className="bg-transparent border-[#444] !p-0">
          <div className="p-3 flex flex-col gap-4">
            <Slider
              label={t('hel_tube_voltage')}
              valueDisplay={params.kv}
              min={80} max={140} step={10}
              value={params.kv}
              onChange={(e) => setParams({ ...params, kv: parseInt(e.target.value) })}
            />
            <Slider
              label={t('hel_tube_current')}
              valueDisplay={params.ma}
              min={50} max={800} step={50}
              value={params.ma}
              onChange={(e) => setParams({ ...params, ma: parseInt(e.target.value) })}
            />
          </div>
        </Card>

        {/* Reconstruction */}
        <Card title={t('hel_card_recon')} className="bg-transparent border-[#444] !p-0">
          <div className="p-3 flex flex-col gap-4">
            <Select
              label={t('hel_kernel')}
              options={[
                { value: 'soft', label: t('hel_kernel_soft') },
                { value: 'bone', label: t('hel_kernel_bone') },
                { value: 'lung', label: t('hel_kernel_lung') },
              ]}
              value={params.kernel}
              onChange={(e) => {
                setParams({ ...params, kernel: e.target.value });
                addLog({ key: 'hel_log_kernel', kernelKey: KERNEL_KEY[e.target.value as keyof typeof KERNEL_KEY] });
              }}
            />
            <Button
              variant={params.dualEnergy ? "primary" : "secondary"}
              className="mt-auto w-full"
              onClick={toggleDualEnergy}
            >
              {params.dualEnergy ? t('hel_de_on') : t('hel_de_off')}
            </Button>
          </div>
        </Card>

        {/* System Log */}
        <Card title={t('hel_card_log')} className="bg-transparent border-[#444] !p-0">
          <div className="p-3 h-full overflow-y-auto font-mono text-[10px] text-green-500">
            {logs.map((log, i) => (
              <div key={i}>{"> "}{log.kernelKey ? t(log.key, { kernel: t(log.kernelKey) }) : t(log.key)}</div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default HelicalCTSimulator;