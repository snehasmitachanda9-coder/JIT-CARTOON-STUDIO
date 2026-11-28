import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeAiModelBlueprint(
  parsed: Record<string, unknown>,
  promptText: string
): Record<string, unknown> {
  const lower = promptText.toLowerCase();
  const rawStyle =
    parsed.style && typeof parsed.style === 'object'
      ? ({ ...(parsed.style as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const hasVehicleWord =
    /\b(car|bus|truck|cart|train|taxi|van|tractor|helicopter|chopper|plane|airplane|jet|boat|ship|rocket|spaceship|motorcycle|bicycle)\b/.test(
      lower
    );
  const hasHumanoidWord =
    /\b(boy|girl|kid|man|woman|hero|superhero|wizard|witch|king|queen|prince|princess|knight|soldier|warrior|astronaut|pirate|ninja|robot|chef|doctor|nurse|police|policeman|policewoman|cop|firefighter|farmer|teacher|angel|fairy|samurai|explorer)\b/.test(
      lower
    ) && !hasVehicleWord;

  if (hasHumanoidWord) {
    parsed.category = 'character';
    rawStyle.entityType = 'humanoid';
    const acc = new Set<string>(
      Array.isArray(rawStyle.accessories)
        ? rawStyle.accessories.map((v) => String(v))
        : []
    );

    if (/\bking\b/.test(lower) && !/\bqueen\b/.test(lower)) {
      rawStyle.archetype = 'king';
      rawStyle.headwear = 'crown';
      rawStyle.outfitStyle = 'robe';
      acc.add('cape');
      if (!/\b(boy|young|clean)\b/.test(lower)) acc.add('beard');
    } else if (/\bqueen\b/.test(lower)) {
      rawStyle.archetype = 'queen';
      rawStyle.headwear = 'crown';
      rawStyle.outfitStyle = 'robe';
      if (!rawStyle.hairStyle || rawStyle.hairStyle === 'short') rawStyle.hairStyle = 'long';
      acc.add('cape');
    } else if (/\bprincess\b/.test(lower)) {
      rawStyle.archetype = 'princess';
      rawStyle.headwear = 'tiara';
      rawStyle.outfitStyle = 'dress';
      acc.add('cape');
    } else if (/\bprince\b/.test(lower)) {
      rawStyle.archetype = 'prince';
      rawStyle.headwear = 'crown';
      rawStyle.outfitStyle = 'robe';
      acc.add('cape');
    } else if (/\b(soldier|knight|warrior|guard)\b/.test(lower)) {
      rawStyle.archetype = /\bknight\b/.test(lower) ? 'knight' : 'soldier';
      rawStyle.headwear = 'helmet';
      rawStyle.outfitStyle = 'armor';
      acc.add('gloves');
      if (/\bknight\b/.test(lower)) acc.add('cape');
    } else if (/\b(police|policeman|policewoman|cop)\b/.test(lower)) {
      rawStyle.archetype = 'police';
      rawStyle.headwear = 'policeCap';
      rawStyle.outfitStyle = 'uniform';
      acc.add('gloves');
    } else if (/\bwizard\b/.test(lower)) {
      rawStyle.archetype = 'wizard';
      rawStyle.headwear = 'wizardHat';
      rawStyle.outfitStyle = 'robe';
      acc.add('beard');
      acc.add('cape');
    } else if (/\b(superhero|super\s*hero)\b/.test(lower)) {
      rawStyle.archetype = 'superhero';
      rawStyle.outfitStyle = 'superhero';
      acc.add('cape');
      acc.add('mask');
      acc.add('gloves');
    }

    rawStyle.accessories = Array.from(acc);
    parsed.style = rawStyle;
  }

  return parsed;
}

function getGeminiClient(): GoogleGenAI | null {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithFallback(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>
) {
  try {
    return await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      ...params,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
      return await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        ...params,
      });
    }
    throw err;
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const hasKey = Boolean(getGeminiClient());
    res.json({ ok: true, geminiConfigured: hasKey });
  });

  // 1. Prompt-to-3D Model & Character Builder
  app.post('/api/ai/generate-3d-model', async (req, res) => {
    const promptText =
      typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!promptText || promptText.length > 400) {
      res.status(400).json({ error: 'Please provide a prompt between 1 and 400 characters.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    try {
      const response = await generateWithFallback(ai, {
        contents: `Design a vibrant, high-detail Chibi-Pixar 3D cartoon model for: "${promptText}".
Return BOTH:
1) "style" metadata so our sculpted Chibi-Pixar 3D engine renders clean symmetrical faces (glossy eyes, nose, smiling lips) and iconic outfits/headwear:
   - entityType: "humanoid" (any person, king, queen, prince, princess, superhero, soldier, knight, police officer, wizard, witch, boy, girl, robot, astronaut, chef, doctor), "animal" (dog, cat, dragon, dino, lion, bird, monster, creature, unicorn), "vehicle" (car, police car, bus, truck, bike, boat, helicopter, airplane, spaceship, cart, train), or "prop" (standalone buildings, trees, furniture, castles, chests, swords).
   - archetype: concise role keyword ("king", "queen", "prince", "princess", "soldier", "knight", "police", "superhero", "wizard", "witch", "robot", "boy", "girl", "dragon", "dino", "lion", "car", "schoolBus", "policeCar", "helicopter", "airplane", "boat", "castle", etc.).
   - Role rules:
     * king / prince -> headwear "crown", outfitStyle "robe", accessories include "cape" (and "beard" for king)
     * queen -> headwear "crown", outfitStyle "robe", hairStyle "long", accessories include "cape"
     * princess -> headwear "tiara", outfitStyle "dress", hairStyle "long", accessories include "cape"
     * soldier / knight -> headwear "helmet", outfitStyle "armor", accessories include "gloves"
     * police officer -> entityType "humanoid", headwear "policeCap", outfitStyle "uniform"
     * wizard / witch -> headwear "wizardHat" or "witchHat", outfitStyle "robe", accessories include "cape"
     * superhero -> outfitStyle "superhero", accessories include "cape", "mask", "gloves"
   - hairStyle: one of "short", "spiky", "ponytail", "bob", "curly", "long", "bun" (for humanoids).
   - headwear: one of "none", "cap", "beanie", "crown", "tiara", "witchHat", "wizardHat", "helmet", "policeCap", "chefHat", "strawHat", "halo", "wreath".
   - outfitStyle: one of "tshirt", "hoodie", "jacket", "dress", "robe", "uniform", "overalls", "labcoat", "superhero", "armor", "saree".
   - primaryColor, secondaryColor, accentColor, skinColor, eyeColor, hairColor: vibrant #RRGGBB hex colors.
   - accessories: array chosen from ["cape", "backpack", "gloves", "glasses", "mask", "wings", "fairyWings", "angelWings", "beard", "moustache", "horns", "catEars", "bunnyEars", "stethoscope", "watch", "cargoPockets"].
2) "parts": 8 to 18 smooth modular 3D primitive parts (prefer sphere, cylinder, cone, torus; avoid harsh cubes) positioned accurately in meters (Y-up, ground Y=0, height ~1.4-2.2m) with accurate joint roles (torso, head, jaw, leftArm, rightArm, leftLeg, rightLeg, wheel, wing, tail, prop).`,
        config: {
          systemInstruction:
            'You are a lead Pixar-style 3D character & asset artist designing appealing, expressive cartoon models with rich color palettes and sculpted silhouettes.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Short display name (max 28 chars).' },
              category: {
                type: Type.STRING,
                description: 'One of: character, creature, vehicle, prop',
              },
              style: {
                type: Type.OBJECT,
                properties: {
                  entityType: {
                    type: Type.STRING,
                    description: 'One of: humanoid, animal, vehicle, prop',
                  },
                  archetype: { type: Type.STRING },
                  hairStyle: {
                    type: Type.STRING,
                    description: 'One of: short, spiky, ponytail, bob, curly, long, bun',
                  },
                  headwear: {
                    type: Type.STRING,
                    description:
                      'One of: none, cap, beanie, crown, tiara, witchHat, wizardHat, helmet, policeCap, chefHat, strawHat, halo, wreath',
                  },
                  outfitStyle: {
                    type: Type.STRING,
                    description:
                      'One of: tshirt, hoodie, jacket, dress, robe, uniform, overalls, labcoat, superhero, armor, saree',
                  },
                  primaryColor: { type: Type.STRING },
                  secondaryColor: { type: Type.STRING },
                  accentColor: { type: Type.STRING },
                  skinColor: { type: Type.STRING },
                  eyeColor: { type: Type.STRING },
                  hairColor: { type: Type.STRING },
                  accessories: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['entityType', 'primaryColor', 'secondaryColor', 'accentColor'],
              },
              parts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    geometry: {
                      type: Type.STRING,
                      description: 'One of: sphere, cylinder, cone, torus, box',
                    },
                    position: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER },
                      description: '[x, y, z] in meters',
                    },
                    rotation: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER },
                      description: '[rx, ry, rz] in radians',
                    },
                    scale: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER },
                      description: '[sx, sy, sz] dimensions in meters',
                    },
                    color: { type: Type.STRING, description: 'Hex color like #EF4444' },
                    roughness: { type: Type.NUMBER },
                    metalness: { type: Type.NUMBER },
                    role: {
                      type: Type.STRING,
                      description:
                        'One of: torso, head, jaw, leftArm, rightArm, leftLeg, rightLeg, wheel, wing, tail, prop',
                    },
                  },
                  required: [
                    'name',
                    'geometry',
                    'position',
                    'rotation',
                    'scale',
                    'color',
                    'role',
                  ],
                },
              },
            },
            required: ['name', 'category', 'style', 'parts'],
          },
        },
      });

      const raw = (response.text || '{}').trim();
      const parsed = normalizeAiModelBlueprint(
        JSON.parse(raw) as Record<string, unknown>,
        promptText
      );
      res.json({ blueprint: parsed });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate 3D model';
      res.status(502).json({ error: msg });
    }
  });

  // 2. AI Story Writer (Multi-Scene Cartoon Script)
  app.post('/api/ai/generate-story', async (req, res) => {
    const idea = typeof req.body?.idea === 'string' ? req.body.idea.trim() : '';
    const language =
      req.body?.language === 'Bengali' || req.body?.language === 'Bilingual'
        ? req.body.language
        : 'English';

    if (!idea || idea.length > 500) {
      res.status(400).json({ error: 'Please provide a story idea between 1 and 500 characters.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    try {
      const response = await generateWithFallback(ai, {
        contents: `Write a lively, cinematic 3-scene 3D animated cartoon story based on: "${idea}".
Dialogue language: ${language}. (If Bengali, write natural expressive Bengali script; if Bilingual, mix friendly Bengali and English).
Available environments: village, classroom, park, palace, forest, studio.
Available lighting: day, sunset, night.
Available cast actorType + kind:
- character: boy, girl, teenager, woman, father, mother, son, daughter, kid, teacher, farmer, doctor, police, chef, grandpa, grandma, king, queen, prince, princess, fairy, angel, witch, wizard, superhero, robot.
- animal: dog, cat, rabbit, monkey, lion, tiger, elephant, horse, bird, fish.
- vehicle: car, schoolBus, bike, bicycle, tractor, helicopter, airplane, boat.
Available activities for characters: Idle, Walk, Run, Running & Chasing, Talk (Lip-Sync), Waving Hand (হাত নাড়ানো), Clapping (হাততালি), Pointing / Beckoning (ইশারা), Fighting, Playing Football, Playing Cricket, Swimming, Reading Books, Using Mobile Phone, Sleeping & Waking Up, Sit, Jump, Dance, Laugh, Cry, Eat, Farming/Digging, Medical Checkup, Cooking/Stirring, Magic Spell Cast, Royal Wave.
Available activities for animals: Idle, Walk, Run/Chase, Jump/Hop, Climb/Swing, Sit, Bark/Roar/Chirp, Wag Tail, Swim, Sleep & Wake Up, Fly.
Available activities for vehicles: Parked, Drive/Ride Forward, Honk/Lights Flash, Rotor Spin & Hover, Fly in Sky, Sail on Water.
Optional heldItem for characters (right hand): none, book, stick, gun, cricketBat, football, phone, magicWand, sword, scepter, bag, umbrella.
Available expressions: Happy, Sad, Surprised, Angry.
Available cameraPreset: wide, closeup, overShoulder, top.
Available cameraZoom: none, zoomIn, zoomOut.
Place 2 to 4 actors per scene on ground coordinates X in [-3.5, 3.5], Z in [-2.5, 2.5].`,
        config: {
          systemInstruction:
            'You are a creative 3D animation director crafting concise, lively multi-scene cartoon scripts.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              storyTitle: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    environment: { type: Type.STRING },
                    lighting: { type: Type.STRING },
                    duration: { type: Type.NUMBER },
                    cameraPreset: { type: Type.STRING },
                    cameraZoom: { type: Type.STRING },
                    cast: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          actorType: { type: Type.STRING },
                          kind: { type: Type.STRING },
                          name: { type: Type.STRING },
                          animation: { type: Type.STRING },
                          expression: { type: Type.STRING },
                          dialogue: { type: Type.STRING },
                          heldItem: { type: Type.STRING },
                          x: { type: Type.NUMBER },
                          z: { type: Type.NUMBER },
                          walkToX: { type: Type.NUMBER },
                          walkToZ: { type: Type.NUMBER },
                        },
                        required: [
                          'kind',
                          'name',
                          'animation',
                          'expression',
                          'dialogue',
                          'x',
                          'z',
                        ],
                      },
                    },
                  },
                  required: [
                    'title',
                    'environment',
                    'lighting',
                    'duration',
                    'cameraPreset',
                    'cameraZoom',
                    'cast',
                  ],
                },
              },
            },
            required: ['storyTitle', 'scenes'],
          },
        },
      });

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw);
      res.json({ script: parsed });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate cartoon story';
      res.status(502).json({ error: msg });
    }
  });

  // Vite middleware (dev) or static dist serving (prod)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  const port = Number(process.env.PORT || 3000);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`JIT 3D Cartoon Studio server running on http://0.0.0.0:${port}`);
  });
}

void startServer();
