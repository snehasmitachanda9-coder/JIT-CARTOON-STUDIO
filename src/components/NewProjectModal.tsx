import React, { useState } from 'react';
import {
  Clapperboard,
  Crown,
  GraduationCap,
  Monitor,
  Plus,
  Smartphone,
  Sparkles,
  Square as SquareIcon,
  Trees,
  X,
} from 'lucide-react';
import { AspectRatioMode, EnvironmentId, ENVIRONMENT_META } from '../types/studio';

export type ProjectTemplateId =
  | 'blank'
  | 'village'
  | 'classroom'
  | 'jungle'
  | 'palace';

export interface NewProjectConfig {
  projectName: string;
  aspectRatio: AspectRatioMode;
  templateId: ProjectTemplateId;
  blankEnvironment: EnvironmentId;
}

interface NewProjectModalProps {
  open: boolean;
  canDismiss: boolean;
  initialProjectName: string;
  initialAspectRatio: AspectRatioMode;
  onCreateProject: (config: NewProjectConfig) => void;
  onClose: () => void;
}

const STARTER_TEMPLATES: Array<{
  id: Exclude<ProjectTemplateId, 'blank'>;
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'village',
    title: 'Green Village',
    subtitle: 'Boy, Girl & Dog on sunny village meadow',
    accent: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    icon: <Trees className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'classroom',
    title: 'School Classroom',
    subtitle: 'Teacher with Book & Robot in classroom',
    accent: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    icon: <GraduationCap className="w-4 h-4 text-sky-400" />,
  },
  {
    id: 'jungle',
    title: 'Rainbow Jungle',
    subtitle: 'Forest adventure with Monkey, Elephant & Bird',
    accent: 'border-teal-500/40 bg-teal-500/10 text-teal-300',
    icon: <Sparkles className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'palace',
    title: 'Royal Palace',
    subtitle: 'King, Queen, Princess & Fairy courtyard',
    accent: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    icon: <Crown className="w-4 h-4 text-amber-400" />,
  },
];

const BLANK_ENVS: EnvironmentId[] = [
  'studio',
  'village',
  'park',
  'classroom',
  'palace',
  'forest',
];

export function NewProjectModal({
  open,
  canDismiss,
  initialProjectName,
  initialAspectRatio,
  onCreateProject,
  onClose,
}: NewProjectModalProps) {
  const [projectName, setProjectName] = useState(
    initialProjectName || 'My Cartoon Story'
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>(initialAspectRatio);
  const [templateId, setTemplateId] = useState<ProjectTemplateId>('blank');
  const [blankEnvironment, setBlankEnvironment] = useState<EnvironmentId>('village');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = projectName.trim() || 'My Cartoon Story';
    onCreateProject({
      projectName: cleaned,
      aspectRatio,
      templateId,
      blankEnvironment,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#06080D]/88 p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-heading"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-2xl bg-[#121723] border border-white/15 shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#161D2C] border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0">
              <Clapperboard className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="new-project-heading"
                className="font-display text-base sm:text-lg font-semibold text-slate-100 truncate"
              >
                Create New Cartoon Project
              </h2>
              <p className="text-[11px] text-slate-400">
                Name your story, pick your frame format, and start from blank or a starter world
              </p>
            </div>
          </div>

          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* 1. Project Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="project-name-input"
              className="block text-xs font-medium text-slate-300"
            >
              Project Name
            </label>
            <input
              id="project-name-input"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Cartoon Story"
              maxLength={48}
              autoFocus
              className="w-full h-10 px-3.5 rounded-xl bg-[#0B0E14] border border-white/15 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* 2. Aspect Ratio */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-300">
              Video Aspect Ratio
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    id: '16:9',
                    label: '16:9 YouTube',
                    sub: 'Widescreen HD',
                    icon: <Monitor className="w-4 h-4" />,
                  },
                  {
                    id: '9:16',
                    label: '9:16 Reels/Shorts',
                    sub: 'Vertical Story',
                    icon: <Smartphone className="w-4 h-4" />,
                  },
                  {
                    id: '1:1',
                    label: '1:1 Square',
                    sub: 'Social Feed',
                    icon: <SquareIcon className="w-4 h-4" />,
                  },
                ] as const
              ).map((opt) => {
                const active = aspectRatio === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAspectRatio(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-500/18 border-amber-400 text-amber-100'
                        : 'bg-[#0E131D] border-white/10 text-slate-300 hover:bg-[#192234]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={active ? 'text-amber-400' : 'text-slate-400'}>
                        {opt.icon}
                      </span>
                      <span className="text-xs font-semibold truncate">{opt.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Blank Stage OR Starter Templates */}
          <div className="space-y-2.5">
            <span className="block text-xs font-medium text-slate-300">
              Starting Stage
            </span>

            {/* Blank Empty Stage Option */}
            <button
              type="button"
              onClick={() => setTemplateId('blank')}
              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                templateId === 'blank'
                  ? 'bg-sky-500/15 border-sky-400 text-slate-100'
                  : 'bg-[#0E131D] border-white/10 text-slate-300 hover:bg-[#192234]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                    templateId === 'blank'
                      ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                      : 'bg-[#171E2E] border-white/10 text-slate-400'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold">Blank Empty Stage</div>
                  <p className="text-[11px] text-slate-400">
                    Clean 3D ground ready for adding your own characters, animals & props
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  templateId === 'blank'
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-white/8 text-slate-400'
                }`}
              >
                Recommended
              </span>
            </button>

            {/* Stage Backdrop Selector when Blank Stage is chosen */}
            {templateId === 'blank' && (
              <div className="flex flex-wrap items-center gap-1.5 pl-1">
                <span className="text-[11px] text-slate-400 mr-1">Stage Ground:</span>
                {BLANK_ENVS.map((envId) => {
                  const active = blankEnvironment === envId;
                  return (
                    <button
                      key={envId}
                      type="button"
                      onClick={() => setBlankEnvironment(envId)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer ${
                        active
                          ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                          : 'bg-[#0E131D] border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {ENVIRONMENT_META[envId].label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pre-Built Starter Templates */}
            <div className="pt-1">
              <div className="text-[11px] text-slate-400 mb-1.5">
                Or pick a Pre-Built Starter Template:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_TEMPLATES.map((tpl) => {
                  const active = templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplateId(tpl.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-500/18 border-amber-400 text-slate-100'
                          : 'bg-[#0E131D] border-white/10 text-slate-300 hover:bg-[#192234]'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${tpl.accent}`}
                      >
                        {tpl.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{tpl.title}</div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {tpl.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0E131D] border-t border-white/10 flex items-center justify-end gap-2.5">
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl bg-[#1A2130] hover:bg-[#232C3F] border border-white/10 text-xs font-medium text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="h-9 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer transition-colors"
          >
            Start Creating Project
          </button>
        </div>
      </form>
    </div>
  );
}
