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
  createCartoonOutline,
  createChibiFaceTexture,
  createContactShadowTexture,
  createEyeIrisTexture,
  createSpeechBubbleTexture,
  getSharedFabricTexture,
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

function makeRoundedBox(w: number, h: number, d: number, r = 0.05): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = Math.max(0.01, w / 2 - r);
  const hh = Math.max(0.01, h / 2 - r);
  shape.moveTo(-hw, -hh - r);
  shape.lineTo(hw, -hh - r);
  shape.quadraticCurveTo(hw + r, -hh - r, hw + r, -hh);
  shape.lineTo(hw + r, hh);
  shape.quadraticCurveTo(hw + r, hh + r, hw, hh + r);
  shape.lineTo(-hw, hh + r);
  shape.quadraticCurveTo(-hw - r, hh + r, -hw - r, hh);
  shape.lineTo(-hw - r, -hh);
  shape.quadraticCurveTo(-hw - r, -hh - r, -hw, -hh - r);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, d - r * 2),
    bevelEnabled: true,
    bevelSegments: 6,
    curveSegments: 12,
    steps: 1,
    bevelSize: r,
    bevelThickness: r,
  });
  geo.center();
  return geo;
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

function addOutline(mesh: THREE.Mesh, thickness = 1.022, colorHex = 0x2a1810): void {
  mesh.add(createCartoonOutline(mesh, thickness, colorHex));
}

function createCrownMesh(isTiara: boolean): THREE.Group {
  const crown = new THREE.Group();
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    metalness: 0.85,
    roughness: 0.18,
    clearcoat: 0.65,
  });
  const gemMat = new THREE.MeshPhysicalMaterial({
    color: isTiara ? 0xec4899 : 0xef4444,
    emissive: isTiara ? 0xdb2777 : 0xb91c1c,
    emissiveIntensity: 0.4,
    roughness: 0.12,
    clearcoat: 0.9,
  });

  const rad = isTiara ? 0.18 : 0.22;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(rad * 1.05, rad, isTiara ? 0.07 : 0.1, 32, 1, true),
    goldMat
  );
  crown.add(band);

  const count = isTiara ? 3 : 5;
  for (let i = 0; i < count; i++) {
    const angle = isTiara
      ? -0.7 + (i / (count - 1)) * 1.4
      : (i / count) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.036, isTiara ? 0.09 : 0.11, 20), goldMat);
    spike.position.set(Math.sin(angle) * rad, isTiara ? 0.07 : 0.09, Math.cos(angle) * rad);
    crown.add(spike);
  }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.044, 1), gemMat);
  gem.position.set(0, 0.04, rad + 0.01);
  crown.add(gem);
  return crown;
}

function createHumanoidCharacter(
  kind: Exclude<CharacterKind, 'robot'>,
  accentColor: string
): CharacterRig {
  const root = new THREE.Group();
  const accentMeshes: THREE.Mesh[] = [];

  const isAdult = [
    'woman',
    'father',
    'mother',
    'teacher',
    'farmer',
    'doctor',
    'police',
    'chef',
    'grandpa',
    'grandma',
    'king',
    'queen',
    'witch',
    'wizard',
    'superhero',
    'angel',
  ].includes(kind);

  const isYoungKid = ['kid', 'son', 'daughter', 'twins'].includes(kind);
  const isFemale = [
    'girl',
    'woman',
    'mother',
    'daughter',
    'grandma',
    'queen',
    'princess',
    'fairy',
    'angel',
    'witch',
  ].includes(kind);
  const isElder = kind === 'grandpa' || kind === 'grandma' || kind === 'wizard';
  const hasSkirtOrGown = [
    'girl',
    'woman',
    'mother',
    'daughter',
    'grandma',
    'queen',
    'princess',
    'fairy',
    'witch',
  ].includes(kind);

  const skinColor =
    kind === 'witch'
      ? 0xd9f99d
      : kind === 'farmer'
        ? 0xe2a882
        : isFemale
          ? 0xfad2b8
          : 0xf4c2a1;

  const pantsColor =
    kind === 'police'
      ? 0x0f172a
      : kind === 'chef'
        ? 0x334155
        : kind === 'farmer'
          ? 0x1d4ed8
          : kind === 'doctor'
            ? 0x0f766e
            : kind === 'angel'
              ? 0xf1f5f9
              : kind === 'superhero'
                ? 0x1d4ed8
                : 0x1e293b;

  const hairColor = isElder
    ? 0xe2e8f0
    : kind === 'witch'
      ? 0x1e1b4b
      : isFemale
        ? 0x5a2d18
        : 0x3b2314;

  const shoeColor = isAdult ? 0x1f2937 : 0xf8fafc;

  const fabricTex = getSharedFabricTexture();

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: skinColor,
    roughness: 0.56,
    metalness: 0.02,
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
  });
  const shirtMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    map: fabricTex,
    roughness: 0.65,
    metalness: 0.02,
    clearcoat: 0.35,
    clearcoatRoughness: 0.32,
    sheen: 0.35,
    sheenRoughness: 0.65,
  });
  const pantsMat = new THREE.MeshPhysicalMaterial({
    color: pantsColor,
    map: fabricTex,
    roughness: 0.7,
    metalness: 0.02,
    clearcoat: 0.35,
    clearcoatRoughness: 0.36,
    sheen: 0.25,
    sheenRoughness: 0.72,
  });
  const hairMat = new THREE.MeshPhysicalMaterial({
    color: hairColor,
    roughness: 0.35,
    metalness: 0.04,
    clearcoat: 0.35,
    clearcoatRoughness: 0.26,
  });
  const shoeMat = new THREE.MeshPhysicalMaterial({
    color: shoeColor,
    roughness: 0.3,
    metalness: 0.08,
    clearcoat: 0.5,
    clearcoatRoughness: 0.22,
  });
  const darkMat = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    roughness: 0.26,
    metalness: 0.08,
    clearcoat: 0.3,
  });
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.04,
    clearcoat: 0.45,
  });
  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: 0x7f1d1d,
    roughness: 0.32,
    metalness: 0.02,
  });

  const scaleFactor = isYoungKid ? 0.88 : isAdult ? 1.12 : 0.98;
  const legLen = 0.56 * scaleFactor;
  const torsoH = 0.55 * scaleFactor;
  const baseBodyY = legLen;

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;
  root.add(bodyPivot);

  // Pelvis + Waist Belt
  const pelvis = new THREE.Mesh(
    makeRoundedBox(0.39 * scaleFactor, 0.15 * scaleFactor, 0.26 * scaleFactor, 0.06),
    pantsMat
  );
  pelvis.position.y = 0.04 * scaleFactor;
  addOutline(pelvis, 1.025);
  bodyPivot.add(pelvis);

  const belt = new THREE.Mesh(
    makeRoundedBox(0.41 * scaleFactor, 0.05 * scaleFactor, 0.27 * scaleFactor, 0.02),
    darkMat
  );
  belt.position.y = 0.095 * scaleFactor;
  const beltBuckle = new THREE.Mesh(
    makeRoundedBox(0.08 * scaleFactor, 0.055 * scaleFactor, 0.035 * scaleFactor, 0.01),
    new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.78, roughness: 0.22, clearcoat: 0.6 })
  );
  beltBuckle.position.set(0, 0.095 * scaleFactor, 0.132 * scaleFactor);
  bodyPivot.add(belt, beltBuckle);

  // Torso material override for Doctor / Chef / Angel
  const torsoMat =
    kind === 'doctor' || kind === 'chef' || kind === 'angel'
      ? new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, map: fabricTex, roughness: 0.72, sheen: 0.3 })
      : shirtMat;

  const torso = new THREE.Mesh(
    makeRoundedBox(0.43 * scaleFactor, torsoH, 0.28 * scaleFactor, 0.085),
    torsoMat
  );
  torso.position.y = 0.08 * scaleFactor + torsoH / 2;
  addOutline(torso, 1.025);
  bodyPivot.add(torso);
  if (kind !== 'doctor' && kind !== 'chef' && kind !== 'angel') {
    accentMeshes.push(torso);
  }

  // Collar neck trim on tees
  const collarTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.115 * scaleFactor, 0.022 * scaleFactor, 16, 32),
    torsoMat
  );
  collarTrim.rotation.x = Math.PI / 2;
  collarTrim.position.set(0, 0.085 * scaleFactor + torsoH, 0.01);
  bodyPivot.add(collarTrim);

  // Skirt / Gown / Robe
  if (hasSkirtOrGown || kind === 'wizard') {
    const isLongGown = ['queen', 'princess', 'witch', 'wizard'].includes(kind);
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.215 * scaleFactor,
        (isLongGown ? 0.37 : 0.32) * scaleFactor,
        (isLongGown ? 0.48 : 0.28) * scaleFactor,
        36
      ),
      shirtMat
    );
    skirt.position.y = (isLongGown ? -0.1 : 0.02) * scaleFactor;
    addOutline(skirt, 1.025);
    bodyPivot.add(skirt);
    accentMeshes.push(skirt);
  }

  // Role-specific outfit details
  if (kind === 'teacher' || kind === 'father') {
    const tieGeo = new THREE.ConeGeometry(0.05 * scaleFactor, 0.32 * scaleFactor, 4);
    tieGeo.rotateX(Math.PI);
    const tie = new THREE.Mesh(
      tieGeo,
      new THREE.MeshPhysicalMaterial({ color: 0xdc2626, map: fabricTex, roughness: 0.55 })
    );
    tie.position.set(0, 0.36 * scaleFactor, 0.14 * scaleFactor);
    bodyPivot.add(tie);
  } else if (kind === 'farmer') {
    const bib = new THREE.Mesh(
      makeRoundedBox(0.28 * scaleFactor, 0.32 * scaleFactor, 0.06 * scaleFactor, 0.02),
      pantsMat
    );
    bib.position.set(0, 0.28 * scaleFactor, 0.12 * scaleFactor);
    const bandana = new THREE.Mesh(
      new THREE.TorusGeometry(0.14 * scaleFactor, 0.032 * scaleFactor, 8, 16),
      new THREE.MeshPhysicalMaterial({ color: 0xef4444, map: fabricTex, roughness: 0.65 })
    );
    bandana.rotation.x = Math.PI / 2.2;
    bandana.position.set(0, 0.1 * scaleFactor + torsoH, 0.02);
    bodyPivot.add(bib, bandana);
  } else if (kind === 'doctor') {
    const scrub = new THREE.Mesh(
      makeRoundedBox(0.18 * scaleFactor, 0.3 * scaleFactor, 0.06 * scaleFactor, 0.02),
      shirtMat
    );
    scrub.position.set(0, 0.44 * scaleFactor, 0.12 * scaleFactor);
    const stethMat = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.65, clearcoat: 0.5 });
    const stethRing = new THREE.Mesh(new THREE.TorusGeometry(0.15 * scaleFactor, 0.022, 8, 18), stethMat);
    stethRing.rotation.x = Math.PI / 2.6;
    stethRing.position.set(0, 0.56 * scaleFactor, 0.05);
    const chestDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045 * scaleFactor, 0.045 * scaleFactor, 0.02, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.18, clearcoat: 0.7 })
    );
    chestDisc.rotation.x = Math.PI / 2;
    chestDisc.position.set(0.08 * scaleFactor, 0.36 * scaleFactor, 0.15 * scaleFactor);
    bodyPivot.add(scrub, stethRing, chestDisc);
    accentMeshes.push(scrub);
  } else if (kind === 'police') {
    const badge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.055 * scaleFactor, 0),
      new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.18, clearcoat: 0.7 })
    );
    badge.position.set(0.11 * scaleFactor, 0.45 * scaleFactor, 0.145 * scaleFactor);
    bodyPivot.add(badge);
  } else if (kind === 'chef') {
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.14 * scaleFactor, 0.032 * scaleFactor, 8, 16),
      shirtMat
    );
    scarf.rotation.x = Math.PI / 2.2;
    scarf.position.set(0, 0.1 * scaleFactor + torsoH, 0.02);
    const apron = new THREE.Mesh(
      makeRoundedBox(0.32 * scaleFactor, 0.44 * scaleFactor, 0.04 * scaleFactor, 0.02),
      whiteMat
    );
    apron.position.set(0, 0.14 * scaleFactor, 0.135 * scaleFactor);
    bodyPivot.add(scarf, apron);
    accentMeshes.push(scarf);
  } else if (['king', 'queen', 'prince', 'princess', 'superhero', 'witch'].includes(kind)) {
    if (['king', 'queen', 'superhero', 'witch'].includes(kind)) {
      const capeMat = new THREE.MeshPhysicalMaterial({
        color: kind === 'superhero' ? 0xfacc15 : kind === 'witch' ? 0x1e1b4b : 0x991b1b,
        map: fabricTex,
        roughness: 0.68,
        sheen: 0.4,
        side: THREE.DoubleSide,
      });
      const cape = new THREE.Mesh(
        new THREE.BoxGeometry(0.46 * scaleFactor, 0.76 * scaleFactor, 0.04 * scaleFactor),
        capeMat
      );
      cape.position.set(0, 0.28 * scaleFactor, -0.17 * scaleFactor);
      cape.rotation.x = 0.12;
      addOutline(cape, 1.03);
      bodyPivot.add(cape);
    }
    if (kind === 'superhero') {
      const emblem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09 * scaleFactor, 0.09 * scaleFactor, 0.04, 5),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.4, clearcoat: 0.6 })
      );
      emblem.rotation.x = Math.PI / 2;
      emblem.position.set(0, 0.44 * scaleFactor, 0.145 * scaleFactor);
      bodyPivot.add(emblem);
    } else if (kind === 'prince') {
      const sash = new THREE.Mesh(
        new THREE.BoxGeometry(0.08 * scaleFactor, 0.56 * scaleFactor, 0.28 * scaleFactor),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, roughness: 0.4, clearcoat: 0.35 })
      );
      sash.position.set(0, 0.36 * scaleFactor, 0);
      sash.rotation.z = 0.42;
      bodyPivot.add(sash);
    }
  } else {
    const pocket = new THREE.Mesh(
      makeRoundedBox(0.22 * scaleFactor, 0.14 * scaleFactor, 0.055 * scaleFactor, 0.02),
      shirtMat
    );
    pocket.position.set(0, 0.23 * scaleFactor, 0.13 * scaleFactor);
    bodyPivot.add(pocket);
    accentMeshes.push(pocket);
  }

  // Adventure Backpacks with Dual Straps & Buckles (Boys, Girls, Kids, Teenager, Twins)
  if (['boy', 'girl', 'teenager', 'kid', 'son', 'daughter', 'twins'].includes(kind)) {
    const packColor = isFemale ? 0x7c3aed : 0xea580c;
    const strapColor = isFemale ? 0x5b21b6 : 0xf59e0b;
    const packMat = new THREE.MeshPhysicalMaterial({
      color: packColor,
      map: fabricTex,
      roughness: 0.65,
      sheen: 0.3,
    });
    const strapMat = new THREE.MeshPhysicalMaterial({
      color: strapColor,
      roughness: 0.52,
    });
    const buckleMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.75,
      roughness: 0.22,
      clearcoat: 0.6,
    });

    const packBody = new THREE.Mesh(
      makeRoundedBox(0.36 * scaleFactor, 0.42 * scaleFactor, 0.19 * scaleFactor, 0.06),
      packMat
    );
    packBody.position.set(0, 0.35 * scaleFactor, -0.21 * scaleFactor);
    addOutline(packBody, 1.025);

    const packPocket = new THREE.Mesh(
      makeRoundedBox(0.28 * scaleFactor, 0.18 * scaleFactor, 0.07 * scaleFactor, 0.03),
      strapMat
    );
    packPocket.position.set(0, 0.24 * scaleFactor, -0.3 * scaleFactor);
    addOutline(packPocket, 1.025);

    bodyPivot.add(packBody, packPocket);

    [-1, 1].forEach((s) => {
      const strapFront = new THREE.Mesh(
        makeRoundedBox(0.055 * scaleFactor, 0.38 * scaleFactor, 0.035 * scaleFactor, 0.015),
        strapMat
      );
      strapFront.position.set(s * 0.135 * scaleFactor, 0.38 * scaleFactor, 0.138 * scaleFactor);
      const strapTop = new THREE.Mesh(
        makeRoundedBox(0.055 * scaleFactor, 0.04 * scaleFactor, 0.3 * scaleFactor, 0.015),
        strapMat
      );
      strapTop.position.set(s * 0.135 * scaleFactor, 0.58 * scaleFactor, -0.02 * scaleFactor);
      const buckle = new THREE.Mesh(
        makeRoundedBox(0.064 * scaleFactor, 0.046 * scaleFactor, 0.044 * scaleFactor, 0.008),
        buckleMat
      );
      buckle.position.set(s * 0.135 * scaleFactor, 0.36 * scaleFactor, 0.145 * scaleFactor);
      bodyPivot.add(strapFront, strapTop, buckle);
    });
  }

  // Fairy & Angel Wings
  let leftWingPivot: THREE.Group | undefined;
  let rightWingPivot: THREE.Group | undefined;
  if (kind === 'fairy' || kind === 'angel') {
    const isFairy = kind === 'fairy';
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: isFairy ? 0xa5f3fc : 0xffffff,
      emissive: isFairy ? 0x38bdf8 : 0xe2e8f0,
      emissiveIntensity: isFairy ? 0.55 : 0.25,
      transparent: isFairy,
      opacity: isFairy ? 0.8 : 1,
      roughness: 0.2,
      clearcoat: 0.7,
      side: THREE.DoubleSide,
    });
    const makeWing = (side: -1 | 1) => {
      const wp = new THREE.Group();
      wp.position.set(side * 0.1 * scaleFactor, 0.45 * scaleFactor, -0.14 * scaleFactor);
      const upperWing = new THREE.Mesh(
        new THREE.SphereGeometry(0.26 * scaleFactor, 32, 24),
        wingMat
      );
      upperWing.scale.set(1.4, 0.95, 0.14);
      upperWing.position.set(side * 0.34 * scaleFactor, 0.12 * scaleFactor, -0.04);
      upperWing.rotation.z = side * 0.35;
      const lowerWing = new THREE.Mesh(
        new THREE.SphereGeometry(0.18 * scaleFactor, 24, 18),
        wingMat
      );
      lowerWing.scale.set(1.15, 0.8, 0.12);
      lowerWing.position.set(side * 0.25 * scaleFactor, -0.14 * scaleFactor, -0.04);
      lowerWing.rotation.z = side * -0.25;
      wp.add(upperWing, lowerWing);
      bodyPivot.add(wp);
      return wp;
    };
    leftWingPivot = makeWing(-1);
    rightWingPivot = makeWing(1);
  }

  // Head Pivot (High-Detail Chibi-Pixar Proportioned Head + 1024x1024 Hand-Painted Face Texture)
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.085 * scaleFactor + torsoH;
  bodyPivot.add(headPivot);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078 * scaleFactor, 0.098 * scaleFactor, 0.12 * scaleFactor, 32),
    skinMat
  );
  neck.position.y = 0.05 * scaleFactor;
  headPivot.add(neck);

  const irisHex =
    isFemale
      ? '#16a34a' // Emerald green
      : kind === 'twins' || kind === 'police' || kind === 'angel' || kind === 'superhero' || kind === 'doctor'
        ? '#0284c7' // Sky blue
        : '#d97706'; // Warm golden amber
  const hasFreckles = ['boy', 'girl', 'kid', 'son', 'daughter', 'twins'].includes(kind);
  const faceTex = createChibiFaceTexture(skinColor, irisHex, hasFreckles, isFemale);
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: faceTex,
    roughness: 0.44,
    metalness: 0.02,
    clearcoat: 0.22,
    clearcoatRoughness: 0.4,
  });

  const headRadius = 0.335 * scaleFactor;
  const headUnitScale = headRadius / 0.55;
  const headCenterY = 0.08 + headRadius;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), faceMat);
  head.scale.set(1.0 * headUnitScale, 1.03 * headUnitScale, 1.04 * headUnitScale);
  head.rotation.y = -Math.PI / 2; // Maps u=0.5 (x=512 of 1024px face texture) directly onto +Z face
  head.position.y = headCenterY;
  addOutline(head, 1.022, 0x2a1810);
  headPivot.add(head);

  const earGeo = new THREE.SphereGeometry(0.062 * scaleFactor, 32, 24);
  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.scale.set(0.72, 1.0, 0.85);
  leftEar.position.set(-headRadius * 1.01, headCenterY - 0.01 * scaleFactor, 0);
  addOutline(leftEar, 1.028, 0x2a1810);
  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.scale.set(0.72, 1.0, 0.85);
  rightEar.position.set(headRadius * 1.01, headCenterY - 0.01 * scaleFactor, 0);
  addOutline(rightEar, 1.028, 0x2a1810);
  headPivot.add(leftEar, rightEar);

  // Cute sculpted 3D button nose matching painted nose shading
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036 * scaleFactor, 32, 24), skinMat);
  nose.scale.set(1.08, 0.86, 0.92);
  nose.position.set(0, headCenterY - headRadius * 0.075, headRadius * 1.025);
  headPivot.add(nose);

  // Glossy 3D Cornea Specular Domes aligned cleanly over the 1024px painted irises
  const eyeY = headCenterY + headRadius * 0.095;
  const eyeZ = headRadius * 0.96;
  const eyeX = headRadius * 0.345;
  const corneaGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.14,
    roughness: 0.02,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    depthWrite: false,
  });
  const leftCornea = new THREE.Mesh(new THREE.SphereGeometry(0.058 * scaleFactor, 32, 24), corneaGlassMat);
  leftCornea.scale.set(0.95, 1.08, 0.28);
  leftCornea.position.set(-eyeX, eyeY, eyeZ);
  const rightCornea = new THREE.Mesh(new THREE.SphereGeometry(0.058 * scaleFactor, 32, 24), corneaGlassMat);
  rightCornea.scale.set(0.95, 1.08, 0.28);
  rightCornea.position.set(eyeX, eyeY, eyeZ);
  headPivot.add(leftCornea, rightCornea);

  // Thick Sculpted Curved 3D Eyebrows (animated cleanly by facial expression system)
  const browGeo = new THREE.TorusGeometry(0.058 * scaleFactor, 0.015 * scaleFactor, 16, 32, Math.PI * 0.68);
  browGeo.rotateZ(Math.PI * 0.16);
  const leftBrow = new THREE.Mesh(browGeo, hairMat);
  leftBrow.position.set(-eyeX, eyeY + 0.045 * scaleFactor, eyeZ - 0.005 * scaleFactor);
  const rightBrow = new THREE.Mesh(browGeo, hairMat);
  rightBrow.position.set(eyeX, eyeY + 0.045 * scaleFactor, eyeZ - 0.005 * scaleFactor);
  headPivot.add(leftBrow, rightBrow);

  // Expressive Animated 3D Lips & Open Smile Mouth (with pearly teeth & pink tongue depth)
  const mouthGeo = makeRoundedBox(0.115 * scaleFactor, 0.04 * scaleFactor, 0.036 * scaleFactor, 0.014);
  const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
  mouthMesh.position.set(0, headCenterY - headRadius * 0.34, headRadius * 0.945);

  const lipMat = new THREE.MeshPhysicalMaterial({
    color: isFemale ? 0xf43f5e : 0xe07a6c,
    roughness: 0.35,
    clearcoat: 0.35,
  });
  const upperLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.052 * scaleFactor, 0.009 * scaleFactor, 12, 24, Math.PI),
    lipMat
  );
  upperLip.position.set(0, 0.012 * scaleFactor, 0.01 * scaleFactor);
  const lowerLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.05 * scaleFactor, 0.01 * scaleFactor, 12, 24, Math.PI),
    lipMat
  );
  lowerLip.rotation.z = Math.PI;
  lowerLip.position.set(0, -0.01 * scaleFactor, 0.01 * scaleFactor);

  const upperTeeth = new THREE.Mesh(
    makeRoundedBox(0.088 * scaleFactor, 0.014 * scaleFactor, 0.024 * scaleFactor, 0.005),
    whiteMat
  );
  upperTeeth.position.set(0, 0.01 * scaleFactor, 0.012 * scaleFactor);
  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.032 * scaleFactor, 24, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, roughness: 0.32 })
  );
  tongue.scale.set(1.15, 0.45, 0.75);
  tongue.position.set(0, -0.008 * scaleFactor, 0.012 * scaleFactor);
  mouthMesh.add(upperLip, lowerLip, upperTeeth, tongue);
  headPivot.add(mouthMesh);

  // Layered Sculpted 3D Hair Crown + Curved Hair Tufts & Bangs
  const hairTop = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 1.06, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  hairTop.position.y = headCenterY + 0.01 * scaleFactor;
  addOutline(hairTop, 1.025, 0x2a1810);
  headPivot.add(hairTop);

  // Back hair shell so hair covers crown cleanly
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 1.045, 36, 28, Math.PI * 0.72, Math.PI * 1.56, Math.PI * 0.2, Math.PI * 0.55),
    hairMat
  );
  hairBack.position.y = headCenterY;
  headPivot.add(hairBack);

  const addSpikyTufts = (count: number, yBase: number, zBase: number, tilt = 0.45) => {
    for (let i = 0; i < count; i++) {
      const frac = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.06 * scaleFactor, 0.17 * scaleFactor, 24),
        hairMat
      );
      tuft.scale.set(1.15, 1.0, 0.72);
      tuft.position.set(frac * 0.19 * scaleFactor, yBase, zBase - Math.abs(frac) * 0.045 * scaleFactor);
      tuft.rotation.x = tilt;
      tuft.rotation.z = -frac * 0.55;
      addOutline(tuft, 1.025, 0x2a1810);
      headPivot.add(tuft);
    }
  };

  let ponytailPivot: THREE.Group | undefined;

  // Headgear / Hairstyles / Facial Hair
  if (kind === 'boy' || kind === 'son' || kind === 'kid' || kind === 'twins') {
    addSpikyTufts(5, headCenterY + 0.095 * scaleFactor, headRadius * 0.9, 0.72);

    // Two-Tone Tricolor Baseball Cap (36-48 seg glossy fabric)
    const redCapMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      map: fabricTex,
      roughness: 0.38,
      clearcoat: 0.4,
    });

    const capBack = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.1, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.44),
      shirtMat
    );
    capBack.position.set(0, headCenterY + 0.05 * scaleFactor, -0.015 * scaleFactor);
    capBack.rotation.x = -0.14;
    addOutline(capBack, 1.025, 0x2a1810);

    const capWhiteFront = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.106, 36, 24, -0.7, 1.4, 0.08, Math.PI * 0.36),
      whiteMat
    );
    capWhiteFront.position.set(0, headCenterY + 0.05 * scaleFactor, -0.005 * scaleFactor);
    capWhiteFront.rotation.y = Math.PI / 2;
    capWhiteFront.rotation.z = 0.14;

    const capBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.255 * scaleFactor, 0.275 * scaleFactor, 0.032, 36, 1, false, -0.85, 1.7),
      redCapMat
    );
    capBrim.position.set(0, headCenterY + 0.115 * scaleFactor, 0.14 * scaleFactor);
    capBrim.rotation.x = 0.16;
    addOutline(capBrim, 1.025, 0x2a1810);

    const capButton = new THREE.Mesh(new THREE.SphereGeometry(0.032 * scaleFactor, 24, 16), redCapMat);
    capButton.position.set(0, headCenterY + headRadius * 1.11, -0.02 * scaleFactor);

    headPivot.add(capBack, capWhiteFront, capBrim, capButton);
    accentMeshes.push(capBack);
  } else if (kind === 'teenager') {
    addSpikyTufts(4, headCenterY + 0.095 * scaleFactor, headRadius * 0.88, 0.68);
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.09, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.46),
      shirtMat
    );
    beanie.position.set(0, headCenterY + 0.045 * scaleFactor, -0.02);
    addOutline(beanie, 1.025, 0x2a1810);
    const band = new THREE.Mesh(new THREE.TorusGeometry(headRadius * 1.12, 0.024, 16, 36, Math.PI), darkMat);
    band.position.y = headCenterY + 0.035 * scaleFactor;
    headPivot.add(beanie, band);
    accentMeshes.push(beanie);
  } else if (kind === 'girl' || kind === 'daughter') {
    addSpikyTufts(4, headCenterY + 0.09 * scaleFactor, headRadius * 0.88, 0.78);

    // Animated flowing ponytail + cute side braid accents
    ponytailPivot = new THREE.Group();
    ponytailPivot.position.set(headRadius * 0.72, headCenterY + 0.05 * scaleFactor, -headRadius * 0.76);

    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.055 * scaleFactor, 0.022, 16, 32), shirtMat);
    tie.rotation.y = Math.PI / 3;
    const tailUpper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.088 * scaleFactor, 0.25 * scaleFactor, 16, 32),
      hairMat
    );
    tailUpper.position.set(0.07 * scaleFactor, -0.14 * scaleFactor, -0.08 * scaleFactor);
    tailUpper.rotation.z = 0.32;
    tailUpper.rotation.x = 0.22;
    addOutline(tailUpper, 1.025, 0x2a1810);

    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.085 * scaleFactor, 0.22 * scaleFactor, 28), hairMat);
    tailTip.position.set(0.13 * scaleFactor, -0.32 * scaleFactor, -0.12 * scaleFactor);
    tailTip.rotation.z = Math.PI + 0.22;
    addOutline(tailTip, 1.025, 0x2a1810);

    ponytailPivot.add(tie, tailUpper, tailTip);
    headPivot.add(ponytailPivot);
    accentMeshes.push(tie);

    if (kind === 'daughter') {
      // Twin sculpted 3D braids framing shoulders
      [-1, 1].forEach((side) => {
        for (let b = 0; b < 4; b++) {
          const bead = new THREE.Mesh(
            new THREE.SphereGeometry((0.055 - b * 0.007) * scaleFactor, 24, 18),
            hairMat
          );
          bead.position.set(
            side * (headRadius * 0.88 + b * 0.015 * scaleFactor),
            headCenterY - (0.04 + b * 0.075) * scaleFactor,
            -0.06 * scaleFactor
          );
          addOutline(bead, 1.025, 0x2a1810);
          headPivot.add(bead);
        }
      });
    }
  } else if (kind === 'woman' || kind === 'mother' || kind === 'grandma') {
    addSpikyTufts(3, headCenterY + 0.09 * scaleFactor, headRadius * 0.88, 0.78);
    const backBun = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scaleFactor, 32, 24), hairMat);
    backBun.position.set(0, headCenterY + 0.05 * scaleFactor, -headRadius * 0.98);
    addOutline(backBun, 1.025, 0x2a1810);
    headPivot.add(backBun);
    if (kind === 'grandma') {
      const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.22, clearcoat: 0.7 });
      const lensGeo = new THREE.TorusGeometry(0.068 * scaleFactor, 0.01, 14, 32);
      const lL = new THREE.Mesh(lensGeo, frameMat);
      lL.position.set(-eyeX, eyeY, eyeZ + 0.025 * scaleFactor);
      const lR = lL.clone();
      lR.position.x = eyeX;
      headPivot.add(lL, lR);
    }
  } else if (kind === 'teacher' || kind === 'grandpa' || kind === 'father') {
    addSpikyTufts(4, headCenterY + 0.09 * scaleFactor, headRadius * 0.88, 0.7);
    if (kind === 'teacher' || kind === 'grandpa') {
      const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.22, metalness: 0.75, clearcoat: 0.6 });
      const lensGeo = new THREE.TorusGeometry(0.072 * scaleFactor, 0.011, 14, 32);
      const leftLens = new THREE.Mesh(lensGeo, frameMat);
      leftLens.position.set(-eyeX, eyeY, eyeZ + 0.025 * scaleFactor);
      const rightLens = new THREE.Mesh(lensGeo, frameMat);
      rightLens.position.set(eyeX, eyeY, eyeZ + 0.025 * scaleFactor);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scaleFactor, 0.014, 0.014), frameMat);
      bridge.position.set(0, eyeY + 0.005, eyeZ + 0.025 * scaleFactor);
      headPivot.add(leftLens, rightLens, bridge);
    }
    if (kind === 'father' || kind === 'grandpa') {
      const stache = new THREE.Mesh(
        makeRoundedBox(0.14 * scaleFactor, 0.035 * scaleFactor, 0.04 * scaleFactor, 0.01),
        hairMat
      );
      stache.position.set(0, headCenterY - headRadius * 0.22, headRadius * 0.99);
      headPivot.add(stache);
    }
  } else if (kind === 'farmer') {
    const strawMat = new THREE.MeshPhysicalMaterial({ color: 0xfde047, map: fabricTex, roughness: 0.65, clearcoat: 0.2 });
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.46 * scaleFactor, 0.48 * scaleFactor, 0.04, 40), strawMat);
    hatBrim.position.y = headCenterY + 0.18 * scaleFactor;
    addOutline(hatBrim, 1.025, 0x2a1810);
    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scaleFactor, 0.27 * scaleFactor, 0.2, 36), strawMat);
    hatCrown.position.y = headCenterY + 0.28 * scaleFactor;
    addOutline(hatCrown, 1.025, 0x2a1810);
    const hatBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.275 * scaleFactor, 0.275 * scaleFactor, 0.05, 36),
      new THREE.MeshPhysicalMaterial({ color: 0xdc2626, roughness: 0.55 })
    );
    hatBand.position.y = headCenterY + 0.21 * scaleFactor;
    headPivot.add(hatBrim, hatCrown, hatBand);
  } else if (kind === 'doctor') {
    addSpikyTufts(4, headCenterY + 0.09 * scaleFactor, headRadius * 0.88, 0.7);
    const band = new THREE.Mesh(new THREE.TorusGeometry(headRadius * 1.04, 0.016, 14, 36), darkMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = headCenterY + 0.14 * scaleFactor;
    const mirror = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075 * scaleFactor, 0.075 * scaleFactor, 0.025, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.1, clearcoat: 0.9 })
    );
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(0, headCenterY + 0.15 * scaleFactor, headRadius * 1.06);
    headPivot.add(band, mirror);
  } else if (kind === 'police') {
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.29 * scaleFactor, 0.25 * scaleFactor, 0.14, 36), pantsMat);
    capTop.position.y = headCenterY + 0.23 * scaleFactor;
    addOutline(capTop, 1.025, 0x2a1810);
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * scaleFactor, 0.26 * scaleFactor, 0.03, 32, 1, false, -0.8, 1.6),
      darkMat
    );
    visor.position.set(0, headCenterY + 0.17 * scaleFactor, 0.12 * scaleFactor);
    const goldBadge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.04 * scaleFactor, 1),
      new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.18, clearcoat: 0.7 })
    );
    goldBadge.position.set(0, headCenterY + 0.24 * scaleFactor, 0.27 * scaleFactor);
    headPivot.add(capTop, visor, goldBadge);
  } else if (kind === 'chef') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scaleFactor, 0.25 * scaleFactor, 0.14, 36), whiteMat);
    band.position.y = headCenterY + 0.22 * scaleFactor;
    addOutline(band, 1.025, 0x2a1810);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scaleFactor, 32, 24), whiteMat);
    puff.scale.set(1.05, 0.85, 1.05);
    puff.position.y = headCenterY + 0.38 * scaleFactor;
    addOutline(puff, 1.025, 0x2a1810);
    headPivot.add(band, puff);
  } else if (kind === 'king' || kind === 'queen' || kind === 'prince' || kind === 'princess') {
    addSpikyTufts(4, headCenterY + 0.09 * scaleFactor, headRadius * 0.88, 0.72);
    const isTiara = kind === 'queen' || kind === 'princess';
    const crown = createCrownMesh(isTiara);
    crown.position.y = headCenterY + 0.24 * scaleFactor;
    headPivot.add(crown);
    if (kind === 'king') {
      const beard = new THREE.Mesh(
        new THREE.ConeGeometry(0.18 * scaleFactor, 0.24 * scaleFactor, 28),
        new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, roughness: 0.55, clearcoat: 0.3 })
      );
      beard.rotation.x = Math.PI;
      beard.position.set(0, headCenterY - 0.16 * scaleFactor, headRadius * 0.78);
      addOutline(beard, 1.025, 0x2a1810);
      headPivot.add(beard);
    }
  } else if (kind === 'angel') {
    addSpikyTufts(4, headCenterY + 0.09 * scaleFactor, headRadius * 0.88, 0.72);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.2 * scaleFactor, 0.025, 16, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.95,
        roughness: 0.12,
        clearcoat: 0.8,
      })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = headCenterY + 0.4 * scaleFactor;
    headPivot.add(halo);
  } else if (kind === 'fairy') {
    addSpikyTufts(4, headCenterY + 0.09 * scaleFactor, headRadius * 0.88, 0.74);
    const wreath = new THREE.Mesh(
      new THREE.TorusGeometry(0.25 * scaleFactor, 0.028, 16, 36),
      new THREE.MeshPhysicalMaterial({ color: 0xf472b6, emissive: 0xec4899, emissiveIntensity: 0.4, clearcoat: 0.5 })
    );
    wreath.rotation.x = Math.PI / 2.3;
    wreath.position.y = headCenterY + 0.19 * scaleFactor;
    headPivot.add(wreath);
  } else if (kind === 'witch' || kind === 'wizard') {
    const hatMat =
      kind === 'witch'
        ? new THREE.MeshPhysicalMaterial({ color: 0x1e1b4b, map: fabricTex, roughness: 0.4, clearcoat: 0.35 })
        : shirtMat;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * scaleFactor, 0.47 * scaleFactor, 0.035, 40), hatMat);
    brim.position.y = headCenterY + 0.19 * scaleFactor;
    addOutline(brim, 1.025, 0x2a1810);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25 * scaleFactor, 0.52 * scaleFactor, 36), hatMat);
    cone.position.y = headCenterY + 0.45 * scaleFactor;
    cone.rotation.z = -0.08;
    addOutline(cone, 1.025, 0x2a1810);
    const buckleBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24 * scaleFactor, 0.25 * scaleFactor, 0.05, 36),
      new THREE.MeshPhysicalMaterial({ color: 0xfacc15, roughness: 0.3, clearcoat: 0.5 })
    );
    buckleBand.position.y = headCenterY + 0.23 * scaleFactor;
    headPivot.add(brim, cone, buckleBand);
    if (kind === 'wizard') {
      const longBeard = new THREE.Mesh(
        new THREE.ConeGeometry(0.2 * scaleFactor, 0.42 * scaleFactor, 28),
        hairMat
      );
      longBeard.rotation.x = Math.PI;
      longBeard.position.set(0, headCenterY - 0.22 * scaleFactor, headRadius * 0.79);
      addOutline(longBeard, 1.025, 0x2a1810);
      headPivot.add(longBeard);
      accentMeshes.push(brim, cone);
    }
  } else if (kind === 'superhero') {
    addSpikyTufts(4, headCenterY + 0.09 * scaleFactor, headRadius * 0.88, 0.72);
    const mask = new THREE.Mesh(
      makeRoundedBox(0.35 * scaleFactor, 0.09 * scaleFactor, 0.05 * scaleFactor, 0.02),
      darkMat
    );
    mask.position.set(0, eyeY, eyeZ + 0.01 * scaleFactor);
    headPivot.add(mask);
  }

  // Arms + Forearms + Adventure Gloved Hands + Hand Mounts (32-segment capsules & spheres)
  const armMat = kind === 'doctor' || kind === 'chef' || kind === 'angel' ? torsoMat : shirtMat;
  const hasGloves = ['boy', 'teenager', 'police', 'superhero', 'twins'].includes(kind);
  const gloveMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.38,
    clearcoat: 0.4,
  });
  const gloveCuffMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    roughness: 0.28,
    metalness: 0.4,
    clearcoat: 0.55,
  });

  const createArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.265 * scaleFactor, 0.04 * scaleFactor + torsoH - 0.06, 0);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.064 * scaleFactor, 0.22 * scaleFactor, 16, 32),
      armMat
    );
    upperArm.position.y = -0.14 * scaleFactor;
    addOutline(upperArm, 1.025);
    shoulder.add(upperArm);
    if (kind !== 'doctor' && kind !== 'chef' && kind !== 'angel') accentMeshes.push(upperArm);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.y = -0.26 * scaleFactor;
    shoulder.add(forearmPivot);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.054 * scaleFactor, 0.2 * scaleFactor, 16, 32),
      kind === 'doctor' || kind === 'chef' || kind === 'angel' ? armMat : skinMat
    );
    forearm.position.y = -0.12 * scaleFactor;
    addOutline(forearm, 1.025);
    forearmPivot.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.068 * scaleFactor, 32, 24),
      hasGloves ? gloveMat : skinMat
    );
    hand.position.y = -0.25 * scaleFactor;
    addOutline(hand, 1.025);
    forearmPivot.add(hand);

    if (hasGloves) {
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062 * scaleFactor, 0.062 * scaleFactor, 0.042 * scaleFactor, 32),
        gloveCuffMat
      );
      cuff.position.y = -0.2 * scaleFactor;
      forearmPivot.add(cuff);
    }

    const handMount = new THREE.Group();
    handMount.position.set(0, -0.26 * scaleFactor, 0.045 * scaleFactor);
    forearmPivot.add(handMount);

    bodyPivot.add(shoulder);
    return { shoulder, forearmPivot, handMount };
  };

  const leftArm = createArm(-1);
  const rightArm = createArm(1);

  // Legs + Adventure Shoes (32-segment capsules & smooth rounded sneakers)
  const hasCargoPockets = ['boy', 'kid', 'son', 'twins', 'teenager'].includes(kind);
  const createLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115 * scaleFactor, 0, 0);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.082 * scaleFactor, 0.34 * scaleFactor, 16, 32),
      pantsMat
    );
    thigh.position.y = -0.24 * scaleFactor;
    addOutline(thigh, 1.025);
    hip.add(thigh);

    if (hasCargoPockets) {
      const pocket = new THREE.Mesh(
        makeRoundedBox(0.045 * scaleFactor, 0.12 * scaleFactor, 0.11 * scaleFactor, 0.015),
        pantsMat
      );
      pocket.position.set(side * 0.072 * scaleFactor, -0.22 * scaleFactor, 0);
      addOutline(pocket, 1.025);
      hip.add(pocket);
    }

    const shoe = new THREE.Mesh(
      makeRoundedBox(0.165 * scaleFactor, 0.115 * scaleFactor, 0.255 * scaleFactor, 0.045),
      shoeMat
    );
    shoe.position.set(0, -legLen + 0.055 * scaleFactor, 0.045 * scaleFactor);
    addOutline(shoe, 1.025);
    hip.add(shoe);

    bodyPivot.add(hip);
    return hip;
  };

  const leftLegPivot = createLeg(-1);
  const rightLegPivot = createLeg(1);

  const headHeight =
    baseBodyY +
    torsoH +
    headRadius * 2 +
    (['king', 'queen', 'witch', 'wizard'].includes(kind) ? 0.65 : 0.44);
  const selectionRing = createSelectionRing();
  const speechSprite = createSpeechSprite(headHeight + 0.58);
  const shadow = createContactShadow(0.48 * scaleFactor);

  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind,
    root,
    bodyPivot,
    headPivot,
    mouthMesh,
    leftBrow,
    rightBrow,
    leftEye: leftCornea,
    rightEye: rightCornea,
    leftArmPivot: leftArm.shoulder,
    rightArmPivot: rightArm.shoulder,
    leftForearmPivot: leftArm.forearmPivot,
    rightForearmPivot: rightArm.forearmPivot,
    leftHandMount: leftArm.handMount,
    rightHandMount: rightArm.handMount,
    leftLegPivot,
    rightLegPivot,
    leftWingPivot,
    rightWingPivot,
    ponytailPivot,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    lastLeftItemSig: 'none',
    lastRightItemSig: 'none',
    leftItemObj: null,
    rightItemObj: null,
    accentMeshes,
    baseBodyY,
    headHeight,
    jumpPhaseOffset: Math.random() * Math.PI * 2,
  };
}

function createRobotCharacter(accentColor: string): CharacterRig {
  const root = new THREE.Group();
  const accentMeshes: THREE.Mesh[] = [];

  // Glossy Chibi Pixar-style Porcelain Robot (matching reference image)
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.16,
    metalness: 0.12,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
  });
  const jointMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.55,
    clearcoat: 0.45,
  });
  const glowMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.1,
    clearcoat: 0.9,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x090f1d,
    roughness: 0.06,
    metalness: 0.6,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const orangeBeakMat = new THREE.MeshPhysicalMaterial({
    color: 0xf97316,
    roughness: 0.25,
    clearcoat: 0.75,
  });

  const baseBodyY = 0.52;
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;
  root.add(bodyPivot);

  const torso = new THREE.Mesh(makeRoundedBox(0.54, 0.54, 0.38, 0.12), shellMat);
  torso.position.y = 0.34;
  addOutline(torso, 1.025, 0x111827);
  bodyPivot.add(torso);

  // Glowing cyan chest core bezel + orb
  const chestBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 36), jointMat);
  chestBezel.rotation.x = Math.PI / 2;
  chestBezel.position.set(0, 0.36, 0.175);
  const chestCore = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.06, 36), glowMat);
  chestCore.rotation.x = Math.PI / 2;
  chestCore.position.set(0, 0.36, 0.18);
  bodyPivot.add(chestBezel, chestCore);
  accentMeshes.push(chestCore);

  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.14, 32), jointMat);
  waist.position.y = 0.06;
  bodyPivot.add(waist);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.64;
  bodyPivot.add(headPivot);

  const headBox = new THREE.Mesh(makeRoundedBox(0.56, 0.42, 0.4, 0.13), shellMat);
  headBox.position.y = 0.23;
  addOutline(headBox, 1.025, 0x111827);
  headPivot.add(headBox);

  const visor = new THREE.Mesh(makeRoundedBox(0.42, 0.22, 0.07, 0.05), visorMat);
  visor.position.set(0, 0.24, 0.175);
  headPivot.add(visor);

  // Side Ear Pods
  [-1, 1].forEach((side) => {
    const earPod = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.06, 32), glowMat);
    earPod.rotation.z = Math.PI / 2;
    earPod.position.set(side * 0.295, 0.23, 0);
    addOutline(earPod, 1.028, 0x111827);
    headPivot.add(earPod);
    accentMeshes.push(earPod);
  });

  // Glowing Cyan Gradient Ring Eyes + Catchlights on Visor
  const robotIrisTex = createEyeIrisTexture('#06b6d4');
  const robotEyeMat = new THREE.MeshPhysicalMaterial({
    map: robotIrisTex,
    emissive: accentColor,
    emissiveMap: robotIrisTex,
    emissiveIntensity: 0.65,
    roughness: 0.06,
    clearcoat: 1.0,
  });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  catchMat.userData.sharedResource = true;

  const makeBotEye = (x: number) => {
    const eg = new THREE.Group();
    eg.position.set(x, 0.25, 0.205);
    const eyeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.062, 32, 24), robotEyeMat);
    eyeSphere.scale.set(1, 1.05, 0.35);
    eyeSphere.rotation.y = -Math.PI / 2;
    const spark1 = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 12), catchMat);
    spark1.position.set(-0.02, 0.024, 0.022);
    const spark2 = new THREE.Mesh(new THREE.SphereGeometry(0.007, 16, 12), catchMat);
    spark2.position.set(0.018, -0.016, 0.021);
    eg.add(eyeSphere, spark1, spark2);
    headPivot.add(eg);
    return eyeSphere;
  };

  const leftEye = makeBotEye(-0.1);
  const rightEye = makeBotEye(0.1);

  const browGeo = new THREE.BoxGeometry(0.09, 0.018, 0.02);
  const leftBrow = new THREE.Mesh(browGeo, glowMat);
  leftBrow.position.set(-0.1, 0.325, 0.212);
  const rightBrow = new THREE.Mesh(browGeo, glowMat);
  rightBrow.position.set(0.1, 0.325, 0.212);

  headPivot.add(leftBrow, rightBrow);
  accentMeshes.push(leftBrow, rightBrow);

  // Cute Orange Smiling Beak Mouth
  const mouthMesh = new THREE.Mesh(makeRoundedBox(0.12, 0.048, 0.04, 0.018), orangeBeakMat);
  mouthMesh.position.set(0, 0.16, 0.205);
  headPivot.add(mouthMesh);

  // Antenna + Glowing Diamond Crystal
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.16, 20), jointMat);
  stem.position.y = 0.51;
  const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), glowMat);
  bulb.position.y = 0.62;
  headPivot.add(stem, bulb);
  accentMeshes.push(bulb);

  const makeRobotArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.33, 0.52, 0);

    shoulder.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 24), jointMat));
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.22, 32), shellMat);
    upper.position.y = -0.14;
    addOutline(upper, 1.025, 0x111827);
    shoulder.add(upper);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.y = -0.26;
    shoulder.add(forearmPivot);

    forearmPivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.062, 24, 18), jointMat));
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.2, 32), shellMat);
    lower.position.y = -0.12;
    addOutline(lower, 1.025, 0x111827);
    forearmPivot.add(lower);

    const claw = new THREE.Mesh(makeRoundedBox(0.12, 0.11, 0.12, 0.04), jointMat);
    claw.position.y = -0.24;
    addOutline(claw, 1.025, 0x111827);
    forearmPivot.add(claw);

    const handMount = new THREE.Group();
    handMount.position.set(0, -0.25, 0.05);
    forearmPivot.add(handMount);

    bodyPivot.add(shoulder);
    return { shoulder, forearmPivot, handMount };
  };

  const leftArm = makeRobotArm(-1);
  const rightArm = makeRobotArm(1);

  const makeRobotLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, 0, 0);

    hip.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 18), jointMat));
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.42, 32), shellMat);
    shin.position.y = -0.24;
    addOutline(shin, 1.025, 0x111827);
    hip.add(shin);

    const foot = new THREE.Mesh(makeRoundedBox(0.18, 0.11, 0.27, 0.04), jointMat);
    foot.position.set(0, -baseBodyY + 0.055, 0.04);
    addOutline(foot, 1.025, 0x111827);
    hip.add(foot);

    bodyPivot.add(hip);
    return hip;
  };

  const leftLegPivot = makeRobotLeg(-1);
  const rightLegPivot = makeRobotLeg(1);

  const headHeight = 1.85;
  const selectionRing = createSelectionRing();
  const speechSprite = createSpeechSprite(headHeight + 0.55);
  const shadow = createContactShadow(0.5);

  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind: 'robot',
    root,
    bodyPivot,
    headPivot,
    mouthMesh,
    leftBrow,
    rightBrow,
    leftEye,
    rightEye,
    leftArmPivot: leftArm.shoulder,
    rightArmPivot: rightArm.shoulder,
    leftForearmPivot: leftArm.forearmPivot,
    rightForearmPivot: rightArm.forearmPivot,
    leftHandMount: leftArm.handMount,
    rightHandMount: rightArm.handMount,
    leftLegPivot,
    rightLegPivot,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    lastLeftItemSig: 'none',
    lastRightItemSig: 'none',
    leftItemObj: null,
    rightItemObj: null,
    accentMeshes,
    baseBodyY,
    headHeight,
    jumpPhaseOffset: Math.random() * Math.PI * 2,
  };
}

export function createCharacterRig(kind: CharacterKind, accentColor: string): CharacterRig {
  if (kind === 'robot') {
    return createRobotCharacter(accentColor);
  }
  return createHumanoidCharacter(kind, accentColor);
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
      bodyY = rig.baseBodyY - 0.28;
      lLegX = -1.38;
      rLegX = -1.38;
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
      lLegX = -air * 0.35;
      rLegX = air * 0.25;
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
      if (m.geometry && !m.userData?.sharedResource) m.geometry.dispose();
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
