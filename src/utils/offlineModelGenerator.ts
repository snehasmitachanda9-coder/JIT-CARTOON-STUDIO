import { CustomModelBlueprint, CustomModelPart } from '../types/studio';

function extractColorFromPrompt(prompt: string, fallback: string): string {
  const lower = prompt.toLowerCase();
  const map: Array<[string, string]> = [
    ['red', '#EF4444'],
    ['crimson', '#DC2626'],
    ['blue', '#3B82F6'],
    ['sky', '#38BDF8'],
    ['green', '#22C55E'],
    ['emerald', '#10B981'],
    ['yellow', '#FACC15'],
    ['gold', '#F59E0B'],
    ['orange', '#F97316'],
    ['purple', '#A855F7'],
    ['pink', '#EC4899'],
    ['black', '#1E293B'],
    ['white', '#F1F5F9'],
    ['silver', '#94A3B8'],
  ];
  for (const [word, hex] of map) {
    if (lower.includes(word)) return hex;
  }
  return fallback;
}

export function generateOfflineProceduralModel(prompt: string): CustomModelBlueprint {
  const lower = prompt.toLowerCase();
  const id = `custom-${Date.now()}`;
  const mainColor = extractColorFromPrompt(prompt, '#3B82F6');

  // 1. School Bus / Car / Vehicle / Cart
  if (
    lower.includes('bus') ||
    lower.includes('car') ||
    lower.includes('truck') ||
    lower.includes('cart') ||
    lower.includes('train')
  ) {
    const isBus = lower.includes('bus');
    const isCart = lower.includes('cart');
    const bodyColor = isBus ? '#FACC15' : isCart ? '#F97316' : mainColor;
    const parts: CustomModelPart[] = [
      {
        name: 'Chassis',
        geometry: 'box',
        position: [0, 0.58, 0],
        rotation: [0, 0, 0],
        scale: [1.15, isBus ? 0.88 : 0.56, isBus ? 2.5 : 1.9],
        color: bodyColor,
        roughness: 0.35,
        metalness: 0.2,
        role: 'torso',
      },
      {
        name: 'Cabin Roof',
        geometry: 'box',
        position: [0, isBus ? 1.1 : 0.98, isCart ? 0 : -0.1],
        rotation: [0, 0, 0],
        scale: [1.05, isCart ? 0.12 : 0.42, isBus ? 2.2 : 1.1],
        color: isCart ? '#EF4444' : '#F8FAFC',
        roughness: 0.4,
        metalness: 0.1,
        role: 'prop',
      },
      {
        name: 'Windshield',
        geometry: 'box',
        position: [0, isBus ? 0.96 : 0.92, isBus ? 1.15 : 0.48],
        rotation: [0.2, 0, 0],
        scale: [0.96, 0.36, 0.12],
        color: '#38BDF8',
        roughness: 0.15,
        metalness: 0.3,
        role: 'prop',
      },
      {
        name: 'Headlight L',
        geometry: 'cylinder',
        position: [-0.36, 0.52, isBus ? 1.26 : 0.96],
        rotation: [Math.PI / 2, 0, 0],
        scale: [0.16, 0.08, 0.16],
        color: '#FEF08A',
        roughness: 0.2,
        role: 'prop',
      },
      {
        name: 'Headlight R',
        geometry: 'cylinder',
        position: [0.36, 0.52, isBus ? 1.26 : 0.96],
        rotation: [Math.PI / 2, 0, 0],
        scale: [0.16, 0.08, 0.16],
        color: '#FEF08A',
        roughness: 0.2,
        role: 'prop',
      },
      {
        name: 'Wheel FL',
        geometry: 'cylinder',
        position: [-0.62, 0.24, 0.72],
        rotation: [0, 0, Math.PI / 2],
        scale: [0.48, 0.16, 0.48],
        color: '#1E293B',
        roughness: 0.85,
        role: 'wheel',
      },
      {
        name: 'Wheel FR',
        geometry: 'cylinder',
        position: [0.62, 0.24, 0.72],
        rotation: [0, 0, Math.PI / 2],
        scale: [0.48, 0.16, 0.48],
        color: '#1E293B',
        roughness: 0.85,
        role: 'wheel',
      },
      {
        name: 'Wheel BL',
        geometry: 'cylinder',
        position: [-0.62, 0.24, -0.72],
        rotation: [0, 0, Math.PI / 2],
        scale: [0.48, 0.16, 0.48],
        color: '#1E293B',
        roughness: 0.85,
        role: 'wheel',
      },
      {
        name: 'Wheel BR',
        geometry: 'cylinder',
        position: [0.62, 0.24, -0.72],
        rotation: [0, 0, Math.PI / 2],
        scale: [0.48, 0.16, 0.48],
        color: '#1E293B',
        roughness: 0.85,
        role: 'wheel',
      },
    ];
    return {
      id,
      name: prompt.slice(0, 26) || 'Custom Vehicle',
      category: 'vehicle',
      prompt,
      source: 'offline',
      createdAt: Date.now(),
      parts,
    };
  }

  // 2. Dinosaur / Dragon / Creature / Monster
  if (
    lower.includes('dino') ||
    lower.includes('dragon') ||
    lower.includes('monster') ||
    lower.includes('bird') ||
    lower.includes('lion')
  ) {
    const bodyCol = extractColorFromPrompt(prompt, '#22C55E');
    const hasWings = lower.includes('dragon') || lower.includes('bird');
    const parts: CustomModelPart[] = [
      {
        name: 'Body',
        geometry: 'sphere',
        position: [0, 0.75, 0],
        rotation: [0, 0, 0],
        scale: [0.64, 0.72, 0.92],
        color: bodyCol,
        roughness: 0.75,
        role: 'torso',
      },
      {
        name: 'Belly',
        geometry: 'sphere',
        position: [0, 0.72, 0.16],
        rotation: [0, 0, 0],
        scale: [0.45, 0.56, 0.65],
        color: '#FEF08A',
        roughness: 0.8,
        role: 'torso',
      },
      {
        name: 'Neck',
        geometry: 'cylinder',
        position: [0, 1.18, 0.28],
        rotation: [0.35, 0, 0],
        scale: [0.24, 0.45, 0.24],
        color: bodyCol,
        roughness: 0.75,
        role: 'head',
      },
      {
        name: 'Head',
        geometry: 'box',
        position: [0, 1.44, 0.42],
        rotation: [0, 0, 0],
        scale: [0.44, 0.36, 0.56],
        color: bodyCol,
        roughness: 0.7,
        role: 'head',
      },
      {
        name: 'Jaw',
        geometry: 'box',
        position: [0, 1.24, 0.52],
        rotation: [0, 0, 0],
        scale: [0.32, 0.12, 0.38],
        color: '#F43F5E',
        roughness: 0.5,
        role: 'jaw',
      },
      {
        name: 'Eye L',
        geometry: 'sphere',
        position: [-0.14, 1.52, 0.65],
        rotation: [0, 0, 0],
        scale: [0.09, 0.09, 0.09],
        color: '#FFFFFF',
        roughness: 0.2,
        role: 'head',
      },
      {
        name: 'Eye R',
        geometry: 'sphere',
        position: [0.14, 1.52, 0.65],
        rotation: [0, 0, 0],
        scale: [0.09, 0.09, 0.09],
        color: '#FFFFFF',
        roughness: 0.2,
        role: 'head',
      },
      {
        name: 'Tail',
        geometry: 'cone',
        position: [0, 0.62, -0.75],
        rotation: [-Math.PI / 2.2, 0, 0],
        scale: [0.32, 0.85, 0.32],
        color: bodyCol,
        roughness: 0.75,
        role: 'tail',
      },
      {
        name: 'Leg L',
        geometry: 'cylinder',
        position: [-0.24, 0.26, 0.04],
        rotation: [0, 0, 0],
        scale: [0.22, 0.52, 0.24],
        color: bodyCol,
        roughness: 0.8,
        role: 'leftLeg',
      },
      {
        name: 'Leg R',
        geometry: 'cylinder',
        position: [0.24, 0.26, 0.04],
        rotation: [0, 0, 0],
        scale: [0.22, 0.52, 0.24],
        color: bodyCol,
        roughness: 0.8,
        role: 'rightLeg',
      },
      {
        name: 'Arm L',
        geometry: 'cylinder',
        position: [-0.34, 0.88, 0.28],
        rotation: [0.6, 0, 0.3],
        scale: [0.1, 0.28, 0.1],
        color: bodyCol,
        roughness: 0.75,
        role: 'leftArm',
      },
      {
        name: 'Arm R',
        geometry: 'cylinder',
        position: [0.34, 0.88, 0.28],
        rotation: [0.6, 0, -0.3],
        scale: [0.1, 0.28, 0.1],
        color: bodyCol,
        roughness: 0.75,
        role: 'rightArm',
      },
    ];
    if (hasWings) {
      parts.push(
        {
          name: 'Wing L',
          geometry: 'box',
          position: [-0.58, 1.05, -0.05],
          rotation: [0, 0, 0.45],
          scale: [0.75, 0.06, 0.42],
          color: '#F59E0B',
          roughness: 0.5,
          role: 'wing',
        },
        {
          name: 'Wing R',
          geometry: 'box',
          position: [0.58, 1.05, -0.05],
          rotation: [0, 0, -0.45],
          scale: [0.75, 0.06, 0.42],
          color: '#F59E0B',
          roughness: 0.5,
          role: 'wing',
        }
      );
    }
    return {
      id,
      name: prompt.slice(0, 26) || 'Custom Creature',
      category: 'creature',
      prompt,
      source: 'offline',
      createdAt: Date.now(),
      parts,
    };
  }

  // 3. Default Humanoid Character (Superhero / Astronaut / Wizard / Boy / Girl)
  const hasCape = lower.includes('cape') || lower.includes('hero') || lower.includes('super');
  const capeColor = lower.includes('red') ? '#EF4444' : '#DC2626';
  const parts: CustomModelPart[] = [
    {
      name: 'Torso',
      geometry: 'box',
      position: [0, 0.92, 0],
      rotation: [0, 0, 0],
      scale: [0.44, 0.56, 0.26],
      color: mainColor,
      roughness: 0.65,
      role: 'torso',
    },
    {
      name: 'Chest Emblem',
      geometry: 'cylinder',
      position: [0, 0.98, 0.14],
      rotation: [Math.PI / 2, 0, 0],
      scale: [0.16, 0.05, 0.16],
      color: '#FACC15',
      roughness: 0.3,
      metalness: 0.4,
      role: 'torso',
    },
    {
      name: 'Head',
      geometry: 'sphere',
      position: [0, 1.48, 0],
      rotation: [0, 0, 0],
      scale: [0.48, 0.5, 0.46],
      color: '#FAD2B8',
      roughness: 0.7,
      role: 'head',
    },
    {
      name: 'Hair / Mask',
      geometry: 'sphere',
      position: [0, 1.6, -0.02],
      rotation: [0, 0, 0],
      scale: [0.5, 0.32, 0.48],
      color: '#1E293B',
      roughness: 0.6,
      role: 'head',
    },
    {
      name: 'Jaw / Mouth',
      geometry: 'box',
      position: [0, 1.35, 0.22],
      rotation: [0, 0, 0],
      scale: [0.14, 0.05, 0.06],
      color: '#991B1B',
      roughness: 0.4,
      role: 'jaw',
    },
    {
      name: 'Arm L',
      geometry: 'cylinder',
      position: [-0.3, 0.9, 0],
      rotation: [0, 0, 0.18],
      scale: [0.13, 0.52, 0.13],
      color: mainColor,
      roughness: 0.65,
      role: 'leftArm',
    },
    {
      name: 'Arm R',
      geometry: 'cylinder',
      position: [0.3, 0.9, 0],
      rotation: [0, 0, -0.18],
      scale: [0.13, 0.52, 0.13],
      color: mainColor,
      roughness: 0.65,
      role: 'rightArm',
    },
    {
      name: 'Leg L',
      geometry: 'cylinder',
      position: [-0.12, 0.32, 0],
      rotation: [0, 0, 0],
      scale: [0.15, 0.62, 0.15],
      color: '#1E293B',
      roughness: 0.75,
      role: 'leftLeg',
    },
    {
      name: 'Leg R',
      geometry: 'cylinder',
      position: [0.12, 0.32, 0],
      rotation: [0, 0, 0],
      scale: [0.15, 0.62, 0.15],
      color: '#1E293B',
      roughness: 0.75,
      role: 'rightLeg',
    },
  ];

  if (hasCape) {
    parts.push({
      name: 'Cape',
      geometry: 'box',
      position: [0, 0.82, -0.2],
      rotation: [0.18, 0, 0],
      scale: [0.56, 0.78, 0.05],
      color: capeColor,
      roughness: 0.75,
      role: 'torso',
    });
  }

  return {
    id,
    name: prompt.slice(0, 26) || 'Custom Hero',
    category: 'character',
    prompt,
    source: 'offline',
    createdAt: Date.now(),
    parts,
  };
}
