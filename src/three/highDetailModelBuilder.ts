import * as THREE from 'three';
import {
  CharacterKind,
  CustomModelBlueprint,
  CustomModelPart,
  CustomModelStyleSpec,
  HairStyleKind,
  HeadwearKind,
  OutfitStyleKind,
  VehicleKind,
} from '../types/studio';
import {
  createEyeIrisTexture,
  getSharedFabricTexture,
} from './proceduralTextures';

export interface SculptedHumanoidParts {
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  mouthMesh: THREE.Mesh;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftForearmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  leftHandMount: THREE.Group;
  rightHandMount: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightKneePivot: THREE.Group;
  leftWingPivot?: THREE.Group;
  rightWingPivot?: THREE.Group;
  ponytailPivot?: THREE.Group;
  tailPivot?: THREE.Group;
  accentMeshes: THREE.Mesh[];
  baseBodyY: number;
  headHeight: number;
}

export interface SculptedVehicleParts {
  bodyPivot: THREE.Group;
  wheels: THREE.Object3D[];
  rotors: THREE.Object3D[];
  propellers: THREE.Object3D[];
  lamps: THREE.Mesh[];
  accentMeshes: THREE.Mesh[];
  headHeight: number;
  ringRadius: number;
}

export interface SculptedCustomAssembly {
  entityType: 'humanoid' | 'animal' | 'vehicle' | 'prop';
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
  accentMeshes: THREE.Mesh[];
  headHeight: number;
  baseBodyY: number;
  ringRadius: number;
}

export type HighDetailBuildInput =
  | {
      mode: 'character';
      characterKind: CharacterKind;
      accentColor: string;
    }
  | {
      mode: 'vehicle';
      vehicleKind: VehicleKind;
      accentColor: string;
    }
  | {
      mode: 'custom';
      blueprint: CustomModelBlueprint;
    };

export type HighDetailBuildOutput =
  | {
      mode: 'character';
      humanoid: SculptedHumanoidParts;
    }
  | {
      mode: 'vehicle';
      vehicle: SculptedVehicleParts;
    }
  | {
      mode: 'custom';
      custom: SculptedCustomAssembly;
    };

function safeHex(val: string | undefined, fallback: string): string {
  if (typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

export function makeStudioStandardMat(
  color: THREE.ColorRepresentation,
  opts: Partial<THREE.MeshStandardMaterialParameters> = {}
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.05,
    ...opts,
  });
}

export function makeStudioGlossyMat(
  color: THREE.ColorRepresentation,
  opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.14,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    ...opts,
  });
}

// Smooth rounded organic pillow/pouch geometry (zero BoxGeometry)
export function makeOrganicPouchGeo(
  w: number,
  h: number,
  d: number,
  radialSegs = 32
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.5, radialSegs, 24);
  geo.scale(w, h, d);
  geo.computeVertexNormals();
  return geo;
}

// Smooth rounded-corner beveled block for vehicle profiles, books, furniture & sculpted props (zero sharp BoxGeometry)
export function makeRoundedBlockGeo(
  width: number,
  height: number,
  depth: number,
  radiusRatio = 0.22
): THREE.BufferGeometry {
  const w = Math.max(0.04, width);
  const h = Math.max(0.04, height);
  const d = Math.max(0.04, depth);
  const bevel = Math.min(w, h, d) * Math.min(0.28, Math.max(0.08, radiusRatio));
  const innerW = Math.max(0.01, w - bevel * 2);
  const innerH = Math.max(0.01, h - bevel * 2);
  const innerD = Math.max(0.01, d - bevel * 2);
  const hw = innerW * 0.5;
  const hh = innerH * 0.5;
  const r = Math.min(hw, hh) * 0.55;

  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: innerD,
    bevelEnabled: true,
    bevelSegments: 4,
    curveSegments: 12,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Chibi-Pixar head geometry (base SphereGeometry(0.62, 36, 36) contoured with soft cheeks, chin & subtle eye socket hollows; front is +X before -PI/2 Y rotation)
let cachedChibiHeadGeo: THREE.BufferGeometry | null = null;
export function getChibiHeadGeometry(): THREE.BufferGeometry {
  if (cachedChibiHeadGeo) return cachedChibiHeadGeo;
  const geo = new THREE.SphereGeometry(0.62, 36, 36);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i); // front (+X) to back (-X)
    let y = pos.getY(i); // top (+Y) to chin (-Y)
    let z = pos.getZ(i); // left/right cheeks

    // Soft chibi cheek width below eye line & gentle chin
    if (y < 0.09 && y > -0.5) {
      const cheekWeight = Math.sin(((0.09 - y) / 0.59) * Math.PI);
      z *= 1 + cheekWeight * 0.095;
      if (x > 0) x *= 1 + cheekWeight * 0.036;
    }
    if (y < -0.32) {
      const chinT = Math.min(1, (-0.32 - y) / 0.3);
      y += chinT * 0.042;
    }

    // Subtle recessed eye-socket hollows on front (+X) so glossy 3D eyeballs nest cleanly
    if (x > 0.27) {
      const dy = y - 0.06;
      const dz = Math.abs(z) - 0.205;
      const socketDistSq = dy * dy + dz * dz;
      if (socketDistSq < 0.034) {
        const falloff = 1 - socketDistSq / 0.034;
        x -= falloff * falloff * 0.05;
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

export function makeTaperedTorsoGeo(
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

export function makeSculptedPelvisGeo(
  width: number,
  height: number,
  depth: number
): THREE.BufferGeometry {
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

export function makePleatedSkirtGeo(
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
      const t = Math.max(0, Math.min(1, (height * 0.5 - y) / height));
      const angle = Math.atan2(z, x);
      const flare = 1 + t * t * 0.14 + Math.sin(angle * 10) * pleatAmp * t;
      pos.setXYZ(i, x * flare, y, z * flare);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function makeDrapedCapeGeo(width: number, length: number): THREE.BufferGeometry {
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
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const fall = Math.max(0, -y / length);
    const billow =
      -fall * fall * (width * 0.28) -
      Math.cos((x / (width * 0.56)) * Math.PI * 0.5) * 0.03;
    pos.setXYZ(i, x, y, z + billow);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function makeCurvedCapVisorGeo(
  width: number,
  length: number,
  thickness: number
): THREE.BufferGeometry {
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
    const curveDrop =
      ((vx * vx) / (width * width * 0.38)) * (thickness * 2.2) + vz * 0.08;
    pos.setY(i, vy - curveDrop);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function makeSculptedWingGeo(
  style: 'fairy' | 'angel' | 'dragon',
  scaleFactor: number
): THREE.BufferGeometry {
  const s = new THREE.Shape();
  if (style === 'fairy') {
    s.moveTo(0, 0);
    s.bezierCurveTo(
      0.14 * scaleFactor,
      0.26 * scaleFactor,
      0.46 * scaleFactor,
      0.34 * scaleFactor,
      0.48 * scaleFactor,
      0.14 * scaleFactor
    );
    s.bezierCurveTo(
      0.46 * scaleFactor,
      -0.02 * scaleFactor,
      0.3 * scaleFactor,
      -0.04 * scaleFactor,
      0.22 * scaleFactor,
      -0.06 * scaleFactor
    );
    s.bezierCurveTo(
      0.36 * scaleFactor,
      -0.14 * scaleFactor,
      0.34 * scaleFactor,
      -0.34 * scaleFactor,
      0.16 * scaleFactor,
      -0.32 * scaleFactor
    );
    s.bezierCurveTo(
      0.06 * scaleFactor,
      -0.28 * scaleFactor,
      0.02 * scaleFactor,
      -0.14 * scaleFactor,
      0,
      0
    );
  } else if (style === 'dragon') {
    s.moveTo(0, 0.02 * scaleFactor);
    s.quadraticCurveTo(
      0.24 * scaleFactor,
      0.36 * scaleFactor,
      0.56 * scaleFactor,
      0.26 * scaleFactor
    );
    s.quadraticCurveTo(
      0.44 * scaleFactor,
      0.06 * scaleFactor,
      0.48 * scaleFactor,
      -0.12 * scaleFactor
    );
    s.quadraticCurveTo(
      0.32 * scaleFactor,
      -0.04 * scaleFactor,
      0.28 * scaleFactor,
      -0.22 * scaleFactor
    );
    s.quadraticCurveTo(
      0.15 * scaleFactor,
      -0.08 * scaleFactor,
      0.06 * scaleFactor,
      -0.2 * scaleFactor
    );
    s.closePath();
  } else {
    s.moveTo(0, 0.04 * scaleFactor);
    s.bezierCurveTo(
      0.14 * scaleFactor,
      0.3 * scaleFactor,
      0.44 * scaleFactor,
      0.32 * scaleFactor,
      0.5 * scaleFactor,
      0.12 * scaleFactor
    );
    s.quadraticCurveTo(
      0.42 * scaleFactor,
      0.04 * scaleFactor,
      0.44 * scaleFactor,
      -0.04 * scaleFactor
    );
    s.quadraticCurveTo(
      0.34 * scaleFactor,
      -0.08 * scaleFactor,
      0.36 * scaleFactor,
      -0.16 * scaleFactor
    );
    s.quadraticCurveTo(
      0.24 * scaleFactor,
      -0.18 * scaleFactor,
      0.24 * scaleFactor,
      -0.26 * scaleFactor
    );
    s.bezierCurveTo(
      0.12 * scaleFactor,
      -0.26 * scaleFactor,
      0.04 * scaleFactor,
      -0.14 * scaleFactor,
      0,
      -0.04 * scaleFactor
    );
    s.closePath();
  }

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.016 * scaleFactor,
    bevelEnabled: true,
    bevelSegments: 3,
    curveSegments: 18,
    bevelSize: 0.008 * scaleFactor,
    bevelThickness: 0.008 * scaleFactor,
  });
  geo.computeVertexNormals();
  return geo;
}

function makeShoeSoleGeo(
  width: number,
  length: number,
  height: number
): THREE.BufferGeometry {
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

export function buildCartoonSneaker(
  scaleFactor: number,
  upperMat: THREE.Material,
  soleMat: THREE.Material,
  accentMat: THREE.Material
): THREE.Group {
  const shoe = new THREE.Group();

  const sole = new THREE.Mesh(
    makeShoeSoleGeo(0.165 * scaleFactor, 0.255 * scaleFactor, 0.028 * scaleFactor),
    soleMat
  );
  sole.position.set(0, 0.036 * scaleFactor, 0.042 * scaleFactor);

  const upper = new THREE.Mesh(
    new THREE.SphereGeometry(0.088 * scaleFactor, 28, 20),
    upperMat
  );
  upper.scale.set(0.9, 0.62, 1.38);
  upper.position.set(0, 0.072 * scaleFactor, 0.036 * scaleFactor);

  const toeCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.074 * scaleFactor, 24, 18),
    soleMat
  );
  toeCap.scale.set(1.02, 0.66, 1.14);
  toeCap.position.set(0, 0.056 * scaleFactor, 0.128 * scaleFactor);

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

  [0.08, 0.11].forEach((lz, idx) => {
    const laceCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(
        -0.046 * scaleFactor,
        (0.104 - idx * 0.01) * scaleFactor,
        lz * scaleFactor
      ),
      new THREE.Vector3(
        0,
        (0.116 - idx * 0.01) * scaleFactor,
        (lz + 0.01) * scaleFactor
      ),
      new THREE.Vector3(
        0.046 * scaleFactor,
        (0.104 - idx * 0.01) * scaleFactor,
        lz * scaleFactor
      ),
    ]);
    const lace = new THREE.Mesh(
      new THREE.TubeGeometry(laceCurve, 12, 0.008 * scaleFactor, 10, false),
      soleMat
    );
    shoe.add(lace);
  });

  return shoe;
}

export function buildCartoonHand(
  side: -1 | 1,
  scaleFactor: number,
  handMat: THREE.Material,
  hasGloves: boolean,
  gloveCuffMat: THREE.Material
): THREE.Group {
  const handGroup = new THREE.Group();

  const palm = new THREE.Mesh(
    new THREE.SphereGeometry(0.055 * scaleFactor, 24, 18),
    handMat
  );
  palm.scale.set(0.96, 1.04, 0.68);
  handGroup.add(palm);

  const thumbPivot = new THREE.Group();
  thumbPivot.position.set(
    -side * 0.044 * scaleFactor,
    0.008 * scaleFactor,
    0.026 * scaleFactor
  );
  thumbPivot.rotation.set(0.38, side * -0.42, side * -0.6);
  const thumb = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.016 * scaleFactor, 0.028 * scaleFactor, 10, 16),
    handMat
  );
  thumb.position.y = -0.016 * scaleFactor;
  thumbPivot.add(thumb);
  handGroup.add(thumbPivot);

  [-0.028, -0.009, 0.01, 0.028].forEach((fx, idx) => {
    const fLen = (idx === 1 || idx === 2 ? 0.032 : 0.025) * scaleFactor;
    const finger = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.013 * scaleFactor, fLen, 10, 16),
      handMat
    );
    finger.position.set(
      fx * scaleFactor,
      -0.049 * scaleFactor,
      0.018 * scaleFactor
    );
    finger.rotation.x = 0.45;
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

export function createCrownMesh(isTiara: boolean): THREE.Group {
  const crown = new THREE.Group();
  const goldMat = makeStudioGlossyMat(0xfbbf24, {
    metalness: 0.88,
    roughness: 0.14,
    clearcoat: 0.95,
  });
  const velvetMat = makeStudioStandardMat(0x991b1b, { roughness: 0.72 });
  const rubyMat = makeStudioGlossyMat(isTiara ? 0xec4899 : 0xef4444, {
    emissive: isTiara ? 0xdb2777 : 0xb91c1c,
    emissiveIntensity: 0.48,
    roughness: 0.08,
    clearcoat: 1.0,
  });
  const emeraldMat = makeStudioGlossyMat(0x10b981, {
    emissive: 0x059669,
    emissiveIntensity: 0.42,
    roughness: 0.08,
    clearcoat: 1.0,
  });
  const sapphireMat = makeStudioGlossyMat(0x38bdf8, {
    emissive: 0x0284c7,
    emissiveIntensity: 0.42,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  const rad = isTiara ? 0.19 : 0.24;
  const bandH = isTiara ? 0.07 : 0.115;

  // Flared golden crown band + lower torus rim
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(rad * 1.12, rad, bandH, 32, 1, false),
    goldMat
  );
  crown.add(band);

  const lowerRim = new THREE.Mesh(
    new THREE.TorusGeometry(rad, 0.018, 12, 32),
    goldMat
  );
  lowerRim.rotation.x = Math.PI / 2;
  lowerRim.position.y = -bandH * 0.46;
  crown.add(lowerRim);

  // Royal velvet inner cushion dome for King/Queen/Prince crowns
  if (!isTiara) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(rad * 0.96, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      velvetMat
    );
    cap.scale.set(1, 0.72, 1);
    cap.position.y = 0.025;
    crown.add(cap);
  }

  const count = isTiara ? 5 : 6;
  const gemMats = [rubyMat, emeraldMat, sapphireMat];
  for (let i = 0; i < count; i++) {
    const angle = isTiara
      ? -1.05 + (i / (count - 1)) * 2.1
      : (i / count) * Math.PI * 2;
    const isCenterTiara = isTiara && i === 2;
    const spikeH = isTiara ? (isCenterTiara ? 0.12 : 0.082) : 0.13;
    const spikeR = isTiara ? 0.028 : 0.04;
    const tipY = bandH * 0.45 + spikeH;

    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(spikeR, spikeH, 20),
      goldMat
    );
    spike.position.set(
      Math.sin(angle) * rad * 1.05,
      bandH * 0.45 + spikeH * 0.45,
      Math.cos(angle) * rad * 1.05
    );
    crown.add(spike);

    // Sculpted gold orb finial atop each crown point
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(isTiara ? 0.016 : 0.024, 14, 12),
      goldMat
    );
    finial.position.set(
      Math.sin(angle) * rad * 1.05,
      tipY - 0.005,
      Math.cos(angle) * rad * 1.05
    );
    crown.add(finial);

    // Sparkling gems around the band
    const bandGem = new THREE.Mesh(
      new THREE.SphereGeometry(isTiara ? 0.02 : 0.027, 14, 12),
      gemMats[i % gemMats.length]
    );
    bandGem.scale.set(1, 1.15, 0.7);
    bandGem.position.set(
      Math.sin(angle) * (rad * 1.08),
      0.005,
      Math.cos(angle) * (rad * 1.08)
    );
    crown.add(bandGem);
  }

  // Prominent center front jewel
  const centerGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(isTiara ? 0.036 : 0.048, 1),
    rubyMat
  );
  centerGem.position.set(0, 0.02, rad * 1.14);
  crown.add(centerGem);

  return crown;
}

interface HumanoidSpec {
  presetKind?: CharacterKind;
  scaleFactor: number;
  isFemale: boolean;
  hasFreckles: boolean;
  skinColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  hairColor: string;
  eyeColor: string;
  hairStyle: HairStyleKind;
  headwear: HeadwearKind;
  outfitStyle: OutfitStyleKind;
  accessories: Set<string>;
}

function resolveBuiltinHumanoidSpec(
  kind: Exclude<CharacterKind, 'robot'>,
  accentColor: string
): HumanoidSpec {
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

  const skinColor =
    kind === 'witch'
      ? '#d9f99d'
      : kind === 'farmer'
        ? '#e2a882'
        : isFemale
          ? '#fad2b8'
          : '#f4c2a1';

  const secondaryColor =
    kind === 'police'
      ? '#0f172a'
      : kind === 'chef'
        ? '#334155'
        : kind === 'farmer'
          ? '#1d4ed8'
          : kind === 'doctor'
            ? '#0f766e'
            : kind === 'angel'
              ? '#f1f5f9'
              : kind === 'superhero'
                ? '#1d4ed8'
                : '#1e293b';

  const hairColor = isElder
    ? '#e2e8f0'
    : kind === 'witch'
      ? '#1e1b4b'
      : isFemale
        ? '#5a2d18'
        : '#3b2314';

  const eyeColor = isFemale
    ? '#16a34a'
    : ['twins', 'police', 'angel', 'superhero', 'doctor'].includes(kind)
      ? '#0284c7'
      : '#d97706';

  let hairStyle: HairStyleKind = 'short';
  if (kind === 'girl' || kind === 'daughter') hairStyle = 'ponytail';
  else if (kind === 'woman' || kind === 'mother' || kind === 'grandma') hairStyle = 'bun';
  else if (kind === 'queen' || kind === 'princess' || kind === 'fairy' || kind === 'angel' || kind === 'witch') hairStyle = 'long';

  let headwear: HeadwearKind = 'none';
  if (['boy', 'son', 'kid', 'twins'].includes(kind)) headwear = 'cap';
  else if (kind === 'teenager') headwear = 'beanie';
  else if (kind === 'farmer') headwear = 'strawHat';
  else if (kind === 'police') headwear = 'policeCap';
  else if (kind === 'chef') headwear = 'chefHat';
  else if (kind === 'king' || kind === 'prince') headwear = 'crown';
  else if (kind === 'queen' || kind === 'princess') headwear = 'tiara';
  else if (kind === 'angel') headwear = 'halo';
  else if (kind === 'fairy') headwear = 'wreath';
  else if (kind === 'witch') headwear = 'witchHat';
  else if (kind === 'wizard') headwear = 'wizardHat';

  let outfitStyle: OutfitStyleKind = 'tshirt';
  if (kind === 'teenager') outfitStyle = 'hoodie';
  else if (kind === 'teacher' || kind === 'father') outfitStyle = 'jacket';
  else if (kind === 'farmer') outfitStyle = 'overalls';
  else if (kind === 'doctor') outfitStyle = 'labcoat';
  else if (kind === 'police' || kind === 'chef') outfitStyle = 'uniform';
  else if (kind === 'superhero') outfitStyle = 'superhero';
  else if (kind === 'mother') outfitStyle = 'saree';
  else if (['king', 'queen', 'wizard', 'witch', 'princess'].includes(kind)) outfitStyle = 'robe';
  else if (isFemale) outfitStyle = 'dress';

  const accessories = new Set<string>();
  if (['boy', 'girl', 'teenager', 'kid', 'son', 'daughter', 'twins'].includes(kind)) {
    accessories.add('backpack');
  }
  if (['boy', 'teenager', 'police', 'superhero', 'twins'].includes(kind)) {
    accessories.add('gloves');
  }
  if (['king', 'queen', 'superhero', 'witch'].includes(kind)) {
    accessories.add('cape');
  }
  if (kind === 'fairy') accessories.add('fairyWings');
  if (kind === 'angel') accessories.add('angelWings');
  if (['teacher', 'grandpa', 'grandma'].includes(kind)) accessories.add('glasses');
  if (kind === 'father' || kind === 'grandpa') accessories.add('moustache');
  if (kind === 'king' || kind === 'wizard') accessories.add('beard');
  if (kind === 'superhero') accessories.add('mask');
  if (kind === 'doctor') accessories.add('stethoscope');
  if (kind === 'father') accessories.add('watch');
  if (['boy', 'kid', 'son', 'twins', 'teenager'].includes(kind)) {
    accessories.add('cargoPockets');
  }

  return {
    presetKind: kind,
    scaleFactor: isYoungKid ? 0.85 : isAdult ? 1.12 : 0.98,
    isFemale,
    hasFreckles: ['boy', 'girl', 'kid', 'son', 'daughter', 'twins'].includes(kind),
    skinColor,
    primaryColor: accentColor,
    secondaryColor,
    accentColor: '#facc15',
    hairColor,
    eyeColor,
    hairStyle,
    headwear,
    outfitStyle,
    accessories,
  };
}

function buildSculptedRobotModel(accentColor: string): SculptedHumanoidParts {
  const accentMeshes: THREE.Mesh[] = [];
  const shellMat = makeStudioGlossyMat(0xf8fafc, {
    roughness: 0.16,
    metalness: 0.12,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
  });
  const jointMat = makeStudioGlossyMat(0x1e293b, {
    roughness: 0.32,
    metalness: 0.55,
    clearcoat: 0.45,
  });
  const glowMat = makeStudioGlossyMat(accentColor, {
    emissive: accentColor,
    emissiveIntensity: 0.85,
    roughness: 0.14,
    metalness: 0.1,
    clearcoat: 0.9,
  });
  const visorMat = makeStudioGlossyMat(0x090f1d, {
    roughness: 0.05,
    metalness: 0.6,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });
  const orangeBeakMat = makeStudioGlossyMat(0xf97316, {
    roughness: 0.24,
    clearcoat: 0.78,
  });

  const baseBodyY = 0.52;
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;

  const torso = new THREE.Mesh(makeTaperedTorsoGeo(0.56, 0.56, 0.4, 36), shellMat);
  torso.position.y = 0.08;
  bodyPivot.add(torso);

  const chestBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.05, 36),
    jointMat
  );
  chestBezel.rotation.x = Math.PI / 2;
  chestBezel.position.set(0, 0.36, 0.185);
  const chestCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.06, 36),
    glowMat
  );
  chestCore.rotation.x = Math.PI / 2;
  chestCore.position.set(0, 0.36, 0.19);
  bodyPivot.add(chestBezel, chestCore);
  accentMeshes.push(chestCore);

  const waist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.19, 0.14, 36),
    jointMat
  );
  waist.position.y = 0.06;
  bodyPivot.add(waist);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.64;
  bodyPivot.add(headPivot);

  const headBox = new THREE.Mesh(makeOrganicPouchGeo(0.58, 0.44, 0.44, 40), shellMat);
  headBox.position.y = 0.23;
  headPivot.add(headBox);

  const visor = new THREE.Mesh(makeOrganicPouchGeo(0.43, 0.22, 0.14, 32), visorMat);
  visor.position.set(0, 0.24, 0.165);
  headPivot.add(visor);

  [-1, 1].forEach((side) => {
    const earPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.06, 36),
      glowMat
    );
    earPod.rotation.z = Math.PI / 2;
    earPod.position.set(side * 0.295, 0.23, 0);
    headPivot.add(earPod);
    accentMeshes.push(earPod);
  });

  const robotIrisTex = createEyeIrisTexture('#06b6d4');
  const robotEyeMat = makeStudioGlossyMat(0xffffff, {
    map: robotIrisTex,
    emissive: accentColor,
    emissiveMap: robotIrisTex,
    emissiveIntensity: 0.65,
    roughness: 0.05,
    clearcoat: 1.0,
  });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  catchMat.userData.sharedResource = true;

  const makeBotEye = (x: number) => {
    const eg = new THREE.Group();
    eg.position.set(x, 0.25, 0.22);
    const eyeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 32, 24),
      robotEyeMat
    );
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

  const mouthMesh = new THREE.Mesh(
    makeOrganicPouchGeo(0.12, 0.048, 0.06, 24),
    orangeBeakMat
  );
  mouthMesh.position.set(0, 0.16, 0.215);
  headPivot.add(mouthMesh);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 0.16, 24),
    jointMat
  );
  stem.position.y = 0.51;
  const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), glowMat);
  bulb.position.y = 0.62;
  headPivot.add(stem, bulb);
  accentMeshes.push(bulb);

  const makeRobotArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.33, 0.52, 0);
    shoulder.add(new THREE.Mesh(new THREE.SphereGeometry(0.076, 24, 18), jointMat));

    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.056, 0.135, 12, 24),
      shellMat
    );
    upper.position.y = -0.115;
    shoulder.add(upper);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.y = -0.24;
    shoulder.add(forearmPivot);

    forearmPivot.add(
      new THREE.Mesh(new THREE.SphereGeometry(0.058, 24, 18), jointMat)
    );
    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.046, 0.12, 12, 24),
      shellMat
    );
    lower.position.y = -0.1;
    forearmPivot.add(lower);

    const claw = buildCartoonHand(side, 0.98, jointMat, false, glowMat);
    claw.position.y = -0.22;
    forearmPivot.add(claw);

    const handMount = new THREE.Group();
    handMount.position.set(0, -0.235, 0.05);
    forearmPivot.add(handMount);

    shoulder.rotation.z = side * 0.18;
    forearmPivot.rotation.x = -0.14;
    bodyPivot.add(shoulder);
    return { shoulder, forearmPivot, handMount };
  };

  const leftArm = makeRobotArm(-1);
  const rightArm = makeRobotArm(1);

  const makeRobotLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, 0, 0);
    hip.add(new THREE.Mesh(new THREE.SphereGeometry(0.074, 24, 18), jointMat));

    const upperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.078, 0.13, 12, 24),
      shellMat
    );
    upperLeg.position.y = -0.11;
    hip.add(upperLeg);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.22;
    hip.add(kneePivot);

    kneePivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 24, 18), jointMat));
    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.068, 0.12, 12, 24),
      shellMat
    );
    shin.position.y = -0.1;
    kneePivot.add(shin);

    const foot = buildCartoonSneaker(1.02, jointMat, shellMat, glowMat);
    foot.position.set(0, -baseBodyY + 0.22, 0);
    kneePivot.add(foot);

    bodyPivot.add(hip);
    return { hip, kneePivot };
  };

  const leftLeg = makeRobotLeg(-1);
  const rightLeg = makeRobotLeg(1);

  return {
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
    accentMeshes,
    baseBodyY,
    headHeight: 1.85,
  };
}

function buildSculptedHumanoidAssembly(spec: HumanoidSpec): SculptedHumanoidParts {
  const {
    presetKind,
    scaleFactor,
    isFemale,
    skinColor,
    primaryColor,
    secondaryColor,
    accentColor,
    hairColor,
    eyeColor,
    hairStyle,
    headwear,
    outfitStyle,
    accessories,
  } = spec;

  const accentMeshes: THREE.Mesh[] = [];
  const fabricTex = getSharedFabricTexture();

  const skinMat = makeStudioStandardMat(skinColor, { roughness: 0.46, metalness: 0.02 });
  const shirtMat = makeStudioStandardMat(primaryColor, {
    map: fabricTex,
    roughness: 0.44,
    metalness: 0.05,
  });
  const pantsMat = makeStudioStandardMat(secondaryColor, {
    map: fabricTex,
    roughness: 0.46,
    metalness: 0.05,
  });
  const hairMat = makeStudioStandardMat(hairColor, {
    roughness: 0.36,
    metalness: 0.04,
  });
  const shoeMat = makeStudioStandardMat(scaleFactor > 1.05 ? 0x1f2937 : 0xf8fafc, {
    roughness: 0.32,
    metalness: 0.06,
  });
  const darkMat = makeStudioStandardMat(0x111827, { roughness: 0.34, metalness: 0.08 });
  const whiteMat = makeStudioStandardMat(0xffffff, { roughness: 0.25, metalness: 0.04 });
  const mouthMat = makeStudioStandardMat(0x7f1d1d, { roughness: 0.34, metalness: 0.02 });
  const goldMat = makeStudioGlossyMat(accentColor, {
    metalness: 0.8,
    roughness: 0.2,
    clearcoat: 0.85,
  });

  const legLen = 0.56 * scaleFactor;
  const torsoH = 0.55 * scaleFactor;
  const baseBodyY = legLen;

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = baseBodyY;

  // Sculpted Pelvis + Belt
  const pelvis = new THREE.Mesh(
    makeSculptedPelvisGeo(0.41 * scaleFactor, 0.16 * scaleFactor, 0.28 * scaleFactor),
    pantsMat
  );
  pelvis.position.y = 0.04 * scaleFactor;
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
    goldMat
  );
  beltBuckle.position.set(0, 0.095 * scaleFactor, 0.155 * scaleFactor);
  bodyPivot.add(belt, beltBuckle);

  const isWhiteCoat =
    outfitStyle === 'labcoat' ||
    presetKind === 'doctor' ||
    presetKind === 'chef' ||
    presetKind === 'angel';
  const torsoMat = isWhiteCoat
    ? makeStudioStandardMat(0xf8fafc, { map: fabricTex, roughness: 0.52 })
    : outfitStyle === 'armor'
      ? makeStudioGlossyMat(primaryColor, { metalness: 0.65, roughness: 0.24 })
      : shirtMat;

  const torso = new THREE.Mesh(
    makeTaperedTorsoGeo(0.45 * scaleFactor, torsoH, 0.3 * scaleFactor, 36),
    torsoMat
  );
  torso.position.y = 0.075 * scaleFactor;
  bodyPivot.add(torso);
  if (!isWhiteCoat) accentMeshes.push(torso);

  // Shirt Collar / Buttons
  if (outfitStyle === 'jacket' || outfitStyle === 'uniform' || outfitStyle === 'labcoat') {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.118 * scaleFactor, 0.025 * scaleFactor, 16, 36),
      isWhiteCoat ? torsoMat : whiteMat
    );
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

  // Skirt / Dress / Robe / Saree
  if (outfitStyle === 'dress' || outfitStyle === 'robe' || outfitStyle === 'saree') {
    const isLongGown = outfitStyle === 'robe' || outfitStyle === 'saree';
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
    bodyPivot.add(skirt);
    accentMeshes.push(skirt);
  }

  // Outfit details
  if (outfitStyle === 'hoodie') {
    const hoodCowl = new THREE.Mesh(
      new THREE.TorusGeometry(
        0.145 * scaleFactor,
        0.046 * scaleFactor,
        16,
        32,
        Math.PI * 1.45
      ),
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
  } else if (outfitStyle === 'saree' || presetKind === 'woman') {
    const necklace = new THREE.Mesh(
      new THREE.TorusGeometry(0.128 * scaleFactor, 0.015 * scaleFactor, 14, 32),
      goldMat
    );
    necklace.rotation.x = Math.PI / 2.1;
    necklace.position.set(0, 0.065 * scaleFactor + torsoH, 0.018 * scaleFactor);
    bodyPivot.add(necklace);

    if (outfitStyle === 'saree') {
      const palluCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.17 * scaleFactor, 0.16 * scaleFactor, 0.11 * scaleFactor),
        new THREE.Vector3(0.02 * scaleFactor, 0.36 * scaleFactor, 0.155 * scaleFactor),
        new THREE.Vector3(-0.15 * scaleFactor, 0.56 * scaleFactor, 0.07 * scaleFactor),
        new THREE.Vector3(-0.16 * scaleFactor, 0.5 * scaleFactor, -0.14 * scaleFactor),
        new THREE.Vector3(-0.12 * scaleFactor, 0.2 * scaleFactor, -0.18 * scaleFactor),
      ]);
      const pallu = new THREE.Mesh(
        new THREE.TubeGeometry(palluCurve, 22, 0.048 * scaleFactor, 16, false),
        makeStudioStandardMat(0xfef08a, { map: fabricTex, roughness: 0.48 })
      );
      pallu.scale.set(1.25, 1, 0.52);
      bodyPivot.add(pallu);
    }
  } else if (outfitStyle === 'jacket') {
    const tieCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.56 * scaleFactor, 0.125 * scaleFactor),
      new THREE.Vector3(0, 0.42 * scaleFactor, 0.152 * scaleFactor),
      new THREE.Vector3(0, 0.24 * scaleFactor, 0.142 * scaleFactor),
    ]);
    const tie = new THREE.Mesh(
      new THREE.TubeGeometry(tieCurve, 14, 0.032 * scaleFactor, 14, false),
      makeStudioStandardMat(0xdc2626, { map: fabricTex })
    );
    tie.scale.set(1.15, 1, 0.45);
    const tieKnot = new THREE.Mesh(
      new THREE.SphereGeometry(0.036 * scaleFactor, 18, 14),
      makeStudioStandardMat(0xb91c1c)
    );
    tieKnot.position.set(0, 0.565 * scaleFactor, 0.132 * scaleFactor);
    bodyPivot.add(tie, tieKnot);
  } else if (outfitStyle === 'overalls') {
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
        goldMat
      );
      btn.position.set(sx * scaleFactor, 0.4 * scaleFactor, 0.142 * scaleFactor);
      bodyPivot.add(strap, btn);
    });
    const bandana = new THREE.Mesh(
      new THREE.TorusGeometry(0.14 * scaleFactor, 0.034 * scaleFactor, 14, 28),
      makeStudioStandardMat(0xef4444, { map: fabricTex })
    );
    bandana.rotation.x = Math.PI / 2.2;
    bandana.position.set(0, 0.095 * scaleFactor + torsoH, 0.02);
    bodyPivot.add(bib, bandana);
  } else if (outfitStyle === 'labcoat') {
    const scrub = new THREE.Mesh(
      makeOrganicPouchGeo(0.18 * scaleFactor, 0.28 * scaleFactor, 0.07 * scaleFactor),
      shirtMat
    );
    scrub.position.set(0, 0.43 * scaleFactor, 0.124 * scaleFactor);
    bodyPivot.add(scrub);
    accentMeshes.push(scrub);
  } else if (outfitStyle === 'superhero' || outfitStyle === 'armor') {
    const emblem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09 * scaleFactor, 0.09 * scaleFactor, 0.04, 24),
      makeStudioGlossyMat(accentColor, {
        emissive: accentColor,
        emissiveIntensity: 0.35,
      })
    );
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 0.44 * scaleFactor, 0.145 * scaleFactor);
    bodyPivot.add(emblem);
  } else if (outfitStyle === 'uniform') {
    if (presetKind === 'chef') {
      const scarf = new THREE.Mesh(
        new THREE.TorusGeometry(0.14 * scaleFactor, 0.032 * scaleFactor, 14, 28),
        shirtMat
      );
      scarf.rotation.x = Math.PI / 2.2;
      scarf.position.set(0, 0.095 * scaleFactor + torsoH, 0.02);
      const apron = new THREE.Mesh(
        makePleatedSkirtGeo(
          0.2 * scaleFactor,
          0.25 * scaleFactor,
          0.34 * scaleFactor,
          32,
          0.02
        ),
        whiteMat
      );
      apron.position.set(0, 0.08 * scaleFactor, 0.02 * scaleFactor);
      bodyPivot.add(scarf, apron);
      accentMeshes.push(scarf);
    } else {
      const badge = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.055 * scaleFactor, 1),
        goldMat
      );
      badge.position.set(0.11 * scaleFactor, 0.45 * scaleFactor, 0.145 * scaleFactor);
      bodyPivot.add(badge);
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

  if (accessories.has('stethoscope')) {
    const stethMat = makeStudioGlossyMat(0x1e293b, { metalness: 0.45, roughness: 0.24 });
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
      new THREE.CylinderGeometry(
        0.044 * scaleFactor,
        0.044 * scaleFactor,
        0.022,
        24
      ),
      makeStudioGlossyMat(0xe2e8f0, { metalness: 0.88, roughness: 0.14 })
    );
    chestDisc.rotation.x = Math.PI / 2;
    chestDisc.position.set(0.09 * scaleFactor, 0.41 * scaleFactor, 0.155 * scaleFactor);
    bodyPivot.add(stethTube, chestDisc);
  }

  if (presetKind === 'prince') {
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
      goldMat
    );
    sash.scale.set(1, 1, 0.65);
    bodyPivot.add(sash);
  }

  // Flowing Cape (Superhero, Royal Velvet Mantle with Ermine Collar & Gold Brooch)
  if (accessories.has('cape')) {
    const isRoyalCape =
      presetKind === 'king' ||
      presetKind === 'queen' ||
      presetKind === 'prince' ||
      presetKind === 'princess' ||
      headwear === 'crown' ||
      headwear === 'tiara';
    const capeColor =
      outfitStyle === 'superhero'
        ? '#ef4444'
        : presetKind === 'witch'
          ? '#1e1b4b'
          : isRoyalCape
            ? '#991b1b'
            : accentColor || '#7c3aed';
    const capeMat = makeStudioStandardMat(capeColor, {
      map: fabricTex,
      roughness: 0.52,
      side: THREE.DoubleSide,
    });
    const cape = new THREE.Mesh(
      makeDrapedCapeGeo(0.56 * scaleFactor, 0.84 * scaleFactor),
      capeMat
    );
    cape.position.set(0, 0.58 * scaleFactor, -0.14 * scaleFactor);
    bodyPivot.add(cape);

    if (isRoyalCape) {
      for (let i = -3; i <= 3; i++) {
        const furPuff = new THREE.Mesh(
          new THREE.SphereGeometry(0.056 * scaleFactor, 18, 14),
          whiteMat
        );
        furPuff.position.set(
          i * 0.055 * scaleFactor,
          0.58 * scaleFactor,
          -0.06 * scaleFactor - (3 - Math.abs(i)) * 0.025
        );
        bodyPivot.add(furPuff);
      }
      const clasp = new THREE.Mesh(
        new THREE.SphereGeometry(0.044 * scaleFactor, 16, 12),
        goldMat
      );
      clasp.scale.set(1.1, 1.1, 0.55);
      clasp.position.set(0, 0.55 * scaleFactor, 0.145 * scaleFactor);
      bodyPivot.add(clasp);
    }
  }

  // Adventure Backpack with curved Tube straps & buckles
  if (accessories.has('backpack')) {
    const packColor = isFemale ? 0x7c3aed : 0xea580c;
    const strapColor = isFemale ? 0x5b21b6 : 0xf59e0b;
    const packMat = makeStudioStandardMat(packColor, {
      map: fabricTex,
      roughness: 0.48,
    });
    const strapMat = makeStudioStandardMat(strapColor, { roughness: 0.46 });
    const buckleMat = makeStudioGlossyMat(0xe2e8f0, {
      metalness: 0.78,
      roughness: 0.2,
    });

    const packBody = new THREE.Mesh(
      makeOrganicPouchGeo(
        0.36 * scaleFactor,
        0.42 * scaleFactor,
        0.2 * scaleFactor,
        32
      ),
      packMat
    );
    packBody.position.set(0, 0.35 * scaleFactor, -0.2 * scaleFactor);

    const packPocket = new THREE.Mesh(
      makeOrganicPouchGeo(
        0.26 * scaleFactor,
        0.18 * scaleFactor,
        0.09 * scaleFactor,
        24
      ),
      strapMat
    );
    packPocket.position.set(0, 0.24 * scaleFactor, -0.29 * scaleFactor);
    bodyPivot.add(packBody, packPocket);

    [-1, 1].forEach((s) => {
      const strapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(
          s * 0.135 * scaleFactor,
          0.22 * scaleFactor,
          0.135 * scaleFactor
        ),
        new THREE.Vector3(
          s * 0.145 * scaleFactor,
          0.42 * scaleFactor,
          0.145 * scaleFactor
        ),
        new THREE.Vector3(
          s * 0.135 * scaleFactor,
          0.575 * scaleFactor,
          0.04 * scaleFactor
        ),
        new THREE.Vector3(
          s * 0.125 * scaleFactor,
          0.52 * scaleFactor,
          -0.14 * scaleFactor
        ),
      ]);
      const strap = new THREE.Mesh(
        new THREE.TubeGeometry(strapCurve, 18, 0.022 * scaleFactor, 12, false),
        strapMat
      );
      const buckle = new THREE.Mesh(
        new THREE.TorusGeometry(0.028 * scaleFactor, 0.008 * scaleFactor, 10, 20),
        buckleMat
      );
      buckle.position.set(
        s * 0.14 * scaleFactor,
        0.34 * scaleFactor,
        0.145 * scaleFactor
      );
      bodyPivot.add(strap, buckle);
    });
  }

  // Wings (Fairy, Angel, Dragon)
  let leftWingPivot: THREE.Group | undefined;
  let rightWingPivot: THREE.Group | undefined;
  if (
    accessories.has('fairyWings') ||
    accessories.has('angelWings') ||
    accessories.has('wings') ||
    accessories.has('dragonWings')
  ) {
    const wingKind: 'fairy' | 'angel' | 'dragon' = accessories.has('fairyWings')
      ? 'fairy'
      : accessories.has('dragonWings')
        ? 'dragon'
        : 'angel';
    const isFairy = wingKind === 'fairy';
    const wingMat = makeStudioGlossyMat(
      isFairy ? 0xa5f3fc : wingKind === 'dragon' ? accentColor : 0xffffff,
      {
        emissive: isFairy ? 0x38bdf8 : 0x64748b,
        emissiveIntensity: isFairy ? 0.45 : 0.18,
        transparent: isFairy,
        opacity: isFairy ? 0.8 : 1,
        iridescence: isFairy ? 0.92 : 0.2,
        roughness: 0.16,
        clearcoat: 0.8,
        side: THREE.DoubleSide,
      }
    );
    const wingGeo = makeSculptedWingGeo(wingKind, scaleFactor);
    const makeWing = (side: -1 | 1) => {
      const wp = new THREE.Group();
      wp.position.set(
        side * 0.08 * scaleFactor,
        0.44 * scaleFactor,
        -0.14 * scaleFactor
      );
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

  // Optional Animal/Devil Tail for hybrid custom humanoids
  let tailPivot: THREE.Group | undefined;
  if (accessories.has('tail')) {
    tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.12 * scaleFactor, -0.14 * scaleFactor);
    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.04 * scaleFactor, -0.16 * scaleFactor),
      new THREE.Vector3(0.06 * scaleFactor, 0.18 * scaleFactor, -0.28 * scaleFactor),
    ]);
    const tailMesh = new THREE.Mesh(
      new THREE.TubeGeometry(tCurve, 14, 0.036 * scaleFactor, 12, false),
      shirtMat
    );
    tailPivot.add(tailMesh);
    bodyPivot.add(tailPivot);
  }

  // Sculpted Chibi-Pixar Head Pivot (no distortion outlines!)
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.085 * scaleFactor + torsoH;
  bodyPivot.add(headPivot);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.072 * scaleFactor,
      0.094 * scaleFactor,
      0.11 * scaleFactor,
      32
    ),
    skinMat
  );
  neck.position.y = 0.045 * scaleFactor;
  headPivot.add(neck);

  const earInnerMat = makeStudioStandardMat(
    new THREE.Color(skinColor).lerp(new THREE.Color(0xfb7185), 0.34),
    { roughness: 0.48 }
  );
  const blushMat = makeStudioStandardMat(
    new THREE.Color(skinColor).lerp(new THREE.Color(0xf43f5e), 0.42),
    { roughness: 0.52, metalness: 0.01 }
  );

  // Expressive Chibi-Cartoon Head: clean SphereGeometry(0.55, 32, 32) with solid warm skin tone, oriented front +Z
  const isYoungKid = scaleFactor < 0.92;
  const headRadius = (isYoungKid ? 0.38 : 0.355) * scaleFactor;
  const headUnitScale = headRadius / 0.55;
  const headCenterY = 0.075 * scaleFactor + headRadius * 0.96;
  const headGeo = new THREE.SphereGeometry(0.55, 32, 32);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.scale.set(1.06 * headUnitScale, 0.98 * headUnitScale, 1.04 * headUnitScale);
  head.position.y = headCenterY;
  headPivot.add(head);

  // Sculpted 3D Ears
  [-1, 1].forEach((side) => {
    const earGroup = new THREE.Group();
    earGroup.position.set(
      side * headRadius * 1.05,
      headCenterY - 0.015 * scaleFactor,
      -0.02 * scaleFactor
    );
    earGroup.rotation.y = side * -0.24;

    const outerEar = new THREE.Mesh(
      new THREE.SphereGeometry(0.068 * scaleFactor, 24, 18),
      skinMat
    );
    outerEar.scale.set(0.62, 1.04, 0.72);

    const innerEar = new THREE.Mesh(
      new THREE.SphereGeometry(0.044 * scaleFactor, 20, 14),
      earInnerMat
    );
    innerEar.scale.set(0.55, 0.85, 0.55);
    innerEar.position.set(side * 0.008 * scaleFactor, 0, 0.014 * scaleFactor);

    earGroup.add(outerEar, innerEar);
    headPivot.add(earGroup);
  });

  // Soft Rosy 3D Cheeks flush on lower front cheeks (+Z)
  [-1, 1].forEach((side) => {
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.056 * scaleFactor, 20, 16),
      blushMat
    );
    cheek.scale.set(1.18, 0.72, 0.32);
    cheek.position.set(
      side * headRadius * 0.50,
      headCenterY - headRadius * 0.19,
      headRadius * 0.895
    );
    cheek.rotation.y = side * 0.44;
    headPivot.add(cheek);
  });

  // Cute 3D Button Nose cleanly visible on front (+Z)
  const noseBridge = new THREE.Mesh(
    new THREE.SphereGeometry(0.022 * scaleFactor, 20, 16),
    skinMat
  );
  noseBridge.scale.set(0.85, 1.25, 0.9);
  noseBridge.position.set(0, headCenterY - headRadius * 0.04, headRadius * 1.02);
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.038 * scaleFactor, 24, 18),
    earInnerMat
  );
  nose.scale.set(1.12, 0.82, 0.96);
  nose.position.set(0, headCenterY - headRadius * 0.088, headRadius * 1.065);
  headPivot.add(noseBridge, nose);

  // Large Glossy Clearcoat 3D Eyeballs (White Sclera + Colored Iris + Dark Pupil + Dual Sparkles)
  const eyeY = headCenterY + headRadius * 0.085;
  const eyeZ = headRadius * 0.955;
  const eyeX = headRadius * 0.35;
  const irisSolidMat = makeStudioGlossyMat(eyeColor, {
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
  });
  const pupilSolidMat = makeStudioGlossyMat(0x090b10, {
    roughness: 0.06,
    metalness: 0.08,
    clearcoat: 1.0,
  });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  catchMat.userData.sharedResource = true;
  const lashMat = makeStudioGlossyMat(0x1b0f0a, { roughness: 0.3, clearcoat: 0.4 });

  const makeSculptedEye = (side: -1 | 1) => {
    const eg = new THREE.Group();
    eg.position.set(side * eyeX, eyeY, eyeZ);
    eg.rotation.y = side * 0.16;

    const r = 0.072 * scaleFactor;
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 22), whiteMat);
    sclera.scale.set(0.96, 1.08, 0.56);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(r * 0.66, 24, 18), irisSolidMat);
    iris.scale.set(0.96, 1.05, 0.32);
    iris.position.set(side * -0.004 * scaleFactor, 0, r * 0.40);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.38, 20, 16), pupilSolidMat);
    pupil.scale.set(0.96, 1.04, 0.28);
    pupil.position.set(side * -0.004 * scaleFactor, 0, r * 0.52);

    const sp1 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.19, 14, 12), catchMat);
    sp1.position.set(-r * 0.22, r * 0.24, r * 0.62);
    const sp2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 12, 10), catchMat);
    sp2.position.set(r * 0.18, -r * 0.16, r * 0.61);

    const upperLidHood = new THREE.Mesh(
      new THREE.TorusGeometry(
        r * 1.02,
        0.015 * scaleFactor,
        12,
        28,
        Math.PI * 0.92
      ),
      skinMat
    );
    upperLidHood.rotation.z = Math.PI * 0.04;
    upperLidHood.rotation.x = 0.22;
    upperLidHood.position.set(0, r * 0.12, r * 0.26);

    const lashArc = new THREE.Mesh(
      new THREE.TorusGeometry(
        r * 1.0,
        (isFemale ? 0.013 : 0.009) * scaleFactor,
        12,
        28,
        Math.PI * 0.88
      ),
      lashMat
    );
    lashArc.rotation.z = Math.PI * 0.06;
    lashArc.position.set(0, r * 0.07, r * 0.34);

    eg.add(sclera, iris, pupil, sp1, sp2, upperLidHood, lashArc);

    if (isFemale) {
      const lashWing = new THREE.Mesh(
        new THREE.ConeGeometry(0.01 * scaleFactor, 0.034 * scaleFactor, 12),
        lashMat
      );
      lashWing.position.set(side * r * 0.98, r * 0.36, r * 0.28);
      lashWing.rotation.z = side * -1.05;
      eg.add(lashWing);
    }

    headPivot.add(eg);
    return sclera;
  };

  const leftEye = makeSculptedEye(-1);
  const rightEye = makeSculptedEye(1);

  // Curved Dark 3D Eyebrows cleanly above the eyes
  const browGeo = new THREE.TorusGeometry(
    0.06 * scaleFactor,
    0.015 * scaleFactor,
    12,
    24,
    Math.PI * 0.68
  );
  browGeo.rotateZ(Math.PI * 0.16);
  const browMat = makeStudioStandardMat(
    presetKind === 'grandpa' || presetKind === 'grandma' || presetKind === 'wizard'
      ? hairColor
      : 0x2a1810,
    { roughness: 0.42 }
  );
  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.position.set(-eyeX, eyeY + 0.078 * scaleFactor, eyeZ + 0.02 * scaleFactor);
  leftBrow.rotation.y = -0.14;
  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.position.set(eyeX, eyeY + 0.078 * scaleFactor, eyeZ + 0.02 * scaleFactor);
  rightBrow.rotation.y = 0.14;
  headPivot.add(leftBrow, rightBrow);

  // Smiling Coral/Red 3D Mouth + Animated Mouth Cavity on Front (+Z)
  const lipColor = isFemale ? 0xf43f5e : 0xe11d48;
  const lipMat = makeStudioGlossyMat(lipColor, {
    roughness: 0.3,
    clearcoat: 0.42,
  });
  const smileArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.062 * scaleFactor, 0.013 * scaleFactor, 14, 28, Math.PI * 0.78),
    lipMat
  );
  smileArc.rotation.z = Math.PI + Math.PI * 0.11;
  smileArc.position.set(0, headCenterY - headRadius * 0.27, headRadius * 0.995);
  headPivot.add(smileArc);

  const mouthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.052 * scaleFactor, 22, 16),
    mouthMat
  );
  mouthMesh.scale.set(1.12, 0.38, 0.48);
  mouthMesh.position.set(0, headCenterY - headRadius * 0.33, headRadius * 0.995);

  const upperTeeth = new THREE.Mesh(
    new THREE.TorusGeometry(
      0.038 * scaleFactor,
      0.008 * scaleFactor,
      10,
      20,
      Math.PI * 0.85
    ),
    whiteMat
  );
  upperTeeth.rotation.z = Math.PI * 0.075;
  upperTeeth.position.set(0, 0.006 * scaleFactor, 0.016 * scaleFactor);
  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.028 * scaleFactor, 18, 14),
    makeStudioStandardMat(0xfb7185, { roughness: 0.34 })
  );
  tongue.scale.set(1.1, 0.45, 0.72);
  tongue.position.set(0, -0.008 * scaleFactor, 0.014 * scaleFactor);
  mouthMesh.add(upperTeeth, tongue);
  headPivot.add(mouthMesh);

  // Volumetric 3D Hair cleanly positioned on top/back (y > 0.2 * headRadius) so it NEVER covers eyes or face
  if (hairStyle !== 'bald') {
    const hairTop = new THREE.Mesh(
      new THREE.SphereGeometry(
        headRadius * 1.07,
        36,
        24,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.48
      ),
      hairMat
    );
    hairTop.scale.set(1.07, 0.99, 1.05);
    hairTop.position.set(0, headCenterY + 0.025 * scaleFactor, -0.015 * scaleFactor);
    hairTop.rotation.x = -0.16;
    headPivot.add(hairTop);

    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(
        headRadius * 1.06,
        36,
        24,
        Math.PI * 0.72,
        Math.PI * 1.56,
        Math.PI * 0.18,
        Math.PI * 0.56
      ),
      hairMat
    );
    hairBack.scale.set(1.07, 0.98, 1.05);
    hairBack.position.y = headCenterY;
    headPivot.add(hairBack);

    if (
      !['strawHat', 'policeCap', 'chefHat', 'witchHat', 'wizardHat', 'helmet'].includes(
        headwear
      )
    ) {
      const bangCount = hairStyle === 'spiky' ? 6 : isFemale ? 4 : 5;
      for (let i = 0; i < bangCount; i++) {
        const frac = (i / (bangCount - 1)) * 2 - 1;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(
            frac * 0.06 * scaleFactor,
            0.06 * scaleFactor,
            -0.06 * scaleFactor
          ),
          new THREE.Vector3(
            frac * 0.11 * scaleFactor,
            0.03 * scaleFactor,
            0.03 * scaleFactor
          ),
          new THREE.Vector3(
            frac * 0.16 * scaleFactor,
            (hairStyle === 'spiky' ? 0.04 : -0.015) * scaleFactor,
            0.075 * scaleFactor
          ),
        ]);
        const bangGeo = new THREE.TubeGeometry(
          curve,
          12,
          (0.038 - Math.abs(frac) * 0.006) * scaleFactor,
          12,
          false
        );
        const bang = new THREE.Mesh(bangGeo, hairMat);
        bang.position.set(
          frac * 0.075 * scaleFactor,
          headCenterY + headRadius * 0.56,
          headRadius * 0.76 - Math.abs(frac) * 0.05 * scaleFactor
        );
        bang.rotation.x = 0.08;
        headPivot.add(bang);
      }
    }

    [-1, 1].forEach((side) => {
      const sideCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.04 * scaleFactor, 0),
        new THREE.Vector3(
          side * 0.025 * scaleFactor,
          -0.06 * scaleFactor,
          -0.01 * scaleFactor
        ),
        new THREE.Vector3(
          side * 0.01 * scaleFactor,
          -0.14 * scaleFactor,
          0.0 * scaleFactor
        ),
      ]);
      const sideLock = new THREE.Mesh(
        new THREE.TubeGeometry(sideCurve, 12, 0.034 * scaleFactor, 12, false),
        hairMat
      );
      sideLock.position.set(
        side * headRadius * 0.99,
        headCenterY + 0.05 * scaleFactor,
        -0.01 * scaleFactor
      );
      headPivot.add(sideLock);
    });
  }

  let ponytailPivot: THREE.Group | undefined;
  if (hairStyle === 'ponytail') {
    ponytailPivot = new THREE.Group();
    ponytailPivot.position.set(
      headRadius * 0.72,
      headCenterY + 0.06 * scaleFactor,
      -headRadius * 0.74
    );
    const tie = new THREE.Mesh(
      new THREE.TorusGeometry(0.056 * scaleFactor, 0.022, 14, 32),
      shirtMat
    );
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
    const tailTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.075 * scaleFactor, 0.16 * scaleFactor, 24),
      hairMat
    );
    tailTip.position.set(
      0.16 * scaleFactor,
      -0.46 * scaleFactor,
      -0.08 * scaleFactor
    );
    tailTip.rotation.z = Math.PI + 0.18;
    ponytailPivot.add(tie, ponyMesh, tailTip);
    headPivot.add(ponytailPivot);
    accentMeshes.push(tie);

    if (presetKind === 'daughter') {
      [-1, 1].forEach((side) => {
        for (let b = 0; b < 4; b++) {
          const bead = new THREE.Mesh(
            new THREE.SphereGeometry(
              (0.055 - b * 0.007) * scaleFactor,
              24,
              18
            ),
            hairMat
          );
          bead.position.set(
            side * (headRadius * 0.94 + b * 0.015 * scaleFactor),
            headCenterY - (0.04 + b * 0.075) * scaleFactor,
            -0.06 * scaleFactor
          );
          headPivot.add(bead);
        }
      });
    }
  } else if (hairStyle === 'bun') {
    const backBun = new THREE.Mesh(
      new THREE.SphereGeometry(0.15 * scaleFactor, 32, 24),
      hairMat
    );
    backBun.position.set(0, headCenterY + 0.05 * scaleFactor, -headRadius * 0.96);
    const bunPin = new THREE.Mesh(
      new THREE.TorusGeometry(0.11 * scaleFactor, 0.014 * scaleFactor, 12, 28),
      shirtMat
    );
    bunPin.position.set(0, headCenterY + 0.05 * scaleFactor, -headRadius * 0.86);
    headPivot.add(backBun, bunPin);
  } else if (hairStyle === 'curly') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.115 * scaleFactor, 20, 16),
        hairMat
      );
      puff.position.set(
        Math.cos(a) * headRadius * 0.92,
        headCenterY + (0.14 + Math.sin(i * 1.9) * 0.08) * scaleFactor,
        Math.sin(a) * headRadius * 0.88 - 0.04 * scaleFactor
      );
      headPivot.add(puff);
    }
  } else if (hairStyle === 'long' || hairStyle === 'bob') {
    const lenDrops = hairStyle === 'long' ? 4 : 2;
    [-1, 1].forEach((side) => {
      for (let k = 0; k < lenDrops; k++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry((0.12 - k * 0.012) * scaleFactor, 22, 16),
          hairMat
        );
        puff.position.set(
          side * headRadius * 0.78,
          headCenterY - (0.04 + k * 0.11) * scaleFactor,
          -headRadius * 0.58
        );
        headPivot.add(puff);
      }
    });
  } else if (hairStyle === 'spiky') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.085 * scaleFactor, 0.22 * scaleFactor, 18),
        hairMat
      );
      spike.position.set(
        Math.cos(a) * headRadius * 0.45,
        headCenterY + headRadius * 1.02,
        Math.sin(a) * headRadius * 0.45
      );
      spike.rotation.z = -Math.cos(a) * 0.45;
      spike.rotation.x = Math.sin(a) * 0.45;
      headPivot.add(spike);
    }
  }

  // Headwear (Two-Tone Cap, Crown, Tiara, Hats, Helmet, Halo, Beanie)
  if (headwear === 'cap') {
    const redCapMat = makeStudioStandardMat(0xdc2626, { map: fabricTex, roughness: 0.4 });
    const capBack = new THREE.Mesh(
      new THREE.SphereGeometry(
        headRadius * 1.11,
        36,
        24,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.43
      ),
      shirtMat
    );
    capBack.scale.set(1.09, 0.98, 1.05);
    capBack.position.set(0, headCenterY + 0.055 * scaleFactor, -0.018 * scaleFactor);
    capBack.rotation.x = -0.16;

    const capWhiteFront = new THREE.Mesh(
      new THREE.SphereGeometry(
        headRadius * 1.116,
        32,
        22,
        -0.7,
        1.4,
        0.08,
        Math.PI * 0.36
      ),
      whiteMat
    );
    capWhiteFront.scale.set(1.05, 0.98, 1.09);
    capWhiteFront.position.set(0, headCenterY + 0.055 * scaleFactor, -0.006 * scaleFactor);
    capWhiteFront.rotation.y = Math.PI / 2;
    capWhiteFront.rotation.z = 0.16;

    const capBrim = new THREE.Mesh(
      makeCurvedCapVisorGeo(
        0.54 * scaleFactor,
        0.27 * scaleFactor,
        0.022 * scaleFactor
      ),
      redCapMat
    );
    capBrim.position.set(0, headCenterY + headRadius * 0.48, headRadius * 0.72);
    capBrim.rotation.x = -0.05;

    const capButton = new THREE.Mesh(
      new THREE.SphereGeometry(0.032 * scaleFactor, 20, 14),
      redCapMat
    );
    capButton.position.set(0, headCenterY + headRadius * 1.1, -0.02 * scaleFactor);

    headPivot.add(capBack, capWhiteFront, capBrim, capButton);
    accentMeshes.push(capBack);
  } else if (headwear === 'beanie') {
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(
        headRadius * 1.1,
        36,
        26,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.46
      ),
      shirtMat
    );
    beanie.scale.set(1.09, 0.98, 1.05);
    beanie.position.set(0, headCenterY + 0.048 * scaleFactor, -0.02);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(headRadius * 1.11, 0.024, 14, 36, Math.PI),
      darkMat
    );
    band.position.y = headCenterY + 0.035 * scaleFactor;
    headPivot.add(beanie, band);
    accentMeshes.push(beanie);
  } else if (headwear === 'strawHat') {
    const strawMat = makeStudioStandardMat(0xfde047, { map: fabricTex, roughness: 0.55 });
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
    const hatBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.285 * scaleFactor, 0.022 * scaleFactor, 12, 36),
      makeStudioStandardMat(0xdc2626)
    );
    hatBand.rotation.x = Math.PI / 2;
    hatBand.position.y = headCenterY + 0.2 * scaleFactor;
    headPivot.add(strawHat, hatBand);
  } else if (headwear === 'policeCap') {
    const capTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3 * scaleFactor, 0.26 * scaleFactor, 0.14, 36),
      pantsMat
    );
    capTop.position.y = headCenterY + 0.23 * scaleFactor;
    const visor = new THREE.Mesh(
      makeCurvedCapVisorGeo(
        0.54 * scaleFactor,
        0.25 * scaleFactor,
        0.02 * scaleFactor
      ),
      darkMat
    );
    visor.position.set(0, headCenterY + 0.17 * scaleFactor, headRadius * 0.65);
    const goldBadge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.042 * scaleFactor, 1),
      goldMat
    );
    goldBadge.position.set(0, headCenterY + 0.24 * scaleFactor, 0.28 * scaleFactor);
    headPivot.add(capTop, visor, goldBadge);
  } else if (headwear === 'chefHat') {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.265 * scaleFactor, 0.255 * scaleFactor, 0.14, 36),
      whiteMat
    );
    band.position.y = headCenterY + 0.22 * scaleFactor;
    const puffCenter = new THREE.Mesh(
      new THREE.SphereGeometry(0.25 * scaleFactor, 32, 24),
      whiteMat
    );
    puffCenter.scale.set(1.06, 0.88, 1.06);
    puffCenter.position.y = headCenterY + 0.4 * scaleFactor;
    headPivot.add(band, puffCenter);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.145 * scaleFactor, 22, 18),
        whiteMat
      );
      lobe.position.set(
        Math.cos(a) * 0.15 * scaleFactor,
        headCenterY + 0.37 * scaleFactor,
        Math.sin(a) * 0.15 * scaleFactor
      );
      headPivot.add(lobe);
    }
  } else if (headwear === 'crown' || headwear === 'tiara') {
    const crown = createCrownMesh(headwear === 'tiara');
    crown.position.y = headCenterY + headRadius * 0.9;
    headPivot.add(crown);
  } else if (headwear === 'halo') {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.2 * scaleFactor, 0.025, 16, 36),
      makeStudioGlossyMat(0xfef08a, {
        emissive: 0xfacc15,
        emissiveIntensity: 0.9,
      })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = headCenterY + headRadius * 1.24;
    headPivot.add(halo);
  } else if (headwear === 'wreath') {
    const wreath = new THREE.Mesh(
      new THREE.TorusGeometry(0.26 * scaleFactor, 0.028, 16, 36),
      makeStudioGlossyMat(0xf472b6, {
        emissive: 0xec4899,
        emissiveIntensity: 0.35,
      })
    );
    wreath.rotation.x = Math.PI / 2.3;
    wreath.position.y = headCenterY + headRadius * 0.68;
    headPivot.add(wreath);
  } else if (headwear === 'witchHat' || headwear === 'wizardHat') {
    const hatMat =
      headwear === 'witchHat'
        ? makeStudioStandardMat(0x1e1b4b, { map: fabricTex })
        : shirtMat;
    const brimPts = [
      new THREE.Vector2(0.49 * scaleFactor, -0.02 * scaleFactor),
      new THREE.Vector2(0.36 * scaleFactor, 0.02 * scaleFactor),
      new THREE.Vector2(0.24 * scaleFactor, 0.03 * scaleFactor),
      new THREE.Vector2(0, 0.03 * scaleFactor),
    ];
    const brim = new THREE.Mesh(new THREE.LatheGeometry(brimPts, 36), hatMat);
    brim.position.y = headCenterY + 0.185 * scaleFactor;

    const hatCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.19 * scaleFactor, 0),
      new THREE.Vector3(0.02 * scaleFactor, 0.36 * scaleFactor, -0.02 * scaleFactor),
      new THREE.Vector3(-0.08 * scaleFactor, 0.54 * scaleFactor, -0.06 * scaleFactor),
      new THREE.Vector3(-0.18 * scaleFactor, 0.66 * scaleFactor, -0.1 * scaleFactor),
    ]);
    const coneGeo = new THREE.TubeGeometry(hatCurve, 18, 0.16 * scaleFactor, 24, false);
    const cPos = coneGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const py = cPos.getY(i);
      const t = Math.max(
        0,
        Math.min(1, (py - 0.19 * scaleFactor) / (0.48 * scaleFactor))
      );
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

    const buckleBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.245 * scaleFactor, 0.026 * scaleFactor, 12, 34),
      goldMat
    );
    buckleBand.rotation.x = Math.PI / 2;
    buckleBand.position.y = headCenterY + 0.22 * scaleFactor;
    headPivot.add(brim, cone, buckleBand);
    if (headwear === 'wizardHat') accentMeshes.push(brim, cone);
  } else if (headwear === 'helmet') {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.18, 36, 28),
      makeStudioGlossyMat(primaryColor, { roughness: 0.16, clearcoat: 1.0 })
    );
    helmet.position.y = headCenterY + 0.03 * scaleFactor;
    const visorDome = new THREE.Mesh(
      new THREE.SphereGeometry(
        headRadius * 1.14,
        32,
        24,
        -0.9,
        1.8,
        Math.PI * 0.2,
        Math.PI * 0.45
      ),
      makeStudioGlossyMat(0x7dd3fc, {
        transparent: true,
        opacity: 0.42,
        clearcoat: 1.0,
      })
    );
    visorDome.position.set(0, headCenterY + 0.02 * scaleFactor, 0.04 * scaleFactor);
    visorDome.rotation.y = Math.PI / 2;
    headPivot.add(helmet, visorDome);
    accentMeshes.push(helmet);
  }

  // Facial Accessories
  if (accessories.has('glasses')) {
    const frameMat = makeStudioGlossyMat(
      presetKind === 'grandma' ? 0x94a3b8 : 0x1e293b,
      { metalness: 0.78, roughness: 0.2 }
    );
    const lensGeo = new THREE.TorusGeometry(0.074 * scaleFactor, 0.01, 14, 32);
    const lL = new THREE.Mesh(lensGeo, frameMat);
    lL.position.set(-eyeX, eyeY, eyeZ + 0.065 * scaleFactor);
    const lR = lL.clone();
    lR.position.x = eyeX;
    const bridge = new THREE.Mesh(
      new THREE.TorusGeometry(0.038 * scaleFactor, 0.008 * scaleFactor, 10, 20, Math.PI),
      frameMat
    );
    bridge.position.set(0, eyeY + 0.01, eyeZ + 0.065 * scaleFactor);
    headPivot.add(lL, lR, bridge);
  }

  if (accessories.has('moustache')) {
    const stache = new THREE.Mesh(
      new THREE.TorusGeometry(0.058 * scaleFactor, 0.018 * scaleFactor, 12, 24, Math.PI),
      hairMat
    );
    stache.scale.set(1.25, 0.72, 0.85);
    stache.position.set(0, headCenterY - headRadius * 0.24, headRadius * 1.0);
    headPivot.add(stache);
  }

  if (accessories.has('beard')) {
    const beard = new THREE.Mesh(
      new THREE.ConeGeometry(0.19 * scaleFactor, 0.34 * scaleFactor, 28),
      presetKind === 'king'
        ? makeStudioStandardMat(0xe2e8f0)
        : hairMat
    );
    beard.rotation.x = Math.PI;
    beard.position.set(0, headCenterY - 0.19 * scaleFactor, headRadius * 0.8);
    headPivot.add(beard);
  }

  if (accessories.has('mask')) {
    const mask = new THREE.Mesh(
      makeOrganicPouchGeo(
        0.37 * scaleFactor,
        0.095 * scaleFactor,
        0.06 * scaleFactor,
        28
      ),
      darkMat
    );
    mask.position.set(0, eyeY, eyeZ + 0.045 * scaleFactor);
    headPivot.add(mask);
  }

  if (accessories.has('horns')) {
    const hornMat = makeStudioGlossyMat(accentColor, { roughness: 0.25 });
    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.055 * scaleFactor, 0.2 * scaleFactor, 20),
        hornMat
      );
      horn.position.set(
        side * headRadius * 0.62,
        headCenterY + headRadius * 0.88,
        0.04 * scaleFactor
      );
      horn.rotation.z = side * -0.4;
      horn.rotation.x = 0.22;
      headPivot.add(horn);
    });
  }

  if (accessories.has('catEars') || accessories.has('bunnyEars')) {
    const isBunny = accessories.has('bunnyEars');
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(
        isBunny
          ? new THREE.CapsuleGeometry(0.055 * scaleFactor, 0.22 * scaleFactor, 10, 18)
          : new THREE.ConeGeometry(0.08 * scaleFactor, 0.16 * scaleFactor, 18),
        hairMat
      );
      ear.position.set(
        side * headRadius * 0.62,
        headCenterY + headRadius * (isBunny ? 1.15 : 0.92),
        0
      );
      ear.rotation.z = side * -0.25;
      headPivot.add(ear);
    });
  }

  if (presetKind === 'doctor') {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(headRadius * 1.07, 0.016, 14, 36),
      darkMat
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = headCenterY + 0.14 * scaleFactor;
    const mirror = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075 * scaleFactor, 0.075 * scaleFactor, 0.025, 32),
      makeStudioGlossyMat(0xe2e8f0, { metalness: 0.9, roughness: 0.1 })
    );
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(0, headCenterY + 0.15 * scaleFactor, headRadius * 1.07);
    headPivot.add(band, mirror);
  }

  // Arms & Rounded Hands/Gloves
  const armMat = isWhiteCoat ? torsoMat : shirtMat;
  const hasGloves = accessories.has('gloves');
  const gloveMat = makeStudioStandardMat(0x1e293b, { roughness: 0.36 });
  const gloveCuffMat = goldMat;

  const createArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(
      side * 0.255 * scaleFactor,
      0.04 * scaleFactor + torsoH - 0.065,
      0
    );

    const shoulderJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.068 * scaleFactor, 24, 18),
      armMat
    );
    shoulder.add(shoulderJoint);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.056 * scaleFactor, 0.145 * scaleFactor, 12, 24),
      armMat
    );
    upperArm.position.y = -0.115 * scaleFactor;
    shoulder.add(upperArm);
    if (!isWhiteCoat) accentMeshes.push(shoulderJoint, upperArm);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.y = -0.23 * scaleFactor;
    shoulder.add(forearmPivot);

    const forearmMat = isWhiteCoat ? armMat : skinMat;
    const elbowJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.052 * scaleFactor, 24, 18),
      forearmMat
    );
    forearmPivot.add(elbowJoint);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.046 * scaleFactor, 0.13 * scaleFactor, 12, 24),
      forearmMat
    );
    forearm.position.y = -0.105 * scaleFactor;
    forearmPivot.add(forearm);

    if (accessories.has('watch') && side === -1) {
      const watchStrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.048 * scaleFactor, 0.011 * scaleFactor, 10, 24),
        darkMat
      );
      watchStrap.rotation.x = Math.PI / 2;
      watchStrap.position.y = -0.175 * scaleFactor;
      const watchFace = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022 * scaleFactor, 0.022 * scaleFactor, 0.012, 20),
        makeStudioGlossyMat(0xe2e8f0, { metalness: 0.85, roughness: 0.15 })
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
      gloveCuffMat
    );
    hand.position.y = -0.225 * scaleFactor;
    forearmPivot.add(hand);

    const handMount = new THREE.Group();
    handMount.position.set(0, -0.235 * scaleFactor, 0.048 * scaleFactor);
    forearmPivot.add(handMount);

    // Relaxed natural arms at sides (±0.18 rad, zero T-pose)
    shoulder.rotation.z = side * 0.18;
    forearmPivot.rotation.x = -0.14;
    bodyPivot.add(shoulder);
    return { shoulder, forearmPivot, handMount };
  };

  const leftArm = createArm(-1);
  const rightArm = createArm(1);

  // Legs & Chunky 3D Sneakers with White Soles
  const hasCargoPockets = accessories.has('cargoPockets');
  const shoeSoleMat = makeStudioStandardMat(0xf8fafc, { roughness: 0.34 });
  const thighLen = (legLen - 0.1 * scaleFactor) * 0.52;
  const shinLen = (legLen - 0.1 * scaleFactor) * 0.48;

  const createLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115 * scaleFactor, 0, 0);

    const hipJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.086 * scaleFactor, 24, 18),
      pantsMat
    );
    hip.add(hipJoint);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.08 * scaleFactor,
        Math.max(0.06, thighLen - 0.08 * scaleFactor),
        12,
        24
      ),
      pantsMat
    );
    thigh.position.y = -thighLen * 0.5;
    hip.add(thigh);

    if (hasCargoPockets) {
      const pocket = new THREE.Mesh(
        makeOrganicPouchGeo(
          0.05 * scaleFactor,
          0.11 * scaleFactor,
          0.11 * scaleFactor,
          20
        ),
        pantsMat
      );
      pocket.position.set(side * 0.078 * scaleFactor, -thighLen * 0.65, 0);
      hip.add(pocket);
    }

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -thighLen;
    hip.add(kneePivot);

    const kneeJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.072 * scaleFactor, 24, 18),
      pantsMat
    );
    kneePivot.add(kneeJoint);

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.068 * scaleFactor,
        Math.max(0.05, shinLen - 0.06 * scaleFactor),
        12,
        24
      ),
      pantsMat
    );
    shin.position.y = -shinLen * 0.5;
    kneePivot.add(shin);

    const shoe = buildCartoonSneaker(scaleFactor, shoeMat, shoeSoleMat, shirtMat);
    shoe.position.set(0, -shinLen - 0.1 * scaleFactor, 0);
    kneePivot.add(shoe);

    bodyPivot.add(hip);
    return { hip, kneePivot };
  };

  const leftLeg = createLeg(-1);
  const rightLeg = createLeg(1);

  const tallHatExtra = ['crown', 'tiara', 'witchHat', 'wizardHat', 'chefHat'].includes(
    headwear
  )
    ? 0.65
    : 0.44;
  const headHeight = baseBodyY + torsoH + headRadius * 2 + tallHatExtra;

  return {
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
    leftWingPivot,
    rightWingPivot,
    ponytailPivot,
    tailPivot,
    accentMeshes,
    baseBodyY,
    headHeight,
  };
}

// Curved ExtrudeGeometry vehicle silhouettes (ZERO BoxGeometry!)
function buildVehicleSilhouetteGeo(
  pointsXZ: Array<[number, number]>,
  width: number,
  bevel = 0.06
): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(pointsXZ[0][0], pointsXZ[0][1]);
  for (let i = 1; i < pointsXZ.length; i++) {
    s.lineTo(pointsXZ[i][0], pointsXZ[i][1]);
  }
  s.closePath();

  const innerW = Math.max(0.05, width - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: innerW,
    bevelEnabled: true,
    bevelSegments: 4,
    curveSegments: 16,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  // Side profile was drawn in (z_forward, y_up); rotateY(-PI/2) puts X_shape -> +Z, Y_shape -> +Y, depth -> X
  geo.translate(0, 0, -innerW * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function buildSculptedVehicleAssembly(
  bodyPivot: THREE.Group,
  vehicleArchetype: string,
  accentColor: string,
  secondaryColor = '#f8fafc',
  trimColor = '#facc15'
): SculptedVehicleParts {
  const wheels: THREE.Object3D[] = [];
  const rotors: THREE.Object3D[] = [];
  const propellers: THREE.Object3D[] = [];
  const lamps: THREE.Mesh[] = [];
  const accentMeshes: THREE.Mesh[] = [];
  let headHeight = 1.5;
  let ringRadius = 1.25;

  const accentMat = makeStudioGlossyMat(accentColor, {
    roughness: 0.2,
    metalness: 0.18,
    clearcoat: 0.95,
  });
  const glassMat = makeStudioGlossyMat(0xbae6fd, {
    roughness: 0.06,
    metalness: 0.2,
    clearcoat: 1.0,
  });
  const tireMat = makeStudioStandardMat(0x0f172a, { roughness: 0.78 });
  const rimMat = makeStudioGlossyMat(0xe2e8f0, {
    metalness: 0.82,
    roughness: 0.16,
    clearcoat: 0.7,
  });
  const darkMat = makeStudioStandardMat(0x334155, { metalness: 0.5, roughness: 0.34 });
  const whiteMat = makeStudioStandardMat(secondaryColor, { roughness: 0.36 });
  const lampMat = makeStudioGlossyMat(0xfef08a, {
    emissive: 0xfde047,
    emissiveIntensity: 0.65,
    clearcoat: 0.9,
  });
  const tailLampMat = makeStudioGlossyMat(0xf87171, {
    emissive: 0xef4444,
    emissiveIntensity: 0.55,
  });

  const addWheel = (x: number, y: number, z: number, r = 0.26, w = 0.16) => {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);
    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.74, r * 0.28, 16, 28),
      tireMat
    );
    tire.rotation.y = Math.PI / 2;
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.56, r * 0.56, w * 0.85, 20),
      rimMat
    );
    hub.rotation.z = Math.PI / 2;
    const centerCap = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.24, 14, 12),
      accentMat
    );
    centerCap.scale.set(0.4, 1, 1);
    wg.add(tire, hub, centerCap);
    bodyPivot.add(wg);
    wheels.push(wg);
  };

  const vKey = vehicleArchetype.toLowerCase();

  if (vKey.includes('bus') || vKey.includes('train') || vKey.includes('truck')) {
    const isBus = vKey.includes('bus');
    const isTruck = vKey.includes('truck');
    const bodyGeo = buildVehicleSilhouetteGeo(
      isTruck
        ? [
            [-1.38, 0.3],
            [1.38, 0.3],
            [1.42, 0.74],
            [0.72, 0.86],
            [0.44, 1.32],
            [-0.22, 1.32],
            [-0.28, 0.94],
            [-1.35, 0.94],
          ]
        : [
            [-1.4, 0.3],
            [1.4, 0.3],
            [1.46, 0.78],
            [1.22, 1.28],
            [-1.32, 1.28],
          ],
      1.32,
      0.08
    );
    const busBody = new THREE.Mesh(bodyGeo, accentMat);
    const stripe = new THREE.Mesh(
      makeRoundedBlockGeo(1.36, 0.12, 2.75, 0.25),
      isBus ? tireMat : makeStudioStandardMat(trimColor)
    );
    stripe.position.y = 0.64;

    const frontGlass = new THREE.Mesh(
      makeRoundedBlockGeo(1.12, 0.38, 0.18, 0.22),
      glassMat
    );
    frontGlass.position.set(0, 1.04, isTruck ? 0.66 : 1.32);
    frontGlass.rotation.x = -0.22;

    const sideGlass = new THREE.Mesh(
      makeRoundedBlockGeo(1.36, 0.34, isTruck ? 0.56 : 2.1, 0.22),
      glassMat
    );
    sideGlass.position.set(0, 1.04, isTruck ? 0.12 : -0.1);

    const roofTop = new THREE.Mesh(
      makeRoundedBlockGeo(1.14, 0.1, isTruck ? 0.62 : 2.32, 0.25),
      whiteMat
    );
    roofTop.position.set(0, 1.36, isTruck ? 0.1 : -0.05);

    const hlL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16),
      lampMat.clone()
    );
    hlL.rotation.x = Math.PI / 2;
    hlL.position.set(-0.42, 0.48, 1.46);
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
  } else if (vKey === 'bike' || vKey.includes('motor')) {
    const makeMotoWheel = (z: number) => {
      const wg = new THREE.Group();
      wg.position.set(0, 0.32, z);
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.085, 14, 24),
        tireMat
      );
      tire.rotation.y = Math.PI / 2;
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.1, 18),
        rimMat
      );
      rim.rotation.z = Math.PI / 2;
      wg.add(tire, rim);
      bodyPivot.add(wg);
      wheels.push(wg);
    };
    makeMotoWheel(0.62);
    makeMotoWheel(-0.62);
    const engine = new THREE.Mesh(
      makeRoundedBlockGeo(0.32, 0.34, 0.56, 0.22),
      darkMat
    );
    engine.position.set(0, 0.42, 0);
    const tank = new THREE.Mesh(makeOrganicPouchGeo(0.36, 0.26, 0.58, 24), accentMat);
    tank.position.set(0, 0.72, 0.18);
    const seat = new THREE.Mesh(makeOrganicPouchGeo(0.3, 0.14, 0.62, 22), tireMat);
    seat.position.set(0, 0.68, -0.32);
    const fork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.7, 14),
      rimMat
    );
    fork.position.set(0, 0.64, 0.5);
    fork.rotation.x = -0.32;
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.64, 12),
      darkMat
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.94, 0.38);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), lampMat.clone());
    hl.position.set(0, 0.78, 0.6);
    bodyPivot.add(engine, tank, seat, fork, bar, hl);
    accentMeshes.push(tank);
    lamps.push(hl);
    headHeight = 1.25;
    ringRadius = 0.95;
  } else if (vKey === 'bicycle') {
    const makeWheel = (zPos: number) => {
      const wg = new THREE.Group();
      wg.position.set(0, 0.32, zPos);
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.045, 12, 28),
        tireMat
      );
      torus.rotation.y = Math.PI / 2;
      const spoke1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.58, 8),
        darkMat
      );
      const spoke2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.58, 8),
        darkMat
      );
      spoke2.rotation.x = Math.PI / 2;
      wg.add(torus, spoke1, spoke2);
      bodyPivot.add(wg);
      wheels.push(wg);
    };
    makeWheel(0.55);
    makeWheel(-0.55);
    const bar1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.82, 12),
      accentMat
    );
    bar1.position.set(0, 0.58, 0.02);
    bar1.rotation.x = Math.PI / 2.2;
    const fork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.72, 12),
      accentMat
    );
    fork.position.set(0, 0.62, 0.45);
    fork.rotation.x = -0.25;
    const seatPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.5, 12),
      darkMat
    );
    seatPost.position.set(0, 0.6, -0.26);
    const saddle = new THREE.Mesh(makeOrganicPouchGeo(0.16, 0.07, 0.26, 18), tireMat);
    saddle.position.set(0, 0.86, -0.28);
    const handlebar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.54, 12),
      darkMat
    );
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.94, 0.36);
    bodyPivot.add(bar1, fork, seatPost, saddle, handlebar);
    accentMeshes.push(bar1, fork);
    headHeight = 1.2;
    ringRadius = 0.85;
  } else if (vKey === 'tractor') {
    const hoodGeo = buildVehicleSilhouetteGeo(
      [
        [-0.25, 0.42],
        [1.0, 0.44],
        [1.04, 0.95],
        [-0.2, 1.05],
      ],
      0.86,
      0.07
    );
    const hood = new THREE.Mesh(hoodGeo, accentMat);
    const cab = new THREE.Mesh(
      makeRoundedBlockGeo(1.06, 0.92, 0.96, 0.16),
      accentMat
    );
    cab.position.set(0, 1.18, -0.52);
    const cabGlass = new THREE.Mesh(
      makeRoundedBlockGeo(0.96, 0.54, 1.0, 0.16),
      glassMat
    );
    cabGlass.position.set(0, 1.28, -0.52);
    const exhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.62, 14),
      darkMat
    );
    exhaust.position.set(0.28, 1.24, 0.72);
    const hlL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14),
      lampMat.clone()
    );
    hlL.rotation.x = Math.PI / 2;
    hlL.position.set(-0.28, 0.75, 1.05);
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
  } else if (vKey === 'helicopter') {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.68, 28, 20), accentMat);
    pod.scale.set(0.92, 0.85, 1.45);
    pod.position.set(0, 0.75, 0.1);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.54, 24, 18), glassMat);
    cockpit.scale.set(0.95, 0.82, 1.05);
    cockpit.position.set(0, 0.82, 0.44);
    const tailBoom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.16, 1.55, 16),
      accentMat
    );
    tailBoom.rotation.x = Math.PI / 2;
    tailBoom.position.set(0, 0.82, -1.25);
    const skidL = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.035, 1.55, 8, 12),
      darkMat
    );
    skidL.rotation.x = Math.PI / 2;
    skidL.position.set(-0.44, 0.08, 0.08);
    const skidR = skidL.clone();
    skidR.position.x = 0.44;
    const strutL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.35, 10),
      darkMat
    );
    strutL.position.set(-0.4, 0.24, 0.1);
    const strutR = strutL.clone();
    strutR.position.x = 0.4;

    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(0, 1.38, 0.05);
    const blade1 = new THREE.Mesh(
      makeRoundedBlockGeo(2.8, 0.035, 0.14, 0.25),
      darkMat
    );
    const blade2 = new THREE.Mesh(
      makeRoundedBlockGeo(0.14, 0.035, 2.8, 0.25),
      darkMat
    );
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.2, 14),
      rimMat
    );
    mast.position.y = -0.06;
    rotorGroup.add(blade1, blade2, mast);
    rotors.push(rotorGroup);

    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), lampMat.clone());
    hl.position.set(0, 0.46, 0.94);
    lamps.push(hl);

    bodyPivot.add(pod, cockpit, tailBoom, skidL, skidR, strutL, strutR, rotorGroup, hl);
    accentMeshes.push(pod, tailBoom);
    headHeight = 1.65;
    ringRadius = 1.55;
  } else if (vKey === 'airplane' || vKey.includes('plane') || vKey.includes('jet')) {
    const fuselage = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 1.9, 14, 24),
      accentMat
    );
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.y = 0.72;
    const cockpit = new THREE.Mesh(
      makeOrganicPouchGeo(0.46, 0.28, 0.62, 22),
      glassMat
    );
    cockpit.position.set(0, 0.96, 0.56);
    const wingsMesh = new THREE.Mesh(
      makeRoundedBlockGeo(3.2, 0.07, 0.68, 0.25),
      accentMat
    );
    wingsMesh.position.set(0, 0.7, 0.08);
    const tailFin = new THREE.Mesh(
      makeRoundedBlockGeo(0.08, 0.62, 0.5, 0.25),
      makeStudioGlossyMat(0xef4444)
    );
    tailFin.position.set(0, 1.12, -1.05);
    const tailWing = new THREE.Mesh(
      makeRoundedBlockGeo(1.15, 0.06, 0.34, 0.25),
      accentMat
    );
    tailWing.position.set(0, 0.86, -1.05);

    const propGroup = new THREE.Group();
    propGroup.position.set(0, 0.72, 1.38);
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 16), darkMat);
    hub.rotation.x = Math.PI / 2;
    const b1 = new THREE.Mesh(
      makeRoundedBlockGeo(0.85, 0.09, 0.03, 0.25),
      darkMat
    );
    const b2 = new THREE.Mesh(
      makeRoundedBlockGeo(0.09, 0.85, 0.03, 0.25),
      darkMat
    );
    propGroup.add(hub, b1, b2);
    propellers.push(propGroup);

    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 12), lampMat.clone());
    hl.position.set(0, 0.52, 1.15);
    lamps.push(hl);

    bodyPivot.add(fuselage, cockpit, wingsMesh, tailFin, tailWing, propGroup, hl);
    accentMeshes.push(fuselage, wingsMesh, tailWing);
    addWheel(0, 0.16, 0.72, 0.16, 0.12);
    addWheel(-0.55, 0.16, -0.25, 0.16, 0.12);
    addWheel(0.55, 0.16, -0.25, 0.16, 0.12);
    headHeight = 1.5;
    ringRadius = 1.75;
  } else if (vKey === 'boat' || vKey.includes('ship')) {
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.48, 2.3, 24),
      accentMat
    );
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1.15, 1, 0.52);
    hull.position.y = 0.28;
    const deck = new THREE.Mesh(
      makeRoundedBlockGeo(1.05, 0.08, 1.7, 0.22),
      makeStudioStandardMat(0xfef3c7, { roughness: 0.6 })
    );
    deck.position.y = 0.5;
    const cabin = new THREE.Mesh(
      makeRoundedBlockGeo(0.76, 0.45, 0.8, 0.2),
      whiteMat
    );
    cabin.position.set(0, 0.74, -0.15);
    const win = new THREE.Mesh(
      makeRoundedBlockGeo(0.78, 0.22, 0.5, 0.22),
      glassMat
    );
    win.position.set(0, 0.78, -0.1);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 1.25, 12),
      darkMat
    );
    mast.position.set(0, 1.35, 0.15);
    const sail = new THREE.Mesh(
      new THREE.ConeGeometry(0.52, 0.95, 16),
      makeStudioStandardMat(0x38bdf8, { side: THREE.DoubleSide })
    );
    sail.scale.set(0.2, 1, 1);
    sail.position.set(0, 1.4, 0.25);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 12), lampMat.clone());
    hl.position.set(0, 0.98, 0.25);
    lamps.push(hl);

    bodyPivot.add(hull, deck, cabin, win, mast, sail, hl);
    accentMeshes.push(hull);
    headHeight = 1.95;
    ringRadius = 1.45;
  } else {
    // Sleek sculpted rounded cartoon Car / Police Car / Sports Car / Ice Cream Cart
    const isPolice = vKey.includes('police');
    const isCart = vKey.includes('cart');
    const chassisGeo = buildVehicleSilhouetteGeo(
      isCart
        ? [
            [-0.95, 0.26],
            [0.95, 0.26],
            [1.0, 0.88],
            [-0.95, 0.88],
          ]
        : [
            [-1.15, 0.26],
            [1.16, 0.26],
            [1.18, 0.58],
            [0.64, 0.7],
            [0.36, 1.06],
            [-0.56, 1.06],
            [-0.94, 0.72],
            [-1.16, 0.62],
          ],
      1.22,
      0.09
    );
    const bodyMesh = new THREE.Mesh(chassisGeo, accentMat);
    bodyPivot.add(bodyMesh);
    accentMeshes.push(bodyMesh);

    if (isCart) {
      const canopy = new THREE.Mesh(
        makeRoundedBlockGeo(1.3, 0.12, 1.9, 0.24),
        makeStudioGlossyMat(trimColor)
      );
      canopy.position.set(0, 1.48, 0);
      bodyPivot.add(canopy);
      [-0.5, 0.5].forEach((px) => {
        [-0.75, 0.75].forEach((pz) => {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, 0.68, 12),
            whiteMat
          );
          post.position.set(px, 1.14, pz);
          bodyPivot.add(post);
        });
      });
    } else {
      const glassCabin = new THREE.Mesh(
        buildVehicleSilhouetteGeo(
          [
            [-0.52, 0.7],
            [0.54, 0.7],
            [0.34, 1.02],
            [-0.44, 1.02],
          ],
          1.06,
          0.06
        ),
        glassMat
      );
      bodyPivot.add(glassCabin);

      if (isPolice) {
        const sirenL = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.055, 0.16, 8, 14),
          makeStudioGlossyMat(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 0.7 })
        );
        sirenL.rotation.z = Math.PI / 2;
        sirenL.position.set(-0.18, 1.16, -0.05);
        const sirenR = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.055, 0.16, 8, 14),
          makeStudioGlossyMat(0x3b82f6, { emissive: 0x2563eb, emissiveIntensity: 0.7 })
        );
        sirenR.rotation.z = Math.PI / 2;
        sirenR.position.set(0.18, 1.16, -0.05);
        bodyPivot.add(sirenL, sirenR);
        lamps.push(sirenL, sirenR);
      }
    }

    const hlL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16),
      lampMat.clone()
    );
    hlL.rotation.x = Math.PI / 2;
    hlL.position.set(-0.38, 0.46, isCart ? 0.96 : 1.15);
    const hlR = hlL.clone();
    hlR.position.x = 0.38;

    const tlL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.07, 14),
      tailLampMat
    );
    tlL.rotation.x = Math.PI / 2;
    tlL.position.set(-0.38, 0.46, isCart ? -0.96 : -1.14);
    const tlR = tlL.clone();
    tlR.position.x = 0.38;

    bodyPivot.add(hlL, hlR, tlL, tlR);
    lamps.push(hlL, hlR);

    addWheel(-0.62, 0.26, 0.68);
    addWheel(0.62, 0.26, 0.68);
    addWheel(-0.62, 0.26, -0.68);
    addWheel(0.62, 0.26, -0.68);
    headHeight = isCart ? 1.75 : 1.35;
    ringRadius = 1.35;
  }

  return {
    bodyPivot,
    wheels,
    rotors,
    propellers,
    lamps,
    accentMeshes,
    headHeight,
    ringRadius,
  };
}

function buildSculptedAnimalBlueprint(
  style: CustomModelStyleSpec,
  blueprint: CustomModelBlueprint
): SculptedCustomAssembly {
  const bodyPivot = new THREE.Group();
  const accentMeshes: THREE.Mesh[] = [];
  const wings: THREE.Object3D[] = [];
  const tails: THREE.Object3D[] = [];

  const text = `${blueprint.name} ${blueprint.prompt} ${style.archetype || ''}`.toLowerCase();
  const isDragonOrDino =
    text.includes('dragon') || text.includes('dino') || text.includes('monster');
  const isBird = text.includes('bird') || text.includes('owl') || text.includes('eagle');
  const isBunny = text.includes('rabbit') || text.includes('bunny');
  const isElephant = text.includes('elephant');
  const isLion = text.includes('lion');
  const hasWings =
    isDragonOrDino ||
    isBird ||
    Boolean(style.accessories?.some((a) => a.toLowerCase().includes('wing'))) ||
    text.includes('dragon') ||
    text.includes('pegasus');

  const bodyCol = safeHex(style.primaryColor, isDragonOrDino ? '#22c55e' : '#f59e0b');
  const bellyCol = safeHex(style.secondaryColor, '#fef08a');
  const accentCol = safeHex(style.accentColor, '#f97316');
  const eyeCol = safeHex(style.eyeColor, '#d97706');

  const bodyMat = makeStudioStandardMat(bodyCol, { roughness: 0.42 });
  const bellyMat = makeStudioStandardMat(bellyCol, { roughness: 0.48 });
  const hornMat = makeStudioGlossyMat(accentCol, { roughness: 0.24 });
  const darkMat = makeStudioStandardMat(0x1e293b, { roughness: 0.35 });
  const whiteMat = makeStudioStandardMat(0xffffff, { roughness: 0.2 });

  // Sculpted Oval Torso + Belly Patch
  const baseBodyY = 0.56;
  bodyPivot.position.y = baseBodyY;

  const torso = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 36, 28),
    bodyMat
  );
  torso.scale.set(0.92, 0.96, 1.32);
  torso.position.set(0, 0.18, 0);
  bodyPivot.add(torso);
  accentMeshes.push(torso);

  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 30, 22),
    bellyMat
  );
  belly.scale.set(0.86, 0.88, 1.15);
  belly.position.set(0, 0.14, 0.1);
  bodyPivot.add(belly);

  // Articulated Head Pivot with Sculpted Snout + Glossy 3D Eyes + Ears/Horns
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.56, 0.42);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 36, 28), bodyMat);
  head.scale.set(1.06, 0.96, 1.04);
  head.position.set(0, 0.14, 0.05);
  headPivot.add(head);
  accentMeshes.push(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.18, 28, 22), bellyMat);
  snout.scale.set(1.02, 0.72, 1.12);
  snout.position.set(0, 0.06, 0.28);
  headPivot.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 16), darkMat);
  nose.scale.set(1.2, 0.78, 0.85);
  nose.position.set(0, 0.11, 0.45);
  headPivot.add(nose);

  const jawMesh = new THREE.Mesh(
    makeOrganicPouchGeo(0.15, 0.06, 0.14, 20),
    makeStudioStandardMat(0xf43f5e)
  );
  jawMesh.position.set(0, -0.02, 0.34);
  headPivot.add(jawMesh);

  // Glossy 3D Eyes with Iris & Dual Catchlights
  const irisMat = makeStudioGlossyMat(0xffffff, {
    map: createEyeIrisTexture(eyeCol),
    roughness: 0.05,
    clearcoat: 1.0,
  });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  catchMat.userData.sharedResource = true;
  [-1, 1].forEach((side) => {
    const eg = new THREE.Group();
    eg.position.set(side * 0.145, 0.2, 0.285);
    eg.rotation.y = side * 0.22;
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.068, 28, 22), whiteMat);
    sclera.scale.set(0.95, 1.08, 0.62);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 18), irisMat);
    iris.scale.set(0.95, 1.06, 0.42);
    iris.position.z = 0.028;
    iris.rotation.y = -Math.PI / 2;
    const sp1 = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), catchMat);
    sp1.position.set(-0.018, 0.022, 0.05);
    const sp2 = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), catchMat);
    sp2.position.set(0.016, -0.016, 0.048);
    const lid = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.016, 12, 24, Math.PI * 0.9),
      bodyMat
    );
    lid.position.set(0, 0.012, 0.018);
    eg.add(sclera, iris, sp1, sp2, lid);
    headPivot.add(eg);
  });

  // Ears / Horns / Mane / Trunk
  if (isDragonOrDino) {
    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.22, 20), hornMat);
      horn.position.set(side * 0.16, 0.44, -0.04);
      horn.rotation.z = side * -0.35;
      horn.rotation.x = -0.25;
      headPivot.add(horn);
    });
    for (let s = 0; s < 4; s++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 16), hornMat);
      spike.position.set(0, 0.48 - s * 0.12, -0.15 - s * 0.2);
      spike.rotation.x = -0.5;
      bodyPivot.add(spike);
    }
  } else if (isBunny) {
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.06, 0.28, 12, 18),
        bodyMat
      );
      ear.position.set(side * 0.14, 0.5, 0);
      ear.rotation.z = side * -0.18;
      headPivot.add(ear);
    });
  } else if (isElephant) {
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.08, 0.36),
      new THREE.Vector3(0, -0.06, 0.56),
      new THREE.Vector3(0, -0.18, 0.5),
      new THREE.Vector3(0, -0.14, 0.62),
    ]);
    const trunk = new THREE.Mesh(
      new THREE.TubeGeometry(trunkCurve, 16, 0.065, 14, false),
      bodyMat
    );
    headPivot.add(trunk);
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), bodyMat);
      ear.scale.set(0.22, 1.1, 0.9);
      ear.position.set(side * 0.34, 0.16, -0.04);
      headPivot.add(ear);
    });
  } else {
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 20), bodyMat);
      ear.position.set(side * 0.22, 0.4, 0.02);
      ear.rotation.z = side * -0.35;
      headPivot.add(ear);
    });
    if (isLion) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), hornMat);
        puff.position.set(Math.cos(a) * 0.28, 0.15 + Math.sin(a) * 0.28, -0.06);
        headPivot.add(puff);
      }
    }
  }

  // Fluffy Curved Tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.18, -0.48);
  const tCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.08, -0.25),
    new THREE.Vector3(0, 0.26, -0.45),
  ]);
  const tailMesh = new THREE.Mesh(
    new THREE.TubeGeometry(tCurve, 14, 0.065, 14, false),
    bodyMat
  );
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 14), hornMat);
  tailTip.position.set(0, 0.28, -0.47);
  tailPivot.add(tailMesh, tailTip);
  bodyPivot.add(tailPivot);
  tails.push(tailPivot);

  // Optional Sculpted Wings
  if (hasWings) {
    const wingGeo = makeSculptedWingGeo(isDragonOrDino ? 'dragon' : 'angel', 1.15);
    const wingMat = makeStudioGlossyMat(accentCol, {
      roughness: 0.24,
      side: THREE.DoubleSide,
    });
    [-1, 1].forEach((side) => {
      const wp = new THREE.Group();
      wp.position.set(side * 0.24, 0.4, 0.02);
      const wm = new THREE.Mesh(wingGeo, wingMat);
      wm.scale.x = side;
      wm.rotation.y = side * -0.32;
      wp.add(wm);
      bodyPivot.add(wp);
      wings.push(wp);
    });
  }

  // 4 Tapered Pawed Limbs
  const makePawLeg = (x: number, z: number) => {
    const piv = new THREE.Group();
    piv.position.set(x, 0, z);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.32, 12, 20), bodyMat);
    leg.position.y = -0.24;
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.105, 22, 16), bellyMat);
    paw.scale.set(1, 0.65, 1.3);
    paw.position.set(0, -0.48, 0.05);
    piv.add(leg, paw);
    bodyPivot.add(piv);
    return piv;
  };

  const leftArmPivot = makePawLeg(-0.24, 0.26);
  const rightArmPivot = makePawLeg(0.24, 0.26);
  const leftLegPivot = makePawLeg(-0.24, -0.28);
  const rightLegPivot = makePawLeg(0.24, -0.28);

  return {
    entityType: 'animal',
    bodyPivot,
    headPivot,
    jawMesh,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    wheels: [],
    rotors: [],
    propellers: [],
    lamps: [],
    wings,
    tails,
    accentMeshes,
    headHeight: 1.55,
    baseBodyY,
    ringRadius: 0.95,
  };
}

function buildSculptedCustomPropGeometry(part: CustomModelPart): THREE.BufferGeometry {
  const [sx, sy, sz] = part.scale.map((v) =>
    Math.max(0.03, Math.min(4, Number(v) || 0.3))
  );
  switch (part.geometry) {
    case 'sphere': {
      const g = new THREE.SphereGeometry(0.5, 32, 24);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'cylinder': {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'cone': {
      const g = new THREE.ConeGeometry(0.5, 1, 28);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'torus': {
      const g = new THREE.TorusGeometry(0.38, 0.12, 14, 28);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'box':
    default:
      // Rounded beveled cushion block (never raw blocky edges)
      return makeRoundedBlockGeo(sx, sy, sz, 0.22);
  }
}

function buildSculptedPropBlueprint(
  blueprint: CustomModelBlueprint
): SculptedCustomAssembly {
  const bodyPivot = new THREE.Group();
  const headPivot = new THREE.Group();
  const leftArmPivot = new THREE.Group();
  const rightArmPivot = new THREE.Group();
  const leftLegPivot = new THREE.Group();
  const rightLegPivot = new THREE.Group();

  const findCentroid = (roles: string[], fallback: [number, number, number]) => {
    const matching = blueprint.parts.filter((p) => roles.includes(p.role));
    if (matching.length === 0) return fallback;
    const sum = matching.reduce(
      (acc, p) => [
        acc[0] + p.position[0],
        acc[1] + p.position[1],
        acc[2] + p.position[2],
      ],
      [0, 0, 0]
    );
    return [
      sum[0] / matching.length,
      sum[1] / matching.length,
      sum[2] / matching.length,
    ] as [number, number, number];
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
  let maxTopY = 1.4;

  blueprint.parts.forEach((part, idx) => {
    const geo = buildSculptedCustomPropGeometry(part);
    const col = safeHex(part.color, '#3B82F6');
    const isShiny = (part.metalness ?? 0) > 0.35 || (part.roughness ?? 0.5) < 0.25;
    const mat = isShiny
      ? makeStudioGlossyMat(col, {
          roughness: THREE.MathUtils.clamp(part.roughness ?? 0.2, 0.08, 0.6),
          metalness: THREE.MathUtils.clamp(part.metalness ?? 0.35, 0, 0.95),
        })
      : makeStudioStandardMat(col, {
          roughness: THREE.MathUtils.clamp(part.roughness ?? 0.42, 0.15, 0.9),
          metalness: THREE.MathUtils.clamp(part.metalness ?? 0.05, 0, 0.85),
        });
    const mesh = new THREE.Mesh(geo, mat);
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

  return {
    entityType: 'prop',
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
    accentMeshes,
    headHeight: Math.max(1.2, maxTopY + 0.15),
    baseBodyY: 0,
    ringRadius: 0.78,
  };
}

function enforceHumanoidRoleDefaults(
  base: CustomModelStyleSpec,
  text: string
): CustomModelStyleSpec {
  const hasVehicleWord =
    /\b(car|bus|truck|cart|train|taxi|van|tractor|helicopter|chopper|plane|airplane|jet|boat|ship|rocket|spaceship|motorcycle|bicycle)\b/.test(
      text
    );
  const acc = new Set<string>(Array.isArray(base.accessories) ? base.accessories : []);
  let headwear = base.headwear || 'none';
  let outfitStyle = base.outfitStyle || 'tshirt';
  let hairStyle = base.hairStyle || 'short';
  let archetype = base.archetype || '';
  let primaryColor = safeHex(base.primaryColor, '#3B82F6');
  let secondaryColor = safeHex(base.secondaryColor, '#1E293B');
  let accentColor = safeHex(base.accentColor, '#FACC15');
  let hairColor = safeHex(base.hairColor, '#3B2314');

  if (/\bking\b/.test(text) && !/\bqueen\b/.test(text)) {
    archetype = 'king';
    headwear = 'crown';
    outfitStyle = 'robe';
    acc.add('cape');
    if (!/\b(boy|young|clean)\b/.test(text)) acc.add('beard');
    if (primaryColor === '#3B82F6') primaryColor = '#DC2626';
  } else if (/\bqueen\b/.test(text)) {
    archetype = 'queen';
    headwear = 'crown';
    outfitStyle = 'robe';
    if (hairStyle === 'short') hairStyle = 'long';
    acc.add('cape');
    if (primaryColor === '#3B82F6') primaryColor = '#9333EA';
  } else if (/\bprincess\b/.test(text)) {
    archetype = 'princess';
    headwear = 'tiara';
    outfitStyle = 'dress';
    if (hairStyle === 'short') hairStyle = 'long';
    acc.add('cape');
    if (primaryColor === '#3B82F6') primaryColor = '#EC4899';
  } else if (/\bprince\b/.test(text)) {
    archetype = 'prince';
    headwear = 'crown';
    outfitStyle = 'robe';
    acc.add('cape');
    if (primaryColor === '#3B82F6') primaryColor = '#2563EB';
  } else if (/\bwizard\b/.test(text)) {
    archetype = 'wizard';
    headwear = 'wizardHat';
    outfitStyle = 'robe';
    acc.add('beard');
    acc.add('cape');
    if (hairColor === '#3B2314') hairColor = '#E2E8F0';
    if (primaryColor === '#3B82F6') primaryColor = '#4F46E5';
  } else if (/\bwitch\b/.test(text)) {
    archetype = 'witch';
    headwear = 'witchHat';
    outfitStyle = 'robe';
    if (hairStyle === 'short') hairStyle = 'long';
    acc.add('cape');
  } else if (/\b(soldier|knight|warrior|guard)\b/.test(text)) {
    archetype = /\bknight\b/.test(text) ? 'knight' : 'soldier';
    headwear = 'helmet';
    outfitStyle = 'armor';
    acc.add('gloves');
    if (/\bknight\b/.test(text)) acc.add('cape');
    if (primaryColor === '#3B82F6') {
      primaryColor = /\bknight\b/.test(text) ? '#64748B' : '#15803D';
    }
  } else if (/\b(police|policeman|policewoman|cop)\b/.test(text) && !hasVehicleWord) {
    archetype = 'police';
    headwear = 'policeCap';
    outfitStyle = 'uniform';
    acc.add('gloves');
    primaryColor = '#1D4ED8';
    secondaryColor = '#0F172A';
  } else if (/\b(firefighter|fireman)\b/.test(text)) {
    archetype = 'firefighter';
    headwear = 'helmet';
    outfitStyle = 'uniform';
    acc.add('gloves');
    if (primaryColor === '#3B82F6') primaryColor = '#EF4444';
  } else if (/\b(superhero|super\s*hero)\b/.test(text)) {
    archetype = 'superhero';
    outfitStyle = 'superhero';
    acc.add('cape');
    acc.add('mask');
    acc.add('gloves');
  } else if (/\bchef\b/.test(text)) {
    archetype = 'chef';
    headwear = 'chefHat';
    outfitStyle = 'uniform';
  } else if (/\b(doctor|nurse|surgeon)\b/.test(text)) {
    archetype = 'doctor';
    outfitStyle = 'labcoat';
    acc.add('stethoscope');
  } else if (/\bfarmer\b/.test(text)) {
    archetype = 'farmer';
    headwear = 'strawHat';
    outfitStyle = 'overalls';
  } else if (/\bangel\b/.test(text)) {
    archetype = 'angel';
    headwear = 'halo';
    outfitStyle = 'dress';
    acc.add('angelWings');
  } else if (/\bfairy\b/.test(text)) {
    archetype = 'fairy';
    headwear = 'wreath';
    outfitStyle = 'dress';
    acc.add('fairyWings');
  }

  return {
    ...base,
    entityType: 'humanoid',
    archetype: archetype || base.archetype,
    hairStyle,
    headwear,
    outfitStyle,
    primaryColor,
    secondaryColor,
    accentColor,
    skinColor: safeHex(base.skinColor, '#FAD2B8'),
    eyeColor: safeHex(base.eyeColor, '#0284C7'),
    hairColor,
    accessories: Array.from(acc),
  };
}

// Gracefully resolves styling from blueprint.style OR infers rich Chibi-Pixar styling from older saved blueprints
export function inferStyleFromBlueprint(
  blueprint: CustomModelBlueprint
): CustomModelStyleSpec {
  const text = `${blueprint.name} ${blueprint.prompt}`.toLowerCase();
  const hasVehicleWord =
    /\b(car|bus|truck|cart|train|taxi|van|tractor|helicopter|chopper|plane|airplane|jet|boat|ship|rocket|spaceship|motorcycle|bicycle)\b/.test(
      text
    );
  const hasHumanoidCue =
    /\b(boy|girl|kid|man|woman|hero|superhero|wizard|witch|king|queen|prince|princess|knight|soldier|warrior|astronaut|pirate|ninja|robot|chef|doctor|nurse|police|policeman|policewoman|cop|firefighter|farmer|teacher|angel|fairy|samurai|explorer)\b/.test(
      text
    ) && !hasVehicleWord;

  const s = blueprint.style;
  if (s && ['humanoid', 'animal', 'vehicle', 'prop'].includes(s.entityType)) {
    const resolved: CustomModelStyleSpec = {
      ...s,
      primaryColor: safeHex(s.primaryColor, '#3B82F6'),
      secondaryColor: safeHex(s.secondaryColor, '#1E293B'),
      accentColor: safeHex(s.accentColor, '#FACC15'),
      skinColor: safeHex(s.skinColor, '#FAD2B8'),
      eyeColor: safeHex(s.eyeColor, '#0284C7'),
      hairColor: safeHex(s.hairColor, '#3B2314'),
      accessories: Array.isArray(s.accessories) ? s.accessories : [],
    };
    if (resolved.entityType === 'humanoid' || hasHumanoidCue) {
      return enforceHumanoidRoleDefaults(resolved, text);
    }
    return resolved;
  }

  const firstColor = safeHex(
    blueprint.parts?.find((p) => p.role === 'torso')?.color ||
      blueprint.parts?.[0]?.color,
    '#3B82F6'
  );

  if (
    !hasHumanoidCue &&
    (blueprint.category === 'vehicle' || hasVehicleWord || /\b(bike|vehicle)\b/.test(text))
  ) {
    return {
      entityType: 'vehicle',
      archetype: text.includes('bus')
        ? 'schoolBus'
        : text.includes('police')
          ? 'policeCar'
          : text.includes('cart')
            ? 'iceCreamCart'
            : text.includes('truck')
              ? 'truck'
              : text.includes('helicopter')
                ? 'helicopter'
                : text.includes('plane')
                  ? 'airplane'
                  : text.includes('boat') || text.includes('ship')
                    ? 'boat'
                    : text.includes('bike')
                      ? 'bike'
                      : 'car',
      primaryColor: firstColor,
      secondaryColor: '#F8FAFC',
      accentColor: '#FACC15',
      accessories: [],
    };
  }

  if (
    blueprint.category === 'creature' ||
    /\b(dino|dragon|dog|puppy|cat|kitty|lion|tiger|bear|rabbit|bunny|elephant|horse|bird|monster|unicorn)\b/.test(
      text
    )
  ) {
    return {
      entityType: 'animal',
      archetype: text.includes('dragon')
        ? 'dragon'
        : text.includes('dino')
          ? 'dino'
          : text.includes('rabbit') || text.includes('bunny')
            ? 'rabbit'
            : text.includes('elephant')
              ? 'elephant'
              : text.includes('lion')
                ? 'lion'
                : 'creature',
      primaryColor: firstColor,
      secondaryColor: '#FEF08A',
      accentColor: '#F97316',
      eyeColor: '#D97706',
      accessories: text.includes('dragon') ? ['wings', 'horns'] : [],
    };
  }

  if (blueprint.category === 'character' || hasHumanoidCue) {
    const isFem = /\b(girl|woman|queen|princess|fairy|witch|lady|she|daughter|mother|nurse)\b/.test(
      text
    );
    const isRobot = /\b(robot|bot|mech|cyborg|android)\b/.test(text);
    const accessories: string[] = [];
    if (text.includes('cape') || text.includes('hero') || text.includes('king') || text.includes('queen')) {
      accessories.push('cape');
    }
    if (text.includes('backpack') || text.includes('explorer')) {
      accessories.push('backpack');
    }
    if (text.includes('wing') || text.includes('angel') || text.includes('fairy')) {
      accessories.push(text.includes('fairy') ? 'fairyWings' : 'angelWings');
    }
    if (text.includes('glass')) accessories.push('glasses');
    if (text.includes('mask') || text.includes('hero') || text.includes('ninja')) {
      accessories.push('mask');
    }
    if (text.includes('beard') || text.includes('wizard') || /\bking\b/.test(text)) {
      accessories.push('beard');
    }
    if (text.includes('hero') || text.includes('boy') || text.includes('astronaut') || text.includes('soldier') || text.includes('police')) {
      accessories.push('gloves');
    }

    let headwear: HeadwearKind = 'none';
    if (text.includes('cap')) headwear = 'cap';
    else if (/\bprincess\b/.test(text) || text.includes('tiara')) headwear = 'tiara';
    else if (/\b(king|queen|prince)\b/.test(text) || text.includes('crown')) headwear = 'crown';
    else if (text.includes('wizard')) headwear = 'wizardHat';
    else if (text.includes('witch')) headwear = 'witchHat';
    else if (text.includes('chef')) headwear = 'chefHat';
    else if (text.includes('police')) headwear = 'policeCap';
    else if (text.includes('astronaut') || text.includes('knight') || text.includes('soldier') || text.includes('firefighter') || text.includes('helmet')) {
      headwear = 'helmet';
    } else if (text.includes('halo') || text.includes('angel')) headwear = 'halo';
    else if (text.includes('beanie')) headwear = 'beanie';

    return enforceHumanoidRoleDefaults(
      {
        entityType: 'humanoid',
        archetype: isRobot ? 'robot' : isFem ? 'girl' : 'boy',
        hairStyle: isFem ? 'ponytail' : text.includes('spiky') || text.includes('hero') ? 'spiky' : 'short',
        headwear,
        outfitStyle: text.includes('hero')
          ? 'superhero'
          : text.includes('wizard') || text.includes('witch') || /\b(king|queen|prince)\b/.test(text)
            ? 'robe'
            : text.includes('astronaut') || text.includes('knight') || text.includes('soldier')
              ? 'armor'
              : text.includes('hoodie')
                ? 'hoodie'
                : isFem
                  ? 'dress'
                  : 'tshirt',
        primaryColor: firstColor,
        secondaryColor: '#1E293B',
        accentColor: '#FACC15',
        skinColor: isFem ? '#FAD2B8' : '#F4C2A1',
        eyeColor: isFem ? '#16A34A' : '#0284C7',
        hairColor: isFem ? '#5A2D18' : '#3B2314',
        accessories,
      },
      text
    );
  }

  return {
    entityType: 'prop',
    primaryColor: firstColor,
    secondaryColor: '#F8FAFC',
    accentColor: '#FACC15',
    accessories: [],
  };
}

function buildSculptedCustomHumanoid(
  style: CustomModelStyleSpec
): SculptedCustomAssembly {
  const isRobot = style.archetype === 'robot';
  if (isRobot) {
    const bot = buildSculptedRobotModel(safeHex(style.primaryColor, '#06B6D4'));
    return {
      entityType: 'humanoid',
      bodyPivot: bot.bodyPivot,
      headPivot: bot.headPivot,
      jawMesh: bot.mouthMesh,
      leftBrow: bot.leftBrow,
      rightBrow: bot.rightBrow,
      leftArmPivot: bot.leftArmPivot,
      rightArmPivot: bot.rightArmPivot,
      leftForearmPivot: bot.leftForearmPivot,
      rightForearmPivot: bot.rightForearmPivot,
      leftLegPivot: bot.leftLegPivot,
      rightLegPivot: bot.rightLegPivot,
      leftKneePivot: bot.leftKneePivot,
      rightKneePivot: bot.rightKneePivot,
      wheels: [],
      rotors: [],
      propellers: [],
      lamps: [],
      wings: [],
      tails: [],
      accentMeshes: bot.accentMeshes,
      headHeight: bot.headHeight,
      baseBodyY: bot.baseBodyY,
      ringRadius: 0.65,
    };
  }

  const arch = (style.archetype || '').toLowerCase();
  const isFemale =
    ['girl', 'woman', 'queen', 'princess', 'fairy', 'witch', 'angel', 'mother', 'daughter', 'lady'].includes(
      arch
    ) ||
    style.outfitStyle === 'dress' ||
    style.outfitStyle === 'saree' ||
    style.hairStyle === 'ponytail' ||
    style.hairStyle === 'bun' ||
    style.headwear === 'tiara';

  const isRoyalOrAdult = [
    'king',
    'queen',
    'wizard',
    'witch',
    'soldier',
    'knight',
    'police',
    'firefighter',
    'doctor',
    'chef',
    'teacher',
    'farmer',
    'superhero',
  ].includes(arch);

  const spec: HumanoidSpec = {
    scaleFactor: isRoyalOrAdult ? 1.08 : 0.98,
    isFemale,
    hasFreckles: !isRoyalOrAdult,
    skinColor: safeHex(style.skinColor, isFemale ? '#FAD2B8' : '#F4C2A1'),
    primaryColor: safeHex(style.primaryColor, '#3B82F6'),
    secondaryColor: safeHex(style.secondaryColor, '#1E293B'),
    accentColor: safeHex(style.accentColor, '#FACC15'),
    hairColor: safeHex(style.hairColor, isFemale ? '#5A2D18' : '#3B2314'),
    eyeColor: safeHex(style.eyeColor, isFemale ? '#16A34A' : '#0284C7'),
    hairStyle: style.hairStyle || (isFemale ? 'ponytail' : 'short'),
    headwear: style.headwear || 'none',
    outfitStyle: style.outfitStyle || (isFemale ? 'dress' : 'tshirt'),
    accessories: new Set(style.accessories || []),
  };

  const parts = buildSculptedHumanoidAssembly(spec);
  const wings: THREE.Object3D[] = [];
  if (parts.leftWingPivot) wings.push(parts.leftWingPivot);
  if (parts.rightWingPivot) wings.push(parts.rightWingPivot);
  const tails: THREE.Object3D[] = [];
  if (parts.tailPivot) tails.push(parts.tailPivot);

  return {
    entityType: 'humanoid',
    bodyPivot: parts.bodyPivot,
    headPivot: parts.headPivot,
    jawMesh: parts.mouthMesh,
    leftBrow: parts.leftBrow,
    rightBrow: parts.rightBrow,
    leftArmPivot: parts.leftArmPivot,
    rightArmPivot: parts.rightArmPivot,
    leftForearmPivot: parts.leftForearmPivot,
    rightForearmPivot: parts.rightForearmPivot,
    leftLegPivot: parts.leftLegPivot,
    rightLegPivot: parts.rightLegPivot,
    leftKneePivot: parts.leftKneePivot,
    rightKneePivot: parts.rightKneePivot,
    ponytailPivot: parts.ponytailPivot,
    wheels: [],
    rotors: [],
    propellers: [],
    lamps: [],
    wings,
    tails,
    accentMeshes: parts.accentMeshes,
    headHeight: parts.headHeight,
    baseBodyY: parts.baseBodyY,
    ringRadius: 0.65,
  };
}

// Unified high-detail 3D model generator shared by Built-In Library & AI 3D Builder
export function buildHighDetail3DModel(
  input: HighDetailBuildInput
): HighDetailBuildOutput {
  if (input.mode === 'character') {
    if (input.characterKind === 'robot') {
      return {
        mode: 'character',
        humanoid: buildSculptedRobotModel(input.accentColor),
      };
    }
    const spec = resolveBuiltinHumanoidSpec(input.characterKind, input.accentColor);
    return {
      mode: 'character',
      humanoid: buildSculptedHumanoidAssembly(spec),
    };
  }

  if (input.mode === 'vehicle') {
    const bodyPivot = new THREE.Group();
    const vehicle = buildSculptedVehicleAssembly(
      bodyPivot,
      input.vehicleKind,
      input.accentColor
    );
    return { mode: 'vehicle', vehicle };
  }

  const bp = input.blueprint;
  const style = inferStyleFromBlueprint(bp);

  if (style.entityType === 'humanoid') {
    return {
      mode: 'custom',
      custom: buildSculptedCustomHumanoid(style),
    };
  }

  if (style.entityType === 'animal') {
    return {
      mode: 'custom',
      custom: buildSculptedAnimalBlueprint(style, bp),
    };
  }

  if (style.entityType === 'vehicle') {
    const bodyPivot = new THREE.Group();
    const v = buildSculptedVehicleAssembly(
      bodyPivot,
      style.archetype || bp.name || bp.prompt,
      style.primaryColor,
      style.secondaryColor,
      style.accentColor
    );
    return {
      mode: 'custom',
      custom: {
        entityType: 'vehicle',
        bodyPivot,
        wheels: v.wheels,
        rotors: v.rotors,
        propellers: v.propellers,
        lamps: v.lamps,
        wings: [],
        tails: [],
        accentMeshes: v.accentMeshes,
        headHeight: v.headHeight,
        baseBodyY: 0,
        ringRadius: v.ringRadius,
      },
    };
  }

  return {
    mode: 'custom',
    custom: buildSculptedPropBlueprint(bp),
  };
}
