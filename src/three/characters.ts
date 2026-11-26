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
  createChibiSkinTexture,
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

// Smooth rounded organic pillow/pouch geometry (zero BoxGeometry)
function makeOrganicPouchGeo(w: number, h: number, d: number, radialSegs = 28): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.5, radialSegs, 22);
  geo.scale(w, h, d);
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Chibi-Pixar head geometry (cached & shared; front face aligns to +X before -PI/2 Y rotation)
let cachedChibiHeadGeo: THREE.BufferGeometry | null = null;
function getChibiHeadGeometry(): THREE.BufferGeometry {
  if (cachedChibiHeadGeo) return cachedChibiHeadGeo;
  const geo = new THREE.SphereGeometry(0.55, 48, 36);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i); // front (+X) to back (-X)
    let y = pos.getY(i); // top (+Y) to chin (-Y)
    let z = pos.getZ(i); // left/right cheeks

    // Gentle chibi cheek wideness below eye line & soft rounded jaw/chin
    if (y < 0.08 && y > -0.45) {
      const cheekWeight = Math.sin(((0.08 - y) / 0.53) * Math.PI);
      z *= 1 + cheekWeight * 0.105;
      if (x > 0) x *= 1 + cheekWeight * 0.038;
    }
    if (y < -0.28) {
      const chinT = Math.min(1, (-0.28 - y) / 0.27);
      y += chinT * 0.04;
    }

    // Subtle recessed eye-socket hollows on front (+X) so 3D eyeballs sit naturally framed
    if (x > 0.24) {
      const dy = y - 0.055;
      const dz = Math.abs(z) - 0.185;
      const socketDistSq = dy * dy + dz * dz;
      if (socketDistSq < 0.028) {
        const falloff = 1 - socketDistSq / 0.028;
        x -= falloff * falloff * 0.046;
      }
    }

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.userData.sharedResource = true;
  cachedChibiHeadGeo = geo;
  return geo;
}

// Smooth tapered LatheGeometry torso silhouette (rounded chest, contoured waist, soft hips)
function makeTaperedTorsoGeo(
  width: number,
  height: number,
  depth: number,
  radialSegments = 36
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.86, 0.05 * height),
    new THREE.Vector2(0.95, 0.22 * height),
    new THREE.Vector2(0.91, 0.48 * height),
    new THREE.Vector2(1.0, 0.78 * height),
    new THREE.Vector2(0.82, 0.94 * height),
    new THREE.Vector2(0.45, 0.99 * height),
    new THREE.Vector2(0, height),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.scale(width * 0.5, 1, depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

// Smooth LatheGeometry pelvis/hip silhouette (36 radial segments)
function makeSculptedPelvisGeo(width: number, height: number, depth: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, -height * 0.5),
    new THREE.Vector2(0.75, -height * 0.42),
    new THREE.Vector2(0.98, -height * 0.12),
    new THREE.Vector2(1.0, height * 0.16),
    new THREE.Vector2(0.92, height * 0.46),
    new THREE.Vector2(0, height * 0.5),
  ];
  const geo = new THREE.LatheGeometry(pts, 36);
  geo.scale(width * 0.5, 1, depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

// Smooth LatheGeometry pleated skirt / flared ballgown with subtle scalloped hem
function makePleatedSkirtGeo(
  topR: number,
  botR: number,
  height: number,
  radialSegments = 42,
  pleatAmp = 0.045
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(topR, botR, height, radialSegments, 6, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.001) {
      const t = Math.max(0, Math.min(1, (height * 0.5 - y) / height)); // 0 top, 1 hem
      const angle = Math.atan2(z, x);
      const flare = 1 + t * t * 0.14 + Math.sin(angle * 10) * pleatAmp * t;
      pos.setXYZ(i, x * flare, y, z * flare);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Flowing curved cape via beveled ExtrudeGeometry curving softly outward behind the back
function makeDrapedCapeGeo(width: number, length: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.34, 0);
  shape.lineTo(width * 0.34, 0);
  shape.quadraticCurveTo(width * 0.48, -length * 0.48, width * 0.56, -length);
  shape.quadraticCurveTo(width * 0.28, -length * 1.06, 0, -length * 0.98);
  shape.quadraticCurveTo(-width * 0.28, -length * 1.06, -width * 0.56, -length);
  shape.quadraticCurveTo(-width * 0.48, -length * 0.48, -width * 0.34, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelSegments: 4,
    curveSegments: 18,
    steps: 4,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  // Curve cape backward along -Z as it drapes down
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const fall = Math.max(0, -y / length);
    const billow = -fall * fall * (width * 0.28) - Math.cos((x / (width * 0.56)) * Math.PI * 0.5) * 0.03;
    pos.setXYZ(i, x, y, z + billow);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Curved baseball cap visor brim via beveled ExtrudeGeometry
function makeCurvedCapVisorGeo(width: number, length: number, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.48, 0);
  shape.quadraticCurveTo(-width * 0.52, length * 0.62, -width * 0.26, length * 0.94);
  shape.quadraticCurveTo(0, length * 1.08, width * 0.26, length * 0.94);
  shape.quadraticCurveTo(width * 0.52, length * 0.62, width * 0.48, 0);
  shape.quadraticCurveTo(0, length * 0.22, -width * 0.48, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 4,
    curveSegments: 18,
    bevelSize: thickness * 0.35,
    bevelThickness: thickness * 0.35,
  });
  geo.rotateX(Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const curveDrop = ((vx * vx) / (width * width * 0.38)) * (thickness * 2.2) + vz * 0.08;
    pos.setY(i, vy - curveDrop);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Butterfly (Fairy) or Feathered (Angel) wing geometry via beveled ExtrudeGeometry
function makeSculptedWingGeo(isFairy: boolean, scaleFactor: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  if (isFairy) {
    // Graceful upper + lower butterfly wing silhouette
    s.moveTo(0, 0);
    s.bezierCurveTo(0.14 * scaleFactor, 0.26 * scaleFactor, 0.46 * scaleFactor, 0.34 * scaleFactor, 0.48 * scaleFactor, 0.14 * scaleFactor);
    s.bezierCurveTo(0.46 * scaleFactor, -0.02 * scaleFactor, 0.3 * scaleFactor, -0.04 * scaleFactor, 0.22 * scaleFactor, -0.06 * scaleFactor);
    s.bezierCurveTo(0.36 * scaleFactor, -0.14 * scaleFactor, 0.34 * scaleFactor, -0.34 * scaleFactor, 0.16 * scaleFactor, -0.32 * scaleFactor);
    s.bezierCurveTo(0.06 * scaleFactor, -0.28 * scaleFactor, 0.02 * scaleFactor, -0.14 * scaleFactor, 0, 0);
  } else {
    // Layered feathered angel wing silhouette
    s.moveTo(0, 0.04 * scaleFactor);
    s.bezierCurveTo(0.14 * scaleFactor, 0.3 * scaleFactor, 0.44 * scaleFactor, 0.32 * scaleFactor, 0.5 * scaleFactor, 0.12 * scaleFactor);
    s.quadraticCurveTo(0.42 * scaleFactor, 0.04 * scaleFactor, 0.44 * scaleFactor, -0.04 * scaleFactor);
    s.quadraticCurveTo(0.34 * scaleFactor, -0.08 * scaleFactor, 0.36 * scaleFactor, -0.16 * scaleFactor);
    s.quadraticCurveTo(0.24 * scaleFactor, -0.18 * scaleFactor, 0.24 * scaleFactor, -0.26 * scaleFactor);
    s.bezierCurveTo(0.12 * scaleFactor, -0.26 * scaleFactor, 0.04 * scaleFactor, -0.14 * scaleFactor, 0, -0.04 * scaleFactor);
    s.closePath();
  }

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.014 * scaleFactor,
    bevelEnabled: true,
    bevelSegments: 3,
    curveSegments: 18,
    bevelSize: 0.008 * scaleFactor,
    bevelThickness: 0.008 * scaleFactor,
  });
  geo.computeVertexNormals();
  return geo;
}

// Curved sneaker footprint sole shape via beveled ExtrudeGeometry + TubeGeometry laces (zero BoxGeometry)
function makeShoeSoleGeo(width: number, length: number, height: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const hw = width * 0.5;
  const hl = length * 0.5;
  s.moveTo(-hw * 0.78, -hl);
  s.quadraticCurveTo(0, -hl * 1.12, hw * 0.78, -hl);
  s.bezierCurveTo(hw * 0.92, -hl * 0.3, hw * 1.06, hl * 0.35, hw * 0.85, hl * 0.88);
  s.quadraticCurveTo(0, hl * 1.14, -hw * 0.85, hl * 0.88);
  s.bezierCurveTo(-hw * 1.06, hl * 0.35, -hw * 0.92, -hl * 0.3, -hw * 0.78, -hl);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 4,
    curveSegments: 18,
    bevelSize: height * 0.38,
    bevelThickness: height * 0.38,
  });
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

// Puffy sculpted Chibi-Pixar 3D cartoon sneaker with contoured sole, puffed vamp & 3D laces
function buildCartoonSneaker(
  scaleFactor: number,
  upperMat: THREE.Material,
  soleMat: THREE.Material,
  accentMat: THREE.Material,
  addOutlineFn: (mesh: THREE.Mesh, t?: number) => void
): THREE.Group {
  const shoe = new THREE.Group();

  const sole = new THREE.Mesh(
    makeShoeSoleGeo(0.165 * scaleFactor, 0.255 * scaleFactor, 0.028 * scaleFactor),
    soleMat
  );
  sole.position.set(0, 0.036 * scaleFactor, 0.042 * scaleFactor);
  addOutlineFn(sole, 1.03);

  const upper = new THREE.Mesh(
    new THREE.SphereGeometry(0.088 * scaleFactor, 28, 20),
    upperMat
  );
  upper.scale.set(0.9, 0.62, 1.38);
  upper.position.set(0, 0.072 * scaleFactor, 0.036 * scaleFactor);
  addOutlineFn(upper, 1.03);

  const toeCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.074 * scaleFactor, 24, 18),
    soleMat
  );
  toeCap.scale.set(1.02, 0.66, 1.14);
  toeCap.position.set(0, 0.056 * scaleFactor, 0.128 * scaleFactor);
  addOutlineFn(toeCap, 1.03);

  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.068 * scaleFactor, 0.022 * scaleFactor, 16, 32),
    accentMat
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0.114 * scaleFactor, -0.012 * scaleFactor);

  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.046 * scaleFactor, 20, 16),
    accentMat
  );
  tongue.scale.set(1.0, 0.92, 0.42);
  tongue.position.set(0, 0.112 * scaleFactor, 0.064 * scaleFactor);
  tongue.rotation.x = -0.45;

  shoe.add(sole, upper, toeCap, cuff, tongue);

  // Two sculpted 3D laces across the vamp
  [0.08, 0.11].forEach((lz, idx) => {
    const laceCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.046 * scaleFactor, (0.104 - idx * 0.01) * scaleFactor, lz * scaleFactor),
      new THREE.Vector3(0, (0.116 - idx * 0.01) * scaleFactor, (lz + 0.01) * scaleFactor),
      new THREE.Vector3(0.046 * scaleFactor, (0.104 - idx * 0.01) * scaleFactor, lz * scaleFactor),
    ]);
    const lace = new THREE.Mesh(
      new THREE.TubeGeometry(laceCurve, 12, 0.008 * scaleFactor, 10, false),
      soleMat
    );
    shoe.add(lace);
  });

  return shoe;
}

// Articulated cartoon hand (rounded palm + angled opposable thumb + 4 curved curled fingers)
function buildCartoonHand(
  side: -1 | 1,
  scaleFactor: number,
  handMat: THREE.Material,
  hasGloves: boolean,
  gloveCuffMat: THREE.Material,
  addOutlineFn: (mesh: THREE.Mesh, t?: number) => void
): THREE.Group {
  const handGroup = new THREE.Group();

  const palm = new THREE.Mesh(
    new THREE.SphereGeometry(0.055 * scaleFactor, 24, 18),
    handMat
  );
  palm.scale.set(0.96, 1.04, 0.68);
  addOutlineFn(palm, 1.032);
  handGroup.add(palm);

  // Opposable angled thumb
  const thumbPivot = new THREE.Group();
  thumbPivot.position.set(-side * 0.044 * scaleFactor, 0.008 * scaleFactor, 0.026 * scaleFactor);
  thumbPivot.rotation.set(0.38, side * -0.42, side * -0.6);
  const thumb = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.016 * scaleFactor, 0.028 * scaleFactor, 10, 16),
    handMat
  );
  thumb.position.y = -0.016 * scaleFactor;
  addOutlineFn(thumb, 1.04);
  thumbPivot.add(thumb);
  handGroup.add(thumbPivot);

  // Curved 4-finger cluster so held items nestle naturally inside the grip
  [-0.028, -0.009, 0.01, 0.028].forEach((fx, idx) => {
    const fLen = (idx === 1 || idx === 2 ? 0.032 : 0.025) * scaleFactor;
    const finger = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.013 * scaleFactor, fLen, 10, 16),
      handMat
    );
    finger.position.set(fx * scaleFactor, -0.049 * scaleFactor, 0.018 * scaleFactor);
    finger.rotation.x = 0.45;
    addOutlineFn(finger, 1.04);
    handGroup.add(finger);
  });

  if (hasGloves) {
    const cuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.054 * scaleFactor, 0.017 * scaleFactor, 14, 28),
      gloveCuffMat
    );
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = 0.042 * scaleFactor;
    handGroup.add(cuff);
  }

  return handGroup;
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

  const scaleFactor = isYoungKid ? 0.85 : isAdult ? 1.12 : 0.98;
  const legLen = 0.56 * scaleFactor;
  const torsoH = 0.55 * scaleFactor;
  const baseBodyY = legLen;

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;
  root.add(bodyPivot);

  // Smooth Sculpted Pelvis + Contoured Torus Waist Belt
  const pelvis = new THREE.Mesh(
    makeSculptedPelvisGeo(0.41 * scaleFactor, 0.16 * scaleFactor, 0.28 * scaleFactor),
    pantsMat
  );
  pelvis.position.y = 0.04 * scaleFactor;
  addOutline(pelvis, 1.025);
  bodyPivot.add(pelvis);

  const belt = new THREE.Mesh(
    new THREE.TorusGeometry(0.178 * scaleFactor, 0.028 * scaleFactor, 16, 36),
    darkMat
  );
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.12, 0.8, 1);
  belt.position.y = 0.095 * scaleFactor;
  const beltBuckle = new THREE.Mesh(
    new THREE.TorusGeometry(0.032 * scaleFactor, 0.011 * scaleFactor, 12, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.82, roughness: 0.18, clearcoat: 0.7 })
  );
  beltBuckle.position.set(0, 0.095 * scaleFactor, 0.155 * scaleFactor);
  bodyPivot.add(belt, beltBuckle);

  // Torso material override for Doctor / Chef / Angel (soft fabric roughness: 0.75)
  const torsoMat =
    kind === 'doctor' || kind === 'chef' || kind === 'angel'
      ? new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, map: fabricTex, roughness: 0.75, sheen: 0.32 })
      : shirtMat;

  const torso = new THREE.Mesh(
    makeTaperedTorsoGeo(0.45 * scaleFactor, torsoH, 0.3 * scaleFactor, 36),
    torsoMat
  );
  torso.position.y = 0.075 * scaleFactor;
  addOutline(torso, 1.025);
  bodyPivot.add(torso);
  if (kind !== 'doctor' && kind !== 'chef' && kind !== 'angel') {
    accentMeshes.push(torso);
  }

  // Collar neck trim on tees / folded shirt collar on collared presets
  if (['teacher', 'father', 'police', 'doctor'].includes(kind)) {
    const collarGeo = new THREE.TorusGeometry(0.118 * scaleFactor, 0.025 * scaleFactor, 16, 36);
    const collar = new THREE.Mesh(collarGeo, kind === 'doctor' ? torsoMat : whiteMat);
    collar.rotation.x = Math.PI / 2.2;
    collar.position.set(0, 0.078 * scaleFactor + torsoH, 0.015 * scaleFactor);
    bodyPivot.add(collar);
  } else {
    const collarTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.112 * scaleFactor, 0.022 * scaleFactor, 16, 36),
      torsoMat
    );
    collarTrim.rotation.x = Math.PI / 2;
    collarTrim.position.set(0, 0.08 * scaleFactor + torsoH, 0.01);
    bodyPivot.add(collarTrim);
  }

  // Pleated Skirt / Flowing Dress / Gown / Robe (42-segment scalloped Lathe)
  if (hasSkirtOrGown || kind === 'wizard') {
    const isLongGown = ['queen', 'princess', 'witch', 'wizard', 'mother'].includes(kind);
    const skirt = new THREE.Mesh(
      makePleatedSkirtGeo(
        0.215 * scaleFactor,
        (isLongGown ? 0.36 : 0.31) * scaleFactor,
        (isLongGown ? 0.48 : 0.28) * scaleFactor,
        42,
        isLongGown ? 0.05 : 0.04
      ),
      shirtMat
    );
    skirt.position.y = (isLongGown ? -0.1 : 0.02) * scaleFactor;
    addOutline(skirt, 1.025);
    bodyPivot.add(skirt);
    accentMeshes.push(skirt);
  }

  // Role-specific sculpted 3D outfit accessories
  if (kind === 'teenager') {
    // Cozy sculpted hoodie cowl behind neck + drawstring cords + rounded kangaroo pocket
    const hoodCowl = new THREE.Mesh(
      new THREE.TorusGeometry(0.145 * scaleFactor, 0.046 * scaleFactor, 16, 32, Math.PI * 1.45),
      shirtMat
    );
    hoodCowl.rotation.set(Math.PI / 2.3, 0, -Math.PI * 0.22);
    hoodCowl.position.set(0, 0.075 * scaleFactor + torsoH, -0.045 * scaleFactor);
    bodyPivot.add(hoodCowl);
    [-0.04, 0.04].forEach((cx) => {
      const cord = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.008 * scaleFactor, 0.14 * scaleFactor, 8, 12),
        whiteMat
      );
      cord.position.set(cx * scaleFactor, 0.45 * scaleFactor, 0.142 * scaleFactor);
      bodyPivot.add(cord);
    });
    const pouch = new THREE.Mesh(
      makeOrganicPouchGeo(0.24 * scaleFactor, 0.13 * scaleFactor, 0.07 * scaleFactor),
      shirtMat
    );
    pouch.position.set(0, 0.21 * scaleFactor, 0.132 * scaleFactor);
    bodyPivot.add(pouch);
    accentMeshes.push(hoodCowl, pouch);
  } else if (kind === 'woman' || kind === 'mother') {
    // Decorative necklace / flowing draped saree pallu scarf across shoulder
    const necklace = new THREE.Mesh(
      new THREE.TorusGeometry(0.128 * scaleFactor, 0.015 * scaleFactor, 14, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xfef08a, metalness: 0.78, roughness: 0.2 })
    );
    necklace.rotation.x = Math.PI / 2.1;
    necklace.position.set(0, 0.065 * scaleFactor + torsoH, 0.018 * scaleFactor);
    bodyPivot.add(necklace);

    if (kind === 'mother') {
      const palluCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.17 * scaleFactor, 0.16 * scaleFactor, 0.11 * scaleFactor),
        new THREE.Vector3(0.02 * scaleFactor, 0.36 * scaleFactor, 0.155 * scaleFactor),
        new THREE.Vector3(-0.15 * scaleFactor, 0.56 * scaleFactor, 0.07 * scaleFactor),
        new THREE.Vector3(-0.16 * scaleFactor, 0.5 * scaleFactor, -0.14 * scaleFactor),
        new THREE.Vector3(-0.12 * scaleFactor, 0.2 * scaleFactor, -0.18 * scaleFactor),
      ]);
      const pallu = new THREE.Mesh(
        new THREE.TubeGeometry(palluCurve, 22, 0.048 * scaleFactor, 16, false),
        new THREE.MeshPhysicalMaterial({ color: 0xfef08a, map: fabricTex, roughness: 0.72, sheen: 0.4 })
      );
      pallu.scale.set(1.25, 1, 0.52);
      addOutline(pallu, 1.03);
      bodyPivot.add(pallu);
    }
  } else if (kind === 'teacher' || kind === 'father') {
    const tieCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.56 * scaleFactor, 0.125 * scaleFactor),
      new THREE.Vector3(0, 0.42 * scaleFactor, 0.152 * scaleFactor),
      new THREE.Vector3(0, 0.24 * scaleFactor, 0.142 * scaleFactor),
    ]);
    const tie = new THREE.Mesh(
      new THREE.TubeGeometry(tieCurve, 14, 0.032 * scaleFactor, 14, false),
      new THREE.MeshPhysicalMaterial({ color: 0xdc2626, map: fabricTex, roughness: 0.55 })
    );
    tie.scale.set(1.15, 1, 0.45);
    const tieKnot = new THREE.Mesh(
      new THREE.SphereGeometry(0.036 * scaleFactor, 18, 14),
      new THREE.MeshPhysicalMaterial({ color: 0xb91c1c, roughness: 0.5 })
    );
    tieKnot.position.set(0, 0.565 * scaleFactor, 0.132 * scaleFactor);
    bodyPivot.add(tie, tieKnot);
  } else if (kind === 'farmer') {
    const bib = new THREE.Mesh(
      makeOrganicPouchGeo(0.28 * scaleFactor, 0.3 * scaleFactor, 0.08 * scaleFactor),
      pantsMat
    );
    bib.position.set(0, 0.29 * scaleFactor, 0.122 * scaleFactor);
    [-0.1, 0.1].forEach((sx) => {
      const strap = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.022 * scaleFactor, 0.22 * scaleFactor, 10, 14),
        pantsMat
      );
      strap.position.set(sx * scaleFactor, 0.47 * scaleFactor, 0.112 * scaleFactor);
      const btn = new THREE.Mesh(
        new THREE.SphereGeometry(0.018 * scaleFactor, 14, 12),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
      );
      btn.position.set(sx * scaleFactor, 0.4 * scaleFactor, 0.142 * scaleFactor);
      bodyPivot.add(strap, btn);
    });
    const bandana = new THREE.Mesh(
      new THREE.TorusGeometry(0.14 * scaleFactor, 0.034 * scaleFactor, 14, 28),
      new THREE.MeshPhysicalMaterial({ color: 0xef4444, map: fabricTex, roughness: 0.72 })
    );
    bandana.rotation.x = Math.PI / 2.2;
    bandana.position.set(0, 0.095 * scaleFactor + torsoH, 0.02);
    bodyPivot.add(bib, bandana);
  } else if (kind === 'doctor') {
    // Open lab coat lapels + full curved 3D stethoscope around neck
    const scrub = new THREE.Mesh(
      makeOrganicPouchGeo(0.18 * scaleFactor, 0.28 * scaleFactor, 0.07 * scaleFactor),
      shirtMat
    );
    scrub.position.set(0, 0.43 * scaleFactor, 0.124 * scaleFactor);
    const stethMat = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.28, metalness: 0.45, clearcoat: 0.55 });
    const stethCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.11 * scaleFactor, 0.52 * scaleFactor, 0.09 * scaleFactor),
      new THREE.Vector3(-0.13 * scaleFactor, 0.62 * scaleFactor, 0.0),
      new THREE.Vector3(0, 0.64 * scaleFactor, -0.11 * scaleFactor),
      new THREE.Vector3(0.13 * scaleFactor, 0.62 * scaleFactor, 0.0),
      new THREE.Vector3(0.09 * scaleFactor, 0.42 * scaleFactor, 0.148 * scaleFactor),
    ]);
    const stethTube = new THREE.Mesh(
      new THREE.TubeGeometry(stethCurve, 26, 0.017 * scaleFactor, 14, false),
      stethMat
    );
    const chestDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044 * scaleFactor, 0.044 * scaleFactor, 0.022, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.14, clearcoat: 0.85 })
    );
    chestDisc.rotation.x = Math.PI / 2;
    chestDisc.position.set(0.09 * scaleFactor, 0.41 * scaleFactor, 0.155 * scaleFactor);
    bodyPivot.add(scrub, stethTube, chestDisc);
    accentMeshes.push(scrub);
  } else if (kind === 'police') {
    const badge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.055 * scaleFactor, 1),
      new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.18, clearcoat: 0.7 })
    );
    badge.position.set(0.11 * scaleFactor, 0.45 * scaleFactor, 0.145 * scaleFactor);
    bodyPivot.add(badge);
  } else if (kind === 'chef') {
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.14 * scaleFactor, 0.032 * scaleFactor, 14, 28),
      shirtMat
    );
    scarf.rotation.x = Math.PI / 2.2;
    scarf.position.set(0, 0.095 * scaleFactor + torsoH, 0.02);
    const apron = new THREE.Mesh(
      makePleatedSkirtGeo(0.2 * scaleFactor, 0.25 * scaleFactor, 0.34 * scaleFactor, 32, 0.02),
      whiteMat
    );
    apron.position.set(0, 0.08 * scaleFactor, 0.02 * scaleFactor);
    bodyPivot.add(scarf, apron);
    accentMeshes.push(scarf);
  } else if (['king', 'queen', 'prince', 'princess', 'superhero', 'witch'].includes(kind)) {
    if (['king', 'queen', 'superhero', 'witch'].includes(kind)) {
      const capeMat = new THREE.MeshPhysicalMaterial({
        color: kind === 'superhero' ? 0xfacc15 : kind === 'witch' ? 0x1e1b4b : 0x991b1b,
        map: fabricTex,
        roughness: 0.72,
        sheen: 0.45,
        side: THREE.DoubleSide,
      });
      const cape = new THREE.Mesh(
        makeDrapedCapeGeo(0.54 * scaleFactor, 0.8 * scaleFactor),
        capeMat
      );
      cape.position.set(0, 0.58 * scaleFactor, -0.14 * scaleFactor);
      addOutline(cape, 1.028);
      bodyPivot.add(cape);

      if (kind === 'king' || kind === 'queen') {
        // Fluffy ermine trim collar around cape shoulders
        for (let i = -3; i <= 3; i++) {
          const furPuff = new THREE.Mesh(new THREE.SphereGeometry(0.055 * scaleFactor, 18, 14), whiteMat);
          furPuff.position.set(i * 0.055 * scaleFactor, 0.58 * scaleFactor, -0.06 * scaleFactor - (3 - Math.abs(i)) * 0.025);
          bodyPivot.add(furPuff);
        }
      }
    }
    if (kind === 'superhero') {
      const emblem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09 * scaleFactor, 0.09 * scaleFactor, 0.04, 24),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.4, clearcoat: 0.6 })
      );
      emblem.rotation.x = Math.PI / 2;
      emblem.position.set(0, 0.44 * scaleFactor, 0.145 * scaleFactor);
      bodyPivot.add(emblem);
    } else if (kind === 'prince') {
      // Curved diagonal royal sash hugging torso (zero BoxGeometry)
      const sashCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.14 * scaleFactor, 0.55 * scaleFactor, 0.11 * scaleFactor),
        new THREE.Vector3(0, 0.36 * scaleFactor, 0.155 * scaleFactor),
        new THREE.Vector3(0.18 * scaleFactor, 0.16 * scaleFactor, 0.12 * scaleFactor),
        new THREE.Vector3(0.14 * scaleFactor, 0.15 * scaleFactor, -0.13 * scaleFactor),
        new THREE.Vector3(-0.14 * scaleFactor, 0.55 * scaleFactor, -0.1 * scaleFactor),
        new THREE.Vector3(-0.14 * scaleFactor, 0.55 * scaleFactor, 0.11 * scaleFactor),
      ]);
      const sash = new THREE.Mesh(
        new THREE.TubeGeometry(sashCurve, 28, 0.034 * scaleFactor, 14, true),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, roughness: 0.35, clearcoat: 0.45 })
      );
      sash.scale.set(1, 1, 0.65);
      bodyPivot.add(sash);
    }
  } else {
    const pocket = new THREE.Mesh(
      makeOrganicPouchGeo(0.22 * scaleFactor, 0.14 * scaleFactor, 0.06 * scaleFactor),
      shirtMat
    );
    pocket.position.set(0, 0.23 * scaleFactor, 0.13 * scaleFactor);
    bodyPivot.add(pocket);
    accentMeshes.push(pocket);
  }

  // Adventure Backpacks with Smooth Curved Straps & Buckles (Boys, Girls, Kids, Teenager, Twins)
  if (['boy', 'girl', 'teenager', 'kid', 'son', 'daughter', 'twins'].includes(kind)) {
    const packColor = isFemale ? 0x7c3aed : 0xea580c;
    const strapColor = isFemale ? 0x5b21b6 : 0xf59e0b;
    const packMat = new THREE.MeshPhysicalMaterial({
      color: packColor,
      map: fabricTex,
      roughness: 0.72,
      sheen: 0.32,
    });
    const strapMat = new THREE.MeshPhysicalMaterial({
      color: strapColor,
      roughness: 0.56,
    });
    const buckleMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.78,
      roughness: 0.2,
      clearcoat: 0.6,
    });

    const packBody = new THREE.Mesh(
      makeOrganicPouchGeo(0.36 * scaleFactor, 0.42 * scaleFactor, 0.2 * scaleFactor, 32),
      packMat
    );
    packBody.position.set(0, 0.35 * scaleFactor, -0.2 * scaleFactor);
    addOutline(packBody, 1.025);

    const packPocket = new THREE.Mesh(
      makeOrganicPouchGeo(0.26 * scaleFactor, 0.18 * scaleFactor, 0.09 * scaleFactor, 24),
      strapMat
    );
    packPocket.position.set(0, 0.24 * scaleFactor, -0.29 * scaleFactor);
    addOutline(packPocket, 1.025);

    bodyPivot.add(packBody, packPocket);

    [-1, 1].forEach((s) => {
      const strapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.135 * scaleFactor, 0.22 * scaleFactor, 0.135 * scaleFactor),
        new THREE.Vector3(s * 0.145 * scaleFactor, 0.42 * scaleFactor, 0.145 * scaleFactor),
        new THREE.Vector3(s * 0.135 * scaleFactor, 0.575 * scaleFactor, 0.04 * scaleFactor),
        new THREE.Vector3(s * 0.125 * scaleFactor, 0.52 * scaleFactor, -0.14 * scaleFactor),
      ]);
      const strap = new THREE.Mesh(
        new THREE.TubeGeometry(strapCurve, 18, 0.022 * scaleFactor, 12, false),
        strapMat
      );
      const buckle = new THREE.Mesh(
        new THREE.TorusGeometry(0.028 * scaleFactor, 0.008 * scaleFactor, 10, 20),
        buckleMat
      );
      buckle.position.set(s * 0.14 * scaleFactor, 0.34 * scaleFactor, 0.145 * scaleFactor);
      bodyPivot.add(strap, buckle);
    });
  }

  // Sculpted Translucent Iridescent Fairy Butterfly Wings & Layered Feathered Angel Wings
  let leftWingPivot: THREE.Group | undefined;
  let rightWingPivot: THREE.Group | undefined;
  if (kind === 'fairy' || kind === 'angel') {
    const isFairy = kind === 'fairy';
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: isFairy ? 0xa5f3fc : 0xffffff,
      emissive: isFairy ? 0x38bdf8 : 0xe2e8f0,
      emissiveIntensity: isFairy ? 0.5 : 0.25,
      transparent: isFairy,
      opacity: isFairy ? 0.78 : 1,
      iridescence: isFairy ? 0.92 : 0.25,
      roughness: 0.18,
      clearcoat: 0.75,
      side: THREE.DoubleSide,
    });
    const wingGeo = makeSculptedWingGeo(isFairy, scaleFactor);
    const makeWing = (side: -1 | 1) => {
      const wp = new THREE.Group();
      wp.position.set(side * 0.08 * scaleFactor, 0.44 * scaleFactor, -0.14 * scaleFactor);
      const wingMesh = new THREE.Mesh(wingGeo, wingMat);
      wingMesh.scale.x = side;
      wingMesh.rotation.y = side * -0.28;
      wp.add(wingMesh);
      bodyPivot.add(wp);
      return wp;
    };
    leftWingPivot = makeWing(-1);
    rightWingPivot = makeWing(1);
  }

  // Head Pivot (Authentic 1:3.5 Kid / Chibi-Pixar Sculpted Head + Glossy 3D Eyeballs)
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.085 * scaleFactor + torsoH;
  bodyPivot.add(headPivot);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072 * scaleFactor, 0.094 * scaleFactor, 0.11 * scaleFactor, 32),
    skinMat
  );
  neck.position.y = 0.045 * scaleFactor;
  headPivot.add(neck);

  const irisHex =
    isFemale
      ? '#16a34a' // Emerald green
      : kind === 'twins' || kind === 'police' || kind === 'angel' || kind === 'superhero' || kind === 'doctor'
        ? '#0284c7' // Sky blue
        : '#d97706'; // Warm golden amber
  const hasFreckles = ['boy', 'girl', 'kid', 'son', 'daughter', 'twins'].includes(kind);
  const skinTex = createChibiSkinTexture(skinColor, hasFreckles, isFemale);
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: skinTex,
    roughness: 0.42,
    metalness: 0.02,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
  });
  const earInnerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(skinColor).lerp(new THREE.Color(0xfb7185), 0.34),
    roughness: 0.58,
  });

  // Expressive Kid Proportions (~1:3.5 head-to-body ratio for kids/son/daughter/twins)
  const headRadius = (isYoungKid ? 0.375 : 0.345) * scaleFactor;
  const headUnitScale = headRadius / 0.55;
  const headCenterY = 0.075 * scaleFactor + headRadius * 0.96;
  const head = new THREE.Mesh(getChibiHeadGeometry(), faceMat);
  head.scale.set(1.04 * headUnitScale, 0.97 * headUnitScale, 1.13 * headUnitScale);
  head.rotation.y = -Math.PI / 2;
  head.position.y = headCenterY;
  addOutline(head, 1.022, 0x2a1810);
  headPivot.add(head);

  // Sculpted 3D Ears (outer bowl + inner concha)
  [-1, 1].forEach((side) => {
    const earGroup = new THREE.Group();
    earGroup.position.set(side * headRadius * 1.11, headCenterY - 0.015 * scaleFactor, -0.02 * scaleFactor);
    earGroup.rotation.y = side * -0.24;

    const outerEar = new THREE.Mesh(new THREE.SphereGeometry(0.068 * scaleFactor, 28, 22), skinMat);
    outerEar.scale.set(0.62, 1.04, 0.72);
    addOutline(outerEar, 1.03, 0x2a1810);

    const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.044 * scaleFactor, 22, 16), earInnerMat);
    innerEar.scale.set(0.55, 0.85, 0.55);
    innerEar.position.set(side * 0.008 * scaleFactor, 0, 0.014 * scaleFactor);

    earGroup.add(outerEar, innerEar);
    headPivot.add(earGroup);
  });

  // Cute sculpted 3D button nose with subtle bridge
  const noseBridge = new THREE.Mesh(new THREE.SphereGeometry(0.022 * scaleFactor, 20, 16), skinMat);
  noseBridge.scale.set(0.85, 1.25, 0.9);
  noseBridge.position.set(0, headCenterY - headRadius * 0.045, headRadius * 1.015);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036 * scaleFactor, 28, 22), earInnerMat);
  nose.scale.set(1.12, 0.82, 0.96);
  nose.position.set(0, headCenterY - headRadius * 0.088, headRadius * 1.045);
  headPivot.add(noseBridge, nose);

  // Recessed Glossy 3D Eyeballs + Protruding 3D Eyelids & Lashes
  const eyeY = headCenterY + headRadius * 0.085;
  const eyeZ = headRadius * 0.91;
  const eyeX = headRadius * 0.365;
  const irisMat = new THREE.MeshPhysicalMaterial({
    map: createEyeIrisTexture(irisHex),
    roughness: 0.06,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });
  const corneaGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.16,
    roughness: 0.02,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    depthWrite: false,
  });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  catchMat.userData.sharedResource = true;
  const lashMat = new THREE.MeshPhysicalMaterial({ color: 0x1b0f0a, roughness: 0.35, clearcoat: 0.3 });

  const makeSculptedEye = (side: -1 | 1) => {
    const eg = new THREE.Group();
    eg.position.set(side * eyeX, eyeY, eyeZ);
    eg.rotation.y = side * 0.14;

    const r = 0.066 * scaleFactor;
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), whiteMat);
    sclera.scale.set(0.98, 1.06, 0.68);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 32, 24), irisMat);
    iris.scale.set(0.95, 1.02, 0.42);
    iris.position.set(side * -0.004 * scaleFactor, 0, r * 0.42);
    iris.rotation.y = -Math.PI / 2;

    const cornea = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 32, 24), corneaGlassMat);
    cornea.scale.set(0.98, 1.06, 0.72);
    cornea.position.z = r * 0.06;

    const sp1 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 16, 12), catchMat);
    sp1.position.set(-r * 0.28, r * 0.32, r * 0.78);
    const sp2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 12, 10), catchMat);
    sp2.position.set(r * 0.26, -r * 0.22, r * 0.75);

    const upperLidHood = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.02, 0.017 * scaleFactor, 14, 32, Math.PI * 0.92),
      skinMat
    );
    upperLidHood.rotation.z = Math.PI * 0.04;
    upperLidHood.rotation.x = 0.22;
    upperLidHood.position.set(0, r * 0.14, r * 0.28);

    const lashArc = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.0, (isFemale ? 0.012 : 0.009) * scaleFactor, 12, 32, Math.PI * 0.88),
      lashMat
    );
    lashArc.rotation.z = Math.PI * 0.06;
    lashArc.position.set(0, r * 0.08, r * 0.36);

    const lowerLid = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.96, 0.01 * scaleFactor, 12, 28, Math.PI * 0.76),
      skinMat
    );
    lowerLid.rotation.z = Math.PI + Math.PI * 0.12;
    lowerLid.position.set(0, -r * 0.12, r * 0.28);

    eg.add(sclera, iris, cornea, sp1, sp2, upperLidHood, lashArc, lowerLid);

    if (isFemale) {
      const lashWing = new THREE.Mesh(
        new THREE.ConeGeometry(0.009 * scaleFactor, 0.032 * scaleFactor, 12),
        lashMat
      );
      lashWing.position.set(side * r * 1.0, r * 0.38, r * 0.32);
      lashWing.rotation.z = side * -1.05;
      eg.add(lashWing);
    }

    headPivot.add(eg);
    return cornea;
  };

  const leftCornea = makeSculptedEye(-1);
  const rightCornea = makeSculptedEye(1);

  // Thick Sculpted Curved 3D Eyebrows (animated cleanly by facial expression system)
  const browGeo = new THREE.TorusGeometry(0.06 * scaleFactor, 0.016 * scaleFactor, 14, 28, Math.PI * 0.68);
  browGeo.rotateZ(Math.PI * 0.16);
  const leftBrow = new THREE.Mesh(browGeo, hairMat);
  leftBrow.position.set(-eyeX, eyeY + 0.062 * scaleFactor, eyeZ + 0.048 * scaleFactor);
  leftBrow.rotation.y = -0.14;
  const rightBrow = new THREE.Mesh(browGeo, hairMat);
  rightBrow.position.set(eyeX, eyeY + 0.062 * scaleFactor, eyeZ + 0.048 * scaleFactor);
  rightBrow.rotation.y = 0.14;
  headPivot.add(leftBrow, rightBrow);

  // Expressive Animated 3D Lips & Open Smile Mouth (zero BoxGeometry: Sphere cavity + Torus arc teeth & lips + Tongue)
  const mouthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.056 * scaleFactor, 24, 18),
    mouthMat
  );
  mouthMesh.scale.set(1.18, 0.42, 0.52);
  mouthMesh.position.set(0, headCenterY - headRadius * 0.34, headRadius * 0.96);

  const lipMat = new THREE.MeshPhysicalMaterial({
    color: isFemale ? 0xf43f5e : 0xe07a6c,
    roughness: 0.34,
    clearcoat: 0.38,
  });
  const upperLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.052 * scaleFactor, 0.009 * scaleFactor, 14, 28, Math.PI),
    lipMat
  );
  upperLip.position.set(0, 0.012 * scaleFactor, 0.012 * scaleFactor);
  const lowerLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.05 * scaleFactor, 0.01 * scaleFactor, 14, 28, Math.PI),
    lipMat
  );
  lowerLip.rotation.z = Math.PI;
  lowerLip.position.set(0, -0.01 * scaleFactor, 0.012 * scaleFactor);

  const upperTeeth = new THREE.Mesh(
    new THREE.TorusGeometry(0.042 * scaleFactor, 0.008 * scaleFactor, 10, 20, Math.PI * 0.85),
    whiteMat
  );
  upperTeeth.rotation.z = Math.PI * 0.075;
  upperTeeth.position.set(0, 0.008 * scaleFactor, 0.014 * scaleFactor);
  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.032 * scaleFactor, 22, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, roughness: 0.32 })
  );
  tongue.scale.set(1.15, 0.45, 0.75);
  tongue.position.set(0, -0.008 * scaleFactor, 0.014 * scaleFactor);
  mouthMesh.add(upperLip, lowerLip, upperTeeth, tongue);
  headPivot.add(mouthMesh);

  // Layered Sculpted 3D Hair Crown + Curved Bangs & Side Locks
  const hairTop = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 1.07, 44, 32, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  hairTop.scale.set(1.13, 0.98, 1.06);
  hairTop.position.y = headCenterY + 0.015 * scaleFactor;
  addOutline(hairTop, 1.024, 0x2a1810);
  headPivot.add(hairTop);

  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 1.06, 40, 28, Math.PI * 0.68, Math.PI * 1.64, Math.PI * 0.2, Math.PI * 0.58),
    hairMat
  );
  hairBack.scale.set(1.13, 0.98, 1.06);
  hairBack.position.y = headCenterY;
  headPivot.add(hairBack);

  const addCurvedHairBangs = (count: number, yBase: number, zBase: number, sweep = 0.48) => {
    for (let i = 0; i < count; i++) {
      const frac = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(frac * 0.07 * scaleFactor, 0.04 * scaleFactor, -0.05 * scaleFactor),
        new THREE.Vector3(frac * 0.13 * scaleFactor, 0.01 * scaleFactor, 0.055 * scaleFactor),
        new THREE.Vector3(frac * 0.19 * scaleFactor, -0.065 * scaleFactor, 0.095 * scaleFactor),
        new THREE.Vector3(frac * 0.22 * scaleFactor, -0.125 * scaleFactor, 0.065 * scaleFactor),
      ]);
      const bangGeo = new THREE.TubeGeometry(curve, 14, (0.044 - Math.abs(frac) * 0.008) * scaleFactor, 14, false);
      const bang = new THREE.Mesh(bangGeo, hairMat);
      bang.position.set(frac * 0.08 * scaleFactor, yBase, zBase - Math.abs(frac) * 0.055 * scaleFactor);
      bang.rotation.x = sweep * 0.35;
      addOutline(bang, 1.028, 0x2a1810);
      headPivot.add(bang);
    }
    [-1, 1].forEach((side) => {
      const sideCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.04 * scaleFactor, 0),
        new THREE.Vector3(side * 0.03 * scaleFactor, -0.07 * scaleFactor, 0.03 * scaleFactor),
        new THREE.Vector3(side * 0.01 * scaleFactor, -0.17 * scaleFactor, 0.05 * scaleFactor),
      ]);
      const sideLock = new THREE.Mesh(
        new THREE.TubeGeometry(sideCurve, 12, 0.036 * scaleFactor, 12, false),
        hairMat
      );
      sideLock.position.set(side * headRadius * 0.99, headCenterY + 0.05 * scaleFactor, 0.08 * scaleFactor);
      addOutline(sideLock, 1.03, 0x2a1810);
      headPivot.add(sideLock);
    });
  };

  let ponytailPivot: THREE.Group | undefined;

  // Headgear / Hairstyles / Facial Hair
  if (kind === 'boy' || kind === 'son' || kind === 'kid' || kind === 'twins') {
    addCurvedHairBangs(5, headCenterY + 0.12 * scaleFactor, headRadius * 0.9, 0.45);

    const redCapMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      map: fabricTex,
      roughness: 0.38,
      clearcoat: 0.4,
    });

    const capBack = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.12, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.43),
      shirtMat
    );
    capBack.scale.set(1.13, 0.98, 1.06);
    capBack.position.set(0, headCenterY + 0.055 * scaleFactor, -0.018 * scaleFactor);
    capBack.rotation.x = -0.16;
    addOutline(capBack, 1.024, 0x2a1810);

    const capWhiteFront = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.126, 32, 22, -0.7, 1.4, 0.08, Math.PI * 0.36),
      whiteMat
    );
    capWhiteFront.scale.set(1.06, 0.98, 1.13);
    capWhiteFront.position.set(0, headCenterY + 0.055 * scaleFactor, -0.006 * scaleFactor);
    capWhiteFront.rotation.y = Math.PI / 2;
    capWhiteFront.rotation.z = 0.16;

    const capBrim = new THREE.Mesh(
      makeCurvedCapVisorGeo(0.56 * scaleFactor, 0.3 * scaleFactor, 0.022 * scaleFactor),
      redCapMat
    );
    capBrim.position.set(0, headCenterY + 0.135 * scaleFactor, headRadius * 0.72);
    capBrim.rotation.x = 0.08;
    addOutline(capBrim, 1.025, 0x2a1810);

    const capButton = new THREE.Mesh(new THREE.SphereGeometry(0.032 * scaleFactor, 20, 14), redCapMat);
    capButton.position.set(0, headCenterY + headRadius * 1.11, -0.02 * scaleFactor);

    headPivot.add(capBack, capWhiteFront, capBrim, capButton);
    accentMeshes.push(capBack);
  } else if (kind === 'teenager') {
    addCurvedHairBangs(5, headCenterY + 0.125 * scaleFactor, headRadius * 0.9, 0.46);
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.11, 36, 26, 0, Math.PI * 2, 0, Math.PI * 0.46),
      shirtMat
    );
    beanie.scale.set(1.13, 0.98, 1.06);
    beanie.position.set(0, headCenterY + 0.048 * scaleFactor, -0.02);
    addOutline(beanie, 1.024, 0x2a1810);
    const band = new THREE.Mesh(new THREE.TorusGeometry(headRadius * 1.12, 0.024, 14, 36, Math.PI), darkMat);
    band.position.y = headCenterY + 0.035 * scaleFactor;
    headPivot.add(beanie, band);
    accentMeshes.push(beanie);
  } else if (kind === 'girl' || kind === 'daughter') {
    addCurvedHairBangs(4, headCenterY + 0.115 * scaleFactor, headRadius * 0.88, 0.5);

    ponytailPivot = new THREE.Group();
    ponytailPivot.position.set(headRadius * 0.74, headCenterY + 0.06 * scaleFactor, -headRadius * 0.76);

    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.056 * scaleFactor, 0.022, 14, 32), shirtMat);
    tie.rotation.y = Math.PI / 3;

    const ponyCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.08 * scaleFactor, -0.08 * scaleFactor, -0.08 * scaleFactor),
      new THREE.Vector3(0.14 * scaleFactor, -0.24 * scaleFactor, -0.14 * scaleFactor),
      new THREE.Vector3(0.16 * scaleFactor, -0.4 * scaleFactor, -0.09 * scaleFactor),
    ]);
    const ponyMesh = new THREE.Mesh(
      new THREE.TubeGeometry(ponyCurve, 18, 0.078 * scaleFactor, 16, false),
      hairMat
    );
    addOutline(ponyMesh, 1.028, 0x2a1810);

    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.075 * scaleFactor, 0.16 * scaleFactor, 24), hairMat);
    tailTip.position.set(0.16 * scaleFactor, -0.46 * scaleFactor, -0.08 * scaleFactor);
    tailTip.rotation.z = Math.PI + 0.18;
    addOutline(tailTip, 1.028, 0x2a1810);

    ponytailPivot.add(tie, ponyMesh, tailTip);
    headPivot.add(ponytailPivot);
    accentMeshes.push(tie);

    if (kind === 'daughter') {
      [-1, 1].forEach((side) => {
        for (let b = 0; b < 4; b++) {
          const bead = new THREE.Mesh(
            new THREE.SphereGeometry((0.055 - b * 0.007) * scaleFactor, 24, 18),
            hairMat
          );
          bead.position.set(
            side * (headRadius * 0.94 + b * 0.015 * scaleFactor),
            headCenterY - (0.04 + b * 0.075) * scaleFactor,
            -0.06 * scaleFactor
          );
          addOutline(bead, 1.025, 0x2a1810);
          headPivot.add(bead);
        }
      });
    }
  } else if (kind === 'woman' || kind === 'mother' || kind === 'grandma') {
    addCurvedHairBangs(4, headCenterY + 0.115 * scaleFactor, headRadius * 0.88, 0.48);
    const backBun = new THREE.Mesh(new THREE.SphereGeometry(0.15 * scaleFactor, 32, 24), hairMat);
    backBun.position.set(0, headCenterY + 0.05 * scaleFactor, -headRadius * 0.98);
    addOutline(backBun, 1.025, 0x2a1810);
    const bunPin = new THREE.Mesh(
      new THREE.TorusGeometry(0.11 * scaleFactor, 0.014 * scaleFactor, 12, 28),
      shirtMat
    );
    bunPin.position.set(0, headCenterY + 0.05 * scaleFactor, -headRadius * 0.88);
    headPivot.add(backBun, bunPin);
    if (kind === 'grandma') {
      const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, metalness: 0.78, roughness: 0.2, clearcoat: 0.7 });
      const lensGeo = new THREE.TorusGeometry(0.074 * scaleFactor, 0.01, 14, 32);
      const lL = new THREE.Mesh(lensGeo, frameMat);
      lL.position.set(-eyeX, eyeY, eyeZ + 0.065 * scaleFactor);
      const lR = lL.clone();
      lR.position.x = eyeX;
      const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.038 * scaleFactor, 0.008 * scaleFactor, 10, 20, Math.PI), frameMat);
      bridge.position.set(0, eyeY + 0.01, eyeZ + 0.065 * scaleFactor);
      headPivot.add(lL, lR, bridge);
    }
  } else if (kind === 'teacher' || kind === 'grandpa' || kind === 'father') {
    addCurvedHairBangs(4, headCenterY + 0.115 * scaleFactor, headRadius * 0.88, 0.42);
    if (kind === 'teacher' || kind === 'grandpa') {
      const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.22, metalness: 0.75, clearcoat: 0.65 });
      const lensGeo = new THREE.TorusGeometry(0.076 * scaleFactor, 0.011, 14, 32);
      const leftLens = new THREE.Mesh(lensGeo, frameMat);
      leftLens.position.set(-eyeX, eyeY, eyeZ + 0.065 * scaleFactor);
      const rightLens = new THREE.Mesh(lensGeo, frameMat);
      rightLens.position.set(eyeX, eyeY, eyeZ + 0.065 * scaleFactor);
      // Curved Torus bridge + curved temple arms (zero BoxGeometry)
      const bridge = new THREE.Mesh(
        new THREE.TorusGeometry(0.042 * scaleFactor, 0.009 * scaleFactor, 10, 20, Math.PI),
        frameMat
      );
      bridge.position.set(0, eyeY + 0.006, eyeZ + 0.065 * scaleFactor);
      [-1, 1].forEach((side) => {
        const temple = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.007 * scaleFactor, 0.24 * scaleFactor, 8, 12),
          frameMat
        );
        temple.rotation.x = Math.PI / 2;
        temple.position.set(side * (eyeX + 0.072 * scaleFactor), eyeY + 0.01, eyeZ - 0.06 * scaleFactor);
        headPivot.add(temple);
      });
      headPivot.add(leftLens, rightLens, bridge);
    }
    if (kind === 'father' || kind === 'grandpa') {
      const stache = new THREE.Mesh(
        new THREE.TorusGeometry(0.058 * scaleFactor, 0.018 * scaleFactor, 12, 24, Math.PI),
        hairMat
      );
      stache.scale.set(1.25, 0.72, 0.85);
      stache.position.set(0, headCenterY - headRadius * 0.24, headRadius * 1.0);
      headPivot.add(stache);
    }
  } else if (kind === 'farmer') {
    const strawMat = new THREE.MeshPhysicalMaterial({ color: 0xfde047, map: fabricTex, roughness: 0.65, clearcoat: 0.2 });
    const hatPts = [
      new THREE.Vector2(0.52 * scaleFactor, 0),
      new THREE.Vector2(0.4 * scaleFactor, 0.04 * scaleFactor),
      new THREE.Vector2(0.29 * scaleFactor, 0.03 * scaleFactor),
      new THREE.Vector2(0.26 * scaleFactor, 0.22 * scaleFactor),
      new THREE.Vector2(0.12 * scaleFactor, 0.25 * scaleFactor),
      new THREE.Vector2(0, 0.24 * scaleFactor),
    ];
    const strawHat = new THREE.Mesh(new THREE.LatheGeometry(hatPts, 36), strawMat);
    strawHat.position.y = headCenterY + 0.16 * scaleFactor;
    addOutline(strawHat, 1.025, 0x2a1810);
    const hatBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.285 * scaleFactor, 0.022 * scaleFactor, 12, 36),
      new THREE.MeshPhysicalMaterial({ color: 0xdc2626, roughness: 0.55 })
    );
    hatBand.rotation.x = Math.PI / 2;
    hatBand.position.y = headCenterY + 0.2 * scaleFactor;
    headPivot.add(strawHat, hatBand);
  } else if (kind === 'doctor') {
    addCurvedHairBangs(4, headCenterY + 0.115 * scaleFactor, headRadius * 0.88, 0.42);
    const band = new THREE.Mesh(new THREE.TorusGeometry(headRadius * 1.08, 0.016, 14, 36), darkMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = headCenterY + 0.14 * scaleFactor;
    const mirror = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075 * scaleFactor, 0.075 * scaleFactor, 0.025, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.1, clearcoat: 0.9 })
    );
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(0, headCenterY + 0.15 * scaleFactor, headRadius * 1.08);
    headPivot.add(band, mirror);
  } else if (kind === 'police') {
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scaleFactor, 0.26 * scaleFactor, 0.14, 36), pantsMat);
    capTop.position.y = headCenterY + 0.23 * scaleFactor;
    addOutline(capTop, 1.025, 0x2a1810);
    const visor = new THREE.Mesh(
      makeCurvedCapVisorGeo(0.54 * scaleFactor, 0.25 * scaleFactor, 0.02 * scaleFactor),
      darkMat
    );
    visor.position.set(0, headCenterY + 0.17 * scaleFactor, headRadius * 0.65);
    const goldBadge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.042 * scaleFactor, 1),
      new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.18, clearcoat: 0.7 })
    );
    goldBadge.position.set(0, headCenterY + 0.24 * scaleFactor, 0.28 * scaleFactor);
    headPivot.add(capTop, visor, goldBadge);
  } else if (kind === 'chef') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.265 * scaleFactor, 0.255 * scaleFactor, 0.14, 36), whiteMat);
    band.position.y = headCenterY + 0.22 * scaleFactor;
    addOutline(band, 1.025, 0x2a1810);
    // Puffy pleated toque crown made of overlapping smooth spheres
    const puffCenter = new THREE.Mesh(new THREE.SphereGeometry(0.25 * scaleFactor, 32, 24), whiteMat);
    puffCenter.scale.set(1.06, 0.88, 1.06);
    puffCenter.position.y = headCenterY + 0.4 * scaleFactor;
    addOutline(puffCenter, 1.025, 0x2a1810);
    headPivot.add(band, puffCenter);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.145 * scaleFactor, 22, 18), whiteMat);
      lobe.position.set(
        Math.cos(a) * 0.15 * scaleFactor,
        headCenterY + 0.37 * scaleFactor,
        Math.sin(a) * 0.15 * scaleFactor
      );
      headPivot.add(lobe);
    }
  } else if (kind === 'king' || kind === 'queen' || kind === 'prince' || kind === 'princess') {
    addCurvedHairBangs(4, headCenterY + 0.115 * scaleFactor, headRadius * 0.88, 0.45);
    const isTiara = kind === 'queen' || kind === 'princess';
    const crown = createCrownMesh(isTiara);
    crown.position.y = headCenterY + 0.25 * scaleFactor;
    headPivot.add(crown);
    if (kind === 'king') {
      const beard = new THREE.Mesh(
        new THREE.ConeGeometry(0.18 * scaleFactor, 0.24 * scaleFactor, 28),
        new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, roughness: 0.55, clearcoat: 0.3 })
      );
      beard.rotation.x = Math.PI;
      beard.position.set(0, headCenterY - 0.16 * scaleFactor, headRadius * 0.8);
      addOutline(beard, 1.025, 0x2a1810);
      headPivot.add(beard);
    }
  } else if (kind === 'angel') {
    addCurvedHairBangs(4, headCenterY + 0.115 * scaleFactor, headRadius * 0.88, 0.45);
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
    addCurvedHairBangs(4, headCenterY + 0.115 * scaleFactor, headRadius * 0.88, 0.48);
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
        ? new THREE.MeshPhysicalMaterial({ color: 0x1e1b4b, map: fabricTex, roughness: 0.45, clearcoat: 0.35 })
        : shirtMat;
    // Curved swooped Lathe brim + crooked pointed hat cone
    const brimPts = [
      new THREE.Vector2(0.49 * scaleFactor, -0.02 * scaleFactor),
      new THREE.Vector2(0.36 * scaleFactor, 0.02 * scaleFactor),
      new THREE.Vector2(0.24 * scaleFactor, 0.03 * scaleFactor),
      new THREE.Vector2(0, 0.03 * scaleFactor),
    ];
    const brim = new THREE.Mesh(new THREE.LatheGeometry(brimPts, 36), hatMat);
    brim.position.y = headCenterY + 0.185 * scaleFactor;
    addOutline(brim, 1.025, 0x2a1810);

    const hatCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.19 * scaleFactor, 0),
      new THREE.Vector3(0.02 * scaleFactor, 0.36 * scaleFactor, -0.02 * scaleFactor),
      new THREE.Vector3(-0.08 * scaleFactor, 0.54 * scaleFactor, -0.06 * scaleFactor),
      new THREE.Vector3(-0.18 * scaleFactor, 0.66 * scaleFactor, -0.1 * scaleFactor),
    ]);
    const coneGeo = new THREE.TubeGeometry(hatCurve, 18, 0.16 * scaleFactor, 24, false);
    // Taper tube smoothly to pointed tip along curve
    const cPos = coneGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const py = cPos.getY(i);
      const t = Math.max(0, Math.min(1, (py - 0.19 * scaleFactor) / (0.48 * scaleFactor)));
      const taper = Math.max(0.04, 1.38 * (1 - t * 0.95));
      const spine = hatCurve.getPoint(t);
      cPos.setXYZ(
        i,
        spine.x + (cPos.getX(i) - spine.x) * taper,
        py,
        spine.z + (cPos.getZ(i) - spine.z) * taper
      );
    }
    cPos.needsUpdate = true;
    coneGeo.computeVertexNormals();
    const cone = new THREE.Mesh(coneGeo, hatMat);
    cone.position.y = headCenterY;
    addOutline(cone, 1.025, 0x2a1810);

    const buckleBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.245 * scaleFactor, 0.026 * scaleFactor, 12, 34),
      new THREE.MeshPhysicalMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.65, clearcoat: 0.55 })
    );
    buckleBand.rotation.x = Math.PI / 2;
    buckleBand.position.y = headCenterY + 0.22 * scaleFactor;
    headPivot.add(brim, cone, buckleBand);
    if (kind === 'wizard') {
      const longBeard = new THREE.Mesh(
        new THREE.ConeGeometry(0.2 * scaleFactor, 0.42 * scaleFactor, 28),
        hairMat
      );
      longBeard.rotation.x = Math.PI;
      longBeard.position.set(0, headCenterY - 0.22 * scaleFactor, headRadius * 0.81);
      addOutline(longBeard, 1.025, 0x2a1810);
      headPivot.add(longBeard);
      accentMeshes.push(brim, cone);
    }
  } else if (kind === 'superhero') {
    addCurvedHairBangs(4, headCenterY + 0.115 * scaleFactor, headRadius * 0.88, 0.45);
    const mask = new THREE.Mesh(
      makeOrganicPouchGeo(0.37 * scaleFactor, 0.095 * scaleFactor, 0.06 * scaleFactor, 28),
      darkMat
    );
    mask.position.set(0, eyeY, eyeZ + 0.045 * scaleFactor);
    headPivot.add(mask);
  }

  // Smooth CapsuleGeometry Upper/Lower Arms + Spherical Elbow Joints + Articulated 3D Hands
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
    shoulder.position.set(side * 0.255 * scaleFactor, 0.04 * scaleFactor + torsoH - 0.065, 0);

    const shoulderJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.068 * scaleFactor, 24, 18),
      armMat
    );
    addOutline(shoulderJoint, 1.028);
    shoulder.add(shoulderJoint);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.056 * scaleFactor, 0.145 * scaleFactor, 12, 24),
      armMat
    );
    upperArm.position.y = -0.115 * scaleFactor;
    addOutline(upperArm, 1.028);
    shoulder.add(upperArm);
    if (kind !== 'doctor' && kind !== 'chef' && kind !== 'angel') accentMeshes.push(shoulderJoint, upperArm);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.y = -0.23 * scaleFactor;
    shoulder.add(forearmPivot);

    // Spherical elbow joint for seamless bending
    const forearmMat = kind === 'doctor' || kind === 'chef' || kind === 'angel' ? armMat : skinMat;
    const elbowJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.052 * scaleFactor, 24, 18),
      forearmMat
    );
    addOutline(elbowJoint, 1.028);
    forearmPivot.add(elbowJoint);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.046 * scaleFactor, 0.13 * scaleFactor, 12, 24),
      forearmMat
    );
    forearm.position.y = -0.105 * scaleFactor;
    addOutline(forearm, 1.028);
    forearmPivot.add(forearm);

    if (kind === 'father' && side === -1) {
      // Wristwatch on Father's left wrist
      const watchStrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.048 * scaleFactor, 0.011 * scaleFactor, 10, 24),
        darkMat
      );
      watchStrap.rotation.x = Math.PI / 2;
      watchStrap.position.y = -0.175 * scaleFactor;
      const watchFace = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022 * scaleFactor, 0.022 * scaleFactor, 0.012, 20),
        new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.15 })
      );
      watchFace.rotation.z = Math.PI / 2;
      watchFace.position.set(-0.048 * scaleFactor, -0.175 * scaleFactor, 0);
      forearmPivot.add(watchStrap, watchFace);
    }

    const hand = buildCartoonHand(
      side,
      scaleFactor,
      hasGloves ? gloveMat : skinMat,
      hasGloves,
      gloveCuffMat,
      addOutline
    );
    hand.position.y = -0.225 * scaleFactor;
    forearmPivot.add(hand);

    const handMount = new THREE.Group();
    handMount.position.set(0, -0.235 * scaleFactor, 0.048 * scaleFactor);
    forearmPivot.add(handMount);

    bodyPivot.add(shoulder);
    return { shoulder, forearmPivot, handMount };
  };

  const leftArm = createArm(-1);
  const rightArm = createArm(1);

  // Smooth CapsuleGeometry Upper/Lower Legs + Spherical Knee Joints + Laced 3D Sneakers
  const hasCargoPockets = ['boy', 'kid', 'son', 'twins', 'teenager'].includes(kind);
  const shoeSoleMat = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.35, clearcoat: 0.4 });
  const thighLen = (legLen - 0.1 * scaleFactor) * 0.52;
  const shinLen = (legLen - 0.1 * scaleFactor) * 0.48;

  const createLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115 * scaleFactor, 0, 0);

    const hipJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.086 * scaleFactor, 24, 18),
      pantsMat
    );
    addOutline(hipJoint, 1.026);
    hip.add(hipJoint);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.08 * scaleFactor, Math.max(0.06, thighLen - 0.08 * scaleFactor), 12, 24),
      pantsMat
    );
    thigh.position.y = -thighLen * 0.5;
    addOutline(thigh, 1.026);
    hip.add(thigh);

    if (hasCargoPockets) {
      const pocket = new THREE.Mesh(
        makeOrganicPouchGeo(0.05 * scaleFactor, 0.11 * scaleFactor, 0.11 * scaleFactor, 20),
        pantsMat
      );
      pocket.position.set(side * 0.078 * scaleFactor, -thighLen * 0.65, 0);
      addOutline(pocket, 1.028);
      hip.add(pocket);
    }

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -thighLen;
    hip.add(kneePivot);

    const kneeJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.072 * scaleFactor, 24, 18),
      pantsMat
    );
    addOutline(kneeJoint, 1.026);
    kneePivot.add(kneeJoint);

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.068 * scaleFactor, Math.max(0.05, shinLen - 0.06 * scaleFactor), 12, 24),
      pantsMat
    );
    shin.position.y = -shinLen * 0.5;
    addOutline(shin, 1.026);
    kneePivot.add(shin);

    const shoe = buildCartoonSneaker(scaleFactor, shoeMat, shoeSoleMat, shirtMat, addOutline);
    shoe.position.set(0, -shinLen - 0.1 * scaleFactor, 0);
    kneePivot.add(shoe);

    bodyPivot.add(hip);
    return { hip, kneePivot };
  };

  const leftLeg = createLeg(-1);
  const rightLeg = createLeg(1);

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
    leftLegPivot: leftLeg.hip,
    rightLegPivot: rightLeg.hip,
    leftKneePivot: leftLeg.kneePivot,
    rightKneePivot: rightLeg.kneePivot,
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

  const torso = new THREE.Mesh(
    makeTaperedTorsoGeo(0.56, 0.56, 0.4, 36),
    shellMat
  );
  torso.position.y = 0.08;
  addOutline(torso, 1.025, 0x111827);
  bodyPivot.add(torso);

  // Glowing cyan chest core bezel + orb
  const chestBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 36), jointMat);
  chestBezel.rotation.x = Math.PI / 2;
  chestBezel.position.set(0, 0.36, 0.185);
  const chestCore = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.06, 36), glowMat);
  chestCore.rotation.x = Math.PI / 2;
  chestCore.position.set(0, 0.36, 0.19);
  bodyPivot.add(chestBezel, chestCore);
  accentMeshes.push(chestCore);

  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.14, 36), jointMat);
  waist.position.y = 0.06;
  bodyPivot.add(waist);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.64;
  bodyPivot.add(headPivot);

  const headBox = new THREE.Mesh(makeOrganicPouchGeo(0.58, 0.44, 0.44, 40), shellMat);
  headBox.position.y = 0.23;
  addOutline(headBox, 1.025, 0x111827);
  headPivot.add(headBox);

  const visor = new THREE.Mesh(makeOrganicPouchGeo(0.43, 0.22, 0.14, 32), visorMat);
  visor.position.set(0, 0.24, 0.165);
  headPivot.add(visor);

  // Side Ear Pods
  [-1, 1].forEach((side) => {
    const earPod = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.06, 36), glowMat);
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
    eg.position.set(x, 0.25, 0.22);
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

  const browGeo = new THREE.CapsuleGeometry(0.01, 0.072, 8, 16);
  browGeo.rotateZ(Math.PI / 2);
  const leftBrow = new THREE.Mesh(browGeo, glowMat);
  leftBrow.position.set(-0.1, 0.328, 0.224);
  const rightBrow = new THREE.Mesh(browGeo, glowMat);
  rightBrow.position.set(0.1, 0.328, 0.224);

  headPivot.add(leftBrow, rightBrow);
  accentMeshes.push(leftBrow, rightBrow);

  // Cute Orange Smiling Beak Mouth
  const mouthMesh = new THREE.Mesh(makeOrganicPouchGeo(0.12, 0.048, 0.06, 24), orangeBeakMat);
  mouthMesh.position.set(0, 0.16, 0.215);
  headPivot.add(mouthMesh);

  // Antenna + Glowing Diamond Crystal
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.16, 24), jointMat);
  stem.position.y = 0.51;
  const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), glowMat);
  bulb.position.y = 0.62;
  headPivot.add(stem, bulb);
  accentMeshes.push(bulb);

  const makeRobotArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.33, 0.52, 0);

    shoulder.add(new THREE.Mesh(new THREE.SphereGeometry(0.076, 24, 18), jointMat));
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.135, 12, 24), shellMat);
    upper.position.y = -0.115;
    addOutline(upper, 1.025, 0x111827);
    shoulder.add(upper);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.y = -0.24;
    shoulder.add(forearmPivot);

    forearmPivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.058, 24, 18), jointMat));
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.12, 12, 24), shellMat);
    lower.position.y = -0.1;
    addOutline(lower, 1.025, 0x111827);
    forearmPivot.add(lower);

    const claw = buildCartoonHand(side, 0.98, jointMat, false, glowMat, (m, t) =>
      addOutline(m, t ?? 1.025, 0x111827)
    );
    claw.position.y = -0.22;
    forearmPivot.add(claw);

    const handMount = new THREE.Group();
    handMount.position.set(0, -0.235, 0.05);
    forearmPivot.add(handMount);

    bodyPivot.add(shoulder);
    return { shoulder, forearmPivot, handMount };
  };

  const leftArm = makeRobotArm(-1);
  const rightArm = makeRobotArm(1);

  const makeRobotLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, 0, 0);

    hip.add(new THREE.Mesh(new THREE.SphereGeometry(0.074, 24, 18), jointMat));
    const upperLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.13, 12, 24), shellMat);
    upperLeg.position.y = -0.11;
    addOutline(upperLeg, 1.025, 0x111827);
    hip.add(upperLeg);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.22;
    hip.add(kneePivot);

    kneePivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 24, 18), jointMat));
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.12, 12, 24), shellMat);
    shin.position.y = -0.1;
    addOutline(shin, 1.025, 0x111827);
    kneePivot.add(shin);

    const foot = buildCartoonSneaker(1.02, jointMat, shellMat, glowMat, (m, t) =>
      addOutline(m, t ?? 1.025, 0x111827)
    );
    foot.position.set(0, -baseBodyY + 0.22, 0);
    kneePivot.add(foot);

    bodyPivot.add(hip);
    return { hip, kneePivot };
  };

  const leftLeg = makeRobotLeg(-1);
  const rightLeg = makeRobotLeg(1);

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
    leftLegPivot: leftLeg.hip,
    rightLegPivot: rightLeg.hip,
    leftKneePivot: leftLeg.kneePivot,
    rightKneePivot: rightLeg.kneePivot,
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
