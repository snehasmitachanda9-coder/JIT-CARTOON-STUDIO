export type EnvironmentId =
  | 'village'
  | 'classroom'
  | 'park'
  | 'palace'
  | 'forest'
  | 'studio';

export type LightingMode = 'day' | 'sunset' | 'night';

export type BuiltInLibraryCategory =
  | 'characters'
  | 'animals'
  | 'vehicles'
  | 'props';

export type CharacterKind =
  | 'boy'
  | 'girl'
  | 'teenager'
  | 'woman'
  | 'twins'
  | 'father'
  | 'mother'
  | 'son'
  | 'daughter'
  | 'kid'
  | 'teacher'
  | 'farmer'
  | 'doctor'
  | 'police'
  | 'chef'
  | 'grandpa'
  | 'grandma'
  | 'king'
  | 'queen'
  | 'prince'
  | 'princess'
  | 'fairy'
  | 'angel'
  | 'witch'
  | 'wizard'
  | 'superhero'
  | 'robot';

export type AnimalKind =
  | 'dog'
  | 'cat'
  | 'rabbit'
  | 'monkey'
  | 'lion'
  | 'tiger'
  | 'elephant'
  | 'horse'
  | 'bird'
  | 'fish';

export type VehicleKind =
  | 'car'
  | 'schoolBus'
  | 'bike'
  | 'bicycle'
  | 'tractor'
  | 'helicopter'
  | 'airplane'
  | 'boat';

export type PropKind =
  | 'tree'
  | 'hut'
  | 'house'
  | 'desk'
  | 'fountain'
  | 'football'
  | 'cricketBatBall'
  | 'books'
  | 'woodenStick'
  | 'toyGun'
  | 'magicWand'
  | 'sword'
  | 'smartphone';

export type HandheldItemKind =
  | 'none'
  | 'book'
  | 'stick'
  | 'gun'
  | 'cricketBat'
  | 'football'
  | 'phone'
  | 'magicWand'
  | 'sword'
  | 'scepter'
  | 'bag'
  | 'umbrella'
  | 'customImage'
  | 'custom3D';

export interface HeldItemAttachment {
  itemKind: HandheldItemKind;
  label: string;
  imageDataUrl?: string;
  removeBg?: boolean;
  customBlueprint?: CustomModelBlueprint;
  scale: number; // 0.35..2.2
  rotationDeg: number; // -180..180
  offsetY: number; // -0.2..0.2
  offsetZ: number; // -0.2..0.2
}

export type AnimationState =
  // Human & Fantasy Activities
  | 'Idle'
  | 'Walk'
  | 'Run'
  | 'Running & Chasing'
  | 'Talk (Lip-Sync)'
  | 'Waving Hand (হাত নাড়ানো)'
  | 'Clapping (হাততালি)'
  | 'Pointing / Beckoning (ইশারা)'
  | 'Fighting'
  | 'Playing Football'
  | 'Playing Cricket'
  | 'Swimming'
  | 'Reading Books'
  | 'Using Mobile Phone'
  | 'Sleeping & Waking Up'
  | 'Sit'
  | 'Jump'
  | 'Dance'
  | 'Laugh'
  | 'Cry'
  | 'Eat'
  | 'Farming/Digging'
  | 'Medical Checkup'
  | 'Cooking/Stirring'
  | 'Magic Spell Cast'
  | 'Royal Wave'
  // Animal Activities
  | 'Run/Chase'
  | 'Jump/Hop'
  | 'Climb/Swing'
  | 'Bark/Roar/Chirp'
  | 'Wag Tail'
  | 'Swim'
  | 'Sleep & Wake Up'
  | 'Fly'
  // Vehicle Activities
  | 'Parked'
  | 'Drive/Ride Forward'
  | 'Honk/Lights Flash'
  | 'Rotor Spin & Hover'
  | 'Fly in Sky'
  | 'Sail on Water';

export type FacialExpression = 'Happy' | 'Sad' | 'Surprised' | 'Angry';

export type AspectRatioMode = '16:9' | '9:16' | '1:1';

export type CameraPresetId = 'wide' | 'closeup' | 'overShoulder' | 'top';

export type CameraZoomMode = 'none' | 'zoomIn' | 'zoomOut';

export type CustomPartGeometry = 'sphere' | 'box' | 'cylinder' | 'cone' | 'torus';

export type CustomPartRole =
  | 'torso'
  | 'head'
  | 'jaw'
  | 'leftArm'
  | 'rightArm'
  | 'leftLeg'
  | 'rightLeg'
  | 'wheel'
  | 'wing'
  | 'tail'
  | 'prop';

export interface CustomModelPart {
  name: string;
  geometry: CustomPartGeometry;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  role: CustomPartRole;
}

export interface CustomModelBlueprint {
  id: string;
  name: string;
  category: 'character' | 'creature' | 'vehicle' | 'prop';
  prompt: string;
  source: 'gemini' | 'offline';
  createdAt: number;
  parts: CustomModelPart[];
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

export interface WalkPath {
  enabled: boolean;
  start: [number, number];
  end: [number, number];
}

export interface SceneAudioTrack {
  url: string;
  name: string;
  durationSec?: number;
}

export type ActorType = 'character' | 'animal' | 'vehicle' | 'prop' | 'custom';

export interface SceneActor {
  id: string;
  actorType: ActorType;
  kind: string;
  customBlueprint?: CustomModelBlueprint;
  name: string;
  position: [number, number]; // [x, z]
  rotationY: number;
  scale: number;
  animation: AnimationState;
  expression: FacialExpression;
  dialogue: string;
  accentColor: string;
  walkPath?: WalkPath;
  audio?: SceneAudioTrack | null;
  heldItemLeft?: HeldItemAttachment | null;
  heldItemRight?: HeldItemAttachment | null;
  startTime?: number;
  endTime?: number;
  propStartTime?: number;
  propEndTime?: number;
  voiceStartTime?: number;
  voiceEndTime?: number;
}

export interface SceneData {
  id: string;
  title: string;
  environment: EnvironmentId;
  lighting: LightingMode;
  duration: number;
  cameraPose: CameraPose;
  cameraPreset?: CameraPresetId;
  cameraZoom: CameraZoomMode;
  cameraStartTime?: number;
  cameraEndTime?: number;
  actors: SceneActor[];
  audio: SceneAudioTrack | null;
}

export interface ExportProgress {
  active: boolean;
  progress: number;
  statusText: string;
  downloadUrl: string | null;
  fileName: string;
}

export const ENVIRONMENT_META: Record<
  EnvironmentId,
  { label: string; subtitle: string; defaultCamera: CameraPose }
> = {
  village: {
    label: 'Green Village',
    subtitle: 'River swim zone, bridge & cottages',
    defaultCamera: { position: [0, 2.0, 5.8], target: [0, 1.2, 0] },
  },
  classroom: {
    label: 'School Classroom',
    subtitle: 'Chalkboard, desks & windows',
    defaultCamera: { position: [0.15, 2.0, 5.6], target: [0, 1.2, -0.7] },
  },
  park: {
    label: 'City Park & Sports',
    subtitle: 'Fountain, sports pitch & skyline',
    defaultCamera: { position: [0.4, 2.0, 5.8], target: [0, 1.2, 0] },
  },
  palace: {
    label: 'Royal Palace Hall',
    subtitle: 'Throne, marble floor & golden pillars',
    defaultCamera: { position: [0, 2.05, 5.8], target: [0, 1.2, -0.4] },
  },
  forest: {
    label: 'Night Forest',
    subtitle: 'Campfire, pines & glowing flora',
    defaultCamera: { position: [-0.3, 2.0, 5.8], target: [0, 1.2, -0.2] },
  },
  studio: {
    label: 'Studio Stage',
    subtitle: 'Cyclorama, truss & spotlights',
    defaultCamera: { position: [0, 2.0, 5.7], target: [0, 1.2, 0] },
  },
};

export const CAMERA_PRESETS: Record<
  CameraPresetId,
  { label: string; pose: CameraPose }
> = {
  wide: {
    label: 'Wide Shot',
    pose: { position: [0, 2.0, 5.8], target: [0, 1.2, 0] },
  },
  closeup: {
    label: 'Close-Up',
    pose: { position: [0.2, 1.72, 3.2], target: [0, 1.32, 0] },
  },
  overShoulder: {
    label: 'Over-Shoulder',
    pose: { position: [-2.1, 2.0, 3.9], target: [0.7, 1.2, -0.3] },
  },
  top: {
    label: 'Top View',
    pose: { position: [0, 10.5, 2.3], target: [0, 0, 0] },
  },
};

export const CHARACTER_META: Record<
  CharacterKind,
  { label: string; tag: string; defaultColor: string; swatches: string[] }
> = {
  boy: { label: 'Boy', tag: 'Youth', defaultColor: '#3B82F6', swatches: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#6366F1'] },
  girl: { label: 'Girl', tag: 'Youth', defaultColor: '#EC4899', swatches: ['#EC4899', '#8B5CF6', '#F59E0B', '#14B8A6', '#EF4444'] },
  teenager: { label: 'Teenager', tag: 'Youth', defaultColor: '#6366F1', swatches: ['#6366F1', '#0EA5E9', '#EC4899', '#10B981', '#F97316'] },
  woman: { label: 'Woman', tag: 'Family', defaultColor: '#14B8A6', swatches: ['#14B8A6', '#EC4899', '#8B5CF6', '#F59E0B', '#3B82F6'] },
  twins: { label: 'Twins (Pair)', tag: 'Family', defaultColor: '#F59E0B', swatches: ['#F59E0B', '#3B82F6', '#EC4899', '#10B981', '#8B5CF6'] },
  father: { label: 'Father', tag: 'Family', defaultColor: '#2563EB', swatches: ['#2563EB', '#475569', '#059669', '#B45309', '#7C3AED'] },
  mother: { label: 'Mother', tag: 'Family', defaultColor: '#E11D48', swatches: ['#E11D48', '#EC4899', '#14B8A6', '#8B5CF6', '#D97706'] },
  son: { label: 'Son', tag: 'Family', defaultColor: '#0EA5E9', swatches: ['#0EA5E9', '#22C55E', '#EF4444', '#F59E0B', '#6366F1'] },
  daughter: { label: 'Daughter', tag: 'Family', defaultColor: '#F472B6', swatches: ['#F472B6', '#A855F7', '#F59E0B', '#14B8A6', '#EF4444'] },
  kid: { label: 'Kid', tag: 'Family', defaultColor: '#22C55E', swatches: ['#22C55E', '#F59E0B', '#3B82F6', '#EC4899', '#EF4444'] },
  teacher: { label: 'Teacher', tag: 'Role', defaultColor: '#0EA5E9', swatches: ['#0EA5E9', '#64748B', '#059669', '#D97706', '#7C3AED'] },
  farmer: { label: 'Farmer', tag: 'Role', defaultColor: '#16A34A', swatches: ['#16A34A', '#CA8A04', '#B45309', '#DC2626', '#0284C7'] },
  doctor: { label: 'Doctor', tag: 'Role', defaultColor: '#06B6D4', swatches: ['#06B6D4', '#3B82F6', '#10B981', '#6366F1', '#EC4899'] },
  police: { label: 'Police Officer', tag: 'Role', defaultColor: '#1D4ED8', swatches: ['#1D4ED8', '#1E293B', '#0369A1', '#0F172A', '#3B82F6'] },
  chef: { label: 'Chef', tag: 'Role', defaultColor: '#EF4444', swatches: ['#EF4444', '#F97316', '#3B82F6', '#10B981', '#8B5CF6'] },
  grandpa: { label: 'Grandpa', tag: 'Family', defaultColor: '#92400E', swatches: ['#92400E', '#64748B', '#0F766E', '#B45309', '#475569'] },
  grandma: { label: 'Grandma', tag: 'Family', defaultColor: '#A855F7', swatches: ['#A855F7', '#EC4899', '#14B8A6', '#D97706', '#64748B'] },
  king: { label: 'King', tag: 'Royal', defaultColor: '#DC2626', swatches: ['#DC2626', '#7C3AED', '#1D4ED8', '#B45309', '#059669'] },
  queen: { label: 'Queen', tag: 'Royal', defaultColor: '#9333EA', swatches: ['#9333EA', '#E11D48', '#2563EB', '#D97706', '#0D9488'] },
  prince: { label: 'Prince', tag: 'Royal', defaultColor: '#2563EB', swatches: ['#2563EB', '#DC2626', '#7C3AED', '#059669', '#D97706'] },
  princess: { label: 'Princess', tag: 'Royal', defaultColor: '#EC4899', swatches: ['#EC4899', '#A855F7', '#38BDF8', '#F59E0B', '#F43F5E'] },
  fairy: { label: 'Fairy', tag: 'Fantasy', defaultColor: '#F472B6', swatches: ['#F472B6', '#38BDF8', '#34D399', '#C084FC', '#FBBF24'] },
  angel: { label: 'Angel', tag: 'Fantasy', defaultColor: '#F8FAFC', swatches: ['#F8FAFC', '#BAE6FD', '#FEF08A', '#E9D5FF', '#FBCFE8'] },
  witch: { label: 'Witch', tag: 'Fantasy', defaultColor: '#7C3AED', swatches: ['#7C3AED', '#16A34A', '#DC2626', '#1E293B', '#DB2777'] },
  wizard: { label: 'Wizard', tag: 'Fantasy', defaultColor: '#4F46E5', swatches: ['#4F46E5', '#7C3AED', '#0284C7', '#B45309', '#059669'] },
  superhero: { label: 'Superhero', tag: 'Fantasy', defaultColor: '#EF4444', swatches: ['#EF4444', '#2563EB', '#10B981', '#F59E0B', '#7C3AED'] },
  robot: { label: 'Robot', tag: 'Sci-Fi', defaultColor: '#38BDF8', swatches: ['#38BDF8', '#F59E0B', '#10B981', '#F43F5E', '#A855F7'] },
};

export const ANIMAL_META: Record<
  AnimalKind,
  { label: string; defaultColor: string; swatches: string[] }
> = {
  dog: { label: 'Dog', defaultColor: '#D97706', swatches: ['#D97706', '#92400E', '#E5E7EB', '#475569', '#F59E0B'] },
  cat: { label: 'Cat', defaultColor: '#F59E0B', swatches: ['#F59E0B', '#E2E8F0', '#475569', '#EA580C', '#1E293B'] },
  rabbit: { label: 'Rabbit', defaultColor: '#F8FAFC', swatches: ['#F8FAFC', '#FBCFE8', '#CBD5E1', '#D6D3D1', '#FDE68A'] },
  monkey: { label: 'Monkey', defaultColor: '#92400E', swatches: ['#92400E', '#78350F', '#B45309', '#D97706', '#57534E'] },
  lion: { label: 'Lion', defaultColor: '#F59E0B', swatches: ['#F59E0B', '#D97706', '#EAB308', '#EA580C', '#FBBF24'] },
  tiger: { label: 'Tiger', defaultColor: '#F97316', swatches: ['#F97316', '#EA580C', '#F59E0B', '#E2E8F0', '#FBBF24'] },
  elephant: { label: 'Elephant', defaultColor: '#94A3B8', swatches: ['#94A3B8', '#64748B', '#CBD5E1', '#78716C', '#60A5FA'] },
  horse: { label: 'Horse', defaultColor: '#7C2D12', swatches: ['#7C2D12', '#F8FAFC', '#1E293B', '#B45309', '#92400E'] },
  bird: { label: 'Flying Bird', defaultColor: '#38BDF8', swatches: ['#38BDF8', '#EF4444', '#FACC15', '#22C55E', '#A855F7'] },
  fish: { label: 'Fish', defaultColor: '#F97316', swatches: ['#F97316', '#38BDF8', '#FACC15', '#EC4899', '#10B981'] },
};

export const VEHICLE_META: Record<
  VehicleKind,
  { label: string; defaultColor: string; swatches: string[] }
> = {
  car: { label: 'Car', defaultColor: '#EF4444', swatches: ['#EF4444', '#3B82F6', '#FACC15', '#10B981', '#F8FAFC'] },
  schoolBus: { label: 'School Bus', defaultColor: '#FACC15', swatches: ['#FACC15', '#F59E0B', '#F97316', '#3B82F6', '#EF4444'] },
  bike: { label: 'Motorbike', defaultColor: '#DC2626', swatches: ['#DC2626', '#1E293B', '#3B82F6', '#22C55E', '#F97316'] },
  bicycle: { label: 'Bicycle', defaultColor: '#38BDF8', swatches: ['#38BDF8', '#EC4899', '#22C55E', '#F59E0B', '#EF4444'] },
  tractor: { label: 'Tractor', defaultColor: '#16A34A', swatches: ['#16A34A', '#DC2626', '#2563EB', '#F59E0B', '#EA580C'] },
  helicopter: { label: 'Helicopter', defaultColor: '#0284C7', swatches: ['#0284C7', '#EF4444', '#16A34A', '#F59E0B', '#475569'] },
  airplane: { label: 'Airplane', defaultColor: '#F8FAFC', swatches: ['#F8FAFC', '#38BDF8', '#EF4444', '#F59E0B', '#6366F1'] },
  boat: { label: 'Boat', defaultColor: '#B45309', swatches: ['#B45309', '#F8FAFC', '#0EA5E9', '#EF4444', '#16A34A'] },
};

export const PROP_META: Record<PropKind, { label: string; defaultColor: string }> = {
  tree: { label: 'Trees', defaultColor: '#22C55E' },
  hut: { label: 'Village Hut', defaultColor: '#D97706' },
  house: { label: 'Modern House', defaultColor: '#E2E8F0' },
  desk: { label: 'School Desk & Chair', defaultColor: '#B45309' },
  fountain: { label: 'Water Fountain', defaultColor: '#38BDF8' },
  football: { label: 'Football', defaultColor: '#F8FAFC' },
  cricketBatBall: { label: 'Cricket Bat & Ball', defaultColor: '#D97706' },
  books: { label: 'Books', defaultColor: '#6366F1' },
  woodenStick: { label: 'Wooden Log / Stick', defaultColor: '#78350F' },
  toyGun: { label: 'Toy Gun', defaultColor: '#F97316' },
  magicWand: { label: 'Magic Wand', defaultColor: '#A855F7' },
  sword: { label: 'Sword', defaultColor: '#CBD5E1' },
  smartphone: { label: 'Smartphone', defaultColor: '#1E293B' },
};

export const HANDHELD_ITEM_META: Array<{ id: HandheldItemKind; label: string }> = [
  { id: 'none', label: 'Empty Hand' },
  { id: 'book', label: 'Book' },
  { id: 'stick', label: 'Wooden Stick' },
  { id: 'gun', label: 'Toy Gun' },
  { id: 'cricketBat', label: 'Cricket Bat' },
  { id: 'football', label: 'Football' },
  { id: 'phone', label: 'Mobile Phone' },
  { id: 'magicWand', label: 'Magic Wand' },
  { id: 'sword', label: 'Sword' },
  { id: 'scepter', label: 'Royal Scepter' },
  { id: 'bag', label: 'School Bag' },
  { id: 'umbrella', label: 'Umbrella' },
];

export const BASE_HUMAN_ACTIVITIES: AnimationState[] = [
  'Idle',
  'Walk',
  'Run',
  'Running & Chasing',
  'Talk (Lip-Sync)',
  'Waving Hand (হাত নাড়ানো)',
  'Clapping (হাততালি)',
  'Pointing / Beckoning (ইশারা)',
  'Fighting',
  'Playing Football',
  'Playing Cricket',
  'Swimming',
  'Reading Books',
  'Using Mobile Phone',
  'Sleeping & Waking Up',
  'Sit',
  'Jump',
  'Dance',
  'Laugh',
  'Cry',
  'Eat',
];

export function getActivitiesForModel(
  actorType: ActorType,
  kind: string
): AnimationState[] {
  if (actorType === 'character') {
    const list = [...BASE_HUMAN_ACTIVITIES];
    if (kind === 'farmer') list.push('Farming/Digging');
    if (kind === 'doctor') list.push('Medical Checkup');
    if (kind === 'chef') list.push('Cooking/Stirring');
    if (kind === 'fairy' || kind === 'witch' || kind === 'wizard' || kind === 'angel') {
      list.push('Magic Spell Cast');
    }
    if (kind === 'king' || kind === 'queen' || kind === 'prince' || kind === 'princess') {
      list.push('Royal Wave');
    }
    return list;
  }

  if (actorType === 'animal') {
    const list: AnimationState[] = [
      'Idle',
      'Walk',
      'Run/Chase',
      'Sit',
      'Bark/Roar/Chirp',
      'Wag Tail',
      'Swim',
      'Sleep & Wake Up',
    ];
    if (kind === 'rabbit') list.splice(3, 0, 'Jump/Hop');
    if (kind === 'monkey') list.splice(3, 0, 'Climb/Swing');
    if (kind === 'bird') list.splice(1, 0, 'Fly');
    return list;
  }

  if (actorType === 'vehicle') {
    if (kind === 'helicopter') {
      return ['Parked', 'Rotor Spin & Hover', 'Fly in Sky', 'Honk/Lights Flash'];
    }
    if (kind === 'airplane') {
      return ['Parked', 'Drive/Ride Forward', 'Fly in Sky', 'Honk/Lights Flash'];
    }
    if (kind === 'boat') {
      return ['Parked', 'Sail on Water', 'Honk/Lights Flash'];
    }
    return ['Parked', 'Drive/Ride Forward', 'Honk/Lights Flash'];
  }

  if (actorType === 'custom') {
    return [
      'Idle',
      'Walk',
      'Run',
      'Talk (Lip-Sync)',
      'Waving Hand (হাত নাড়ানো)',
      'Jump',
      'Dance',
      'Sit',
      'Drive/Ride Forward',
      'Fly in Sky',
    ];
  }

  // Prop
  return ['Idle', 'Jump', 'Dance'];
}

export const FACIAL_EXPRESSIONS: FacialExpression[] = [
  'Happy',
  'Sad',
  'Surprised',
  'Angry',
];

export const CUSTOM_MODEL_RETENTION_DAYS = 60;
export const CUSTOM_MODEL_RETENTION_MS = CUSTOM_MODEL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
