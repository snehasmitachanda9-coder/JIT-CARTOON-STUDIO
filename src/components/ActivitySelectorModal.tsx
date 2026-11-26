import React, { useEffect, useRef, useState } from 'react';
import { Hand, Image as ImageIcon, Sparkles, Users, X } from 'lucide-react';
import {
  ActorType,
  AnimationState,
  CustomModelBlueprint,
  getActivitiesForModel,
  HANDHELD_ITEM_META,
  HandheldItemKind,
  HeldItemAttachment,
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
      heldItemLeft?: HeldItemAttachment | null;
      heldItemRight?: HeldItemAttachment | null;
    };

export interface ActivityModalHeldSelection {
  left?: HeldItemAttachment | null;
  right?: HeldItemAttachment | null;
}

interface ActivitySelectorModalProps {
  target: ActivityPickerTarget | null;
  onSelectActivity: (
    activity: AnimationState,
    heldSelection?: ActivityModalHeldSelection
  ) => void;
  onClose: () => void;
}

export function ActivitySelectorModal({
  target,
  onSelectActivity,
  onClose,
}: ActivitySelectorModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeHand, setActiveHand] = useState<'right' | 'left'>('right');
  const [leftItem, setLeftItem] = useState<HeldItemAttachment | null>(null);
  const [rightItem, setRightItem] = useState<HeldItemAttachment | null>(null);
  const [customTouched, setCustomTouched] = useState(false);

  useEffect(() => {
    if (!target) return;
    setActiveHand('right');
    setCustomTouched(false);
    if (target.mode === 'update') {
      setLeftItem(target.heldItemLeft ?? null);
      setRightItem(target.heldItemRight ?? null);
    } else {
      setLeftItem(null);
      setRightItem(null);
    }
  }, [target]);

  if (!target) return null;

  const activities = getActivitiesForModel(target.actorType, target.kind);
  const currentAnim = target.mode === 'update' ? target.currentAnimation : null;
  const isTwins = target.kind === 'twins';
  const supportsHandheld = target.actorType === 'character';
  const currentHandItem = activeHand === 'left' ? leftItem : rightItem;

  const setHandItem = (hand: 'left' | 'right', item: HeldItemAttachment | null) => {
    setCustomTouched(true);
    if (hand === 'left') setLeftItem(item);
    else setRightItem(item);
  };

  const handleSelectBuiltin = (itemKind: HandheldItemKind, label: string) => {
    if (itemKind === 'none') {
      setHandItem(activeHand, null);
      return;
    }
    setHandItem(activeHand, {
      itemKind,
      label,
      scale: currentHandItem?.scale ?? 1,
      rotationDeg: currentHandItem?.rotationDeg ?? 0,
      offsetY: currentHandItem?.offsetY ?? 0,
      offsetZ: currentHandItem?.offsetZ ?? 0,
    });
  };

  const handleUploadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setHandItem(activeHand, {
        itemKind: 'customImage',
        label: file.name.slice(0, 20),
        imageDataUrl: dataUrl,
        removeBg: true,
        scale: 1,
        rotationDeg: 0,
        offsetY: 0,
        offsetZ: 0,
      });
    };
    reader.readAsDataURL(file);
  };

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
      <div className="relative z-10 w-full sm:max-w-lg max-h-[86dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#111622] border border-white/15 shadow-2xl overflow-hidden">
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
                ? 'Optional: attach a hand item below, then tap an activity to place on stage.'
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto studio-scroll p-3.5 space-y-3.5">
          {/* Optional Hold Item in Hand section for Characters */}
          {supportsHandheld && (
            <div className="p-2.5 rounded-xl bg-[#161C2B] border border-white/10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Hand className="w-3.5 h-3.5 text-amber-400" />
                  <span>Hold Item in Hand (Optional)</span>
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

              <div className="grid grid-cols-3 gap-1">
                {HANDHELD_ITEM_META.slice(0, 9).map((item) => {
                  const active =
                    (!currentHandItem && item.id === 'none') ||
                    currentHandItem?.itemKind === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectBuiltin(item.id, item.label)}
                      className={`py-1 px-1.5 rounded-md text-[10px] font-medium border truncate cursor-pointer ${
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

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-1 px-2.5 rounded-lg bg-[#1D2538] hover:bg-[#242E45] border border-white/10 text-[11px] font-medium text-sky-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Upload Prop PNG/JPG</span>
                </button>
                <span className="text-[10px] text-slate-400 truncate">
                  {currentHandItem
                    ? `${activeHand === 'left' ? 'L' : 'R'}: ${currentHandItem.label}`
                    : `${activeHand === 'left' ? 'L' : 'R'}: Empty`}
                </span>
              </div>
            </div>
          )}

          {/* Activity Grid */}
          <div className="grid grid-cols-2 gap-2">
            {activities.map((activity) => {
              const isActive = currentAnim === activity;
              return (
                <button
                  key={activity}
                  type="button"
                  onClick={() =>
                    onSelectActivity(
                      activity,
                      supportsHandheld && customTouched
                        ? { left: leftItem, right: rightItem }
                        : undefined
                    )
                  }
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
