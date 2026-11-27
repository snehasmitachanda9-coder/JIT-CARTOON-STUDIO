import * as THREE from 'three';
import {
  ActorType,
  AnimationState,
  CustomModelBlueprint,
  PropKind,
  VehicleKind,
} from '../types/studio';
import {
  createContactShadowTexture,
  createRoofTileTexture,
  createSpeechBubbleTexture,
  createWoodPlankTexture,
  createBrickStoneTexture,
  getSharedFabricTexture,
} from './proceduralTextures';
import {
  buildHighDetail3DModel,
  makeRoundedBlockGeo,
} from './highDetailModelBuilder';

export interface PropOrCustomRig {
  kind: string;
  actorType: Extract<ActorType, 'vehicle' | 'prop' | 'custom'>;
  isVehicleLike?: boolean;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot?: THREE.Group;
  jawMesh?: THREE.Object3D;
  leftBrow?: THREE.Mesh;
  rightBrow?: THREE.Mesh;
  leftArmPivot?: THREE.Group;
  rightArmPivot?: THREE.Group;
  leftForearmPivot?: THREE.Group;
  rightForearmPivot?: THREE.Group;
  leftLegPivot?: THREE.Group;
  rightLegPivot?: THREE.Group;
  leftKneePivot?: THREE.Group;
  rightKneePivot?: THREE.Group;
  ponytailPivot?: THREE.Group;
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

export function createVehicleRig(kind: VehicleKind, accentColor: string): PropOrCustomRig {
  const built = buildHighDetail3DModel({
    mode: 'vehicle',
    vehicleKind: kind,
    accentColor,
  });
  if (built.mode !== 'vehicle') {
    throw new Error('Expected vehicle build output');
  }

  const v = built.vehicle;
  const root = new THREE.Group();
  root.add(v.bodyPivot);

  const selectionRing = createSelectionRing(v.ringRadius);
  const shadow = createContactShadow(v.ringRadius * 0.9);
  const speechSprite = createSpeechSprite(v.headHeight + 0.52);

  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind,
    actorType: 'vehicle',
    isVehicleLike: true,
    root,
    bodyPivot: v.bodyPivot,
    wheels: v.wheels,
    rotors: v.rotors,
    propellers: v.propellers,
    lamps: v.lamps,
    wings: [],
    tails: [],
    selectionRing,
    speechSprite,
    lastDialogue: '',
    accentMeshes: v.accentMeshes,
    headHeight: v.headHeight,
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
      const doorFrame = new THREE.Mesh(makeRoundedBlockGeo(0.62, 0.88, 0.16, 0.14), woodMat);
      doorFrame.position.set(0, 0.56, 1.15);
      const doorArchFrame = new THREE.Mesh(
        new THREE.CylinderGeometry(0.31, 0.31, 0.16, 16),
        woodMat
      );
      doorArchFrame.rotation.x = Math.PI / 2;
      doorArchFrame.position.set(0, 0.98, 1.15);
      const door = new THREE.Mesh(makeRoundedBlockGeo(0.48, 0.82, 0.18, 0.14), woodMat);
      door.position.set(0, 0.54, 1.17);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.036, 12, 10),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
      );
      knob.position.set(0.14, 0.55, 1.27);
      const step = new THREE.Mesh(makeRoundedBlockGeo(0.76, 0.1, 0.28, 0.2), plinthMat);
      step.position.set(0, 0.05, 1.32);

      // Framed circular side window
      const winGroup = new THREE.Group();
      winGroup.position.set(0.94, 0.82, 0.72);
      winGroup.rotation.y = Math.PI / 3.4;
      const winRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 18), woodMat);
      const winPane = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), glassMat);
      winPane.position.z = 0.01;
      const winSill = new THREE.Mesh(makeRoundedBlockGeo(0.52, 0.06, 0.14, 0.2), woodMat);
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

      const plinth = new THREE.Mesh(makeRoundedBlockGeo(2.54, 0.22, 2.04, 0.14), sillMat);
      plinth.position.y = 0.11;
      const mainBox = new THREE.Mesh(makeRoundedBlockGeo(2.4, 1.62, 1.9, 0.1), wallMat);
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

      const upperDeck = new THREE.Mesh(makeRoundedBlockGeo(1.36, 0.82, 1.3, 0.1), wallMat);
      upperDeck.position.set(-0.35, 2.38, -0.05);
      const upperRoof = new THREE.Mesh(buildSwoopedRoof(1.56, 0.54, 1.48), roofMat);
      upperRoof.position.set(-0.35, 2.78, -0.05);

      const chimney = new THREE.Mesh(makeRoundedBlockGeo(0.32, 0.85, 0.32, 0.14), sillMat);
      chimney.position.set(0.75, 2.72, -0.45);
      const chimneyCap = new THREE.Mesh(makeRoundedBlockGeo(0.4, 0.09, 0.4, 0.2), roofMat);
      chimneyCap.position.set(0.75, 3.16, -0.45);

      // Framed 3D windows with sills, mullions & shutters
      const addFramedWindow = (wx: number, wy: number, wz: number, w = 0.64, h = 0.58) => {
        const frame = new THREE.Mesh(makeRoundedBlockGeo(w + 0.12, h + 0.12, 0.1, 0.15), trimMat);
        frame.position.set(wx, wy, wz);
        const pane = new THREE.Mesh(makeRoundedBlockGeo(w, h, 0.12, 0.12), glassMat);
        pane.position.set(wx, wy, wz + 0.01);
        const mullionV = new THREE.Mesh(makeRoundedBlockGeo(0.04, h, 0.14, 0.2), trimMat);
        mullionV.position.set(wx, wy, wz + 0.015);
        const mullionH = new THREE.Mesh(makeRoundedBlockGeo(w, 0.04, 0.14, 0.2), trimMat);
        mullionH.position.set(wx, wy, wz + 0.015);
        const sill = new THREE.Mesh(makeRoundedBlockGeo(w + 0.24, 0.08, 0.18, 0.2), sillMat);
        sill.position.set(wx, wy - h * 0.5 - 0.06, wz + 0.04);
        const shutterL = new THREE.Mesh(makeRoundedBlockGeo(0.14, h + 0.04, 0.06, 0.18), roofMat);
        shutterL.position.set(wx - w * 0.5 - 0.14, wy, wz + 0.02);
        const shutterR = new THREE.Mesh(makeRoundedBlockGeo(0.14, h + 0.04, 0.06, 0.18), roofMat);
        shutterR.position.set(wx + w * 0.5 + 0.14, wy, wz + 0.02);
        bodyPivot.add(frame, pane, mullionV, mullionH, sill, shutterL, shutterR);
      };
      addFramedWindow(0.56, 1.08, 0.96, 0.66, 0.58);
      addFramedWindow(-0.35, 2.42, 0.61, 0.52, 0.44);

      // Arched wooden front door + brass knob + step
      const doorFrame = new THREE.Mesh(makeRoundedBlockGeo(0.62, 1.06, 0.11, 0.14), trimMat);
      doorFrame.position.set(-0.55, 0.72, 0.96);
      const doorArch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.31, 0.31, 0.11, 16),
        trimMat
      );
      doorArch.rotation.x = Math.PI / 2;
      doorArch.position.set(-0.55, 1.24, 0.96);
      const door = new THREE.Mesh(makeRoundedBlockGeo(0.48, 1.02, 0.13, 0.14), trimMat);
      door.position.set(-0.55, 0.71, 0.975);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.036, 12, 10),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
      );
      knob.position.set(-0.4, 0.72, 1.05);
      const porchStep = new THREE.Mesh(makeRoundedBlockGeo(0.76, 0.12, 0.32, 0.2), sillMat);
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
      const woodMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.55 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
      const top = new THREE.Mesh(makeRoundedBlockGeo(1.2, 0.07, 0.72, 0.22), woodMat);
      top.position.y = 0.74;
      bodyPivot.add(top);
      accentMeshes.push(top);
      [
        [-0.5, -0.28],
        [0.5, -0.28],
        [-0.5, 0.28],
        [0.5, 0.28],
      ].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 12), metalMat);
        leg.position.set(x, 0.36, z);
        bodyPivot.add(leg);
      });
      const seat = new THREE.Mesh(makeRoundedBlockGeo(0.54, 0.06, 0.52, 0.24), seatMat);
      seat.position.set(0, 0.44, 0.68);
      const back = new THREE.Mesh(makeRoundedBlockGeo(0.54, 0.44, 0.06, 0.24), seatMat);
      back.position.set(0, 0.68, 0.91);
      bodyPivot.add(seat, back);
      headHeight = 1.25;
      ringRadius = 0.85;
      break;
    }

    case 'fountain': {
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.68 });
      const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.12, clearcoat: 1.0 });
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.42, 28), stoneMat);
      basin.position.y = 0.21;
      const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.34, 28), waterMat);
      waterDisc.position.y = 0.23;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.1, 18), stoneMat);
      pillar.position.y = 0.7;
      const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.24, 0.22, 24), stoneMat);
      topBowl.position.y = 1.2;
      const spout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), waterMat);
      spout.position.y = 1.44;
      bodyPivot.add(basin, waterDisc, pillar, topBowl, spout);
      accentMeshes.push(waterDisc, spout);
      headHeight = 1.8;
      ringRadius = 1.5;
      break;
    }

    case 'football': {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 28, 22),
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
        const patch = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), patchMat);
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
      const blade = new THREE.Mesh(makeRoundedBlockGeo(0.18, 0.78, 0.06, 0.24), accentMat);
      blade.position.set(-0.08, 0.4, 0);
      blade.rotation.z = -0.15;
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.38, 14),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
      );
      handle.position.set(-0.16, 0.94, 0);
      handle.rotation.z = -0.15;
      const cBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 20, 16),
        new THREE.MeshPhysicalMaterial({ color: 0xdc2626, roughness: 0.28, clearcoat: 0.6 })
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
      const pageMat = new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.75 });
      for (let i = 0; i < 4; i++) {
        const bGroup = new THREE.Group();
        const cover = new THREE.Mesh(
          makeRoundedBlockGeo(0.46, 0.1, 0.62, 0.22),
          new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.48 })
        );
        const pages = new THREE.Mesh(makeRoundedBlockGeo(0.42, 0.075, 0.58, 0.18), pageMat);
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
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.35, 16), accentMat);
      log.rotation.z = Math.PI / 2;
      log.position.y = 0.12;
      const branch = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 12), accentMat);
      branch.position.set(0.2, 0.24, 0.06);
      branch.rotation.z = -0.5;
      bodyPivot.add(log, branch);
      accentMeshes.push(log);
      headHeight = 0.65;
      ringRadius = 0.75;
      break;
    }

    case 'toyGun': {
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.28 });
      const grip = new THREE.Mesh(makeRoundedBlockGeo(0.12, 0.28, 0.14, 0.24), darkMat);
      grip.position.set(0, 0.14, -0.14);
      const barrel = new THREE.Mesh(makeRoundedBlockGeo(0.14, 0.16, 0.62, 0.24), accentMat);
      barrel.position.set(0, 0.3, 0.06);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 14), tipMat);
      tip.rotation.x = Math.PI / 2;
      tip.position.set(0, 0.3, 0.4);
      bodyPivot.add(grip, barrel, tip);
      accentMeshes.push(barrel);
      headHeight = 0.7;
      ringRadius = 0.5;
      break;
    }

    case 'magicWand': {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 14), accentMat);
      shaft.position.y = 0.45;
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.MeshPhysicalMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.85, clearcoat: 1.0 })
      );
      star.position.y = 0.98;
      bodyPivot.add(shaft, star);
      accentMeshes.push(shaft);
      headHeight = 1.25;
      ringRadius = 0.45;
      break;
    }

    case 'sword': {
      const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, metalness: 0.82, roughness: 0.22, clearcoat: 0.8 });
      const blade = new THREE.Mesh(
        makeRoundedBlockGeo(0.12, 0.95, 0.04, 0.24),
        new THREE.MeshPhysicalMaterial({ color: accentColor, metalness: 0.88, roughness: 0.16, clearcoat: 0.9 })
      );
      blade.position.y = 0.55;
      const guard = new THREE.Mesh(makeRoundedBlockGeo(0.38, 0.08, 0.09, 0.25), goldMat);
      guard.position.y = 0.24;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 14), goldMat);
      grip.position.y = 0.12;
      bodyPivot.add(blade, guard, grip);
      accentMeshes.push(blade);
      headHeight = 1.25;
      ringRadius = 0.48;
      break;
    }

    case 'smartphone': {
      const caseBody = new THREE.Mesh(makeRoundedBlockGeo(0.32, 0.58, 0.05, 0.22), accentMat);
      caseBody.position.y = 0.3;
      const screen = new THREE.Mesh(
        makeRoundedBlockGeo(0.27, 0.5, 0.055, 0.2),
        new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.7, clearcoat: 1.0 })
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

export function createCustomModelRig(blueprint: CustomModelBlueprint): PropOrCustomRig {
  const built = buildHighDetail3DModel({
    mode: 'custom',
    blueprint,
  });
  if (built.mode !== 'custom') {
    throw new Error('Expected custom build output');
  }

  const c = built.custom;
  const root = new THREE.Group();
  root.add(c.bodyPivot);

  const selectionRing = createSelectionRing(c.ringRadius);
  const shadow = createContactShadow(c.ringRadius * 0.9);
  const speechSprite = createSpeechSprite(c.headHeight + 0.52);

  root.add(shadow, selectionRing, speechSprite);
  enableShadows(root);

  return {
    kind: blueprint.id,
    actorType: 'custom',
    isVehicleLike: c.entityType === 'vehicle',
    root,
    bodyPivot: c.bodyPivot,
    headPivot: c.headPivot,
    jawMesh: c.jawMesh,
    leftBrow: c.leftBrow,
    rightBrow: c.rightBrow,
    leftArmPivot: c.leftArmPivot,
    rightArmPivot: c.rightArmPivot,
    leftForearmPivot: c.leftForearmPivot,
    rightForearmPivot: c.rightForearmPivot,
    leftLegPivot: c.leftLegPivot,
    rightLegPivot: c.rightLegPivot,
    leftKneePivot: c.leftKneePivot,
    rightKneePivot: c.rightKneePivot,
    ponytailPivot: c.ponytailPivot,
    wheels: c.wheels,
    rotors: c.rotors,
    propellers: c.propellers,
    lamps: c.lamps,
    wings: c.wings,
    tails: c.tails,
    selectionRing,
    speechSprite,
    lastDialogue: '',
    accentMeshes: c.accentMeshes,
    headHeight: c.headHeight,
    baseBodyY: c.baseBodyY,
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

  // Vehicle & Custom Vehicle Animations
  if (rig.actorType === 'vehicle' || rig.isVehicleLike) {
    const driving =
      animation === 'Drive/Ride Forward' ||
      animation === 'Walk' ||
      animation === 'Run';
    const hovering = animation === 'Rotor Spin & Hover';
    const flying = animation === 'Fly in Sky' || animation === 'Fly';
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
    const flapSpeed = animation === 'Jump' || animation === 'Dance' || animation === 'Fly in Sky' || animation === 'Fly' ? 11 : 3.5;
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

  // Articulated High-Detail Custom Humanoid / Animal Model
  let bodyY = rig.baseBodyY;
  let lArmX = 0;
  let rArmX = 0;
  let lArmZ = 0.08;
  let rArmZ = -0.08;
  let lForeX = -0.18;
  let rForeX = -0.18;
  let lLegX = 0;
  let rLegX = 0;
  let lKneeX = 0;
  let rKneeX = 0;
  let headY = 0;
  let jawScaleY = 1;

  if (animation === 'Walk' || animation === 'Run' || animation === 'Running & Chasing' || animation === 'Run/Chase') {
    const isRun = animation !== 'Walk';
    const spd = isRun ? 9.5 : 5.5;
    const sw = Math.sin(t * spd);
    bodyY = rig.baseBodyY + Math.abs(Math.cos(t * spd)) * (isRun ? 0.08 : 0.045);
    lLegX = sw * (isRun ? 0.72 : 0.52);
    rLegX = -sw * (isRun ? 0.72 : 0.52);
    lKneeX = Math.max(0, -sw) * (isRun ? 0.75 : 0.42);
    rKneeX = Math.max(0, sw) * (isRun ? 0.75 : 0.42);
    lArmX = -sw * (isRun ? 0.62 : 0.42);
    rArmX = sw * (isRun ? 0.62 : 0.42);
    lForeX = isRun ? -0.85 : -0.32;
    rForeX = isRun ? -0.85 : -0.32;
  } else if (animation === 'Fly in Sky' || animation === 'Fly') {
    bodyY = rig.baseBodyY + 0.8 + Math.sin(t * 2.5) * 0.2;
  } else if (animation === 'Waving Hand (হাত নাড়ানো)' || animation === 'Royal Wave') {
    rArmZ = 2.4 + Math.sin(t * 7) * 0.25;
    rForeX = -0.45 + Math.sin(t * 7) * 0.35;
  } else if (animation === 'Clapping (হাততালি)') {
    const clap = Math.sin(t * 14);
    lArmX = -0.85;
    rArmX = -0.85;
    lArmZ = 0.25 + clap * 0.2;
    rArmZ = -0.25 - clap * 0.2;
    lForeX = -0.6;
    rForeX = -0.6;
  } else if (animation === 'Pointing / Beckoning (ইশারা)') {
    rArmX = -1.25;
    rArmZ = -0.15;
    rForeX = -0.12 + Math.sin(t * 5) * 0.14;
  } else if (animation === 'Jump' || animation === 'Jump/Hop') {
    const air = Math.max(0, Math.sin(t * 3.4));
    bodyY = rig.baseBodyY + air * 0.58;
    lArmZ = 0.4 + air * 0.9;
    rArmZ = -0.4 - air * 0.9;
    lKneeX = air * 0.45;
    rKneeX = air * 0.45;
  } else if (animation === 'Dance') {
    bodyY = rig.baseBodyY + Math.abs(Math.sin(t * 6)) * 0.1;
    lArmX = Math.sin(t * 6) * 0.55;
    rArmX = -Math.sin(t * 6) * 0.55;
    lArmZ = 0.4 + Math.cos(t * 6) * 0.25;
    rArmZ = -0.4 - Math.cos(t * 6) * 0.25;
    lForeX = -0.5;
    rForeX = -0.5;
    headY = Math.sin(t * 3) * 0.2;
  } else if (animation === 'Sit') {
    bodyY = Math.max(0.18, rig.baseBodyY - 0.24);
    lLegX = -1.25;
    rLegX = -1.25;
    lKneeX = 1.25;
    rKneeX = 1.25;
  } else {
    bodyY = rig.baseBodyY + Math.sin(t * 2) * 0.015;
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
    rig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(rig.leftArmPivot.rotation.z, lArmZ, k);
  }
  if (rig.rightArmPivot) {
    rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.x, rArmX, k);
    rig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.z, rArmZ, k);
  }
  if (rig.leftForearmPivot) {
    rig.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(rig.leftForearmPivot.rotation.x, lForeX, k);
  }
  if (rig.rightForearmPivot) {
    rig.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(rig.rightForearmPivot.rotation.x, rForeX, k);
  }
  if (rig.leftLegPivot) {
    rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(rig.leftLegPivot.rotation.x, lLegX, k);
  }
  if (rig.rightLegPivot) {
    rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(rig.rightLegPivot.rotation.x, rLegX, k);
  }
  if (rig.leftKneePivot) {
    rig.leftKneePivot.rotation.x = THREE.MathUtils.lerp(rig.leftKneePivot.rotation.x, lKneeX, k);
  }
  if (rig.rightKneePivot) {
    rig.rightKneePivot.rotation.x = THREE.MathUtils.lerp(rig.rightKneePivot.rotation.x, rKneeX, k);
  }
  if (rig.ponytailPivot) {
    rig.ponytailPivot.rotation.z = Math.sin(t * 3.5) * 0.08;
    rig.ponytailPivot.rotation.x = Math.cos(t * 2.5) * 0.06;
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
