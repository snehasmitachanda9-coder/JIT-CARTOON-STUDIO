import * as THREE from 'three';
import {
  AnimationState,
  CharacterKind,
  FacialExpression,
  HeldItemAttachment,
} from '../types/studio';
import {
  applyHandheldTransform,
  buildHandheldAttachmentObject,
  disposeObjectTree,
} from './handhelds';
import {
  applyPostMixerExpressionsAndGestures,
  mountCharacterGLTF,
  MountedGLTFCharacter,
  selectBestClipName,
} from './gltfCharacterEngine';
import {
  createContactShadowTexture,
  createSpeechBubbleTexture,
} from './proceduralTextures';

export interface CharacterRig {
  kind: CharacterKind;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftHandMount: THREE.Group;
  rightHandMount: THREE.Group;
  // Selection & Dialogue
  selectionRing: THREE.Mesh;
  speechSprite: THREE.Sprite;
  lastDialogue: string;
  lastLeftItemSig: string;
  lastRightItemSig: string;
  leftItemObj: THREE.Group | null;
  rightItemObj: THREE.Group | null;
  headHeight: number;
  jumpPhaseOffset: number;
  // Rigged GLTF / AnimationMixer state
  mounted: MountedGLTFCharacter | null;
  readyPromise: Promise<void>;
  isLoaded: boolean;
  modelVersion: number;
  activeClipName: string | null;
  activeAction: THREE.AnimationAction | null;
  pendingAccentColor: string;
  disposed: boolean;
  loadingRing: THREE.Mesh | null;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getShadowTex(): THREE.CanvasTexture {
  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  return sharedShadowTex;
}

function createSelectionRing(): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.48, 0.58, 36);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.025;
  mesh.visible = false;
  mesh.raycast = () => {};
  return mesh;
}

function createContactShadow(radius = 0.52): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getShadowTex(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.015;
  mesh.raycast = () => {};
  return mesh;
}

function createLoadingRing(): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.24, 0.31, 32);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.03;
  return mesh;
}

function createSpeechSprite(yPos: number): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(0, yPos, 0);
  sprite.scale.set(2.1, 0.9, 1);
  sprite.visible = false;
  return sprite;
}

export function updateSpeechBubble(rig: CharacterRig, dialogue: string): void {
  const trimmed = dialogue.trim();
  if (trimmed === rig.lastDialogue) return;
  rig.lastDialogue = trimmed;

  const mat = rig.speechSprite.material as THREE.SpriteMaterial;
  if (mat.map) {
    mat.map.dispose();
    mat.map = null;
  }

  if (!trimmed) {
    rig.speechSprite.visible = false;
    return;
  }

  const { texture, aspect } = createSpeechBubbleTexture(trimmed);
  mat.map = texture;
  mat.needsUpdate = true;
  const h = 0.88;
  rig.speechSprite.scale.set(h * aspect, h, 1);
  rig.speechSprite.position.y = rig.headHeight + 0.56;
  rig.speechSprite.visible = true;
}

export function updateCharacterAccentColor(rig: CharacterRig, hexColor: string): void {
  if (rig.pendingAccentColor === hexColor && rig.mounted) return;
  rig.pendingAccentColor = hexColor;
  if (rig.mounted) {
    rig.mounted.applyAccentColor(hexColor);
  }
}

function getHeldItemSig(item?: HeldItemAttachment | null): string {
  if (!item || item.itemKind === 'none') return 'none';
  return `${item.itemKind}|${item.imageDataUrl || ''}|${Boolean(item.removeBg)}|${item.customBlueprint?.id || ''}`;
}

export function syncCharacterHeldItems(
  rig: CharacterRig,
  leftItem?: HeldItemAttachment | null,
  rightItem?: HeldItemAttachment | null
): void {
  const leftSig = getHeldItemSig(leftItem);
  if (leftSig !== rig.lastLeftItemSig) {
    rig.lastLeftItemSig = leftSig;
    if (rig.leftItemObj) {
      rig.leftHandMount.remove(rig.leftItemObj);
      disposeObjectTree(rig.leftItemObj);
      rig.leftItemObj = null;
    }
    if (leftItem && leftItem.itemKind !== 'none') {
      const obj = buildHandheldAttachmentObject(leftItem);
      rig.leftHandMount.add(obj);
      rig.leftItemObj = obj;
    }
  } else if (rig.leftItemObj && leftItem) {
    applyHandheldTransform(rig.leftItemObj, leftItem);
  }

  const rightSig = getHeldItemSig(rightItem);
  if (rightSig !== rig.lastRightItemSig) {
    rig.lastRightItemSig = rightSig;
    if (rig.rightItemObj) {
      rig.rightHandMount.remove(rig.rightItemObj);
      disposeObjectTree(rig.rightItemObj);
      rig.rightItemObj = null;
    }
    if (rightItem && rightItem.itemKind !== 'none') {
      const obj = buildHandheldAttachmentObject(rightItem);
      rig.rightHandMount.add(obj);
      rig.rightItemObj = obj;
    }
  } else if (rig.rightItemObj && rightItem) {
    applyHandheldTransform(rig.rightItemObj, rightItem);
  }
}

export function createCharacterRig(kind: CharacterKind, accentColor: string): CharacterRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const initialHeadHeight = 1.65;
  const selectionRing = createSelectionRing();
  const shadow = createContactShadow(kind === 'robot' ? 0.5 : 0.48);
  const speechSprite = createSpeechSprite(initialHeadHeight + 0.56);
  const loadingRing = createLoadingRing();

  const placeholderLeftHand = new THREE.Group();
  placeholderLeftHand.position.set(0.32, 0.9, 0.14);
  const placeholderRightHand = new THREE.Group();
  placeholderRightHand.position.set(-0.32, 0.9, 0.14);

  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 1.65, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.position.y = 0.85;
  hitProxy.userData.isHitProxy = true;

  bodyPivot.add(placeholderLeftHand, placeholderRightHand, loadingRing, hitProxy);

  root.add(shadow, selectionRing, speechSprite);

  const rig: CharacterRig = {
    kind,
    root,
    bodyPivot,
    leftHandMount: placeholderLeftHand,
    rightHandMount: placeholderRightHand,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    lastLeftItemSig: 'none',
    lastRightItemSig: 'none',
    leftItemObj: null,
    rightItemObj: null,
    headHeight: initialHeadHeight,
    jumpPhaseOffset: Math.random() * Math.PI * 2,
    mounted: null,
    readyPromise: Promise.resolve(),
    isLoaded: false,
    modelVersion: 0,
    activeClipName: null,
    activeAction: null,
    pendingAccentColor: accentColor,
    disposed: false,
    loadingRing,
  };

  rig.readyPromise = mountCharacterGLTF(kind, accentColor)
    .then((mounted) => {
      if (rig.disposed) {
        mounted.mixer.stopAllAction();
        disposeMountedAssets(mounted.modelRoot);
        return;
      }

      // Transfer any handheld props attached while loading onto real skeleton hand sockets
      while (placeholderLeftHand.children.length > 0) {
        const ch = placeholderLeftHand.children[0];
        mounted.leftHandMount.add(ch);
      }
      while (placeholderRightHand.children.length > 0) {
        const ch = placeholderRightHand.children[0];
        mounted.rightHandMount.add(ch);
      }
      bodyPivot.remove(placeholderLeftHand, placeholderRightHand);

      if (rig.loadingRing) {
        bodyPivot.remove(rig.loadingRing);
        rig.loadingRing.geometry.dispose();
        (rig.loadingRing.material as THREE.Material).dispose();
        rig.loadingRing = null;
      }

      rig.leftHandMount = mounted.leftHandMount;
      rig.rightHandMount = mounted.rightHandMount;
      rig.mounted = mounted;
      rig.headHeight = mounted.headHeight;
      rig.speechSprite.position.y = rig.headHeight + 0.56;

      if (rig.pendingAccentColor !== accentColor) {
        mounted.applyAccentColor(rig.pendingAccentColor);
      }

      bodyPivot.add(mounted.modelRoot);

      // Activate initial Idle action reference cleanly
      const initialClip = selectBestClipName(mounted.actions, 'Idle');
      if (initialClip) {
        rig.activeClipName = initialClip;
        rig.activeAction = mounted.actions.get(initialClip) || null;
      }

      rig.isLoaded = true;
      rig.modelVersion += 1;
    })
    .catch((err) => {
      console.warn(`Failed to mount rigged GLTF character (${kind}):`, err);
    });

  return rig;
}

export function updateCharacterAnimation(
  rig: CharacterRig,
  animation: AnimationState,
  expression: FacialExpression,
  elapsed: number,
  delta: number,
  lipSyncLevel: number,
  autoLipSyncActive: boolean,
  scrubMode = false
): void {
  const t = elapsed + rig.jumpPhaseOffset * 0.25;

  if (!rig.mounted) {
    if (rig.loadingRing) {
      const pulse = 0.85 + Math.sin(t * 6.0) * 0.18;
      rig.loadingRing.scale.setScalar(pulse);
    }
    return;
  }

  const mounted = rig.mounted;
  const nextClipName = selectBestClipName(mounted.actions, animation);

  if (nextClipName !== rig.activeClipName) {
    const prevAction = rig.activeAction;
    const nextAction = nextClipName ? mounted.actions.get(nextClipName) || null : null;

    if (nextAction) {
      nextAction.enabled = true;
      nextAction.setEffectiveTimeScale(1);
      nextAction.setEffectiveWeight(1);
      if (scrubMode || !prevAction) {
        prevAction?.stop();
        nextAction.reset().play();
      } else {
        nextAction.reset().play();
        prevAction.crossFadeTo(nextAction, 0.22, true);
      }
    } else if (prevAction) {
      prevAction.fadeOut(0.2);
    }

    rig.activeAction = nextAction;
    rig.activeClipName = nextClipName;
  }

  // Restore bones NOT keyed by the active skeletal clip before updating mixer + post-mixer gestures
  const coveredBones = rig.activeClipName
    ? mounted.clipTrackBones.get(rig.activeClipName)
    : undefined;
  mounted.restQuats.forEach((restQuat, bone) => {
    if (!coveredBones || !coveredBones.has(bone.name)) {
      bone.quaternion.copy(restQuat);
    }
  });

  if (scrubMode) {
    mounted.mixer.setTime(Math.max(0, t));
  } else {
    const safeDelta = Math.min(Math.max(delta, 0.0001), 0.05);
    mounted.mixer.update(safeDelta);
  }

  applyPostMixerExpressionsAndGestures(
    mounted,
    rig.activeClipName,
    animation,
    expression,
    t,
    lipSyncLevel,
    autoLipSyncActive
  );
}

function disposeMountedAssets(rootObj: THREE.Object3D): void {
  rootObj.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry && !mesh.geometry.userData?.sharedResource) {
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mt) => {
      if (!mt || mt.userData?.sharedResource) return;
      const std = mt as THREE.MeshStandardMaterial;
      if (std.map && !std.map.userData?.sharedResource) std.map.dispose();
      if (std.normalMap && !std.normalMap.userData?.sharedResource) std.normalMap.dispose();
      if (std.roughnessMap && !std.roughnessMap.userData?.sharedResource) {
        std.roughnessMap.dispose();
      }
      mt.dispose();
    });
  });
}

export function disposeCharacterRig(rig: CharacterRig): void {
  rig.disposed = true;
  if (rig.mounted) {
    rig.mounted.mixer.stopAllAction();
  }
  const mat = rig.speechSprite.material as THREE.SpriteMaterial;
  if (mat.map) {
    mat.map.dispose();
  }
  disposeMountedAssets(rig.root);
}
