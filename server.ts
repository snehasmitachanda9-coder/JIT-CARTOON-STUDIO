import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        contents: `Design a stylized, recognizable, vibrant 3D cartoon model for: "${promptText}".
Use 8 to 20 modular 3D primitive parts positioned accurately in meters (Y-up, ground is Y=0, total height around 1.4 to 2.2m for characters/creatures/vehicles).
Assign each part an accurate joint role so it animates smoothly:
- For characters/creatures: torso, head, jaw, leftArm, rightArm, leftLeg, rightLeg, wing, tail, prop.
- For vehicles/carts: torso (chassis), wheel (at bottom y=wheelRadius), prop (roof/cargo/handle).
Ensure parts overlap cleanly with zero floating pieces and bottom touches y=0.`,
        config: {
          systemInstruction:
            'You are a senior 3D technical artist building clean, appealing procedural Three.js cartoon models.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Short display name (max 28 chars).' },
              category: {
                type: Type.STRING,
                description: 'One of: character, creature, vehicle, prop',
              },
              parts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    geometry: {
                      type: Type.STRING,
                      description: 'One of: sphere, box, cylinder, cone, torus',
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
            required: ['name', 'category', 'parts'],
          },
        },
      });

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw);
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
      server: { middlewareMode: true },
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
  app.listen(port, '0.0.0.0', () => {
    console.log(`JIT 3D Cartoon Studio server running on http://0.0.0.0:${port}`);
  });
}

void startServer();
