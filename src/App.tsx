import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Monitor,
  Mountain,
  Square as SquareIcon,
  Smartphone,
  Users,
  Wand2,
  WifiOff,
} from 'lucide-react';
import {
  ActivityModalHeldSelection,
  ActivityPickerTarget,
  ActivitySelectorModal,
} from './components/ActivitySelectorModal';
import { ExportModal } from './components/ExportModal';
import {
  GeneratedStoryScript,
  InspectorPanel,
  InspectorTab,
} from './components/InspectorPanel';
import { NewProjectConfig, NewProjectModal } from './components/NewProjectModal';
import { ActorTrackField, TimelineBar } from './components/TimelineBar';
import { TopHeader } from './components/TopHeader';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  LiveEffectPreview,
  LiveEffectPreviewKind,
  MotionPathEditMode,
  StudioViewport,
  StudioViewportHandle,
} from './three/StudioViewport';
import {
  ActorType,
  ANIMAL_META,
  AnimalKind,
  AnimationState,
  AspectRatioMode,
  CAMERA_PRESETS,
  CameraPose,
  CameraPresetId,
  CameraZoomMode,
  CHARACTER_META,
  CharacterKind,
  CUSTOM_MODEL_RETENTION_MS,
  CustomBackgroundConfig,
  CustomModelBlueprint,
  ENVIRONMENT_META,
  EnvironmentId,
  ExportProgress,
  FacialExpression,
  HANDHELD_ITEM_META,
  HandheldItemKind,
  LightingMode,
  PROP_META,
  PropKind,
  SavedProjectRecord,
  SceneActor,
  SceneData,
  VEHICLE_META,
  VehicleKind,
} from './types/studio';
import {
  MicRecordingSession,
  startMicRecording,
  StudioAudioManager,
} from './utils/audioManager';
import { generateOfflineProceduralModel } from './utils/offlineModelGenerator';
import {
  AUTO_DRAFT_KEY,
  SAVED_PROJECTS_KEY,
  deleteSavedProjectFromStorage,
  downloadProjectAsJson,
  loadAutoDraft,
  loadSavedProjects,
  parseImportedProjectFile,
  saveAutoDraft,
  saveProjectToStorage,
} from './utils/projectStorage';

const CUSTOM_MODELS_KEY = 'jit_custom_3d_models_v1';
const LEGACY_CUSTOM_MODELS_KEY = 'jit-3d-custom-models-v1';
const CHARACTER_ENGINE_VERSION_KEY = 'jit_3d_engine_version';
const CHARACTER_ENGINE_VERSION = 'chibi_animals_uploads_v4';

function clearOldCachedSceneStateOnLoad(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (
        k === SAVED_PROJECTS_KEY ||
        k === AUTO_DRAFT_KEY ||
        k === CUSTOM_MODELS_KEY
      ) {
        continue;
      }
      if (
        k === LEGACY_CUSTOM_MODELS_KEY ||
        /^(jit[-_]?(scene|scenes|story|studio|timeline|actors?|cache)|scene[-_]?state|studio[-_]?state|cartoon[-_]?studio)/i.test(
          k
        )
      ) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach((k) => window.localStorage.removeItem(k));
    window.localStorage.setItem(CHARACTER_ENGINE_VERSION_KEY, CHARACTER_ENGINE_VERSION);
  } catch {
    // ignore storage access errors in restricted frames
  }
}

clearOldCachedSceneStateOnLoad();

let uidCounter = 100;
const nextId = (prefix: string) => `${prefix}-${++uidCounter}`;

function createBlankScenes(
  env: EnvironmentId = 'village',
  customBackground: CustomBackgroundConfig | null = null
): SceneData[] {
  return [
    {
      id: nextId('scene'),
      title: 'Scene 1',
      environment: env,
      lighting: env === 'forest' ? 'night' : 'day',
      duration: 6,
      cameraPose: { ...ENVIRONMENT_META[env].defaultCamera },
      cameraPreset: 'wide',
      cameraZoom: 'none',
      customBackground,
      audio: null,
      actors: [],
    },
  ];
}

function createProjectFromConfig(cfg: NewProjectConfig): SceneData[] {
  const customBg = cfg.customBackground ?? null;
  if (cfg.templateId === 'blank') {
    return createBlankScenes(cfg.blankEnvironment, customBg);
  }

  if (cfg.templateId === 'classroom') {
    return [
      {
        id: nextId('scene'),
        title: 'Scene 1',
        environment: 'classroom',
        lighting: 'day',
        duration: 6,
        cameraPose: { ...ENVIRONMENT_META.classroom.defaultCamera },
        cameraPreset: 'wide',
        cameraZoom: 'zoomIn',
        audio: null,
        actors: [
          {
            id: nextId('actor'),
            actorType: 'character',
            kind: 'teacher',
            name: 'Teacher 1',
            position: [-1.2, -1.5],
            rotationY: 0.25,
            scale: 1,
            animation: 'Talk (Lip-Sync)',
            expression: 'Happy',
            dialogue: 'Welcome to class! Let us learn together!',
            accentColor: CHARACTER_META.teacher.defaultColor,
            heldItemRight: {
              itemKind: 'book',
              label: 'Book',
              scale: 1,
              rotationDeg: 0,
              offsetY: 0,
              offsetZ: 0,
            },
            audio: null,
          },
          {
            id: nextId('actor'),
            actorType: 'character',
            kind: 'robot',
            name: 'Robot 1',
            position: [1.3, -0.8],
            rotationY: -0.35,
            scale: 1,
            animation: 'Dance',
            expression: 'Happy',
            dialogue: 'Beep boop! Ready to learn!',
            accentColor: CHARACTER_META.robot.defaultColor,
            audio: null,
          },
        ],
      },
    ];
  }

  if (cfg.templateId === 'jungle') {
    return [
      {
        id: nextId('scene'),
        title: 'Scene 1',
        environment: 'forest',
        lighting: 'day',
        duration: 6,
        cameraPose: { ...ENVIRONMENT_META.forest.defaultCamera },
        cameraPreset: 'wide',
        cameraZoom: 'none',
        audio: null,
        actors: [
          {
            id: nextId('actor'),
            actorType: 'animal',
            kind: 'monkey',
            name: 'Monkey 1',
            position: [-1.5, 0.2],
            rotationY: 0.35,
            scale: 1,
            animation: 'Jump/Hop',
            expression: 'Happy',
            dialogue: 'Ooh ooh! Rainbow Jungle adventure!',
            accentColor: ANIMAL_META.monkey.defaultColor,
            audio: null,
          },
          {
            id: nextId('actor'),
            actorType: 'animal',
            kind: 'elephant',
            name: 'Elephant 1',
            position: [1.3, -0.3],
            rotationY: -0.3,
            scale: 1.05,
            animation: 'Walk',
            expression: 'Happy',
            dialogue: 'Let us explore the forest!',
            accentColor: ANIMAL_META.elephant.defaultColor,
            audio: null,
          },
          {
            id: nextId('actor'),
            actorType: 'animal',
            kind: 'bird',
            name: 'Bird 1',
            position: [0.0, 1.3],
            rotationY: 0,
            scale: 1,
            animation: 'Fly',
            expression: 'Happy',
            dialogue: 'Tweet tweet!',
            accentColor: ANIMAL_META.bird.defaultColor,
            audio: null,
          },
        ],
      },
    ];
  }

  if (cfg.templateId === 'palace') {
    return [
      {
        id: nextId('scene'),
        title: 'Scene 1',
        environment: 'palace',
        lighting: 'day',
        duration: 6,
        cameraPose: { ...ENVIRONMENT_META.palace.defaultCamera },
        cameraPreset: 'wide',
        cameraZoom: 'none',
        audio: null,
        actors: [
          {
            id: nextId('actor'),
            actorType: 'character',
            kind: 'king',
            name: 'King 1',
            position: [-1.8, -0.4],
            rotationY: 0.3,
            scale: 1,
            animation: 'Waving Hand (হাত নাড়ানো)',
            expression: 'Happy',
            dialogue: 'Welcome to the Royal Palace!',
            accentColor: CHARACTER_META.king.defaultColor,
            audio: null,
          },
          {
            id: nextId('actor'),
            actorType: 'character',
            kind: 'queen',
            name: 'Queen 1',
            position: [-0.5, -0.7],
            rotationY: 0.15,
            scale: 1,
            animation: 'Talk (Lip-Sync)',
            expression: 'Happy',
            dialogue: 'Today is a grand royal celebration!',
            accentColor: CHARACTER_META.queen.defaultColor,
            audio: null,
          },
          {
            id: nextId('actor'),
            actorType: 'character',
            kind: 'princess',
            name: 'Princess 1',
            position: [0.9, -0.2],
            rotationY: -0.2,
            scale: 1,
            animation: 'Dance',
            expression: 'Happy',
            dialogue: 'Hooray!',
            accentColor: CHARACTER_META.princess.defaultColor,
            audio: null,
          },
          {
            id: nextId('actor'),
            actorType: 'character',
            kind: 'fairy',
            name: 'Fairy 1',
            position: [2.1, 0.7],
            rotationY: -0.45,
            scale: 0.96,
            animation: 'Magic Spell Cast',
            expression: 'Happy',
            dialogue: 'Sparkle magic!',
            accentColor: CHARACTER_META.fairy.defaultColor,
            heldItemRight: {
              itemKind: 'magicWand',
              label: 'Magic Wand',
              scale: 1,
              rotationDeg: 0,
              offsetY: 0,
              offsetZ: 0,
            },
            audio: null,
          },
        ],
      },
    ];
  }

  // Default starter template: Green Village
  return [
    {
      id: nextId('scene'),
      title: 'Scene 1',
      environment: 'village',
      lighting: 'day',
      duration: 6,
      cameraPose: { ...ENVIRONMENT_META.village.defaultCamera },
      cameraPreset: 'wide',
      cameraZoom: 'none',
      audio: null,
      actors: [
        {
          id: nextId('actor'),
          actorType: 'character',
          kind: 'boy',
          name: 'Boy 1',
          position: [-1.2, 0.3],
          rotationY: 0.28,
          scale: 1,
          animation: 'Waving Hand (হাত নাড়ানো)',
          expression: 'Happy',
          dialogue: 'Hi! Welcome to our Green Village!',
          accentColor: CHARACTER_META.boy.defaultColor,
          audio: null,
        },
        {
          id: nextId('actor'),
          actorType: 'character',
          kind: 'girl',
          name: 'Girl 1',
          position: [1.1, -0.2],
          rotationY: -0.3,
          scale: 1,
          animation: 'Talk (Lip-Sync)',
          expression: 'Happy',
          dialogue: "Let's make an amazing 3D cartoon!",
          accentColor: CHARACTER_META.girl.defaultColor,
          audio: null,
        },
        {
          id: nextId('actor'),
          actorType: 'animal',
          kind: 'dog',
          name: 'Dog 1',
          position: [0.1, 1.4],
          rotationY: -0.1,
          scale: 1,
          animation: 'Jump/Hop',
          expression: 'Happy',
          dialogue: 'Woof!',
          accentColor: ANIMAL_META.dog.defaultColor,
          audio: null,
        },
      ],
    },
  ];
}

function loadSavedCustomModels(): CustomModelBlueprint[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    // Auto-purge models older than 60 days & drop ephemeral blob: URLs from closed tabs
    return parsed
      .map((item) => ({
        ...item,
        createdAt: typeof item?.createdAt === 'number' ? item.createdAt : now,
      }))
      .filter(
        (item) =>
          now - item.createdAt < CUSTOM_MODEL_RETENTION_MS &&
          !item?.glbUrl?.startsWith('blob:') &&
          !item?.imageDataUrl?.startsWith('blob:')
      );
  } catch {
    return [];
  }
}

export default function App() {
  const isOnline = useOnlineStatus();
  const viewportRef = useRef<StudioViewportHandle>(null);
  const audioManagerRef = useRef<StudioAudioManager | null>(null);
  if (!audioManagerRef.current) {
    audioManagerRef.current = new StudioAudioManager();
  }

  // Project Launcher, Save/Resume Storage & Undo/Redo History State
  const [currentProjectId, setCurrentProjectId] = useState(
    () => `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  );
  const [projectName, setProjectName] = useState('My Cartoon Story');
  const [showNewProjectModal, setShowNewProjectModal] = useState(true);
  const [hasCreatedProject, setHasCreatedProject] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProjectRecord[]>(
    loadSavedProjects
  );
  const [autoDraft, setAutoDraft] = useState<SavedProjectRecord | null>(
    loadAutoDraft
  );
  const [scenes, setScenesRaw] = useState<SceneData[]>(() =>
    createBlankScenes('village')
  );
  const historyPastRef = useRef<SceneData[][]>([]);
  const historyFutureRef = useRef<SceneData[][]>([]);
  const [, setHistoryTick] = useState(0);

  const commitScenes = useCallback(
    (updater: (prev: SceneData[]) => SceneData[], recordHistory = true) => {
      setScenesRaw((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        if (recordHistory) {
          historyPastRef.current = [...historyPastRef.current.slice(-29), prev];
          historyFutureRef.current = [];
          setHistoryTick((t) => t + 1);
        }
        return next;
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    const past = historyPastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    historyPastRef.current = past.slice(0, -1);
    setScenesRaw((current) => {
      historyFutureRef.current = [current, ...historyFutureRef.current.slice(0, 29)];
      return previous;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  const handleRedo = useCallback(() => {
    const future = historyFutureRef.current;
    if (future.length === 0) return;
    const next = future[0];
    historyFutureRef.current = future.slice(1);
    setScenesRaw((current) => {
      historyPastRef.current = [...historyPastRef.current.slice(-29), current];
      return next;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y (Undo/Redo) — Ctrl+S handled after handleSaveProject
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const [activeSceneId, setActiveSceneId] = useState<string>(() => scenes[0]?.id || 'scene-1');
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [modelControlsOpen, setModelControlsOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('16:9');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<InspectorTab>('cast');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [motionPathEditMode, setMotionPathEditMode] =
    useState<MotionPathEditMode>('idle');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [customModels, setCustomModels] =
    useState<CustomModelBlueprint[]>(loadSavedCustomModels);
  const [activityModalTarget, setActivityModalTarget] =
    useState<ActivityPickerTarget | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);

  // Story Playback & Live Stage Preview State
  const [isPlaying, setIsPlaying] = useState(false);
  const [storyElapsed, setStoryElapsed] = useState(0);
  const [cameraPoseTrigger, setCameraPoseTrigger] = useState<{
    pose: CameraPose;
    seq: number;
  } | null>(null);
  const [liveEffectPreview, setLiveEffectPreview] =
    useState<LiveEffectPreview | null>(null);

  const triggerEffectPreview = useCallback(
    (actorId: string, kind: LiveEffectPreviewKind) => {
      setIsPlaying(false);
      setLiveEffectPreview((prev) => ({
        actorId,
        kind,
        seq: (prev?.seq ?? 0) + 1,
      }));
    },
    []
  );

  // Mic Recording State
  const micSessionRef = useRef<MicRecordingSession | null>(null);
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micDuration, setMicDuration] = useState(0);

  // Video Export State
  const [exportState, setExportState] = useState<ExportProgress>({
    active: false,
    progress: 0,
    statusText: '',
    downloadUrl: null,
    fileName: 'jit-3d-cartoon-story.webm',
  });
  const activeRecorderRef = useRef<{
    stop: () => Promise<{ blob: Blob; mimeType: string }>;
    cancel: () => void;
  } | null>(null);
  const exportCancelledRef = useRef(false);
  const exportPhaseRef = useRef<'idle' | 'preparing' | 'recording'>('idle');
  const exportSlugRef = useRef('jit-3d-cartoon-story');
  const exportPrepRafRef = useRef<number | null>(null);

  const activeScene = useMemo(
    () => scenes.find((s) => s.id === activeSceneId) || scenes[0],
    [scenes, activeSceneId]
  );

  const totalDuration = useMemo(
    () => scenes.reduce((acc, s) => acc + s.duration, 0),
    [scenes]
  );

  const sceneProgress = useMemo(() => {
    let acc = 0;
    for (const sc of scenes) {
      if (sc.id === activeScene.id) {
        const local = Math.max(0, storyElapsed - acc);
        return sc.duration > 0 ? Math.min(1, local / sc.duration) : 0;
      }
      acc += sc.duration;
    }
    return 0;
  }, [scenes, activeScene.id, storyElapsed]);

  const showNotice = useCallback((msg: string) => {
    setNoticeText(msg);
  }, []);

  useEffect(() => {
    if (!noticeText) return;
    const t = window.setTimeout(() => setNoticeText(null), 3500);
    return () => clearTimeout(t);
  }, [noticeText]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(customModels));
    } catch {
      // ignore storage quota errors
    }
  }, [customModels]);

  useEffect(() => {
    return () => {
      audioManagerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        showNotice('Fullscreen is blocked by this browser embed.');
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [showNotice]);

  const triggerCameraPose = useCallback((pose: CameraPose) => {
    setCameraPoseTrigger((prev) => ({ pose, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const handleCreateProject = useCallback(
    (cfg: NewProjectConfig) => {
      const nextScenes = createProjectFromConfig(cfg).map((s) =>
        cfg.customBackground
          ? { ...s, customBackground: cfg.customBackground }
          : s
      );
      audioManagerRef.current?.stop();
      historyPastRef.current = [];
      historyFutureRef.current = [];
      setHistoryTick((t) => t + 1);

      setCurrentProjectId(
        `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      );
      setProjectName(cfg.projectName);
      setAspectRatio(cfg.aspectRatio);
      setScenesRaw(nextScenes);
      setActiveSceneId(nextScenes[0].id);
      setSelectedActorId(nextScenes[0].actors[0]?.id ?? null);
      setModelControlsOpen(false);
      setMotionPathEditMode('idle');
      setIsPlaying(false);
      setStoryElapsed(0);
      setLiveEffectPreview(null);
      setHasCreatedProject(true);
      setShowNewProjectModal(false);
      triggerCameraPose(nextScenes[0].cameraPose);
      showNotice(
        cfg.templateId === 'blank'
          ? `Started blank project "${cfg.projectName}"`
          : `Loaded template for "${cfg.projectName}"`
      );
    },
    [showNotice, triggerCameraPose]
  );

  // Save Project, Auto-Save Draft, Resume, Delete & JSON File Import/Export
  const handleSaveProject = useCallback(() => {
    const cleanName = projectName.trim() || 'My Cartoon Story';
    const thumb = viewportRef.current?.captureThumbnail() ?? undefined;
    const record: SavedProjectRecord = {
      id: currentProjectId,
      projectName: cleanName,
      aspectRatio,
      scenes,
      updatedAt: Date.now(),
      thumbnailDataUrl: thumb,
    };
    const { saved, quotaTrimmed } = saveProjectToStorage(record);
    setSavedProjects(saved);
    saveAutoDraft(record);
    setAutoDraft(record);
    showNotice(
      quotaTrimmed
        ? `Saved "${cleanName}" (oversized uploads trimmed to fit storage).`
        : `Project "${cleanName}" saved!`
    );
  }, [aspectRatio, currentProjectId, projectName, scenes, showNotice]);

  // Debounced silent auto-draft backup while editing
  useEffect(() => {
    if (!hasCreatedProject || scenes.length === 0) return;
    const timer = window.setTimeout(() => {
      const draft: SavedProjectRecord = {
        id: currentProjectId,
        projectName: projectName.trim() || 'My Cartoon Story',
        aspectRatio,
        scenes,
        updatedAt: Date.now(),
      };
      saveAutoDraft(draft);
      setAutoDraft(draft);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [aspectRatio, currentProjectId, hasCreatedProject, projectName, scenes]);

  // Ctrl+S / Cmd+S shortcut to save project
  useEffect(() => {
    const onSaveKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (hasCreatedProject) {
          handleSaveProject();
        }
      }
    };
    window.addEventListener('keydown', onSaveKey);
    return () => window.removeEventListener('keydown', onSaveKey);
  }, [handleSaveProject, hasCreatedProject]);

  const handleResumeSavedProject = useCallback(
    (record: SavedProjectRecord) => {
      if (!record.scenes || record.scenes.length === 0) return;
      // Bump uidCounter above any restored numeric suffixes to prevent ID collisions
      for (const sc of record.scenes) {
        const sm = /-(\d+)$/.exec(sc.id);
        if (sm) uidCounter = Math.max(uidCounter, Number(sm[1]) + 10);
        for (const ac of sc.actors || []) {
          const am = /-(\d+)$/.exec(ac.id);
          if (am) uidCounter = Math.max(uidCounter, Number(am[1]) + 10);
        }
      }

      audioManagerRef.current?.stop();
      historyPastRef.current = [];
      historyFutureRef.current = [];
      setHistoryTick((t) => t + 1);

      setCurrentProjectId(record.id);
      setProjectName(record.projectName);
      setAspectRatio(record.aspectRatio);
      setScenesRaw(record.scenes);
      setActiveSceneId(record.scenes[0].id);
      setSelectedActorId(record.scenes[0].actors[0]?.id ?? null);
      setModelControlsOpen(false);
      setMotionPathEditMode('idle');
      setIsPlaying(false);
      setStoryElapsed(0);
      setLiveEffectPreview(null);
      setHasCreatedProject(true);
      setShowNewProjectModal(false);
      triggerCameraPose(record.scenes[0].cameraPose);
      showNotice(`Resumed "${record.projectName}"!`);
    },
    [showNotice, triggerCameraPose]
  );

  const handleDeleteSavedProject = useCallback(
    (id: string) => {
      const next = deleteSavedProjectFromStorage(id);
      setSavedProjects(next);
      showNotice('Deleted saved project.');
    },
    [showNotice]
  );

  const handleDownloadProjectJson = useCallback(
    (record?: SavedProjectRecord) => {
      const target: SavedProjectRecord = record ?? {
        id: currentProjectId,
        projectName: projectName.trim() || 'My Cartoon Story',
        aspectRatio,
        scenes,
        updatedAt: Date.now(),
      };
      downloadProjectAsJson(target);
      showNotice(`Downloaded "${target.projectName}" backup (.jit3d.json).`);
    },
    [aspectRatio, currentProjectId, projectName, scenes, showNotice]
  );

  const handleImportProjectJson = useCallback(
    async (file: File) => {
      try {
        const raw = await file.text();
        const imported = parseImportedProjectFile(raw);
        const { saved } = saveProjectToStorage(imported);
        setSavedProjects(saved);
        handleResumeSavedProject(imported);
      } catch (err) {
        showNotice(
          err instanceof Error
            ? err.message
            : 'Could not load that project JSON file.'
        );
      }
    },
    [handleResumeSavedProject, showNotice]
  );

  // Playback Loop
  const lastPlayedSceneIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPlaying) {
      audioManagerRef.current?.stop();
      lastPlayedSceneIdRef.current = null;
      return;
    }

    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      setStoryElapsed((prev) => {
        const next = prev + dt;
        if (next >= totalDuration) {
          setIsPlaying(false);
          audioManagerRef.current?.stop();
          return totalDuration;
        }
        return next;
      });

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, totalDuration]);

  // Sync Scene, Camera & Audio during Playback
  useEffect(() => {
    if (!isPlaying) return;

    let acc = 0;
    let targetScene = scenes[0];
    let sceneOffset = 0;
    for (const sc of scenes) {
      if (storyElapsed < acc + sc.duration || sc === scenes[scenes.length - 1]) {
        targetScene = sc;
        sceneOffset = Math.max(0, storyElapsed - acc);
        break;
      }
      acc += sc.duration;
    }

    if (targetScene && lastPlayedSceneIdRef.current !== targetScene.id) {
      lastPlayedSceneIdRef.current = targetScene.id;
      setActiveSceneId(targetScene.id);
      setSelectedActorId(null);
      triggerCameraPose(targetScene.cameraPose);

      const actorAudio = targetScene.actors.find((a) => a.audio?.url)?.audio;
      const trackUrl = actorAudio?.url || targetScene.audio?.url;
      audioManagerRef.current?.playSceneAudio(trackUrl, sceneOffset);
    }

    if (exportState.active && exportPhaseRef.current === 'recording') {
      const idx = scenes.findIndex((s) => s.id === targetScene.id) + 1;
      const nextProg = totalDuration > 0 ? Math.min(0.99, storyElapsed / totalDuration) : 0;
      const nextPct = Math.round(nextProg * 100);
      const dimsLabel =
        aspectRatio === '9:16'
          ? '1080×1920'
          : aspectRatio === '1:1'
            ? '1440×1440'
            : '1920×1080';
      const nextStatus = `Scene ${idx} of ${scenes.length} · ${dimsLabel} @ 60fps`;
      setExportState((prev) => {
        if (Math.round(prev.progress * 100) === nextPct && prev.statusText === nextStatus) {
          return prev;
        }
        return {
          ...prev,
          progress: nextProg,
          statusText: nextStatus,
        };
      });
    }
  }, [
    isPlaying,
    storyElapsed,
    scenes,
    totalDuration,
    triggerCameraPose,
    exportState.active,
    aspectRatio,
  ]);

  // Complete Video Export at end of story
  useEffect(() => {
    if (!exportState.active || exportPhaseRef.current !== 'recording') return;
    if (!isPlaying && storyElapsed >= totalDuration - 0.05 && activeRecorderRef.current) {
      exportPhaseRef.current = 'idle';
      const recorder = activeRecorderRef.current;
      activeRecorderRef.current = null;

      const finishTimer = window.setTimeout(() => {
        void recorder.stop().then(({ blob, mimeType }) => {
          if (exportCancelledRef.current) return;
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const fileName = `${exportSlugRef.current}-1080p.${ext}`;
          const url = URL.createObjectURL(blob);

          setExportState({
            active: false,
            progress: 1,
            statusText: 'Your 1080p HD cartoon movie is ready.',
            downloadUrl: url,
            fileName,
          });

          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });
      }, 110);

      return () => window.clearTimeout(finishTimer);
    }
  }, [exportState.active, isPlaying, storyElapsed, totalDuration]);

  // Timeline & Scene Operations
  const handleSelectScene = useCallback(
    (id: string) => {
      setIsPlaying(false);
      setMotionPathEditMode('idle');
      setModelControlsOpen(false);
      setActiveSceneId(id);
      const found = scenes.find((s) => s.id === id);
      if (found) {
        triggerCameraPose(found.cameraPose);
        setSelectedActorId(found.actors[0]?.id ?? null);
      }
      let offset = 0;
      for (const s of scenes) {
        if (s.id === id) break;
        offset += s.duration;
      }
      setStoryElapsed(offset);
    },
    [scenes, triggerCameraPose]
  );

  const handleScrubTimeline = useCallback(
    (sec: number) => {
      setIsPlaying(false);
      const clamped = Math.max(0, Math.min(totalDuration, sec));
      setStoryElapsed(clamped);
      let acc = 0;
      for (const sc of scenes) {
        if (clamped <= acc + sc.duration || sc === scenes[scenes.length - 1]) {
          if (sc.id !== activeSceneId) {
            setActiveSceneId(sc.id);
            triggerCameraPose(sc.cameraPose);
          }
          break;
        }
        acc += sc.duration;
      }
    },
    [activeSceneId, scenes, totalDuration, triggerCameraPose]
  );

  const handleChangeEnvironment = useCallback(
    (env: EnvironmentId) => {
      const cam = ENVIRONMENT_META[env].defaultCamera;
      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId
            ? { ...s, environment: env, cameraPose: { ...cam }, customBackground: null }
            : s
        )
      );
      triggerCameraPose(cam);
    },
    [activeSceneId, commitScenes, triggerCameraPose]
  );

  const handleChangeCustomBackground = useCallback(
    (bg: CustomBackgroundConfig | null) => {
      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId ? { ...s, customBackground: bg } : s
        )
      );
      showNotice(bg ? `Background set to "${bg.name}"` : 'Restored 3D environment backdrop');
    },
    [activeSceneId, commitScenes, showNotice]
  );

  const handleToggleCustomGround = useCallback(
    (show: boolean) => {
      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId && s.customBackground
            ? { ...s, customBackground: { ...s.customBackground, showGround: show } }
            : s
        )
      );
    },
    [activeSceneId, commitScenes]
  );

  const handleChangeLighting = useCallback(
    (lighting: LightingMode) => {
      commitScenes((prev) =>
        prev.map((s) => (s.id === activeSceneId ? { ...s, lighting } : s))
      );
    },
    [activeSceneId, commitScenes]
  );

  const handleApplyCameraPreset = useCallback(
    (preset: CameraPresetId) => {
      const pose = CAMERA_PRESETS[preset].pose;
      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId
            ? { ...s, cameraPreset: preset, cameraPose: { ...pose } }
            : s
        )
      );
      triggerCameraPose(pose);
    },
    [activeSceneId, commitScenes, triggerCameraPose]
  );

  const handleSaveCameraPose = useCallback(() => {
    const pose = viewportRef.current?.getCameraPose();
    if (!pose) return;
    commitScenes((prev) =>
      prev.map((s) =>
        s.id === activeSceneId ? { ...s, cameraPose: pose } : s
      )
    );
    showNotice('Camera angle saved to scene.');
  }, [activeSceneId, commitScenes, showNotice]);

  const handleResetCameraPose = useCallback(() => {
    const def = ENVIRONMENT_META[activeScene.environment].defaultCamera;
    commitScenes((prev) =>
      prev.map((s) =>
        s.id === activeSceneId
          ? { ...s, cameraPose: { ...def }, cameraPreset: 'wide' }
          : s
      )
    );
    triggerCameraPose(def);
  }, [activeScene.environment, activeSceneId, commitScenes, triggerCameraPose]);

  const handleChangeCameraZoom = useCallback(
    (cameraZoom: CameraZoomMode) => {
      commitScenes((prev) =>
        prev.map((s) => (s.id === activeSceneId ? { ...s, cameraZoom } : s))
      );
    },
    [activeSceneId, commitScenes]
  );

  // Add Characters (incl. Twins), Animals, Vehicles, Props & Custom Models via Activity Selector
  const computeNextSpawnPos = useCallback((): [number, number] => {
    const idx = activeScene.actors.length;
    const angle = idx * 1.15;
    const r = idx === 0 ? 0 : 1.55;
    return [
      Number((Math.cos(angle) * r).toFixed(2)),
      Number((Math.sin(angle) * r * 0.7).toFixed(2)),
    ];
  }, [activeScene.actors.length]);

  const handleOpenLibraryPicker = useCallback(
    (
      actorType: ActorType,
      kind: string,
      label: string,
      customBlueprint?: CustomModelBlueprint
    ) => {
      setActivityModalTarget({
        mode: 'spawn',
        actorType,
        kind,
        label,
        customBlueprint,
      });
    },
    []
  );

  const handleSelectActor = useCallback((id: string | null) => {
    setSelectedActorId((prev) => {
      if (prev !== id) setMotionPathEditMode('idle');
      return id;
    });
    if (id) {
      setActiveTab('cast');
      setModelControlsOpen(true);
    } else {
      setModelControlsOpen(false);
      setMotionPathEditMode('idle');
    }
  }, []);

  const handleSelectActorFromTimeline = useCallback(
    (id: string) => {
      handleSelectActor(id);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setMobileSheetOpen(true);
      }
    },
    [handleSelectActor]
  );

  const handleCloseModelControls = useCallback(() => {
    setModelControlsOpen(false);
    setMotionPathEditMode('idle');
  }, []);

  const handleOpenUpdateActivity = useCallback((actor: SceneActor) => {
    setActivityModalTarget({
      mode: 'update',
      actorId: actor.id,
      actorType: actor.actorType,
      kind: actor.kind,
      label: actor.name,
      currentAnimation: actor.animation,
      heldItemLeft: actor.heldItemLeft ?? null,
      heldItemRight: actor.heldItemRight ?? null,
    });
  }, []);

  const handleConfirmActivityFromModal = useCallback(
    (activity: AnimationState, heldSelection?: ActivityModalHeldSelection) => {
      const target = activityModalTarget;
      if (!target) return;

      if (target.mode === 'update') {
        commitScenes((prev) =>
          prev.map((s) =>
            s.id === activeSceneId
              ? {
                  ...s,
                  actors: s.actors.map((a) =>
                    a.id === target.actorId
                      ? {
                          ...a,
                          animation: activity,
                          ...(heldSelection
                            ? {
                                heldItemLeft: heldSelection.left ?? null,
                                heldItemRight: heldSelection.right ?? null,
                              }
                            : {}),
                        }
                      : a
                  ),
                }
              : s
          )
        );
        setActivityModalTarget(null);
        triggerEffectPreview(target.actorId, 'activity');
        return;
      }

      const [bx, bz] = computeNextSpawnPos();
      const autoRightHand =
        heldSelection?.right !== undefined
          ? heldSelection.right
          : target.actorType === 'character'
            ? activity === 'Reading Books'
              ? { itemKind: 'book' as HandheldItemKind, label: 'Book', scale: 1, rotationDeg: 0, offsetY: 0, offsetZ: 0 }
              : activity === 'Using Mobile Phone'
                ? { itemKind: 'phone' as HandheldItemKind, label: 'Mobile Phone', scale: 1, rotationDeg: 0, offsetY: 0, offsetZ: 0 }
                : activity === 'Playing Cricket'
                  ? { itemKind: 'cricketBat' as HandheldItemKind, label: 'Cricket Bat', scale: 1, rotationDeg: 0, offsetY: 0, offsetZ: 0 }
                  : activity === 'Magic Spell Cast'
                    ? { itemKind: 'magicWand' as HandheldItemKind, label: 'Magic Wand', scale: 1, rotationDeg: 0, offsetY: 0, offsetZ: 0 }
                    : null
            : null;
      const autoLeftHand = heldSelection?.left ?? null;

      // Spawn Twins as a synchronized side-by-side pair
      if (target.actorType === 'character' && target.kind === 'twins') {
        const pairColors = [CHARACTER_META.twins.defaultColor, '#38BDF8'];
        const twinA: SceneActor = {
          id: nextId('actor'),
          actorType: 'character',
          kind: 'twins',
          name: 'Twin A',
          position: [Number((bx - 0.52).toFixed(2)), bz],
          rotationY: 0,
          scale: 0.94,
          animation: activity,
          expression: 'Happy',
          dialogue: '',
          accentColor: pairColors[0],
          heldItemLeft: autoLeftHand,
          heldItemRight: autoRightHand,
          audio: null,
        };
        const twinB: SceneActor = {
          id: nextId('actor'),
          actorType: 'character',
          kind: 'twins',
          name: 'Twin B',
          position: [Number((bx + 0.52).toFixed(2)), bz],
          rotationY: 0,
          scale: 0.94,
          animation: activity,
          expression: 'Happy',
          dialogue: '',
          accentColor: pairColors[1],
          heldItemLeft: autoLeftHand,
          heldItemRight: autoRightHand,
          audio: null,
        };
        commitScenes((prev) =>
          prev.map((s) =>
            s.id === activeSceneId
              ? { ...s, actors: [...s.actors, twinA, twinB] }
              : s
          )
        );
        setSelectedActorId(twinA.id);
        setActiveTab('cast');
        setModelControlsOpen(true);
        setActivityModalTarget(null);
        setMobileSheetOpen(false);
        triggerEffectPreview(twinA.id, 'activity');
        return;
      }

      let defaultColor = '#3B82F6';
      if (target.actorType === 'character' && CHARACTER_META[target.kind as CharacterKind]) {
        defaultColor = CHARACTER_META[target.kind as CharacterKind].defaultColor;
      } else if (target.actorType === 'animal' && ANIMAL_META[target.kind as AnimalKind]) {
        defaultColor = ANIMAL_META[target.kind as AnimalKind].defaultColor;
      } else if (target.actorType === 'vehicle' && VEHICLE_META[target.kind as VehicleKind]) {
        defaultColor = VEHICLE_META[target.kind as VehicleKind].defaultColor;
      } else if (target.actorType === 'prop' && PROP_META[target.kind as PropKind]) {
        defaultColor = PROP_META[target.kind as PropKind].defaultColor;
      } else if (target.customBlueprint) {
        defaultColor = target.customBlueprint.parts[0]?.color || '#3B82F6';
      }

      const count =
        activeScene.actors.filter(
          (a) => a.actorType === target.actorType && a.kind === target.kind
        ).length + 1;

      const actor: SceneActor = {
        id: nextId(target.actorType),
        actorType: target.actorType,
        kind: target.kind,
        customBlueprint: target.customBlueprint,
        name:
          target.actorType === 'custom'
            ? target.label
            : `${target.label} ${count}`,
        position: [bx, bz],
        rotationY: 0,
        scale: 1,
        animation: activity,
        expression: 'Happy',
        dialogue: '',
        accentColor: defaultColor,
        heldItemLeft: autoLeftHand,
        heldItemRight: autoRightHand,
        audio: null,
      };

      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId ? { ...s, actors: [...s.actors, actor] } : s
        )
      );
      setSelectedActorId(actor.id);
      setActiveTab('cast');
      setModelControlsOpen(true);
      setActivityModalTarget(null);
      setMobileSheetOpen(false);
      triggerEffectPreview(actor.id, 'activity');
    },
    [
      activeScene.actors,
      activeSceneId,
      activityModalTarget,
      commitScenes,
      computeNextSpawnPos,
      triggerEffectPreview,
    ]
  );

  const handleDeleteCustomModel = useCallback((id: string) => {
    setCustomModels((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleUpdateActor = useCallback(
    (actorId: string, patch: Partial<SceneActor>) => {
      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId
            ? {
                ...s,
                actors: s.actors.map((a) =>
                  a.id === actorId ? { ...a, ...patch } : a
                ),
              }
            : s
        )
      );
    },
    [activeSceneId, commitScenes]
  );

  // Dragging moves update position smoothly without spamming 60 undo entries per second
  const handleMoveActor = useCallback(
    (actorId: string, x: number, z: number) => {
      const clampX = (v: number) => Number(Math.max(-7.8, Math.min(7.8, v)).toFixed(2));
      const clampZ = (v: number) => Number(Math.max(-6.5, Math.min(6.5, v)).toFixed(2));
      setScenesRaw((prev) =>
        prev.map((s) =>
          s.id === activeSceneId
            ? {
                ...s,
                actors: s.actors.map((a) => {
                  if (a.id !== actorId) return a;
                  const dx = x - a.position[0];
                  const dz = z - a.position[1];
                  return {
                    ...a,
                    position: [x, z],
                    motionPath: a.motionPath
                      ? {
                          ...a.motionPath,
                          points: a.motionPath.points.map(([px, pz]) => [
                            clampX(px + dx),
                            clampZ(pz + dz),
                          ]),
                        }
                      : undefined,
                    walkPath: a.walkPath
                      ? {
                          ...a.walkPath,
                          start: [x, z],
                          end: [
                            clampX(a.walkPath.end[0] + dx),
                            clampZ(a.walkPath.end[1] + dz),
                          ],
                        }
                      : undefined,
                  };
                }),
              }
            : s
        )
      );
    },
    [activeSceneId]
  );

  const handleUpdateMotionPathPoints = useCallback(
    (
      actorId: string,
      points: Array<[number, number]>,
      options?: { commit?: boolean; exitEditMode?: boolean }
    ) => {
      const updater = (prev: SceneData[]): SceneData[] =>
        prev.map((s) =>
          s.id === activeSceneId
            ? {
                ...s,
                actors: s.actors.map((a) => {
                  if (a.id !== actorId) return a;
                  const mode = a.motionPath?.mode ?? 'straight';
                  const cornerStyle =
                    a.motionPath?.cornerStyle ??
                    (mode === 'freehand' ? 'rounded' : 'sharp');
                  const nextPos: [number, number] =
                    points.length >= 1
                      ? [points[0][0], points[0][1]]
                      : a.position;
                  return {
                    ...a,
                    position: nextPos,
                    motionPath: {
                      enabled: true,
                      mode,
                      cornerStyle,
                      speed: a.motionPath?.speed ?? 1.0,
                      points,
                    },
                    walkPath: undefined,
                  };
                }),
              }
            : s
        );

      if (options?.commit === false) {
        setScenesRaw(updater);
      } else {
        commitScenes(updater, true);
        if (points.length >= 2) {
          triggerEffectPreview(actorId, 'motionPath');
        }
      }
      if (options?.exitEditMode) {
        setMotionPathEditMode('idle');
      }
    },
    [activeSceneId, commitScenes, triggerEffectPreview]
  );

  const handleAppendMotionWaypoint = useCallback(
    (actorId: string, x: number, z: number) => {
      let shouldPreview = false;
      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId
            ? {
                ...s,
                actors: s.actors.map((a) => {
                  if (a.id !== actorId) return a;
                  const existingPts =
                    a.motionPath?.points && a.motionPath.points.length >= 1
                      ? a.motionPath.points
                      : a.walkPath?.enabled
                        ? [a.walkPath.start, a.walkPath.end]
                        : [a.position];
                  const nextPts: Array<[number, number]> = [
                    ...existingPts,
                    [x, z],
                  ];
                  if (nextPts.length >= 2) shouldPreview = true;
                  return {
                    ...a,
                    motionPath: {
                      enabled: true,
                      mode: 'multiPoint',
                      cornerStyle: a.motionPath?.cornerStyle ?? 'rounded',
                      speed: a.motionPath?.speed ?? 1.0,
                      points: nextPts,
                    },
                    walkPath: undefined,
                  };
                }),
              }
            : s
        )
      );
      if (shouldPreview) {
        triggerEffectPreview(actorId, 'motionPath');
      }
    },
    [activeSceneId, commitScenes, triggerEffectPreview]
  );

  const handlePreviewActorTransitions = useCallback(
    (actor: SceneActor) => {
      let sceneOffset = 0;
      for (const sc of scenes) {
        if (sc.id === activeSceneId) break;
        sceneOffset += sc.duration;
      }
      const actorStart = Math.max(
        0,
        Math.min(activeScene.duration - 0.25, actor.startTime ?? 0)
      );
      setMotionPathEditMode('idle');
      lastPlayedSceneIdRef.current = null;
      setStoryElapsed(sceneOffset + actorStart);
      setIsPlaying(true);
    },
    [activeScene.duration, activeSceneId, scenes]
  );

  const handleDuplicateActor = useCallback(
    (actorId: string) => {
      const src = activeScene.actors.find((a) => a.id === actorId);
      if (!src) return;
      const copy: SceneActor = {
        ...src,
        id: nextId('actor'),
        name: `${src.name} Copy`,
        position: [
          Math.min(5.5, src.position[0] + 0.9),
          Math.min(5, src.position[1] + 0.4),
        ],
      };
      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId ? { ...s, actors: [...s.actors, copy] } : s
        )
      );
      setSelectedActorId(copy.id);
    },
    [activeScene.actors, activeSceneId, commitScenes]
  );

  const handleDeleteActor = useCallback(
    (actorId: string) => {
      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId
            ? { ...s, actors: s.actors.filter((a) => a.id !== actorId) }
            : s
        )
      );
      setSelectedActorId((prev) => {
        if (prev === actorId) {
          setModelControlsOpen(false);
          return null;
        }
        return prev;
      });
    },
    [activeSceneId, commitScenes]
  );

  // Scene Strip Actions
  const handleAddScene = useCallback(() => {
    const envs: EnvironmentId[] = ['village', 'classroom', 'park', 'palace', 'forest', 'studio'];
    const nextEnv = envs[scenes.length % envs.length];
    const cam = ENVIRONMENT_META[nextEnv].defaultCamera;
    const newScene: SceneData = {
      id: nextId('scene'),
      title: `Scene ${scenes.length + 1}`,
      environment: nextEnv,
      lighting: nextEnv === 'forest' ? 'night' : 'day',
      duration: 6,
      cameraPose: { ...cam },
      cameraPreset: 'wide',
      cameraZoom: 'none',
      audio: null,
      actors: activeScene.actors.map((a) => ({
        ...a,
        id: nextId('actor'),
      })),
    };
    commitScenes((prev) => [...prev, newScene]);
    setActiveSceneId(newScene.id);
    setSelectedActorId(newScene.actors[0]?.id ?? null);
    triggerCameraPose(cam);
  }, [activeScene.actors, commitScenes, scenes.length, triggerCameraPose]);

  const handleDuplicateScene = useCallback(
    (sceneId: string) => {
      const idx = scenes.findIndex((s) => s.id === sceneId);
      if (idx === -1) return;
      const src = scenes[idx];
      const dup: SceneData = {
        ...src,
        id: nextId('scene'),
        title: `${src.title} Copy`,
        cameraPose: {
          position: [...src.cameraPose.position],
          target: [...src.cameraPose.target],
        },
        actors: src.actors.map((a) => ({ ...a, id: nextId('actor') })),
      };
      commitScenes((prev) => {
        const copy = [...prev];
        copy.splice(idx + 1, 0, dup);
        return copy;
      });
      setActiveSceneId(dup.id);
    },
    [commitScenes, scenes]
  );

  const handleReorderScene = useCallback(
    (sceneId: string, dir: -1 | 1) => {
      commitScenes((prev) => {
        const idx = prev.findIndex((s) => s.id === sceneId);
        const target = idx + dir;
        if (idx === -1 || target < 0 || target >= prev.length) return prev;
        const copy = [...prev];
        const [item] = copy.splice(idx, 1);
        copy.splice(target, 0, item);
        return copy;
      });
    },
    [commitScenes]
  );

  const handleDeleteScene = useCallback(
    (sceneId: string) => {
      if (scenes.length <= 1) return;
      const idx = scenes.findIndex((s) => s.id === sceneId);
      const remaining = scenes.filter((s) => s.id !== sceneId);
      commitScenes(() => remaining);
      if (activeSceneId === sceneId) {
        const nextScene = remaining[Math.max(0, idx - 1)];
        setActiveSceneId(nextScene.id);
        triggerCameraPose(nextScene.cameraPose);
      }
    },
    [activeSceneId, commitScenes, scenes, triggerCameraPose]
  );

  const handleUpdateSceneDuration = useCallback(
    (sceneId: string, duration: number) => {
      commitScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, duration } : s))
      );
    },
    [commitScenes]
  );

  const handleUpdateActorTiming = useCallback(
    (
      actorId: string,
      field: ActorTrackField,
      startTime: number,
      endTime: number
    ) => {
      setScenesRaw((prev) =>
        prev.map((s) => {
          if (s.id !== activeSceneId) return s;
          return {
            ...s,
            actors: s.actors.map((a) => {
              if (a.id !== actorId) return a;
              if (field === 'activity') return { ...a, startTime, endTime };
              if (field === 'prop') return { ...a, propStartTime: startTime, propEndTime: endTime };
              return { ...a, voiceStartTime: startTime, voiceEndTime: endTime };
            }),
          };
        })
      );
    },
    [activeSceneId]
  );

  const handleUpdateSceneCameraTiming = useCallback(
    (sceneId: string, cameraStartTime: number, cameraEndTime: number) => {
      setScenesRaw((prev) =>
        prev.map((s) =>
          s.id === sceneId ? { ...s, cameraStartTime, cameraEndTime } : s
        )
      );
    },
    []
  );

  // Playback Controls
  const handleTogglePlayStory = useCallback(() => {
    setMotionPathEditMode('idle');
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (storyElapsed >= totalDuration - 0.05) {
        setStoryElapsed(0);
      }
      lastPlayedSceneIdRef.current = null;
      setIsPlaying(true);
    }
  }, [isPlaying, storyElapsed, totalDuration]);

  const handleStopPlayback = useCallback(() => {
    setMotionPathEditMode('idle');
    setIsPlaying(false);
    setStoryElapsed(0);
    lastPlayedSceneIdRef.current = null;
    if (scenes[0]) {
      setActiveSceneId(scenes[0].id);
      triggerCameraPose(scenes[0].cameraPose);
    }
  }, [scenes, triggerCameraPose]);

  // Mic Recording & Audio Upload
  useEffect(() => {
    if (!isRecordingMic) return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      setMicDuration((performance.now() - started) / 1000);
    }, 100);
    return () => clearInterval(timer);
  }, [isRecordingMic]);

  const handleToggleMicRecord = useCallback(
    async (targetActorId: string | null) => {
      if (isRecordingMic && micSessionRef.current) {
        const session = micSessionRef.current;
        micSessionRef.current = null;
        setIsRecordingMic(false);
        const { url, durationSec } = await session.stop();
        if (url) {
          const track = {
            url,
            name: `Voice (${durationSec.toFixed(1)}s)`,
            durationSec,
          };
          commitScenes((prev) =>
            prev.map((s) => {
              if (s.id !== activeSceneId) return s;
              if (targetActorId) {
                return {
                  ...s,
                  actors: s.actors.map((a) =>
                    a.id === targetActorId ? { ...a, audio: track } : a
                  ),
                };
              }
              return { ...s, audio: track };
            })
          );
          showNotice('Voiceover saved.');
        }
        return;
      }

      try {
        const session = await startMicRecording();
        micSessionRef.current = session;
        setMicDuration(0);
        setIsRecordingMic(true);
      } catch {
        showNotice('Microphone access denied or unavailable.');
      }
    },
    [activeSceneId, commitScenes, isRecordingMic, showNotice]
  );

  const handleUploadAudio = useCallback(
    (targetActorId: string | null, file: File) => {
      const url = URL.createObjectURL(file);
      const track = { url, name: file.name };
      commitScenes((prev) =>
        prev.map((s) => {
          if (s.id !== activeSceneId) return s;
          if (targetActorId) {
            return {
              ...s,
              actors: s.actors.map((a) =>
                a.id === targetActorId ? { ...a, audio: track } : a
              ),
            };
          }
          return { ...s, audio: track };
        })
      );
      showNotice(`Loaded audio: ${file.name}`);
    },
    [activeSceneId, commitScenes, showNotice]
  );

  const handleClearAudio = useCallback(
    (targetActorId: string | null) => {
      commitScenes((prev) =>
        prev.map((s) => {
          if (s.id !== activeSceneId) return s;
          if (targetActorId) {
            return {
              ...s,
              actors: s.actors.map((a) =>
                a.id === targetActorId ? { ...a, audio: null } : a
              ),
            };
          }
          return { ...s, audio: null };
        })
      );
    },
    [activeSceneId, commitScenes]
  );

  // AI Prompt-to-3D Model Generator (with Smart Offline Fallback)
  const handleGenerateAIModel = useCallback(
    async (prompt: string): Promise<CustomModelBlueprint | null> => {
      if (!isOnline) {
        const fallback = generateOfflineProceduralModel(prompt);
        setCustomModels((prev) => [fallback, ...prev]);
        showNotice('Offline: built with local procedural 3D generator.');
        return fallback;
      }

      try {
        const resp = await fetch('/api/ai/generate-3d-model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const data = await resp.json();

        if (!resp.ok) {
          if (data?.code === 'MISSING_API_KEY') {
            const fallback = generateOfflineProceduralModel(prompt);
            setCustomModels((prev) => [fallback, ...prev]);
            showNotice(
              'GEMINI_API_KEY not set — generated with local procedural builder.'
            );
            return fallback;
          }
          showNotice(data?.error || 'Failed to generate 3D model.');
          return null;
        }

        const rawBp = data.blueprint;
        const bp: CustomModelBlueprint = {
          id: `ai-${Date.now()}`,
          name: String(rawBp?.name || prompt).slice(0, 28),
          category: ['character', 'creature', 'vehicle', 'prop'].includes(
            rawBp?.category
          )
            ? rawBp.category
            : 'prop',
          prompt,
          source: 'gemini',
          createdAt: Date.now(),
          style: rawBp?.style,
          parts: Array.isArray(rawBp?.parts) ? rawBp.parts : [],
        };
        if (bp.parts.length === 0) {
          const fallback = generateOfflineProceduralModel(prompt);
          setCustomModels((prev) => [fallback, ...prev]);
          return fallback;
        }
        setCustomModels((prev) => [bp, ...prev]);
        showNotice(`AI built "${bp.name}" (saved for 60 days)!`);
        return bp;
      } catch {
        const fallback = generateOfflineProceduralModel(prompt);
        setCustomModels((prev) => [fallback, ...prev]);
        showNotice('Network unavailable — built with local procedural 3D generator.');
        return fallback;
      }
    },
    [isOnline, showNotice]
  );

  // Build AI 3D Prop directly into a character's Left or Right Hand
  const handleGenerateHandheldAIProp = useCallback(
    async (actorId: string, hand: 'left' | 'right', prompt: string) => {
      let bp: CustomModelBlueprint | null = null;
      if (!isOnline) {
        bp = generateOfflineProceduralModel(prompt);
      } else {
        try {
          const resp = await fetch('/api/ai/generate-3d-model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          });
          const data = await resp.json();
          if (resp.ok && Array.isArray(data?.blueprint?.parts) && data.blueprint.parts.length > 0) {
            bp = {
              id: `hand-ai-${Date.now()}`,
              name: String(data.blueprint.name || prompt).slice(0, 22),
              category: 'prop',
              prompt,
              source: 'gemini',
              createdAt: Date.now(),
              style: data.blueprint.style,
              parts: data.blueprint.parts,
            };
          } else {
            bp = generateOfflineProceduralModel(prompt);
          }
        } catch {
          bp = generateOfflineProceduralModel(prompt);
        }
      }

      if (!bp) return;
      const attachment = {
        itemKind: 'custom3D' as HandheldItemKind,
        label: bp.name,
        customBlueprint: bp,
        scale: 1,
        rotationDeg: 0,
        offsetY: 0,
        offsetZ: 0,
      };
      commitScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId
            ? {
                ...s,
                actors: s.actors.map((a) =>
                  a.id === actorId
                    ? hand === 'left'
                      ? { ...a, heldItemLeft: attachment }
                      : { ...a, heldItemRight: attachment }
                    : a
                ),
              }
            : s
        )
      );
      showNotice(`Attached "${bp.name}" to ${hand} hand.`);
    },
    [activeSceneId, commitScenes, isOnline, showNotice]
  );

  // Upload Custom PNG/JPG Character/Prop Cutout OR .GLB/.GLTF 3D File into Library & Open Activity Picker
  const handleUploadCustomAsset = useCallback(
    async (
      file: File,
      opts: { category: 'character' | 'prop'; removeBg: boolean }
    ) => {
      const isGlb = /\.(glb|gltf)$/i.test(file.name) || file.type.includes('gltf');
      const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 26) || 'Custom Asset';

      const readFileAsDataUrl = (f: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(f);
        });

      let bp: CustomModelBlueprint;
      if (isGlb) {
        const glbUrl =
          file.size <= 2_500_000
            ? await readFileAsDataUrl(file)
            : URL.createObjectURL(file);
        bp = {
          id: `upload-glb-${Date.now()}`,
          name: cleanName,
          category: opts.category,
          prompt: `Uploaded 3D file: ${file.name}`,
          source: 'upload',
          createdAt: Date.now(),
          assetType: 'glb',
          glbUrl,
          parts: [],
        };
      } else {
        const imageDataUrl = await readFileAsDataUrl(file);
        bp = {
          id: `upload-img-${Date.now()}`,
          name: cleanName,
          category: opts.category,
          prompt: `Uploaded image cutout: ${file.name}`,
          source: 'upload',
          createdAt: Date.now(),
          assetType: 'cutout',
          imageDataUrl,
          removeBg: opts.removeBg,
          parts: [],
        };
      }

      setCustomModels((prev) => [bp, ...prev]);
      handleOpenLibraryPicker('custom', bp.id, bp.name, bp);
      showNotice(`Imported "${bp.name}"! Choose an activity to place on stage.`);
    },
    [handleOpenLibraryPicker, showNotice]
  );

  // Upload .GLB/.GLTF directly into a Character's Left or Right Hand
  const handleUploadHandheldGLB = useCallback(
    (actorId: string, hand: 'left' | 'right', file: File) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || '3D Prop';
      const attach = (glbUrl: string) => {
        const attachment = {
          itemKind: 'customGLB' as HandheldItemKind,
          label: cleanName,
          glbUrl,
          scale: 1,
          rotationDeg: 0,
          offsetY: 0,
          offsetZ: 0,
        };
        commitScenes((prev) =>
          prev.map((s) =>
            s.id === activeSceneId
              ? {
                  ...s,
                  actors: s.actors.map((a) =>
                    a.id === actorId
                      ? hand === 'left'
                        ? { ...a, heldItemLeft: attachment }
                        : { ...a, heldItemRight: attachment }
                      : a
                  ),
                }
              : s
          )
        );
        showNotice(`Equipped "${cleanName}" in ${hand} hand.`);
      };

      if (file.size <= 2_500_000) {
        const reader = new FileReader();
        reader.onload = () => {
          const url = typeof reader.result === 'string' ? reader.result : '';
          if (url) attach(url);
        };
        reader.readAsDataURL(file);
      } else {
        attach(URL.createObjectURL(file));
      }
    },
    [activeSceneId, commitScenes, showNotice]
  );

  // AI Story Writer
  const handleGenerateAIStory = useCallback(
    async (
      idea: string,
      language: 'English' | 'Bengali' | 'Bilingual'
    ): Promise<GeneratedStoryScript | null> => {
      try {
        const resp = await fetch('/api/ai/generate-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea, language }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          showNotice(
            data?.error || 'Could not generate story script. Check Gemini API key in Secrets.'
          );
          return null;
        }
        return data.script as GeneratedStoryScript;
      } catch {
        showNotice('Network error while contacting AI Story Writer.');
        return null;
      }
    },
    [showNotice]
  );

  const handleLoadStoryScript = useCallback(
    (script: GeneratedStoryScript) => {
      if (!script?.scenes?.length) return;
      const validEnvs: EnvironmentId[] = ['village', 'classroom', 'park', 'palace', 'forest', 'studio'];
      const validExprs: FacialExpression[] = ['Happy', 'Sad', 'Surprised', 'Angry'];
      const validHandhelds = new Set(HANDHELD_ITEM_META.map((h) => h.id));

      const mappedScenes: SceneData[] = script.scenes.map((sc, idx) => {
        const env: EnvironmentId = validEnvs.includes(sc.environment as EnvironmentId)
          ? (sc.environment as EnvironmentId)
          : 'village';
        const lighting: LightingMode =
          sc.lighting === 'sunset' || sc.lighting === 'night' ? sc.lighting : 'day';
        const preset: CameraPresetId =
          sc.cameraPreset && sc.cameraPreset in CAMERA_PRESETS
            ? (sc.cameraPreset as CameraPresetId)
            : 'wide';
        const zoom: CameraZoomMode =
          sc.cameraZoom === 'zoomIn' || sc.cameraZoom === 'zoomOut'
            ? sc.cameraZoom
            : 'none';

        const actors: SceneActor[] = (sc.cast || []).map((c, cIdx) => {
          let actorType: ActorType = 'character';
          let kind = c.kind;
          let accentColor = CHARACTER_META.boy.defaultColor;
          let label = c.name || 'Character';

          if (kind in ANIMAL_META) {
            actorType = 'animal';
            accentColor = ANIMAL_META[kind as AnimalKind].defaultColor;
            label = c.name || ANIMAL_META[kind as AnimalKind].label;
          } else if (kind in VEHICLE_META) {
            actorType = 'vehicle';
            accentColor = VEHICLE_META[kind as VehicleKind].defaultColor;
            label = c.name || VEHICLE_META[kind as VehicleKind].label;
          } else if (kind in CHARACTER_META) {
            actorType = 'character';
            accentColor = CHARACTER_META[kind as CharacterKind].defaultColor;
            label = c.name || CHARACTER_META[kind as CharacterKind].label;
          } else {
            actorType = 'character';
            kind = 'boy';
            accentColor = CHARACTER_META.boy.defaultColor;
          }

          const expression: FacialExpression = validExprs.includes(
            c.expression as FacialExpression
          )
            ? (c.expression as FacialExpression)
            : 'Happy';
          const sx = Number.isFinite(c.x) ? Math.max(-4.5, Math.min(4.5, c.x)) : (cIdx - 1) * 1.6;
          const sz = Number.isFinite(c.z) ? Math.max(-3.5, Math.min(3.5, c.z)) : 0;
          const hasWalk =
            typeof c.walkToX === 'number' &&
            typeof c.walkToZ === 'number' &&
            (Math.abs(c.walkToX - sx) > 0.3 || Math.abs(c.walkToZ - sz) > 0.3);

          const heldKind =
            actorType === 'character' &&
            c.heldItem &&
            c.heldItem !== 'none' &&
            validHandhelds.has(c.heldItem as HandheldItemKind)
              ? (c.heldItem as HandheldItemKind)
              : null;

          return {
            id: nextId('actor'),
            actorType,
            kind,
            name: label,
            position: [sx, sz],
            rotationY: 0,
            scale: 1,
            animation: (c.animation as AnimationState) || 'Talk (Lip-Sync)',
            expression,
            dialogue: c.dialogue || '',
            accentColor,
            heldItemRight: heldKind
              ? {
                  itemKind: heldKind,
                  label:
                    HANDHELD_ITEM_META.find((h) => h.id === heldKind)?.label ||
                    heldKind,
                  scale: 1,
                  rotationDeg: 0,
                  offsetY: 0,
                  offsetZ: 0,
                }
              : null,
            walkPath: hasWalk
              ? {
                  enabled: true,
                  start: [sx, sz],
                  end: [
                    Math.max(-6, Math.min(6, c.walkToX!)),
                    Math.max(-5, Math.min(5, c.walkToZ!)),
                  ],
                }
              : undefined,
            audio: null,
          };
        });

        return {
          id: nextId('scene'),
          title: sc.title || `Scene ${idx + 1}`,
          environment: env,
          lighting,
          duration: Math.max(3, Math.min(20, Math.round(sc.duration || 6))),
          cameraPose: { ...CAMERA_PRESETS[preset].pose },
          cameraPreset: preset,
          cameraZoom: zoom,
          actors,
          audio: null,
        };
      });

      commitScenes(() => mappedScenes);
      setActiveSceneId(mappedScenes[0].id);
      setSelectedActorId(mappedScenes[0].actors[0]?.id ?? null);
      setStoryElapsed(0);
      triggerCameraPose(mappedScenes[0].cameraPose);
      showNotice(`Loaded "${script.storyTitle}" (${mappedScenes.length} scenes)!`);
    },
    [commitScenes, showNotice, triggerCameraPose]
  );

  // Video Export (1080p Full HD @ 60fps, 12 Mbps)
  const handleExportVideo = useCallback(() => {
    if (!viewportRef.current || exportPhaseRef.current !== 'idle') return;
    setMotionPathEditMode('idle');
    setModelControlsOpen(false);
    audioManagerRef.current?.stop();
    const audioStream = audioManagerRef.current?.getExportAudioStream() ?? null;

    if (exportState.downloadUrl) {
      URL.revokeObjectURL(exportState.downloadUrl);
    }

    const exportSlug =
      projectName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'jit-3d-cartoon-story';
    exportSlugRef.current = exportSlug;

    const dimsLabel =
      aspectRatio === '9:16'
        ? '1080×1920'
        : aspectRatio === '1:1'
          ? '1440×1440'
          : '1920×1080';

    exportCancelledRef.current = false;
    exportPhaseRef.current = 'preparing';
    setIsPlaying(false);
    setStoryElapsed(0);
    lastPlayedSceneIdRef.current = null;
    setActiveSceneId(scenes[0].id);
    setSelectedActorId(null);
    viewportRef.current.snapToCameraPose(scenes[0].cameraPose);

    setExportState({
      active: true,
      progress: 0,
      statusText: `Preparing ${dimsLabel} 1080p HD Studio...`,
      downloadUrl: null,
      fileName: `${exportSlug}-1080p.webm`,
    });

    // Wait 2 animation frames so Scene 1 & 00:00.0 state commit cleanly before Frame 0 capture
    if (exportPrepRafRef.current !== null) {
      cancelAnimationFrame(exportPrepRafRef.current);
    }
    exportPrepRafRef.current = requestAnimationFrame(() => {
      exportPrepRafRef.current = requestAnimationFrame(() => {
        exportPrepRafRef.current = null;
        if (exportCancelledRef.current || !viewportRef.current) return;

        viewportRef.current.snapToCameraPose(scenes[0].cameraPose);
        const recorder = viewportRef.current.startVideoCapture(audioStream);
        if (!recorder) {
          exportPhaseRef.current = 'idle';
          setExportState((prev) => ({ ...prev, active: false, progress: 0 }));
          showNotice('Video recording is not supported in this browser.');
          return;
        }

        activeRecorderRef.current = recorder;
        exportPhaseRef.current = 'recording';
        setExportState((prev) => ({
          ...prev,
          progress: 0,
          statusText: `Scene 1 of ${scenes.length} · ${dimsLabel} @ 60fps`,
        }));
        setIsPlaying(true);
      });
    });
  }, [aspectRatio, exportState.downloadUrl, projectName, scenes, showNotice]);

  const handleCancelExport = useCallback(() => {
    exportCancelledRef.current = true;
    exportPhaseRef.current = 'idle';
    if (exportPrepRafRef.current !== null) {
      cancelAnimationFrame(exportPrepRafRef.current);
      exportPrepRafRef.current = null;
    }
    activeRecorderRef.current?.cancel();
    activeRecorderRef.current = null;
    audioManagerRef.current?.stop();
    setIsPlaying(false);
    setExportState((prev) => ({ ...prev, active: false, progress: 0 }));
  }, []);

  const handleCloseExportModal = useCallback(() => {
    setExportState((prev) => ({ ...prev, downloadUrl: null, active: false }));
  }, []);

  const mobileTabs: Array<{ id: InspectorTab; label: string; icon: React.ReactNode }> = [
    { id: 'cast', label: 'Library', icon: <Users className="w-4 h-4" /> },
    { id: 'scene', label: 'Scene', icon: <Mountain className="w-4 h-4" /> },
    { id: 'ai3d', label: 'AI 3D', icon: <Box className="w-4 h-4" /> },
    { id: 'voice', label: 'Voice/AI', icon: <Wand2 className="w-4 h-4" /> },
  ];

  return (
    <div className="h-dvh w-screen flex flex-col bg-[#0B0E14] text-slate-100 overflow-hidden">
      {/* 1. Top Header */}
      <TopHeader
        projectName={projectName}
        hasCreatedProject={hasCreatedProject}
        canUndo={historyPastRef.current.length > 0}
        canRedo={historyFutureRef.current.length > 0}
        isFullscreen={isFullscreen}
        isExporting={exportState.active}
        onNewProject={() => setShowNewProjectModal(true)}
        onSaveProject={handleSaveProject}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleFullscreen={handleToggleFullscreen}
        onExportVideo={handleExportVideo}
      />

      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1 text-[11px] text-amber-200 flex items-center justify-center gap-2 shrink-0">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode — Local 3D Builder & Scene Studio remain active.</span>
        </div>
      )}

      {/* 2. Center Studio Workspace */}
      <div className="flex-1 min-h-[calc(max(260px,42dvh)+2.5rem)] flex overflow-hidden relative">
        <main className="flex-1 min-w-0 min-h-[calc(max(260px,42dvh)+2.5rem)] flex flex-col overflow-hidden">
          {/* Viewport Aspect Switcher Bar (16:9 / 9:16 / 1:1) */}
          <div className="h-10 shrink-0 bg-[#0E131D] border-b border-white/8 px-3 sm:px-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center p-0.5 rounded-lg bg-[#171E2E] border border-white/10"
                role="group"
                aria-label="Viewport aspect ratio"
              >
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    aspectRatio === '16:9'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3 h-3" />
                  <span>16:9</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    aspectRatio === '9:16'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>9:16</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('1:1')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    aspectRatio === '1:1'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <SquareIcon className="w-3 h-3" />
                  <span>1:1</span>
                </button>
              </div>

              <span className="hidden lg:inline text-xs text-slate-400 truncate">
                {ENVIRONMENT_META[activeScene.environment].label} ·{' '}
                {activeScene.lighting}
              </span>
            </div>

            {noticeText ? (
              <span className="text-xs text-amber-300 truncate max-w-[200px] sm:max-w-sm">
                {noticeText}
              </span>
            ) : (
              (() => {
                const sel = activeScene.actors.find((a) => a.id === selectedActorId);
                if (!sel) return null;
                return (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="hidden sm:inline text-xs text-amber-300 font-medium truncate max-w-[110px]">
                      {sel.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('cast');
                        setModelControlsOpen(true);
                        if (typeof window !== 'undefined' && window.innerWidth < 768) {
                          setMobileSheetOpen(true);
                        }
                      }}
                      className="px-2 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-[11px] font-medium text-sky-200 cursor-pointer whitespace-nowrap"
                    >
                      Motion & Effects
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenUpdateActivity(sel)}
                      className="px-2 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-[11px] font-medium text-amber-300 cursor-pointer whitespace-nowrap"
                    >
                      Activity
                    </button>
                  </div>
                );
              })()
            )}
          </div>

          {/* 3D WebGL Canvas */}
          <StudioViewport
            ref={viewportRef}
            environment={activeScene.environment}
            lighting={activeScene.lighting}
            customBackground={activeScene.customBackground ?? null}
            actors={activeScene.actors}
            selectedActorId={selectedActorId}
            aspectRatio={aspectRatio}
            isPlaying={isPlaying}
            isScrubbing={isScrubbing}
            isExporting={exportState.active}
            sceneProgress={sceneProgress}
            sceneDuration={activeScene.duration}
            baseCameraPose={activeScene.cameraPose}
            cameraZoom={activeScene.cameraZoom}
            cameraStartTime={activeScene.cameraStartTime}
            cameraEndTime={activeScene.cameraEndTime}
            cameraPoseTrigger={cameraPoseTrigger}
            liveEffectPreview={liveEffectPreview}
            motionPathEditMode={motionPathEditMode}
            audioManager={audioManagerRef.current}
            onSelectActor={handleSelectActor}
            onMoveActor={handleMoveActor}
            onUpdateMotionPathPoints={handleUpdateMotionPathPoints}
            onAppendMotionWaypoint={handleAppendMotionWaypoint}
          />
        </main>

        {/* Right Desktop Inspector + Mobile Bottom Sheet */}
        <InspectorPanel
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          mobileSheetOpen={mobileSheetOpen}
          onCloseMobileSheet={() => setMobileSheetOpen(false)}
          activeScene={activeScene}
          selectedActorId={selectedActorId}
          modelControlsOpen={modelControlsOpen}
          onCloseModelControls={handleCloseModelControls}
          customModels={customModels}
          motionPathEditMode={motionPathEditMode}
          isRecordingMic={isRecordingMic}
          micDuration={micDuration}
          onChangeEnvironment={handleChangeEnvironment}
          onChangeLighting={handleChangeLighting}
          onApplyCameraPreset={handleApplyCameraPreset}
          onSaveCameraPose={handleSaveCameraPose}
          onResetCameraPose={handleResetCameraPose}
          onChangeCameraZoom={handleChangeCameraZoom}
          onOpenLibraryPicker={handleOpenLibraryPicker}
          onOpenUpdateActivity={handleOpenUpdateActivity}
          onDeleteCustomModel={handleDeleteCustomModel}
          onSelectActor={handleSelectActor}
          onUpdateActor={handleUpdateActor}
          onDuplicateActor={handleDuplicateActor}
          onDeleteActor={handleDeleteActor}
          onSetMotionPathEditMode={setMotionPathEditMode}
          onPreviewActorTransitions={handlePreviewActorTransitions}
          onTriggerEffectPreview={triggerEffectPreview}
          onToggleMicRecord={handleToggleMicRecord}
          onUploadAudio={handleUploadAudio}
          onClearAudio={handleClearAudio}
          onGenerateAIModel={handleGenerateAIModel}
          onGenerateHandheldAIProp={handleGenerateHandheldAIProp}
          onGenerateAIStory={handleGenerateAIStory}
          onLoadStoryScript={handleLoadStoryScript}
          onUploadCustomAsset={handleUploadCustomAsset}
          onUploadHandheldGLB={handleUploadHandheldGLB}
          onChangeCustomBackground={handleChangeCustomBackground}
          onToggleCustomGround={handleToggleCustomGround}
        />
      </div>

      {/* 3. Multi-Scene Timeline */}
      <TimelineBar
        scenes={scenes}
        activeSceneId={activeScene.id}
        selectedActorId={selectedActorId}
        isPlaying={isPlaying}
        storyElapsed={storyElapsed}
        totalDuration={totalDuration}
        onSelectScene={handleSelectScene}
        onSelectActor={handleSelectActorFromTimeline}
        onScrubTimeline={handleScrubTimeline}
        onScrubStateChange={setIsScrubbing}
        onAddScene={handleAddScene}
        onDuplicateScene={handleDuplicateScene}
        onReorderScene={handleReorderScene}
        onDeleteScene={handleDeleteScene}
        onUpdateSceneDuration={handleUpdateSceneDuration}
        onUpdateActorTiming={handleUpdateActorTiming}
        onUpdateSceneCameraTiming={handleUpdateSceneCameraTiming}
        onTogglePlayStory={handleTogglePlayStory}
        onStopPlayback={handleStopPlayback}
      />

      {/* 4. Mobile Compact Horizontal Icon Drawer (< 768px) */}
      <nav
        aria-label="Studio tools"
        className="md:hidden shrink-0 bg-[#0E131D] border-t border-white/10 grid grid-cols-4 px-1 py-1 z-30"
      >
        {mobileTabs.map((t) => {
          const active = mobileSheetOpen && activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (mobileSheetOpen && activeTab === t.id) {
                  setMobileSheetOpen(false);
                } else {
                  setActiveTab(t.id);
                  setMobileSheetOpen(true);
                }
              }}
              className={`py-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium cursor-pointer ${
                active ? 'text-amber-400 bg-amber-500/10' : 'text-slate-300'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Instant Activity Selector Pop-up / Bottom-Sheet */}
      <ActivitySelectorModal
        target={activityModalTarget}
        onSelectActivity={handleConfirmActivityFromModal}
        onClose={() => setActivityModalTarget(null)}
      />

      {/* New Project Launcher Modal */}
      {showNewProjectModal && (
        <NewProjectModal
          open={showNewProjectModal}
          canDismiss={hasCreatedProject}
          initialProjectName={hasCreatedProject ? projectName : 'My Cartoon Story'}
          initialAspectRatio={aspectRatio}
          savedProjects={savedProjects}
          autoDraft={autoDraft}
          onCreateProject={handleCreateProject}
          onResumeProject={handleResumeSavedProject}
          onDeleteSavedProject={handleDeleteSavedProject}
          onDownloadProjectJson={handleDownloadProjectJson}
          onImportProjectJson={handleImportProjectJson}
          onClose={() => setShowNewProjectModal(false)}
        />
      )}

      {/* Video Export Modal */}
      <ExportModal
        exportState={exportState}
        onCancel={handleCancelExport}
        onClose={handleCloseExportModal}
      />
    </div>
  );
}
