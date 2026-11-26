import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ActorType,
  ANIMAL_META,
  AnimalKind,
  CHARACTER_META,
  CharacterKind,
  CustomModelBlueprint,
  PROP_META,
  PropKind,
  VEHICLE_META,
  VehicleKind,
} from '../types/studio';
import {
  CharacterRig,
  createCharacterRig,
  disposeCharacterRig,
  updateCharacterAnimation,
} from './characters';
import {
  AnimalRig,
  createAnimalRig,
  disposeAnimalRig,
  updateAnimalAnimation,
} from './animals';
import {
  createCustomModelRig,
  createPropRig,
  createVehicleRig,
  disposePropOrCustomRig,
  PropOrCustomRig,
  updatePropOrCustomAnimation,
} from './props';

export interface ThumbnailSpec {
  key: string;
  actorType: ActorType;
  kind: string;
  customBlueprint?: CustomModelBlueprint;
}

export function getThumbnailKey(
  actorType: ActorType,
  kind: string,
  customId?: string
): string {
  if (actorType === 'custom') {
    return `custom:${customId || kind}`;
  }
  return `${actorType}:${kind}`;
}

const THUMB_SIZE = 160;
const thumbnailCache = new Map<string, string>();
const pendingQueue: ThumbnailSpec[] = [];
const queuedKeys = new Set<string>();
const listeners = new Set<(key: string, dataUrl: string) => void>();

let rafScheduled = false;
let webglDisabled = false;

interface OffscreenCtx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pmrem: THREE.PMREMGenerator;
  envRT: THREE.WebGLRenderTarget;
}

let sharedCtx: OffscreenCtx | null = null;

function getSharedContext(): OffscreenCtx | null {
  if (webglDisabled) return null;
  if (sharedCtx) return sharedCtx;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'default',
    });
    renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.35;

    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x334155, 0.85);
    const key = new THREE.DirectionalLight(0xfff4d6, 2.2);
    key.position.set(4.5, 7.5, 5.5);
    const rim = new THREE.DirectionalLight(0xbae6fd, 1.05);
    rim.position.set(-4.5, 5.0, -5.0);
    const frontFill = new THREE.DirectionalLight(0xffffff, 0.45);
    frontFill.position.set(0, 2.2, 6.0);

    scene.add(hemi, key, rim, frontFill);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);

    sharedCtx = { renderer, scene, camera, pmrem, envRT };
    return sharedCtx;
  } catch {
    webglDisabled = true;
    return null;
  }
}

function hideHelpersAndComputeBounds(container: THREE.Object3D): THREE.Box3 {
  const hidden: THREE.Object3D[] = [];
  container.traverse((obj) => {
    if ((obj as THREE.Sprite).isSprite) {
      obj.visible = false;
      hidden.push(obj);
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      const geo = mesh.geometry;
      // Hide selection ring & flat contact shadow plane near y=0
      if (
        geo?.type === 'RingGeometry' ||
        (geo?.type === 'PlaneGeometry' && Math.abs(mesh.position.y) < 0.08)
      ) {
        mesh.visible = false;
        hidden.push(mesh);
      }
    }
  });

  container.updateMatrixWorld(true);
  const box = new THREE.Box3();
  container.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.visible && !mesh.userData?.isOutline) {
      const meshBox = new THREE.Box3().setFromObject(mesh);
      if (!meshBox.isEmpty()) {
        box.union(meshBox);
      }
    }
  });

  return box;
}

function frameAndRender(
  ctx: OffscreenCtx,
  container: THREE.Object3D,
  actorType: ActorType
): string {
  const { renderer, scene, camera } = ctx;
  scene.add(container);

  const box = hideHelpersAndComputeBounds(container);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  if (!box.isEmpty()) {
    box.getSize(size);
    box.getCenter(center);
  } else {
    size.set(1, 1.5, 1);
    center.set(0, 0.75, 0);
  }

  // Slight upper-center bias on characters so head & expressive eyes pop cleanly
  const targetY =
    actorType === 'character'
      ? center.y + size.y * 0.07
      : center.y;
  const target = new THREE.Vector3(center.x, targetY, center.z);

  const maxDim = Math.max(size.x, size.y, size.z, 0.35);
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const fitDist = (maxDim * 0.5) / Math.tan(fovRad * 0.5);
  const distanceMultiplier = actorType === 'character' ? 1.24 : 1.38;
  const dist = Math.max(0.6, fitDist * distanceMultiplier);

  const viewDir = new THREE.Vector3(0.42, 0.24, 1.0).normalize();
  camera.position.copy(target).addScaledVector(viewDir, dist);
  camera.lookAt(target);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');

  scene.remove(container);
  return dataUrl;
}

function renderSingleSpec(spec: ThumbnailSpec): string | null {
  const ctx = getSharedContext();
  if (!ctx) return null;

  const container = new THREE.Group();
  const charRigs: CharacterRig[] = [];
  const animalRigs: AnimalRig[] = [];
  const propRigs: PropOrCustomRig[] = [];

  try {
    if (spec.actorType === 'character') {
      if (spec.kind === 'twins') {
        const rigA = createCharacterRig('boy', '#3B82F6');
        const rigB = createCharacterRig('girl', '#EC4899');
        rigA.root.position.set(-0.34, 0, 0);
        rigB.root.position.set(0.34, 0, 0);
        rigA.selectionRing.visible = false;
        rigB.selectionRing.visible = false;
        updateCharacterAnimation(rigA, 'Idle', 'Happy', 0.25, 0.016, 0, false);
        updateCharacterAnimation(rigB, 'Idle', 'Happy', 0.25, 0.016, 0, false);
        container.add(rigA.root, rigB.root);
        charRigs.push(rigA, rigB);
      } else {
        const k = spec.kind as CharacterKind;
        const meta = CHARACTER_META[k] || CHARACTER_META.boy;
        const rig = createCharacterRig(k, meta.defaultColor);
        rig.selectionRing.visible = false;
        updateCharacterAnimation(rig, 'Idle', 'Happy', 0.25, 0.016, 0, false);
        container.add(rig.root);
        charRigs.push(rig);
      }
    } else if (spec.actorType === 'animal') {
      const k = spec.kind as AnimalKind;
      const meta = ANIMAL_META[k] || ANIMAL_META.dog;
      const rig = createAnimalRig(k, meta.defaultColor);
      rig.selectionRing.visible = false;
      updateAnimalAnimation(rig, 'Idle', 'Happy', 0.25, 0.016, 0, false);
      container.add(rig.root);
      animalRigs.push(rig);
    } else if (spec.actorType === 'vehicle') {
      const k = spec.kind as VehicleKind;
      const meta = VEHICLE_META[k] || VEHICLE_META.car;
      const rig = createVehicleRig(k, meta.defaultColor);
      rig.selectionRing.visible = false;
      updatePropOrCustomAnimation(rig, 'Parked', 0.25, 0.016, 0, false);
      container.add(rig.root);
      propRigs.push(rig);
    } else if (spec.actorType === 'prop') {
      const k = spec.kind as PropKind;
      const meta = PROP_META[k] || PROP_META.tree;
      const rig = createPropRig(k, meta.defaultColor);
      rig.selectionRing.visible = false;
      updatePropOrCustomAnimation(rig, 'Idle', 0.25, 0.016, 0, false);
      container.add(rig.root);
      propRigs.push(rig);
    } else if (spec.actorType === 'custom' && spec.customBlueprint) {
      const rig = createCustomModelRig(spec.customBlueprint);
      rig.selectionRing.visible = false;
      updatePropOrCustomAnimation(rig, 'Idle', 0.25, 0.016, 0, false);
      container.add(rig.root);
      propRigs.push(rig);
    } else {
      return null;
    }

    return frameAndRender(ctx, container, spec.actorType);
  } catch {
    return null;
  } finally {
    charRigs.forEach((r) => disposeCharacterRig(r));
    animalRigs.forEach((r) => disposeAnimalRig(r));
    propRigs.forEach((r) => disposePropOrCustomRig(r));
  }
}

function processQueueBatch() {
  rafScheduled = false;
  if (pendingQueue.length === 0 || webglDisabled) return;

  const batchSize = 2;
  for (let i = 0; i < batchSize && pendingQueue.length > 0; i++) {
    const spec = pendingQueue.shift()!;
    queuedKeys.delete(spec.key);
    if (thumbnailCache.has(spec.key)) continue;

    const url = renderSingleSpec(spec);
    if (url) {
      thumbnailCache.set(spec.key, url);
      listeners.forEach((cb) => cb(spec.key, url));
    }
  }

  if (pendingQueue.length > 0) {
    scheduleBatch();
  }
}

function scheduleBatch() {
  if (rafScheduled || pendingQueue.length === 0 || webglDisabled) return;
  rafScheduled = true;
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(processQueueBatch);
  } else {
    setTimeout(processQueueBatch, 16);
  }
}

export function getCachedThumbnail(key: string): string | undefined {
  return thumbnailCache.get(key);
}

export function requestThumbnails(
  specs: ThumbnailSpec[],
  onUpdate: (key: string, dataUrl: string) => void
): () => void {
  listeners.add(onUpdate);

  specs.forEach((spec) => {
    if (thumbnailCache.has(spec.key)) return;
    if (queuedKeys.has(spec.key)) return;
    queuedKeys.add(spec.key);
    pendingQueue.push(spec);
  });

  if (pendingQueue.length > 0) {
    scheduleBatch();
  }

  return () => {
    listeners.delete(onUpdate);
  };
}
