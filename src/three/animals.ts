import * as THREE from 'three';
import {
  AnimalKind,
  AnimationState,
  FacialExpression,
} from '../types/studio';
import {
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
    mat.color.set(hexColor);
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

function makeTaperedAnimalLimb(
  topR: number,
  midR: number,
  botR: number,
  length: number,
  radialSegments = 16
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, -length - botR * 0.4),
    new THREE.Vector2(botR * 0.72, -length - botR * 0.25),
    new THREE.Vector2(botR, -length),
    new THREE.Vector2(midR, -length * 0.5),
    new THREE.Vector2(topR, -length * 0.14),
    new THREE.Vector2(topR * 0.85, topR * 0.26),
    new THREE.Vector2(0, topR * 0.46),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

function makeBirdWingGeo(side: -1 | 1): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.04);
  shape.quadraticCurveTo(side * 0.24, 0.1, side * 0.46, 0.02);
  shape.quadraticCurveTo(side * 0.52, -0.06, side * 0.4, -0.13);
  shape.quadraticCurveTo(side * 0.28, -0.17, side * 0.18, -0.14);
  shape.quadraticCurveTo(side * 0.08, -0.17, 0, -0.1);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSegments: 3,
    curveSegments: 12,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  geo.rotateX(Math.PI / 2);
  return geo;
}

function makeBirdTailGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.04, 0);
  shape.quadraticCurveTo(-0.13, -0.18, -0.09, -0.26);
  shape.quadraticCurveTo(0, -0.32, 0.09, -0.26);
  shape.quadraticCurveTo(0.13, -0.18, 0.04, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelSegments: 2,
    curveSegments: 10,
    bevelSize: 0.01,
    bevelThickness: 0.01,
  });
  geo.rotateX(Math.PI / 2);
  return geo;
}

function makeFishFinGeo(w: number, h: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(w * 0.45, h * 0.65, w * 0.95, h * 0.92);
  shape.quadraticCurveTo(w * 1.1, h * 0.2, w * 0.72, -h * 0.48);
  shape.quadraticCurveTo(w * 0.35, -h * 0.3, 0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelSegments: 2,
    curveSegments: 10,
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
  const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.16, clearcoat: 0.55 });
  const irisMat = new THREE.MeshPhysicalMaterial({
    map: createEyeIrisTexture(irisHex),
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  catchMat.userData.sharedResource = true;

  const sclera = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), whiteMat);
  sclera.scale.set(0.95, 1.08, 0.62);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.82, 18, 14), irisMat);
  iris.scale.set(0.95, 1.06, 0.42);
  iris.position.z = radius * 0.42;
  iris.rotation.y = -Math.PI / 2;

  const sp1 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.2, 10, 8), catchMat);
  sp1.position.set(-radius * 0.26, radius * 0.3, radius * 0.75);
  const sp2 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.11, 8, 8), catchMat);
  sp2.position.set(radius * 0.24, -radius * 0.2, radius * 0.72);

  // Sculpted protruding upper eyelid hood
  const lid = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.02, radius * 0.24, 10, 18, Math.PI * 0.86),
    eyelidMat
  );
  lid.rotation.z = Math.PI * 0.07;
  lid.rotation.x = 0.22;
  lid.position.set(0, radius * 0.14, radius * 0.24);

  g.add(sclera, iris, sp1, sp2, lid);
  return g;
}

function createFlyingBird(accentColor: string): AnimalRig {
  const root = new THREE.Group();
  const accentMeshes: THREE.Mesh[] = [];
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: accentColor, roughness: 0.46, clearcoat: 0.28 });
  const bellyMat = new THREE.MeshPhysicalMaterial({ color: 0xfefce8, roughness: 0.65 });
  const beakMat = new THREE.MeshPhysicalMaterial({ color: 0xf97316, roughness: 0.3, clearcoat: 0.5 });

  const baseBodyY = 1.05;
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;
  root.add(bodyPivot);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), bodyMat);
  torso.scale.set(0.95, 0.92, 1.35);
  bodyPivot.add(torso);
  accentMeshes.push(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.175, 18, 14), bellyMat);
  belly.scale.set(0.92, 0.85, 1.15);
  belly.position.set(0, -0.05, 0.05);
  bodyPivot.add(belly);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.16, 0.24);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 24, 18), bodyMat);
  head.scale.set(1.06, 0.98, 1.02);
  headPivot.add(head);
  accentMeshes.push(head);

  const crestCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.12, 0.02),
    new THREE.Vector3(0, 0.21, -0.03),
    new THREE.Vector3(0, 0.26, -0.1),
  ]);
  const crest = new THREE.Mesh(new THREE.TubeGeometry(crestCurve, 10, 0.032, 10, false), bodyMat);
  headPivot.add(crest);
  accentMeshes.push(crest);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.14, 14), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.scale.set(1.1, 1, 0.75);
  beak.position.set(0, 0.005, 0.185);
  headPivot.add(beak);

  const mouthMesh = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), beakMat);
  mouthMesh.scale.set(1.15, 0.45, 1.3);
  mouthMesh.position.set(0, -0.028, 0.155);
  headPivot.add(mouthMesh);

  const eyeL = makeCuteAnimalEye('#b45309', 0.044, bodyMat);
  eyeL.position.set(-0.092, 0.052, 0.118);
  eyeL.rotation.y = -0.35;
  const eyeR = makeCuteAnimalEye('#b45309', 0.044, bodyMat);
  eyeR.position.set(0.092, 0.052, 0.118);
  eyeR.rotation.y = 0.35;
  headPivot.add(eyeL, eyeR);

  const makeWing = (side: -1 | 1) => {
    const wp = new THREE.Group();
    wp.position.set(side * 0.18, 0.06, 0.02);
    const wing = new THREE.Mesh(makeBirdWingGeo(side), bodyMat);
    wp.add(wing);
    accentMeshes.push(wing);
    bodyPivot.add(wp);
    return wp;
  };
  const leftWingPivot = makeWing(-1);
  const rightWingPivot = makeWing(1);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.02, -0.25);
  const tail = new THREE.Mesh(makeBirdTailGeo(), bodyMat);
  tail.rotation.x = 0.16;
  tailPivot.add(tail);
  accentMeshes.push(tail);
  bodyPivot.add(tailPivot);

  const makeFoot = (side: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.07, -0.18, 0);
    const stick = new THREE.Mesh(makeTaperedAnimalLimb(0.018, 0.014, 0.012, 0.12, 10), beakMat);
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), beakMat);
    claw.scale.set(1.2, 0.5, 1.4);
    claw.position.set(0, -0.12, 0.018);
    leg.add(stick, claw);
    bodyPivot.add(leg);
    return leg;
  };
  const frontLeftPivot = makeFoot(-1);
  const frontRightPivot = makeFoot(1);
  const backLeftPivot = new THREE.Group();
  const backRightPivot = new THREE.Group();

  const headHeight = 1.45;
  const selectionRing = createSelectionRing();
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
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: accentColor, roughness: 0.28, metalness: 0.1, clearcoat: 0.85 });
  const finMat = new THREE.MeshPhysicalMaterial({ color: 0xfef08a, roughness: 0.4, clearcoat: 0.4 });

  const baseBodyY = 0.62;
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;
  root.add(bodyPivot);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 18), bodyMat);
  torso.scale.set(0.74, 0.96, 1.48);
  bodyPivot.add(torso);
  accentMeshes.push(torso);

  const dorsal = new THREE.Mesh(makeFishFinGeo(0.24, 0.22), finMat);
  dorsal.rotation.y = Math.PI / 2;
  dorsal.position.set(0, 0.24, -0.02);
  bodyPivot.add(dorsal);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.02, 0.26);
  bodyPivot.add(headPivot);

  const eyeL = makeCuteAnimalEye('#0284c7', 0.052, bodyMat);
  eyeL.position.set(-0.148, 0.07, 0.015);
  eyeL.rotation.y = -Math.PI / 2.6;
  const eyeR = makeCuteAnimalEye('#0284c7', 0.052, bodyMat);
  eyeR.position.set(0.148, 0.07, 0.015);
  eyeR.rotation.y = Math.PI / 2.6;
  headPivot.add(eyeL, eyeR);

  const mouthMesh = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.016, 10, 18), finMat);
  mouthMesh.position.set(0, -0.04, 0.13);
  headPivot.add(mouthMesh);

  const makeFin = (side: -1 | 1) => {
    const fp = new THREE.Group();
    fp.position.set(side * 0.18, -0.04, 0.06);
    const fin = new THREE.Mesh(makeFishFinGeo(0.18, 0.14), finMat);
    fin.rotation.y = side * 0.65;
    fin.position.set(side * 0.07, 0, -0.04);
    fp.add(fin);
    bodyPivot.add(fp);
    return fp;
  };
  const leftWingPivot = makeFin(-1);
  const rightWingPivot = makeFin(1);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0, -0.35);
  const tail = new THREE.Mesh(makeFishFinGeo(0.28, 0.28), finMat);
  tail.rotation.y = -Math.PI / 2;
  tail.position.z = -0.14;
  tailPivot.add(tail);
  bodyPivot.add(tailPivot);

  const headHeight = 1.05;
  const selectionRing = createSelectionRing();
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

  const isTiger = kind === 'tiger';
  const isLion = kind === 'lion';
  const isElephant = kind === 'elephant';
  const isHorse = kind === 'horse';
  const isRabbit = kind === 'rabbit';
  const isMonkey = kind === 'monkey';
  const isCat = kind === 'cat';

  const furMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    roughness: 0.72,
    metalness: 0.02,
    sheen: 0.45,
    sheenRoughness: 0.65,
  });
  const bellyMat = new THREE.MeshPhysicalMaterial({
    color: isElephant ? 0xcbd5e1 : isTiger ? 0xffffff : isMonkey ? 0xfde68a : 0xfef3c7,
    roughness: 0.78,
    sheen: 0.3,
  });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x111827, roughness: 0.2, metalness: 0.08, clearcoat: 0.6 });
  const mouthMat = new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, roughness: 0.35, clearcoat: 0.35 });

  const scaleFactor = isElephant
    ? 1.38
    : isHorse
      ? 1.28
      : isLion || isTiger
        ? 1.15
        : isRabbit || isCat
          ? 0.88
          : 1.0;

  const baseBodyY = (isHorse ? 0.52 : isElephant ? 0.46 : 0.34) * scaleFactor;
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;
  root.add(bodyPivot);

  // Torso
  const torsoRadius = isElephant ? 0.28 : isRabbit ? 0.2 : 0.19;
  const torsoLen = isHorse ? 0.56 : isElephant ? 0.5 : isRabbit ? 0.28 : 0.42;
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(torsoRadius * scaleFactor, torsoLen * scaleFactor, 8, 16),
    furMat
  );
  torso.rotation.x = isMonkey ? 0.35 : Math.PI / 2;
  torso.position.y = (isMonkey ? 0.24 : 0.14) * scaleFactor;
  bodyPivot.add(torso);
  accentMeshes.push(torso);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scaleFactor, 12, 10), bellyMat);
  chest.position.set(0, 0.14 * scaleFactor, 0.2 * scaleFactor);
  bodyPivot.add(chest);

  if (isTiger) {
    [-0.14, 0, 0.14].forEach((sz) => {
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.185 * scaleFactor, 0.022 * scaleFactor, 6, 18),
        darkMat
      );
      stripe.position.set(0, 0.14 * scaleFactor, sz * scaleFactor);
      bodyPivot.add(stripe);
    });
  } else if (kind === 'dog') {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.032, 10, 20),
      new THREE.MeshPhysicalMaterial({ color: 0xef4444, roughness: 0.35, clearcoat: 0.5 })
    );
    collar.rotation.x = Math.PI / 2.4;
    collar.position.set(0, 0.24, 0.25);
    bodyPivot.add(collar);
  }

  // Head
  const headPivot = new THREE.Group();
  headPivot.position.set(
    0,
    (isHorse ? 0.54 : isMonkey ? 0.48 : 0.28) * scaleFactor,
    (isHorse ? 0.34 : isMonkey ? 0.08 : 0.3) * scaleFactor
  );
  bodyPivot.add(headPivot);

  if (isHorse) {
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * scaleFactor, 0.16 * scaleFactor, 0.42 * scaleFactor, 12),
      furMat
    );
    neck.position.set(0, -0.14 * scaleFactor, -0.08 * scaleFactor);
    neck.rotation.x = 0.45;
    headPivot.add(neck);
    accentMeshes.push(neck);
  }

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: isElephant ? 0xfda4af : isRabbit || isCat ? 0xfbcfe8 : 0xfde68a,
    roughness: 0.65,
  });

  const headRadius = (isElephant ? 0.24 : isRabbit ? 0.195 : 0.225) * scaleFactor;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 28, 22), furMat);
  head.scale.set(1.09, 0.96, 1.03);
  head.position.y = 0.14 * scaleFactor;
  headPivot.add(head);
  accentMeshes.push(head);

  if (isLion) {
    const maneMat = new THREE.MeshPhysicalMaterial({ color: 0x78350f, roughness: 0.78 });
    const mane = new THREE.Mesh(new THREE.TorusGeometry(0.21 * scaleFactor, 0.085 * scaleFactor, 12, 24), maneMat);
    mane.position.set(0, 0.14 * scaleFactor, 0.02 * scaleFactor);
    headPivot.add(mane);
  }

  let trunkPivot: THREE.Group | undefined;
  if (isElephant) {
    trunkPivot = new THREE.Group();
    trunkPivot.position.set(0, 0.1 * scaleFactor, 0.21 * scaleFactor);
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.14 * scaleFactor, 0.09 * scaleFactor),
      new THREE.Vector3(0, -0.28 * scaleFactor, 0.14 * scaleFactor),
      new THREE.Vector3(0, -0.34 * scaleFactor, 0.24 * scaleFactor),
    ]);
    const trunk1 = new THREE.Mesh(
      new THREE.TubeGeometry(trunkCurve, 14, 0.056 * scaleFactor, 12, false),
      furMat
    );
    trunkPivot.add(trunk1);
    accentMeshes.push(trunk1);

    const tuskMat = new THREE.MeshPhysicalMaterial({ color: 0xfefce8, roughness: 0.25, clearcoat: 0.5 });
    [-0.1, 0.1].forEach((tx) => {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.03 * scaleFactor, 0.2 * scaleFactor, 10), tuskMat);
      tusk.position.set(tx * scaleFactor, 0.02 * scaleFactor, 0.24 * scaleFactor);
      tusk.rotation.x = Math.PI / 2.2;
      headPivot.add(tusk);
    });
    headPivot.add(trunkPivot);
  } else {
    // Sculpted rounded animal snout + puffy dual whisker pads
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.095 * scaleFactor, 18, 14), bellyMat);
    snout.scale.set(1.12, 0.82, isHorse ? 1.55 : 1.15);
    snout.position.set(0, 0.095 * scaleFactor, (isHorse ? 0.22 : 0.17) * scaleFactor);
    headPivot.add(snout);

    [-1, 1].forEach((side) => {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.052 * scaleFactor, 14, 12), bellyMat);
      pad.scale.set(1.05, 0.9, 0.95);
      pad.position.set(
        side * 0.044 * scaleFactor,
        0.092 * scaleFactor,
        (isHorse ? 0.27 : 0.21) * scaleFactor
      );
      headPivot.add(pad);
    });
  }

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.042 * scaleFactor, 14, 12),
    isCat || isRabbit || isTiger ? mouthMat : darkMat
  );
  nose.scale.set(1.18, 0.82, 0.9);
  nose.position.set(0, 0.132 * scaleFactor, (isElephant ? 0.24 : isHorse ? 0.34 : 0.265) * scaleFactor);
  if (!isElephant) headPivot.add(nose);

  const animalIrisHex = isCat ? '#16a34a' : isElephant ? '#0284c7' : '#b45309';
  const eyeL = makeCuteAnimalEye(animalIrisHex, 0.05 * scaleFactor, furMat);
  eyeL.position.set(-0.098 * scaleFactor, 0.195 * scaleFactor, 0.18 * scaleFactor);
  const eyeR = makeCuteAnimalEye(animalIrisHex, 0.05 * scaleFactor, furMat);
  eyeR.position.set(0.098 * scaleFactor, 0.195 * scaleFactor, 0.18 * scaleFactor);
  headPivot.add(eyeL, eyeR);

  // Cute rosy cheek blushes
  const blushMat = new THREE.MeshPhysicalMaterial({ color: 0xfb7185, transparent: true, opacity: 0.42, roughness: 0.7 });
  [-1, 1].forEach((side) => {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.036 * scaleFactor, 12, 10), blushMat);
    blush.scale.set(1.2, 0.72, 0.35);
    blush.position.set(side * 0.135 * scaleFactor, 0.125 * scaleFactor, 0.175 * scaleFactor);
    headPivot.add(blush);
  });

  const mouthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.038 * scaleFactor, 14, 10),
    mouthMat
  );
  mouthMesh.scale.set(1.3, 0.42, 0.85);
  mouthMesh.position.set(0, 0.045 * scaleFactor, 0.21 * scaleFactor);
  headPivot.add(mouthMesh);

  // Layered Curved Ears (Outer fur + Inner warm ear cup)
  const makeEar = (side: -1 | 1) => {
    const ep = new THREE.Group();
    if (isRabbit) {
      ep.position.set(side * 0.09 * scaleFactor, 0.31 * scaleFactor, 0);
      const ear = new THREE.Mesh(makeTaperedAnimalLimb(0.042 * scaleFactor, 0.052 * scaleFactor, 0.034 * scaleFactor, 0.28 * scaleFactor, 14), furMat);
      ear.rotation.z = Math.PI + side * -0.15;
      ear.rotation.x = -0.12;
      const inner = new THREE.Mesh(makeTaperedAnimalLimb(0.025 * scaleFactor, 0.032 * scaleFactor, 0.02 * scaleFactor, 0.2 * scaleFactor, 12), innerEarMat);
      inner.position.set(0, 0.03 * scaleFactor, 0.018 * scaleFactor);
      inner.rotation.z = Math.PI + side * -0.15;
      inner.rotation.x = -0.12;
      ep.add(ear, inner);
      accentMeshes.push(ear);
    } else if (isElephant) {
      ep.position.set(side * 0.21 * scaleFactor, 0.16 * scaleFactor, -0.02);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.21 * scaleFactor, 18, 14), furMat);
      ear.scale.set(0.95, 1.18, 0.22);
      ear.position.set(side * 0.12 * scaleFactor, 0, -0.04);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.145 * scaleFactor, 14, 12), innerEarMat);
      inner.scale.set(0.88, 1.08, 0.18);
      inner.position.set(side * 0.12 * scaleFactor, -0.01 * scaleFactor, -0.018);
      ep.add(ear, inner);
      accentMeshes.push(ear);
    } else if (isCat || isHorse) {
      ep.position.set(side * 0.135 * scaleFactor, 0.3 * scaleFactor, 0);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.072 * scaleFactor, 0.165 * scaleFactor, 14), furMat);
      ear.scale.set(1.0, 1.0, 0.65);
      ear.rotation.z = side * -0.22;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.044 * scaleFactor, 0.11 * scaleFactor, 12), innerEarMat);
      inner.scale.set(1.0, 1.0, 0.55);
      inner.position.set(side * 0.004 * scaleFactor, -0.01 * scaleFactor, 0.022 * scaleFactor);
      inner.rotation.z = side * -0.22;
      ep.add(ear, inner);
      accentMeshes.push(ear);
    } else if (kind === 'dog') {
      ep.position.set(side * 0.185 * scaleFactor, 0.23 * scaleFactor, 0.02);
      const flopCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.05 * scaleFactor, -0.08 * scaleFactor, 0.02 * scaleFactor),
        new THREE.Vector3(side * 0.04 * scaleFactor, -0.17 * scaleFactor, 0.04 * scaleFactor),
      ]);
      const ear = new THREE.Mesh(new THREE.TubeGeometry(flopCurve, 10, 0.046 * scaleFactor, 12, false), furMat);
      ep.add(ear);
      accentMeshes.push(ear);
    } else {
      ep.position.set(side * 0.17 * scaleFactor, 0.28 * scaleFactor, 0);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.068 * scaleFactor, 16, 12), furMat);
      ear.scale.set(1, 1, 0.52);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.044 * scaleFactor, 12, 10), innerEarMat);
      inner.scale.set(0.95, 0.95, 0.45);
      inner.position.z = 0.014 * scaleFactor;
      ep.add(ear, inner);
      accentMeshes.push(ear);
    }
    headPivot.add(ep);
    return ep;
  };
  const leftEarPivot = makeEar(-1);
  const rightEarPivot = makeEar(1);

  // Organic Curved Tail (CatmullRomCurve3 TubeGeometry)
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.2 * scaleFactor, -0.25 * scaleFactor);
  if (isRabbit) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.085 * scaleFactor, 14, 12), bellyMat);
    puff.position.set(0, 0, -0.05);
    tailPivot.add(puff);
  } else {
    const tailPts = isMonkey
      ? [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0.16 * scaleFactor, -0.14 * scaleFactor),
          new THREE.Vector3(0.05 * scaleFactor, 0.34 * scaleFactor, -0.18 * scaleFactor),
          new THREE.Vector3(0.02 * scaleFactor, 0.44 * scaleFactor, -0.06 * scaleFactor),
        ]
      : isHorse || isLion
        ? [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.08 * scaleFactor, -0.14 * scaleFactor),
            new THREE.Vector3(0, -0.08 * scaleFactor, -0.24 * scaleFactor),
            new THREE.Vector3(0, -0.2 * scaleFactor, -0.28 * scaleFactor),
          ]
        : [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.1 * scaleFactor, -0.1 * scaleFactor),
            new THREE.Vector3(0, 0.22 * scaleFactor, -0.08 * scaleFactor),
          ];
    const tailCurve = new THREE.CatmullRomCurve3(tailPts);
    const tail = new THREE.Mesh(
      new THREE.TubeGeometry(tailCurve, 14, (isElephant ? 0.026 : 0.035) * scaleFactor, 10, false),
      furMat
    );
    tailPivot.add(tail);
    accentMeshes.push(tail);
    if (isLion || isElephant) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.056 * scaleFactor, 12, 10), darkMat);
      const endPt = tailPts[tailPts.length - 1];
      tuft.position.copy(endPt);
      tailPivot.add(tuft);
    }
  }
  bodyPivot.add(tailPivot);

  // Tapered LatheGeometry Legs + Sculpted Multi-Toe Paws
  const legLen = isHorse ? 0.44 : isElephant ? 0.36 : 0.24;
  const legRad = isElephant ? 0.096 : isHorse ? 0.052 : 0.058;
  const makeLeg = (x: number, z: number) => {
    const leg = new THREE.Group();
    leg.position.set(x * scaleFactor, 0.04 * scaleFactor, z * scaleFactor);
    const limb = new THREE.Mesh(
      makeTaperedAnimalLimb(
        legRad * 1.18 * scaleFactor,
        legRad * 0.92 * scaleFactor,
        legRad * 0.78 * scaleFactor,
        legLen * scaleFactor,
        14
      ),
      furMat
    );
    leg.add(limb);
    accentMeshes.push(limb);

    const paw = new THREE.Mesh(
      new THREE.SphereGeometry(legRad * 1.12 * scaleFactor, 14, 10),
      isHorse ? darkMat : bellyMat
    );
    paw.scale.set(1.04, 0.65, 1.24);
    paw.position.set(0, -(legLen + 0.02) * scaleFactor, 0.025 * scaleFactor);
    leg.add(paw);

    if (!isHorse && !isElephant) {
      [-0.028, 0, 0.028].forEach((tx) => {
        const toe = new THREE.Mesh(
          new THREE.SphereGeometry(legRad * 0.36 * scaleFactor, 8, 8),
          bellyMat
        );
        toe.position.set(tx * scaleFactor, -(legLen + 0.03) * scaleFactor, (0.072 - Math.abs(tx) * 0.25) * scaleFactor);
        leg.add(toe);
      });
    }

    bodyPivot.add(leg);
    return leg;
  };

  const frontLeftPivot = makeLeg(-0.13, isMonkey ? 0.08 : 0.19);
  const frontRightPivot = makeLeg(0.13, isMonkey ? 0.08 : 0.19);
  const backLeftPivot = makeLeg(-0.13, -0.18);
  const backRightPivot = makeLeg(0.13, -0.18);

  const headHeight = (isHorse ? 1.45 : isElephant ? 1.45 : 1.05) * scaleFactor;
  const selectionRing = createSelectionRing();
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

  if (expression === 'Surprised') mouthScaleY = 1.9;
  if (expression === 'Sad') headRotX = 0.18;

  switch (animation) {
    case 'Idle': {
      bodyY = rig.baseBodyY + Math.sin(t * 2.2) * 0.015;
      headRotY = Math.sin(t * 0.9) * 0.1;
      break;
    }

    case 'Walk': {
      const spd = 5.6;
      const sw = Math.sin(t * spd);
      bodyY = rig.baseBodyY + Math.abs(Math.cos(t * spd)) * 0.04;
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
      bodyY = rig.baseBodyY + Math.sin(t * 4) * 0.02;
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
