import React, { useRef, useState } from 'react';
import {
  Clapperboard,
  Clock,
  Crown,
  Download,
  FolderOpen,
  GraduationCap,
  Image as ImageIcon,
  Monitor,
  Play,
  Plus,
  Smartphone,
  Sparkles,
  Square as SquareIcon,
  Trash2,
  Trees,
  Upload,
  X,
} from 'lucide-react';
import {
  AspectRatioMode,
  CustomBackgroundConfig,
  EnvironmentId,
  ENVIRONMENT_META,
  SavedProjectRecord,
} from '../types/studio';

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
  customBackground?: CustomBackgroundConfig | null;
}

interface NewProjectModalProps {
  open: boolean;
  canDismiss: boolean;
  initialProjectName: string;
  initialAspectRatio: AspectRatioMode;
  savedProjects: SavedProjectRecord[];
  autoDraft: SavedProjectRecord | null;
  onCreateProject: (config: NewProjectConfig) => void;
  onResumeProject: (record: SavedProjectRecord) => void;
  onDeleteSavedProject: (id: string) => void;
  onDownloadProjectJson: (record?: SavedProjectRecord) => void;
  onImportProjectJson: (file: File) => void;
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

function formatSavedDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Saved recently';
  }
}

export function NewProjectModal({
  open,
  canDismiss,
  initialProjectName,
  initialAspectRatio,
  savedProjects,
  autoDraft,
  onCreateProject,
  onResumeProject,
  onDeleteSavedProject,
  onDownloadProjectJson,
  onImportProjectJson,
  onClose,
}: NewProjectModalProps) {
  const bgInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const [projectName, setProjectName] = useState(
    initialProjectName || 'My Cartoon Story'
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>(initialAspectRatio);
  const [templateId, setTemplateId] = useState<ProjectTemplateId>('blank');
  const [blankEnvironment, setBlankEnvironment] = useState<EnvironmentId>('village');
  const [customBackground, setCustomBackground] =
    useState<CustomBackgroundConfig | null>(null);

  if (!open) return null;

  const handleBgFileSelect = (file: File) => {
    const isVideo =
      file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
    if (isVideo) {
      const objectUrl = URL.createObjectURL(file);
      setCustomBackground({
        url: objectUrl,
        name: file.name,
        mediaType: 'video',
        showGround: true,
      });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl) return;
        setCustomBackground({
          url: dataUrl,
          name: file.name,
          mediaType: 'image',
          showGround: true,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = projectName.trim() || 'My Cartoon Story';
    onCreateProject({
      projectName: cleaned,
      aspectRatio,
      templateId,
      blankEnvironment,
      customBackground,
    });
  };

  const showAutoDraftBanner =
    Boolean(autoDraft) &&
    autoDraft!.scenes.some((s) => s.actors.length > 0 || s.customBackground) &&
    !savedProjects.some(
      (p) =>
        p.id === autoDraft!.id &&
        Math.abs(p.updatedAt - autoDraft!.updatedAt) < 15_000
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#06080D]/88 p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-heading"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[92dvh] rounded-2xl bg-[#121723] border border-white/15 shadow-2xl overflow-hidden flex flex-col my-auto"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#161D2C] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0">
              <Clapperboard className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="new-project-heading"
                className="font-display text-base sm:text-lg font-semibold text-slate-100 truncate"
              >
                JIT 3D Cartoon Studio — Projects
              </h2>
              <p className="text-[11px] text-slate-400">
                Resume a saved project, load a backup file, or start a brand-new cartoon
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

        {/* Scrollable Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Saved Projects (Resume Work) & JSON Backup/Restore */}
          <div className="p-3.5 rounded-xl bg-[#0D121C] border border-emerald-500/30 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">
                  Saved Projects (Resume Work)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[10px] font-mono-tabular text-emerald-200">
                  {savedProjects.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  ref={projectFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportProjectJson(file);
                    e.target.value = '';
                  }}
                />
                {canDismiss && (
                  <button
                    type="button"
                    onClick={() => onDownloadProjectJson()}
                    className="px-2.5 py-1 rounded-lg bg-[#172033] hover:bg-[#202C45] border border-white/12 text-[11px] font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-amber-400" />
                    <span>Download (.json)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => projectFileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-[#172033] hover:bg-[#202C45] border border-sky-400/35 text-[11px] font-medium text-sky-200 flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-sky-400" />
                  <span>Load Project File (.json)</span>
                </button>
              </div>
            </div>

            {showAutoDraftBanner && autoDraft && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/35 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-amber-200 truncate">
                    Auto-Saved Draft: {autoDraft.projectName}
                  </div>
                  <div className="text-[10px] text-amber-300/80 flex items-center gap-1.5">
                    <span>{autoDraft.scenes.length} scene(s)</span>
                    <span>·</span>
                    <span>{formatSavedDate(autoDraft.updatedAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onResumeProject(autoDraft)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Open Draft</span>
                </button>
              </div>
            )}

            {savedProjects.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-1">
                No saved projects yet — click &ldquo;Save Project&rdquo; in the top bar anytime to store your work here or export a .json backup.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
                {savedProjects.map((proj) => {
                  const totalActors = proj.scenes.reduce(
                    (sum, s) => sum + (s.actors?.length || 0),
                    0
                  );
                  return (
                    <div
                      key={proj.id}
                      className="p-2 rounded-lg bg-[#141B29] border border-white/10 hover:border-emerald-400/40 flex items-center justify-between gap-2.5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {proj.thumbnailDataUrl ? (
                          <img
                            src={proj.thumbnailDataUrl}
                            alt={proj.projectName}
                            className="w-14 h-8 rounded object-cover border border-white/10 shrink-0 bg-[#0B0E14]"
                          />
                        ) : (
                          <div className="w-14 h-8 rounded bg-[#1B2436] border border-white/10 flex items-center justify-center shrink-0">
                            <Clapperboard className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-100 truncate">
                              {proj.projectName}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-white/8 text-[9px] text-slate-300 shrink-0">
                              {proj.aspectRatio}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span>
                              {proj.scenes.length} scene{proj.scenes.length === 1 ? '' : 's'} · {totalActors} model{totalActors === 1 ? '' : 's'}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {formatSavedDate(proj.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onResumeProject(proj)}
                          className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Open &amp; Continue</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDownloadProjectJson(proj)}
                          title="Download Project (.json)"
                          className="p-1.5 rounded-md bg-[#1C2538] hover:bg-[#25314B] text-slate-300 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSavedProject(proj.id)}
                          title="Delete saved project"
                          className="p-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 1. Project Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="project-name-input"
              className="block text-xs font-medium text-slate-300"
            >
              Create New Project — Project Name
            </label>
            <input
              id="project-name-input"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Cartoon Story"
              maxLength={48}
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
                    Clean 3D ground ready for adding your own characters, animals &amp; props
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

            {/* 4. Optional Custom Photo/Video Background */}
            <div className="pt-2 border-t border-white/8 space-y-2">
              <input
                ref={bgInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBgFileSelect(file);
                  e.target.value = '';
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => bgInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-[#192338] hover:bg-[#22304D] border border-sky-400/35 text-xs font-medium text-sky-200 flex items-center gap-2 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>Upload Custom Background (Image / Video)</span>
                </button>
                {customBackground && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={customBackground.showGround}
                        onChange={(e) =>
                          setCustomBackground((prev) =>
                            prev ? { ...prev, showGround: e.target.checked } : prev
                          )
                        }
                        className="accent-amber-500"
                      />
                      <span>Show 3D Ground</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomBackground(null)}
                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                      title="Clear custom background"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {customBackground && (
                <div className="px-2.5 py-1.5 rounded-lg bg-sky-500/12 border border-sky-400/30 text-[11px] text-sky-200 flex items-center justify-between gap-2">
                  <span className="truncate">
                    Backdrop ({customBackground.mediaType}): {customBackground.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0E131D] border-t border-white/10 flex items-center justify-end gap-2.5 shrink-0">
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
