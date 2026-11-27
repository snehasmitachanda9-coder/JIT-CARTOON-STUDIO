import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  AnimationState,
  CharacterKind,
  FacialExpression,
} from '../types/studio';
import {
  ClothPBRPattern,
  createCharacterPBRClothSet,
  createRobotMetalPBRSet,
} from './proceduralTextures';

export type GLBCharacterAssetKey =
  | 'kaykitRogue'
  | 'kaykitMage'
  | 'kaykitKnight'
  | 'kaykitBarbarian'
  | 'michelle'
  | 'xbot'
  | 'soldier'
  | 'robotExpressive'
  | 'cesiumMan';

/**
 * Primary local static GLBs + verified public CDN fallback URLs
 * (Three.js, Khronos glTF-Sample-Assets, KayKit CC0, ReadyPlayerMe fallback).
 */
export const GLTF_CHARACTER_SOURCES: Record<GLBCharacterAssetKey, string[]> = {
  kaykitRogue: [
    '/models/KayKit_Rogue.glb',
    'https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0@main/addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/Xbot.glb',
  ],
  kaykitMage: [
    '/models/KayKit_Mage.glb',
    'https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0@main/addons/kaykit_character_pack_adventures/Characters/gltf/Mage.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/Xbot.glb',
  ],
  kaykitKnight: [
    '/models/KayKit_Knight.glb',
    'https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0@main/addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/Soldier.glb',
  ],
  kaykitBarbarian: [
    '/models/KayKit_Barbarian.glb',
    'https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0@main/addons/kaykit_character_pack_adventures/Characters/gltf/Barbarian.glb',
    'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/CesiumMan/glTF-Binary/CesiumMan.glb',
  ],
  michelle: [
    '/models/Michelle.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/Michelle.glb',
    'https://threejs.org/examples/models/gltf/Michelle.glb',
  ],
  xbot: [
    '/models/Xbot.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/Xbot.glb',
    'https://threejs.org/examples/models/gltf/Xbot.glb',
  ],
  soldier: [
    '/models/Soldier.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/Soldier.glb',
    'https://threejs.org/examples/models/gltf/Soldier.glb',
  ],
  robotExpressive: [
    '/models/RobotExpressive.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
    'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
  ],
  cesiumMan: [
    '/models/CesiumMan.glb',
    'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/CesiumMan/glTF-Binary/CesiumMan.glb',
  ],
};

interface CachedGLBAsset {
  key: GLBCharacterAssetKey;
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

interface CharacterArchetypeConfig {
  assetKey: GLBCharacterAssetKey;
  targetHeight: number;
  facingRotationY: number;
  clothPattern: ClothPBRPattern;
  tintIntensity: number;
  keepHat?: boolean;
  keepCape?: boolean;
  keepHelmet?: boolean;
  accessory?:
    | 'none'
    | 'crown'
    | 'tiara'
    | 'wingsFairy'
    | 'wingsAngel'
    | 'glasses'
    | 'chefHat'
    | 'doctorKit'
    | 'policeCap'
    | 'strawHat'
    | 'superCape'
    | 'casualCap';
  wardrobeTintHex?: string;
}

const ARCHETYPE_CONFIG: Record<CharacterKind, CharacterArchetypeConfig> = {
  boy: {
    assetKey: 'kaykitRogue',
    targetHeight: 1.52,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.42,
    accessory: 'casualCap',
  },
  son: {
    assetKey: 'kaykitRogue',
    targetHeight: 1.44,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.45,
    accessory: 'casualCap',
  },
  kid: {
    assetKey: 'kaykitRogue',
    targetHeight: 1.34,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.48,
    accessory: 'none',
  },
  twins: {
    assetKey: 'kaykitRogue',
    targetHeight: 1.48,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.46,
    accessory: 'casualCap',
  },
  teenager: {
    assetKey: 'kaykitRogue',
    targetHeight: 1.66,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.4,
    keepCape: true,
    accessory: 'none',
  },
  girl: {
    assetKey: 'michelle',
    targetHeight: 1.52,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.3,
    accessory: 'none',
  },
  daughter: {
    assetKey: 'michelle',
    targetHeight: 1.42,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.34,
    accessory: 'none',
  },
  woman: {
    assetKey: 'michelle',
    targetHeight: 1.68,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.28,
    accessory: 'none',
  },
  mother: {
    assetKey: 'michelle',
    targetHeight: 1.7,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.3,
    accessory: 'none',
  },
  teacher: {
    assetKey: 'michelle',
    targetHeight: 1.7,
    facingRotationY: 0,
    clothPattern: 'uniform',
    tintIntensity: 0.25,
    accessory: 'glasses',
  },
  grandma: {
    assetKey: 'michelle',
    targetHeight: 1.62,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.26,
    accessory: 'glasses',
    wardrobeTintHex: '#d8b4fe',
  },
  princess: {
    assetKey: 'michelle',
    targetHeight: 1.58,
    facingRotationY: 0,
    clothPattern: 'royal',
    tintIntensity: 0.35,
    accessory: 'tiara',
  },
  queen: {
    assetKey: 'michelle',
    targetHeight: 1.72,
    facingRotationY: 0,
    clothPattern: 'royal',
    tintIntensity: 0.35,
    accessory: 'crown',
  },
  fairy: {
    assetKey: 'michelle',
    targetHeight: 1.52,
    facingRotationY: 0,
    clothPattern: 'fantasy',
    tintIntensity: 0.38,
    accessory: 'wingsFairy',
  },
  angel: {
    assetKey: 'michelle',
    targetHeight: 1.68,
    facingRotationY: 0,
    clothPattern: 'fantasy',
    tintIntensity: 0.25,
    accessory: 'wingsAngel',
    wardrobeTintHex: '#f8fafc',
  },
  father: {
    assetKey: 'kaykitBarbarian',
    targetHeight: 1.8,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.38,
    accessory: 'none',
  },
  farmer: {
    assetKey: 'kaykitBarbarian',
    targetHeight: 1.76,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.35,
    accessory: 'strawHat',
  },
  grandpa: {
    assetKey: 'kaykitBarbarian',
    targetHeight: 1.7,
    facingRotationY: 0,
    clothPattern: 'casual',
    tintIntensity: 0.34,
    accessory: 'glasses',
  },
  doctor: {
    assetKey: 'kaykitMage',
    targetHeight: 1.76,
    facingRotationY: 0,
    clothPattern: 'uniform',
    tintIntensity: 0.28,
    accessory: 'doctorKit',
    wardrobeTintHex: '#f1f5f9',
  },
  chef: {
    assetKey: 'kaykitMage',
    targetHeight: 1.74,
    facingRotationY: 0,
    clothPattern: 'uniform',
    tintIntensity: 0.24,
    accessory: 'chefHat',
    wardrobeTintHex: '#f8fafc',
  },
  wizard: {
    assetKey: 'kaykitMage',
    targetHeight: 1.82,
    facingRotationY: 0,
    clothPattern: 'fantasy',
    tintIntensity: 0.48,
    keepHat: true,
    keepCape: true,
    accessory: 'none',
  },
  witch: {
    assetKey: 'kaykitMage',
    targetHeight: 1.68,
    facingRotationY: 0,
    clothPattern: 'fantasy',
    tintIntensity: 0.52,
    keepHat: true,
    keepCape: true,
    accessory: 'none',
  },
  king: {
    assetKey: 'kaykitKnight',
    targetHeight: 1.84,
    facingRotationY: 0,
    clothPattern: 'royal',
    tintIntensity: 0.45,
    keepCape: true,
    accessory: 'crown',
  },
  prince: {
    assetKey: 'kaykitKnight',
    targetHeight: 1.72,
    facingRotationY: 0,
    clothPattern: 'royal',
    tintIntensity: 0.45,
    keepCape: true,
    accessory: 'tiara',
  },
  police: {
    assetKey: 'soldier',
    targetHeight: 1.78,
    facingRotationY: Math.PI,
    clothPattern: 'uniform',
    tintIntensity: 0.55,
    accessory: 'policeCap',
  },
  superhero: {
    assetKey: 'xbot',
    targetHeight: 1.78,
    facingRotationY: 0,
    clothPattern: 'hero',
    tintIntensity: 1.0,
    accessory: 'superCape',
  },
  robot: {
    assetKey: 'robotExpressive',
    targetHeight: 1.66,
    facingRotationY: 0,
    clothPattern: 'hero',
    tintIntensity: 1.0,
    accessory: 'none',
  },
};

let sharedLoader: GLTFLoader | null = null;
function getGLTFLoader(): GLTFLoader {
  if (sharedLoader) return sharedLoader;
  const loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);
  } catch {
    // non-draco GLBs still load seamlessly
  }
  sharedLoader = loader;
  return loader;
}

const assetCache = new Map<GLBCharacterAssetKey, CachedGLBAsset>();
const assetPromises = new Map<GLBCharacterAssetKey, Promise<CachedGLBAsset>>();

async function loadRawGLB(urls: string[]): Promise<GLTF> {
  const loader = getGLTFLoader();
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const gltf = await loader.loadAsync(url);
      if (gltf?.scene) return gltf;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All GLTF character asset URLs failed to load');
}

function findFirstSkinnedMesh(obj: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  obj.traverse((child) => {
    if (!found && (child as THREE.SkinnedMesh).isSkinnedMesh) {
      found = child as THREE.SkinnedMesh;
    }
  });
  return found;
}

function retargetMixamoClipsToTarget(
  targetAsset: CachedGLBAsset,
  donorAsset: CachedGLBAsset
): THREE.AnimationClip[] {
  const out: THREE.AnimationClip[] = [...targetAsset.animations];
  const existingNames = new Set(out.map((c) => c.name.toLowerCase()));

  try {
    const targetClone = SkeletonUtils.clone(targetAsset.scene);
    const donorClone = SkeletonUtils.clone(donorAsset.scene);
    targetClone.updateMatrixWorld(true);
    donorClone.updateMatrixWorld(true);

    const targetMesh = findFirstSkinnedMesh(targetClone);
    const donorMesh = findFirstSkinnedMesh(donorClone);
    if (!targetMesh || !donorMesh) return out;

    for (const clip of donorAsset.animations) {
      if (existingNames.has(clip.name.toLowerCase())) continue;
      if (clip.name.toLowerCase() === 'tpose') continue;

      try {
        const retargeted = SkeletonUtils.retargetClip(
          targetMesh,
          donorMesh,
          clip,
          {
            hip: 'mixamorig:Hips',
            getBoneName: (bone: THREE.Bone) => bone.name,
            preserveHipPosition: true,
            preserveBoneMatrix: true,
          }
        );

        // Rewrite `.bones[mixamorig:X].prop` -> `mixamorig:X.prop` so AnimationMixer(modelRoot) binds natively
        retargeted.tracks.forEach((tr) => {
          tr.name = tr.name.replace(/^\.bones\[(.*?)\]\./, '$1.');
        });
        retargeted.name = clip.name;
        out.push(retargeted);
        existingNames.add(clip.name.toLowerCase());
      } catch {
        // Skip incompatible clip gracefully
      }
    }
  } catch {
    // Keep native animations if retargeting fails
  }
  return out;
}

let michelleRetargetedDone = false;

export async function loadGLBCharacterAsset(
  key: GLBCharacterAssetKey
): Promise<CachedGLBAsset> {
  const existing = assetCache.get(key);
  if (existing) return existing;

  const inflight = assetPromises.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const urls = GLTF_CHARACTER_SOURCES[key];
    const gltf = await loadRawGLB(urls);
    const cached: CachedGLBAsset = {
      key,
      scene: gltf.scene,
      animations: gltf.animations || [],
    };
    assetCache.set(key, cached);

    // Ensure Michelle gets full Walk / Run / Idle / Agree / Sad / HeadShake clips from Xbot
    if (key === 'michelle' && !michelleRetargetedDone) {
      michelleRetargetedDone = true;
      try {
        const xbot = await loadGLBCharacterAsset('xbot');
        cached.animations = retargetMixamoClipsToTarget(cached, xbot);
      } catch {
        // Michelle still has SambaDance + procedural fallback poses
      }
    }

    return cached;
  })();

  assetPromises.set(key, promise);
  return promise;
}

let preloadStarted = false;
export function preloadCoreCharacterGLBs(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  const keys: GLBCharacterAssetKey[] = [
    'kaykitRogue',
    'michelle',
    'robotExpressive',
    'xbot',
    'kaykitMage',
    'kaykitKnight',
    'kaykitBarbarian',
    'soldier',
  ];
  keys.forEach((k) => {
    void loadGLBCharacterAsset(k).catch(() => {});
  });
}

export interface SkeletonBoneRefs {
  hips?: THREE.Object3D;
  spine?: THREE.Object3D;
  neck?: THREE.Object3D;
  head?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  leftForearm?: THREE.Object3D;
  rightForearm?: THREE.Object3D;
  leftHand?: THREE.Object3D;
  rightHand?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
}

export interface MountedGLTFCharacter {
  kind: CharacterKind;
  assetKey: GLBCharacterAssetKey;
  modelRoot: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  clipTrackBones: Map<string, Set<string>>;
  bones: SkeletonBoneRefs;
  restQuats: Map<THREE.Object3D, THREE.Quaternion>;
  morphMeshes: THREE.Mesh[];
  accentMaterials: THREE.MeshStandardMaterial[];
  capeMaterials: THREE.MeshStandardMaterial[];
  leftHandMount: THREE.Group;
  rightHandMount: THREE.Group;
  leftWingPivot?: THREE.Group;
  rightWingPivot?: THREE.Group;
  weaponNodes: THREE.Object3D[];
  headHeight: number;
  isTintableAtlas: boolean;
  tintIntensity: number;
  clothPattern: ClothPBRPattern;
  baseMaterialColors: Map<THREE.MeshStandardMaterial, THREE.Color>;
  applyAccentColor: (hex: string) => void;
}

const KAYKIT_WEAPON_PATTERNS = [
  'knife',
  'crossbow',
  'sword',
  'shield',
  'axe',
  'mug',
  'throwable',
  'staff',
  'wand',
  'spellbook',
];

function findBoneByNames(
  root: THREE.Object3D,
  candidates: string[]
): THREE.Object3D | undefined {
  for (const name of candidates) {
    const obj = root.getObjectByName(name);
    if (obj) return obj;
  }
  return undefined;
}

function buildRoleAccessoryForHead(
  accessory: CharacterArchetypeConfig['accessory'],
  accentColor: string,
  accentMats: THREE.MeshStandardMaterial[]
): THREE.Group | null {
  if (!accessory || accessory === 'none') return null;

  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    metalness: 0.85,
    roughness: 0.18,
    clearcoat: 0.6,
  });
  const group = new THREE.Group();

  switch (accessory) {
    case 'crown':
    case 'tiara': {
      const isTiara = accessory === 'tiara';
      const r = isTiara ? 0.105 : 0.13;
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 1.08, r, isTiara ? 0.045 : 0.065, 20),
        goldMat
      );
      group.add(band);
      const pts = isTiara ? 3 : 5;
      for (let i = 0; i < pts; i++) {
        const a = isTiara
          ? ((i - 1) * 0.45)
          : (i / pts) * Math.PI * 2;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.022, isTiara && i === 1 ? 0.09 : 0.065, 8),
          goldMat
        );
        spike.position.set(Math.sin(a) * r, isTiara ? 0.05 : 0.06, Math.cos(a) * r);
        group.add(spike);
      }
      const gemMat = new THREE.MeshPhysicalMaterial({
        color: accentColor,
        roughness: 0.1,
        clearcoat: 1,
        emissive: accentColor,
        emissiveIntensity: 0.22,
      });
      accentMats.push(gemMat);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 1), gemMat);
      gem.position.set(0, 0.02, r + 0.012);
      group.add(gem);
      group.position.set(0, 0.18, 0.01);
      return group;
    }

    case 'wingsAngel': {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.016, 12, 28),
        new THREE.MeshPhysicalMaterial({
          color: 0xfef08a,
          emissive: 0xfacc15,
          emissiveIntensity: 0.65,
          roughness: 0.2,
          metalness: 0.7,
        })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 0.28, -0.01);
      group.add(halo);
      return group;
    }

    case 'wingsFairy': {
      const wreath = new THREE.Mesh(
        new THREE.TorusGeometry(0.135, 0.018, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 })
      );
      wreath.rotation.x = Math.PI / 2;
      group.add(wreath);
      const petalMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.35 });
      accentMats.push(petalMat);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), petalMat);
        fl.position.set(Math.cos(a) * 0.135, 0.012, Math.sin(a) * 0.135);
        group.add(fl);
      }
      group.position.set(0, 0.16, 0.01);
      return group;
    }

    case 'glasses': {
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.75,
        roughness: 0.25,
      });
      const lensMat = new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.38,
        roughness: 0.08,
        clearcoat: 1,
      });
      [-0.055, 0.055].forEach((lx) => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 8, 20), frameMat);
        rim.position.set(lx, 0.05, 0.135);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 16), lensMat);
        lens.position.set(lx, 0.05, 0.135);
        group.add(rim, lens);
      });
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 8), frameMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.05, 0.135);
      group.add(bridge);
      return group;
    }

    case 'chefHat': {
      const whiteCloth = createCharacterPBRClothSet('#f8fafc', '#e2e8f0', 'uniform');
      const mat = new THREE.MeshStandardMaterial({
        map: whiteCloth.map,
        normalMap: whiteCloth.normalMap,
        roughnessMap: whiteCloth.roughnessMap,
        roughness: 0.72,
      });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.12, 24), mat);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18, 22, 18), mat);
      puff.scale.set(1, 0.88, 1);
      puff.position.y = 0.12;
      group.add(band, puff);
      group.position.set(0, 0.25, 0);
      return group;
    }

    case 'strawHat': {
      const strawMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        roughness: 0.82,
      });
      const ribbonMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.55,
      });
      accentMats.push(ribbonMat);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.025, 28), strawMat);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.14, 24), strawMat);
      crown.position.y = 0.075;
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.182, 0.184, 0.032, 24), ribbonMat);
      ribbon.position.y = 0.025;
      group.add(brim, crown, ribbon);
      group.position.set(0, 0.24, 0);
      return group;
    }

    case 'policeCap': {
      const capMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.48,
      });
      accentMats.push(capMat);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.135, 0.11, 24), capMat);
      crown.position.y = 0.06;
      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.15, 0.02, 18, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25 })
      );
      visor.position.set(0, 0.01, 0.08);
      const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 0), goldMat);
      badge.position.set(0, 0.075, 0.15);
      group.add(crown, visor, badge);
      group.position.set(0, 0.18, 0.01);
      return group;
    }

    case 'casualCap': {
      const capMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.55,
      });
      accentMats.push(capMat);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.175, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
        capMat
      );
      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.17, 0.02, 16, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
        capMat
      );
      visor.position.set(0, 0.01, 0.09);
      group.add(dome, visor);
      group.position.set(0, 0.24, 0.01);
      return group;
    }

    default:
      return null;
  }
}

function buildRoleAccessoryForSpine(
  accessory: CharacterArchetypeConfig['accessory'],
  accentColor: string,
  accentMats: THREE.MeshStandardMaterial[]
): {
  group: THREE.Group | null;
  leftWingPivot?: THREE.Group;
  rightWingPivot?: THREE.Group;
} {
  if (!accessory || accessory === 'none') return { group: null };

  if (accessory === 'wingsFairy' || accessory === 'wingsAngel') {
    const isAngel = accessory === 'wingsAngel';
    const root = new THREE.Group();
    root.position.set(0, 0.06, -0.14);

    const wingMat = new THREE.MeshPhysicalMaterial({
      color: isAngel ? 0xf8fafc : accentColor,
      emissive: isAngel ? 0xe0f2fe : accentColor,
      emissiveIntensity: 0.24,
      transparent: true,
      opacity: isAngel ? 0.94 : 0.78,
      roughness: 0.18,
      clearcoat: 0.9,
      side: THREE.DoubleSide,
    });
    if (!isAngel) accentMats.push(wingMat);

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.28, 0.34, 0.44, 0.18);
    shape.quadraticCurveTo(0.42, -0.06, 0.18, -0.22);
    shape.quadraticCurveTo(0.06, -0.18, 0, -0.05);

    const wingGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.015,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
    });

    const leftWingPivot = new THREE.Group();
    leftWingPivot.position.set(0.06, 0, 0);
    const lWing = new THREE.Mesh(wingGeo, wingMat);
    leftWingPivot.add(lWing);

    const rightWingPivot = new THREE.Group();
    rightWingPivot.position.set(-0.06, 0, 0);
    const rWing = new THREE.Mesh(wingGeo, wingMat);
    rWing.scale.x = -1;
    rightWingPivot.add(rWing);

    root.add(leftWingPivot, rightWingPivot);
    return { group: root, leftWingPivot, rightWingPivot };
  }

  if (accessory === 'superCape') {
    const capeSet = createCharacterPBRClothSet(accentColor, '#facc15', 'hero');
    const capeMat = new THREE.MeshStandardMaterial({
      map: capeSet.map,
      normalMap: capeSet.normalMap,
      roughnessMap: capeSet.roughnessMap,
      roughness: 0.56,
      side: THREE.DoubleSide,
    });
    accentMats.push(capeMat);

    const capeShape = new THREE.Shape();
    capeShape.moveTo(-0.18, 0);
    capeShape.lineTo(0.18, 0);
    capeShape.lineTo(0.32, -0.92);
    capeShape.quadraticCurveTo(0, -1.0, -0.32, -0.92);
    capeShape.closePath();

    const capeGeo = new THREE.ExtrudeGeometry(capeShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
    });
    const cape = new THREE.Mesh(capeGeo, capeMat);
    cape.position.set(0, 0.14, -0.12);
    cape.rotation.x = 0.12;
    const root = new THREE.Group();
    root.add(cape);
    return { group: root };
  }

  if (accessory === 'doctorKit') {
    const root = new THREE.Group();
    const tube = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.014, 8, 24, Math.PI * 1.25),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 })
    );
    tube.rotation.x = Math.PI * 0.42;
    tube.rotation.z = Math.PI * 0.88;
    tube.position.set(0, 0.16, 0.02);
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.018, 16),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 })
    );
    bell.rotation.x = Math.PI / 2;
    bell.position.set(0.06, 0.02, 0.16);
    root.add(tube, bell);
    return { group: root };
  }

  return { group: null };
}

export async function mountCharacterGLTF(
  kind: CharacterKind,
  accentColor: string
): Promise<MountedGLTFCharacter> {
  const cfg = ARCHETYPE_CONFIG[kind] || ARCHETYPE_CONFIG.boy;
  let asset: CachedGLBAsset;
  try {
    asset = await loadGLBCharacterAsset(cfg.assetKey);
  } catch {
    // Ultimate resilient fallback
    asset = await loadGLBCharacterAsset('robotExpressive');
  }

  const cloned = SkeletonUtils.clone(asset.scene) as THREE.Group;

  // Compute bounding box in Rest/Idle pose BEFORE scaling so feet sit strictly at y = 0
  const wrapper = new THREE.Group();
  const orientPivot = new THREE.Group();
  orientPivot.rotation.y = cfg.facingRotationY;
  orientPivot.add(cloned);
  wrapper.add(orientPivot);

  const weaponNodes: THREE.Object3D[] = [];
  const accentMaterials: THREE.MeshStandardMaterial[] = [];
  const capeMaterials: THREE.MeshStandardMaterial[] = [];
  const baseMaterialColors = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  const morphMeshes: THREE.Mesh[] = [];

  // Hide extraneous KayKit weapons/helmets by default and clone materials per instance
  const clothSet = createCharacterPBRClothSet(
    cfg.wardrobeTintHex || accentColor,
    '#facc15',
    cfg.clothPattern
  );
  const robotPBR = createRobotMetalPBRSet(accentColor);

  cloned.traverse((obj) => {
    const lowerName = (obj.name || '').toLowerCase();

    if (KAYKIT_WEAPON_PATTERNS.some((p) => lowerName.includes(p))) {
      obj.visible = false;
      weaponNodes.push(obj);
    }
    if (lowerName.includes('helmet') && !cfg.keepHelmet) {
      obj.visible = false;
    }
    if (lowerName === 'mage_hat' || lowerName === 'barbarian_hat') {
      obj.visible = Boolean(cfg.keepHat);
    }
    if (lowerName.includes('cape')) {
      obj.visible = Boolean(cfg.keepCape);
    }

    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // SkinnedMesh bounds stay accurate across animations

    if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
      morphMeshes.push(mesh);
    }

    // Clone materials per actor instance so transitions & color swaps never leak across actors
    const cloneAndUpgradeMat = (orig: THREE.Material): THREE.Material => {
      const clonedMat = orig.clone();
      const std = clonedMat as THREE.MeshStandardMaterial;
      if (!std.isMeshStandardMaterial) return clonedMat;

      std.envMapIntensity = 0.65;
      baseMaterialColors.set(std, std.color.clone());

      // RobotExpressive: brushed anodized PBR metal on 'Main'
      if (asset.key === 'robotExpressive') {
        if (std.name === 'Main') {
          std.map = robotPBR.map;
          std.normalMap = robotPBR.normalMap;
          std.roughnessMap = robotPBR.roughnessMap;
          std.metalness = 0.45;
          std.roughness = 0.35;
          std.color.set('#ffffff');
          std.needsUpdate = true;
          accentMaterials.push(std);
        } else if (std.name === 'Grey') {
          const greyPBR = createRobotMetalPBRSet('#94a3b8');
          std.map = greyPBR.map;
          std.normalMap = greyPBR.normalMap;
          std.roughnessMap = greyPBR.roughnessMap;
          std.metalness = 0.52;
          std.roughness = 0.38;
          std.needsUpdate = true;
        }
        return std;
      }

      // Xbot (Superhero): full high-res procedural PBR cloth/armor texture
      if (asset.key === 'xbot') {
        if (lowerName.includes('surface') || std.name.includes('HighLimbs')) {
          std.map = clothSet.map;
          std.normalMap = clothSet.normalMap;
          std.roughnessMap = clothSet.roughnessMap;
          std.color.set('#ffffff');
          std.roughness = 0.42;
          std.metalness = 0.16;
          std.needsUpdate = true;
          accentMaterials.push(std);
        } else {
          std.color.set('#0f172a');
          std.roughness = 0.38;
          std.metalness = 0.45;
        }
        return std;
      }

      // KayKit capes: replace atlas on cape mesh with vibrant procedural PBR cloth in accentColor!
      if (lowerName.includes('cape')) {
        std.map = clothSet.map;
        std.normalMap = clothSet.normalMap;
        std.roughnessMap = clothSet.roughnessMap;
        std.color.set('#ffffff');
        std.roughness = 0.64;
        std.side = THREE.DoubleSide;
        std.needsUpdate = true;
        capeMaterials.push(std);
        return std;
      }

      // KayKit / Michelle / Soldier: keep crisp original baseColorTexture + subtle woven PBR normalMap + gentle wardrobe tint
      if (!std.normalMap) {
        std.normalMap = clothSet.normalMap;
        std.normalScale = new THREE.Vector2(0.35, 0.35);
      }
      if (std.map) {
        std.map.anisotropy = 4;
      }
      if (cfg.tintIntensity > 0 && asset.key !== 'michelle') {
        const tintColor = new THREE.Color(cfg.wardrobeTintHex || accentColor);
        const base = baseMaterialColors.get(std) || new THREE.Color(0xffffff);
        std.color.copy(base).lerp(tintColor, cfg.tintIntensity * 0.5);
      }
      return std;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(cloneAndUpgradeMat);
    } else if (mesh.material) {
      mesh.material = cloneAndUpgradeMat(mesh.material);
    }
  });

  // Setup AnimationMixer & bind Idle pose briefly so bounding box is measured standing upright
  const mixer = new THREE.AnimationMixer(cloned);
  const actions = new Map<string, THREE.AnimationAction>();
  const clipTrackBones = new Map<string, Set<string>>();

  for (const clip of asset.animations) {
    const action = mixer.clipAction(clip);
    actions.set(clip.name, action);
    const trackBones = new Set<string>();
    clip.tracks.forEach((tr) => {
      const bonePart = tr.name.split('.')[0];
      if (bonePart) trackBones.add(bonePart);
    });
    clipTrackBones.set(clip.name, trackBones);
  }

  const idleClip =
    asset.animations.find((c) => c.name.toLowerCase() === 'idle') ||
    asset.animations.find((c) => c.name.toLowerCase().includes('idle')) ||
    asset.animations[0];
  if (idleClip) {
    const act = actions.get(idleClip.name);
    if (act) {
      act.play();
      mixer.update(0.016);
    }
  }

  wrapper.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrapper);
  const rawSize = new THREE.Vector3();
  box.getSize(rawSize);
  const safeRawHeight = rawSize.y > 0.2 ? rawSize.y : 1.8;
  const scaleFactor = cfg.targetHeight / safeRawHeight;
  orientPivot.scale.setScalar(scaleFactor);

  wrapper.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(wrapper);
  orientPivot.position.y -= scaledBox.min.y;
  wrapper.updateMatrixWorld(true);

  const finalBox = new THREE.Box3().setFromObject(wrapper);
  const headHeight = Math.max(1.2, finalBox.max.y);

  // Locate skeleton bones for procedural layering & handheld attachments
  const bones: SkeletonBoneRefs = {
    hips: findBoneByNames(cloned, ['hips', 'mixamorig:Hips', 'Hips']),
    spine: findBoneByNames(cloned, ['chest', 'spine', 'mixamorig:Spine2', 'mixamorig:Spine1', 'Torso']),
    neck: findBoneByNames(cloned, ['neck', 'mixamorig:Neck', 'Neck']),
    head: findBoneByNames(cloned, ['head', 'mixamorig:Head', 'Head']),
    leftArm: findBoneByNames(cloned, ['upperarm.l', 'mixamorig:LeftArm', 'UpperArm.L']),
    rightArm: findBoneByNames(cloned, ['upperarm.r', 'mixamorig:RightArm', 'UpperArm.R']),
    leftForearm: findBoneByNames(cloned, ['lowerarm.l', 'mixamorig:LeftForeArm', 'LowerArm.L']),
    rightForearm: findBoneByNames(cloned, ['lowerarm.r', 'mixamorig:RightForeArm', 'LowerArm.R']),
    leftHand: findBoneByNames(cloned, ['handslot.l', 'hand.l', 'mixamorig:LeftHand', 'Palm2.L']),
    rightHand: findBoneByNames(cloned, ['handslot.r', 'hand.r', 'mixamorig:RightHand', 'Palm2.R']),
    leftLeg: findBoneByNames(cloned, ['upperleg.l', 'mixamorig:LeftUpLeg', 'UpperLeg.L']),
    rightLeg: findBoneByNames(cloned, ['upperleg.r', 'mixamorig:RightUpLeg', 'UpperLeg.R']),
  };

  // Capture rest quaternions of key bones for clean additive post-mixer resets
  const restQuats = new Map<THREE.Object3D, THREE.Quaternion>();
  Object.values(bones).forEach((b) => {
    if (b) restQuats.set(b, b.quaternion.clone());
  });

  // Compute inverse world-scale compensation for bone-mounted props & accessories
  const _wScale = new THREE.Vector3();
  const computeBoneScaleComp = (bone?: THREE.Object3D): number => {
    if (!bone) return 1;
    bone.getWorldScale(_wScale);
    const avg = (_wScale.x + _wScale.y + _wScale.z) / 3;
    return avg > 0.0001 ? 1 / avg : 1;
  };

  // Mount left/right hand sockets cleanly onto the real skeleton hand bones
  const leftHandMount = new THREE.Group();
  leftHandMount.name = 'leftHandMount';
  if (bones.leftHand) {
    leftHandMount.scale.setScalar(computeBoneScaleComp(bones.leftHand));
    bones.leftHand.add(leftHandMount);
  } else {
    leftHandMount.position.set(0.32, headHeight * 0.54, 0.14);
    wrapper.add(leftHandMount);
  }

  const rightHandMount = new THREE.Group();
  rightHandMount.name = 'rightHandMount';
  if (bones.rightHand) {
    rightHandMount.scale.setScalar(computeBoneScaleComp(bones.rightHand));
    bones.rightHand.add(rightHandMount);
  } else {
    rightHandMount.position.set(-0.32, headHeight * 0.54, 0.14);
    wrapper.add(rightHandMount);
  }

  // Mount stylized role accessories onto real Head & Spine bones
  const headAcc = buildRoleAccessoryForHead(cfg.accessory, accentColor, accentMaterials);
  if (headAcc) {
    const targetHead = bones.head;
    if (targetHead) {
      headAcc.scale.setScalar(computeBoneScaleComp(targetHead));
      targetHead.add(headAcc);
    } else {
      headAcc.position.y += headHeight - 0.18;
      wrapper.add(headAcc);
    }
  }

  const spineAcc = buildRoleAccessoryForSpine(cfg.accessory, accentColor, accentMaterials);
  if (spineAcc.group) {
    const targetSpine = bones.spine;
    if (targetSpine) {
      spineAcc.group.scale.setScalar(computeBoneScaleComp(targetSpine));
      targetSpine.add(spineAcc.group);
    } else {
      spineAcc.group.position.y += headHeight * 0.65;
      wrapper.add(spineAcc.group);
    }
  }

  const applyAccentColor = (hex: string) => {
    const nextCloth = createCharacterPBRClothSet(
      cfg.wardrobeTintHex || hex,
      '#facc15',
      cfg.clothPattern
    );
    const nextCape = createCharacterPBRClothSet(hex, '#facc15', cfg.clothPattern);
    const nextRobot = createRobotMetalPBRSet(hex);

    accentMaterials.forEach((mat) => {
      if (asset.key === 'robotExpressive') {
        mat.map = nextRobot.map;
        mat.normalMap = nextRobot.normalMap;
        mat.roughnessMap = nextRobot.roughnessMap;
        mat.color.set('#ffffff');
        mat.needsUpdate = true;
      } else if (asset.key === 'xbot') {
        mat.map = nextCloth.map;
        mat.normalMap = nextCloth.normalMap;
        mat.roughnessMap = nextCloth.roughnessMap;
        mat.color.set('#ffffff');
        mat.needsUpdate = true;
      } else {
        mat.color.set(hex);
      }
    });

    capeMaterials.forEach((mat) => {
      mat.map = nextCape.map;
      mat.normalMap = nextCape.normalMap;
      mat.roughnessMap = nextCape.roughnessMap;
      mat.color.set('#ffffff');
      mat.needsUpdate = true;
    });

    // Subtle tint on KayKit wardrobe when user changes swatch
    if (
      asset.key !== 'robotExpressive' &&
      asset.key !== 'xbot' &&
      asset.key !== 'michelle' &&
      !cfg.wardrobeTintHex
    ) {
      const tint = new THREE.Color(hex);
      baseMaterialColors.forEach((baseCol, mat) => {
        if (accentMaterials.includes(mat) || capeMaterials.includes(mat)) return;
        mat.color.copy(baseCol).lerp(tint, cfg.tintIntensity * 0.45);
      });
    }
  };

  return {
    kind,
    assetKey: asset.key,
    modelRoot: wrapper,
    mixer,
    actions,
    clipTrackBones,
    bones,
    restQuats,
    morphMeshes,
    accentMaterials,
    capeMaterials,
    leftHandMount,
    rightHandMount,
    leftWingPivot: spineAcc.leftWingPivot,
    rightWingPivot: spineAcc.rightWingPivot,
    weaponNodes,
    headHeight,
    isTintableAtlas: asset.key.startsWith('kaykit'),
    tintIntensity: cfg.tintIntensity,
    clothPattern: cfg.clothPattern,
    baseMaterialColors,
    applyAccentColor,
  };
}

/**
 * Selects the closest built-in skeletal AnimationClip name on the loaded GLTF model
 * for any of the 26 studio character activities.
 */
export function selectBestClipName(
  actions: Map<string, THREE.AnimationAction>,
  animation: AnimationState
): string | null {
  const names = Array.from(actions.keys());
  if (names.length === 0) return null;

  const pick = (candidates: string[]): string | null => {
    for (const c of candidates) {
      const exact = names.find((n) => n.toLowerCase() === c.toLowerCase());
      if (exact) return exact;
    }
    for (const c of candidates) {
      const partial = names.find((n) => n.toLowerCase().includes(c.toLowerCase()));
      if (partial) return partial;
    }
    return null;
  };

  switch (animation) {
    case 'Walk':
      return pick(['Walking_A', 'Walking', 'Walk', 'Walking_B', 'walk']);
    case 'Run':
    case 'Running & Chasing':
      return pick(['Running_A', 'Running', 'Run', 'Running_B', 'run']);
    case 'Dance':
      return pick(['SambaDance', 'Dance', 'Cheer', 'agree', 'Idle']);
    case 'Waving Hand (হাত নাড়ানো)':
    case 'Royal Wave':
      return pick(['Wave', 'Cheer', 'agree', 'Idle']);
    case 'Clapping (হাততালি)':
    case 'Laugh':
      return pick(['Cheer', 'ThumbsUp', 'Yes', 'agree', 'Idle']);
    case 'Jump':
      return pick(['Jump_Full_Short', 'Jump', 'WalkJump', 'Jump_Idle', 'Idle']);
    case 'Sit':
      return pick(['Sit_Chair_Idle', 'Sitting', 'Sit_Floor_Idle', 'sad_pose', 'Idle']);
    case 'Sleeping & Waking Up':
      return pick(['Lie_Idle', 'Sit_Floor_Idle', 'Death', 'sad_pose', 'Idle']);
    case 'Fighting':
      return pick(['Unarmed_Melee_Attack_Punch_A', 'Punch', '1H_Melee_Attack_Chop', 'sneak_pose', 'Idle']);
    case 'Playing Football':
      return pick(['Unarmed_Melee_Attack_Kick', 'Jump', 'Running_A', 'run', 'Idle']);
    case 'Playing Cricket':
      return pick(['1H_Melee_Attack_Slice_Horizontal', 'Throw', 'Punch', 'Idle']);
    case 'Farming/Digging':
      return pick(['1H_Melee_Attack_Chop', 'PickUp', 'Punch', 'Idle']);
    case 'Magic Spell Cast':
      return pick(['Spellcasting', 'Spellcast_Long', 'Wave', 'agree', 'Idle']);
    case 'Pointing / Beckoning (ইশারা)':
      return pick(['Throw', 'Interact', 'Yes', 'agree', 'Idle']);
    case 'Eat':
    case 'Medical Checkup':
    case 'Cooking/Stirring':
      return pick(['Use_Item', 'Interact', 'Idle', 'idle']);
    case 'Cry':
      return pick(['sad_pose', 'No', 'Hit_A', 'Idle', 'idle']);
    case 'Talk (Lip-Sync)':
      return pick(['Yes', 'agree', 'Idle', 'idle']);
    case 'Reading Books':
    case 'Using Mobile Phone':
    case 'Swimming':
    case 'Idle':
    default:
      return pick(['Idle', 'Unarmed_Idle', 'idle', 'Standing']);
  }
}

const _tmpEuler = new THREE.Euler();
const _tmpQuat = new THREE.Quaternion();

function mulBoneEuler(
  bone: THREE.Object3D | undefined,
  rx: number,
  ry: number,
  rz: number
): void {
  if (!bone || (rx === 0 && ry === 0 && rz === 0)) return;
  _tmpEuler.set(rx, ry, rz, 'XYZ');
  _tmpQuat.setFromEuler(_tmpEuler);
  bone.quaternion.multiply(_tmpQuat);
}

/**
 * Applies clean post-mixer bone expression, lip-sync head/mouth motion,
 * morph target facial expressions, and bespoke activity gestures when a clip doesn't cover them.
 */
export function applyPostMixerExpressionsAndGestures(
  mounted: MountedGLTFCharacter,
  activeClipName: string | null,
  animation: AnimationState,
  expression: FacialExpression,
  t: number,
  lipSyncLevel: number,
  autoLipSyncActive: boolean
): void {
  const { bones, morphMeshes, leftWingPivot, rightWingPivot, modelRoot } = mounted;

  // Facial morph targets (e.g., RobotExpressive Angry / Surprised / Sad)
  for (const mesh of morphMeshes) {
    const dict = mesh.morphTargetDictionary;
    const inf = mesh.morphTargetInfluences;
    if (!dict || !inf) continue;
    for (const key of Object.keys(dict)) {
      const idx = dict[key];
      const lower = key.toLowerCase();
      let target = 0;
      if (expression === 'Angry' && lower.includes('angry')) target = 0.85;
      if (expression === 'Surprised' && lower.includes('surpris')) target = 0.9;
      if (expression === 'Sad' && lower.includes('sad')) target = 0.85;
      inf[idx] = THREE.MathUtils.lerp(inf[idx], target, 0.25);
    }
  }

  // Head & neck expression / lip-sync motion
  let headRx = 0;
  let headRy = 0;
  let headRz = 0;

  if (expression === 'Sad') headRx += 0.16;
  if (expression === 'Angry') headRx -= 0.08;
  if (expression === 'Surprised') headRx -= 0.1;

  if (animation === 'Talk (Lip-Sync)' || autoLipSyncActive || lipSyncLevel > 0.05) {
    const amp =
      lipSyncLevel >= 0
        ? lipSyncLevel
        : Math.max(0, Math.sin(t * 12.5) * 0.55 + Math.sin(t * 19.2) * 0.45);
    headRx += Math.sin(t * 9.5) * 0.045 + amp * 0.08;
    headRy += Math.sin(t * 2.4) * 0.09;
  }

  // Activities where Mixamo/KayKit clips benefit from procedural limb layering
  const hasDedicatedClip =
    activeClipName !== null &&
    !/^(idle|unarmed_idle|standing)$/i.test(activeClipName);

  if (animation === 'Swimming') {
    modelRoot.position.y = 0.48 + Math.sin(t * 3.0) * 0.06;
    modelRoot.rotation.x = Math.PI / 2 - 0.14;
    modelRoot.rotation.z = Math.sin(t * 4.8) * 0.12;
    headRx -= 0.72;
    mulBoneEuler(bones.leftArm, -((t * 4.8) % (Math.PI * 2)), 0, 0.2);
    mulBoneEuler(bones.rightArm, -(((t * 4.8) + Math.PI) % (Math.PI * 2)), 0, -0.2);
  } else {
    modelRoot.position.y = 0;
    modelRoot.rotation.x = 0;
    modelRoot.rotation.z = 0;
  }

  if (animation === 'Clapping (হাততালি)') {
    const clap = Math.abs(Math.sin(t * 9.5));
    mulBoneEuler(bones.leftArm, -0.85, -0.25 + clap * 0.25, 0.2);
    mulBoneEuler(bones.rightArm, -0.85, 0.25 - clap * 0.25, -0.2);
    mulBoneEuler(bones.leftForearm, -0.7, 0, 0);
    mulBoneEuler(bones.rightForearm, -0.7, 0, 0);
  } else if (
    (animation === 'Waving Hand (হাত নাড়ানো)' || animation === 'Royal Wave') &&
    !hasDedicatedClip
  ) {
    mulBoneEuler(bones.rightArm, -0.25, 0, -1.95 + Math.sin(t * 6.5) * 0.35);
    mulBoneEuler(bones.rightForearm, -0.45, 0, Math.sin(t * 6.5) * 0.25);
  } else if (animation === 'Reading Books') {
    headRx += 0.25;
    mulBoneEuler(bones.leftArm, -0.62, -0.22, 0);
    mulBoneEuler(bones.rightArm, -0.62, 0.22, 0);
    mulBoneEuler(bones.leftForearm, -0.75, 0, 0);
    mulBoneEuler(bones.rightForearm, -0.75, 0, 0);
  } else if (animation === 'Using Mobile Phone') {
    headRx += 0.26;
    mulBoneEuler(bones.rightArm, -0.75, 0.2, 0);
    mulBoneEuler(bones.rightForearm, -0.95 + Math.sin(t * 7.0) * 0.04, 0, 0);
  } else if (animation === 'Laugh') {
    headRx -= 0.16 + Math.sin(t * 11.0) * 0.08;
    modelRoot.position.y = Math.abs(Math.sin(t * 11.0)) * 0.035;
  } else if (animation === 'Cry') {
    headRx += 0.22;
    headRz += Math.sin(t * 7.5) * 0.08;
  } else if (animation === 'Jump' && !hasDedicatedClip) {
    const air = Math.max(0, Math.sin(t * 3.8));
    modelRoot.position.y = air * 0.65;
  }

  // Reveal KayKit wand/weapon ONLY when casting magic or fighting/farming
  mounted.weaponNodes.forEach((wn) => {
    const n = (wn.name || '').toLowerCase();
    if (animation === 'Magic Spell Cast' && n.includes('wand')) {
      wn.visible = true;
    } else if (animation === 'Reading Books' && n.includes('spellbook')) {
      wn.visible = true;
    } else if (animation === 'Fighting' && (n.includes('1h_sword') || n.includes('1h_axe'))) {
      wn.visible = true;
    } else {
      wn.visible = false;
    }
  });

  mulBoneEuler(bones.head, headRx, headRy, headRz);

  if (leftWingPivot && rightWingPivot) {
    const flapSpeed =
      animation === 'Magic Spell Cast' || animation === 'Jump' ? 14.0 : 5.5;
    const flap = Math.sin(t * flapSpeed) * 0.28;
    leftWingPivot.rotation.y = -0.2 + flap;
    rightWingPivot.rotation.y = 0.2 - flap;
  }
}
