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
  buildHighDetail3DModel,
  SculptedHumanoidParts,
} from './highDetailModelBuilder';
import {
  createContactShadowTexture,
  createSpeechBubbleTexture,
} from './proceduralTextures';

export interface CharacterRig {
  kind: CharacterKind;
  root: THREE.Group;
  parts: SculptedHumanoidParts;
  bodyPivot: THREE.Group;
  leftHandMount: THREE.Group;
  rightHandMount: THREE.Group;
  selectionRing: THREE.Mesh;
  speechSprite: THREE.Sprite;
  lastDialogue: string;
  lastLeftItemSig: string;
  lastRightItemSig: string;
  leftItemObj: THREE.Group | null;
  rightItemObj: THREE.Group | null;
  headHeight: number;
  jumpPhaseOffset: number;
  readyPromise: Promise<void>;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getShadowTex(): THREE.CanvasTexture {
  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  return sharedShadowTex;
}

function createSelectionRing(): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.46, 0.56, 36);
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

function createContactShadow(radius = 0.48): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getShadowTex(),
    transparent: true,
    opacity: 0.52,
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

function enableCharacterShadows(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.userData?.isOutline || m.userData?.isHitProxy) return;
    if (m.geometry.type !== 'RingGeometry' && m.geometry.type !== 'PlaneGeometry') {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
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
  rig.speechSprite.position.y = rig.headHeight + 0.5;
  rig.speechSprite.visible = true;
}

export function updateCharacterAccentColor(rig: CharacterRig, hexColor: string): void {
  for (const mesh of rig.parts.accentMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat?.color) {
      mat.color.set(hexColor);
    }
    if (rig.kind === 'robot' && mat?.emissive) {
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

export function createCharacterRig(kind: CharacterKind, accentColor: string): CharacterRig {
  const built = buildHighDetail3DModel({
    mode: 'character',
    characterKind: kind,
    accentColor,
  });

  if (built.mode !== 'character') {
    throw new Error(`Expected character build output for ${kind}`);
  }

  const parts = built.humanoid;
  const root = new THREE.Group();
  root.add(parts.bodyPivot);

  // Invisible raycast proxy cylinder for reliable stage clicking & dragging
  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 1.65, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.position.y = 0.85;
  hitProxy.userData.isHitProxy = true;
  root.add(hitProxy);

  const selectionRing = createSelectionRing();
  const shadow = createContactShadow(kind === 'robot' ? 0.5 : 0.46);
  const speechSprite = createSpeechSprite(parts.headHeight + 0.5);
  root.add(shadow, selectionRing, speechSprite);

  enableCharacterShadows(parts.bodyPivot);

  return {
    kind,
    root,
    parts,
    bodyPivot: parts.bodyPivot,
    leftHandMount: parts.leftHandMount,
    rightHandMount: parts.rightHandMount,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    lastLeftItemSig: 'none',
    lastRightItemSig: 'none',
    leftItemObj: null,
    rightItemObj: null,
    headHeight: parts.headHeight,
    jumpPhaseOffset: Math.random() * Math.PI * 2,
    readyPromise: Promise.resolve(),
  };
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
  const p = rig.parts;
  const t = elapsed + rig.jumpPhaseOffset * 0.25;
  const k = scrubMode ? 1 : Math.min(1, Math.max(delta, 0.001) * 12);

  // Default relaxed standing pose: natural downward arms (±0.18 rad), subtle elbow bend
  let bodyY = p.baseBodyY;
  let bodyRotX = 0;
  let bodyRotY = 0;
  let bodyRotZ = 0;

  let headRotX = 0;
  let headRotY = 0;
  let headRotZ = 0;

  let lArmX = 0;
  let lArmZ = -0.18;
  let rArmX = 0;
  let rArmZ = 0.18;
  let lForeX = -0.14;
  let rForeX = -0.14;

  let lLegX = 0;
  let rLegX = 0;
  let lKneeX = 0;
  let rKneeX = 0;

  switch (animation) {
    case 'Idle':
    case 'Talk (Lip-Sync)': {
      bodyY = p.baseBodyY + Math.sin(t * 2.1) * 0.015;
      headRotX = Math.sin(t * 1.4) * 0.03;
      if (animation === 'Talk (Lip-Sync)') {
        const g = Math.sin(t * 3.4);
        rArmX = -0.35 + g * 0.16;
        rArmZ = 0.22;
        rForeX = -0.65 + Math.cos(t * 4.2) * 0.2;
        lArmX = -0.15 - g * 0.08;
        lForeX = -0.35;
        headRotY = Math.sin(t * 1.8) * 0.1;
      }
      break;
    }

    case 'Walk': {
      const spd = 5.4;
      const sw = Math.sin(t * spd);
      bodyY = p.baseBodyY + Math.abs(Math.cos(t * spd)) * 0.045;
      bodyRotX = 0.05;
      lLegX = sw * 0.52;
      rLegX = -sw * 0.52;
      lKneeX = Math.max(0, -sw) * 0.45;
      rKneeX = Math.max(0, sw) * 0.45;
      lArmX = -sw * 0.42;
      rArmX = sw * 0.42;
      lForeX = -0.28 - Math.max(0, sw) * 0.2;
      rForeX = -0.28 - Math.max(0, -sw) * 0.2;
      headRotY = sw * 0.04;
      break;
    }

    case 'Run':
    case 'Running & Chasing': {
      const spd = 9.5;
      const sw = Math.sin(t * spd);
      bodyY = p.baseBodyY + Math.abs(Math.cos(t * spd)) * 0.085;
      bodyRotX = 0.18;
      lLegX = sw * 0.8;
      rLegX = -sw * 0.8;
      lKneeX = Math.max(0, -sw) * 0.85 + 0.15;
      rKneeX = Math.max(0, sw) * 0.85 + 0.15;
      lArmX = -sw * 0.72;
      rArmX = sw * 0.72;
      lForeX = -1.05;
      rForeX = -1.05;
      break;
    }

    case 'Waving Hand (হাত নাড়ানো)':
    case 'Royal Wave': {
      const waveFreq = animation === 'Royal Wave' ? 4.8 : 7.0;
      bodyY = p.baseBodyY + Math.sin(t * 2.4) * 0.018;
      rArmX = -0.25;
      rArmZ = 2.32 + Math.sin(t * waveFreq) * 0.26;
      rForeX = -0.32;
      headRotZ = -0.08;
      headRotY = 0.08;
      break;
    }

    case 'Clapping (হাততালি)': {
      const clap = Math.sin(t * 14);
      bodyY = p.baseBodyY + Math.abs(Math.sin(t * 7)) * 0.03;
      lArmX = -0.95;
      rArmX = -0.95;
      lArmZ = 0.22 + clap * 0.16;
      rArmZ = -0.22 - clap * 0.16;
      lForeX = -0.68;
      rForeX = -0.68;
      headRotX = Math.sin(t * 7) * 0.06;
      break;
    }

    case 'Pointing / Beckoning (ইশারা)': {
      rArmX = -1.35 + Math.sin(t * 4.5) * 0.08;
      rArmZ = 0.08;
      rForeX = -0.08 + Math.sin(t * 4.5) * 0.12;
      headRotY = -0.12;
      break;
    }

    case 'Fighting': {
      const punch = Math.sin(t * 10);
      bodyY = p.baseBodyY - 0.04 + Math.abs(Math.cos(t * 5)) * 0.04;
      bodyRotY = punch * 0.22;
      lLegX = -0.3;
      rLegX = 0.25;
      lKneeX = 0.35;
      rKneeX = 0.25;
      lArmX = -1.25 - Math.max(0, punch) * 0.35;
      rArmX = -1.25 - Math.max(0, -punch) * 0.35;
      lForeX = -1.1 + Math.max(0, punch) * 0.9;
      rForeX = -1.1 + Math.max(0, -punch) * 0.9;
      break;
    }

    case 'Playing Football': {
      const kick = Math.sin(t * 4.5);
      bodyY = p.baseBodyY + Math.abs(Math.sin(t * 4.5)) * 0.06;
      rLegX = -kick * 0.82;
      rKneeX = Math.max(0, kick) * 0.65;
      lLegX = kick * 0.35;
      lArmX = kick * 0.55;
      lArmZ = -0.35;
      rArmX = -kick * 0.45;
      rArmZ = 0.35;
      break;
    }

    case 'Playing Cricket': {
      const swing = Math.sin(t * 4.2);
      bodyRotY = -0.35 + swing * 0.55;
      lArmX = -0.9 + swing * 0.5;
      rArmX = -0.9 + swing * 0.5;
      lArmZ = 0.15;
      rArmZ = -0.15;
      lForeX = -0.6;
      rForeX = -0.6;
      lKneeX = 0.22;
      rKneeX = 0.22;
      bodyY = p.baseBodyY - 0.04;
      break;
    }

    case 'Swimming': {
      bodyRotX = 1.25;
      bodyY = p.baseBodyY + 0.12 + Math.sin(t * 3.5) * 0.06;
      lArmX = -t * 5.2;
      rArmX = -t * 5.2 + Math.PI;
      lLegX = Math.sin(t * 10) * 0.32;
      rLegX = -Math.sin(t * 10) * 0.32;
      headRotX = -0.65;
      break;
    }

    case 'Reading Books': {
      lArmX = -0.78;
      rArmX = -0.78;
      lArmZ = 0.22;
      rArmZ = -0.22;
      lForeX = -0.75;
      rForeX = -0.75;
      headRotX = 0.28 + Math.sin(t * 1.6) * 0.04;
      break;
    }

    case 'Using Mobile Phone': {
      rArmX = -0.72;
      rArmZ = -0.05;
      rForeX = -0.95;
      headRotX = 0.32;
      headRotY = Math.sin(t * 1.4) * 0.06;
      break;
    }

    case 'Sleeping & Waking Up': {
      const wakeCycle = (Math.sin(t * 1.1) + 1) * 0.5;
      bodyRotX = THREE.MathUtils.lerp(-1.32, 0, Math.max(0, wakeCycle - 0.55) / 0.45);
      bodyY = THREE.MathUtils.lerp(0.24, p.baseBodyY, Math.max(0, wakeCycle - 0.55) / 0.45);
      lArmX = -0.25;
      rArmX = -0.25;
      headRotZ = Math.sin(t * 1.6) * 0.12;
      break;
    }

    case 'Sit': {
      bodyY = Math.max(0.22, p.baseBodyY - 0.26);
      lLegX = -1.35;
      rLegX = -1.35;
      lKneeX = 1.35;
      rKneeX = 1.35;
      lArmX = -0.35;
      rArmX = -0.35;
      lForeX = -0.5;
      rForeX = -0.5;
      break;
    }

    case 'Jump': {
      const air = Math.max(0, Math.sin(t * 3.8));
      bodyY = p.baseBodyY + air * 0.56;
      lArmZ = -0.3 - air * 1.4;
      rArmZ = 0.3 + air * 1.4;
      lKneeX = air * 0.55;
      rKneeX = air * 0.55;
      lLegX = -air * 0.25;
      rLegX = -air * 0.25;
      break;
    }

    case 'Dance': {
      const beat = Math.sin(t * 6.5);
      const bounce = Math.abs(Math.cos(t * 6.5));
      bodyY = p.baseBodyY + bounce * 0.11;
      bodyRotY = Math.sin(t * 3.25) * 0.24;
      bodyRotZ = beat * 0.07;
      lArmX = beat * 0.55;
      rArmX = -beat * 0.55;
      lArmZ = -0.38 - bounce * 0.42;
      rArmZ = 0.38 + bounce * 0.42;
      lForeX = -0.65;
      rForeX = -0.65;
      lLegX = beat * 0.25;
      rLegX = -beat * 0.25;
      lKneeX = Math.max(0, -beat) * 0.35;
      rKneeX = Math.max(0, beat) * 0.35;
      headRotZ = -beat * 0.12;
      break;
    }

    case 'Laugh': {
      const ch = Math.abs(Math.sin(t * 11));
      bodyY = p.baseBodyY + ch * 0.055;
      headRotX = -0.14 - ch * 0.1;
      lArmX = -0.45;
      rArmX = -0.45;
      lForeX = -0.85 - ch * 0.2;
      rForeX = -0.85 - ch * 0.2;
      break;
    }

    case 'Cry': {
      const sob = Math.sin(t * 8);
      bodyY = p.baseBodyY - 0.03 + Math.abs(sob) * 0.025;
      bodyRotX = 0.12;
      headRotX = 0.24;
      headRotZ = sob * 0.08;
      lArmX = -1.15;
      rArmX = -1.15;
      lArmZ = 0.12;
      rArmZ = -0.12;
      lForeX = -1.1;
      rForeX = -1.1;
      break;
    }

    case 'Eat': {
      const bite = (Math.sin(t * 4.2) + 1) * 0.5;
      rArmX = -0.8 - bite * 0.45;
      rForeX = -0.65 - bite * 0.7;
      headRotX = 0.12 + bite * 0.08;
      break;
    }

    case 'Farming/Digging': {
      const dig = Math.sin(t * 4.0);
      bodyRotX = 0.22 + dig * 0.18;
      lArmX = -0.75 + dig * 0.45;
      rArmX = -0.75 + dig * 0.45;
      lForeX = -0.4;
      rForeX = -0.4;
      lKneeX = 0.25;
      rKneeX = 0.25;
      bodyY = p.baseBodyY - 0.04;
      break;
    }

    case 'Medical Checkup': {
      rArmX = -0.95 + Math.sin(t * 3.0) * 0.16;
      rForeX = -0.45;
      lArmX = -0.3;
      lForeX = -0.5;
      headRotX = 0.1;
      break;
    }

    case 'Cooking/Stirring': {
      const stirX = Math.sin(t * 6.0) * 0.2;
      const stirZ = Math.cos(t * 6.0) * 0.2;
      rArmX = -0.82 + stirX;
      rArmZ = 0.14 + stirZ;
      rForeX = -0.65;
      lArmX = -0.55;
      lForeX = -0.75;
      break;
    }

    case 'Magic Spell Cast': {
      const cast = Math.sin(t * 5.0);
      bodyY = p.baseBodyY + Math.abs(cast) * 0.06;
      rArmX = -1.35 + cast * 0.28;
      rArmZ = 0.3 + Math.cos(t * 5.0) * 0.22;
      rForeX = -0.25;
      lArmZ = -0.42;
      lArmX = -0.4;
      headRotX = -0.1;
      break;
    }

    default: {
      bodyY = p.baseBodyY + Math.sin(t * 2) * 0.015;
    }
  }

  // Apply body & limb pose smoothly
  p.bodyPivot.position.y = THREE.MathUtils.lerp(p.bodyPivot.position.y, bodyY, k);
  p.bodyPivot.rotation.x = THREE.MathUtils.lerp(p.bodyPivot.rotation.x, bodyRotX, k);
  p.bodyPivot.rotation.y = THREE.MathUtils.lerp(p.bodyPivot.rotation.y, bodyRotY, k);
  p.bodyPivot.rotation.z = THREE.MathUtils.lerp(p.bodyPivot.rotation.z, bodyRotZ, k);

  p.headPivot.rotation.x = THREE.MathUtils.lerp(p.headPivot.rotation.x, headRotX, k);
  p.headPivot.rotation.y = THREE.MathUtils.lerp(p.headPivot.rotation.y, headRotY, k);
  p.headPivot.rotation.z = THREE.MathUtils.lerp(p.headPivot.rotation.z, headRotZ, k);

  p.leftArmPivot.rotation.x = THREE.MathUtils.lerp(p.leftArmPivot.rotation.x, lArmX, k);
  p.leftArmPivot.rotation.z = THREE.MathUtils.lerp(p.leftArmPivot.rotation.z, lArmZ, k);
  p.rightArmPivot.rotation.x = THREE.MathUtils.lerp(p.rightArmPivot.rotation.x, rArmX, k);
  p.rightArmPivot.rotation.z = THREE.MathUtils.lerp(p.rightArmPivot.rotation.z, rArmZ, k);
  p.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(p.leftForearmPivot.rotation.x, lForeX, k);
  p.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(p.rightForearmPivot.rotation.x, rForeX, k);

  p.leftLegPivot.rotation.x = THREE.MathUtils.lerp(p.leftLegPivot.rotation.x, lLegX, k);
  p.rightLegPivot.rotation.x = THREE.MathUtils.lerp(p.rightLegPivot.rotation.x, rLegX, k);
  p.leftKneePivot.rotation.x = THREE.MathUtils.lerp(p.leftKneePivot.rotation.x, lKneeX, k);
  p.rightKneePivot.rotation.x = THREE.MathUtils.lerp(p.rightKneePivot.rotation.x, rKneeX, k);

  // Secondary hair, wing, and tail motion
  if (p.ponytailPivot) {
    p.ponytailPivot.rotation.z = Math.sin(t * 3.4) * 0.08;
    p.ponytailPivot.rotation.x = Math.cos(t * 2.6) * 0.06;
  }
  if (p.leftWingPivot && p.rightWingPivot) {
    const flapSpeed = animation === 'Jump' || animation === 'Dance' ? 10 : 3.2;
    const flap = Math.sin(t * flapSpeed) * 0.28;
    p.leftWingPivot.rotation.y = flap;
    p.rightWingPivot.rotation.y = -flap;
  }
  if (p.tailPivot) {
    p.tailPivot.rotation.y = Math.sin(t * 5) * 0.25;
  }

  // Facial Expressions (Brows, Eye Blink, Mouth + Lip-Sync)
  const blinkCycle = (t * 0.7) % 4.0;
  const eyeScaleY = blinkCycle > 3.86 ? 0.14 : 1.0;
  const baseEyeScaleY = expression === 'Surprised' ? 1.18 : 1.0;
  p.leftEye.scale.y = baseEyeScaleY * eyeScaleY * 1.08;
  p.rightEye.scale.y = baseEyeScaleY * eyeScaleY * 1.08;

  let browZ = 0;
  let browYOff = 0;
  if (expression === 'Sad') {
    browZ = 0.22;
  } else if (expression === 'Angry') {
    browZ = -0.26;
    browYOff = -0.012;
  } else if (expression === 'Surprised') {
    browYOff = 0.025;
  }
  p.leftBrow.rotation.z = THREE.MathUtils.lerp(p.leftBrow.rotation.z, browZ, k);
  p.rightBrow.rotation.z = THREE.MathUtils.lerp(p.rightBrow.rotation.z, -browZ, k);
  p.leftBrow.position.y += (browYOff * 0.05);
  p.rightBrow.position.y += (browYOff * 0.05);
  // Clamp brow offset gently without drifting
  if (p.leftBrow.userData.baseY === undefined) {
    p.leftBrow.userData.baseY = p.leftBrow.position.y;
    p.rightBrow.userData.baseY = p.rightBrow.position.y;
  }
  p.leftBrow.position.y = THREE.MathUtils.lerp(
    p.leftBrow.position.y,
    (p.leftBrow.userData.baseY as number) + browYOff,
    k
  );
  p.rightBrow.position.y = THREE.MathUtils.lerp(
    p.rightBrow.position.y,
    (p.rightBrow.userData.baseY as number) + browYOff,
    k
  );

  // Mouth animation: lip-sync / talk / laugh / surprised
  const isSpeaking =
    animation === 'Talk (Lip-Sync)' || autoLipSyncActive || lipSyncLevel > 0.05;
  let targetMouthScaleY = 0.36;
  let targetMouthScaleX = 1.12;
  if (isSpeaking) {
    const open =
      lipSyncLevel >= 0
        ? THREE.MathUtils.clamp(lipSyncLevel * 1.8, 0.15, 1.0)
        : Math.abs(Math.sin(t * 14)) * 0.85;
    targetMouthScaleY = 0.36 + open * 0.92;
    targetMouthScaleX = 1.12 - open * 0.18;
  } else if (animation === 'Laugh') {
    targetMouthScaleY = 0.85 + Math.abs(Math.sin(t * 11)) * 0.35;
    targetMouthScaleX = 1.24;
  } else if (expression === 'Surprised') {
    targetMouthScaleY = 0.95;
    targetMouthScaleX = 0.85;
  } else if (animation === 'Cry' || expression === 'Sad') {
    targetMouthScaleY = 0.42;
    targetMouthScaleX = 0.92;
  }

  p.mouthMesh.scale.y = THREE.MathUtils.lerp(p.mouthMesh.scale.y, targetMouthScaleY, Math.min(1, k * 1.8));
  p.mouthMesh.scale.x = THREE.MathUtils.lerp(p.mouthMesh.scale.x, targetMouthScaleX, Math.min(1, k * 1.8));
}

export function disposeCharacterRig(rig: CharacterRig): void {
  const mat = rig.speechSprite.material as THREE.SpriteMaterial;
  if (mat.map) {
    mat.map.dispose();
  }
  rig.root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.geometry && !m.geometry.userData?.sharedResource) {
      m.geometry.dispose();
    }
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mt) => {
      if (!mt || mt.userData?.sharedResource) return;
      const std = mt as THREE.MeshStandardMaterial;
      if (std.map && !std.map.userData?.sharedResource) std.map.dispose();
      mt.dispose();
    });
  });
}
