import React, { useState } from 'react';
import {
  Clapperboard,
  Download,
  FolderPlus,
  Maximize2,
  Minimize2,
  Redo2,
  Save,
  Smartphone,
  Undo2,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface TopHeaderProps {
  projectName: string;
  hasCreatedProject: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isFullscreen: boolean;
  isExporting: boolean;
  onNewProject: () => void;
  onSaveProject: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleFullscreen: () => void;
  onExportVideo: () => void;
}

export function TopHeader({
  projectName,
  hasCreatedProject,
  canUndo,
  canRedo,
  isFullscreen,
  isExporting,
  onNewProject,
  onSaveProject,
  onUndo,
  onRedo,
  onToggleFullscreen,
  onExportVideo,
}: TopHeaderProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <>
      <header className="h-13 shrink-0 bg-[#111622] border-b border-white/10 px-2.5 sm:px-5 flex items-center justify-between gap-2 sm:gap-4 z-30">
        {/* Brand Title + Live Project Name */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Clapperboard className="w-4 h-4 text-amber-400" />
          </div>
          <h1 className="font-display text-sm sm:text-lg font-semibold tracking-tight text-slate-100 truncate">
            JIT 3D Cartoon Studio
          </h1>
          {projectName.trim() && (
            <div className="hidden sm:flex items-center gap-1.5 min-w-0">
              <span className="text-slate-600 text-sm">/</span>
              <span className="px-2 py-0.5 rounded-md bg-[#1A2233] border border-white/10 text-xs font-medium text-amber-300 truncate max-w-[170px] lg:max-w-[240px]">
                {projectName}
              </span>
            </div>
          )}
        </div>

        {/* Center Save / New Project / Undo-Redo + Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onSaveProject}
            disabled={!hasCreatedProject}
            title="Save Project (Ctrl+S)"
            className="h-8 px-2 sm:px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-45 disabled:cursor-not-allowed border border-emerald-400/40 text-emerald-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Save Project</span>
          </button>

          <button
            type="button"
            onClick={onNewProject}
            title="Create New or Resume Saved Project"
            className="h-8 px-2 sm:px-2.5 rounded-lg bg-[#1A2130] hover:bg-[#232C3F] border border-sky-400/30 text-sky-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ New Project</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 mr-0.5 sm:mr-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="h-8 w-8 rounded-lg bg-[#1A2130] hover:bg-[#232C3F] disabled:opacity-35 disabled:cursor-not-allowed border border-white/10 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
              className="h-8 w-8 rounded-lg bg-[#1A2130] hover:bg-[#232C3F] disabled:opacity-35 disabled:cursor-not-allowed border border-white/10 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* PWA Install Button */}
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={() => void install()}
              className="hidden sm:flex h-8 px-2.5 rounded-lg bg-[#1A2130] hover:bg-[#232C3F] border border-white/10 text-sky-300 text-xs font-medium items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}
          {!isInstalled && !isInstallable && isIOS && (
            <button
              type="button"
              onClick={() => setShowIOSGuide(true)}
              className="hidden sm:flex h-8 px-2.5 rounded-lg bg-[#1A2130] hover:bg-[#232C3F] border border-white/10 text-sky-300 text-xs font-medium items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}

          {/* Full Screen */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-[#1A2130] hover:bg-[#232C3F] border border-white/10 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden md:inline">Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden md:inline">Full Screen</span>
              </>
            )}
          </button>

          {/* Export Video */}
          <button
            type="button"
            onClick={onExportVideo}
            disabled={isExporting}
            className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Video'}</span>
          </button>
        </div>
      </header>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#131824] border border-white/12 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                Install JIT 3D Cartoon Studio
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg bg-white/5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
              <br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
