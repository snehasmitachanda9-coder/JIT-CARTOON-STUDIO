import {
  CustomModelBlueprint,
  CustomModelPart,
  CustomModelStyleSpec,
  HairStyleKind,
  HeadwearKind,
  OutfitStyleKind,
} from '../types/studio';

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

  // 1. Vehicles (Car / Bus / Truck / Cart / Helicopter / Airplane / Boat / Bike / Tractor)
  if (
    /\b(bus|car|police|truck|cart|train|taxi|van|tractor|helicopter|chopper|plane|airplane|jet|boat|ship|bike|bicycle|motorcycle|scooter|vehicle)\b/.test(
      lower
    )
  ) {
    const isBus = lower.includes('bus');
    const isCart = lower.includes('cart');
    const isPolice = lower.includes('police');
    const isHeli = lower.includes('helicopter') || lower.includes('chopper');
    const isPlane = lower.includes('plane') || lower.includes('jet');
    const isBoat = lower.includes('boat') || lower.includes('ship');
    const isTractor = lower.includes('tractor');
    const isBike = lower.includes('bike') || lower.includes('motorcycle') || lower.includes('scooter');
    const isBicycle = lower.includes('bicycle');

    const archetype = isBus
      ? 'schoolBus'
      : isPolice
        ? 'policeCar'
        : isCart
          ? 'iceCreamCart'
          : isHeli
            ? 'helicopter'
            : isPlane
              ? 'airplane'
              : isBoat
                ? 'boat'
                : isTractor
                  ? 'tractor'
                  : isBicycle
                    ? 'bicycle'
                    : isBike
                      ? 'bike'
                      : 'car';

    const bodyColor = isBus
      ? '#FACC15'
      : isPolice
        ? '#1D4ED8'
        : isCart
          ? '#F97316'
          : mainColor;

    const style: CustomModelStyleSpec = {
      entityType: 'vehicle',
      archetype,
      primaryColor: bodyColor,
      secondaryColor: '#F8FAFC',
      accentColor: '#FACC15',
      accessories: [],
    };

    const parts: CustomModelPart[] = [
      {
        name: 'Chassis',
        geometry: 'sphere',
        position: [0, 0.58, 0],
        rotation: [0, 0, 0],
        scale: [1.15, isBus ? 0.88 : 0.56, isBus ? 2.5 : 1.9],
        color: bodyColor,
        roughness: 0.25,
        metalness: 0.2,
        role: 'torso',
      },
      {
        name: 'Cabin Dome',
        geometry: 'sphere',
        position: [0, isBus ? 1.05 : 0.94, isCart ? 0 : -0.1],
        rotation: [0, 0, 0],
        scale: [0.98, isCart ? 0.14 : 0.42, isBus ? 2.1 : 1.05],
        color: isCart ? '#EF4444' : '#BAE6FD',
        roughness: 0.12,
        metalness: 0.2,
        role: 'prop',
      },
      {
        name: 'Headlight L',
        geometry: 'cylinder',
        position: [-0.36, 0.52, isBus ? 1.26 : 0.96],
        rotation: [Math.PI / 2, 0, 0],
        scale: [0.16, 0.08, 0.16],
        color: '#FEF08A',
        roughness: 0.18,
        role: 'prop',
      },
      {
        name: 'Headlight R',
        geometry: 'cylinder',
        position: [0.36, 0.52, isBus ? 1.26 : 0.96],
        rotation: [Math.PI / 2, 0, 0],
        scale: [0.16, 0.08, 0.16],
        color: '#FEF08A',
        roughness: 0.18,
        role: 'prop',
      },
      {
        name: 'Wheel FL',
        geometry: 'torus',
        position: [-0.62, 0.24, 0.72],
        rotation: [0, Math.PI / 2, 0],
        scale: [0.48, 0.48, 0.36],
        color: '#1E293B',
        roughness: 0.8,
        role: 'wheel',
      },
      {
        name: 'Wheel FR',
        geometry: 'torus',
        position: [0.62, 0.24, 0.72],
        rotation: [0, Math.PI / 2, 0],
        scale: [0.48, 0.48, 0.36],
        color: '#1E293B',
        roughness: 0.8,
        role: 'wheel',
      },
      {
        name: 'Wheel BL',
        geometry: 'torus',
        position: [-0.62, 0.24, -0.72],
        rotation: [0, Math.PI / 2, 0],
        scale: [0.48, 0.48, 0.36],
        color: '#1E293B',
        roughness: 0.8,
        role: 'wheel',
      },
      {
        name: 'Wheel BR',
        geometry: 'torus',
        position: [0.62, 0.24, -0.72],
        rotation: [0, Math.PI / 2, 0],
        scale: [0.48, 0.48, 0.36],
        color: '#1E293B',
        roughness: 0.8,
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
      style,
      parts,
    };
  }

  // 2. Dinosaur / Dragon / Creature / Animals
  if (
    /\b(dino|dinosaur|dragon|monster|bird|eagle|owl|lion|tiger|cat|kitty|dog|puppy|rabbit|bunny|elephant|horse|unicorn|bear|fox|wolf|animal|creature)\b/.test(
      lower
    )
  ) {
    const bodyCol = extractColorFromPrompt(prompt, lower.includes('lion') ? '#F59E0B' : '#22C55E');
    const hasWings =
      lower.includes('dragon') || lower.includes('bird') || lower.includes('owl') || lower.includes('wing');
    const archetype = lower.includes('dragon')
      ? 'dragon'
      : lower.includes('dino')
        ? 'dino'
        : lower.includes('rabbit') || lower.includes('bunny')
          ? 'rabbit'
          : lower.includes('elephant')
            ? 'elephant'
            : lower.includes('lion')
              ? 'lion'
              : lower.includes('bird')
                ? 'bird'
                : 'creature';

    const style: CustomModelStyleSpec = {
      entityType: 'animal',
      archetype,
      primaryColor: bodyCol,
      secondaryColor: '#FEF08A',
      accentColor: '#F97316',
      eyeColor: '#D97706',
      accessories: hasWings ? ['wings', 'horns'] : [],
    };

    const parts: CustomModelPart[] = [
      {
        name: 'Body',
        geometry: 'sphere',
        position: [0, 0.75, 0],
        rotation: [0, 0, 0],
        scale: [0.64, 0.72, 0.92],
        color: bodyCol,
        roughness: 0.42,
        role: 'torso',
      },
      {
        name: 'Belly',
        geometry: 'sphere',
        position: [0, 0.72, 0.16],
        rotation: [0, 0, 0],
        scale: [0.45, 0.56, 0.65],
        color: '#FEF08A',
        roughness: 0.48,
        role: 'torso',
      },
      {
        name: 'Head',
        geometry: 'sphere',
        position: [0, 1.44, 0.42],
        rotation: [0, 0, 0],
        scale: [0.48, 0.44, 0.52],
        color: bodyCol,
        roughness: 0.42,
        role: 'head',
      },
      {
        name: 'Snout',
        geometry: 'sphere',
        position: [0, 1.36, 0.64],
        rotation: [0, 0, 0],
        scale: [0.28, 0.2, 0.28],
        color: '#FEF08A',
        roughness: 0.45,
        role: 'head',
      },
      {
        name: 'Jaw',
        geometry: 'sphere',
        position: [0, 1.24, 0.56],
        rotation: [0, 0, 0],
        scale: [0.24, 0.1, 0.26],
        color: '#F43F5E',
        roughness: 0.35,
        role: 'jaw',
      },
      {
        name: 'Tail',
        geometry: 'cone',
        position: [0, 0.62, -0.75],
        rotation: [-Math.PI / 2.2, 0, 0],
        scale: [0.32, 0.85, 0.32],
        color: bodyCol,
        roughness: 0.45,
        role: 'tail',
      },
      {
        name: 'Leg L',
        geometry: 'cylinder',
        position: [-0.24, 0.26, 0.04],
        rotation: [0, 0, 0],
        scale: [0.2, 0.52, 0.2],
        color: bodyCol,
        roughness: 0.45,
        role: 'leftLeg',
      },
      {
        name: 'Leg R',
        geometry: 'cylinder',
        position: [0.24, 0.26, 0.04],
        rotation: [0, 0, 0],
        scale: [0.2, 0.52, 0.2],
        color: bodyCol,
        roughness: 0.45,
        role: 'rightLeg',
      },
      {
        name: 'Arm L',
        geometry: 'cylinder',
        position: [-0.34, 0.88, 0.28],
        rotation: [0.6, 0, 0.3],
        scale: [0.12, 0.28, 0.12],
        color: bodyCol,
        roughness: 0.45,
        role: 'leftArm',
      },
      {
        name: 'Arm R',
        geometry: 'cylinder',
        position: [0.34, 0.88, 0.28],
        rotation: [0.6, 0, -0.3],
        scale: [0.12, 0.28, 0.12],
        color: bodyCol,
        roughness: 0.45,
        role: 'rightArm',
      },
    ];
    if (hasWings) {
      parts.push(
        {
          name: 'Wing L',
          geometry: 'sphere',
          position: [-0.58, 1.05, -0.05],
          rotation: [0, 0, 0.45],
          scale: [0.75, 0.08, 0.42],
          color: '#F59E0B',
          roughness: 0.35,
          role: 'wing',
        },
        {
          name: 'Wing R',
          geometry: 'sphere',
          position: [0.58, 1.05, -0.05],
          rotation: [0, 0, -0.45],
          scale: [0.75, 0.08, 0.42],
          color: '#F59E0B',
          roughness: 0.35,
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
      style,
      parts,
    };
  }

  // 3. Props / Objects (Castles, Rockets, Swords, Chests, Crowns, Trees, Houses, etc.)
  if (
    /\b(castle|tower|rocket|spaceship|sword|axe|shield|chest|treasure|crown|tree|flower|house|hut|chair|table|book|lamp|trophy|guitar|ball)\b/.test(
      lower
    ) &&
    !/\b(boy|girl|kid|man|woman|hero|wizard|witch|king|queen|princess|prince|knight|astronaut|pirate|robot|angel|fairy)\b/.test(
      lower
    )
  ) {
    const isRocket = lower.includes('rocket') || lower.includes('spaceship');
    const isSword = lower.includes('sword');
    const isCastle = lower.includes('castle') || lower.includes('tower');
    const parts: CustomModelPart[] = isRocket
      ? [
          {
            name: 'Rocket Hull',
            geometry: 'cylinder',
            position: [0, 0.85, 0],
            rotation: [0, 0, 0],
            scale: [0.52, 1.15, 0.52],
            color: '#F8FAFC',
            roughness: 0.2,
            metalness: 0.25,
            role: 'torso',
          },
          {
            name: 'Nose Cone',
            geometry: 'cone',
            position: [0, 1.65, 0],
            rotation: [0, 0, 0],
            scale: [0.52, 0.52, 0.52],
            color: mainColor,
            roughness: 0.22,
            role: 'head',
          },
          {
            name: 'Window',
            geometry: 'sphere',
            position: [0, 1.0, 0.25],
            rotation: [0, 0, 0],
            scale: [0.24, 0.24, 0.12],
            color: '#38BDF8',
            roughness: 0.1,
            metalness: 0.3,
            role: 'prop',
          },
          {
            name: 'Fin L',
            geometry: 'cone',
            position: [-0.35, 0.34, 0],
            rotation: [0, 0, 0.4],
            scale: [0.22, 0.55, 0.12],
            color: mainColor,
            roughness: 0.25,
            role: 'wing',
          },
          {
            name: 'Fin R',
            geometry: 'cone',
            position: [0.35, 0.34, 0],
            rotation: [0, 0, -0.4],
            scale: [0.22, 0.55, 0.12],
            color: mainColor,
            roughness: 0.25,
            role: 'wing',
          },
          {
            name: 'Thruster',
            geometry: 'cone',
            position: [0, 0.16, 0],
            rotation: [Math.PI, 0, 0],
            scale: [0.34, 0.32, 0.34],
            color: '#F97316',
            roughness: 0.3,
            role: 'prop',
          },
        ]
      : isSword
        ? [
            {
              name: 'Grip',
              geometry: 'cylinder',
              position: [0, 0.22, 0],
              rotation: [0, 0, 0],
              scale: [0.1, 0.36, 0.1],
              color: '#78350F',
              roughness: 0.55,
              role: 'prop',
            },
            {
              name: 'Pommel',
              geometry: 'sphere',
              position: [0, 0.05, 0],
              rotation: [0, 0, 0],
              scale: [0.14, 0.14, 0.14],
              color: '#FACC15',
              roughness: 0.2,
              metalness: 0.85,
              role: 'prop',
            },
            {
              name: 'Crossguard',
              geometry: 'cylinder',
              position: [0, 0.42, 0],
              rotation: [0, 0, Math.PI / 2],
              scale: [0.09, 0.48, 0.09],
              color: '#FACC15',
              roughness: 0.2,
              metalness: 0.85,
              role: 'prop',
            },
            {
              name: 'Blade',
              geometry: 'cone',
              position: [0, 1.05, 0],
              rotation: [0, 0, 0],
              scale: [0.18, 1.25, 0.06],
              color: mainColor === '#3B82F6' ? '#E2E8F0' : mainColor,
              roughness: 0.18,
              metalness: 0.82,
              role: 'torso',
            },
          ]
        : isCastle
          ? [
              {
                name: 'Keep',
                geometry: 'cylinder',
                position: [0, 0.65, 0],
                rotation: [0, 0, 0],
                scale: [1.1, 1.3, 1.1],
                color: '#CBD5E1',
                roughness: 0.6,
                role: 'torso',
              },
              {
                name: 'Turret L',
                geometry: 'cylinder',
                position: [-0.62, 0.78, 0.38],
                rotation: [0, 0, 0],
                scale: [0.36, 1.56, 0.36],
                color: '#E2E8F0',
                roughness: 0.6,
                role: 'prop',
              },
              {
                name: 'Turret R',
                geometry: 'cylinder',
                position: [0.62, 0.78, 0.38],
                rotation: [0, 0, 0],
                scale: [0.36, 1.56, 0.36],
                color: '#E2E8F0',
                roughness: 0.6,
                role: 'prop',
              },
              {
                name: 'Spire Main',
                geometry: 'cone',
                position: [0, 1.58, 0],
                rotation: [0, 0, 0],
                scale: [0.85, 0.68, 0.85],
                color: mainColor,
                roughness: 0.35,
                role: 'prop',
              },
              {
                name: 'Spire L',
                geometry: 'cone',
                position: [-0.62, 1.72, 0.38],
                rotation: [0, 0, 0],
                scale: [0.46, 0.44, 0.46],
                color: mainColor,
                roughness: 0.35,
                role: 'prop',
              },
              {
                name: 'Spire R',
                geometry: 'cone',
                position: [0.62, 1.72, 0.38],
                rotation: [0, 0, 0],
                scale: [0.46, 0.44, 0.46],
                color: mainColor,
                roughness: 0.35,
                role: 'prop',
              },
              {
                name: 'Gate',
                geometry: 'cylinder',
                position: [0, 0.32, 0.56],
                rotation: [0, 0, 0],
                scale: [0.38, 0.64, 0.14],
                color: '#78350F',
                roughness: 0.65,
                role: 'prop',
              },
            ]
          : [
              {
                name: 'Base',
                geometry: 'cylinder',
                position: [0, 0.14, 0],
                rotation: [0, 0, 0],
                scale: [0.75, 0.28, 0.75],
                color: '#64748B',
                roughness: 0.45,
                role: 'prop',
              },
              {
                name: 'Core',
                geometry: 'sphere',
                position: [0, 0.62, 0],
                rotation: [0, 0, 0],
                scale: [0.68, 0.68, 0.68],
                color: mainColor,
                roughness: 0.35,
                role: 'torso',
              },
              {
                name: 'Halo Accent',
                geometry: 'torus',
                position: [0, 0.62, 0],
                rotation: [0.4, 0.3, 0],
                scale: [0.95, 0.95, 0.95],
                color: '#FACC15',
                roughness: 0.22,
                metalness: 0.6,
                role: 'prop',
              },
              {
                name: 'Crown Top',
                geometry: 'cone',
                position: [0, 1.12, 0],
                rotation: [0, 0, 0],
                scale: [0.36, 0.42, 0.36],
                color: '#FACC15',
                roughness: 0.25,
                metalness: 0.7,
                role: 'head',
              },
            ];

    return {
      id,
      name: prompt.slice(0, 26) || 'Custom Object',
      category: 'prop',
      prompt,
      source: 'offline',
      createdAt: Date.now(),
      style: {
        entityType: 'prop',
        archetype: isRocket ? 'rocket' : isSword ? 'sword' : isCastle ? 'castle' : 'prop',
        primaryColor: mainColor,
        secondaryColor: '#F8FAFC',
        accentColor: '#FACC15',
        accessories: [],
      },
      parts,
    };
  }

  // 4. Default High-Detail Humanoid Character (Superhero / Wizard / Girl / Boy / Robot / Knight / Astronaut)
  const isRobot = /\b(robot|bot|mech|cyborg|android)\b/.test(lower);
  const isFem = /\b(girl|woman|queen|princess|fairy|witch|lady|she|daughter|mother)\b/.test(lower);
  const hasCape =
    lower.includes('cape') ||
    lower.includes('hero') ||
    lower.includes('super') ||
    lower.includes('king') ||
    lower.includes('queen') ||
    lower.includes('wizard');
  const capeColor = lower.includes('red') ? '#EF4444' : '#DC2626';

  let hairStyle: HairStyleKind = isFem ? 'ponytail' : 'short';
  if (lower.includes('spiky') || lower.includes('hero') || lower.includes('ninja')) hairStyle = 'spiky';
  else if (lower.includes('curly')) hairStyle = 'curly';
  else if (lower.includes('bun')) hairStyle = 'bun';
  else if (lower.includes('long') || lower.includes('princess') || lower.includes('queen') || lower.includes('fairy')) {
    hairStyle = 'long';
  }

  let headwear: HeadwearKind = 'none';
  if (lower.includes('cap')) headwear = 'cap';
  else if (lower.includes('beanie')) headwear = 'beanie';
  else if (lower.includes('crown')) headwear = isFem ? 'tiara' : 'crown';
  else if (lower.includes('tiara') || lower.includes('princess')) headwear = 'tiara';
  else if (lower.includes('wizard')) headwear = 'wizardHat';
  else if (lower.includes('witch')) headwear = 'witchHat';
  else if (lower.includes('astronaut') || lower.includes('knight') || lower.includes('helmet')) headwear = 'helmet';
  else if (lower.includes('police')) headwear = 'policeCap';
  else if (lower.includes('chef')) headwear = 'chefHat';
  else if (lower.includes('angel') || lower.includes('halo')) headwear = 'halo';
  else if (lower.includes('explorer') || lower.includes('boy')) headwear = 'cap';

  let outfitStyle: OutfitStyleKind = isFem ? 'dress' : 'tshirt';
  if (lower.includes('hero') || lower.includes('super')) outfitStyle = 'superhero';
  else if (lower.includes('wizard') || lower.includes('witch') || lower.includes('king') || lower.includes('queen')) {
    outfitStyle = 'robe';
  } else if (lower.includes('astronaut') || lower.includes('knight')) outfitStyle = 'armor';
  else if (lower.includes('hoodie')) outfitStyle = 'hoodie';
  else if (lower.includes('jacket')) outfitStyle = 'jacket';
  else if (lower.includes('doctor')) outfitStyle = 'labcoat';
  else if (lower.includes('police') || lower.includes('chef')) outfitStyle = 'uniform';
  else if (lower.includes('farmer')) outfitStyle = 'overalls';

  const accessories: string[] = [];
  if (hasCape) accessories.push('cape');
  if (lower.includes('backpack') || lower.includes('explorer') || lower.includes('school')) {
    accessories.push('backpack');
  }
  if (lower.includes('fairy')) accessories.push('fairyWings');
  else if (lower.includes('angel') || lower.includes('wing')) accessories.push('angelWings');
  if (lower.includes('glass')) accessories.push('glasses');
  if (lower.includes('mask') || lower.includes('hero') || lower.includes('ninja')) accessories.push('mask');
  if (lower.includes('beard') || lower.includes('wizard') || lower.includes('king')) accessories.push('beard');
  if (lower.includes('glove') || lower.includes('hero') || lower.includes('boy') || lower.includes('astronaut')) {
    accessories.push('gloves');
  }

  const style: CustomModelStyleSpec = {
    entityType: 'humanoid',
    archetype: isRobot ? 'robot' : isFem ? 'girl' : 'boy',
    hairStyle,
    headwear,
    outfitStyle,
    primaryColor: mainColor,
    secondaryColor: lower.includes('astronaut') ? '#CBD5E1' : '#1E293B',
    accentColor: hasCape ? capeColor : '#FACC15',
    skinColor: isFem ? '#FAD2B8' : '#F4C2A1',
    eyeColor: isFem ? '#16A34A' : '#0284C7',
    hairColor: lower.includes('wizard') ? '#E2E8F0' : isFem ? '#5A2D18' : '#3B2314',
    accessories,
  };

  const parts: CustomModelPart[] = [
    {
      name: 'Torso',
      geometry: 'cylinder',
      position: [0, 0.92, 0],
      rotation: [0, 0, 0],
      scale: [0.44, 0.56, 0.3],
      color: mainColor,
      roughness: 0.42,
      role: 'torso',
    },
    {
      name: 'Chest Emblem',
      geometry: 'cylinder',
      position: [0, 0.98, 0.15],
      rotation: [Math.PI / 2, 0, 0],
      scale: [0.16, 0.05, 0.16],
      color: '#FACC15',
      roughness: 0.25,
      metalness: 0.45,
      role: 'torso',
    },
    {
      name: 'Head',
      geometry: 'sphere',
      position: [0, 1.48, 0],
      rotation: [0, 0, 0],
      scale: [0.56, 0.54, 0.54],
      color: style.skinColor || '#FAD2B8',
      roughness: 0.44,
      role: 'head',
    },
    {
      name: 'Jaw / Mouth',
      geometry: 'sphere',
      position: [0, 1.35, 0.24],
      rotation: [0, 0, 0],
      scale: [0.14, 0.06, 0.07],
      color: '#991B1B',
      roughness: 0.35,
      role: 'jaw',
    },
    {
      name: 'Arm L',
      geometry: 'cylinder',
      position: [-0.3, 0.9, 0],
      rotation: [0, 0, 0.18],
      scale: [0.13, 0.5, 0.13],
      color: mainColor,
      roughness: 0.44,
      role: 'leftArm',
    },
    {
      name: 'Arm R',
      geometry: 'cylinder',
      position: [0.3, 0.9, 0],
      rotation: [0, 0, -0.18],
      scale: [0.13, 0.5, 0.13],
      color: mainColor,
      roughness: 0.44,
      role: 'rightArm',
    },
    {
      name: 'Leg L',
      geometry: 'cylinder',
      position: [-0.12, 0.32, 0],
      rotation: [0, 0, 0],
      scale: [0.15, 0.58, 0.15],
      color: '#1E293B',
      roughness: 0.48,
      role: 'leftLeg',
    },
    {
      name: 'Leg R',
      geometry: 'cylinder',
      position: [0.12, 0.32, 0],
      rotation: [0, 0, 0],
      scale: [0.15, 0.58, 0.15],
      color: '#1E293B',
      roughness: 0.48,
      role: 'rightLeg',
    },
  ];

  return {
    id,
    name: prompt.slice(0, 26) || 'Custom Hero',
    category: 'character',
    prompt,
    source: 'offline',
    createdAt: Date.now(),
    style,
    parts,
  };
}
