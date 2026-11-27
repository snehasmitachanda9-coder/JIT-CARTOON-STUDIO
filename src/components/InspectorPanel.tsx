import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Box,
  Camera,
  Car,
  Copy,
  Hand,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Mountain,
  Package,
  PawPrint,
  PenTool,
  Play,
  Plus,
  RotateCcw,
  Route,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from 'lucide-react';
import {
  ActorType,
  ANIMAL_META,
  AnimalKind,
  AnimationState,
  BuiltInLibraryCategory,
  CAMERA_PRESETS,
  CameraPresetId,
  CameraZoomMode,
  CHARACTER_META,
  CharacterKind,
  CUSTOM_MODEL_RETENTION_MS,
  CustomModelBlueprint,
  ENTRANCE_EFFECT_META,
  EntranceEffect,
  EntranceExitConfig,
  ENVIRONMENT_META,
  EnvironmentId,
  EXIT_EFFECT_META,
  ExitEffect,
  FACIAL_EXPRESSIONS,
  FacialExpression,
  getActivitiesForModel,
  HANDHELD_ITEM_META,
  HandheldItemKind,
  HeldItemAttachment,
  LightingMode,
  MotionPathConfig,
  MotionPathMode,
  PROP_META,
  PropKind,
  SceneActor,
  SceneData,
  TransitionDirection,
  VEHICLE_META,
  VehicleKind,
} from '../types/studio';
import { MotionPathEditMode } from '../three/StudioViewport';
import {
  getCachedThumbnail,
  getThumbnailKey,
  requestThumbnails,
  ThumbnailSpec,
} from '../three/thumbnailRenderer';

export type InspectorTab = 'cast' | 'scene' | 'ai3d' | 'voice';

export interface GeneratedStoryScript {
  storyTitle: string;
  scenes: Array<{
    title: string;
    environment: string;
    lighting: string;
    duration: number;
    cameraPreset: string;
    cameraZoom: string;
    cast: Array<{
      actorType?: string;
      kind: string;
      name: string;
      animation: string;
      expression: string;
      dialogue: string;
      heldItem?: string;
      x: number;
      z: number;
      walkToX?: number;
      walkToZ?: number;
    }>;
  }>;
}

interface InspectorPanelProps {
  activeTab: InspectorTab;
  onChangeTab: (tab: InspectorTab) => void;
  mobileSheetOpen: boolean;
  onCloseMobileSheet: () => void;
  activeScene: SceneData;
  selectedActorId: string | null;
  customModels: CustomModelBlueprint[];
  motionPathEditMode: MotionPathEditMode;
  isRecordingMic: boolean;
  micDuration: number;
  onChangeEnvironment: (env: EnvironmentId) => void;
  onChangeLighting: (mode: LightingMode) => void;
  onApplyCameraPreset: (preset: CameraPresetId) => void;
  onSaveCameraPose: () => void;
  onResetCameraPose: () => void;
  onChangeCameraZoom: (zoom: CameraZoomMode) => void;
  onOpenLibraryPicker: (
    actorType: ActorType,
    kind: string,
    label: string,
    customBlueprint?: CustomModelBlueprint
  ) => void;
  onOpenUpdateActivity: (actor: SceneActor) => void;
  onDeleteCustomModel: (id: string) => void;
  onSelectActor: (id: string | null) => void;
  onUpdateActor: (id: string, patch: Partial<SceneActor>) => void;
  onDuplicateActor: (id: string) => void;
  onDeleteActor: (id: string) => void;
  onSetMotionPathEditMode: (mode: MotionPathEditMode) => void;
  onPreviewActorTransitions: (actor: SceneActor) => void;
  onToggleMicRecord: (targetActorId: string | null) => void;
  onUploadAudio: (targetActorId: string | null, file: File) => void;
  onClearAudio: (targetActorId: string | null) => void;
  onGenerateAIModel: (prompt: string) => Promise<CustomModelBlueprint | null>;
  onGenerateHandheldAIProp: (
    actorId: string,
    hand: 'left' | 'right',
    prompt: string
  ) => Promise<void>;
  onGenerateAIStory: (
    idea: string,
    language: 'English' | 'Bengali' | 'Bilingual'
  ) => Promise<GeneratedStoryScript | null>;
  onLoadStoryScript: (script: GeneratedStoryScript) => void;
}

const ENV_IDS: EnvironmentId[] = [
  'village',
  'classroom',
  'park',
  'palace',
  'forest',
  'studio',
];

const HUMAN_CHAR_KINDS: CharacterKind[] = [
  'boy',
  'girl',
  'teenager',
  'woman',
  'twins',
  'father',
  'mother',
  'son',
  'daughter',
  'kid',
  'teacher',
  'farmer',
  'doctor',
  'police',
  'chef',
  'grandpa',
  'grandma',
  'king',
  'queen',
  'prince',
  'princess',
  'fairy',
  'angel',
  'witch',
  'wizard',
  'superhero',
];

const ANIMAL_KINDS: AnimalKind[] = [
  'dog',
  'cat',
  'rabbit',
  'monkey',
  'lion',
  'tiger',
  'elephant',
  'horse',
  'bird',
  'fish',
];

const VEHICLE_AND_SCIFI_ITEMS: Array<{
  actorType: ActorType;
  kind: string;
  label: string;
}> = [
  ...(Object.keys(VEHICLE_META) as VehicleKind[]).map((k) => ({
    actorType: 'vehicle' as ActorType,
    kind: k,
    label: VEHICLE_META[k].label,
  })),
  { actorType: 'character', kind: 'robot', label: CHARACTER_META.robot.label },
];

const PROP_KINDS: PropKind[] = [
  'tree',
  'hut',
  'house',
  'desk',
  'fountain',
  'football',
  'cricketBatBall',
  'books',
  'woodenStick',
  'toyGun',
  'magicWand',
  'sword',
  'smartphone',
];

const MODEL_PROMPT_EXAMPLES = [
  'a superhero boy with a red cape',
  'a yellow school bus',
  'a green dinosaur',
  'a street food cart',
];

export function InspectorPanel({
  activeTab,
  onChangeTab,
  mobileSheetOpen,
  onCloseMobileSheet,
  activeScene,
  selectedActorId,
  customModels,
  motionPathEditMode,
  isRecordingMic,
  micDuration,
  onChangeEnvironment,
  onChangeLighting,
  onApplyCameraPreset,
  onSaveCameraPose,
  onResetCameraPose,
  onChangeCameraZoom,
  onOpenLibraryPicker,
  onOpenUpdateActivity,
  onDeleteCustomModel,
  onSelectActor,
  onUpdateActor,
  onDuplicateActor,
  onDeleteActor,
  onSetMotionPathEditMode,
  onPreviewActorTransitions,
  onToggleMicRecord,
  onUploadAudio,
  onClearAudio,
  onGenerateAIModel,
  onGenerateHandheldAIProp,
  onGenerateAIStory,
  onLoadStoryScript,
}: InspectorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handImageInputRef = useRef<HTMLInputElement>(null);

  const selectedActor =
    activeScene.actors.find((a) => a.id === selectedActorId) || null;
  const rotDeg = selectedActor
    ? Math.round((selectedActor.rotationY * 180) / Math.PI)
    : 0;

  // Library Category + Filter
  const [libraryCategory, setLibraryCategory] =
    useState<BuiltInLibraryCategory>('characters');
  const [librarySearch, setLibrarySearch] = useState('');

  // Handheld Item State
  const [activeHand, setActiveHand] = useState<'right' | 'left'>('right');
  const [removeImgBg, setRemoveImgBg] = useState(true);
  const [handPropPrompt, setHandPropPrompt] = useState('');
  const [isGeneratingHandProp, setIsGeneratingHandProp] = useState(false);

  // AI 3D Builder state
  const [modelPrompt, setModelPrompt] = useState('');
  const [isGeneratingModel, setIsGeneratingModel] = useState(false);

  // AI Story Writer state
  const [storyIdea, setStoryIdea] = useState('');
  const [storyLang, setStoryLang] = useState<'English' | 'Bengali' | 'Bilingual'>(
    'English'
  );
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generatedScript, setGeneratedScript] =
    useState<GeneratedStoryScript | null>(null);

  const libraryItems = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    let base: Array<{ actorType: ActorType; kind: string; label: string; sub?: string }> = [];
    if (libraryCategory === 'characters') {
      base = HUMAN_CHAR_KINDS.map((k) => ({
        actorType: 'character',
        kind: k,
        label: CHARACTER_META[k].label,
        sub: CHARACTER_META[k].tag,
      }));
    } else if (libraryCategory === 'animals') {
      base = ANIMAL_KINDS.map((k) => ({
        actorType: 'animal',
        kind: k,
        label: ANIMAL_META[k].label,
      }));
    } else if (libraryCategory === 'vehicles') {
      base = VEHICLE_AND_SCIFI_ITEMS;
    } else {
      base = PROP_KINDS.map((k) => ({
        actorType: 'prop',
        kind: k,
        label: PROP_META[k].label,
      }));
    }
    if (!q) return base;
    return base.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.kind.toLowerCase().includes(q) ||
        (item.sub && item.sub.toLowerCase().includes(q))
    );
  }, [libraryCategory, librarySearch]);

  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const specs: ThumbnailSpec[] = [
      ...customModels.map((bp) => ({
        key: getThumbnailKey('custom', bp.id, bp.id),
        actorType: 'custom' as ActorType,
        kind: bp.id,
        customBlueprint: bp,
      })),
      ...HUMAN_CHAR_KINDS.map((k) => ({
        key: getThumbnailKey('character', k),
        actorType: 'character' as ActorType,
        kind: k,
      })),
      ...ANIMAL_KINDS.map((k) => ({
        key: getThumbnailKey('animal', k),
        actorType: 'animal' as ActorType,
        kind: k,
      })),
      ...VEHICLE_AND_SCIFI_ITEMS.map((item) => ({
        key: getThumbnailKey(item.actorType, item.kind),
        actorType: item.actorType,
        kind: item.kind,
      })),
      ...PROP_KINDS.map((k) => ({
        key: getThumbnailKey('prop', k),
        actorType: 'prop' as ActorType,
        kind: k,
      })),
    ];

    const initial: Record<string, string> = {};
    specs.forEach((s) => {
      const cached = getCachedThumbnail(s.key);
      if (cached) initial[s.key] = cached;
    });
    if (Object.keys(initial).length > 0) {
      setThumbMap((prev) => ({ ...initial, ...prev }));
    }

    return requestThumbnails(specs, (key, url) => {
      setThumbMap((prev) => (prev[key] === url ? prev : { ...prev, [key]: url }));
    });
  }, [customModels]);

  const handleRunModelBuilder = async () => {
    const trimmed = modelPrompt.trim();
    if (!trimmed || isGeneratingModel) return;
    setIsGeneratingModel(true);
    try {
      const bp = await onGenerateAIModel(trimmed);
      if (bp) {
        onOpenLibraryPicker('custom', bp.id, bp.name, bp);
        setModelPrompt('');
      }
    } finally {
      setIsGeneratingModel(false);
    }
  };

  const handleRunStoryWriter = async () => {
    const trimmed = storyIdea.trim();
    if (!trimmed || isGeneratingStory) return;
    setIsGeneratingStory(true);
    try {
      const script = await onGenerateAIStory(trimmed, storyLang);
      if (script) {
        setGeneratedScript(script);
      }
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const setActorHeldItem = (
    actor: SceneActor,
    hand: 'left' | 'right',
    item: HeldItemAttachment | null
  ) => {
    if (hand === 'left') {
      onUpdateActor(actor.id, { heldItemLeft: item });
    } else {
      onUpdateActor(actor.id, { heldItemRight: item });
    }
  };

  const handleSelectBuiltinHandheld = (
    actor: SceneActor,
    itemKind: HandheldItemKind,
    label: string
  ) => {
    if (itemKind === 'none') {
      setActorHeldItem(actor, activeHand, null);
      return;
    }
    const existing =
      activeHand === 'left' ? actor.heldItemLeft : actor.heldItemRight;
    setActorHeldItem(actor, activeHand, {
      itemKind,
      label,
      scale: existing?.scale ?? 1,
      rotationDeg: existing?.rotationDeg ?? 0,
      offsetY: existing?.offsetY ?? 0,
      offsetZ: existing?.offsetZ ?? 0,
    });
  };

  const handleUploadHandImage = (actor: SceneActor, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setActorHeldItem(actor, activeHand, {
        itemKind: 'customImage',
        label: file.name.slice(0, 20),
        imageDataUrl: dataUrl,
        removeBg: removeImgBg,
        scale: 1,
        rotationDeg: 0,
        offsetY: 0,
        offsetZ: 0,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleBuildHandAIProp = async (actor: SceneActor) => {
    const p = handPropPrompt.trim();
    if (!p || isGeneratingHandProp) return;
    setIsGeneratingHandProp(true);
    try {
      await onGenerateHandheldAIProp(actor.id, activeHand, p);
      setHandPropPrompt('');
    } finally {
      setIsGeneratingHandProp(false);
    }
  };

  const getSwatchesForActor = (actor: SceneActor): string[] | null => {
    if (
      actor.actorType === 'character' &&
      CHARACTER_META[actor.kind as CharacterKind]
    ) {
      return CHARACTER_META[actor.kind as CharacterKind].swatches;
    }
    if (actor.actorType === 'animal' && ANIMAL_META[actor.kind as AnimalKind]) {
      return ANIMAL_META[actor.kind as AnimalKind].swatches;
    }
    if (
      actor.actorType === 'vehicle' &&
      VEHICLE_META[actor.kind as VehicleKind]
    ) {
      return VEHICLE_META[actor.kind as VehicleKind].swatches;
    }
    return null;
  };

  const tabs: Array<{ id: InspectorTab; label: string; icon: React.ReactNode }> = [
    { id: 'cast', label: '3D Library', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'scene', label: 'Scene & Cam', icon: <Mountain className="w-3.5 h-3.5" /> },
    { id: 'ai3d', label: 'AI 3D Builder', icon: <Box className="w-3.5 h-3.5" /> },
    { id: 'voice', label: 'Voice & AI', icon: <Wand2 className="w-3.5 h-3.5" /> },
  ];

  const renderTabBody = () => {
    if (activeTab === 'cast') {
      const heldItem = selectedActor
        ? activeHand === 'left'
          ? selectedActor.heldItemLeft
          : selectedActor.heldItemRight
        : null;
      const actorActivities = selectedActor
        ? getActivitiesForModel(selectedActor.actorType, selectedActor.kind)
        : [];
      const swatches = selectedActor ? getSwatchesForActor(selectedActor) : null;

      return (
        <div className="space-y-4">
          {/* Permanent Built-In 3D Library */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-200">
                Built-In 3D Library
              </h2>
              <span className="text-[10px] text-slate-400">Tap model to animate</span>
            </div>

            {/* 4 Category Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-[#0B0E14] p-1 rounded-lg border border-white/8">
              {(
                [
                  ['characters', 'People', <Users key="u" className="w-3 h-3" />],
                  ['animals', 'Animals', <PawPrint key="p" className="w-3 h-3" />],
                  ['vehicles', 'Vehicles', <Car key="v" className="w-3 h-3" />],
                  ['props', 'Props', <Package key="pr" className="w-3 h-3" />],
                ] as Array<[BuiltInLibraryCategory, string, React.ReactNode]>
              ).map(([cat, label, icon]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setLibraryCategory(cat)}
                  className={`py-1.5 px-1 rounded-md text-[10px] font-medium flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
                    libraryCategory === cat
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {icon}
                  <span className="truncate max-w-full">{label}</span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search models..."
                className="w-full h-8 pl-8 pr-2.5 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Model Grid with 3D Thumbnails */}
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto studio-scroll pr-0.5">
              {libraryItems.map((item) => {
                const thumbKey = getThumbnailKey(item.actorType, item.kind);
                const thumbUrl = thumbMap[thumbKey];
                return (
                  <button
                    key={`${item.actorType}-${item.kind}`}
                    type="button"
                    onClick={() =>
                      onOpenLibraryPicker(item.actorType, item.kind, item.label)
                    }
                    className="p-1.5 rounded-xl bg-[#171E2E] hover:bg-[#1E273B] border border-white/10 hover:border-amber-400/50 text-left transition-all cursor-pointer flex flex-col gap-1.5 group"
                  >
                    <div className="h-24 w-full rounded-lg bg-[radial-gradient(circle_at_50%_38%,#27344f_0%,#0f1523_85%)] border border-white/5 flex items-center justify-center overflow-hidden relative">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={item.label}
                          className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                          draggable={false}
                        />
                      ) : (
                        <Box className="w-6 h-6 text-slate-500 animate-pulse" />
                      )}
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/45 text-amber-400 flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                        <Plus className="w-3 h-3" />
                      </span>
                    </div>
                    <div className="min-w-0 px-0.5 pb-0.5">
                      <div className="text-[11px] font-semibold text-slate-100 truncate">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate capitalize">
                        {item.sub || item.actorType}
                      </div>
                    </div>
                  </button>
                );
              })}
              {libraryItems.length === 0 && (
                <div className="col-span-2 text-center py-3 text-xs text-slate-500">
                  No matching models.
                </div>
              )}
            </div>
          </section>

          {/* Cast on Stage */}
          <section className="space-y-2 pt-3 border-t border-white/8">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-300">
                On Stage ({activeScene.actors.length})
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeScene.actors.map((actor) => {
                const isSel = actor.id === selectedActorId;
                return (
                  <button
                    key={actor.id}
                    type="button"
                    onClick={() => onSelectActor(actor.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isSel
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                        : 'bg-[#171E2E] text-slate-300 border-white/10 hover:bg-[#1E273B]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: isSel ? '#0f172a' : actor.accentColor,
                      }}
                    />
                    <span className="truncate max-w-[105px]">{actor.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected Actor Controls */}
          {selectedActor && (
            <section className="space-y-3.5 pt-3 border-t border-white/8">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-amber-400 truncate">
                  {selectedActor.name}
                </h2>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDuplicateActor(selectedActor.id)}
                    title="Duplicate"
                    className="p-1.5 rounded-md bg-[#171E2E] hover:bg-[#232C3F] text-slate-300 border border-white/10 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteActor(selectedActor.id)}
                    title="Remove"
                    className="p-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Activity Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Activity
                  </label>
                  <button
                    type="button"
                    onClick={() => onOpenUpdateActivity(selectedActor)}
                    className="text-[11px] font-medium text-amber-300 hover:text-amber-200 cursor-pointer"
                  >
                    Open Full Picker
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto studio-scroll pr-0.5">
                  {actorActivities.map((anim: AnimationState) => {
                    const active = selectedActor.animation === anim;
                    return (
                      <button
                        key={anim}
                        type="button"
                        onClick={() =>
                          onUpdateActor(selectedActor.id, { animation: anim })
                        }
                        className={`px-2 py-1.5 rounded-md text-[11px] font-medium border text-left truncate transition-colors cursor-pointer ${
                          active
                            ? 'bg-sky-500/20 border-sky-400/70 text-sky-200'
                            : 'bg-[#171E2E] border-white/8 text-slate-300 hover:bg-[#1E273B]'
                        }`}
                      >
                        {anim}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Facial Expression (Character & Animal) */}
              {(selectedActor.actorType === 'character' ||
                selectedActor.actorType === 'animal') && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Facial Expression
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {FACIAL_EXPRESSIONS.map((expr: FacialExpression) => {
                      const active = selectedActor.expression === expr;
                      return (
                        <button
                          key={expr}
                          type="button"
                          onClick={() =>
                            onUpdateActor(selectedActor.id, { expression: expr })
                          }
                          className={`py-1.5 px-1 rounded-md text-[11px] font-medium border text-center truncate cursor-pointer ${
                            active
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-[#171E2E] border-white/8 text-slate-300 hover:bg-[#1E273B]'
                          }`}
                        >
                          {expr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hold Item in Hand (Left / Right) for Humanoid / Fantasy Characters */}
              {selectedActor.actorType === 'character' && (
                <div className="p-2.5 rounded-xl bg-[#161C2B] border border-white/8 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                      <Hand className="w-3.5 h-3.5 text-amber-400" />
                      <span>Hold Item in Hand</span>
                    </span>
                    <div className="flex items-center bg-[#0B0E14] rounded-md p-0.5 border border-white/10">
                      {(['right', 'left'] as const).map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setActiveHand(h)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize cursor-pointer ${
                            activeHand === h
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'text-slate-300'
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Built-in Handheld Grid */}
                  <div className="grid grid-cols-3 gap-1">
                    {HANDHELD_ITEM_META.map((item) => {
                      const active =
                        (!heldItem && item.id === 'none') ||
                        heldItem?.itemKind === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            handleSelectBuiltinHandheld(
                              selectedActor,
                              item.id,
                              item.label
                            )
                          }
                          className={`py-1.5 px-1.5 rounded-md text-[10px] font-medium border truncate cursor-pointer ${
                            active
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-[#111622] border-white/8 text-slate-300 hover:bg-[#1E273B]'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Image Upload */}
                  <div className="space-y-1.5 pt-1 border-t border-white/8">
                    <input
                      ref={handImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadHandImage(selectedActor, file);
                        e.target.value = '';
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handImageInputRef.current?.click()}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-[#1D2538] hover:bg-[#242E45] border border-white/10 text-[11px] font-medium text-sky-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Upload Prop Image</span>
                      </button>
                      <label className="flex items-center gap-1 text-[10px] text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={removeImgBg}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRemoveImgBg(checked);
                            if (heldItem?.itemKind === 'customImage') {
                              setActorHeldItem(selectedActor, activeHand, {
                                ...heldItem,
                                removeBg: checked,
                              });
                            }
                          }}
                          className="accent-amber-500"
                        />
                        <span>Cutout BG</span>
                      </label>
                    </div>
                  </div>

                  {/* AI Prop in Hand */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={handPropPrompt}
                      onChange={(e) => setHandPropPrompt(e.target.value)}
                      placeholder="AI prop: golden trophy..."
                      className="flex-1 min-w-0 h-8 px-2 rounded-lg bg-[#0B0E14] border border-white/10 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      disabled={!handPropPrompt.trim() || isGeneratingHandProp}
                      onClick={() => void handleBuildHandAIProp(selectedActor)}
                      className="px-2.5 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-[11px] font-semibold shrink-0 cursor-pointer"
                    >
                      {isGeneratingHandProp ? '...' : 'AI Prop'}
                    </button>
                  </div>

                  {/* Grip Offset & Scale Sliders */}
                  {heldItem && heldItem.itemKind !== 'none' && (
                    <div className="space-y-1.5 pt-1 border-t border-white/8">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-amber-300 truncate">
                          Holding ({activeHand}): {heldItem.label}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActorHeldItem(selectedActor, activeHand, null)
                          }
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Size</span>
                            <span className="font-mono-tabular">
                              {heldItem.scale.toFixed(2)}x
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.35}
                            max={2.2}
                            step={0.05}
                            value={heldItem.scale}
                            onChange={(e) =>
                              setActorHeldItem(selectedActor, activeHand, {
                                ...heldItem,
                                scale: Number(e.target.value),
                              })
                            }
                            className="w-full studio-range"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Angle</span>
                            <span className="font-mono-tabular">
                              {heldItem.rotationDeg}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            step={5}
                            value={heldItem.rotationDeg}
                            onChange={(e) =>
                              setActorHeldItem(selectedActor, activeHand, {
                                ...heldItem,
                                rotationDeg: Number(e.target.value),
                              })
                            }
                            className="w-full studio-range"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Grip Y</span>
                            <span className="font-mono-tabular">
                              {heldItem.offsetY.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-0.2}
                            max={0.2}
                            step={0.02}
                            value={heldItem.offsetY}
                            onChange={(e) =>
                              setActorHeldItem(selectedActor, activeHand, {
                                ...heldItem,
                                offsetY: Number(e.target.value),
                              })
                            }
                            className="w-full studio-range"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Grip Z</span>
                            <span className="font-mono-tabular">
                              {heldItem.offsetZ.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-0.2}
                            max={0.2}
                            step={0.02}
                            value={heldItem.offsetZ}
                            onChange={(e) =>
                              setActorHeldItem(selectedActor, activeHand, {
                                ...heldItem,
                                offsetZ: Number(e.target.value),
                              })
                            }
                            className="w-full studio-range"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Visual Movement Path System (Straight Line, Freehand Curve, Multi-Turn Path) */}
              {(() => {
                const resolvedMp: MotionPathConfig = selectedActor.motionPath
                  ? selectedActor.motionPath
                  : selectedActor.walkPath?.enabled
                    ? {
                        enabled: true,
                        mode: 'straight',
                        points: [
                          [...selectedActor.walkPath.start],
                          [...selectedActor.walkPath.end],
                        ],
                        cornerStyle: 'sharp',
                      }
                    : {
                        enabled: false,
                        mode: 'straight',
                        points: [
                          [...selectedActor.position],
                          [
                            Number(
                              Math.min(5.8, selectedActor.position[0] + 2.6).toFixed(2)
                            ),
                            selectedActor.position[1],
                          ],
                        ],
                        cornerStyle: 'rounded',
                      };

                const switchMode = (nextMode: MotionPathMode) => {
                  const basePts =
                    resolvedMp.points.length >= 2
                      ? resolvedMp.points
                      : ([
                          [...selectedActor.position],
                          [
                            Number(
                              Math.min(5.8, selectedActor.position[0] + 2.6).toFixed(2)
                            ),
                            selectedActor.position[1],
                          ],
                        ] as Array<[number, number]>);

                  const nextPts: Array<[number, number]> =
                    nextMode === 'straight'
                      ? [basePts[0], basePts[basePts.length - 1]]
                      : basePts;

                  onUpdateActor(selectedActor.id, {
                    motionPath: {
                      enabled: true,
                      mode: nextMode,
                      points: nextPts,
                      cornerStyle:
                        nextMode === 'multiPoint'
                          ? resolvedMp.cornerStyle || 'rounded'
                          : nextMode === 'freehand'
                            ? 'rounded'
                            : 'sharp',
                    },
                    walkPath: undefined,
                  });
                  onSetMotionPathEditMode(
                    nextMode === 'freehand'
                      ? 'drawFreehand'
                      : nextMode === 'multiPoint'
                        ? 'addWaypoint'
                        : 'idle'
                  );
                };

                const reversePath = () => {
                  if (resolvedMp.points.length < 2) return;
                  const rev = [...resolvedMp.points].reverse();
                  onUpdateActor(selectedActor.id, {
                    position: [...rev[0]],
                    motionPath: { ...resolvedMp, enabled: true, points: rev },
                    walkPath: undefined,
                  });
                };

                const clearPath = () => {
                  onSetMotionPathEditMode('idle');
                  onUpdateActor(selectedActor.id, {
                    motionPath: undefined,
                    walkPath: undefined,
                  });
                };

                return (
                  <div className="p-2.5 rounded-xl bg-[#161C2B] border border-white/8 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                        <Route className="w-3.5 h-3.5 text-sky-400" />
                        <span>Motion Path</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextEnabled = !resolvedMp.enabled;
                          if (!nextEnabled) onSetMotionPathEditMode('idle');
                          onUpdateActor(selectedActor.id, {
                            motionPath: { ...resolvedMp, enabled: nextEnabled },
                            walkPath: undefined,
                          });
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                          resolvedMp.enabled
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {resolvedMp.enabled ? 'Active' : 'Enable'}
                      </button>
                    </div>

                    {/* 3 Selectable Path Modes */}
                    <div className="grid grid-cols-3 gap-1 bg-[#0B0E14] p-1 rounded-lg border border-white/10">
                      {(
                        [
                          ['straight', 'Straight'],
                          ['freehand', 'Freehand'],
                          ['multiPoint', 'Multi-Turn'],
                        ] as Array<[MotionPathMode, string]>
                      ).map(([m, label]) => {
                        const active = resolvedMp.enabled && resolvedMp.mode === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => switchMode(m)}
                            className={`py-1.5 px-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                              active
                                ? 'bg-sky-500 text-slate-950 font-semibold'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {resolvedMp.enabled && (
                      <div className="space-y-2">
                        {resolvedMp.mode === 'straight' && (
                          <>
                            <div className="text-[11px] font-mono-tabular text-slate-400 flex justify-between">
                              <span>
                                A: ({resolvedMp.points[0]?.[0].toFixed(1)},{' '}
                                {resolvedMp.points[0]?.[1].toFixed(1)})
                              </span>
                              <span>
                                B: (
                                {resolvedMp.points[
                                  resolvedMp.points.length - 1
                                ]?.[0].toFixed(1)}
                                ,{' '}
                                {resolvedMp.points[
                                  resolvedMp.points.length - 1
                                ]?.[1].toFixed(1)}
                                )
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onSetMotionPathEditMode(
                                  motionPathEditMode === 'pickEnd' ? 'idle' : 'pickEnd'
                                )
                              }
                              className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-medium border cursor-pointer ${
                                motionPathEditMode === 'pickEnd'
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                                  : 'bg-[#1D2538] hover:bg-[#242E45] text-amber-300 border-amber-500/35'
                              }`}
                            >
                              {motionPathEditMode === 'pickEnd'
                                ? 'Tap 3D Ground Now...'
                                : 'Set Point B on 3D Ground'}
                            </button>
                            <p className="text-[10px] text-slate-400">
                              Drag green Start (A) or amber End (B) handles on stage.
                            </p>
                          </>
                        )}

                        {resolvedMp.mode === 'freehand' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onSetMotionPathEditMode(
                                  motionPathEditMode === 'drawFreehand'
                                    ? 'idle'
                                    : 'drawFreehand'
                                )
                              }
                              className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer ${
                                motionPathEditMode === 'drawFreehand'
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                                  : 'bg-[#1D2538] hover:bg-[#242E45] text-sky-300 border-sky-400/35'
                              }`}
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              <span>
                                {motionPathEditMode === 'drawFreehand'
                                  ? 'Drawing... Drag on 3D Ground'
                                  : 'Draw Freehand Path on Stage'}
                              </span>
                            </button>
                            <div className="text-[10px] font-mono-tabular text-slate-400 flex justify-between">
                              <span>Catmull-Rom smooth curve</span>
                              <span>{resolvedMp.points.length} pts</span>
                            </div>
                          </>
                        )}

                        {resolvedMp.mode === 'multiPoint' && (
                          <>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onSetMotionPathEditMode(
                                    motionPathEditMode === 'addWaypoint'
                                      ? 'idle'
                                      : 'addWaypoint'
                                  )
                                }
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border cursor-pointer ${
                                  motionPathEditMode === 'addWaypoint'
                                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                                    : 'bg-[#1D2538] hover:bg-[#242E45] text-sky-300 border-sky-400/35'
                                }`}
                              >
                                {motionPathEditMode === 'addWaypoint'
                                  ? 'Done Adding Points'
                                  : 'Tap Ground to Add Turns'}
                              </button>
                              <button
                                type="button"
                                disabled={resolvedMp.points.length <= 2}
                                onClick={() => {
                                  if (resolvedMp.points.length <= 2) return;
                                  onUpdateActor(selectedActor.id, {
                                    motionPath: {
                                      ...resolvedMp,
                                      points: resolvedMp.points.slice(0, -1),
                                    },
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#111622] hover:bg-[#1E273B] disabled:opacity-40 border border-white/10 text-[11px] text-slate-300 cursor-pointer"
                              >
                                Undo Pt
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-1">
                              {(
                                [
                                  ['rounded', 'Rounded Curves'],
                                  ['sharp', 'Sharp Corners'],
                                ] as const
                              ).map(([cs, label]) => {
                                const active =
                                  (resolvedMp.cornerStyle || 'rounded') === cs;
                                return (
                                  <button
                                    key={cs}
                                    type="button"
                                    onClick={() =>
                                      onUpdateActor(selectedActor.id, {
                                        motionPath: {
                                          ...resolvedMp,
                                          cornerStyle: cs,
                                        },
                                      })
                                    }
                                    className={`py-1 px-2 rounded-md text-[10px] font-medium border cursor-pointer ${
                                      active
                                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                                        : 'bg-[#111622] border-white/8 text-slate-300'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="text-[10px] font-mono-tabular text-slate-400 flex justify-between">
                              <span>Drag any waypoint node on stage</span>
                              <span>{resolvedMp.points.length} waypoints</span>
                            </div>
                          </>
                        )}

                        {/* Reverse & Clear Actions */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-white/8">
                          <button
                            type="button"
                            onClick={reversePath}
                            className="py-1.5 px-2 rounded-lg bg-[#111622] hover:bg-[#1E273B] border border-white/10 text-[11px] font-medium text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3 h-3 text-sky-400" />
                            <span>Reverse Path</span>
                          </button>
                          <button
                            type="button"
                            onClick={clearPath}
                            className="py-1.5 px-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-[11px] font-medium text-rose-300 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear Path</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Dedicated Entrance & Exit Effects Section */}
              {(() => {
                const tr: EntranceExitConfig = selectedActor.transitions || {
                  entrance: 'none',
                  entranceDuration: 0.8,
                  entranceDirection: 'left',
                  exit: 'none',
                  exitDuration: 0.8,
                  exitDirection: 'right',
                };

                const patchTransitions = (patch: Partial<EntranceExitConfig>) => {
                  onUpdateActor(selectedActor.id, {
                    transitions: { ...tr, ...patch },
                  });
                };

                const showInDirs = tr.entrance === 'flyIn' || tr.entrance === 'wipe';
                const showOutDirs = tr.exit === 'flyOut' || tr.exit === 'wipe';

                return (
                  <div className="p-2.5 rounded-xl bg-[#161C2B] border border-white/8 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Entrance & Exit</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onPreviewActorTransitions(selectedActor)}
                        className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-[10px] font-semibold text-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Preview</span>
                      </button>
                    </div>

                    {/* Entrance Effects (15 Options) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-emerald-300">
                          Entrance Effect
                        </span>
                        <span className="font-mono-tabular text-slate-300">
                          {tr.entranceDuration.toFixed(1)}s
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        {ENTRANCE_EFFECT_META.map((eff) => {
                          const active = tr.entrance === eff.id;
                          return (
                            <button
                              key={eff.id}
                              type="button"
                              onClick={() =>
                                patchTransitions({
                                  entrance: eff.id as EntranceEffect,
                                })
                              }
                              className={`py-1.5 px-1 rounded-md text-[10px] font-medium border truncate cursor-pointer transition-colors ${
                                active
                                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                                  : 'bg-[#111622] border-white/8 text-slate-300 hover:bg-[#1E273B]'
                              }`}
                            >
                              {eff.label}
                            </button>
                          );
                        })}
                      </div>

                      {showInDirs && (
                        <div className="grid grid-cols-4 gap-1 pt-0.5">
                          {(
                            (tr.entrance === 'wipe'
                              ? [
                                  ['bottom', 'Bottom↑'],
                                  ['left', 'Left→'],
                                  ['right', '←Right'],
                                ]
                              : [
                                  ['left', 'Left'],
                                  ['right', 'Right'],
                                  ['top', 'Top'],
                                  ['bottom', 'Bottom'],
                                ]) as Array<[TransitionDirection, string]>
                          ).map(([dir, label]) => (
                            <button
                              key={dir}
                              type="button"
                              onClick={() =>
                                patchTransitions({ entranceDirection: dir })
                              }
                              className={`py-1 rounded text-[10px] font-medium border cursor-pointer ${
                                (tr.entranceDirection ||
                                  (tr.entrance === 'wipe' ? 'bottom' : 'left')) ===
                                dir
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                                  : 'bg-[#111622] border-white/8 text-slate-300'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {tr.entrance !== 'none' && (
                        <div className="space-y-0.5 pt-0.5">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Entrance Duration</span>
                            <span className="font-mono-tabular text-emerald-300">
                              {tr.entranceDuration.toFixed(1)}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.3}
                            max={2.0}
                            step={0.1}
                            value={tr.entranceDuration}
                            onChange={(e) =>
                              patchTransitions({
                                entranceDuration: Number(e.target.value),
                              })
                            }
                            className="w-full studio-range"
                          />
                        </div>
                      )}
                    </div>

                    {/* Exit Effects (7 Options + None) */}
                    <div className="space-y-1.5 pt-2 border-t border-white/8">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-rose-300">Exit Effect</span>
                        <span className="font-mono-tabular text-slate-300">
                          {tr.exitDuration.toFixed(1)}s
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1">
                        {EXIT_EFFECT_META.map((eff) => {
                          const active = tr.exit === eff.id;
                          return (
                            <button
                              key={eff.id}
                              type="button"
                              onClick={() =>
                                patchTransitions({ exit: eff.id as ExitEffect })
                              }
                              className={`py-1.5 px-1 rounded-md text-[10px] font-medium border truncate cursor-pointer transition-colors ${
                                active
                                  ? 'bg-rose-500/20 border-rose-400 text-rose-200 font-semibold'
                                  : 'bg-[#111622] border-white/8 text-slate-300 hover:bg-[#1E273B]'
                              }`}
                            >
                              {eff.label}
                            </button>
                          );
                        })}
                      </div>

                      {showOutDirs && (
                        <div className="grid grid-cols-4 gap-1 pt-0.5">
                          {(
                            (tr.exit === 'wipe'
                              ? [
                                  ['bottom', 'Bottom↑'],
                                  ['left', 'Left→'],
                                  ['right', '←Right'],
                                ]
                              : [
                                  ['left', 'Left'],
                                  ['right', 'Right'],
                                  ['top', 'Top'],
                                  ['bottom', 'Bottom'],
                                ]) as Array<[TransitionDirection, string]>
                          ).map(([dir, label]) => (
                            <button
                              key={dir}
                              type="button"
                              onClick={() =>
                                patchTransitions({ exitDirection: dir })
                              }
                              className={`py-1 rounded text-[10px] font-medium border cursor-pointer ${
                                (tr.exitDirection ||
                                  (tr.exit === 'wipe' ? 'bottom' : 'right')) ===
                                dir
                                  ? 'bg-rose-500 text-white border-rose-400 font-semibold'
                                  : 'bg-[#111622] border-white/8 text-slate-300'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {tr.exit !== 'none' && (
                        <div className="space-y-0.5 pt-0.5">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Exit Duration</span>
                            <span className="font-mono-tabular text-rose-300">
                              {tr.exitDuration.toFixed(1)}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.3}
                            max={2.0}
                            step={0.1}
                            value={tr.exitDuration}
                            onChange={(e) =>
                              patchTransitions({
                                exitDuration: Number(e.target.value),
                              })
                            }
                            className="w-full studio-range"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Rotate & Scale */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Rotate</span>
                  <span className="font-mono-tabular text-slate-200">{rotDeg}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={rotDeg}
                  onChange={(e) =>
                    onUpdateActor(selectedActor.id, {
                      rotationY: (Number(e.target.value) * Math.PI) / 180,
                    })
                  }
                  className="w-full studio-range"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Scale</span>
                  <span className="font-mono-tabular text-slate-200">
                    {selectedActor.scale.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.2}
                  step={0.05}
                  value={selectedActor.scale}
                  onChange={(e) =>
                    onUpdateActor(selectedActor.id, { scale: Number(e.target.value) })
                  }
                  className="w-full studio-range"
                />
              </div>

              {/* Color Swatches */}
              {swatches && (
                <div className="flex items-center gap-2 pt-1">
                  {swatches.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() =>
                        onUpdateActor(selectedActor.id, { accentColor: hex })
                      }
                      aria-label={`Style color ${hex}`}
                      className={`w-6 h-6 rounded-md border cursor-pointer ${
                        selectedActor.accentColor === hex
                          ? 'border-white scale-110'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      );
    }

    if (activeTab === 'scene') {
      return (
        <div className="space-y-5">
          {/* 6 Environments */}
          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-300">
              Cartoon Environment
            </h2>
            <div className="grid grid-cols-1 gap-1.5">
              {ENV_IDS.map((envId) => {
                const active = activeScene.environment === envId;
                return (
                  <button
                    key={envId}
                    type="button"
                    onClick={() => onChangeEnvironment(envId)}
                    className={`px-3 py-2 rounded-lg text-left border transition-colors cursor-pointer flex items-center justify-between ${
                      active
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                        : 'bg-[#171E2E] border-white/8 text-slate-300 hover:bg-[#1E273B]'
                    }`}
                  >
                    <span className="text-xs font-medium">
                      {ENVIRONMENT_META[envId].label}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                      {ENVIRONMENT_META[envId].subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Day / Sunset / Night Lighting */}
          <section className="space-y-2 pt-3 border-t border-white/8">
            <h2 className="text-xs font-semibold text-slate-300">
              Time & Lighting
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {(['day', 'sunset', 'night'] as LightingMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeLighting(mode)}
                  className={`py-2 rounded-lg text-xs font-medium capitalize border cursor-pointer ${
                    activeScene.lighting === mode
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                      : 'bg-[#171E2E] border-white/8 text-slate-300 hover:bg-[#1E273B]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </section>

          {/* Camera Angle Presets */}
          <section className="space-y-2 pt-3 border-t border-white/8">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-300">
                Camera Angle Presets
              </h2>
              <Camera className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onApplyCameraPreset(preset)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    activeScene.cameraPreset === preset
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-[#171E2E] border-white/8 text-slate-300 hover:bg-[#1E273B]'
                  }`}
                >
                  {CAMERA_PRESETS[preset].label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={onSaveCameraPose}
                className="flex-1 py-2 px-2.5 rounded-lg bg-[#1A2130] hover:bg-[#232C3F] border border-white/10 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Save Current Angle
              </button>
              <button
                type="button"
                onClick={onResetCameraPose}
                title="Reset camera"
                className="px-2.5 rounded-lg bg-[#1A2130] hover:bg-[#232C3F] border border-white/10 text-slate-300 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>

          {/* Smooth Camera Zoom Motion */}
          <section className="space-y-2 pt-3 border-t border-white/8">
            <h2 className="text-xs font-semibold text-slate-300">
              Scene Camera Motion
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['none', 'Static'],
                  ['zoomIn', 'Zoom In'],
                  ['zoomOut', 'Zoom Out'],
                ] as Array<[CameraZoomMode, string]>
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeCameraZoom(mode)}
                  className={`py-2 px-1 rounded-lg text-xs font-medium border cursor-pointer ${
                    activeScene.cameraZoom === mode
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-[#171E2E] border-white/8 text-slate-300 hover:bg-[#1E273B]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'ai3d') {
      return (
        <div className="space-y-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-200">
                AI Prompt-to-3D Model
              </h2>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Describe any cartoon character, creature, vehicle, or prop. Generated models are cached locally for 60 days.
            </p>
            <textarea
              rows={3}
              value={modelPrompt}
              onChange={(e) => setModelPrompt(e.target.value)}
              placeholder="e.g., a superhero boy with a red cape"
              className="w-full p-2.5 rounded-xl bg-[#0B0E14] border border-white/12 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
            <button
              type="button"
              onClick={() => void handleRunModelBuilder()}
              disabled={!modelPrompt.trim() || isGeneratingModel}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Box className="w-3.5 h-3.5" />
              <span>
                {isGeneratingModel ? 'Building 3D Parts...' : 'Generate 3D Model'}
              </span>
            </button>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {MODEL_PROMPT_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setModelPrompt(ex)}
                  className="px-2 py-1 rounded-md bg-[#171E2E] hover:bg-[#1E273B] border border-white/8 text-[11px] text-slate-300 cursor-pointer"
                >
                  {ex}
                </button>
              ))}
            </div>
          </section>

          {/* My Custom Models (Saved for 60 Days) */}
          <section className="space-y-2 pt-3 border-t border-white/8">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-300">
                My Custom Models (Saved for 60 Days)
              </h2>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                {customModels.length}
              </span>
            </div>

            {customModels.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                AI models generated here remain saved for 60 days, while the Built-In 3D Library is permanent forever.
              </p>
            ) : (
              <div className="space-y-1.5">
                {customModels.map((bp) => {
                  const createdAt = bp.createdAt || Date.now();
                  const daysLeft = Math.max(
                    1,
                    Math.ceil(
                      (createdAt + CUSTOM_MODEL_RETENTION_MS - Date.now()) /
                        (24 * 60 * 60 * 1000)
                    )
                  );
                  const customThumb = thumbMap[getThumbnailKey('custom', bp.id, bp.id)];
                  return (
                    <div
                      key={bp.id}
                      className="p-2 rounded-xl bg-[#171E2E] border border-white/10 flex items-center justify-between gap-2.5"
                    >
                      <div className="w-14 h-14 shrink-0 rounded-lg bg-[radial-gradient(circle_at_50%_38%,#27344f_0%,#0f1523_85%)] border border-white/8 flex items-center justify-center overflow-hidden">
                        {customThumb ? (
                          <img
                            src={customThumb}
                            alt={bp.name}
                            className="w-full h-full object-contain"
                            draggable={false}
                          />
                        ) : (
                          <Box className="w-5 h-5 text-slate-500 animate-pulse" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {bp.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular truncate">
                          {bp.category} · {bp.parts.length} parts · {daysLeft} days left
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenLibraryPicker('custom', bp.id, bp.name, bp)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCustomModel(bp.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
                          title="Delete saved model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      );
    }

    // Voice & AI Tab
    const targetAudioActor = selectedActor;
    const activeAudio = targetAudioActor?.audio || activeScene.audio;

    return (
      <div className="space-y-4">
        {/* Dialogue & Lip-Sync */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Dialogue & Lip-Sync</span>
            </h2>
            <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
              {selectedActor ? selectedActor.name : 'Select actor'}
            </span>
          </div>

          {selectedActor ? (
            <>
              <input
                type="text"
                value={selectedActor.dialogue}
                maxLength={90}
                placeholder="Type English or বাংলা dialogue..."
                onChange={(e) =>
                  onUpdateActor(selectedActor.id, { dialogue: e.target.value })
                }
                className="w-full h-9 px-2.5 rounded-lg bg-[#0B0E14] border border-white/12 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-400">
                Supports English & বাংলা. Mouth lip-syncs automatically during playback.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Select a character or animal in the 3D scene to edit their speech bubble.
            </p>
          )}
        </section>

        {/* Voiceover Recording / MP3 Upload */}
        <section className="space-y-2 pt-3 border-t border-white/8">
          <h2 className="text-xs font-semibold text-slate-300">
            Voiceover Audio ({targetAudioActor ? targetAudioActor.name : 'Scene'})
          </h2>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onToggleMicRecord(targetAudioActor?.id ?? null)}
              className={`py-2 px-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                isRecordingMic
                  ? 'bg-rose-500 text-white border-rose-400'
                  : 'bg-[#171E2E] hover:bg-[#1E273B] text-slate-200 border-white/10'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>
                {isRecordingMic ? `Stop (${micDuration.toFixed(1)}s)` : 'Record Mic'}
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadAudio(targetAudioActor?.id ?? null, file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-2.5 rounded-lg bg-[#171E2E] hover:bg-[#1E273B] border border-white/10 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload MP3/WAV</span>
            </button>
          </div>

          {activeAudio && (
            <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-emerald-500/12 border border-emerald-500/30">
              <div className="flex items-center gap-1.5 min-w-0">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-200 truncate">
                  {activeAudio.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onClearAudio(targetAudioActor?.id ?? null)}
                className="p-1 rounded hover:bg-rose-500/20 text-emerald-200 hover:text-rose-300 cursor-pointer"
                title="Remove voiceover"
              >
                <VolumeX className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>

        {/* AI Story Writer */}
        <section className="space-y-2.5 pt-3 border-t border-white/8">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-200">
              AI Story Writer
            </h2>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <textarea
            rows={2}
            value={storyIdea}
            onChange={(e) => setStoryIdea(e.target.value)}
            placeholder="Idea: A king, princess & talking lion celebrate in the palace..."
            className="w-full p-2.5 rounded-xl bg-[#0B0E14] border border-white/12 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none"
          />

          <div className="grid grid-cols-3 gap-1">
            {(['English', 'Bengali', 'Bilingual'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setStoryLang(lang)}
                className={`py-1.5 rounded-md text-[11px] font-medium border cursor-pointer ${
                  storyLang === lang
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-[#171E2E] border-white/8 text-slate-300'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleRunStoryWriter()}
            disabled={!storyIdea.trim() || isGeneratingStory}
            className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>
              {isGeneratingStory
                ? 'Writing 3D Script...'
                : 'Generate Cartoon Script'}
            </span>
          </button>

          {generatedScript && (
            <div className="p-2.5 rounded-xl bg-[#161C2B] border border-sky-500/35 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-sky-300 truncate">
                  {generatedScript.storyTitle}
                </span>
                <span className="text-[11px] font-mono-tabular text-slate-400">
                  {generatedScript.scenes.length} scenes
                </span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto studio-scroll pr-1">
                {generatedScript.scenes.map((sc, i) => (
                  <div key={i} className="text-[11px] text-slate-300">
                    <span className="font-semibold text-amber-300">
                      {i + 1}. {sc.title}:
                    </span>{' '}
                    {sc.cast.map((c) => `${c.name}: "${c.dialogue}"`).join(' · ')}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  onLoadStoryScript(generatedScript);
                  setGeneratedScript(null);
                }}
                className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer"
              >
                Load Script onto Timeline
              </button>
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Tabbed Sidebar (>= 768px / md+) */}
      <aside className="hidden md:flex flex-col w-72 lg:w-80 shrink-0 border-l border-white/10 bg-[#111622] h-full overflow-hidden">
        <div className="grid grid-cols-4 border-b border-white/10 bg-[#0E131D] shrink-0">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`py-2.5 px-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-amber-500 text-amber-300 bg-[#161D2C]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span className="truncate max-w-full">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-3.5">
          {renderTabBody()}
        </div>
      </aside>

      {/* Mobile Bottom Sheet Drawer (< 768px) */}
      {mobileSheetOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex flex-col justify-end bg-black/60">
          <div
            className="flex-1"
            onClick={onCloseMobileSheet}
            aria-hidden="true"
          />
          <div className="max-h-[72dvh] flex flex-col rounded-t-2xl bg-[#111622] border-t border-white/15 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#0E131D]">
              <span className="text-xs font-semibold text-amber-300">
                {tabs.find((t) => t.id === activeTab)?.label}
              </span>
              <button
                type="button"
                onClick={onCloseMobileSheet}
                className="p-1.5 rounded-lg bg-white/5 text-slate-300 cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto studio-scroll p-4">
              {renderTabBody()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
