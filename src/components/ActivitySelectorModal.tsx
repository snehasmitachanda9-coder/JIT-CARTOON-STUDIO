import React from 'react';
import { Sparkles, Users, X } from 'lucide-react';
import {
  ActorType,
  AnimationState,
  CustomModelBlueprint,
  getActivitiesForModel,
} from '../types/studio';

export type ActivityPickerTarget =
  | {
      mode: 'spawn';
      actorType: ActorType;
      kind: string;
      label: string;
      customBlueprint?: CustomModelBlueprint;
    }
  | {
      mode: 'update';
      actorId: string;
      actorType: ActorType;
      kind: string;
      label: string;
      currentAnimation: AnimationState;
    };

interface ActivitySelectorModalProps {
  target: ActivityPickerTarget | null;
  onSelectActivity: (activity: AnimationState) => void;
  onClose: () => void;
}

export function ActivitySelectorModal({
  target,
  onSelectActivity,
  onClose,
}: ActivitySelectorModalProps) {
  if (!target) return null;

  const activities = getActivitiesForModel(target.actorType, target.kind);
  const currentAnim = target.mode === 'update' ? target.currentAnimation : null;
  const isTwins = target.kind === 'twins';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-modal-title"
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[82dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#111622] border border-white/15 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-white/10 bg-[#0E131D] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="activity-modal-title"
              className="text-sm font-semibold text-slate-100 truncate flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Choose Activity for {target.label}</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {target.mode === 'spawn'
                ? 'Tap an activity to place and animate immediately on stage.'
                : 'Tap an activity to switch animation live.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity selector"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Twins hint */}
        {isTwins && (
          <div className="px-4 py-2 bg-amber-500/12 border-b border-amber-500/25 flex items-center gap-2 text-xs text-amber-200">
            <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Spawns a synchronized Twins pair side-by-side in this activity.</span>
          </div>
        )}

        {/* Activity Grid */}
        <div className="flex-1 overflow-y-auto studio-scroll p-3.5">
          <div className="grid grid-cols-2 gap-2">
            {activities.map((activity) => {
              const isActive = currentAnim === activity;
              return (
                <button
                  key={activity}
                  type="button"
                  onClick={() => onSelectActivity(activity)}
                  className={`px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                      : 'bg-[#171E2E] hover:bg-[#20293F] border-white/10 text-slate-100'
                  }`}
                >
                  <span className="block truncate">{activity}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
