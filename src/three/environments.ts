import * as THREE from 'three';
import { EnvironmentId, LightingMode } from '../types/studio';
import {
  createBrickStoneTexture,
  createCartoonOutline,
  createChalkboardTexture,
  createCobbleTexture,
  createGrassTexture,
  createMarbleTexture,
  createRockTexture,
  createRoofTileTexture,
  createSkyDomeTexture,
  createWaterfallTexture,
  createWaterRippleTexture,
  createWoodPlankTexture,
} from './proceduralTextures';

export interface EnvironmentHandle {
  group: THREE.Group;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  bgColor: number;
  animatedUpdate?: (elapsed: number) => void;
}

function createSkyDome(
  top: string,
  horizon: string,
  bottom: string,
  withRainbowAndClouds = false
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(90, 32, 20);
  const tex = createSkyDomeTexture(top, horizon, bottom, withRainbowAndClouds);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Mesh(geo, mat);
}

function createCloudCluster(scale = 1): THREE.Group {
  const cloud = new THREE.Group();
  const cloudMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 0.12,
    roughness: 0.9,
    clearcoat: 0.05,
    fog: false,
  });
  [
    [0, 0, 0, 1.35],
    [-1.15, -0.15, 0.2, 0.98],
    [1.2, -0.12, -0.15, 1.05],
    [-0.45, 0.55, -0.1, 0.92],
    [0.55, 0.45, 0.2, 0.85],
  ].forEach(([cx, cy, cz, r]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 24, 16), cloudMat);
    puff.scale.set(1.25, 0.78, 0.95);
    puff.position.set(cx * scale, cy * scale, cz * scale);
    cloud.add(puff);
  });
  return cloud;
}

function createCartoonTree(scale = 1, hueShift = 0): THREE.Group {
  const tree = new THREE.Group();

  const trunkMat = new THREE.MeshPhysicalMaterial({
    color: 0x7c4a2d,
    roughness: 0.86,
    metalness: 0.02,
    clearcoat: 0.06,
  });
  const trunkPts = [
    new THREE.Vector2(0.38 * scale, 0.0),
    new THREE.Vector2(0.28 * scale, 0.18 * scale),
    new THREE.Vector2(0.21 * scale, 0.48 * scale),
    new THREE.Vector2(0.18 * scale, 0.96 * scale),
    new THREE.Vector2(0.14 * scale, 1.42 * scale),
  ];
  const trunk = new THREE.Mesh(new THREE.LatheGeometry(trunkPts, 20), trunkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.add(createCartoonOutline(trunk, 1.024, 0x2a1810));
  tree.add(trunk);

  // Curved organic side branches
  const branchL = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.08 * scale, 0.94 * scale, 0.02 * scale),
        new THREE.Vector3(-0.28 * scale, 1.2 * scale, 0.1 * scale),
        new THREE.Vector3(-0.48 * scale, 1.42 * scale, 0.18 * scale),
      ]),
      10,
      0.075 * scale,
      10,
      false
    ),
    trunkMat
  );
  const branchR = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.08 * scale, 0.98 * scale, -0.02 * scale),
        new THREE.Vector3(0.28 * scale, 1.24 * scale, -0.1 * scale),
        new THREE.Vector3(0.46 * scale, 1.44 * scale, -0.16 * scale),
      ]),
      10,
      0.072 * scale,
      10,
      false
    ),
    trunkMat
  );
  branchL.castShadow = true;
  branchR.castShadow = true;
  tree.add(branchL, branchR);

  const leafColor = new THREE.Color(0x3cb84b).offsetHSL(hueShift, 0, 0);
  const leafColor2 = new THREE.Color(0x58cc54).offsetHSL(hueShift, 0, 0);
  const leafDeep = new THREE.Color(0x2a9439).offsetHSL(hueShift, 0, 0);
  const leafMat1 = new THREE.MeshPhysicalMaterial({ color: leafColor, roughness: 0.68, clearcoat: 0.16 });
  const leafMat2 = new THREE.MeshPhysicalMaterial({ color: leafColor2, roughness: 0.64, clearcoat: 0.2 });
  const leafMat3 = new THREE.MeshPhysicalMaterial({ color: leafDeep, roughness: 0.74, clearcoat: 0.12 });

  const puffDefs: Array<[number, number, number, number, THREE.MeshPhysicalMaterial]> = [
    [0, 1.72, 0, 0.88, leafMat1],
    [-0.48, 1.48, 0.26, 0.66, leafMat2],
    [0.46, 1.52, -0.22, 0.64, leafMat2],
    [0.04, 2.26, 0.1, 0.6, leafMat2],
    [-0.18, 1.84, -0.4, 0.56, leafMat3],
    [0.24, 1.46, 0.36, 0.52, leafMat1],
  ];

  puffDefs.forEach(([px, py, pz, r, mat]) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 28, 20), mat);
    p.scale.set(1.06, 0.92, 1.04);
    p.position.set(px * scale, py * scale, pz * scale);
    p.castShadow = true;
    p.receiveShadow = true;
    p.add(createCartoonOutline(p, 1.022, 0x1b3a1a));
    tree.add(p);
  });

  return tree;
}

function createPineTree(scale = 1): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * scale, 0.24 * scale, 1.3 * scale, 20),
    new THREE.MeshStandardMaterial({ color: 0x5c3621, roughness: 0.9 })
  );
  trunk.position.y = 0.65 * scale;
  tree.add(trunk);

  const pineMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 });
  [0, 1, 2].forEach((tier) => {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry((1.05 - tier * 0.22) * scale, (1.15 - tier * 0.12) * scale, 24),
      pineMat
    );
    cone.position.y = (1.55 + tier * 0.68) * scale;
    cone.castShadow = true;
    cone.receiveShadow = true;
    tree.add(cone);
  });
  return tree;
}

function createCottage(roofColor: number, wallColor: number, maxAnisotropy = 4): THREE.Group {
  const house = new THREE.Group();

  const brickTex = createBrickStoneTexture(maxAnisotropy);
  const roofTex = createRoofTileTexture(maxAnisotropy);
  const woodTex = createWoodPlankTexture(maxAnisotropy);
  const cobbleTex = createCobbleTexture(maxAnisotropy);

  const baseMat = new THREE.MeshPhysicalMaterial({ map: cobbleTex, color: 0xcbd5e1, roughness: 0.85 });
  const wallMat = new THREE.MeshPhysicalMaterial({ map: brickTex, color: wallColor, roughness: 0.78 });
  const roofMat = new THREE.MeshPhysicalMaterial({ map: roofTex, color: roofColor, roughness: 0.52, clearcoat: 0.22 });
  const woodMat = new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0x9a5b2c, roughness: 0.72 });
  const shutterMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(roofColor).multiplyScalar(0.85),
    roughness: 0.62,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.62,
    roughness: 0.14,
    clearcoat: 0.85,
  });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.28, 2.64), baseMat);
  plinth.position.y = 0.14;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 2.4), wallMat);
  walls.position.y = 1.28;
  walls.add(createCartoonOutline(walls, 1.018, 0x2a1810));

  // Swooped curved shingled gable roof with flared eaves
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-1.82, -0.08);
  roofShape.quadraticCurveTo(-0.98, 0.56, 0, 1.38);
  roofShape.quadraticCurveTo(0.98, 0.56, 1.82, -0.08);
  roofShape.lineTo(1.68, -0.24);
  roofShape.quadraticCurveTo(0.88, 0.36, 0, 1.16);
  roofShape.quadraticCurveTo(-0.88, 0.36, -1.68, -0.24);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: 2.74,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
  });
  roofGeo.translate(0, 0, -1.37);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 2.28;
  roof.add(createCartoonOutline(roof, 1.02, 0x2a1810));

  // Warm timber gable beam under peak
  const gableBeam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.12), woodMat);
  gableBeam.position.set(0, 2.95, 1.24);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.05, 0.4), baseMat);
  chimney.position.set(0.9, 3.12, -0.5);
  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), roofMat);
  chimneyCap.position.set(0.9, 3.66, -0.5);

  // Arched wood doorway + frame + brass knob + stone steps
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.16, 0.14), woodMat);
  doorFrame.position.set(0, 0.86, 1.21);
  const doorArch = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.14, 18), woodMat);
  doorArch.rotation.x = Math.PI / 2;
  doorArch.position.set(0, 1.42, 1.21);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.1, 0.16), woodMat);
  door.position.set(0, 0.85, 1.23);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 16, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.18 })
  );
  knob.position.set(0.18, 0.84, 1.32);
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.38), baseMat);
  step.position.set(0, 0.06, 1.4);

  house.add(plinth, walls, roof, gableBeam, chimney, chimneyCap, doorFrame, doorArch, door, knob, step);

  [-0.94, 0.94].forEach((wx) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.11), woodMat);
    frame.position.set(wx, 1.42, 1.21);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.13), glassMat);
    pane.position.set(wx, 1.42, 1.22);
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.46, 0.15), woodMat);
    mullionV.position.set(wx, 1.42, 1.225);
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.15), woodMat);
    mullionH.position.set(wx, 1.42, 1.225);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.18), baseMat);
    sill.position.set(wx, 1.1, 1.24);
    const shutterL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.06), shutterMat);
    shutterL.position.set(wx - 0.36, 1.42, 1.22);
    const shutterR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.06), shutterMat);
    shutterR.position.set(wx + 0.36, 1.42, 1.22);
    house.add(frame, pane, mullionV, mullionH, sill, shutterL, shutterR);
  });

  house.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && !obj.userData?.isOutline) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return house;
}

function buildVillage(maxAnisotropy: number): EnvironmentHandle {
  const group = new THREE.Group();
  group.add(createSkyDome('#1e40af', '#60a5fa', '#86efac', true));

  const grassTex = createGrassTexture(maxAnisotropy);
  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9, metalness: 0.0 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(48, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Cobblestone plaza & road
  const cobbleTex = createCobbleTexture(maxAnisotropy);
  const pathMat = new THREE.MeshStandardMaterial({
    map: cobbleTex,
    roughness: 0.82,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.65, 0.04, 28), pathMat);
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  group.add(plaza);

  const roadStrip = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.035, 16), pathMat);
  roadStrip.position.set(0, 0.018, 5.5);
  roadStrip.receiveShadow = true;
  group.add(roadStrip);

  // Flowing Village River, Sandy Swimming Zone, Rocky Waterfall Cliff & Wooden Bridge
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.92 });
  const swimBank = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.1, 0.03, 24), sandMat);
  swimBank.position.set(6.5, 0.015, -3.5);
  swimBank.receiveShadow = true;
  group.add(swimBank);

  const waterTex = createWaterRippleTexture(maxAnisotropy);
  const waterMat = new THREE.MeshPhysicalMaterial({
    map: waterTex,
    roughness: 0.1,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const river = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.045, 34), waterMat);
  river.position.set(6.6, 0.024, 0);
  river.rotation.y = 0.15;
  river.receiveShadow = true;
  group.add(river);

  // Scenic Rocky Cliff & Sparkling Animated Waterfall feeding the river
  const rockTex = createRockTexture(maxAnisotropy);
  const cliffMat = new THREE.MeshPhysicalMaterial({ map: rockTex, roughness: 0.86, metalness: 0.04 });
  const cliffGroup = new THREE.Group();
  [
    [0, 2.3, 0, 2.4, 2.6, 1.8],
    [-2.4, 1.8, 0.5, 1.8, 2.0, 1.5],
    [2.5, 2.0, 0.4, 1.9, 2.3, 1.6],
    [-1.2, 3.6, -0.4, 2.0, 1.8, 1.5],
    [1.3, 3.5, -0.4, 1.9, 1.7, 1.5],
  ].forEach(([rx, ry, rz, sx, sy, sz]) => {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), cliffMat);
    boulder.scale.set(sx, sy, sz);
    boulder.position.set(rx, ry, rz);
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    boulder.add(createCartoonOutline(boulder, 1.025, 0x24140c));
    cliffGroup.add(boulder);
  });

  const waterfallTex = createWaterfallTexture(maxAnisotropy);
  const waterfallMat = new THREE.MeshPhysicalMaterial({
    map: waterfallTex,
    transparent: true,
    opacity: 0.92,
    roughness: 0.12,
    clearcoat: 0.9,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.22,
  });
  const mainFall = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.4), waterfallMat);
  mainFall.position.set(0, 2.1, 1.45);
  mainFall.rotation.x = -0.14;

  const sideFall = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 3.6), waterfallMat);
  sideFall.position.set(2.3, 1.7, 1.55);
  sideFall.rotation.x = -0.14;

  const foamMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 0.25,
    roughness: 0.3,
    transparent: true,
    opacity: 0.86,
  });
  const splashPool = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const foamPuff = new THREE.Mesh(new THREE.SphereGeometry(0.32 + (i % 3) * 0.12, 10, 8), foamMat);
    foamPuff.scale.set(1.4, 0.55, 1.2);
    foamPuff.position.set(-1.1 + i * 0.48, 0.14, 1.95 + (i % 2) * 0.28);
    splashPool.add(foamPuff);
  }

  cliffGroup.add(mainFall, sideFall, splashPool);
  cliffGroup.position.set(7.4, 0, -13.2);
  cliffGroup.rotation.y = -0.25;
  group.add(cliffGroup);

  // Wooden Plank Bridge across the river
  const woodTex = createWoodPlankTexture(maxAnisotropy);
  const bridgeWoodMat = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.72, clearcoat: 0.15 });
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.5), bridgeWoodMat);
  deck.position.y = 0.22;
  const railL = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.08), bridgeWoodMat);
  railL.position.set(0, 0.62, 0.68);
  const railR = railL.clone();
  railR.position.z = -0.68;
  bridge.add(deck, railL, railR);
  bridge.position.set(6.4, 0, 1.5);
  bridge.rotation.y = 0.18;
  [deck, railL, railR].forEach((part) => {
    part.castShadow = true;
    part.receiveShadow = true;
    part.add(createCartoonOutline(part, 1.03, 0x24140c));
  });
  group.add(bridge);

  // Cottages with brick/stone walls, shingle roofs & glowing windows
  const c1 = createCottage(0xdc2626, 0xfef3c7, maxAnisotropy);
  c1.position.set(-5.6, 0, -4.5);
  c1.rotation.y = 0.42;
  group.add(c1);

  const c2 = createCottage(0x2563eb, 0xf1f5f9, maxAnisotropy);
  c2.position.set(3.2, 0, -6.2);
  c2.rotation.y = -0.35;
  group.add(c2);

  const c3 = createCottage(0xd97706, 0xffedd5, maxAnisotropy);
  c3.position.set(-1.4, 0, -8.8);
  group.add(c3);

  // Trees
  [
    [-8.5, -1.5, 1.15, 0.02],
    [-7.8, 3.8, 0.95, -0.03],
    [-4.5, 6.2, 1.05, 0.04],
    [9.2, -1.8, 1.1, -0.02],
    [9.0, 5.2, 1.0, 0.03],
    [-9.5, -7.8, 1.3, 0.01],
    [9.4, -7.5, 1.25, -0.04],
    [-4.8, -10.5, 1.2, 0.02],
    [4.8, -10.2, 1.15, -0.01],
  ].forEach(([x, z, s, h]) => {
    const t = createCartoonTree(s, h);
    t.position.set(x, 0, z);
    group.add(t);
  });

  // Instanced wildflowers
  const flowerGeo = new THREE.ConeGeometry(0.12, 0.12, 6);
  flowerGeo.rotateX(Math.PI);
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 36);
  const dummy = new THREE.Object3D();
  const fColor = new THREE.Color();
  const palette = [0xf43f5e, 0xfbbf24, 0xec4899, 0xa855f7, 0xffffff];
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const rad = 4.0 + ((i * 7) % 5);
    dummy.position.set(Math.cos(angle) * rad, 0.08, Math.sin(angle) * rad);
    dummy.scale.setScalar(0.85 + (i % 4) * 0.15);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    fColor.setHex(palette[i % palette.length]);
    flowers.setColorAt(i, fColor);
  }
  flowers.instanceMatrix.needsUpdate = true;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  flowers.computeBoundingSphere();
  group.add(flowers);

  // Rolling perimeter hills
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.92 });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(7 + (i % 3) * 2, 16, 12), hillMat);
    hill.scale.set(1.6, 0.45, 1.3);
    hill.position.set(Math.cos(angle) * 26, -0.5, Math.sin(angle) * 26);
    group.add(hill);
  }

  // Fluffy 3D Drifting Clouds
  const cloudsGroup = new THREE.Group();
  [
    [-12, 11.5, -24, 1.4],
    [2, 13.0, -28, 1.6],
    [15, 10.8, -22, 1.25],
    [-22, 12.0, -14, 1.2],
  ].forEach(([cx, cy, cz, cs]) => {
    const cl = createCloudCluster(cs);
    cl.position.set(cx, cy, cz);
    cloudsGroup.add(cl);
  });
  group.add(cloudsGroup);

  return {
    group,
    fogColor: 0xcbeafe,
    fogNear: 22,
    fogFar: 66,
    bgColor: 0x60a5fa,
    animatedUpdate: (elapsed) => {
      river.position.z = Math.sin(elapsed * 0.9) * 0.2;
      waterTex.offset.y = (elapsed * 0.28) % 1;
      waterfallTex.offset.y = (elapsed * 0.85) % 1;
      splashPool.children.forEach((puff, idx) => {
        puff.scale.setScalar(0.92 + Math.sin(elapsed * 4.5 + idx) * 0.14);
      });
      cloudsGroup.children.forEach((cl, idx) => {
        cl.position.y += Math.sin(elapsed * 0.8 + idx) * 0.002;
        cl.position.x += 0.004;
        if (cl.position.x > 26) cl.position.x = -26;
      });
    },
  };
}

function buildClassroom(maxAnisotropy: number): EnvironmentHandle {
  const group = new THREE.Group();

  const woodTex = createWoodPlankTexture(maxAnisotropy);
  const floorMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72, metalness: 0.04 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 12), floorMat);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  group.add(floor);

  const brickTex = createBrickStoneTexture(maxAnisotropy);
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex, color: 0xfef3c7, roughness: 0.85 });
  const wainscotMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xd97706, roughness: 0.72 });

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(14, 5.2, 0.25), wallMat);
  backWall.position.set(0, 2.6, -5.5);
  backWall.receiveShadow = true;
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.2, 12), wallMat);
  leftWall.position.set(-7, 2.6, 0.5);
  leftWall.receiveShadow = true;
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.2, 12), wallMat);
  rightWall.position.set(7, 2.6, 0.5);
  rightWall.receiveShadow = true;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.9, 0.28), wainscotMat);
  trim.position.set(0, 0.45, -5.42);
  group.add(backWall, leftWall, rightWall, trim);

  const boardTex = createChalkboardTexture(maxAnisotropy);
  const boardFrameMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.8 });

  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.5, 0.14), boardFrameMat);
  boardFrame.position.set(0, 2.6, -5.32);
  boardFrame.castShadow = true;
  const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(5.45, 2.2), boardMat);
  boardFace.position.set(0, 2.6, -5.23);
  const chalkTray = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.08, 0.22), boardFrameMat);
  chalkTray.position.set(0, 1.32, -5.22);
  group.add(boardFrame, boardFace, chalkTray);

  const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const skyGlassMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x7dd3fc,
    emissiveIntensity: 0.45,
    roughness: 0.15,
  });
  [-2.5, 1.5].forEach((wz) => {
    const wf = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 2.2), windowFrameMat);
    wf.position.set(-6.85, 2.7, wz);
    const wg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.9, 1.9), skyGlassMat);
    wg.position.set(-6.85, 2.7, wz);
    group.add(wf, wg);
  });

  const deskWoodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 });
  const teacherDesk = new THREE.Group();
  const tdTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.0), deskWoodMat);
  tdTop.position.y = 0.82;
  const tdBase = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.78, 0.85), deskWoodMat);
  tdBase.position.y = 0.39;
  const globeStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.35 })
  );
  globeStand.position.set(0.65, 0.93, 0.1);
  const globeBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
  );
  globeBall.position.set(0.65, 1.15, 0.1);
  teacherDesk.add(tdTop, tdBase, globeStand, globeBall);
  teacherDesk.position.set(-3.2, 0, -3.5);
  teacherDesk.rotation.y = 0.2;
  teacherDesk.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  group.add(teacherDesk);

  const legMetalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.35 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.65 });
  const createStudentDesk = (x: number, z: number) => {
    const set = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.07, 0.72), deskWoodMat);
    top.position.y = 0.72;
    set.add(top);

    [
      [-0.48, -0.28],
      [0.48, -0.28],
      [-0.48, 0.28],
      [0.48, 0.28],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), legMetalMat);
      leg.position.set(lx, 0.35, lz);
      set.add(leg);
    });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.52), seatMat);
    seat.position.set(0, 0.44, 0.68);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.46, 0.06), seatMat);
    back.position.set(0, 0.7, 0.91);
    set.add(seat, back);
    set.position.set(x, 0, z);
    set.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return set;
  };

  group.add(createStudentDesk(-3.8, 0.6));
  group.add(createStudentDesk(3.8, 0.6));
  group.add(createStudentDesk(-3.8, 3.0));
  group.add(createStudentDesk(3.8, 3.0));

  const shelf = new THREE.Group();
  const shelfBody = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.2, 2.2), deskWoodMat);
  shelfBody.position.y = 1.1;
  shelf.add(shelfBody);
  const bookColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6];
  for (let b = 0; b < 8; b++) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.32, 0.11),
      new THREE.MeshStandardMaterial({ color: bookColors[b % bookColors.length], roughness: 0.7 })
    );
    book.position.set(-0.22, 1.48, -0.75 + b * 0.2);
    shelf.add(book);
  }
  shelf.position.set(6.45, 0, -2.5);
  group.add(shelf);

  return {
    group,
    fogColor: 0x1e293b,
    fogNear: 18,
    fogFar: 46,
    bgColor: 0x1e293b,
  };
}

function buildCityPark(maxAnisotropy: number): EnvironmentHandle {
  const group = new THREE.Group();
  group.add(createSkyDome('#1e40af', '#60a5fa', '#bfdbfe', true));

  const grassTex = createGrassTexture(maxAnisotropy);
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.92 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(52, 48), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const cobbleTex = createCobbleTexture(maxAnisotropy);
  const paveMat = new THREE.MeshStandardMaterial({
    map: cobbleTex,
    color: 0xe2e8f0,
    roughness: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const centerCircle = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.5, 0.04, 36), paveMat);
  centerCircle.position.y = 0.02;
  centerCircle.receiveShadow = true;
  const pathNS = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.035, 24), paveMat);
  pathNS.position.y = 0.018;
  pathNS.receiveShadow = true;
  const pathEW = new THREE.Mesh(new THREE.BoxGeometry(24, 0.035, 2.4), paveMat);
  pathEW.position.y = 0.018;
  pathEW.receiveShadow = true;
  group.add(centerCircle, pathNS, pathEW);

  const fountain = new THREE.Group();
  const stoneTex = createBrickStoneTexture(maxAnisotropy);
  const parkWaterTex = createWaterRippleTexture(maxAnisotropy);
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xcbd5e1, roughness: 0.72 });
  const waterMat = new THREE.MeshPhysicalMaterial({
    map: parkWaterTex,
    roughness: 0.1,
    metalness: 0.12,
    clearcoat: 1.0,
  });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.8, 0.45, 32), stoneMat);
  basin.position.y = 0.225;
  const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.48, 0.36, 32), waterMat);
  waterDisc.position.y = 0.24;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.25, 24), stoneMat);
  pillar.position.y = 0.75;
  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.28, 0.26, 28), stoneMat);
  topBowl.position.y = 1.35;
  const spout = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), waterMat);
  spout.position.y = 1.62;
  fountain.add(basin, waterDisc, pillar, topBowl, spout);
  fountain.position.set(0, 0, -4.6);
  fountain.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  group.add(fountain);

  const woodTex = createWoodPlankTexture(maxAnisotropy);
  const benchWoodMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb45309, roughness: 0.68 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.35 });
  const makeBench = (x: number, z: number, rotY: number) => {
    const b = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.55), benchWoodMat);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 0.08), benchWoodMat);
    back.position.set(0, 0.75, -0.24);
    back.rotation.x = -0.15;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.5), ironMat);
    legL.position.set(-0.7, 0.225, 0);
    const legR = legL.clone();
    legR.position.x = 0.7;
    b.add(seat, back, legL, legR);
    b.position.set(x, 0, z);
    b.rotation.y = rotY;
    b.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return b;
  };
  group.add(makeBench(-4.2, -1.8, Math.PI / 4));
  group.add(makeBench(4.2, -1.8, -Math.PI / 4));

  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  [
    [-3.2, 3.2],
    [3.2, 3.2],
    [-3.2, -6.5],
    [3.2, -6.5],
  ].forEach(([lx, lz]) => {
    const lamp = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.1, 10), ironMat);
    post.position.y = 1.55;
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lampBulbMat);
    lantern.position.y = 3.22;
    lamp.add(post, lantern);
    lamp.position.set(lx, 0, lz);
    lamp.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    group.add(lamp);
  });

  [
    [-6.8, -4.5, 1.2, 0.02],
    [6.8, -4.2, 1.15, -0.02],
    [-6.5, 4.5, 1.05, 0.04],
    [6.5, 4.8, 1.1, -0.03],
    [0, -9.8, 1.3, 0.01],
  ].forEach(([x, z, s, h]) => {
    const tree = createCartoonTree(s, h);
    tree.position.set(x, 0, z);
    group.add(tree);
  });

  // Sports Ground Pitch & Goalposts on right side of City Park
  const turfMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const pitch = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.03, 4.4), turfMat);
  pitch.position.set(6.2, 0.018, 2.2);
  pitch.receiveShadow = true;
  const midLine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 4.2), lineMat);
  midLine.position.set(6.2, 0.02, 2.2);
  const crease = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.035, 0.8), new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.9 }));
  crease.position.set(6.2, 0.019, 2.2);
  group.add(pitch, midLine, crease);

  const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3, roughness: 0.4 });
  [-1, 1].forEach((side) => {
    const goal = new THREE.Group();
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 8), postMat);
    postL.position.set(0, 0.525, -0.75);
    const postR = postL.clone();
    postR.position.z = 0.75;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.54, 8), postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, 1.05, 0);
    goal.add(postL, postR, bar);
    goal.position.set(6.2 + side * 3.25, 0, 2.2);
    goal.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    group.add(goal);
  });

  const skylineMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x64748b, roughness: 0.7 });
  const skylineWinMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x475569,
    emissive: 0xfef08a,
    emissiveIntensity: 0.22,
    roughness: 0.4,
  });
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const h = 6 + (i % 5) * 3.2;
    const w = 2.6 + (i % 3) * 1.1;
    const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), i % 2 === 0 ? skylineMat : skylineWinMat);
    bldg.position.set(Math.cos(angle) * 24, h / 2 - 0.1, Math.sin(angle) * 24);
    bldg.rotation.y = -angle;
    group.add(bldg);
  }

  const parkClouds = new THREE.Group();
  [
    [-10, 12, -22, 1.35],
    [8, 13.5, -26, 1.5],
  ].forEach(([cx, cy, cz, cs]) => {
    const cl = createCloudCluster(cs);
    cl.position.set(cx, cy, cz);
    parkClouds.add(cl);
  });
  group.add(parkClouds);

  return {
    group,
    fogColor: 0xbae6fd,
    fogNear: 20,
    fogFar: 60,
    bgColor: 0x38bdf8,
    animatedUpdate: (elapsed) => {
      spout.position.y = 1.56 + Math.abs(Math.sin(elapsed * 4.5)) * 0.22;
      spout.scale.setScalar(0.9 + Math.sin(elapsed * 6) * 0.12);
      parkWaterTex.offset.x = (elapsed * 0.18) % 1;
      parkWaterTex.offset.y = (elapsed * 0.12) % 1;
      parkClouds.children.forEach((cl) => {
        cl.position.x += 0.004;
        if (cl.position.x > 26) cl.position.x = -26;
      });
    },
  };
}

function buildNightForest(): EnvironmentHandle {
  const group = new THREE.Group();
  group.add(createSkyDome('#020617', '#0f172a', '#1e293b'));

  // Moon
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xfef9c3, fog: false })
  );
  moon.position.set(-14, 20, -34);
  group.add(moon);

  // Mossy forest ground
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e3a2f, roughness: 0.94 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(50, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Clearing stone circle + glowing campfire
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
  const campfireGroup = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), stoneMat);
    stone.scale.set(1.2, 0.7, 1.0);
    stone.position.set(Math.cos(a) * 0.65, 0.09, Math.sin(a) * 0.65);
    campfireGroup.add(stone);
  }
  const logMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
  for (let l = 0; l < 3; l++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (l * Math.PI) / 3;
    log.position.y = 0.08;
    campfireGroup.add(log);
  }
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 10), flameMat);
  flame.position.y = 0.38;
  const fireLight = new THREE.PointLight(0xfb923c, 3.2, 12, 1.5);
  fireLight.position.set(0, 0.8, 0);
  campfireGroup.add(flame, fireLight);
  campfireGroup.position.set(0, 0, -2.8);
  group.add(campfireGroup);

  // Pine trees around perimeter
  [
    [-5.8, -3.5, 1.25],
    [-7.5, 1.2, 1.4],
    [-4.8, 5.2, 1.1],
    [5.8, -3.2, 1.3],
    [7.4, 1.8, 1.35],
    [4.6, 5.4, 1.15],
    [-2.8, -7.8, 1.45],
    [2.8, -7.5, 1.4],
    [-8.5, -6.8, 1.5],
    [8.6, -6.2, 1.5],
    [0, -10.2, 1.55],
  ].forEach(([x, z, s]) => {
    const p = createPineTree(s);
    p.position.set(x, 0, z);
    group.add(p);
  });

  // Glowing mushrooms
  const mushCapMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  [
    [-3.2, -3.4],
    [3.4, -2.9],
    [-4.5, 2.2],
    [4.1, 2.8],
  ].forEach(([mx, mz]) => {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 })
    );
    stem.position.set(mx, 0.11, mz);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mushCapMat
    );
    cap.position.set(mx, 0.2, mz);
    group.add(stem, cap);
  });

  // Fireflies (instanced glowing orbs)
  const ffGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const ffMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const fireflies = new THREE.InstancedMesh(ffGeo, ffMat, 24);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 3.2 + (i % 5) * 1.1;
    dummy.position.set(Math.cos(a) * r, 0.8 + (i % 4) * 0.45, Math.sin(a) * r);
    dummy.updateMatrix();
    fireflies.setMatrixAt(i, dummy.matrix);
  }
  fireflies.instanceMatrix.needsUpdate = true;
  fireflies.computeBoundingSphere();
  group.add(fireflies);

  return {
    group,
    fogColor: 0x0b1324,
    fogNear: 12,
    fogFar: 44,
    bgColor: 0x0b1324,
    animatedUpdate: (elapsed) => {
      flame.scale.y = 0.9 + Math.sin(elapsed * 11) * 0.18;
      flame.scale.x = 0.95 + Math.cos(elapsed * 9) * 0.1;
      fireLight.intensity = 2.8 + Math.sin(elapsed * 12) * 0.5;
      fireflies.rotation.y = elapsed * 0.06;
    },
  };
}

function buildStudioStage(): EnvironmentHandle {
  const group = new THREE.Group();

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.18 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const cycMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.82,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const backdrop = new THREE.Mesh(
    new THREE.CylinderGeometry(11.5, 11.5, 7.5, 36, 1, true, Math.PI * 0.65, Math.PI * 0.7),
    cycMat
  );
  backdrop.position.set(0, 3.7, 2.0);
  backdrop.receiveShadow = true;
  group.add(backdrop);

  const stageTopMat = new THREE.MeshStandardMaterial({ color: 0x263042, roughness: 0.42, metalness: 0.22 });
  const stageRimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.25, metalness: 0.85 });
  const glowRingMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });

  const stage = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.22, 48), stageTopMat);
  stage.position.y = -0.1;
  stage.receiveShadow = true;
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.06, 12, 48), glowRingMat);
  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.y = 0.02;
  const metallicTrim = new THREE.Mesh(new THREE.TorusGeometry(4.45, 0.08, 12, 48), stageRimMat);
  metallicTrim.rotation.x = Math.PI / 2;
  metallicTrim.position.y = 0.01;
  group.add(stage, outerRing, metallicTrim);

  const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  const trussBar = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.18, 0.18), trussMat);
  trussBar.position.set(0, 4.8, -1.5);
  const leftStand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.8, 10), trussMat);
  leftStand.position.set(-4.7, 2.4, -1.5);
  const rightStand = leftStand.clone();
  rightStand.position.x = 4.7;
  group.add(trussBar, leftStand, rightStand);

  const canMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.35 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.9,
  });
  [-2.6, 0, 2.6].forEach((sx) => {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.42, 14), canMat);
    can.position.set(sx, 4.5, -1.5);
    can.rotation.x = 0.45;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.17, 14), lensMat);
    lens.position.set(sx, 4.32, -1.39);
    lens.rotation.x = Math.PI / 2 + 0.45;
    group.add(can, lens);
  });

  const camGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.56), canMat);
  body.position.y = 1.25;
  const lensTube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 14), trussMat);
  lensTube.rotation.x = Math.PI / 2;
  lensTube.position.set(0, 1.25, 0.4);
  for (let l = 0; l < 3; l++) {
    const a = (l / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 1.2, 8), trussMat);
    leg.position.set(Math.cos(a) * 0.22, 0.56, Math.sin(a) * 0.22);
    leg.rotation.z = Math.cos(a) * 0.24;
    leg.rotation.x = -Math.sin(a) * 0.24;
    camGroup.add(leg);
  }
  camGroup.add(body, lensTube);
  camGroup.position.set(-4.8, 0, 2.6);
  camGroup.rotation.y = 0.85;
  camGroup.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  group.add(camGroup);

  return {
    group,
    fogColor: 0x0b0e14,
    fogNear: 16,
    fogFar: 42,
    bgColor: 0x0b0e14,
  };
}

function buildRoyalPalace(maxAnisotropy = 4): EnvironmentHandle {
  const group = new THREE.Group();

  // Checkered veined marble floor
  const marbleTex = createMarbleTexture(maxAnisotropy);
  const palaceBrickTex = createBrickStoneTexture(maxAnisotropy);
  const marbleLight = new THREE.MeshPhysicalMaterial({ map: marbleTex, color: 0xf8fafc, roughness: 0.2, metalness: 0.1, clearcoat: 0.65 });
  const marbleDark = new THREE.MeshPhysicalMaterial({ map: marbleTex, color: 0x94a3b8, roughness: 0.24, metalness: 0.12, clearcoat: 0.55 });
  const floorBase = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 16), marbleLight);
  floorBase.position.y = -0.1;
  floorBase.receiveShadow = true;
  group.add(floorBase);

  for (let x = -6; x <= 6; x += 2) {
    for (let z = -6; z <= 6; z += 2) {
      if ((Math.abs(x + z) / 2) % 2 === 1) {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.02, 1.98), marbleDark);
        tile.position.set(x, 0.005, z);
        tile.receiveShadow = true;
        group.add(tile);
      }
    }
  }

  // Crimson royal carpet runner
  const carpetMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.88 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.75, roughness: 0.25 });
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 12.5), carpetMat);
  carpet.position.set(0, 0.02, 0.6);
  carpet.receiveShadow = true;
  const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 12.5), goldTrimMat);
  trimL.position.set(-1.3, 0.022, 0.6);
  const trimR = trimL.clone();
  trimR.position.x = 1.3;
  group.add(carpet, trimL, trimR);

  // Back palace wall & royal arches
  const wallMat = new THREE.MeshStandardMaterial({ map: palaceBrickTex, color: 0xfef3c7, roughness: 0.72 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(16, 6.2, 0.35), wallMat);
  backWall.position.set(0, 3.1, -6.4);
  backWall.receiveShadow = true;
  const banner = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.6, 0.12), carpetMat);
  banner.position.set(0, 3.6, -6.18);
  const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), goldTrimMat);
  crest.position.set(0, 4.1, -6.08);
  group.add(backWall, banner, crest);

  // Raised Royal Dais & Golden Throne
  const dais = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.34, 2.6), marbleDark);
  dais.position.set(0, 0.17, -4.5);
  dais.receiveShadow = true;
  const step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.7), marbleLight);
  step.position.set(0, 0.08, -2.9);
  const throneSeat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 0.88), carpetMat);
  throneSeat.position.set(0, 0.56, -4.65);
  const throneBack = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.55, 0.18), goldTrimMat);
  throneBack.position.set(0, 1.35, -5.05);
  const throneCushion = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.12), carpetMat);
  throneCushion.position.set(0, 1.32, -4.94);
  group.add(dais, step, throneSeat, throneBack, throneCushion);

  // 6 Fluted Marble & Gold Pillars
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
  [-4.8, 4.8].forEach((px) => {
    [-4.2, -0.4, 3.4].forEach((pz) => {
      const col = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), goldTrimMat);
      base.position.y = 0.15;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 5.2, 16), pillarMat);
      shaft.position.y = 2.9;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.95), goldTrimMat);
      cap.position.y = 5.65;
      col.add(base, shaft, cap);
      col.position.set(px, 0, pz);
      col.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      group.add(col);
    });
  });

  // Warm Royal Chandelier Lights
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfbbf24,
    emissiveIntensity: 1.2,
  });
  const chandelier = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 10, 24), goldTrimMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 4.9;
  chandelier.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bulbMat);
    flame.position.set(Math.cos(a) * 1.15, 5.05, Math.sin(a) * 1.15);
    chandelier.add(flame);
  }
  const warmLight = new THREE.PointLight(0xfde68a, 2.6, 18, 1.4);
  warmLight.position.set(0, 4.6, -1.2);
  chandelier.position.set(0, 0, -1.2);
  group.add(chandelier, warmLight);

  return {
    group,
    fogColor: 0x1e1b2e,
    fogNear: 18,
    fogFar: 48,
    bgColor: 0x1e1b2e,
    animatedUpdate: (elapsed) => {
      warmLight.intensity = 2.45 + Math.sin(elapsed * 4.2) * 0.2;
    },
  };
}

export function buildEnvironment(id: EnvironmentId, maxAnisotropy = 4): EnvironmentHandle {
  switch (id) {
    case 'village':
      return buildVillage(maxAnisotropy);
    case 'classroom':
      return buildClassroom(maxAnisotropy);
    case 'park':
      return buildCityPark(maxAnisotropy);
    case 'palace':
      return buildRoyalPalace(maxAnisotropy);
    case 'forest':
      return buildNightForest();
    case 'studio':
      return buildStudioStage();
  }
}

export function applyLightingMode(
  scene: THREE.Scene,
  hemiLight: THREE.HemisphereLight,
  keyLight: THREE.DirectionalLight,
  rimLight: THREE.DirectionalLight,
  envHandle: EnvironmentHandle,
  mode: LightingMode,
  preserveBackground = false
): void {
  // Completely eliminate pale/white distance fog so colors remain vibrant and studio-crisp
  scene.fog = null;

  if (mode === 'day') {
    hemiLight.color.setHex(0x38bdf8);
    hemiLight.groundColor.setHex(0x166534);
    hemiLight.intensity = 0.75;
    keyLight.color.setHex(0xfff4d6);
    keyLight.intensity = 2.3;
    keyLight.position.set(8, 14, 10);
    rimLight.color.setHex(0x93c5fd);
    rimLight.intensity = 1.0;
    rimLight.position.set(-7, 8, -10);
    if (!preserveBackground) scene.background = new THREE.Color(envHandle.bgColor);
  } else if (mode === 'sunset') {
    hemiLight.color.setHex(0xfdba74);
    hemiLight.groundColor.setHex(0x4c1d95);
    hemiLight.intensity = 0.85;
    keyLight.color.setHex(0xf97316);
    keyLight.intensity = 2.2;
    keyLight.position.set(-11, 6.5, 8);
    rimLight.color.setHex(0xf472b6);
    rimLight.intensity = 1.0;
    rimLight.position.set(8, 7, -10);
    if (!preserveBackground) scene.background = new THREE.Color(0x431407);
  } else {
    // night
    hemiLight.color.setHex(0x38bdf8);
    hemiLight.groundColor.setHex(0x090d16);
    hemiLight.intensity = 0.55;
    keyLight.color.setHex(0x93c5fd);
    keyLight.intensity = 1.15;
    keyLight.position.set(-7, 13, 6);
    rimLight.color.setHex(0x6366f1);
    rimLight.intensity = 0.95;
    rimLight.position.set(7, 7, -10);
    if (!preserveBackground) scene.background = new THREE.Color(0x060913);
  }
}

export function disposeEnvironment(env: EnvironmentHandle): void {
  env.group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      if (m.userData?.isOutline) return;
      if (m.geometry && !m.userData?.sharedResource) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mt) => {
        if (!mt || mt.userData?.sharedResource) return;
        const std = mt as THREE.MeshStandardMaterial;
        if (std.map && !std.map.userData?.sharedResource) std.map.dispose();
        mt.dispose();
      });
    }
  });
}
