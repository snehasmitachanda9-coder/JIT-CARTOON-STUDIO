import React from 'react';
import { Download, Film, X } from 'lucide-react';
import { ExportProgress } from '../types/studio';

interface ExportModalProps {
  exportState: ExportProgress;
  onCancel: () => void;
  onClose: () => void;
}

export function ExportModal({ exportState, onCancel, onClose }: ExportModalProps) {
  if (!exportState.active && !exportState.downloadUrl) return null;

  const pct = Math.round(exportState.progress * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#131824] border border-white/12 shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Film className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {exportState.active
                  ? `Rendering 1080p HD Video... (${pct}%)`
                  : '1080p HD Video Ready'}
              </h3>
              <p className="text-xs text-slate-400">{exportState.statusText}</p>
            </div>
          </div>

          {!exportState.active && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 cursor-pointer"
              aria-label="Close export modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {exportState.active ? (
          <div className="space-y-3">
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-[width] duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                Rendering 1080p HD Video... ({pct}%)
              </span>
              <span className="font-mono-tabular text-amber-400 font-semibold">{pct}%</span>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/14 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Cancel Export
              </button>
            </div>
          </div>
        ) : (
          exportState.downloadUrl && (
            <div className="space-y-3">
              <video
                src={exportState.downloadUrl}
                controls
                className="w-full max-h-60 rounded-xl bg-black border border-white/10"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/14 text-xs font-medium text-slate-200 cursor-pointer"
                >
                  Done
                </button>
                <a
                  href={exportState.downloadUrl}
                  download={exportState.fileName}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Video</span>
                </a>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
