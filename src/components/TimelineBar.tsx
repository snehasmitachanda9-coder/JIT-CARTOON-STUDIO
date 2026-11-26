import React, { useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pause,
  Play,
  Plus,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { ENVIRONMENT_META, SceneData } from '../types/studio';

interface TimelineBarProps {
  scenes: SceneData[];
  activeSceneId: string;
  isPlaying: boolean;
  storyElapsed: number;
  totalDuration: number;
  onSelectScene: (id: string) => void;
  onScrubTimeline: (sec: number) => void;
  onAddScene: () => void;
  onDuplicateScene: (id: string) => void;
  onReorderScene: (id: string, dir: -1 | 1) => void;
  onDeleteScene: (id: string) => void;
  onUpdateSceneDuration: (id: string, duration: number) => void;
  onTogglePlayStory: () => void;
  onStopPlayback: () => void;
}

function formatSec(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const rem = clamped - mins * 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
}

export function TimelineBar({
  scenes,
  activeSceneId,
  isPlaying,
  storyElapsed,
  totalDuration,
  onSelectScene,
  onScrubTimeline,
  onAddScene,
  onDuplicateScene,
  onReorderScene,
  onDeleteScene,
  onUpdateSceneDuration,
  onTogglePlayStory,
  onStopPlayback,
}: TimelineBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeScene = scenes.find((s) => s.id === activeSceneId) || scenes[0];
  const progressPct =
    totalDuration > 0 ? Math.min(100, (storyElapsed / totalDuration) * 100) : 0;

  const handleTrackPointer = (clientX: number) => {
    const el = trackRef.current;
    if (!el || totalDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onScrubTimeline(ratio * totalDuration);
  };

  return (
    <footer className="shrink-0 bg-[#111622] border-t border-white/10 px-2.5 sm:px-5 py-2 space-y-2 z-20">
      {/* Top Row: Play Controls + Playhead Time + Duration Slider */}
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

        {activeScene && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#171E2E] border border-white/8">
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
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
          </div>
        )}
      </div>

      {/* Scrubbable Red Playhead Bar */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          handleTrackPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handleTrackPointer(e.clientX);
        }}
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
        {/* Red Playhead Handle */}
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
              className={`shrink-0 min-w-[178px] max-w-[210px] rounded-xl p-2 border transition-colors cursor-pointer ${
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
          className="shrink-0 h-[54px] px-3.5 rounded-xl border border-dashed border-white/20 hover:border-amber-500/60 bg-[#151B29] hover:bg-[#1B2335] text-xs font-medium text-slate-300 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Scene</span>
        </button>
      </div>
    </footer>
  );
}
