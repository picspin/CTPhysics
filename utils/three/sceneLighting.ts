import * as THREE from 'three';

/**
 * Three-point + hemisphere lighting rig for medical-grade scenes.
 *
 * Pattern lifted from anatomy viewer's AnatomyViewer (warm key + cool fill +
 * peach rim + hemisphere + accent point). Tuned for CT scanner housings
 * (cool/warm contrast reads as clinical).
 *
 * Usage:
 *   const rig = createMedicalLightingRig();
 *   scene.add(rig.group);
 *   // (rig.keyLight casts shadow — enable on renderer + meshes)
 */

export interface MedicalLightingRig {
  group: THREE.Group;
  ambient: THREE.AmbientLight;
  hemisphere: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  configureKeyShadow: () => void;
  dispose: () => void;
}

export function createMedicalLightingRig(): MedicalLightingRig {
  const group = new THREE.Group();
  group.name = 'MedicalLightingRig';

  const ambient = new THREE.AmbientLight(0xffffff, 0.42);
  ambient.name = 'ambient';
  group.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xffd9b3, 0x1a1f2a, 0.55);
  hemisphere.name = 'hemisphere';
  hemisphere.position.set(0, 1, 0);
  group.add(hemisphere);

  // Key — warm, top-front-right. The only shadow caster.
  const keyLight = new THREE.DirectionalLight(0xfff2dd, 2.8);
  keyLight.name = 'key';
  keyLight.position.set(6, 8, 4);
  group.add(keyLight);

  // Fill — cool, opposite. Softens the unlit side without shadowing cost.
  const fillLight = new THREE.DirectionalLight(0xa6c8ff, 0.9);
  fillLight.name = 'fill';
  fillLight.position.set(-5, 3, -3);
  group.add(fillLight);

  // Rim — peach, back. Silhouette separation against the background.
  const rimLight = new THREE.DirectionalLight(0xffb78f, 1.4);
  rimLight.name = 'rim';
  rimLight.position.set(0, 4, -6);
  group.add(rimLight);

  function configureKeyShadow(): void {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.radius = 8;
    keyLight.shadow.blurSamples = 16;
    keyLight.shadow.bias = -0.0005;
    const cam = keyLight.shadow.camera;
    cam.left = -8;
    cam.right = 8;
    cam.top = 8;
    cam.bottom = -8;
    cam.near = 0.5;
    cam.far = 30;
    cam.updateProjectionMatrix();
  }

  function dispose(): void {
    group.parent?.remove(group);
    // Lights don't hold disposable resources beyond being removed from the scene.
  }

  return {
    group,
    ambient,
    hemisphere,
    keyLight,
    fillLight,
    rimLight,
    configureKeyShadow,
    dispose,
  };
}
