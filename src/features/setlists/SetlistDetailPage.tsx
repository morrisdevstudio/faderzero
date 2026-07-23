import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type SVGProps } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import type { SetlistDisplayMode, SetlistSongDetail } from '@/db/schema';
import { setlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { downloadSetlistPdf } from '@/features/setlists/setlistPdf';
import { songsRepository } from '@/db/repositories/songsRepository';
import { formatSetDuration, formatSongDuration } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { canWriteWorkspace } from '@/services/supabase/workspace';

type IconProps = SVGProps<SVGSVGElement>;

function BackIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 18 9 12l6-6" />
    </svg>
  );
}

function PrompterIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="5" width="16" height="12" rx="2.5" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function PencilIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m4 20 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  );
}

function PlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

function TrashIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12h10l1-12" />
      <path d="M9 7V5h6v2" />
    </svg>
  );
}

function ArrowUpIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 5-6 6" />
      <path d="m12 5 6 6" />
      <path d="M12 5v14" />
    </svg>
  );
}

function ArrowDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 19-6-6" />
      <path d="m12 19 6-6" />
      <path d="M12 5v14" />
    </svg>
  );
}

function DirectSegueIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 4v14" />
      <path d="m7 13 5 5 5-5" />
    </svg>
  );
}

function PdfIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8 14h2" />
      <path d="M8 18h1" />
      <path d="M13 14h1a1.5 1.5 0 0 1 0 3h-1v-3Z" />
      <path d="M17 17v-3h2" />
    </svg>
  );
}

function EditLineIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m4 20 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  );
}

const displayModeOptions: Array<{ value: SetlistDisplayMode; label: string }> = [
  { value: 'all', label: 'Tout afficher' },
  { value: 'none', label: 'Tout masquer' },
  { value: 'per-song', label: 'Par chanson' },
];

function DisplayModeSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SetlistDisplayMode;
  onChange: (value: SetlistDisplayMode) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">{label}</legend>
      <div className="grid grid-cols-3 gap-1.5 rounded-[1rem] border border-white/8 bg-black/20 p-1">
        {displayModeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={[
              'min-h-11 rounded-[0.8rem] px-2 py-2 text-[0.68rem] font-black leading-tight transition',
              value === option.value
                ? 'bg-indigo-500/18 text-indigo-200 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.55)]'
                : 'text-white/58 hover:bg-white/6 hover:text-white/82',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SetlistDetailPage() {
  const { setlistId = '' } = useParams();
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const activeWorkspaceId = activeWorkspace?.id;
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const setlist = useLiveQuery(() => setlistsRepository.getById(setlistId), [setlistId, activeWorkspaceId]);
  const entries = useLiveQuery(() => setlistSongsRepository.listDetailedBySetlistId(setlistId), [setlistId, activeWorkspaceId]);
  const songs = useLiveQuery(() => songsRepository.list(), [activeWorkspaceId]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [bpmDisplayMode, setBpmDisplayMode] = useState<SetlistDisplayMode>('per-song');
  const [keyDisplayMode, setKeyDisplayMode] = useState<SetlistDisplayMode>('per-song');
  const entryElementsRef = useRef(new Map<string, HTMLDivElement>());
  const entryPositionsRef = useRef(new Map<string, number>());
  const entryAnimationsRef = useRef(new Map<string, Animation>());
  const movingEntryIdRef = useRef<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddSongDialogOpen, setIsAddSongDialogOpen] = useState(false);
  const [isAddingSongId, setIsAddingSongId] = useState<string | null>(null);
  const [editingTransitionEntryId, setEditingTransitionEntryId] = useState<string | null>(null);
  const [transitionAnnotation, setTransitionAnnotation] = useState('');
  const [transitionShowBpm, setTransitionShowBpm] = useState(false);
  const [transitionShowKey, setTransitionShowKey] = useState(false);
  const [isEndingNotesOpen, setIsEndingNotesOpen] = useState(false);
  const [endingAnnotation, setEndingAnnotation] = useState('');
  const [isSavingTransition, setIsSavingTransition] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setlist) {
      return;
    }

    setName(setlist.name);
    setDate(setlist.date ?? '');
    setNotes(setlist.notes ?? '');
    setBpmDisplayMode(setlist.bpmDisplayMode ?? 'per-song');
    setKeyDisplayMode(setlist.keyDisplayMode ?? 'per-song');
    setEndingAnnotation(setlist.closingAnnotation ?? '');
  }, [setlist]);

  useLayoutEffect(() => {
    const nextPositions = new Map<string, number>();
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const movingEntryId = movingEntryIdRef.current;

    for (const [entryId, element] of entryElementsRef.current) {
      const nextTop = element.getBoundingClientRect().top;
      const previousTop = entryPositionsRef.current.get(entryId);
      nextPositions.set(entryId, nextTop);

      if (
        movingEntryId === null ||
        prefersReducedMotion ||
        previousTop === undefined ||
        previousTop === nextTop ||
        typeof element.animate !== 'function'
      ) {
        continue;
      }

      const deltaY = previousTop - nextTop;
      entryAnimationsRef.current.get(entryId)?.cancel();
      const animation = element.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: 'translateY(0)' },
        ],
        { duration: 190, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      );
      entryAnimationsRef.current.set(entryId, animation);
      const forgetAnimation = () => {
        if (entryAnimationsRef.current.get(entryId) === animation) {
          entryAnimationsRef.current.delete(entryId);
        }
      };
      animation.addEventListener('finish', forgetAnimation, { once: true });
      animation.addEventListener('cancel', forgetAnimation, { once: true });
    }

    entryPositionsRef.current = nextPositions;
    movingEntryIdRef.current = null;
  }, [entries]);

  if (setlist === undefined || entries === undefined || songs === undefined) {
    return <FeatureCard eyebrow="Chargement" title="Lecture de la setlist" description="Recuperation des donnees locales..." />;
  }

  if (!setlist || setlist.deletedAt !== undefined) {
    return (
      <FeatureCard
        eyebrow="Introuvable"
        title="Cette setlist n'est plus disponible"
        description="Elle a peut-etre ete supprimee ou n'existe plus dans la base locale."
      >
        <Link to="/setlists" className="fz-button-secondary inline-flex px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white">
          Retour a la liste
        </Link>
      </FeatureCard>
    );
  }

  const currentSetlist = setlist;
  const activeSongs = songs;
  const songCount = entries.length;
  const setlistSongIds = new Set(entries.map((entry) => entry.songId));
  const availableSongs = activeSongs.filter((song) => !setlistSongIds.has(song.id));
  const songDurationsById = new Map(activeSongs.map((song) => [song.id, song.durationSeconds] as const));
  const totalDurationSeconds = entries.reduce(
    (total, entry) => total + (songDurationsById.get(entry.songId) ?? 0),
    0,
  );
  const editingTransitionEntry = entries.find((entry) => entry.id === editingTransitionEntryId) ?? null;
  const isTempoDisplayed = bpmDisplayMode === 'all' || (bpmDisplayMode === 'per-song' && transitionShowBpm);
  const isToneDisplayed = keyDisplayMode === 'all' || (keyDisplayMode === 'per-song' && transitionShowKey);

  function buildTransitionLine(entry: SetlistSongDetail) {
    const parts: string[] = [];
    const annotation = entry.annotation?.trim();
    const showKey = keyDisplayMode === 'all' || (keyDisplayMode === 'per-song' && entry.noteShowKey);
    const showBpm = bpmDisplayMode === 'all' || (bpmDisplayMode === 'per-song' && entry.noteShowBpm);

    if (showKey) {
      parts.push(entry.songKey || '— Ton');
    }
    if (showBpm) {
      parts.push(entry.songBpm !== undefined ? `${entry.songBpm} BPM` : '— BPM');
    }
    if (annotation) {
      parts.push(`[${annotation}]`);
    }

    return parts;
  }

  async function handleSaveSetlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom de la setlist est obligatoire.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await setlistsRepository.update(currentSetlist.id, {
        name: trimmedName,
        date,
        notes,
        bpmDisplayMode,
        keyDisplayMode,
      });
      setIsEditing(false);
    } catch {
      setError("Impossible d'enregistrer la setlist.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSetlist() {
    if (!canWrite) return;
    setIsDeleting(true);
    setError(null);

    try {
      await setlistsRepository.softDelete(currentSetlist.id);
      setIsDeleteDialogOpen(false);
      navigate('/setlists');
    } catch {
      setError('Impossible de supprimer la setlist.');
      setIsDeleting(false);
    }
  }

  async function handleAddSong(songId: string) {
    if (!canWrite) return;
    setError(null);
    setIsAddingSongId(songId);

    try {
      await setlistSongsRepository.addSongToSetlist(currentSetlist.id, songId);
    } catch {
      setError("Impossible d'ajouter ce morceau a la setlist.");
    } finally {
      setIsAddingSongId(null);
    }
  }

  async function handleMoveEntry(entryId: string, direction: -1 | 1) {
    if (!canWrite) return;
    setError(null);
    movingEntryIdRef.current = entryId;

    try {
      await setlistSongsRepository.move(entryId, direction);
    } catch {
      movingEntryIdRef.current = null;
      setError('Impossible de reordonner ce morceau.');
    }
  }

  async function handleSaveTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;

    if (!editingTransitionEntry) {
      return;
    }

    setIsSavingTransition(true);
    setError(null);

    try {
      await setlistSongsRepository.update(editingTransitionEntry.id, {
        annotation: transitionAnnotation,
        noteShowBpm: transitionShowBpm,
        noteShowKey: transitionShowKey,
      });
      setEditingTransitionEntryId(null);
    } catch {
      setError("Impossible d'enregistrer la note.");
    } finally {
      setIsSavingTransition(false);
    }
  }

  async function handleSaveEndingNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;

    setIsSavingTransition(true);
    setError(null);

    try {
      await setlistsRepository.update(currentSetlist.id, {
        closingAnnotation: endingAnnotation,
      });
      setIsEndingNotesOpen(false);
    } catch {
      setError("Impossible d'enregistrer la note de fin.");
    } finally {
      setIsSavingTransition(false);
    }
  }

  async function handleToggleDirectSegue(entry: SetlistSongDetail) {
    if (!canWrite) return;
    setError(null);

    try {
      await setlistSongsRepository.update(entry.id, {
        isDirectSegue: !(entry.isDirectSegue ?? false),
      });
    } catch {
      setError("Impossible de modifier l'enchainement.");
    }
  }

  function handleExportPdf() {
    setError(null);

    try {
      downloadSetlistPdf(currentSetlist, entries ?? [], songDurationsById);
    } catch (pdfError) {
      if (pdfError instanceof Error && pdfError.message === 'EMPTY_SETLIST') {
        setError("Ajoutez des chansons a la setlist avant d'exporter le PDF.");
        return;
      }

      setError("Impossible d'ouvrir l'export PDF.");
    }
  }

  function handleCloseEdit() {
    setName(currentSetlist.name);
    setDate(currentSetlist.date ?? '');
    setNotes(currentSetlist.notes ?? '');
    setBpmDisplayMode(currentSetlist.bpmDisplayMode ?? 'per-song');
    setKeyDisplayMode(currentSetlist.keyDisplayMode ?? 'per-song');
    setError(null);
    setIsEditing(false);
  }

  function handleOpenTransitionEditor(entry: SetlistSongDetail) {
    setTransitionAnnotation(entry.annotation ?? '');
    setTransitionShowBpm(entry.noteShowBpm ?? false);
    setTransitionShowKey(entry.noteShowKey ?? false);
    setEditingTransitionEntryId(entry.id);
    setError(null);
  }

  function handleOpenEndingNotesEditor() {
    setEndingAnnotation(currentSetlist.closingAnnotation ?? '');
    setIsEndingNotesOpen(true);
    setError(null);
  }

  return (
    <div className="space-y-5 pb-6">
      <section
        className="sticky z-30 -mx-1 -mt-5 border-b border-white/8 bg-[var(--fz-bg)] px-1 pb-4 pt-2"
        style={{ top: 'calc(var(--fz-header-height, 64px) + var(--fz-viewport-offset-top, 0px))' }}
      >
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3">
          <Link
            to="/setlists"
            aria-label="Retour"
            className="flex h-11 w-11 items-center justify-center text-white transition-colors hover:text-white/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            <BackIcon className="h-5 w-5" />
          </Link>

          <div className="min-w-0 px-1 text-center">
            <h1 className="truncate text-[1.05rem] font-black text-white">{currentSetlist.name}</h1>
            <p className="mt-0.5 truncate text-[0.78rem] text-[var(--fz-text-muted)]">
              {songCount} morceau{songCount > 1 ? 'x' : ''} · {formatSetDuration(totalDurationSeconds)}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Link
              to={`/prompter/play?setlistId=${encodeURIComponent(currentSetlist.id)}`}
              aria-label="Ouvrir le prompteur"
              className="flex h-11 w-11 items-center justify-center text-emerald-300 transition-colors hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300/70"
            >
              <PrompterIcon className="h-5 w-5" />
            </Link>
            {canWrite && isEditing ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isDeleting}
                aria-label="Supprimer"
                className="flex h-11 w-11 items-center justify-center text-rose-300 transition-colors hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300/70 disabled:opacity-60"
              >
                <TrashIcon className="h-4.5 w-4.5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleExportPdf}
              aria-label="Exporter en PDF"
              className="flex h-11 w-11 items-center justify-center text-emerald-300 transition-colors hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300/70"
            >
              <PdfIcon className="h-4.5 w-4.5" />
            </button>

            {canWrite ? <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  handleCloseEdit();
                  return;
                }

                setError(null);
                setIsEditing(true);
              }}
              aria-label={isEditing ? 'Annuler la modification' : 'Modifier'}
              className={[
                'flex h-11 w-11 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                isEditing
                  ? 'text-white hover:text-white/75 focus-visible:outline-white/60'
                  : 'text-indigo-300 hover:text-indigo-200 focus-visible:outline-indigo-300/70',
              ].join(' ')}
            >
              {isEditing ? <CheckIcon className="h-4.5 w-4.5" /> : <PencilIcon className="h-4.5 w-4.5" />}
            </button> : null}
          </div>
        </div>
      </section>

      <section className="space-y-4 pt-1">
        {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}

        {canWrite && isEditing ? (
          <FormDialog title="Modifier la setlist" placement="bottom" onClose={handleCloseEdit}>
            <form className="space-y-4" onSubmit={handleSaveSetlist}>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Nom</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isSaving}
                  className="fz-input text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Date</span>
                <input
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  type="date"
                  disabled={isSaving}
                  className="fz-input text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  disabled={isSaving}
                  className="fz-input min-h-24 resize-y text-sm"
                />
              </label>

              <div className="space-y-3 border-t border-white/8 pt-4">
                <div>
                  <p className="text-sm font-black text-white">Informations des morceaux</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--fz-text-muted)]">Choisissez ce qui apparaît dans les notes de la setlist.</p>
                </div>
                <DisplayModeSelector label="Ton" value={keyDisplayMode} onChange={setKeyDisplayMode} />
                <DisplayModeSelector label="Tempo" value={bpmDisplayMode} onChange={setBpmDisplayMode} />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="fz-button-primary w-full px-4 py-3 text-sm font-black uppercase tracking-[0.16em] disabled:opacity-60"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          </FormDialog>
        ) : null}

        <section className="space-y-3">
          {canWrite ? <button
            type="button"
            onClick={() => {
              setError(null);
              setIsAddSongDialogOpen(true);
            }}
            className="fz-button-primary flex w-full items-center justify-center gap-2 px-4 py-4 text-[0.98rem] font-black tracking-[0.01em]"
          >
            <PlusIcon className="h-5 w-5" />
            Ajouter des chansons
          </button> : null}

          {entries.length === 0 ? (
            <FeatureCard
              eyebrow="Vide"
              title="La scene attend ses morceaux"
              description="Ajoutez des chansons, puis fixez leur ordre avec les fleches."
            />
          ) : (
            entries.map((entry, index) => {
              const durationSeconds = songDurationsById.get(entry.songId) ?? 0;
              const songMeta = [
                entry.songBpm ? `${entry.songBpm} BPM` : '— BPM',
                entry.songKey || '— Ton',
                formatSongDuration(durationSeconds),
              ].join(' · ');
              const transitionParts = buildTransitionLine(entry);

              return (
                <div
                  key={entry.id}
                  ref={(element) => {
                    if (element) {
                      entryElementsRef.current.set(entry.id, element);
                    } else {
                      entryElementsRef.current.delete(entry.id);
                    }
                  }}
                  className="relative space-y-2"
                >
                  <div className="flex items-start gap-3 pl-7 pr-1">
                    {index === 0 ? (
                      <div className="mt-0.5 flex w-6 shrink-0 justify-center text-white/28">
                        <div className="h-7 w-[2px] rounded bg-current" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleToggleDirectSegue(entry)}
                        disabled={!canWrite}
                        aria-label={entry.isDirectSegue ? `Retirer l'enchainement avant ${entry.songTitle}` : `Activer l'enchainement avant ${entry.songTitle}`}
                        className={[
                          'mt-0.5 flex w-6 shrink-0 justify-center transition',
                          entry.isDirectSegue ? 'text-indigo-300' : 'text-white/28 hover:text-white/52',
                        ].join(' ')}
                      >
                        {entry.isDirectSegue ? (
                          <DirectSegueIcon className="h-7 w-7" />
                        ) : (
                          <div className="h-7 w-[2px] rounded bg-current" />
                        )}
                      </button>
                    )}
                    <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <div className="flex-1 pt-0.5">
                      {transitionParts.length > 0 ? (
                        <p className="truncate text-[0.8rem] font-semibold italic text-[var(--fz-text-muted)]">
                          {transitionParts.join(' · ')}
                        </p>
                      ) : (
                        <p className="text-[0.74rem] font-black uppercase tracking-[0.14em] text-white/20">Ajouter une transition...</p>
                      )}
                    </div>
                      <button
                        type="button"
                        onClick={() => handleOpenTransitionEditor(entry)}
                        disabled={!canWrite}
                        aria-label={`Modifier la note avant ${entry.songTitle}`}
                        className="flex h-8 w-8 items-center justify-center text-white/28 transition hover:text-white/60"
                      >
                        <EditLineIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="fz-card-soft flex items-center rounded-[1.45rem] border border-white/10 px-4 py-3.5">
                    <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-400/12 text-[0.95rem] font-black text-indigo-300">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1 pr-3">
                      <h3 className="truncate text-[1.02rem] font-black text-white">{entry.songTitle}</h3>
                      <p className="mt-1 truncate text-[0.76rem] text-[var(--fz-text-muted)]">{songMeta}</p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleMoveEntry(entry.id, -1)}
                        disabled={!canWrite || index === 0}
                        aria-label={`Monter ${entry.songTitle}`}
                        className="flex h-10 w-10 items-center justify-center text-white/85 transition hover:text-white disabled:opacity-25"
                      >
                        <ArrowUpIcon className="h-4.5 w-4.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveEntry(entry.id, 1)}
                        disabled={!canWrite || index === entries.length - 1}
                        aria-label={`Descendre ${entry.songTitle}`}
                        className="flex h-10 w-10 items-center justify-center text-white/85 transition hover:text-white disabled:opacity-25"
                      >
                        <ArrowDownIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {entries.length > 0 ? (
            <div className="flex items-start gap-3 pl-7 pr-1">
              <div className="mt-0.5 flex w-6 shrink-0 justify-center text-white/28">
                <div className="h-7 w-[2px] rounded bg-current" />
              </div>
              <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <div className="flex-1 pt-0.5">
                  {currentSetlist.closingAnnotation?.trim() ? (
                    <p className="truncate text-[0.8rem] font-semibold italic text-[var(--fz-text-muted)]">
                      [{currentSetlist.closingAnnotation.trim()}]
                    </p>
                  ) : (
                    <p className="text-[0.74rem] font-black uppercase tracking-[0.14em] text-white/20">Ajouter une note de fin...</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleOpenEndingNotesEditor}
                  disabled={!canWrite}
                  aria-label="Modifier la note de fin"
                  className="flex h-8 w-8 items-center justify-center text-white/28 transition hover:text-white/60"
                >
                  <EditLineIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </section>

      {canWrite && isAddSongDialogOpen ? (
        <FormDialog title="Ajouter des chansons" onClose={() => setIsAddSongDialogOpen(false)}>
          <div className="space-y-3">
            {availableSongs.length === 0 ? (
              <p className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-4 text-sm text-[var(--fz-text-muted)]">
                Toutes les chansons actives sont deja presentes dans cette setlist.
              </p>
            ) : (
              availableSongs.map((song) => (
                <div key={song.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-white/8 bg-white/4 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.76rem] text-[var(--fz-text-muted)]">
                      {song.bpm ? `${song.bpm} BPM` : '— BPM'}
                      {' · '}
                      {song.key || '— Ton'}
                      {' · '}
                      {formatSongDuration(song.durationSeconds)}
                    </p>
                    <h3 className="mt-1 truncate text-[1rem] font-black text-white">{song.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddSong(song.id)}
                    disabled={isAddingSongId !== null}
                    className="fz-button-primary w-full px-4 py-3 text-xs font-black uppercase tracking-[0.16em] disabled:opacity-60 sm:w-auto"
                  >
                    {isAddingSongId === song.id ? 'Ajout...' : 'Ajouter'}
                  </button>
                </div>
              ))
            )}
          </div>
        </FormDialog>
      ) : null}

      {canWrite && editingTransitionEntry ? (
        <FormDialog title="Note au-dessus du morceau" onClose={() => setEditingTransitionEntryId(null)}>
          <form className="space-y-4" onSubmit={handleSaveTransition}>
            <div>
              <p className="text-sm font-bold text-white">{editingTransitionEntry.songTitle}</p>
              <p className="mt-1 text-xs text-[var(--fz-text-muted)]">
                {editingTransitionEntry.songBpm ? `${editingTransitionEntry.songBpm} BPM` : '— BPM'}
                {' · '}
                {editingTransitionEntry.songKey || '— Ton'}
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Note</span>
              <input
                value={transitionAnnotation}
                onChange={(event) => setTransitionAnnotation(event.target.value)}
                placeholder="Ex. Intro guitare, changement d'instrument..."
                disabled={isSavingTransition}
                className="fz-input text-sm"
              />
            </label>

            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Ajouter rapidement</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTransitionShowBpm((current) => !current)}
                  disabled={bpmDisplayMode !== 'per-song'}
                  className={[
                    'rounded-[1rem] border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45',
                    isTempoDisplayed
                      ? 'border-indigo-400/50 bg-indigo-500/12 text-indigo-200'
                      : 'border-white/10 bg-white/5 text-white/72',
                  ].join(' ')}
                >
                  <span>Tempo</span>
                  {bpmDisplayMode !== 'per-song' ? (
                    <span className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] opacity-70">
                      {isTempoDisplayed ? '(affiché)' : '(masqué)'}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setTransitionShowKey((current) => !current)}
                  disabled={keyDisplayMode !== 'per-song'}
                  className={[
                    'rounded-[1rem] border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45',
                    isToneDisplayed
                      ? 'border-indigo-400/50 bg-indigo-500/12 text-indigo-200'
                      : 'border-white/10 bg-white/5 text-white/72',
                  ].join(' ')}
                >
                  <span>Tone</span>
                  {keyDisplayMode !== 'per-song' ? (
                    <span className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] opacity-70">
                      {isToneDisplayed ? '(affiché)' : '(masqué)'}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Apercu</p>
              <p className="mt-2 text-sm italic text-white/78">
                {(function () {
                  const previewParts: string[] = [];
                  const trimmedAnnotation = transitionAnnotation.trim();
                  const showPreviewKey = keyDisplayMode === 'all' || (keyDisplayMode === 'per-song' && transitionShowKey);
                  const showPreviewBpm = bpmDisplayMode === 'all' || (bpmDisplayMode === 'per-song' && transitionShowBpm);

                  if (showPreviewKey) {
                    previewParts.push(editingTransitionEntry.songKey || '— Ton');
                  }
                  if (showPreviewBpm) {
                    previewParts.push(
                      editingTransitionEntry.songBpm !== undefined ? `${editingTransitionEntry.songBpm} BPM` : '— BPM',
                    );
                  }
                  if (trimmedAnnotation) {
                    previewParts.push(`[${trimmedAnnotation}]`);
                  }

                  return previewParts.length > 0 ? previewParts.join(' · ') : 'Aucune note pour le moment.';
                })()}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSavingTransition}
              className="fz-button-primary w-full px-4 py-3 text-sm font-black uppercase tracking-[0.16em] disabled:opacity-60"
            >
              {isSavingTransition ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </FormDialog>
      ) : null}

      {canWrite && isEndingNotesOpen ? (
        <FormDialog title="Note apres la setlist" onClose={() => setIsEndingNotesOpen(false)}>
          <form className="space-y-4" onSubmit={handleSaveEndingNotes}>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Note</span>
              <input
                value={endingAnnotation}
                onChange={(event) => setEndingAnnotation(event.target.value)}
                placeholder="Ex. Merci, rappel, sortie de scene..."
                disabled={isSavingTransition}
                className="fz-input text-sm"
              />
            </label>

            <div className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Apercu</p>
              <p className="mt-2 text-sm italic text-white/78">
                {endingAnnotation.trim() ? `[${endingAnnotation.trim()}]` : 'Aucune note pour le moment.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSavingTransition}
              className="fz-button-primary w-full px-4 py-3 text-sm font-black uppercase tracking-[0.16em] disabled:opacity-60"
            >
              {isSavingTransition ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </FormDialog>
      ) : null}

      <ConfirmDialog
        isOpen={canWrite && isDeleteDialogOpen}
        title="Voulez-vous supprimer cette setlist ?"
        description="La setlist sera retiree de la base locale active sur cet appareil apres confirmation."
        confirmLabel="Supprimer"
        isBusy={isDeleting}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSetlist}
      />
    </div>
  );
}
