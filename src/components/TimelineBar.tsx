import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Hand,
  Layers,
  Mic,
  Pause,
  Play,
  Plus,
  Square,
  Trash2,
  Users,
  Volume2,
} from 'lucide-react';
import {
  CAMERA_PRESETS,
  ENVIRONMENT_META,
  SceneActor,
  SceneData,
} from '../types/studio';

export type ActorTrackField = 'activity' | 'prop' | 'voice';

interface TimelineBarProps {
  scenes: SceneData[];
  activeSceneId: string;
  selectedActorId: string | null;
  isPlaying: boolean;
  storyElapsed: number;
  totalDuration: number;
  onSelectScene: (id: string) => void;
  onSelectActor: (id: string) => void;
  onScrubTimeline: (sec: number) => void;
  onScrubStateChange?: (scrubbing: boolean) => void;
  onAddScene: () => void;
  onDuplicateScene: (id: string) => void;
  onReorderScene: (id: string, dir: -1 | 1) => void;
  onDeleteScene: (id: string) => void;
  onUpdateSceneDuration: (id: string, duration: number) => void;
  onUpdateActorTiming: (
    actorId: string,
    field: ActorTrackField,
    startTime: number,
    endTime: number
  ) => void;
  onUpdateSceneCameraTiming: (
    sceneId: string,
    startTime: number,
    endTime: number
  ) => void;
  onTogglePlayStory: () => void;
  onStopPlayback: () => void;
}

function formatSec(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const rem = clamped - mins * 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
}

interface DraggableBarProps {
  start: number;
  end: number;
  duration: number;
  label: string;
  barClass: string;
  selected?: boolean;
  entrancePct?: number;
  exitPct?: number;
  onClick?: () => void;
  onChangeRange: (nextStart: number, nextEnd: number) => void;
}

function DraggableTrackBar({
  start,
  end,
  duration,
  label,
  barClass,
  selected,
  entrancePct = 0,
  exitPct = 0,
  onClick,
  onChangeRange,
}: DraggableBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const safeDur = Math.max(1, duration);
  const clampedStart = Math.max(0, Math.min(safeDur - 0.4, start));
  const clampedEnd = Math.max(clampedStart + 0.4, Math.min(safeDur, end));
  const leftPct = (clampedStart / safeDur) * 100;
  const widthPct = Math.max(6, ((clampedEnd - clampedStart) / safeDur) * 100);

  const startDrag = (
    e: React.PointerEvent,
    mode: 'move' | 'left' | 'right'
  ) => {
    e.stopPropagation();
    const lane = containerRef.current?.parentElement;
    if (!lane) return;
    const laneWidth = Math.max(60, lane.getBoundingClientRect().width);
    const originX = e.clientX;
    const origStart = clampedStart;
    const origEnd = clampedEnd;
    const minSpan = 0.4;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - originX;
      if (Math.abs(dx) > 3) moved = true;
      const dt = (dx / laneWidth) * safeDur;
      const round = (v: number) => Math.round(v * 10) / 10;

      if (mode === 'left') {
        const ns = round(Math.max(0, Math.min(origEnd - minSpan, origStart + dt)));
        onChangeRange(ns, origEnd);
      } else if (mode === 'right') {
        const ne = round(Math.min(safeDur, Math.max(origStart + minSpan, origEnd + dt)));
        onChangeRange(origStart, ne);
      } else {
        const span = origEnd - origStart;
        let ns = origStart + dt;
        ns = Math.max(0, Math.min(safeDur - span, ns));
        const rStart = round(ns);
        onChangeRange(rStart, round(Math.min(safeDur, rStart + span)));
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!moved && onClick) onClick();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      ref={containerRef}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      onPointerDown={(e) => startDrag(e, 'move')}
      className={`absolute top-0.5 bottom-0.5 rounded-md border flex items-center justify-between px-1.5 text-[10px] font-medium select-none cursor-grab active:cursor-grabbing overflow-hidden ${barClass} ${
        selected ? 'ring-1 ring-amber-400' : ''
      }`}
      title={`${label} (${clampedStart.toFixed(1)}s–${clampedEnd.toFixed(1)}s)`}
    >
      {/* Entrance & Exit duration overlays */}
      {entrancePct > 0 && (
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 bg-emerald-400/25 border-r border-emerald-400/50"
          style={{ width: `${Math.min(48, entrancePct)}%` }}
        />
      )}
      {exitPct > 0 && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 bg-rose-400/25 border-l border-rose-400/50"
          style={{ width: `${Math.min(48, exitPct)}%` }}
        />
      )}

      {/* Left Start Handle */}
      <div
        onPointerDown={(e) => startDrag(e, 'left')}
        aria-label="Adjust start time"
        className="relative z-10 w-2 h-full -ml-1.5 shrink-0 cursor-ew-resize hover:bg-white/30 flex items-center justify-center"
      >
        <span className="w-0.5 h-3 bg-white/60 rounded-full" />
      </div>

      <span className="relative z-10 truncate px-1 flex-1">{label}</span>

      <span className="relative z-10 font-mono-tabular text-[9px] opacity-80 shrink-0 hidden sm:inline mr-1">
        {clampedStart.toFixed(1)}–{clampedEnd.toFixed(1)}s
      </span>

      {/* Right End Handle */}
      <div
        onPointerDown={(e) => startDrag(e, 'right')}
        aria-label="Adjust end time"
        className="relative z-10 w-2 h-full -mr-1.5 shrink-0 cursor-ew-resize hover:bg-white/30 flex items-center justify-center"
      >
        <span className="w-0.5 h-3 bg-white/60 rounded-full" />
      </div>
    </div>
  );
}

export function TimelineBar({
  scenes,
  activeSceneId,
  selectedActorId,
  isPlaying,
  storyElapsed,
  totalDuration,
  onSelectScene,
  onSelectActor,
  onScrubTimeline,
  onScrubStateChange,
  onAddScene,
  onDuplicateScene,
  onReorderScene,
  onDeleteScene,
  onUpdateSceneDuration,
  onUpdateActorTiming,
  onUpdateSceneCameraTiming,
  onTogglePlayStory,
  onStopPlayback,
}: TimelineBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [tracksExpanded, setTracksExpanded] = useState(true);

  const activeScene = scenes.find((s) => s.id === activeSceneId) || scenes[0];
  const progressPct =
    totalDuration > 0 ? Math.min(100, (storyElapsed / totalDuration) * 100) : 0;

  const { activeSceneOffset, scenePlayheadPct } = useMemo(() => {
    let acc = 0;
    for (const sc of scenes) {
      if (sc.id === activeScene?.id) {
        const local = Math.max(0, Math.min(sc.duration, storyElapsed - acc));
        return {
          activeSceneOffset: acc,
          scenePlayheadPct: sc.duration > 0 ? (local / sc.duration) * 100 : 0,
        };
      }
      acc += sc.duration;
    }
    return { activeSceneOffset: 0, scenePlayheadPct: 0 };
  }, [scenes, activeScene?.id, storyElapsed]);

  const handleTrackPointer = (clientX: number) => {
    const el = trackRef.current;
    if (!el || totalDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onScrubTimeline(ratio * totalDuration);
  };

  const handleRulerPointer = (clientX: number, el: HTMLDivElement) => {
    if (!activeScene) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onScrubTimeline(activeSceneOffset + ratio * activeScene.duration);
  };

  const propActors = useMemo(
    () =>
      (activeScene?.actors || []).filter(
        (a) =>
          (a.heldItemLeft && a.heldItemLeft.itemKind !== 'none') ||
          (a.heldItemRight && a.heldItemRight.itemKind !== 'none')
      ),
    [activeScene?.actors]
  );

  const voiceActors = useMemo(
    () =>
      (activeScene?.actors || []).filter(
        (a) => a.dialogue.trim().length > 0 || Boolean(a.audio)
      ),
    [activeScene?.actors]
  );

  const formatPropLabel = (a: SceneActor) => {
    const parts: string[] = [];
    if (a.heldItemLeft && a.heldItemLeft.itemKind !== 'none') {
      parts.push(`L:${a.heldItemLeft.label}`);
    }
    if (a.heldItemRight && a.heldItemRight.itemKind !== 'none') {
      parts.push(`R:${a.heldItemRight.label}`);
    }
    return `${a.name} · ${parts.join(' ')}`;
  };

  return (
    <footer className="shrink min-h-0 max-h-[48dvh] overflow-y-auto studio-scroll bg-[#111622] border-t border-white/10 px-2.5 sm:px-5 py-2 space-y-2 z-20">
      {/* Top Row: Play Controls + Playhead Time + Tracks Toggle + Duration Slider */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onTogglePlayStory}
            className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Movie</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onStopPlayback}
            title="Stop and rewind to Scene 1"
            className="h-8 w-8 rounded-lg bg-[#1A2130] hover:bg-[#232C3F] border border-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <span className="text-xs font-mono-tabular text-slate-300 pl-1 whitespace-nowrap">
            {formatSec(storyElapsed)} / {formatSec(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTracksExpanded((v) => !v)}
            className="h-7 px-2.5 rounded-lg bg-[#171E2E] hover:bg-[#1E273B] border border-white/10 text-[11px] font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Tracks</span>
            {tracksExpanded ? (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            )}
          </button>

          {activeScene && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#171E2E] border border-white/8">
              <span className="text-[11px] text-slate-400 whitespace-nowrap hidden sm:inline">
                Scene Duration
              </span>
              <input
                type="range"
                min={3}
                max={20}
                step={1}
                value={activeScene.duration}
                onChange={(e) =>
                  onUpdateSceneDuration(activeScene.id, Number(e.target.value))
                }
                className="w-16 sm:w-24 studio-range"
              />
              <span className="text-[11px] font-mono-tabular text-amber-400 w-7 text-right">
                {activeScene.duration}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Scrubbable Red Playhead Bar */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          onScrubStateChange?.(true);
          handleTrackPointer(e.clientX);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handleTrackPointer(e.clientX);
        }}
        onPointerUp={() => onScrubStateChange?.(false)}
        onPointerCancel={() => onScrubStateChange?.(false)}
        role="slider"
        aria-label="Story playhead"
        aria-valuemin={0}
        aria-valuemax={totalDuration}
        aria-valuenow={Number(storyElapsed.toFixed(1))}
        tabIndex={0}
        className="relative w-full h-3 flex items-center cursor-pointer touch-none"
      >
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-500/80"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow"
          style={{ left: `${progressPct}%` }}
        />
      </div>

      {/* Scene Cards Track */}
      <div className="flex items-center gap-2 overflow-x-auto studio-scroll pb-0.5">
        {scenes.map((scene, index) => {
          const isActive = scene.id === activeSceneId;
          const hasAudio =
            Boolean(scene.audio) || scene.actors.some((a) => Boolean(a.audio));
          return (
            <div
              key={scene.id}
              onClick={() => onSelectScene(scene.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectScene(scene.id);
                }
              }}
              className={`shrink-0 min-w-[172px] max-w-[205px] rounded-xl p-2 border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#1D2538] border-amber-500/75'
                  : 'bg-[#161C2B] border-white/8 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`text-xs font-semibold truncate ${
                    isActive ? 'text-amber-300' : 'text-slate-200'
                  }`}
                >
                  {scene.title || `Scene ${index + 1}`}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderScene(scene.id, -1);
                    }}
                    title="Move scene left"
                    className="p-0.5 rounded hover:bg-white/10 disabled:opacity-25 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === scenes.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderScene(scene.id, 1);
                    }}
                    title="Move scene right"
                    className="p-0.5 rounded hover:bg-white/10 disabled:opacity-25 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateScene(scene.id);
                    }}
                    title="Duplicate scene"
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {scenes.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteScene(scene.id);
                      }}
                      title="Delete scene"
                      className="p-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                <span className="font-mono-tabular text-amber-400/90">
                  {scene.duration}s
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">
                  {ENVIRONMENT_META[scene.environment].label}
                </span>
                {hasAudio && (
                  <>
                    <span aria-hidden="true">·</span>
                    <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  </>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddScene}
          className="shrink-0 h-[52px] px-3.5 rounded-xl border border-dashed border-white/20 hover:border-amber-500/60 bg-[#151B29] hover:bg-[#1B2335] text-xs font-medium text-slate-300 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Scene</span>
        </button>
      </div>

      {/* Multi-Layer Timeline Tracks for Active Scene */}
      {tracksExpanded && activeScene && (
        <div className="rounded-xl bg-[#0D121C] border border-white/10 max-h-[210px] overflow-y-auto studio-scroll">
          {/* Ruler Header */}
          <div className="sticky top-0 z-20 grid grid-cols-[118px_1fr] sm:grid-cols-[152px_1fr] border-b border-white/10 bg-[#0B0F18] text-[10px] text-slate-400">
            <div className="px-2.5 py-1 font-medium text-slate-300 border-r border-white/10 truncate">
              {activeScene.title} Layers
            </div>
            <div
              onPointerDown={(e) => {
                onScrubStateChange?.(true);
                handleRulerPointer(e.clientX, e.currentTarget);
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) handleRulerPointer(e.clientX, e.currentTarget);
              }}
              onPointerUp={() => onScrubStateChange?.(false)}
              onPointerCancel={() => onScrubStateChange?.(false)}
              className="relative px-2 py-1 flex items-center justify-between font-mono-tabular cursor-pointer select-none touch-none"
            >
              <span>0.0s</span>
              <span>{(activeScene.duration * 0.5).toFixed(1)}s</span>
              <span>{activeScene.duration.toFixed(1)}s</span>
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-rose-500"
                style={{ left: `${scenePlayheadPct}%` }}
              />
            </div>
          </div>

          <div className="divide-y divide-white/8">
            {/* Track (a): Characters & Activities */}
            <div className="grid grid-cols-[118px_1fr] sm:grid-cols-[152px_1fr]">
              <div className="px-2.5 py-1.5 border-r border-white/10 flex items-center gap-1.5 text-[10px] font-medium text-sky-300 bg-[#101624]">
                <Users className="w-3 h-3 shrink-0" />
                <span className="truncate">Activities</span>
              </div>
              <div className="relative py-0.5 space-y-0.5 bg-[#0D121C]">
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-rose-500/70 z-10"
                  style={{ left: `${scenePlayheadPct}%` }}
                />
                {activeScene.actors.map((actor) => {
                  const aStart = actor.startTime ?? 0;
                  const aEnd = actor.endTime ?? activeScene.duration;
                  const aSpan = Math.max(0.4, aEnd - aStart);
                  const trIn = actor.transitions?.entrance && actor.transitions.entrance !== 'none' ? actor.transitions.entrance : null;
                  const trOut = actor.transitions?.exit && actor.transitions.exit !== 'none' ? actor.transitions.exit : null;
                  const hasPath = Boolean(actor.motionPath?.enabled || actor.walkPath?.enabled);
                  const inPct = trIn ? ((actor.transitions?.entranceDuration ?? 0.8) / aSpan) * 100 : 0;
                  const outPct = trOut ? ((actor.transitions?.exitDuration ?? 0.8) / aSpan) * 100 : 0;
                  const extras = [
                    hasPath ? 'Path' : null,
                    trIn ? `In:${trIn}` : null,
                    trOut ? `Out:${trOut}` : null,
                  ].filter(Boolean);
                  const barLabel = `${actor.name} · ${actor.animation}${extras.length ? ` · ${extras.join(' ')}` : ''}`;

                  return (
                    <div key={`act-${actor.id}`} className="relative h-6 w-full">
                      <DraggableTrackBar
                        start={aStart}
                        end={aEnd}
                        duration={activeScene.duration}
                        label={barLabel}
                        barClass="bg-sky-500/20 border-sky-400/55 text-sky-100 hover:bg-sky-500/30"
                        selected={actor.id === selectedActorId}
                        entrancePct={inPct}
                        exitPct={outPct}
                        onClick={() => onSelectActor(actor.id)}
                        onChangeRange={(ns, ne) =>
                          onUpdateActorTiming(actor.id, 'activity', ns, ne)
                        }
                      />
                    </div>
                  );
                })}
                {activeScene.actors.length === 0 && (
                  <div className="h-6 flex items-center px-2 text-[10px] text-slate-500">
                    Add a character from 3D Library
                  </div>
                )}
              </div>
            </div>

            {/* Track (b): Hand Props */}
            <div className="grid grid-cols-[118px_1fr] sm:grid-cols-[152px_1fr]">
              <div className="px-2.5 py-1.5 border-r border-white/10 flex items-center gap-1.5 text-[10px] font-medium text-amber-300 bg-[#101624]">
                <Hand className="w-3 h-3 shrink-0" />
                <span className="truncate">Hand Props</span>
              </div>
              <div className="relative py-0.5 space-y-0.5 bg-[#0D121C]">
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-rose-500/70 z-10"
                  style={{ left: `${scenePlayheadPct}%` }}
                />
                {propActors.length > 0 ? (
                  propActors.map((actor) => (
                    <div key={`prop-${actor.id}`} className="relative h-6 w-full">
                      <DraggableTrackBar
                        start={actor.propStartTime ?? 0}
                        end={actor.propEndTime ?? activeScene.duration}
                        duration={activeScene.duration}
                        label={formatPropLabel(actor)}
                        barClass="bg-amber-500/20 border-amber-400/60 text-amber-100 hover:bg-amber-500/30"
                        selected={actor.id === selectedActorId}
                        onClick={() => onSelectActor(actor.id)}
                        onChangeRange={(ns, ne) =>
                          onUpdateActorTiming(actor.id, 'prop', ns, ne)
                        }
                      />
                    </div>
                  ))
                ) : (
                  <div className="h-6 flex items-center px-2 text-[10px] text-slate-500">
                    Select a character and equip a Hand Prop to time it here
                  </div>
                )}
              </div>
            </div>

            {/* Track (c): Voice & Dialogue Lip-Sync */}
            <div className="grid grid-cols-[118px_1fr] sm:grid-cols-[152px_1fr]">
              <div className="px-2.5 py-1.5 border-r border-white/10 flex items-center gap-1.5 text-[10px] font-medium text-emerald-300 bg-[#101624]">
                <Mic className="w-3 h-3 shrink-0" />
                <span className="truncate">Voice / Lip-Sync</span>
              </div>
              <div className="relative py-0.5 space-y-0.5 bg-[#0D121C]">
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-rose-500/70 z-10"
                  style={{ left: `${scenePlayheadPct}%` }}
                />
                {voiceActors.map((actor) => (
                  <div key={`voice-${actor.id}`} className="relative h-6 w-full">
                    <DraggableTrackBar
                      start={actor.voiceStartTime ?? 0}
                      end={actor.voiceEndTime ?? activeScene.duration}
                      duration={activeScene.duration}
                      label={`${actor.name}: ${
                        actor.dialogue.trim() || actor.audio?.name || 'Voice'
                      }`}
                      barClass="bg-emerald-500/20 border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/30"
                      selected={actor.id === selectedActorId}
                      onClick={() => onSelectActor(actor.id)}
                      onChangeRange={(ns, ne) =>
                        onUpdateActorTiming(actor.id, 'voice', ns, ne)
                      }
                    />
                  </div>
                ))}
                {voiceActors.length === 0 && (
                  <div className="h-6 flex items-center px-2 text-[10px] text-slate-500">
                    {activeScene.audio
                      ? `Scene Audio: ${activeScene.audio.name}`
                      : 'Add dialogue or record voiceover in Voice & AI tab'}
                  </div>
                )}
              </div>
            </div>

            {/* Track (d): Camera & Zoom */}
            <div className="grid grid-cols-[118px_1fr] sm:grid-cols-[152px_1fr]">
              <div className="px-2.5 py-1.5 border-r border-white/10 flex items-center gap-1.5 text-[10px] font-medium text-violet-300 bg-[#101624]">
                <Camera className="w-3 h-3 shrink-0" />
                <span className="truncate">Camera & Zoom</span>
              </div>
              <div className="relative h-6 w-full bg-[#0D121C]">
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-rose-500/70 z-10"
                  style={{ left: `${scenePlayheadPct}%` }}
                />
                <DraggableTrackBar
                  start={activeScene.cameraStartTime ?? 0}
                  end={activeScene.cameraEndTime ?? activeScene.duration}
                  duration={activeScene.duration}
                  label={`${
                    CAMERA_PRESETS[activeScene.cameraPreset || 'wide'].label
                  } · ${
                    activeScene.cameraZoom === 'zoomIn'
                      ? 'Zoom In'
                      : activeScene.cameraZoom === 'zoomOut'
                        ? 'Zoom Out'
                        : 'Static'
                  }`}
                  barClass="bg-violet-500/20 border-violet-400/60 text-violet-100 hover:bg-violet-500/30"
                  onChangeRange={(ns, ne) =>
                    onUpdateSceneCameraTiming(activeScene.id, ns, ne)
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
