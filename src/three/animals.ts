import * as THREE from 'three';
import {
  AnimalKind,
  AnimationState,
  FacialExpression,
} from '../types/studio';
import {
  createAnimalCoatTexture,
  createContactShadowTexture,
  createEyeIrisTexture,
  createSpeechBubbleTexture,
} from './proceduralTextures';

export interface AnimalRig {
  kind: AnimalKind;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  mouthMesh: THREE.Mesh;
  leftBrow?: THREE.Mesh;
  rightBrow?: THREE.Mesh;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  backLeftPivot: THREE.Group;
  backRightPivot: THREE.Group;
  tailPivot?: THREE.Group;
  leftEarPivot?: THREE.Group;
  rightEarPivot?: THREE.Group;
  leftWingPivot?: THREE.Group;
  rightWingPivot?: THREE.Group;
  trunkPivot?: THREE.Group;
  selectionRing: THREE.Mesh;
  speechSprite: THREE.Sprite;
  lastDialogue: string;
  accentMeshes: THREE.Mesh[];
  baseBodyY: number;
  headHeight: number;
  phaseOffset: number;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getShadowTex(): THREE.CanvasTexture {
  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  return sharedShadowTex;
}

function createSelectionRing(radius = 0.48): THREE.Mesh {
  const geo = new THREE.RingGeometry(radius, radius + 0.1, 36);
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

function createContactShadow(radius = 0.5): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getShadowTex(),
    transparent: true,
    opacity: 0.5,
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

export function updateAnimalSpeechBubble(rig: AnimalRig, dialogue: string): void {
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
  rig.speechSprite.position.y = rig.headHeight + 0.52;
  rig.speechSprite.visible = true;
}

export function updateAnimalAccentColor(rig: AnimalRig, hexColor: string): void {
  for (const mesh of rig.accentMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat?.color) {
      mat.color.set(hexColor);
    }
  }
}

function enableShadows(group: THREE.Object3D): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      if (m.userData?.isOutline || m.userData?.isHitProxy) return;
      if (m.geometry.type !== 'RingGeometry' && m.geometry.type !== 'PlaneGeometry') {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    }
  });
}

function makeSculptedTorsoGeo(
  bellyR: number,
  chestR: number,
  rumpR: number,
  length: number,
  radialSegments = 26
): THREE.BufferGeometry {
  const half = length * 0.5;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, -half * 1.12),
    new THREE.Vector2(rumpR * 0.62, -half * 1.02),
    new THREE.Vector2(rumpR * 0.96, -half * 0.68),
    new THREE.Vector2(bellyR, 0),
    new THREE.Vector2(chestR * 0.98, half * 0.62),
    new THREE.Vector2(chestR * 0.7, half * 0.98),
    new THREE.Vector2(0, half * 1.12),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function makeTaperedAnimalLimb(
  topR: number,
  midR: number,
  botR: number,
  length: number,
  radialSegments = 18
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, -length - botR * 0.35),
    new THREE.Vector2(botR * 0.78, -length - botR * 0.22),
    new THREE.Vector2(botR, -length),
    new THREE.Vector2(midR, -length * 0.48),
    new THREE.Vector2(topR, -length * 0.12),
    new THREE.Vector2(topR * 0.86, topR * 0.24),
    new THREE.Vector2(0, topR * 0.44),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

function makeBirdWingGeo(side: -1 | 1): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.05);
  shape.quadraticCurveTo(side * 0.22, 0.14, side * 0.48, 0.04);
  shape.quadraticCurveTo(side * 0.56, -0.04, side * 0.46, -0.11);
  shape.quadraticCurveTo(side * 0.38, -0.15, side * 0.32, -0.12);
  shape.quadraticCurveTo(side * 0.24, -0.17, side * 0.16, -0.13);
  shape.quadraticCurveTo(side * 0.07, -0.17, 0, -0.09);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelSegments: 3,
    curveSegments: 14,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  geo.rotateX(Math.PI / 2);
  return geo;
}

function makeBirdTailGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.04, 0);
  shape.quadraticCurveTo(-0.16, -0.2, -0.11, -0.29);
  shape.quadraticCurveTo(-0.04, -0.32, 0, -0.28);
  shape.quadraticCurveTo(0.04, -0.32, 0.11, -0.29);
  shape.quadraticCurveTo(0.16, -0.2, 0.04, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelSegments: 2,
    curveSegments: 12,
    bevelSize: 0.01,
    bevelThickness: 0.01,
  });
  geo.rotateX(Math.PI / 2);
  return geo;
}

function makeFishFinGeo(w: number, h: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(w * 0.42, h * 0.72, w * 0.96, h * 0.94);
  shape.quadraticCurveTo(w * 1.12, h * 0.22, w * 0.78, -h * 0.5);
  shape.quadraticCurveTo(w * 0.36, -h * 0.32, 0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelSegments: 2,
    curveSegments: 12,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  });
  geo.center();
  return geo;
}

function makeCuteAnimalEye(
  irisHex: string,
  radius: number,
  eyelidMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.14,
    clearcoat: 0.65,
  });
  const irisMat = new THREE.MeshPhysicalMaterial({
    map: createEyeIrisTexture(irisHex),
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  catchMat.userData.sharedResource = true;

  const sclera = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), whiteMat);
  sclera.scale.set(0.96, 1.1, 0.64);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.84, 22, 16), irisMat);
  iris.scale.set(0.95, 1.08, 0.42);
  iris.position.z = radius * 0.42;
  iris.rotation.y = -Math.PI / 2;

  const sp1 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.22, 10, 8), catchMat);
  sp1.position.set(-radius * 0.26, radius * 0.32, radius * 0.76);
  const sp2 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.12, 8, 8), catchMat);
  sp2.position.set(radius * 0.24, -radius * 0.2, radius * 0.73);

  const lid = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.02, radius * 0.22, 10, 20, Math.PI * 0.86),
    eyelidMat
  );
  lid.rotation.z = Math.PI * 0.07;
  lid.rotation.x = 0.22;
  lid.position.set(0, radius * 0.14, radius * 0.24);

  g.add(sclera, iris, sp1, sp2, lid);
  return g;
}

function addAnimalEyebrows(
  headPivot: THREE.Group,
  eyeX: number,
  eyeY: number,
  eyeZ: number,
  scaleFactor: number,
  browColor: number
): { leftBrow: THREE.Mesh; rightBrow: THREE.Mesh } {
  const browMat = new THREE.MeshPhysicalMaterial({ color: browColor, roughness: 0.65 });
  const makeBrow = (side: -1 | 1) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * -0.028 * scaleFactor, -0.005 * scaleFactor, 0),
      new THREE.Vector3(0, 0.011 * scaleFactor, 0.004 * scaleFactor),
      new THREE.Vector3(side * 0.028 * scaleFactor, -0.004 * scaleFactor, 0),
    ]);
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 8, 0.011 * scaleFactor, 8, false),
      browMat
    );
    const baseY = eyeY + 0.068 * scaleFactor;
    mesh.position.set(side * eyeX, baseY, eyeZ + 0.01 * scaleFactor);
    mesh.userData.baseY = baseY;
    headPivot.add(mesh);
    return mesh;
  };
  return { leftBrow: makeBrow(-1), rightBrow: makeBrow(1) };
}

function createFlyingBird(accentColor: string): AnimalRig {
  const root = new THREE.Group();
  const accentMeshes: THREE.Mesh[] = [];
  const coatTex = createAnimalCoatTexture('bird');

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    map: coatTex,
    roughness: 0.44,
    clearcoat: 0.28,
    sheen: 0.35,
  });
  const bellyMat = new THREE.MeshPhysicalMaterial({
    color: 0xfefce8,
    roughness: 0.65,
    sheen: 0.25,
  });
  const wingTipMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentColor).offsetHSL(0.04, 0.1, -0.14),
    roughness: 0.48,
    clearcoat: 0.22,
  });
  const beakMat = new THREE.MeshPhysicalMaterial({
    color: 0xf97316,
    roughness: 0.26,
    clearcoat: 0.55,
  });

  const baseBodyY = 1.05;
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;
  root.add(bodyPivot);

  // Sculpted plump teardrop bird body
  const torso = new THREE.Mesh(makeSculptedTorsoGeo(0.21, 0.22, 0.15, 0.46, 26), bodyMat);
  torso.scale.set(1.0, 0.94, 1.08);
  bodyPivot.add(torso);
  accentMeshes.push(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.175, 22, 16), bellyMat);
  belly.scale.set(0.9, 0.84, 1.15);
  belly.position.set(0, -0.055, 0.06);
  bodyPivot.add(belly);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.18, 0.23);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.175, 28, 22), bodyMat);
  head.scale.set(1.08, 0.98, 1.04);
  headPivot.add(head);
  accentMeshes.push(head);

  // 3-feather adorable head crest
  [-0.08, 0, 0.08].forEach((ang, idx) => {
    const crestCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.13, 0.01),
      new THREE.Vector3(0, 0.22 + idx * 0.018, -0.04 - idx * 0.02),
      new THREE.Vector3(0, 0.28 + idx * 0.022, -0.12 - idx * 0.03),
    ]);
    const crest = new THREE.Mesh(
      new THREE.TubeGeometry(crestCurve, 10, 0.026 - idx * 0.003, 10, false),
      bodyMat
    );
    crest.rotation.y = ang * 1.6;
    headPivot.add(crest);
    accentMeshes.push(crest);
  });

  // Two-piece friendly beak (upper + animated lower)
  const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.145, 16), beakMat);
  upperBeak.rotation.x = Math.PI / 2;
  upperBeak.scale.set(1.15, 1, 0.72);
  upperBeak.position.set(0, 0.008, 0.195);
  headPivot.add(upperBeak);

  const mouthMesh = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.1, 14), beakMat);
  mouthMesh.rotation.x = Math.PI / 2 + 0.18;
  mouthMesh.scale.set(1.05, 0.55, 1.0);
  mouthMesh.position.set(0, -0.025, 0.175);
  headPivot.add(mouthMesh);

  const eyeL = makeCuteAnimalEye('#b45309', 0.048, bodyMat);
  eyeL.position.set(-0.098, 0.055, 0.125);
  eyeL.rotation.y = -0.35;
  const eyeR = makeCuteAnimalEye('#b45309', 0.048, bodyMat);
  eyeR.position.set(0.098, 0.055, 0.125);
  eyeR.rotation.y = 0.35;
  headPivot.add(eyeL, eyeR);

  // Rosy bird cheeks
  const blushMat = new THREE.MeshPhysicalMaterial({ color: 0xfb7185, transparent: true, opacity: 0.45, roughness: 0.7 });
  [-1, 1].forEach((side) => {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), blushMat);
    blush.scale.set(1.15, 0.7, 0.35);
    blush.position.set(side * 0.12, -0.015, 0.12);
    headPivot.add(blush);
  });

  const makeWing = (side: -1 | 1) => {
    const wp = new THREE.Group();
    wp.position.set(side * 0.18, 0.06, 0.02);
    const wing = new THREE.Mesh(makeBirdWingGeo(side), bodyMat);
    const secondary = new THREE.Mesh(makeBirdWingGeo(side), wingTipMat);
    secondary.scale.set(0.75, 0.75, 0.75);
    secondary.position.set(side * 0.05, -0.018, -0.03);
    wp.add(wing, secondary);
    accentMeshes.push(wing);
    bodyPivot.add(wp);
    return wp;
  };
  const leftWingPivot = makeWing(-1);
  const rightWingPivot = makeWing(1);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.02, -0.24);
  const tail = new THREE.Mesh(makeBirdTailGeo(), bodyMat);
  tail.rotation.x = 0.18;
  tailPivot.add(tail);
  accentMeshes.push(tail);
  bodyPivot.add(tailPivot);

  const makeFoot = (side: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.072, -0.17, 0.01);
    const stick = new THREE.Mesh(makeTaperedAnimalLimb(0.018, 0.014, 0.012, 0.13, 10), beakMat);
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8), beakMat);
    claw.scale.set(1.25, 0.48, 1.45);
    claw.position.set(0, -0.13, 0.02);
    leg.add(stick, claw);
    bodyPivot.add(leg);
    return leg;
  };
  const frontLeftPivot = makeFoot(-1);
  const frontRightPivot = makeFoot(1);
  const backLeftPivot = new THREE.Group();
  const backRightPivot = new THREE.Group();

  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.position.y = baseBodyY;
  hitProxy.userData.isHitProxy = true;
  root.add(hitProxy);

  const headHeight = 1.48;
  const selectionRing = createSelectionRing(0.44);
  const speechSprite = createSpeechSprite(headHeight + 0.52);
  const shadow = createContactShadow(0.38);

  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind: 'bird',
    root,
    bodyPivot,
    headPivot,
    mouthMesh,
    frontLeftPivot,
    frontRightPivot,
    backLeftPivot,
    backRightPivot,
    tailPivot,
    leftWingPivot,
    rightWingPivot,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    accentMeshes,
    baseBodyY,
    headHeight,
    phaseOffset: Math.random() * Math.PI * 2,
  };
}

function createFish(accentColor: string): AnimalRig {
  const root = new THREE.Group();
  const accentMeshes: THREE.Mesh[] = [];
  const coatTex = createAnimalCoatTexture('fish');

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    map: coatTex,
    roughness: 0.24,
    metalness: 0.06,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  });
  const finMat = new THREE.MeshPhysicalMaterial({
    color: 0xfef08a,
    roughness: 0.35,
    clearcoat: 0.55,
  });
  const lipMat = new THREE.MeshPhysicalMaterial({
    color: 0xfb7185,
    roughness: 0.28,
    clearcoat: 0.5,
  });

  const baseBodyY = 0.65;
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;
  root.add(bodyPivot);

  const torso = new THREE.Mesh(makeSculptedTorsoGeo(0.27, 0.26, 0.14, 0.64, 28), bodyMat);
  torso.scale.set(0.76, 1.02, 1.0);
  bodyPivot.add(torso);
  accentMeshes.push(torso);

  // Scalloped dorsal & ventral fins
  const dorsal = new THREE.Mesh(makeFishFinGeo(0.28, 0.26), finMat);
  dorsal.rotation.y = Math.PI / 2;
  dorsal.position.set(0, 0.26, -0.02);
  bodyPivot.add(dorsal);

  const ventral = new THREE.Mesh(makeFishFinGeo(0.14, 0.14), finMat);
  ventral.rotation.y = Math.PI / 2;
  ventral.rotation.x = Math.PI;
  ventral.position.set(0, -0.22, -0.08);
  bodyPivot.add(ventral);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.02, 0.25);
  bodyPivot.add(headPivot);

  const eyeL = makeCuteAnimalEye('#0284c7', 0.058, bodyMat);
  eyeL.position.set(-0.155, 0.078, 0.03);
  eyeL.rotation.y = -Math.PI / 2.7;
  const eyeR = makeCuteAnimalEye('#0284c7', 0.058, bodyMat);
  eyeR.position.set(0.155, 0.078, 0.03);
  eyeR.rotation.y = Math.PI / 2.7;
  headPivot.add(eyeL, eyeR);

  const mouthMesh = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.016, 12, 20), lipMat);
  mouthMesh.position.set(0, -0.042, 0.14);
  headPivot.add(mouthMesh);

  const makeFin = (side: -1 | 1) => {
    const fp = new THREE.Group();
    fp.position.set(side * 0.185, -0.04, 0.06);
    const fin = new THREE.Mesh(makeFishFinGeo(0.21, 0.16), finMat);
    fin.rotation.y = side * 0.65;
    fin.position.set(side * 0.08, 0, -0.04);
    fp.add(fin);
    bodyPivot.add(fp);
    return fp;
  };
  const leftWingPivot = makeFin(-1);
  const rightWingPivot = makeFin(1);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0, -0.34);
  const tail = new THREE.Mesh(makeFishFinGeo(0.32, 0.34), finMat);
  tail.rotation.y = -Math.PI / 2;
  tail.position.z = -0.15;
  tailPivot.add(tail);
  bodyPivot.add(tailPivot);

  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.position.y = baseBodyY;
  hitProxy.userData.isHitProxy = true;
  root.add(hitProxy);

  const headHeight = 1.08;
  const selectionRing = createSelectionRing(0.44);
  const speechSprite = createSpeechSprite(headHeight + 0.5);
  const shadow = createContactShadow(0.4);

  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind: 'fish',
    root,
    bodyPivot,
    headPivot,
    mouthMesh,
    frontLeftPivot: new THREE.Group(),
    frontRightPivot: new THREE.Group(),
    backLeftPivot: new THREE.Group(),
    backRightPivot: new THREE.Group(),
    tailPivot,
    leftWingPivot,
    rightWingPivot,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    accentMeshes,
    baseBodyY,
    headHeight,
    phaseOffset: Math.random() * Math.PI * 2,
  };
}

function createQuadrupedOrBipedAnimal(
  kind: Exclude<AnimalKind, 'bird' | 'fish'>,
  accentColor: string
): AnimalRig {
  const root = new THREE.Group();
  const accentMeshes: THREE.Mesh[] = [];

  const isDog = kind === 'dog';
  const isTiger = kind === 'tiger';
  const isLion = kind === 'lion';
  const isElephant = kind === 'elephant';
  const isHorse = kind === 'horse';
  const isRabbit = kind === 'rabbit';
  const isMonkey = kind === 'monkey';
  const isCat = kind === 'cat';

  const coatTex = createAnimalCoatTexture(kind);

  const furMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    map: coatTex,
    roughness: isElephant ? 0.8 : 0.68,
    metalness: 0.02,
    sheen: 0.55,
    sheenRoughness: 0.6,
    clearcoat: isHorse ? 0.14 : 0.05,
  });
  const bellyMat = new THREE.MeshPhysicalMaterial({
    color: isElephant
      ? 0xdbeafe
      : isTiger
        ? 0xffffff
        : isMonkey
          ? 0xfde68a
          : isHorse
            ? 0xf5ebe0
            : 0xfef3c7,
    roughness: 0.72,
    sheen: 0.35,
  });
  const darkMat = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    roughness: 0.22,
    metalness: 0.08,
    clearcoat: 0.65,
  });
  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: 0xf43f5e,
    roughness: 0.32,
    clearcoat: 0.4,
  });
  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: isElephant ? 0xfda4af : isRabbit || isCat ? 0xfbcfe8 : 0xfde68a,
    roughness: 0.62,
  });

  const scaleFactor = isElephant
    ? 1.38
    : isHorse
      ? 1.28
      : isLion || isTiger
        ? 1.15
        : isRabbit || isCat
          ? 0.9
          : 1.02;

  const baseBodyY = (isHorse ? 0.52 : isElephant ? 0.46 : 0.34) * scaleFactor;
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;
  root.add(bodyPivot);

  // Sculpted organic LatheGeometry torso (soft belly, chest & rump)
  const bellyR = (isElephant ? 0.3 : isRabbit ? 0.225 : 0.205) * scaleFactor;
  const chestR = (isElephant ? 0.28 : isLion ? 0.22 : isRabbit ? 0.175 : 0.195) * scaleFactor;
  const rumpR = (isElephant ? 0.29 : isRabbit ? 0.22 : 0.19) * scaleFactor;
  const torsoLen = (isHorse ? 0.72 : isElephant ? 0.68 : isRabbit ? 0.44 : 0.58) * scaleFactor;

  const torso = new THREE.Mesh(
    makeSculptedTorsoGeo(bellyR, chestR, rumpR, torsoLen, 26),
    furMat
  );
  torso.position.y = (isMonkey ? 0.24 : 0.14) * scaleFactor;
  if (isMonkey) {
    torso.rotation.x = -0.95;
  }
  bodyPivot.add(torso);
  accentMeshes.push(torso);

  // Soft plush belly & chest bib
  const chest = new THREE.Mesh(new THREE.SphereGeometry(chestR * 0.76, 18, 14), bellyMat);
  chest.scale.set(0.88, 1.06, 0.95);
  chest.position.set(
    0,
    (isMonkey ? 0.25 : 0.13) * scaleFactor,
    (isMonkey ? 0.11 : torsoLen * 0.36)
  );
  bodyPivot.add(chest);

  const underbelly = new THREE.Mesh(
    new THREE.SphereGeometry(bellyR * 0.78, 16, 12),
    bellyMat
  );
  underbelly.scale.set(0.84, 0.56, 1.28);
  underbelly.position.set(0, (isMonkey ? 0.16 : 0.03) * scaleFactor, isMonkey ? 0.08 * scaleFactor : 0);
  bodyPivot.add(underbelly);

  if (isDog) {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.175 * scaleFactor, 0.03 * scaleFactor, 12, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xef4444, roughness: 0.32, clearcoat: 0.55 })
    );
    collar.rotation.x = Math.PI / 2.35;
    collar.position.set(0, 0.24 * scaleFactor, 0.26 * scaleFactor);
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.044 * scaleFactor, 14, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.18 })
    );
    bell.position.set(0, 0.135 * scaleFactor, 0.375 * scaleFactor);
    bodyPivot.add(collar, bell);
  }

  // Head Pivot
  const headPivot = new THREE.Group();
  headPivot.position.set(
    0,
    (isHorse ? 0.56 : isMonkey ? 0.52 : 0.3) * scaleFactor,
    (isHorse ? 0.36 : isMonkey ? 0.09 : 0.31) * scaleFactor
  );
  bodyPivot.add(headPivot);

  if (isHorse) {
    // Arched muscular neck + sculpted 3D mane crest
    const neckPts = [
      new THREE.Vector2(0.16 * scaleFactor, -0.22 * scaleFactor),
      new THREE.Vector2(0.135 * scaleFactor, -0.05 * scaleFactor),
      new THREE.Vector2(0.11 * scaleFactor, 0.12 * scaleFactor),
      new THREE.Vector2(0.095 * scaleFactor, 0.22 * scaleFactor),
    ];
    const neck = new THREE.Mesh(new THREE.LatheGeometry(neckPts, 20), furMat);
    neck.position.set(0, -0.14 * scaleFactor, -0.08 * scaleFactor);
    neck.rotation.x = 0.44;
    headPivot.add(neck);
    accentMeshes.push(neck);

    const horseManeMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e1b18,
      roughness: 0.72,
      sheen: 0.3,
    });
    for (let i = 0; i < 6; i++) {
      const tuft = new THREE.Mesh(
        new THREE.SphereGeometry((0.068 - i * 0.004) * scaleFactor, 12, 10),
        horseManeMat
      );
      tuft.scale.set(0.68, 1.25, 1.35);
      tuft.position.set(
        0,
        (0.24 - i * 0.075) * scaleFactor,
        (-0.07 - i * 0.025) * scaleFactor
      );
      headPivot.add(tuft);
    }
    const forelock = new THREE.Mesh(
      new THREE.ConeGeometry(0.055 * scaleFactor, 0.14 * scaleFactor, 12),
      horseManeMat
    );
    forelock.position.set(0, 0.29 * scaleFactor, 0.12 * scaleFactor);
    forelock.rotation.x = 0.85;
    headPivot.add(forelock);
  }

  const headRadius = (isElephant ? 0.25 : isRabbit ? 0.205 : 0.23) * scaleFactor;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 32, 24), furMat);
  head.scale.set(1.1, 0.96, 1.04);
  head.position.y = 0.14 * scaleFactor;
  headPivot.add(head);
  accentMeshes.push(head);

  // Monkey warm tan rounded face mask
  if (isMonkey) {
    const faceMask = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 0.84, 24, 18),
      bellyMat
    );
    faceMask.scale.set(1.04, 0.86, 0.56);
    faceMask.position.set(0, 0.12 * scaleFactor, 0.115 * scaleFactor);
    headPivot.add(faceMask);
  }

  // Lion lush sculpted 14-tuft radial mane!
  if (isLion) {
    const maneMat = new THREE.MeshPhysicalMaterial({
      color: 0x78350f,
      roughness: 0.78,
      sheen: 0.45,
    });
    const tuftCount = 14;
    for (let i = 0; i < tuftCount; i++) {
      const ang = (i / tuftCount) * Math.PI * 2;
      const r = 0.24 * scaleFactor;
      const tuft = new THREE.Mesh(
        new THREE.SphereGeometry(0.095 * scaleFactor, 14, 12),
        maneMat
      );
      tuft.scale.set(0.95, 1.25, 0.86);
      tuft.position.set(
        Math.cos(ang) * r,
        0.14 * scaleFactor + Math.sin(ang) * r,
        -0.01 * scaleFactor
      );
      tuft.rotation.z = ang - Math.PI / 2;
      headPivot.add(tuft);
    }
    const maneBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.255 * scaleFactor, 20, 16),
      maneMat
    );
    maneBack.scale.set(1.12, 1.08, 0.76);
    maneBack.position.set(0, 0.14 * scaleFactor, -0.075 * scaleFactor);
    headPivot.add(maneBack);
  }

  // Cute top head fluff tuft for dog/cat/tiger/rabbit
  if (isDog || isCat || isTiger || isRabbit) {
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.042 * scaleFactor, 0.1 * scaleFactor, 12),
      furMat
    );
    tuft.position.set(0, 0.345 * scaleFactor, 0.03 * scaleFactor);
    tuft.rotation.x = -0.2;
    headPivot.add(tuft);
    accentMeshes.push(tuft);
  }

  let trunkPivot: THREE.Group | undefined;
  if (isElephant) {
    trunkPivot = new THREE.Group();
    trunkPivot.position.set(0, 0.1 * scaleFactor, 0.22 * scaleFactor);
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.14 * scaleFactor, 0.1 * scaleFactor),
      new THREE.Vector3(0, -0.28 * scaleFactor, 0.16 * scaleFactor),
      new THREE.Vector3(0, -0.32 * scaleFactor, 0.28 * scaleFactor),
    ]);
    const trunkMesh = new THREE.Mesh(
      new THREE.TubeGeometry(trunkCurve, 18, 0.056 * scaleFactor, 14, false),
      furMat
    );
    const trunkTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.054 * scaleFactor, 14, 12),
      innerEarMat
    );
    trunkTip.scale.set(1, 0.82, 0.7);
    trunkTip.position.set(0, -0.32 * scaleFactor, 0.29 * scaleFactor);
    trunkPivot.add(trunkMesh, trunkTip);
    accentMeshes.push(trunkMesh);

    // Smooth curved ivory tusks!
    const tuskMat = new THREE.MeshPhysicalMaterial({
      color: 0xfefce8,
      roughness: 0.2,
      clearcoat: 0.65,
    });
    [-1, 1].forEach((side) => {
      const tuskCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.11 * scaleFactor, 0.03 * scaleFactor, 0.18 * scaleFactor),
        new THREE.Vector3(side * 0.13 * scaleFactor, -0.02 * scaleFactor, 0.31 * scaleFactor),
        new THREE.Vector3(side * 0.11 * scaleFactor, 0.04 * scaleFactor, 0.39 * scaleFactor),
      ]);
      const tusk = new THREE.Mesh(
        new THREE.TubeGeometry(tuskCurve, 12, 0.024 * scaleFactor, 10, false),
        tuskMat
      );
      const tuskPoint = new THREE.Mesh(
        new THREE.ConeGeometry(0.024 * scaleFactor, 0.055 * scaleFactor, 10),
        tuskMat
      );
      tuskPoint.position.set(
        side * 0.105 * scaleFactor,
        0.055 * scaleFactor,
        0.405 * scaleFactor
      );
      tuskPoint.rotation.x = Math.PI / 3;
      headPivot.add(tusk, tuskPoint);
    });
    headPivot.add(trunkPivot);
  } else {
    // Sculpted animal snout + dual puffy whisker pads
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.098 * scaleFactor, 20, 16), bellyMat);
    snout.scale.set(1.14, 0.82, isHorse ? 1.65 : 1.16);
    snout.position.set(0, 0.095 * scaleFactor, (isHorse ? 0.23 : 0.175) * scaleFactor);
    headPivot.add(snout);

    [-1, 1].forEach((side) => {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.054 * scaleFactor, 16, 12), bellyMat);
      pad.scale.set(1.06, 0.9, 0.96);
      pad.position.set(
        side * 0.046 * scaleFactor,
        0.092 * scaleFactor,
        (isHorse ? 0.28 : 0.215) * scaleFactor
      );
      headPivot.add(pad);
    });

    // Sculpted delicate 3D whiskers for Cat, Rabbit, Lion, Tiger
    if (isCat || isRabbit || isLion || isTiger) {
      const whiskerMat = new THREE.MeshStandardMaterial({
        color: isCat || isRabbit ? 0xf8fafc : 0x1f2937,
        roughness: 0.45,
      });
      [-1, 1].forEach((side) => {
        [-0.14, 0, 0.14].forEach((pitch, idx) => {
          const wh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0028 * scaleFactor, 0.0045 * scaleFactor, 0.14 * scaleFactor, 6),
            whiskerMat
          );
          wh.rotation.z = side * (Math.PI / 2 + pitch);
          wh.rotation.y = side * -0.25;
          wh.position.set(
            side * 0.13 * scaleFactor,
            (0.096 - idx * 0.014) * scaleFactor,
            0.22 * scaleFactor
          );
          headPivot.add(wh);
        });
      });
    }
  }

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.044 * scaleFactor, 16, 12),
    isCat || isRabbit || isTiger ? mouthMat : darkMat
  );
  nose.scale.set(1.2, 0.82, 0.9);
  nose.position.set(
    0,
    0.134 * scaleFactor,
    (isElephant ? 0.25 : isHorse ? 0.355 : 0.27) * scaleFactor
  );
  if (!isElephant) headPivot.add(nose);

  const animalIrisHex = isCat ? '#16a34a' : isElephant ? '#0284c7' : isLion || isTiger ? '#d97706' : '#b45309';
  const eyeL = makeCuteAnimalEye(animalIrisHex, 0.052 * scaleFactor, furMat);
  eyeL.position.set(-0.102 * scaleFactor, 0.198 * scaleFactor, 0.184 * scaleFactor);
  const eyeR = makeCuteAnimalEye(animalIrisHex, 0.052 * scaleFactor, furMat);
  eyeR.position.set(0.102 * scaleFactor, 0.198 * scaleFactor, 0.184 * scaleFactor);
  headPivot.add(eyeL, eyeR);

  const { leftBrow, rightBrow } = addAnimalEyebrows(
    headPivot,
    0.102 * scaleFactor,
    0.198 * scaleFactor,
    0.188 * scaleFactor,
    scaleFactor,
    isLion || isHorse || isTiger ? 0x29180d : 0x3b2618
  );

  // Cute rosy cheek blushes
  const blushMat = new THREE.MeshPhysicalMaterial({
    color: 0xfb7185,
    transparent: true,
    opacity: 0.45,
    roughness: 0.7,
  });
  [-1, 1].forEach((side) => {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.038 * scaleFactor, 14, 10), blushMat);
    blush.scale.set(1.2, 0.72, 0.36);
    blush.position.set(side * 0.14 * scaleFactor, 0.125 * scaleFactor, 0.176 * scaleFactor);
    headPivot.add(blush);
  });

  const mouthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.04 * scaleFactor, 14, 10),
    mouthMat
  );
  mouthMesh.scale.set(1.32, 0.44, 0.86);
  mouthMesh.position.set(0, 0.046 * scaleFactor, (isHorse ? 0.28 : 0.215) * scaleFactor);
  headPivot.add(mouthMesh);

  // Cute rabbit buck teeth
  if (isRabbit) {
    const toothMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2 });
    [-0.015, 0.015].forEach((tx) => {
      const tooth = new THREE.Mesh(new THREE.SphereGeometry(0.014 * scaleFactor, 10, 8), toothMat);
      tooth.scale.set(0.9, 1.35, 0.55);
      tooth.position.set(tx * scaleFactor, 0.056 * scaleFactor, 0.242 * scaleFactor);
      headPivot.add(tooth);
    });
  }

  // Layered Curved Ears
  const makeEar = (side: -1 | 1) => {
    const ep = new THREE.Group();
    if (isRabbit) {
      ep.position.set(side * 0.095 * scaleFactor, 0.315 * scaleFactor, 0);
      const ear = new THREE.Mesh(
        makeTaperedAnimalLimb(0.045 * scaleFactor, 0.056 * scaleFactor, 0.036 * scaleFactor, 0.3 * scaleFactor, 16),
        furMat
      );
      ear.rotation.z = Math.PI + side * -0.15;
      ear.rotation.x = -0.12;
      const inner = new THREE.Mesh(
        makeTaperedAnimalLimb(0.026 * scaleFactor, 0.034 * scaleFactor, 0.02 * scaleFactor, 0.22 * scaleFactor, 14),
        innerEarMat
      );
      inner.position.set(0, 0.03 * scaleFactor, 0.02 * scaleFactor);
      inner.rotation.z = Math.PI + side * -0.15;
      inner.rotation.x = -0.12;
      ep.add(ear, inner);
      accentMeshes.push(ear);
    } else if (isElephant) {
      ep.position.set(side * 0.215 * scaleFactor, 0.16 * scaleFactor, -0.02);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.225 * scaleFactor, 22, 16), furMat);
      ear.scale.set(0.95, 1.22, 0.22);
      ear.position.set(side * 0.125 * scaleFactor, 0, -0.04);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.155 * scaleFactor, 16, 14), innerEarMat);
      inner.scale.set(0.88, 1.12, 0.18);
      inner.position.set(side * 0.125 * scaleFactor, -0.01 * scaleFactor, -0.016);
      ep.add(ear, inner);
      accentMeshes.push(ear);
    } else if (isCat || isHorse) {
      ep.position.set(side * 0.14 * scaleFactor, 0.305 * scaleFactor, 0);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075 * scaleFactor, 0.175 * scaleFactor, 16), furMat);
      ear.scale.set(1.0, 1.0, 0.68);
      ear.rotation.z = side * -0.22;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.046 * scaleFactor, 0.115 * scaleFactor, 14), innerEarMat);
      inner.scale.set(1.0, 1.0, 0.56);
      inner.position.set(side * 0.004 * scaleFactor, -0.01 * scaleFactor, 0.024 * scaleFactor);
      inner.rotation.z = side * -0.22;
      ep.add(ear, inner);
      accentMeshes.push(ear);
    } else if (isDog) {
      ep.position.set(side * 0.19 * scaleFactor, 0.24 * scaleFactor, 0.02);
      const flopCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.055 * scaleFactor, -0.09 * scaleFactor, 0.025 * scaleFactor),
        new THREE.Vector3(side * 0.045 * scaleFactor, -0.185 * scaleFactor, 0.045 * scaleFactor),
      ]);
      const ear = new THREE.Mesh(
        new THREE.TubeGeometry(flopCurve, 12, 0.048 * scaleFactor, 14, false),
        furMat
      );
      const earTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.052 * scaleFactor, 12, 10),
        furMat
      );
      earTip.position.set(side * 0.045 * scaleFactor, -0.185 * scaleFactor, 0.045 * scaleFactor);
      ep.add(ear, earTip);
      accentMeshes.push(ear, earTip);
    } else {
      ep.position.set(side * 0.175 * scaleFactor, 0.285 * scaleFactor, 0);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.072 * scaleFactor, 18, 14), furMat);
      ear.scale.set(1, 1, 0.54);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.048 * scaleFactor, 14, 12), innerEarMat);
      inner.scale.set(0.95, 0.95, 0.45);
      inner.position.z = 0.016 * scaleFactor;
      ep.add(ear, inner);
      accentMeshes.push(ear);
    }
    headPivot.add(ep);
    return ep;
  };
  const leftEarPivot = makeEar(-1);
  const rightEarPivot = makeEar(1);

  // Organic Curved Tails
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.21 * scaleFactor, -0.26 * scaleFactor);
  if (isRabbit) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.088 * scaleFactor, 16, 14), bellyMat);
    puff.position.set(0, 0, -0.04);
    const puffTop = new THREE.Mesh(new THREE.SphereGeometry(0.062 * scaleFactor, 12, 10), bellyMat);
    puffTop.position.set(0, 0.04 * scaleFactor, -0.06);
    tailPivot.add(puff, puffTop);
  } else {
    const tailPts = isMonkey
      ? [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0.16 * scaleFactor, -0.14 * scaleFactor),
          new THREE.Vector3(0.05 * scaleFactor, 0.35 * scaleFactor, -0.18 * scaleFactor),
          new THREE.Vector3(0.02 * scaleFactor, 0.46 * scaleFactor, -0.05 * scaleFactor),
        ]
      : isHorse || isLion
        ? [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.08 * scaleFactor, -0.14 * scaleFactor),
            new THREE.Vector3(0, -0.09 * scaleFactor, -0.25 * scaleFactor),
            new THREE.Vector3(0, -0.22 * scaleFactor, -0.29 * scaleFactor),
          ]
        : [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.11 * scaleFactor, -0.1 * scaleFactor),
            new THREE.Vector3(0, 0.24 * scaleFactor, -0.08 * scaleFactor),
          ];
    const tailCurve = new THREE.CatmullRomCurve3(tailPts);
    const tail = new THREE.Mesh(
      new THREE.TubeGeometry(tailCurve, 16, (isElephant ? 0.026 : 0.036) * scaleFactor, 12, false),
      isHorse ? new THREE.MeshPhysicalMaterial({ color: 0x1e1b18, roughness: 0.72 }) : furMat
    );
    tailPivot.add(tail);
    if (!isHorse) accentMeshes.push(tail);
    if (isLion || isElephant) {
      const tuft = new THREE.Mesh(
        new THREE.SphereGeometry(0.058 * scaleFactor, 12, 10),
        isLion ? new THREE.MeshPhysicalMaterial({ color: 0x78350f, roughness: 0.75 }) : darkMat
      );
      const endPt = tailPts[tailPts.length - 1];
      tuft.position.copy(endPt);
      tailPivot.add(tuft);
    }
  }
  bodyPivot.add(tailPivot);

  // Tapered LatheGeometry Legs + Multi-Toe Paws / Hooves
  const legLen = isHorse ? 0.44 : isElephant ? 0.36 : 0.24;
  const legRad = isElephant ? 0.098 : isHorse ? 0.052 : 0.06;
  const makeLeg = (x: number, z: number) => {
    const leg = new THREE.Group();
    leg.position.set(x * scaleFactor, 0.04 * scaleFactor, z * scaleFactor);
    const limb = new THREE.Mesh(
      makeTaperedAnimalLimb(
        legRad * 1.2 * scaleFactor,
        legRad * 0.94 * scaleFactor,
        legRad * 0.78 * scaleFactor,
        legLen * scaleFactor,
        16
      ),
      furMat
    );
    leg.add(limb);
    accentMeshes.push(limb);

    const paw = new THREE.Mesh(
      new THREE.SphereGeometry(legRad * 1.14 * scaleFactor, 16, 12),
      isHorse ? darkMat : isElephant ? furMat : bellyMat
    );
    paw.scale.set(1.06, 0.66, 1.26);
    paw.position.set(0, -(legLen + 0.02) * scaleFactor, 0.025 * scaleFactor);
    leg.add(paw);
    if (isElephant) accentMeshes.push(paw);

    if (!isHorse) {
      [-0.03, 0, 0.03].forEach((tx) => {
        const toe = new THREE.Mesh(
          new THREE.SphereGeometry(
            legRad * (isElephant ? 0.3 : 0.36) * scaleFactor,
            10,
            8
          ),
          isElephant ? innerEarMat : bellyMat
        );
        toe.position.set(
          tx * scaleFactor,
          -(legLen + 0.03) * scaleFactor,
          (0.074 - Math.abs(tx) * 0.25) * scaleFactor
        );
        leg.add(toe);
      });
    }

    bodyPivot.add(leg);
    return leg;
  };

  const frontLeftPivot = makeLeg(-0.135, isMonkey ? 0.08 : 0.2);
  const frontRightPivot = makeLeg(0.135, isMonkey ? 0.08 : 0.2);
  const backLeftPivot = makeLeg(-0.135, -0.19);
  const backRightPivot = makeLeg(0.135, -0.19);

  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38 * scaleFactor, 0.38 * scaleFactor, 1.1 * scaleFactor, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.position.y = 0.55 * scaleFactor;
  hitProxy.userData.isHitProxy = true;
  root.add(hitProxy);

  const headHeight = (isHorse ? 1.48 : isElephant ? 1.48 : 1.08) * scaleFactor;
  const selectionRing = createSelectionRing(0.48 * scaleFactor);
  const speechSprite = createSpeechSprite(headHeight + 0.52);
  const shadow = createContactShadow(0.5 * scaleFactor);

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
    frontLeftPivot,
    frontRightPivot,
    backLeftPivot,
    backRightPivot,
    tailPivot,
    leftEarPivot,
    rightEarPivot,
    trunkPivot,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    accentMeshes,
    baseBodyY,
    headHeight,
    phaseOffset: Math.random() * Math.PI * 2,
  };
}

export function createAnimalRig(kind: AnimalKind, accentColor: string): AnimalRig {
  if (kind === 'bird') return createFlyingBird(accentColor);
  if (kind === 'fish') return createFish(accentColor);
  return createQuadrupedOrBipedAnimal(kind, accentColor);
}

export function updateAnimalAnimation(
  rig: AnimalRig,
  animation: AnimationState,
  expression: FacialExpression,
  elapsed: number,
  delta: number,
  lipSyncLevel: number,
  autoLipSyncActive: boolean
): void {
  const k = 1 - Math.exp(-10 * Math.min(delta, 0.05));
  const t = elapsed + rig.phaseOffset * 0.25;

  let bodyY = rig.baseBodyY;
  let bodyRotX = 0;
  let bodyRotY = 0;
  let bodyRotZ = 0;
  let headRotX = 0;
  let headRotY = 0;
  let fLX = 0;
  let fRX = 0;
  let bLX = 0;
  let bRX = 0;
  let mouthScaleY = 1;
  let browOffsetY = 0;
  let browTilt = 0;

  if (expression === 'Surprised') {
    mouthScaleY = 1.9;
    browOffsetY = 0.025;
  } else if (expression === 'Sad') {
    headRotX = 0.18;
    browTilt = -0.22;
  } else if (expression === 'Angry') {
    browTilt = 0.3;
    browOffsetY = -0.01;
  } else {
    browOffsetY = 0.01;
  }

  switch (animation) {
    case 'Idle': {
      bodyY = rig.baseBodyY + Math.sin(t * 2.2) * 0.018;
      headRotY = Math.sin(t * 0.9) * 0.11;
      break;
    }

    case 'Walk': {
      const spd = 5.6;
      const sw = Math.sin(t * spd);
      bodyY = rig.baseBodyY + Math.abs(Math.cos(t * spd)) * 0.045;
      fLX = sw * 0.55;
      fRX = -sw * 0.55;
      bLX = -sw * 0.55;
      bRX = sw * 0.55;
      break;
    }

    case 'Run':
    case 'Run/Chase':
    case 'Running & Chasing': {
      const spd = 11.2;
      const gallop = Math.sin(t * spd);
      bodyY = rig.baseBodyY + Math.abs(gallop) * 0.14;
      bodyRotX = gallop * 0.14;
      fLX = gallop * 0.85;
      fRX = gallop * 0.72;
      bLX = -gallop * 0.85;
      bRX = -gallop * 0.72;
      break;
    }

    case 'Jump':
    case 'Jump/Hop': {
      const air = Math.max(0, Math.sin(t * 4.5));
      bodyY = rig.baseBodyY + air * 0.62;
      bodyRotX = -air * 0.24;
      fLX = -air * 0.5;
      fRX = -air * 0.5;
      bLX = air * 0.5;
      bRX = air * 0.5;
      break;
    }

    case 'Climb/Swing': {
      const sw = Math.sin(t * 5.2);
      bodyY = rig.baseBodyY + 0.18 + Math.abs(sw) * 0.15;
      bodyRotZ = sw * 0.14;
      fLX = -1.6 + sw * 0.7;
      fRX = -1.6 - sw * 0.7;
      bLX = sw * 0.35;
      bRX = -sw * 0.35;
      break;
    }

    case 'Sit': {
      bodyY = rig.baseBodyY - 0.12;
      bodyRotX = -0.35;
      bLX = 0.85;
      bRX = 0.85;
      break;
    }

    case 'Bark/Roar/Chirp':
    case 'Talk (Lip-Sync)': {
      const call = Math.abs(Math.sin(t * 8.5));
      bodyY = rig.baseBodyY + call * 0.03;
      headRotX = -0.18 - call * 0.18;
      mouthScaleY = 1 + call * 2.8;
      break;
    }

    case 'Wag Tail': {
      bodyY = rig.baseBodyY + Math.sin(t * 4) * 0.025;
      bodyRotY = Math.sin(t * 9) * 0.12;
      headRotY = Math.sin(t * 2) * 0.15;
      break;
    }

    case 'Swim': {
      const stroke = t * 5.4;
      bodyY = rig.baseBodyY * 0.75 + Math.sin(stroke * 0.6) * 0.06;
      bodyRotY = Math.sin(stroke) * 0.16;
      fLX = Math.sin(stroke) * 0.65;
      fRX = -Math.sin(stroke) * 0.65;
      bLX = -Math.sin(stroke) * 0.65;
      bRX = Math.sin(stroke) * 0.65;
      break;
    }

    case 'Fly': {
      const glide = t * 4.5;
      bodyY = rig.baseBodyY + Math.sin(glide * 0.5) * 0.25;
      bodyRotX = Math.cos(glide * 0.5) * 0.12;
      break;
    }

    case 'Sleep & Wake Up': {
      const phase = (t % 8.0) / 8.0;
      if (phase < 0.6) {
        bodyY = 0.22;
        bodyRotZ = Math.PI / 2 - 0.1;
        headRotX = 0.15;
      } else {
        const stretch = Math.sin(((phase - 0.6) / 0.4) * Math.PI);
        bodyY = rig.baseBodyY;
        bodyRotX = -0.22 * stretch;
        fLX = -0.45 * stretch;
        fRX = -0.45 * stretch;
      }
      break;
    }

    default: {
      bodyY = rig.baseBodyY + Math.sin(t * 2.5) * 0.02;
      break;
    }
  }

  if (autoLipSyncActive || lipSyncLevel > 0.05) {
    mouthScaleY =
      lipSyncLevel >= 0
        ? 1 + lipSyncLevel * 3.0
        : 1 + Math.max(0, Math.sin(t * 14)) * 2.2;
  }

  rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, bodyY, k);
  rig.bodyPivot.rotation.x = THREE.MathUtils.lerp(rig.bodyPivot.rotation.x, bodyRotX, k);
  rig.bodyPivot.rotation.y = THREE.MathUtils.lerp(rig.bodyPivot.rotation.y, bodyRotY, k);
  rig.bodyPivot.rotation.z = THREE.MathUtils.lerp(rig.bodyPivot.rotation.z, bodyRotZ, k);

  rig.headPivot.rotation.x = THREE.MathUtils.lerp(rig.headPivot.rotation.x, headRotX, k);
  rig.headPivot.rotation.y = THREE.MathUtils.lerp(rig.headPivot.rotation.y, headRotY, k);

  if (rig.leftBrow && rig.rightBrow) {
    rig.leftBrow.rotation.z = THREE.MathUtils.lerp(rig.leftBrow.rotation.z, -browTilt, k);
    rig.rightBrow.rotation.z = THREE.MathUtils.lerp(rig.rightBrow.rotation.z, browTilt, k);
    const baseL =
      typeof rig.leftBrow.userData?.baseY === 'number'
        ? rig.leftBrow.userData.baseY
        : rig.leftBrow.position.y;
    const baseR =
      typeof rig.rightBrow.userData?.baseY === 'number'
        ? rig.rightBrow.userData.baseY
        : rig.rightBrow.position.y;
    rig.leftBrow.position.y = THREE.MathUtils.lerp(
      rig.leftBrow.position.y,
      baseL + browOffsetY * 0.035,
      k
    );
    rig.rightBrow.position.y = THREE.MathUtils.lerp(
      rig.rightBrow.position.y,
      baseR + browOffsetY * 0.035,
      k
    );
  }

  rig.frontLeftPivot.rotation.x = THREE.MathUtils.lerp(rig.frontLeftPivot.rotation.x, fLX, k);
  rig.frontRightPivot.rotation.x = THREE.MathUtils.lerp(rig.frontRightPivot.rotation.x, fRX, k);
  rig.backLeftPivot.rotation.x = THREE.MathUtils.lerp(rig.backLeftPivot.rotation.x, bLX, k);
  rig.backRightPivot.rotation.x = THREE.MathUtils.lerp(rig.backRightPivot.rotation.x, bRX, k);

  rig.mouthMesh.scale.y = THREE.MathUtils.lerp(rig.mouthMesh.scale.y, mouthScaleY, Math.min(1, k * 2));

  if (rig.tailPivot) {
    const wagSpd = animation === 'Wag Tail' ? 14 : rig.kind === 'fish' ? 10 : 6.5;
    rig.tailPivot.rotation.y = Math.sin(t * wagSpd) * (rig.kind === 'fish' ? 0.42 : 0.35);
    rig.tailPivot.rotation.z = rig.kind === 'fish' ? 0 : Math.sin(t * wagSpd) * 0.25;
  }

  if (rig.leftWingPivot && rig.rightWingPivot) {
    const flapSpd = animation === 'Fly' || animation === 'Swim' ? 12 : 4.5;
    const amp = rig.kind === 'fish' ? 0.25 : animation === 'Fly' ? 0.65 : 0.15;
    rig.leftWingPivot.rotation.z = Math.sin(t * flapSpd) * amp;
    rig.rightWingPivot.rotation.z = -Math.sin(t * flapSpd) * amp;
  }

  if (rig.trunkPivot) {
    rig.trunkPivot.rotation.x = Math.sin(t * 2.8) * 0.22;
  }

  if (rig.leftEarPivot && rig.rightEarPivot && (rig.kind === 'rabbit' || rig.kind === 'dog' || rig.kind === 'elephant')) {
    const bounce = Math.sin(t * 4.5) * 0.1;
    rig.leftEarPivot.rotation.z = bounce;
    rig.rightEarPivot.rotation.z = -bounce;
  }
}

export function disposeAnimalRig(rig: AnimalRig): void {
  const mat = rig.speechSprite.material as THREE.SpriteMaterial;
  if (mat.map) mat.map.dispose();
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
