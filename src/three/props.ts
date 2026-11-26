import * as THREE from 'three';
import {
  ActorType,
  AnimationState,
  CustomModelBlueprint,
  CustomModelPart,
  PropKind,
  VehicleKind,
} from '../types/studio';
import {
  createBrickStoneTexture,
  createCartoonOutline,
  createContactShadowTexture,
  createRoofTileTexture,
  createSpeechBubbleTexture,
  createWoodPlankTexture,
  getSharedFabricTexture,
} from './proceduralTextures';

export interface PropOrCustomRig {
  kind: string;
  actorType: Extract<ActorType, 'vehicle' | 'prop' | 'custom'>;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot?: THREE.Group;
  jawMesh?: THREE.Object3D;
  leftArmPivot?: THREE.Group;
  rightArmPivot?: THREE.Group;
  leftLegPivot?: THREE.Group;
  rightLegPivot?: THREE.Group;
  wheels: THREE.Object3D[];
  rotors: THREE.Object3D[];
  propellers: THREE.Object3D[];
  lamps: THREE.Mesh[];
  wings: THREE.Object3D[];
  tails: THREE.Object3D[];
  selectionRing: THREE.Mesh;
  speechSprite: THREE.Sprite;
  lastDialogue: string;
  accentMeshes: THREE.Mesh[];
  headHeight: number;
  baseBodyY: number;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getShadowTex(): THREE.CanvasTexture {
  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  return sharedShadowTex;
}

function createSelectionRing(radius = 0.72): THREE.Mesh {
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

function createContactShadow(radius = 0.75): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getShadowTex(),
    transparent: true,
    opacity: 0.45,
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

export function updatePropSpeechBubble(rig: PropOrCustomRig, dialogue: string): void {
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

export function updatePropAccentColor(rig: PropOrCustomRig, hexColor: string): void {
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

function addOutlinesToProps(group: THREE.Object3D, thickness = 1.022): void {
  const targets: THREE.Mesh[] = [];
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      if (
        !m.userData?.isOutline &&
        m.geometry.type !== 'RingGeometry' &&
        m.geometry.type !== 'PlaneGeometry'
      ) {
        targets.push(m);
      }
    }
  });
  targets.forEach((m) => {
    m.add(createCartoonOutline(m, thickness, 0x2a1810));
  });
}

export function createVehicleRig(kind: VehicleKind, accentColor: string): PropOrCustomRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const wheels: THREE.Object3D[] = [];
  const rotors: THREE.Object3D[] = [];
  const propellers: THREE.Object3D[] = [];
  const lamps: THREE.Mesh[] = [];
  const accentMeshes: THREE.Mesh[] = [];
  let headHeight = 1.5;
  let ringRadius = 1.25;

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    roughness: 0.25,
    metalness: 0.2,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.08,
    metalness: 0.2,
    clearcoat: 1.0,
  });
  const tireMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.82 });
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.82,
    roughness: 0.18,
    clearcoat: 0.65,
  });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.32 });
  const lampMat = new THREE.MeshPhysicalMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.55,
    clearcoat: 0.8,
  });

  const addWheel = (x: number, y: number, z: number, r = 0.26, w = 0.16) => {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.52, r * 0.52, w + 0.02, 12), rimMat);
    hub.rotation.z = Math.PI / 2;
    wg.add(tire, hub);
    bodyPivot.add(wg);
    wheels.push(wg);
  };

  switch (kind) {
    case 'car': {
      const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.48, 2.2), accentMat);
      lowerBody.position.y = 0.48;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.42, 1.18), accentMat);
      cabin.position.set(0, 0.9, -0.1);
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.34, 1.22), glassMat);
      windshield.position.set(0, 0.88, -0.1);
      const hlL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), lampMat.clone());
      hlL.rotation.x = Math.PI / 2;
      hlL.position.set(-0.38, 0.5, 1.1);
      const hlR = hlL.clone();
      hlR.position.x = 0.38;
      bodyPivot.add(lowerBody, cabin, windshield, hlL, hlR);
      accentMeshes.push(lowerBody, cabin);
      lamps.push(hlL, hlR);
      addWheel(-0.64, 0.26, 0.68);
      addWheel(0.64, 0.26, 0.68);
      addWheel(-0.64, 0.26, -0.68);
      addWheel(0.64, 0.26, -0.68);
      headHeight = 1.35;
      ringRadius = 1.35;
      break;
    }

    case 'schoolBus': {
      const busBody = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.08, 2.85), accentMat);
      busBody.position.y = 0.82;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.14, 2.87), tireMat);
      stripe.position.y = 0.64;
      const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.42, 0.1), glassMat);
      frontGlass.position.set(0, 1.02, 1.4);
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.36, 2.15), glassMat);
      sideGlass.position.set(0, 1.02, -0.08);
      const roofTop = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.1, 2.65), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }));
      roofTop.position.y = 1.4;
      const hlL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), lampMat.clone());
      hlL.rotation.x = Math.PI / 2;
      hlL.position.set(-0.42, 0.46, 1.43);
      const hlR = hlL.clone();
      hlR.position.x = 0.42;
      bodyPivot.add(busBody, stripe, frontGlass, sideGlass, roofTop, hlL, hlR);
      accentMeshes.push(busBody);
      lamps.push(hlL, hlR);
      addWheel(-0.68, 0.28, 0.88, 0.28, 0.18);
      addWheel(0.68, 0.28, 0.88, 0.28, 0.18);
      addWheel(-0.68, 0.28, -0.88, 0.28, 0.18);
      addWheel(0.68, 0.28, -0.88, 0.28, 0.18);
      headHeight = 1.65;
      ringRadius = 1.65;
      break;
    }

    case 'bike': {
      // Motorbike
      const makeMotoWheel = (z: number) => {
        const wg = new THREE.Group();
        wg.position.set(0, 0.32, z);
        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 10, 20), tireMat);
        tire.rotation.y = Math.PI / 2;
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 12), rimMat);
        rim.rotation.z = Math.PI / 2;
        wg.add(tire, rim);
        bodyPivot.add(wg);
        wheels.push(wg);
      };
      makeMotoWheel(0.62);
      makeMotoWheel(-0.62);
      const engine = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.56), darkMat);
      engine.position.set(0, 0.42, 0);
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.55), accentMat);
      tank.position.set(0, 0.72, 0.18);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.58), tireMat);
      seat.position.set(0, 0.68, -0.32);
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), rimMat);
      fork.position.set(0, 0.64, 0.5);
      fork.rotation.x = -0.32;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.64, 8), darkMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 0.94, 0.38);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), lampMat.clone());
      hl.position.set(0, 0.78, 0.6);
      bodyPivot.add(engine, tank, seat, fork, bar, hl);
      accentMeshes.push(tank);
      lamps.push(hl);
      headHeight = 1.25;
      ringRadius = 0.95;
      break;
    }

    case 'bicycle': {
      const makeWheel = (zPos: number) => {
        const wg = new THREE.Group();
        wg.position.set(0, 0.32, zPos);
        const torus = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 10, 24), tireMat);
        torus.rotation.y = Math.PI / 2;
        const spoke1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.58, 6), darkMat);
        const spoke2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.58, 6), darkMat);
        spoke2.rotation.x = Math.PI / 2;
        wg.add(torus, spoke1, spoke2);
        bodyPivot.add(wg);
        wheels.push(wg);
      };
      makeWheel(0.55);
      makeWheel(-0.55);
      const bar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.82, 8), accentMat);
      bar1.position.set(0, 0.58, 0.02);
      bar1.rotation.x = Math.PI / 2.2;
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), accentMat);
      fork.position.set(0, 0.62, 0.45);
      fork.rotation.x = -0.25;
      const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), darkMat);
      seatPost.position.set(0, 0.6, -0.26);
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.24), tireMat);
      saddle.position.set(0, 0.86, -0.28);
      const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.54, 8), darkMat);
      handlebar.rotation.z = Math.PI / 2;
      handlebar.position.set(0, 0.94, 0.36);
      bodyPivot.add(bar1, fork, seatPost, saddle, handlebar);
      accentMeshes.push(bar1, fork);
      headHeight = 1.2;
      ringRadius = 0.85;
      break;
    }

    case 'tractor': {
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.62, 1.35), accentMat);
      hood.position.set(0, 0.72, 0.35);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.92, 0.95), accentMat);
      cab.position.set(0, 1.18, -0.52);
      const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.54, 0.98), glassMat);
      cabGlass.position.set(0, 1.28, -0.52);
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.62, 10), darkMat);
      exhaust.position.set(0.28, 1.24, 0.72);
      const hlL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), lampMat.clone());
      hlL.rotation.x = Math.PI / 2;
      hlL.position.set(-0.28, 0.75, 1.03);
      const hlR = hlL.clone();
      hlR.position.x = 0.28;
      bodyPivot.add(hood, cab, cabGlass, exhaust, hlL, hlR);
      accentMeshes.push(hood, cab);
      lamps.push(hlL, hlR);
      addWheel(-0.56, 0.24, 0.75, 0.24, 0.16);
      addWheel(0.56, 0.24, 0.75, 0.24, 0.16);
      addWheel(-0.68, 0.44, -0.56, 0.44, 0.26);
      addWheel(0.68, 0.44, -0.56, 0.44, 0.26);
      headHeight = 1.8;
      ringRadius = 1.45;
      break;
    }

    case 'helicopter': {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.68, 18, 14), accentMat);
      pod.scale.set(0.92, 0.85, 1.45);
      pod.position.set(0, 0.75, 0.1);
      const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.54, 14, 12), glassMat);
      cockpit.scale.set(0.95, 0.82, 1.05);
      cockpit.position.set(0, 0.82, 0.44);
      const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.55, 10), accentMat);
      tailBoom.rotation.x = Math.PI / 2;
      tailBoom.position.set(0, 0.82, -1.25);
      const skidL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8), darkMat);
      skidL.rotation.x = Math.PI / 2;
      skidL.position.set(-0.44, 0.08, 0.08);
      const skidR = skidL.clone();
      skidR.position.x = 0.44;
      const strutL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), darkMat);
      strutL.position.set(-0.4, 0.24, 0.1);
      const strutR = strutL.clone();
      strutR.position.x = 0.4;

      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(0, 1.38, 0.05);
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.03, 0.14), darkMat);
      const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 2.8), darkMat);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 10), rimMat);
      mast.position.y = -0.06;
      rotorGroup.add(blade1, blade2, mast);
      rotors.push(rotorGroup);

      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lampMat.clone());
      hl.position.set(0, 0.46, 0.94);
      lamps.push(hl);

      bodyPivot.add(pod, cockpit, tailBoom, skidL, skidR, strutL, strutR, rotorGroup, hl);
      accentMeshes.push(pod, tailBoom);
      headHeight = 1.65;
      ringRadius = 1.55;
      break;
    }

    case 'airplane': {
      const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.9, 10, 16), accentMat);
      fuselage.rotation.x = Math.PI / 2;
      fuselage.position.y = 0.72;
      const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.52), glassMat);
      cockpit.position.set(0, 0.94, 0.58);
      const wingsMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.07, 0.68), accentMat);
      wingsMesh.position.set(0, 0.7, 0.08);
      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.5), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 }));
      tailFin.position.set(0, 1.12, -1.05);
      const tailWing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.34), accentMat);
      tailWing.position.set(0, 0.86, -1.05);

      const propGroup = new THREE.Group();
      propGroup.position.set(0, 0.72, 1.38);
      const hub = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 12), darkMat);
      hub.rotation.x = Math.PI / 2;
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.09, 0.03), darkMat);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.03), darkMat);
      propGroup.add(hub, b1, b2);
      propellers.push(propGroup);

      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lampMat.clone());
      hl.position.set(0, 0.52, 1.15);
      lamps.push(hl);

      bodyPivot.add(fuselage, cockpit, wingsMesh, tailFin, tailWing, propGroup, hl);
      accentMeshes.push(fuselage, wingsMesh, tailWing);
      addWheel(0, 0.16, 0.72, 0.16, 0.12);
      addWheel(-0.55, 0.16, -0.25, 0.16, 0.12);
      addWheel(0.55, 0.16, -0.25, 0.16, 0.12);
      headHeight = 1.5;
      ringRadius = 1.75;
      break;
    }

    case 'boat': {
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.48, 2.3, 12), accentMat);
      hull.rotation.x = Math.PI / 2;
      hull.scale.set(1.15, 1, 0.52);
      hull.position.y = 0.28;
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.08, 1.7),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
      );
      deck.position.y = 0.5;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.45, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 })
      );
      cabin.position.set(0, 0.74, -0.15);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.5), glassMat);
      win.position.set(0, 0.78, -0.1);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.25, 8), darkMat);
      mast.position.set(0, 1.35, 0.15);
      const sail = new THREE.Mesh(
        new THREE.ConeGeometry(0.52, 0.95, 3),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6, side: THREE.DoubleSide })
      );
      sail.position.set(0, 1.4, 0.25);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lampMat.clone());
      hl.position.set(0, 0.98, 0.25);
      lamps.push(hl);

      bodyPivot.add(hull, deck, cabin, win, mast, sail, hl);
      accentMeshes.push(hull);
      headHeight = 1.95;
      ringRadius = 1.45;
      break;
    }
  }

  const selectionRing = createSelectionRing(ringRadius);
  const shadow = createContactShadow(ringRadius * 0.9);
  const speechSprite = createSpeechSprite(headHeight + 0.52);

  addOutlinesToProps(bodyPivot, 1.028);
  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind,
    actorType: 'vehicle',
    root,
    bodyPivot,
    wheels,
    rotors,
    propellers,
    lamps,
    wings: [],
    tails: [],
    selectionRing,
    speechSprite,
    lastDialogue: '',
    accentMeshes,
    headHeight,
    baseBodyY: 0,
  };
}

export function createPropRig(kind: PropKind, accentColor: string): PropOrCustomRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const accentMeshes: THREE.Mesh[] = [];
  let headHeight = 1.4;
  let ringRadius = 0.7;

  const fabricTex = getSharedFabricTexture();
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    map: fabricTex,
    roughness: 0.48,
    metalness: 0.08,
    clearcoat: 0.28,
  });

  switch (kind) {
    case 'tree': {
      const trunkMat = new THREE.MeshPhysicalMaterial({
        color: 0x7c4a2d,
        roughness: 0.88,
        clearcoat: 0.06,
      });
      const trunkPts = [
        new THREE.Vector2(0.36, 0.0),
        new THREE.Vector2(0.28, 0.16),
        new THREE.Vector2(0.21, 0.45),
        new THREE.Vector2(0.18, 0.92),
        new THREE.Vector2(0.14, 1.38),
      ];
      const trunk = new THREE.Mesh(new THREE.LatheGeometry(trunkPts, 18), trunkMat);
      bodyPivot.add(trunk);

      // Curved organic branches & root flares
      const branchCurveL = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.08, 0.92, 0.02),
        new THREE.Vector3(-0.28, 1.18, 0.1),
        new THREE.Vector3(-0.46, 1.38, 0.18),
      ]);
      const branchCurveR = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.08, 0.96, -0.02),
        new THREE.Vector3(0.26, 1.22, -0.1),
        new THREE.Vector3(0.46, 1.42, -0.16),
      ]);
      const branchL = new THREE.Mesh(new THREE.TubeGeometry(branchCurveL, 10, 0.075, 10, false), trunkMat);
      const branchR = new THREE.Mesh(new THREE.TubeGeometry(branchCurveR, 10, 0.072, 10, false), trunkMat);
      bodyPivot.add(branchL, branchR);

      const baseCol = new THREE.Color(accentColor);
      const leafMat = new THREE.MeshPhysicalMaterial({
        color: baseCol,
        roughness: 0.72,
        clearcoat: 0.16,
      });
      const leafBrightMat = new THREE.MeshPhysicalMaterial({
        color: baseCol.clone().offsetHSL(0.02, 0.06, 0.1),
        roughness: 0.68,
        clearcoat: 0.18,
      });
      const leafDeepMat = new THREE.MeshPhysicalMaterial({
        color: baseCol.clone().multiplyScalar(0.82),
        roughness: 0.76,
        clearcoat: 0.12,
      });

      const puffs: Array<[number, number, number, number, THREE.MeshPhysicalMaterial]> = [
        [0, 1.72, 0, 0.84, leafMat],
        [-0.48, 1.48, 0.24, 0.64, leafBrightMat],
        [0.48, 1.52, -0.2, 0.62, leafBrightMat],
        [0.04, 2.24, 0.08, 0.58, leafBrightMat],
        [-0.18, 1.82, -0.38, 0.54, leafDeepMat],
        [0.24, 1.44, 0.36, 0.52, leafMat],
      ];
      puffs.forEach(([px, py, pz, rad, mat]) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(rad, 20, 16), mat);
        puff.scale.set(1.06, 0.92, 1.04);
        puff.position.set(px, py, pz);
        bodyPivot.add(puff);
        accentMeshes.push(puff);
      });
      headHeight = 2.85;
      ringRadius = 0.92;
      break;
    }

    case 'hut': {
      const wallMat = new THREE.MeshPhysicalMaterial({ color: 0xfef3c7, roughness: 0.84 });
      const plinthMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, roughness: 0.86 });
      const thatchMat = new THREE.MeshPhysicalMaterial({
        map: createRoofTileTexture(4),
        color: accentColor,
        roughness: 0.72,
        clearcoat: 0.14,
      });
      const woodMat = new THREE.MeshPhysicalMaterial({
        map: createWoodPlankTexture(4),
        color: 0x854d0e,
        roughness: 0.72,
      });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xfef08a,
        emissive: 0xfde047,
        emissiveIntensity: 0.45,
        roughness: 0.16,
        clearcoat: 0.8,
      });

      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.3, 0.22, 24), plinthMat);
      plinth.position.y = 0.11;
      const basePts = [
        new THREE.Vector2(1.2, 0.2),
        new THREE.Vector2(1.22, 0.75),
        new THREE.Vector2(1.16, 1.32),
      ];
      const base = new THREE.Mesh(new THREE.LatheGeometry(basePts, 24), wallMat);

      // Flared concave thatched roof
      const roofPts = [
        new THREE.Vector2(1.66, 1.2),
        new THREE.Vector2(1.42, 1.44),
        new THREE.Vector2(0.95, 1.85),
        new THREE.Vector2(0.45, 2.25),
        new THREE.Vector2(0.08, 2.52),
        new THREE.Vector2(0.0, 2.56),
      ];
      const roof = new THREE.Mesh(new THREE.LatheGeometry(roofPts, 26), thatchMat);
      const topCap = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 8, 16), woodMat);
      topCap.rotation.x = Math.PI / 2;
      topCap.position.y = 2.46;

      // Arched doorway + frame + doorstep
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.88, 0.16), woodMat);
      doorFrame.position.set(0, 0.56, 1.15);
      const doorArchFrame = new THREE.Mesh(
        new THREE.CylinderGeometry(0.31, 0.31, 0.16, 16),
        woodMat
      );
      doorArchFrame.rotation.x = Math.PI / 2;
      doorArchFrame.position.set(0, 0.98, 1.15);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.82, 0.18), woodMat);
      door.position.set(0, 0.54, 1.17);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.036, 12, 10),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
      );
      knob.position.set(0.14, 0.55, 1.27);
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.1, 0.28), plinthMat);
      step.position.set(0, 0.05, 1.32);

      // Framed circular side window
      const winGroup = new THREE.Group();
      winGroup.position.set(0.94, 0.82, 0.72);
      winGroup.rotation.y = Math.PI / 3.4;
      const winRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 18), woodMat);
      const winPane = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), glassMat);
      winPane.position.z = 0.01;
      const winSill = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.14), woodMat);
      winSill.position.set(0, -0.23, 0.04);
      winGroup.add(winRim, winPane, winSill);

      bodyPivot.add(plinth, base, roof, topCap, doorFrame, doorArchFrame, door, knob, step, winGroup);
      accentMeshes.push(roof);
      headHeight = 2.65;
      ringRadius = 1.5;
      break;
    }

    case 'house': {
      const brickTex = createBrickStoneTexture(4);
      const roofTex = createRoofTileTexture(4);
      const woodTex = createWoodPlankTexture(4);
      const wallMat = new THREE.MeshPhysicalMaterial({
        map: brickTex,
        color: accentColor,
        roughness: 0.68,
      });
      const roofMat = new THREE.MeshPhysicalMaterial({
        map: roofTex,
        color: 0x334155,
        roughness: 0.45,
        metalness: 0.18,
        clearcoat: 0.24,
      });
      const trimMat = new THREE.MeshPhysicalMaterial({
        map: woodTex,
        color: 0x78350f,
        roughness: 0.68,
      });
      const sillMat = new THREE.MeshPhysicalMaterial({ color: 0xcbd5e1, roughness: 0.78 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.32,
        roughness: 0.14,
        clearcoat: 0.88,
      });

      const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.22, 2.04), sillMat);
      plinth.position.y = 0.11;
      const mainBox = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.62, 1.9), wallMat);
      mainBox.position.y = 1.02;

      // Flared curved gable roof over main house
      const buildSwoopedRoof = (spanW: number, peakH: number, depthD: number) => {
        const s = new THREE.Shape();
        const hw = spanW * 0.5;
        s.moveTo(-hw - 0.18, -0.06);
        s.quadraticCurveTo(-hw * 0.55, peakH * 0.32, 0, peakH);
        s.quadraticCurveTo(hw * 0.55, peakH * 0.32, hw + 0.18, -0.06);
        s.lineTo(hw + 0.1, -0.18);
        s.quadraticCurveTo(hw * 0.5, peakH * 0.2, 0, peakH - 0.14);
        s.quadraticCurveTo(-hw * 0.5, peakH * 0.2, -hw - 0.1, -0.18);
        s.closePath();
        const geo = new THREE.ExtrudeGeometry(s, {
          depth: depthD,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.03,
          bevelThickness: 0.03,
        });
        geo.translate(0, 0, -depthD * 0.5);
        return geo;
      };

      const mainRoof = new THREE.Mesh(buildSwoopedRoof(2.68, 0.78, 2.15), roofMat);
      mainRoof.position.y = 1.84;

      const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.82, 1.3), wallMat);
      upperDeck.position.set(-0.35, 2.38, -0.05);
      const upperRoof = new THREE.Mesh(buildSwoopedRoof(1.56, 0.54, 1.48), roofMat);
      upperRoof.position.set(-0.35, 2.78, -0.05);

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.32), sillMat);
      chimney.position.set(0.75, 2.72, -0.45);
      const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.4), roofMat);
      chimneyCap.position.set(0.75, 3.16, -0.45);

      // Framed 3D windows with sills, mullions & shutters
      const addFramedWindow = (wx: number, wy: number, wz: number, w = 0.64, h = 0.58) => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.1), trimMat);
        frame.position.set(wx, wy, wz);
        const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), glassMat);
        pane.position.set(wx, wy, wz + 0.01);
        const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.14), trimMat);
        mullionV.position.set(wx, wy, wz + 0.015);
        const mullionH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.14), trimMat);
        mullionH.position.set(wx, wy, wz + 0.015);
        const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, 0.08, 0.18), sillMat);
        sill.position.set(wx, wy - h * 0.5 - 0.06, wz + 0.04);
        const shutterL = new THREE.Mesh(new THREE.BoxGeometry(0.14, h + 0.04, 0.06), roofMat);
        shutterL.position.set(wx - w * 0.5 - 0.14, wy, wz + 0.02);
        const shutterR = new THREE.Mesh(new THREE.BoxGeometry(0.14, h + 0.04, 0.06), roofMat);
        shutterR.position.set(wx + w * 0.5 + 0.14, wy, wz + 0.02);
        bodyPivot.add(frame, pane, mullionV, mullionH, sill, shutterL, shutterR);
      };
      addFramedWindow(0.56, 1.08, 0.96, 0.66, 0.58);
      addFramedWindow(-0.35, 2.42, 0.61, 0.52, 0.44);

      // Arched wooden front door + brass knob + step
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.06, 0.11), trimMat);
      doorFrame.position.set(-0.55, 0.72, 0.96);
      const doorArch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.31, 0.31, 0.11, 16),
        trimMat
      );
      doorArch.rotation.x = Math.PI / 2;
      doorArch.position.set(-0.55, 1.24, 0.96);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.02, 0.13), trimMat);
      door.position.set(-0.55, 0.71, 0.975);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.036, 12, 10),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
      );
      knob.position.set(-0.4, 0.72, 1.05);
      const porchStep = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.32), sillMat);
      porchStep.position.set(-0.55, 0.06, 1.12);

      bodyPivot.add(
        plinth,
        mainBox,
        mainRoof,
        upperDeck,
        upperRoof,
        chimney,
        chimneyCap,
        doorFrame,
        doorArch,
        door,
        knob,
        porchStep
      );
      accentMeshes.push(mainBox, upperDeck);
      headHeight = 3.25;
      ringRadius = 1.68;
      break;
    }

    case 'desk': {
      const woodMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.68 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 });
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.07, 0.72), woodMat);
      top.position.y = 0.74;
      bodyPivot.add(top);
      accentMeshes.push(top);
      [
        [-0.5, -0.28],
        [0.5, -0.28],
        [-0.5, 0.28],
        [0.5, 0.28],
      ].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8), metalMat);
        leg.position.set(x, 0.36, z);
        bodyPivot.add(leg);
      });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.52), seatMat);
      seat.position.set(0, 0.44, 0.68);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.06), seatMat);
      back.position.set(0, 0.68, 0.91);
      bodyPivot.add(seat, back);
      headHeight = 1.25;
      ringRadius = 0.85;
      break;
    }

    case 'fountain': {
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.72 });
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.14, metalness: 0.18 });
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.42, 22), stoneMat);
      basin.position.y = 0.21;
      const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.34, 22), waterMat);
      waterDisc.position.y = 0.23;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.1, 14), stoneMat);
      pillar.position.y = 0.7;
      const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.24, 0.22, 18), stoneMat);
      topBowl.position.y = 1.2;
      const spout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), waterMat);
      spout.position.y = 1.44;
      bodyPivot.add(basin, waterDisc, pillar, topBowl, spout);
      accentMeshes.push(waterDisc, spout);
      headHeight = 1.8;
      ringRadius = 1.5;
      break;
    }

    case 'football': {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 20, 16),
        new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.42 })
      );
      ball.position.y = 0.26;
      const patchMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
      [
        [0, 0.26, 0.22],
        [0.2, 0.32, 0.06],
        [-0.2, 0.32, 0.06],
        [0, 0.48, -0.02],
      ].forEach(([px, py, pz]) => {
        const patch = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), patchMat);
        patch.position.set(px, py, pz);
        bodyPivot.add(patch);
      });
      bodyPivot.add(ball);
      accentMeshes.push(ball);
      headHeight = 0.7;
      ringRadius = 0.45;
      break;
    }

    case 'cricketBatBall': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.06), accentMat);
      blade.position.set(-0.08, 0.4, 0);
      blade.rotation.z = -0.15;
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.38, 10),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
      );
      handle.position.set(-0.16, 0.94, 0);
      handle.rotation.z = -0.15;
      const cBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 })
      );
      cBall.position.set(0.22, 0.11, 0.12);
      bodyPivot.add(blade, handle, cBall);
      accentMeshes.push(blade);
      headHeight = 1.2;
      ringRadius = 0.55;
      break;
    }

    case 'books': {
      const colors = [accentColor, '#F59E0B', '#10B981', '#EC4899'];
      const pageMat = new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.85 });
      for (let i = 0; i < 4; i++) {
        const bGroup = new THREE.Group();
        const cover = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.1, 0.62),
          new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.6 })
        );
        const pages = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.075, 0.58), pageMat);
        pages.position.x = 0.02;
        bGroup.add(cover, pages);
        bGroup.position.set((i % 2 === 0 ? -1 : 1) * 0.02, 0.05 + i * 0.105, 0);
        bGroup.rotation.y = (i - 1.5) * 0.18;
        bodyPivot.add(bGroup);
        if (i === 0) accentMeshes.push(cover);
      }
      headHeight = 0.7;
      ringRadius = 0.52;
      break;
    }

    case 'woodenStick': {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.35, 10), accentMat);
      log.rotation.z = Math.PI / 2;
      log.position.y = 0.12;
      const branch = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 8), accentMat);
      branch.position.set(0.2, 0.24, 0.06);
      branch.rotation.z = -0.5;
      bodyPivot.add(log, branch);
      accentMeshes.push(log);
      headHeight = 0.65;
      ringRadius = 0.75;
      break;
    }

    case 'toyGun': {
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.14), darkMat);
      grip.position.set(0, 0.14, -0.14);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.62), accentMat);
      barrel.position.set(0, 0.3, 0.06);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10), tipMat);
      tip.rotation.x = Math.PI / 2;
      tip.position.set(0, 0.3, 0.4);
      bodyPivot.add(grip, barrel, tip);
      accentMeshes.push(barrel);
      headHeight = 0.7;
      ringRadius = 0.5;
      break;
    }

    case 'magicWand': {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 10), accentMat);
      shaft.position.y = 0.45;
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.85 })
      );
      star.position.y = 0.98;
      bodyPivot.add(shaft, star);
      accentMeshes.push(shaft);
      headHeight = 1.25;
      ringRadius = 0.45;
      break;
    }

    case 'sword': {
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.25 });
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.95, 0.04),
        new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.88, roughness: 0.18 })
      );
      blade.position.y = 0.55;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.09), goldMat);
      guard.position.y = 0.24;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 10), goldMat);
      grip.position.y = 0.12;
      bodyPivot.add(blade, guard, grip);
      accentMeshes.push(blade);
      headHeight = 1.25;
      ringRadius = 0.48;
      break;
    }

    case 'smartphone': {
      const caseBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.58, 0.05), accentMat);
      caseBody.position.y = 0.3;
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.27, 0.5, 0.055),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.7 })
      );
      screen.position.y = 0.3;
      bodyPivot.add(caseBody, screen);
      accentMeshes.push(caseBody);
      headHeight = 0.85;
      ringRadius = 0.45;
      break;
    }
  }

  const selectionRing = createSelectionRing(ringRadius);
  const shadow = createContactShadow(ringRadius * 0.9);
  const speechSprite = createSpeechSprite(headHeight + 0.52);

  addOutlinesToProps(bodyPivot, 1.032);
  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind,
    actorType: 'prop',
    root,
    bodyPivot,
    wheels: [],
    rotors: [],
    propellers: [],
    lamps: [],
    wings: [],
    tails: [],
    selectionRing,
    speechSprite,
    lastDialogue: '',
    accentMeshes,
    headHeight,
    baseBodyY: 0,
  };
}

function buildGeometryFromSpec(part: CustomModelPart): THREE.BufferGeometry {
  const [sx, sy, sz] = part.scale.map((v) => Math.max(0.03, Math.min(4, Number(v) || 0.3)));
  switch (part.geometry) {
    case 'sphere': {
      const g = new THREE.SphereGeometry(0.5, 16, 14);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'cylinder': {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'cone': {
      const g = new THREE.ConeGeometry(0.5, 1, 14);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'torus': {
      const g = new THREE.TorusGeometry(0.38, 0.12, 10, 20);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'box':
    default:
      return new THREE.BoxGeometry(sx, sy, sz);
  }
}

export function createCustomModelRig(blueprint: CustomModelBlueprint): PropOrCustomRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const headPivot = new THREE.Group();
  const leftArmPivot = new THREE.Group();
  const rightArmPivot = new THREE.Group();
  const leftLegPivot = new THREE.Group();
  const rightLegPivot = new THREE.Group();

  const findCentroid = (roles: string[], fallback: [number, number, number]) => {
    const matching = blueprint.parts.filter((p) => roles.includes(p.role));
    if (matching.length === 0) return fallback;
    const sum = matching.reduce(
      (acc, p) => [acc[0] + p.position[0], acc[1] + p.position[1], acc[2] + p.position[2]],
      [0, 0, 0]
    );
    return [sum[0] / matching.length, sum[1] / matching.length, sum[2] / matching.length] as [
      number,
      number,
      number,
    ];
  };

  const headPos = findCentroid(['head', 'jaw'], [0, 1.35, 0]);
  const lArmPos = findCentroid(['leftArm'], [-0.32, 0.95, 0]);
  const rArmPos = findCentroid(['rightArm'], [0.32, 0.95, 0]);
  const lLegPos = findCentroid(['leftLeg'], [-0.14, 0.45, 0]);
  const rLegPos = findCentroid(['rightLeg'], [0.14, 0.45, 0]);

  headPivot.position.set(...headPos);
  leftArmPivot.position.set(lArmPos[0], lArmPos[1] + 0.15, lArmPos[2]);
  rightArmPivot.position.set(rArmPos[0], rArmPos[1] + 0.15, rArmPos[2]);
  leftLegPivot.position.set(lLegPos[0], lLegPos[1] + 0.18, lLegPos[2]);
  rightLegPivot.position.set(rLegPos[0], rLegPos[1] + 0.18, rLegPos[2]);

  bodyPivot.add(headPivot, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot);

  const wheels: THREE.Object3D[] = [];
  const wings: THREE.Object3D[] = [];
  const tails: THREE.Object3D[] = [];
  const accentMeshes: THREE.Mesh[] = [];
  let jawMesh: THREE.Object3D | undefined;
  let maxTopY = 1.5;

  blueprint.parts.forEach((part, idx) => {
    const geo = buildGeometryFromSpec(part);
    const mat = new THREE.MeshPhysicalMaterial({
      color: /^#[0-9a-fA-F]{6}$/.test(part.color) ? part.color : '#3B82F6',
      roughness: typeof part.roughness === 'number' ? THREE.MathUtils.clamp(part.roughness, 0.1, 0.95) : 0.52,
      metalness: typeof part.metalness === 'number' ? THREE.MathUtils.clamp(part.metalness, 0, 0.95) : 0.08,
      clearcoat: 0.32,
      clearcoatRoughness: 0.35,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.add(createCartoonOutline(mesh, 1.035, 0x24140c));
    const [px, py, pz] = part.position;
    const [rx, ry, rz] = part.rotation;
    mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    maxTopY = Math.max(maxTopY, py + (part.scale[1] || 0.3) * 0.5);

    if (idx === 0) accentMeshes.push(mesh);

    switch (part.role) {
      case 'head':
        mesh.position.set(px - headPos[0], py - headPos[1], pz - headPos[2]);
        headPivot.add(mesh);
        break;
      case 'jaw':
        mesh.position.set(px - headPos[0], py - headPos[1], pz - headPos[2]);
        headPivot.add(mesh);
        jawMesh = mesh;
        break;
      case 'leftArm':
        mesh.position.set(
          px - leftArmPivot.position.x,
          py - leftArmPivot.position.y,
          pz - leftArmPivot.position.z
        );
        leftArmPivot.add(mesh);
        break;
      case 'rightArm':
        mesh.position.set(
          px - rightArmPivot.position.x,
          py - rightArmPivot.position.y,
          pz - rightArmPivot.position.z
        );
        rightArmPivot.add(mesh);
        break;
      case 'leftLeg':
        mesh.position.set(
          px - leftLegPivot.position.x,
          py - leftLegPivot.position.y,
          pz - leftLegPivot.position.z
        );
        leftLegPivot.add(mesh);
        break;
      case 'rightLeg':
        mesh.position.set(
          px - rightLegPivot.position.x,
          py - rightLegPivot.position.y,
          pz - rightLegPivot.position.z
        );
        rightLegPivot.add(mesh);
        break;
      case 'wheel': {
        const wg = new THREE.Group();
        wg.position.set(px, py, pz);
        mesh.position.set(0, 0, 0);
        wg.add(mesh);
        bodyPivot.add(wg);
        wheels.push(wg);
        break;
      }
      case 'wing': {
        const wingG = new THREE.Group();
        wingG.position.set(px * 0.5, py, pz);
        mesh.position.set(px * 0.5, 0, 0);
        wingG.add(mesh);
        bodyPivot.add(wingG);
        wings.push(wingG);
        break;
      }
      case 'tail': {
        const tailG = new THREE.Group();
        tailG.position.set(px, py, pz);
        mesh.position.set(0, 0, 0);
        tailG.add(mesh);
        bodyPivot.add(tailG);
        tails.push(tailG);
        break;
      }
      default:
        mesh.position.set(px, py, pz);
        bodyPivot.add(mesh);
        break;
    }
  });

  const headHeight = Math.max(1.2, maxTopY + 0.15);
  const selectionRing = createSelectionRing(0.75);
  const shadow = createContactShadow(0.7);
  const speechSprite = createSpeechSprite(headHeight + 0.52);

  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind: blueprint.id,
    actorType: 'custom',
    root,
    bodyPivot,
    headPivot,
    jawMesh,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    wheels,
    rotors: [],
    propellers: [],
    lamps: [],
    wings,
    tails,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    accentMeshes,
    headHeight,
    baseBodyY: 0,
  };
}

export function updatePropOrCustomAnimation(
  rig: PropOrCustomRig,
  animation: AnimationState,
  elapsed: number,
  delta: number,
  lipSyncLevel: number,
  hasDialogue: boolean
): void {
  const k = 1 - Math.exp(-10 * Math.min(delta, 0.05));
  const t = elapsed;

  // Vehicle Animations
  if (rig.actorType === 'vehicle') {
    const driving =
      animation === 'Drive/Ride Forward' ||
      animation === 'Walk' ||
      animation === 'Run';
    const hovering = animation === 'Rotor Spin & Hover';
    const flying = animation === 'Fly in Sky';
    const sailing = animation === 'Sail on Water';
    const honking = animation === 'Honk/Lights Flash';

    if (rig.wheels.length > 0 && driving) {
      rig.wheels.forEach((w) => {
        w.rotation.x += delta * 6.5;
      });
    }
    if (rig.rotors.length > 0 && (hovering || flying || driving)) {
      rig.rotors.forEach((r) => {
        r.rotation.y += delta * 18;
      });
    }
    if (rig.propellers.length > 0 && (flying || driving)) {
      rig.propellers.forEach((p) => {
        p.rotation.z += delta * 22;
      });
    }

    let targetY = 0;
    let targetRotX = 0;
    let targetRotZ = 0;
    if (flying) {
      targetY = 1.45 + Math.sin(t * 2.2) * 0.25;
      targetRotZ = Math.sin(t * 1.4) * 0.08;
    } else if (hovering) {
      targetY = 0.72 + Math.sin(t * 3.0) * 0.14;
    } else if (sailing) {
      targetY = Math.sin(t * 2.4) * 0.08;
      targetRotZ = Math.sin(t * 1.8) * 0.06;
      targetRotX = Math.cos(t * 2.0) * 0.04;
    } else if (honking) {
      targetY = Math.abs(Math.sin(t * 14)) * 0.07;
    } else if (driving) {
      targetY = Math.abs(Math.sin(t * 10)) * 0.025;
    }

    rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, targetY, k);
    rig.bodyPivot.rotation.x = THREE.MathUtils.lerp(rig.bodyPivot.rotation.x, targetRotX, k);
    rig.bodyPivot.rotation.z = THREE.MathUtils.lerp(rig.bodyPivot.rotation.z, targetRotZ, k);

    const flashOn = honking && Math.sin(t * 16) > 0;
    rig.lamps.forEach((lm) => {
      const m = lm.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = flashOn ? 2.4 : driving || flying ? 0.9 : 0.35;
    });
    return;
  }

  // Custom / Prop extras
  if (rig.wheels.length > 0 && (animation === 'Walk' || animation === 'Run' || animation === 'Drive/Ride Forward')) {
    const spinSpeed = animation === 'Run' ? 9 : 5.5;
    rig.wheels.forEach((w) => {
      w.rotation.x += delta * spinSpeed;
    });
  }

  if (rig.wings.length > 0) {
    const flapSpeed = animation === 'Jump' || animation === 'Dance' || animation === 'Fly in Sky' ? 11 : 3.5;
    rig.wings.forEach((w, idx) => {
      w.rotation.z = Math.sin(t * flapSpeed) * 0.35 * (idx % 2 === 0 ? 1 : -1);
    });
  }

  if (rig.tails.length > 0) {
    rig.tails.forEach((tl) => {
      tl.rotation.y = Math.sin(t * 5) * 0.25;
    });
  }

  if (rig.actorType === 'prop') {
    if (animation === 'Jump') {
      rig.bodyPivot.position.y = Math.abs(Math.sin(t * 3.5)) * 0.45;
    } else if (animation === 'Dance') {
      rig.bodyPivot.rotation.y = Math.sin(t * 4) * 0.2;
      rig.bodyPivot.position.y = Math.abs(Math.sin(t * 6)) * 0.08;
    } else {
      rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, 0, k);
      rig.bodyPivot.rotation.y = THREE.MathUtils.lerp(rig.bodyPivot.rotation.y, 0, k);
    }
    return;
  }

  // Articulated custom AI model
  let bodyY = 0;
  let lArmX = 0;
  let rArmX = 0;
  let rArmZ = 0;
  let lLegX = 0;
  let rLegX = 0;
  let headY = 0;
  let jawScaleY = 1;

  if (animation === 'Walk' || animation === 'Run') {
    const spd = animation === 'Run' ? 9.5 : 5.5;
    const sw = Math.sin(t * spd);
    bodyY = Math.abs(Math.cos(t * spd)) * 0.06;
    lLegX = sw * 0.55;
    rLegX = -sw * 0.55;
    lArmX = -sw * 0.45;
    rArmX = sw * 0.45;
  } else if (animation === 'Fly in Sky') {
    bodyY = 0.8 + Math.sin(t * 2.5) * 0.2;
  } else if (animation === 'Waving Hand (হাত নাড়ানো)') {
    rArmZ = -1.6 + Math.sin(t * 7) * 0.35;
  } else if (animation === 'Jump') {
    bodyY = Math.max(0, Math.sin(t * 3.2)) * 0.6;
  } else if (animation === 'Dance') {
    bodyY = Math.abs(Math.sin(t * 6)) * 0.1;
    lArmX = Math.sin(t * 6) * 0.5;
    rArmX = -Math.sin(t * 6) * 0.5;
    headY = Math.sin(t * 3) * 0.2;
  } else if (animation === 'Sit') {
    bodyY = -0.22;
    lLegX = -1.1;
    rLegX = -1.1;
  } else {
    bodyY = Math.sin(t * 2) * 0.015;
  }

  const speaking = animation === 'Talk (Lip-Sync)' || hasDialogue || lipSyncLevel > 0.06;
  if (speaking) {
    if (lipSyncLevel >= 0) {
      jawScaleY = 1 + lipSyncLevel * 2.5;
    } else {
      jawScaleY = 1 + Math.max(0, Math.sin(t * 14)) * 2.0;
    }
    headY += Math.sin(t * 2.2) * 0.08;
  }

  rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, bodyY, k);
  if (rig.headPivot) {
    rig.headPivot.rotation.y = THREE.MathUtils.lerp(rig.headPivot.rotation.y, headY, k);
  }
  if (rig.leftArmPivot) {
    rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(rig.leftArmPivot.rotation.x, lArmX, k);
  }
  if (rig.rightArmPivot) {
    rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.x, rArmX, k);
    rig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.z, rArmZ, k);
  }
  if (rig.leftLegPivot) {
    rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(rig.leftLegPivot.rotation.x, lLegX, k);
  }
  if (rig.rightLegPivot) {
    rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(rig.rightLegPivot.rotation.x, rLegX, k);
  }
  if (rig.jawMesh) {
    rig.jawMesh.scale.y = THREE.MathUtils.lerp(rig.jawMesh.scale.y, jawScaleY, Math.min(1, k * 2));
  }
}

export function disposePropOrCustomRig(rig: PropOrCustomRig): void {
  const mat = rig.speechSprite.material as THREE.SpriteMaterial;
  if (mat.map) mat.map.dispose();
  rig.root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh || (obj as THREE.Sprite).isSprite) {
      const m = obj as THREE.Mesh;
      if (m.userData?.isOutline) return;
      if (m.geometry && !m.geometry.userData?.sharedResource && !m.userData?.sharedResource) {
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
