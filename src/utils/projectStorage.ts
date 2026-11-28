import {
  AspectRatioMode,
  CAMERA_PRESETS,
  ENVIRONMENT_META,
  EnvironmentId,
  LightingMode,
  SavedProjectRecord,
  SceneData,
} from '../types/studio';

export const SAVED_PROJECTS_KEY = 'jit_saved_projects_v1';
export const AUTO_DRAFT_KEY = 'jit_auto_draft_project_v1';

const MAX_SAVED_PROJECTS = 24;

function isEphemeralBlobUrl(url?: string | null): boolean {
  return typeof url === 'string' && url.startsWith('blob:');
}

function isOversizedDataUrl(url?: string | null, maxBytes = 420_000): boolean {
  return typeof url === 'string' && url.startsWith('data:') && url.length > maxBytes;
}

export function sanitizeScenesForStorage(
  scenes: SceneData[],
  stripHeavyMedia = false
): SceneData[] {
  return scenes.map((sc) => {
    let cleanCustomBg = sc.customBackground ?? null;
    if (cleanCustomBg) {
      if (
        isEphemeralBlobUrl(cleanCustomBg.url) ||
        (stripHeavyMedia && isOversizedDataUrl(cleanCustomBg.url, 250_000))
      ) {
        cleanCustomBg = null;
      }
    }

    const cleanSceneAudio =
      sc.audio &&
      !isEphemeralBlobUrl(sc.audio.url) &&
      !(stripHeavyMedia && isOversizedDataUrl(sc.audio.url, 250_000))
        ? sc.audio
        : null;

    const cleanActors = (sc.actors || []).map((actor) => {
      const cleanActorAudio =
        actor.audio &&
        !isEphemeralBlobUrl(actor.audio.url) &&
        !(stripHeavyMedia && isOversizedDataUrl(actor.audio.url, 200_000))
          ? actor.audio
          : null;

      const cleanHeld = (item: typeof actor.heldItemLeft) => {
        if (!item) return null;
        if (isEphemeralBlobUrl(item.glbUrl) || isEphemeralBlobUrl(item.imageDataUrl)) {
          return null;
        }
        if (
          stripHeavyMedia &&
          (isOversizedDataUrl(item.glbUrl, 200_000) ||
            isOversizedDataUrl(item.imageDataUrl, 200_000))
        ) {
          return null;
        }
        return item;
      };

      let cleanBp = actor.customBlueprint;
      if (cleanBp) {
        if (
          isEphemeralBlobUrl(cleanBp.glbUrl) ||
          isEphemeralBlobUrl(cleanBp.imageDataUrl)
        ) {
          cleanBp = { ...cleanBp, glbUrl: undefined, imageDataUrl: undefined };
        } else if (
          stripHeavyMedia &&
          (isOversizedDataUrl(cleanBp.glbUrl, 200_000) ||
            isOversizedDataUrl(cleanBp.imageDataUrl, 200_000))
        ) {
          cleanBp = { ...cleanBp, glbUrl: undefined, imageDataUrl: undefined };
        }
      }

      return {
        ...actor,
        audio: cleanActorAudio,
        heldItemLeft: cleanHeld(actor.heldItemLeft),
        heldItemRight: cleanHeld(actor.heldItemRight),
        customBlueprint: cleanBp,
      };
    });

    return {
      ...sc,
      customBackground: cleanCustomBg,
      audio: cleanSceneAudio,
      actors: cleanActors,
    };
  });
}

function normalizeProjectRecord(raw: unknown): SavedProjectRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.scenes) || obj.scenes.length === 0) return null;

  const validEnvs: EnvironmentId[] = [
    'village',
    'classroom',
    'park',
    'palace',
    'forest',
    'studio',
  ];
  const validLight: LightingMode[] = ['day', 'sunset', 'night'];
  const ratio: AspectRatioMode =
    obj.aspectRatio === '9:16' || obj.aspectRatio === '1:1'
      ? obj.aspectRatio
      : '16:9';

  const normalizedScenes: SceneData[] = obj.scenes.map((rawSc, idx) => {
    const s = (rawSc || {}) as Partial<SceneData>;
    const env: EnvironmentId =
      s.environment && validEnvs.includes(s.environment)
        ? s.environment
        : 'village';
    const lighting: LightingMode =
      s.lighting && validLight.includes(s.lighting) ? s.lighting : 'day';
    const defCam = ENVIRONMENT_META[env].defaultCamera;
    const camPose =
      s.cameraPose &&
      Array.isArray(s.cameraPose.position) &&
      s.cameraPose.position.length === 3 &&
      Array.isArray(s.cameraPose.target) &&
      s.cameraPose.target.length === 3
        ? s.cameraPose
        : { ...CAMERA_PRESETS.wide.pose, ...defCam };

    return {
      id: typeof s.id === 'string' && s.id ? s.id : `scene-restored-${Date.now()}-${idx}`,
      title: typeof s.title === 'string' && s.title ? s.title : `Scene ${idx + 1}`,
      environment: env,
      lighting,
      duration:
        typeof s.duration === 'number' && Number.isFinite(s.duration)
          ? Math.max(2, Math.min(30, s.duration))
          : 6,
      cameraPose: camPose,
      cameraPreset: s.cameraPreset,
      cameraZoom: s.cameraZoom || 'none',
      cameraStartTime: s.cameraStartTime,
      cameraEndTime: s.cameraEndTime,
      customBackground: s.customBackground ?? null,
      audio: s.audio ?? null,
      actors: Array.isArray(s.actors) ? s.actors : [],
    };
  });

  return {
    id:
      typeof obj.id === 'string' && obj.id
        ? obj.id
        : `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    projectName:
      typeof obj.projectName === 'string' && obj.projectName.trim()
        ? obj.projectName.trim().slice(0, 48)
        : 'Restored Cartoon Project',
    aspectRatio: ratio,
    scenes: normalizedScenes,
    updatedAt:
      typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt)
        ? obj.updatedAt
        : Date.now(),
    thumbnailDataUrl:
      typeof obj.thumbnailDataUrl === 'string' ? obj.thumbnailDataUrl : undefined,
  };
}

export function loadSavedProjects(): SavedProjectRecord[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(SAVED_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeProjectRecord(item))
      .filter((item): item is SavedProjectRecord => Boolean(item))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveProjectToStorage(record: SavedProjectRecord): {
  saved: SavedProjectRecord[];
  quotaTrimmed: boolean;
} {
  const existing = loadSavedProjects();
  const cleanFull: SavedProjectRecord = {
    ...record,
    scenes: sanitizeScenesForStorage(record.scenes, false),
    updatedAt: record.updatedAt || Date.now(),
  };

  const mergedFull = [
    cleanFull,
    ...existing.filter((p) => p.id !== cleanFull.id),
  ].slice(0, MAX_SAVED_PROJECTS);

  try {
    window.localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(mergedFull));
    return { saved: mergedFull, quotaTrimmed: false };
  } catch {
    const cleanLight: SavedProjectRecord = {
      ...cleanFull,
      thumbnailDataUrl: undefined,
      scenes: sanitizeScenesForStorage(record.scenes, true),
    };
    const mergedLight = [
      cleanLight,
      ...existing
        .filter((p) => p.id !== cleanLight.id)
        .map((p) => ({
          ...p,
          thumbnailDataUrl: undefined,
          scenes: sanitizeScenesForStorage(p.scenes, true),
        })),
    ].slice(0, 12);

    try {
      window.localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(mergedLight));
      return { saved: mergedLight, quotaTrimmed: true };
    } catch {
      return { saved: existing, quotaTrimmed: true };
    }
  }
}

export function deleteSavedProjectFromStorage(id: string): SavedProjectRecord[] {
  const next = loadSavedProjects().filter((p) => p.id !== id);
  try {
    window.localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function loadAutoDraft(): SavedProjectRecord | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(AUTO_DRAFT_KEY);
    if (!raw) return null;
    return normalizeProjectRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveAutoDraft(record: SavedProjectRecord): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const clean: SavedProjectRecord = {
      ...record,
      thumbnailDataUrl: undefined,
      scenes: sanitizeScenesForStorage(record.scenes, true),
    };
    window.localStorage.setItem(AUTO_DRAFT_KEY, JSON.stringify(clean));
  } catch {
    // ignore storage quota errors for silent draft backup
  }
}

export function downloadProjectAsJson(record: SavedProjectRecord): void {
  const payload = {
    app: 'JIT 3D Cartoon Studio',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project: {
      ...record,
      scenes: sanitizeScenesForStorage(record.scenes, false),
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const slug =
    record.projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'jit-cartoon-project';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.jit3d.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseImportedProjectFile(rawText: string): SavedProjectRecord {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const candidate =
    parsed && typeof parsed.project === 'object' && parsed.project !== null
      ? parsed.project
      : parsed;
  const normalized = normalizeProjectRecord(candidate);
  if (!normalized) {
    throw new Error('Invalid JIT 3D project JSON file.');
  }
  return {
    ...normalized,
    id: `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    updatedAt: Date.now(),
  };
}
