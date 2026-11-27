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
import { buildHighDetail3DModel } from './highDetailModelBuilder';
import {
  createContactShadowTexture,
  createSpeechBubbleTexture,
} from './proceduralTextures';

export interface CharacterRig {
  kind: CharacterKind;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  mouthMesh: THREE.Mesh;
  leftBrow?: THREE.Mesh;
  rightBrow?: THREE.Mesh;
  leftEye?: THREE.Mesh;
  rightEye?: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftForearmPivot?: THREE.Group;
  rightForearmPivot?: THREE.Group;
  leftHandMount: THREE.Group;
  rightHandMount: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftKneePivot?: THREE.Group;
  rightKneePivot?: THREE.Group;
  leftWingPivot?: THREE.Group;
  rightWingPivot?: THREE.Group;
  ponytailPivot?: THREE.Group;
  // Selection & Dialogue
  selectionRing: THREE.Mesh;
  speechSprite: THREE.Sprite;
  lastDialogue: string;
  lastLeftItemSig: string;
  lastRightItemSig: string;
  leftItemObj: THREE.Group | null;
  rightItemObj: THREE.Group | null;
  accentMeshes: THREE.Mesh[];
  baseBodyY: number;
  headHeight: number;
  jumpPhaseOffset: number;
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
  rig.speechSprite.position.y = rig.headHeight + 0.58;
  rig.speechSprite.visible = true;
}

export function updateCharacterAccentColor(rig: CharacterRig, hexColor: string): void {
  for (const mesh of rig.accentMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(hexColor);
    if (rig.kind === 'robot' && mat.emissive) {
      mat.emissive.set(hexColor);
    }
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

function enableShadows(group: THREE.Object3D): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      if (m.userData?.isOutline) return;
      if (m.geometry.type !== 'RingGeometry' && m.geometry.type !== 'PlaneGeometry') {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    }
  });
}

export function createCharacterRig(kind: CharacterKind, accentColor: string): CharacterRig {
  const built = buildHighDetail3DModel({
    mode: 'character',
    characterKind: kind,
    accentColor,
  });
  if (built.mode !== 'character') {
    throw new Error('Expected humanoid character build output');
  }

  const h = built.humanoid;
  const root = new THREE.Group();
  root.add(h.bodyPivot);

  const selectionRing = createSelectionRing();
  const shadow = createContactShadow(kind === 'robot' ? 0.5 : 0.48);
  const speechSprite = createSpeechSprite(h.headHeight + 0.56);

  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind,
    root,
    bodyPivot: h.bodyPivot,
    headPivot: h.headPivot,
    mouthMesh: h.mouthMesh,
    leftBrow: h.leftBrow,
    rightBrow: h.rightBrow,
    leftEye: h.leftEye,
    rightEye: h.rightEye,
    leftArmPivot: h.leftArmPivot,
    rightArmPivot: h.rightArmPivot,
    leftForearmPivot: h.leftForearmPivot,
    rightForearmPivot: h.rightForearmPivot,
    leftHandMount: h.leftHandMount,
    rightHandMount: h.rightHandMount,
    leftLegPivot: h.leftLegPivot,
    rightLegPivot: h.rightLegPivot,
    leftKneePivot: h.leftKneePivot,
    rightKneePivot: h.rightKneePivot,
    leftWingPivot: h.leftWingPivot,
    rightWingPivot: h.rightWingPivot,
    ponytailPivot: h.ponytailPivot,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    lastLeftItemSig: 'none',
    lastRightItemSig: 'none',
    leftItemObj: null,
    rightItemObj: null,
    accentMeshes: h.accentMeshes,
    baseBodyY: h.baseBodyY,
    headHeight: h.headHeight,
    jumpPhaseOffset: Math.random() * Math.PI * 2,
  };
}

export function updateCharacterAnimation(
  rig: CharacterRig,
  animation: AnimationState,
  expression: FacialExpression,
  elapsed: number,
  delta: number,
  lipSyncLevel: number,
  autoLipSyncActive: boolean
): void {
  const k = 1 - Math.exp(-10 * Math.min(delta, 0.05));
  const t = elapsed + rig.jumpPhaseOffset * 0.25;

  let bodyY = rig.baseBodyY;
  let bodyRotX = 0;
  let bodyRotY = 0;
  let bodyRotZ = 0;
  let headRotX = 0;
  let headRotY = 0;
  let headRotZ = 0;
  let lArmX = 0;
  let lArmY = 0;
  let lArmZ = 0.12;
  let rArmX = 0;
  let rArmY = 0;
  let rArmZ = -0.12;
  let lForeX = -0.12;
  let rForeX = -0.12;
  let lLegX = 0;
  let rLegX = 0;
  let lLegZ = 0;
  let rLegZ = 0;
  let lKneeX = 0;
  let rKneeX = 0;
  let mouthScaleY = 1;
  let mouthScaleX = 1;

  // Facial Expression Base
  let lBrowRotZ = 0;
  let rBrowRotZ = 0;
  let browOffsetY = 0;
  switch (expression) {
    case 'Happy':
      mouthScaleX = 1.25;
      browOffsetY = 0.01;
      break;
    case 'Sad':
      lBrowRotZ = 0.35;
      rBrowRotZ = -0.35;
      mouthScaleX = 0.72;
      headRotX = 0.14;
      break;
    case 'Surprised':
      browOffsetY = 0.032;
      mouthScaleY = 2.1;
      mouthScaleX = 0.75;
      break;
    case 'Angry':
      lBrowRotZ = -0.4;
      rBrowRotZ = 0.4;
      browOffsetY = -0.012;
      mouthScaleX = 0.85;
      break;
  }

  switch (animation) {
    case 'Idle': {
      bodyY = rig.baseBodyY + Math.sin(t * 2.1) * 0.015;
      headRotY += Math.sin(t * 0.85) * 0.08;
      headRotX += Math.sin(t * 1.4) * 0.03;
      lArmX = Math.sin(t * 1.8) * 0.05;
      rArmX = -Math.sin(t * 1.8) * 0.05;
      break;
    }

    case 'Walk': {
      const speed = 5.4;
      const swing = Math.sin(t * speed);
      bodyY = rig.baseBodyY + Math.abs(Math.cos(t * speed)) * 0.05;
      bodyRotX = 0.06;
      lLegX = swing * 0.62;
      rLegX = -swing * 0.62;
      lKneeX = Math.max(0.05, swing * 0.55);
      rKneeX = Math.max(0.05, -swing * 0.55);
      lArmX = -swing * 0.48;
      rArmX = swing * 0.48;
      lForeX = -0.25;
      rForeX = -0.25;
      headRotY += Math.sin(t * speed * 0.5) * 0.06;
      break;
    }

    case 'Run':
    case 'Running & Chasing': {
      const isChase = animation === 'Running & Chasing';
      const speed = isChase ? 13.0 : 10.2;
      const swing = Math.sin(t * speed);
      bodyY = rig.baseBodyY + Math.abs(Math.sin(t * speed)) * (isChase ? 0.15 : 0.12);
      bodyRotX = isChase ? 0.3 : 0.18;
      lLegX = swing * (isChase ? 1.08 : 0.92);
      rLegX = -swing * (isChase ? 1.08 : 0.92);
      lKneeX = Math.max(0.12, swing * 0.95);
      rKneeX = Math.max(0.12, -swing * 0.95);
      lArmX = -swing * (isChase ? 1.05 : 0.85);
      rArmX = swing * (isChase ? 1.05 : 0.85);
      lForeX = -1.05;
      rForeX = -1.05;
      if (isChase) {
        headRotX = -0.14;
      }
      break;
    }

    case 'Talk (Lip-Sync)': {
      bodyY = rig.baseBodyY + Math.sin(t * 2.8) * 0.018;
      headRotX += Math.sin(t * 4.2) * 0.07;
      headRotY += Math.sin(t * 1.9) * 0.11;
      lArmX = -0.45 + Math.sin(t * 3.4) * 0.22;
      rArmX = -0.52 + Math.cos(t * 3.8) * 0.24;
      lArmZ = 0.22;
      rArmZ = -0.22;
      lForeX = -0.65 + Math.sin(t * 5.0) * 0.25;
      rForeX = -0.7 + Math.cos(t * 4.6) * 0.25;
      break;
    }

    case 'Waving Hand (হাত নাড়ানো)':
    case 'Royal Wave': {
      const isRoyal = animation === 'Royal Wave';
      bodyY = rig.baseBodyY + Math.sin(t * 2.2) * 0.018;
      headRotZ = isRoyal ? 0.04 : 0.08;
      headRotY += Math.sin(t * 1.8) * 0.08;
      rArmZ = (isRoyal ? -1.9 : -2.45) + Math.sin(t * (isRoyal ? 4.5 : 7.4)) * (isRoyal ? 0.18 : 0.34);
      rArmX = -0.25;
      rForeX = (isRoyal ? -0.55 : -0.35) + Math.sin(t * (isRoyal ? 4.5 : 7.4)) * 0.22;
      lArmZ = 0.16;
      break;
    }

    case 'Clapping (হাততালি)': {
      const clap = Math.abs(Math.sin(t * 9.5));
      bodyY = rig.baseBodyY + Math.sin(t * 9.5) * 0.025;
      lArmX = -0.95;
      rArmX = -0.95;
      lArmY = -0.35 + clap * 0.32;
      rArmY = 0.35 - clap * 0.32;
      lArmZ = -0.18 + clap * 0.16;
      rArmZ = 0.18 - clap * 0.16;
      lForeX = -0.8;
      rForeX = -0.8;
      headRotX = Math.sin(t * 4.75) * 0.06;
      break;
    }

    case 'Pointing / Beckoning (ইশারা)': {
      const beckon = Math.sin(t * 5.2);
      bodyY = rig.baseBodyY + Math.sin(t * 2) * 0.015;
      bodyRotY = -0.15;
      headRotY = 0.15;
      rArmX = -1.35 + beckon * 0.12;
      rArmZ = -0.05;
      rForeX = -0.15 - Math.max(0, beckon) * 0.65;
      lArmZ = 0.18;
      break;
    }

    case 'Fighting': {
      const strike = Math.sin(t * 8.2);
      bodyY = rig.baseBodyY - 0.08 + Math.abs(strike) * 0.04;
      bodyRotY = Math.sin(t * 4.1) * 0.35;
      bodyRotX = 0.14;
      lLegX = -0.35;
      rLegX = 0.35;
      lArmX = -1.15 - Math.max(0, -strike) * 0.55;
      rArmX = -1.15 - Math.max(0, strike) * 0.65;
      lForeX = -1.1 + Math.max(0, -strike) * 0.95;
      rForeX = -1.1 + Math.max(0, strike) * 0.95;
      lBrowRotZ = -0.35;
      rBrowRotZ = 0.35;
      break;
    }

    case 'Playing Football': {
      const cycle = t * 4.4;
      const kick = Math.max(0, Math.sin(cycle));
      bodyY = rig.baseBodyY + Math.abs(Math.sin(cycle * 2)) * 0.06;
      bodyRotX = 0.08;
      rLegX = -kick * 1.15 + Math.max(0, -Math.sin(cycle)) * 0.45;
      lLegX = kick * 0.28;
      lArmZ = 0.45 + kick * 0.35;
      rArmZ = -0.45 - kick * 0.35;
      lArmX = -0.35;
      rArmX = 0.25;
      headRotX = 0.18;
      break;
    }

    case 'Playing Cricket': {
      const swing = Math.sin(t * 4.2);
      bodyY = rig.baseBodyY - 0.05;
      bodyRotY = swing * 0.65;
      bodyRotX = 0.12;
      rArmX = -1.05 + swing * 0.65;
      lArmX = -1.05 + swing * 0.65;
      rArmZ = -0.3 + swing * 0.45;
      lArmZ = 0.3 + swing * 0.45;
      rForeX = -0.55;
      lForeX = -0.55;
      lLegX = -0.25;
      rLegX = 0.25;
      break;
    }

    case 'Swimming': {
      const stroke = t * 5.2;
      bodyY = 0.42 + Math.sin(stroke * 0.5) * 0.06;
      bodyRotX = Math.PI / 2 - 0.12;
      bodyRotZ = Math.sin(stroke) * 0.16;
      headRotX = -0.95;
      lArmX = -stroke % (Math.PI * 2);
      rArmX = -(stroke + Math.PI) % (Math.PI * 2);
      lForeX = -0.25;
      rForeX = -0.25;
      lLegX = Math.sin(stroke * 2.2) * 0.42;
      rLegX = -Math.sin(stroke * 2.2) * 0.42;
      break;
    }

    case 'Reading Books': {
      bodyY = rig.baseBodyY + Math.sin(t * 1.8) * 0.01;
      headRotX = 0.32 + Math.sin(t * 2.4) * 0.04;
      headRotY = Math.sin(t * 1.1) * 0.08;
      lArmX = -0.68;
      rArmX = -0.68;
      lArmY = -0.25;
      rArmY = 0.25;
      lForeX = -0.92;
      rForeX = -0.92;
      break;
    }

    case 'Using Mobile Phone': {
      bodyY = rig.baseBodyY + Math.sin(t * 1.9) * 0.012;
      headRotX = 0.28;
      rArmX = -0.78;
      rArmY = 0.22;
      rForeX = -1.05 + Math.sin(t * 7.5) * 0.04;
      lArmX = -0.25;
      break;
    }

    case 'Sleeping & Waking Up': {
      const phase = (t % 8.0) / 8.0; // 0..0.55 sleep, 0.55..0.75 sit up, 0.75..1 stretch awake
      if (phase < 0.55) {
        bodyY = 0.22;
        bodyRotX = -Math.PI / 2 + 0.06;
        headRotX = 0.08 + Math.sin(t * 1.6) * 0.03;
        lArmX = -0.2;
        rArmX = -0.2;
      } else if (phase < 0.75) {
        const p = (phase - 0.55) / 0.2;
        bodyY = THREE.MathUtils.lerp(0.24, rig.baseBodyY - 0.24, p);
        bodyRotX = THREE.MathUtils.lerp(-Math.PI / 2, 0.05, p);
        lLegX = -1.2 * p;
        rLegX = -1.2 * p;
      } else {
        const stretch = Math.sin(((phase - 0.75) / 0.25) * Math.PI);
        bodyY = rig.baseBodyY;
        lArmZ = 0.2 + stretch * 2.1;
        rArmZ = -0.2 - stretch * 2.1;
        headRotX = -0.18 * stretch;
        mouthScaleY = 1 + stretch * 1.8;
      }
      break;
    }

    case 'Sit': {
      bodyY = rig.baseBodyY - 0.32;
      lLegX = -1.42;
      rLegX = -1.42;
      lKneeX = 1.32;
      rKneeX = 1.32;
      lArmX = -0.42;
      rArmX = -0.42;
      lForeX = -0.35;
      rForeX = -0.35;
      break;
    }

    case 'Jump': {
      const cycle = (t * 2.1) % (Math.PI * 2);
      const air = Math.max(0, Math.sin(cycle));
      bodyY = rig.baseBodyY + air * 0.68;
      lArmZ = 0.25 + air * 1.45;
      rArmZ = -0.25 - air * 1.45;
      lLegX = -air * 0.42;
      rLegX = air * 0.25;
      lKneeX = air * 0.58;
      rKneeX = air * 0.48;
      headRotX -= air * 0.12;
      break;
    }

    case 'Dance': {
      const groove = t * 6.0;
      bodyY = rig.baseBodyY + Math.abs(Math.sin(groove)) * 0.11;
      bodyRotY = Math.sin(groove * 0.5) * 0.32;
      bodyRotZ = Math.cos(groove * 0.5) * 0.1;
      headRotZ = -Math.cos(groove * 0.5) * 0.14;
      headRotY += Math.sin(groove * 0.5) * 0.18;
      lArmZ = 0.75 + Math.sin(groove) * 0.65;
      rArmZ = -0.75 + Math.cos(groove) * 0.65;
      lArmX = -0.55;
      rArmX = -0.55;
      lForeX = -0.6 + Math.sin(groove * 2) * 0.25;
      rForeX = -0.6 - Math.sin(groove * 2) * 0.25;
      lLegX = Math.sin(groove * 0.5) * 0.28;
      rLegX = -Math.sin(groove * 0.5) * 0.28;
      break;
    }

    case 'Laugh': {
      const ha = Math.sin(t * 11);
      bodyY = rig.baseBodyY + Math.abs(ha) * 0.04;
      bodyRotX = -0.12;
      headRotX = -0.22 + ha * 0.08;
      lArmX = -0.65;
      rArmX = -0.65;
      lForeX = -0.95;
      rForeX = -0.95;
      mouthScaleY = 2.1 + Math.abs(ha) * 1.1;
      mouthScaleX = 1.35;
      break;
    }

    case 'Cry': {
      const sob = Math.sin(t * 7.5);
      bodyY = rig.baseBodyY - 0.03 + Math.abs(sob) * 0.02;
      bodyRotX = 0.16;
      headRotX = 0.25;
      headRotZ = sob * 0.08;
      lArmX = -1.35;
      rArmX = -1.35;
      lForeX = -1.2 + sob * 0.12;
      rForeX = -1.2 - sob * 0.12;
      lBrowRotZ = 0.38;
      rBrowRotZ = -0.38;
      break;
    }

    case 'Eat': {
      const scoop = (Math.sin(t * 3.8) + 1) * 0.5;
      bodyY = rig.baseBodyY + Math.sin(t * 2) * 0.015;
      rArmX = -0.45 - scoop * 0.72;
      rArmY = 0.25;
      rForeX = -0.65 - scoop * 0.78;
      headRotX = 0.08 + scoop * 0.1;
      mouthScaleY = 1 + Math.abs(Math.sin(t * 10)) * 1.4;
      break;
    }

    case 'Farming/Digging': {
      const dig = Math.sin(t * 4.2);
      bodyY = rig.baseBodyY - 0.06 + Math.max(0, dig) * 0.04;
      bodyRotX = 0.22 + dig * 0.16;
      lArmX = -0.85 + dig * 0.45;
      rArmX = -0.85 + dig * 0.45;
      lForeX = -0.45;
      rForeX = -0.45;
      break;
    }

    case 'Medical Checkup': {
      bodyY = rig.baseBodyY + Math.sin(t * 2) * 0.012;
      bodyRotX = 0.1;
      headRotX = 0.12 + Math.sin(t * 2.5) * 0.06;
      rArmX = -0.85 + Math.sin(t * 3.0) * 0.18;
      rForeX = -0.45;
      lArmX = -0.4;
      lForeX = -0.7;
      break;
    }

    case 'Cooking/Stirring': {
      const stir = t * 5.5;
      bodyY = rig.baseBodyY + Math.sin(t * 2.5) * 0.015;
      rArmX = -0.75 + Math.sin(stir) * 0.14;
      rArmY = Math.cos(stir) * 0.22;
      rForeX = -0.78;
      lArmX = -0.55;
      lForeX = -0.65;
      headRotX = 0.16;
      break;
    }

    case 'Magic Spell Cast': {
      const cast = Math.sin(t * 5.0);
      bodyY = rig.baseBodyY + 0.12 + Math.sin(t * 2.8) * 0.08;
      rArmX = -1.65 + cast * 0.35;
      rArmZ = -0.45 + Math.cos(t * 5.0) * 0.35;
      lArmX = -1.25 - cast * 0.25;
      lArmZ = 0.45;
      headRotX = -0.15;
      break;
    }
  }

  // Automatic Lip-Sync when speaking, when audio plays, or when dialogue is active in playback
  if (animation === 'Talk (Lip-Sync)' || autoLipSyncActive || lipSyncLevel > 0.05) {
    if (lipSyncLevel >= 0) {
      mouthScaleY = 1 + lipSyncLevel * 3.2;
    } else {
      const syllable = Math.max(0, Math.sin(t * 13.5) * 0.6 + Math.sin(t * 21.3) * 0.4);
      mouthScaleY = 1 + syllable * 2.5;
    }
  }

  rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, bodyY, k);
  rig.bodyPivot.rotation.x = THREE.MathUtils.lerp(rig.bodyPivot.rotation.x, bodyRotX, k);
  rig.bodyPivot.rotation.y = THREE.MathUtils.lerp(rig.bodyPivot.rotation.y, bodyRotY, k);
  rig.bodyPivot.rotation.z = THREE.MathUtils.lerp(rig.bodyPivot.rotation.z, bodyRotZ, k);

  rig.headPivot.rotation.x = THREE.MathUtils.lerp(rig.headPivot.rotation.x, headRotX, k);
  rig.headPivot.rotation.y = THREE.MathUtils.lerp(rig.headPivot.rotation.y, headRotY, k);
  rig.headPivot.rotation.z = THREE.MathUtils.lerp(rig.headPivot.rotation.z, headRotZ, k);

  rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(rig.leftArmPivot.rotation.x, lArmX, k);
  rig.leftArmPivot.rotation.y = THREE.MathUtils.lerp(rig.leftArmPivot.rotation.y, lArmY, k);
  rig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(rig.leftArmPivot.rotation.z, lArmZ, k);
  rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.x, rArmX, k);
  rig.rightArmPivot.rotation.y = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.y, rArmY, k);
  rig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.z, rArmZ, k);

  if (rig.leftForearmPivot) {
    rig.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(rig.leftForearmPivot.rotation.x, lForeX, k);
  }
  if (rig.rightForearmPivot) {
    rig.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(rig.rightForearmPivot.rotation.x, rForeX, k);
  }

  rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(rig.leftLegPivot.rotation.x, lLegX, k);
  rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(rig.rightLegPivot.rotation.x, rLegX, k);
  rig.leftLegPivot.rotation.z = THREE.MathUtils.lerp(rig.leftLegPivot.rotation.z, lLegZ, k);
  rig.rightLegPivot.rotation.z = THREE.MathUtils.lerp(rig.rightLegPivot.rotation.z, rLegZ, k);
  if (rig.leftKneePivot) {
    rig.leftKneePivot.rotation.x = THREE.MathUtils.lerp(rig.leftKneePivot.rotation.x, lKneeX, k);
  }
  if (rig.rightKneePivot) {
    rig.rightKneePivot.rotation.x = THREE.MathUtils.lerp(rig.rightKneePivot.rotation.x, rKneeX, k);
  }

  rig.mouthMesh.scale.y = THREE.MathUtils.lerp(rig.mouthMesh.scale.y, mouthScaleY, Math.min(1, k * 2.2));
  rig.mouthMesh.scale.x = THREE.MathUtils.lerp(rig.mouthMesh.scale.x, mouthScaleX, k);

  if (rig.leftBrow && rig.rightBrow) {
    rig.leftBrow.rotation.z = THREE.MathUtils.lerp(rig.leftBrow.rotation.z, lBrowRotZ, k);
    rig.rightBrow.rotation.z = THREE.MathUtils.lerp(rig.rightBrow.rotation.z, rBrowRotZ, k);
    if (!rig.leftBrow.userData.baseY) {
      rig.leftBrow.userData.baseY = rig.leftBrow.position.y;
      rig.rightBrow.userData.baseY = rig.rightBrow.position.y;
    }
    rig.leftBrow.position.y = THREE.MathUtils.lerp(
      rig.leftBrow.position.y,
      (rig.leftBrow.userData.baseY as number) + browOffsetY,
      k
    );
    rig.rightBrow.position.y = THREE.MathUtils.lerp(
      rig.rightBrow.position.y,
      (rig.rightBrow.userData.baseY as number) + browOffsetY,
      k
    );
  }

  if (rig.leftWingPivot && rig.rightWingPivot) {
    const flapSpeed = animation === 'Magic Spell Cast' || animation === 'Jump' ? 14 : 5.5;
    const flap = Math.sin(t * flapSpeed) * 0.28;
    rig.leftWingPivot.rotation.y = -0.2 + flap;
    rig.rightWingPivot.rotation.y = 0.2 - flap;
  }

  if (rig.ponytailPivot) {
    const hairBounce =
      animation === 'Run' || animation === 'Running & Chasing' || animation === 'Jump'
        ? Math.sin(t * 10) * 0.24
        : Math.sin(t * 2.5) * 0.06;
    rig.ponytailPivot.rotation.x = hairBounce;
    rig.ponytailPivot.rotation.z = Math.cos(t * 3.1) * 0.05;
  }
}

export function disposeCharacterRig(rig: CharacterRig): void {
  const mat = rig.speechSprite.material as THREE.SpriteMaterial;
  if (mat.map) {
    mat.map.dispose();
  }
  rig.root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh || (obj as THREE.Sprite).isSprite) {
      const m = obj as THREE.Mesh;
      if (m.userData?.isOutline) return;
      if (m.geometry && !m.userData?.sharedResource && !m.geometry.userData?.sharedResource) {
        m.geometry.dispose();
      }
      if (Array.isArray(m.material)) {
        m.material.forEach((mt) => {
          if (mt.userData?.sharedResource) return;
          const std = mt as THREE.MeshStandardMaterial;
          if (std.map && !std.map.userData?.sharedResource) std.map.dispose();
          mt.dispose();
        });
      } else if (m.material && !m.material.userData?.sharedResource) {
        const std = m.material as THREE.MeshStandardMaterial;
        if (std.map && !std.map.userData?.sharedResource) std.map.dispose();
        m.material.dispose();
      }
    }
  });
}
