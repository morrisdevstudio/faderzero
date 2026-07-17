import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ChangeEvent, type SVGProps } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import { songsRepository } from '@/db/repositories/songsRepository';
import type { AudioTrack } from '@/features/audio/audioPlayerStore';
import { useAudioPlayerStore } from '@/features/audio/audioPlayerStore';
import { SongFormFields, type SongFormValues } from '@/features/songs/SongFormFields';
import { formatSongDuration } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { buildCompressedFileName } from '@/features/songs/audioCompression';
import { uploadSongAsset } from '@/services/supabase/storage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAudioCacheStore } from '@/features/audio/audioCacheStore';

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

const initialFormValues: SongFormValues = {
  title: '',
  lyrics: '',
  key: '',
  bpm: '',
  status: 'Idee',
  durationMinutes: '00',
  durationSeconds: '00',
  notes: '',
};

type DuplicateDecision =
  | { action: 'replace' }
  | { action: 'rename'; filename: string }
  | { action: 'cancel' };

interface DuplicatePromptState {
  fileName: string;
  existingFilename: string;
  renameValue: string;
  reservedFilenames: string[];
  error: string | null;
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

function buildRenamedFileName(fileName: string, reservedFilenames: Set<string>) {
  const compressedName = buildCompressedFileName(fileName);
  const baseName = compressedName.replace(/\.[^/.]+$/, '');
  let index = 2;
  let candidate = `${baseName} ${index}.mp3`;

  while (reservedFilenames.has(candidate)) {
    index += 1;
    candidate = `${baseName} ${index}.mp3`;
  }

  return candidate;
}

function toDurationFields(durationSeconds: number) {
  const boundedDuration = Math.max(0, durationSeconds);

  return {
    durationMinutes: String(Math.floor(boundedDuration / 60)).padStart(2, '0'),
    durationSeconds: String(boundedDuration % 60).padStart(2, '0'),
  };
}

function toSongFormValues(song: NonNullable<Awaited<ReturnType<typeof songsRepository.getById>>>) {
  return {
    title: song.title,
    lyrics: song.lyrics,
    key: song.key ?? '',
    bpm: song.bpm !== undefined ? String(song.bpm) : '',
    status: song.status,
    ...toDurationFields(song.durationSeconds),
    notes: song.notes ?? '',
  } satisfies SongFormValues;
}

function areFormValuesEqual(left: SongFormValues, right: SongFormValues) {
  return (
    left.title === right.title &&
    left.lyrics === right.lyrics &&
    left.key === right.key &&
    left.bpm === right.bpm &&
    left.status === right.status &&
    left.durationMinutes === right.durationMinutes &&
    left.durationSeconds === right.durationSeconds &&
    left.notes === right.notes
  );
}

export function SongDetailPage() {
  const { songId = '' } = useParams();
  const navigate = useNavigate();
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const song = useLiveQuery(() => songsRepository.getById(songId), [songId, activeWorkspaceId]);
  const [formValues, setFormValues] = useState<SongFormValues>(initialFormValues);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isAudioActionsOpen, setIsAudioActionsOpen] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePromptState | null>(null);
  const [selectedAssetToLinkId, setSelectedAssetToLinkId] = useState('');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const duplicateResolverRef = useRef<((decision: DuplicateDecision) => void) | null>(null);

  const isOnline = useOnlineStatus();
  const { cachedAssetIds, checkCacheStatus } = useAudioCacheStore();

  const assets = useLiveQuery(() => songAssetsRepository.listBySongId(songId), [songId, activeWorkspaceId]);
  const unlinkedAssets = useLiveQuery(() => songAssetsRepository.listUnlinkedTracks(), [activeWorkspaceId]);
  const playQueue = useAudioPlayerStore((state) => state.playQueue);
  const stop = useAudioPlayerStore((state) => state.stop);
  const currentIndex = useAudioPlayerStore((state) => state.currentIndex);
  const queue = useAudioPlayerStore((state) => state.queue);
  const status = useAudioPlayerStore((state) => state.status);
  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : undefined;

  function askDuplicateDecision(file: File, reservedFilenames: Set<string>) {
    const existingFilename = buildCompressedFileName(file.name);

    return new Promise<DuplicateDecision>((resolve) => {
      duplicateResolverRef.current = resolve;
      setDuplicatePrompt({
        fileName: file.name,
        existingFilename,
        renameValue: buildRenamedFileName(file.name, reservedFilenames),
        reservedFilenames: Array.from(reservedFilenames),
        error: null,
      });
    });
  }

  function resolveDuplicatePrompt(decision: DuplicateDecision) {
    duplicateResolverRef.current?.(decision);
    duplicateResolverRef.current = null;
    setDuplicatePrompt(null);
  }

  function handleRenameDecision() {
    if (!duplicatePrompt) {
      return;
    }

    const renamedFilename = buildCompressedFileName(duplicatePrompt.renameValue);
    if (new Set(duplicatePrompt.reservedFilenames).has(renamedFilename)) {
      setDuplicatePrompt({ ...duplicatePrompt, error: 'Ce nom est deja utilise par une piste importee.' });
      return;
    }

    resolveDuplicatePrompt({ action: 'rename', filename: renamedFilename });
  }

  async function handleDirectAudioImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingAudio(true);
    setError(null);

    try {
      const workspaceId = useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
      const importedTracks = await songAssetsRepository.listImportedTracks();
      const importedTracksByFilename = new Map(importedTracks.map((track) => [track.filename, track] as const));
      const reservedFilenames = new Set(importedTracksByFilename.keys());
      let finalFilename = buildCompressedFileName(file.name);
      const duplicate = importedTracksByFilename.get(finalFilename);

      if (duplicate) {
        const decision = await askDuplicateDecision(file, reservedFilenames);
        if (decision.action === 'cancel') {
          return;
        }
        if (decision.action === 'replace') {
          await songAssetsRepository.softDelete(duplicate.id);
        }
        if (decision.action === 'rename') {
          finalFilename = decision.filename;
        }
      }

      await uploadSongAsset(workspaceId, songId, file, { filename: finalFilename });
    } catch (err: any) {
      setError(err.message || "Impossible d'importer ce fichier audio.");
    } finally {
      duplicateResolverRef.current?.({ action: 'cancel' });
      duplicateResolverRef.current = null;
      setDuplicatePrompt(null);
      event.target.value = '';
      setIsUploadingAudio(false);
    }
  }

  async function handleLinkExistingAsset() {
    if (!selectedAssetToLinkId) {
      setError('Choisis un fichier audio a lier.');
      return;
    }

    try {
      await songAssetsRepository.linkToSong(selectedAssetToLinkId, songId);
      setSelectedAssetToLinkId('');
      setIsLinkDialogOpen(false);
      setError(null);
    } catch {
      setError("Impossible de lier ce fichier audio.");
    }
  }

  useEffect(() => {
    if (!song || isEditMode) {
      return;
    }

    setFormValues(toSongFormValues(song));
  }, [isEditMode, song]);

  useEffect(() => {
    void checkCacheStatus();
  }, [checkCacheStatus]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isEditMode || isSaving) {
      return;
    }

    const trimmedTitle = formValues.title.trim();
    if (!trimmedTitle) {
      setError('Le titre est obligatoire.');
      return;
    }

    const parsedBpm = formValues.bpm.trim() ? Number(formValues.bpm) : undefined;
    if (parsedBpm !== undefined && Number.isNaN(parsedBpm)) {
      setError('Le BPM doit etre un nombre.');
      return;
    }

    const parsedMinutes = formValues.durationMinutes.trim() ? Number(formValues.durationMinutes) : 0;
    const parsedSeconds = formValues.durationSeconds.trim() ? Number(formValues.durationSeconds) : 0;
    if ([parsedMinutes, parsedSeconds].some((value) => Number.isNaN(value) || value < 0)) {
      setError('La duree doit contenir des valeurs positives.');
      return;
    }
    if (parsedSeconds > 59) {
      setError('Les secondes doivent etre comprises entre 0 et 59.');
      return;
    }

    if (!song || song.deletedAt !== undefined) {
      return;
    }

    const persistedValues = toSongFormValues(song);
    if (areFormValuesEqual(formValues, persistedValues)) {
      setError(null);
      return;
    }

    setError(null);

    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        setIsSaving(true);

        try {
          const payload = {
            title: trimmedTitle,
            lyrics: formValues.lyrics,
            key: formValues.key,
            status: formValues.status,
            durationSeconds: parsedMinutes * 60 + parsedSeconds,
            notes: formValues.notes,
          };

          await songsRepository.update(
            song.id,
            parsedBpm === undefined
              ? payload
              : {
                  ...payload,
                  bpm: parsedBpm,
                },
          );
        } catch {
          setError("Impossible d'enregistrer la chanson.");
        } finally {
          setIsSaving(false);
        }
      })();
    }, 280);

    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [formValues, isEditMode, isSaving, song]);

  if (song === undefined) {
    return <FeatureCard eyebrow="Chargement" title="Lecture de la chanson" description="Recuperation des donnees locales..." />;
  }

  if (!song || song.deletedAt !== undefined) {
    return (
      <FeatureCard
        eyebrow="Introuvable"
        title="Cette chanson n'est plus disponible"
        description="Elle a peut-etre deja ete supprimee ou n'existe pas dans la base locale."
      >
        <Link
          to="/songs"
          className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white"
        >
          Retour au repertoire
        </Link>
      </FeatureCard>
    );
  }

  const currentSong = song;

  async function handleDeleteSong() {
    setIsSaving(true);
    setError(null);

    try {
      await songsRepository.softDelete(currentSong.id);
      setIsDeleteDialogOpen(false);
      navigate('/songs');
    } catch {
      setError('Impossible de supprimer cette chanson.');
      setIsSaving(false);
    }
  }

  function handleCloseEdit() {
    setError(null);
    setIsDeleteDialogOpen(false);
    setIsEditMode(false);
  }

  const audioTracks: AudioTrack[] =
    assets?.map((asset) => {
      const track: AudioTrack = {
        assetId: asset.id,
        songId: currentSong.id,
        title: currentSong.title || asset.filename,
        filename: asset.filename,
        sizeBytes: asset.sizeBytes,
      };

      if (asset.syncStatus !== undefined) {
        track.syncStatus = asset.syncStatus;
      }

      return track;
    }) ?? [];

  const primaryAudioAsset = assets?.[0];
  const isPrimaryAudioPlaying = primaryAudioAsset?.id === currentTrack?.assetId && status === 'playing';

  function handlePlayAsset(assetId: string, isCached: boolean) {
    if (!isOnline && !isCached) {
      setError("Ce fichier n'est pas disponible hors ligne.");
      return;
    }

    if (currentTrack?.assetId === assetId && status === 'playing') {
      stop();
      return;
    }

    void playQueue(audioTracks, assetId);
  }

  return (
    <div className="space-y-4">
      <section
        className="sticky z-30 -mx-1 -mt-5 border-b border-white/8 bg-[var(--fz-bg)] px-1 pb-3 pt-2"
        style={{ top: 'calc(var(--fz-header-height, 64px) + var(--fz-viewport-offset-top, 0px))' }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <Link
            to="/songs"
            aria-label="Retour"
            className="flex h-11 w-11 items-center justify-center justify-self-start text-white transition-colors hover:text-white/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            <BackIcon className="h-5 w-5" />
          </Link>

          <h1 className="truncate text-center text-[1rem] font-black text-white">{currentSong.title || 'Sans titre'}</h1>

          <div className="flex items-center justify-end gap-2 justify-self-end">
            <Link
              to={`/prompter?songId=${encodeURIComponent(currentSong.id)}`}
              aria-label="Ouvrir cette chanson dans le prompteur"
              className="flex h-11 w-11 items-center justify-center text-emerald-300 transition-colors hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300/70"
            >
              <PrompterIcon className="h-5 w-5" />
            </Link>
            {isEditMode ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isSaving}
                aria-label="Supprimer"
                className="flex h-11 w-11 items-center justify-center text-rose-300 transition-colors hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300/70 disabled:opacity-60"
              >
                <TrashIcon className="h-4.5 w-4.5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (isEditMode) {
                  handleCloseEdit();
                  return;
                }

                setError(null);
                setIsEditMode(true);
              }}
              aria-label={isEditMode ? 'Annuler la modification' : 'Modifier'}
              className={[
                'flex h-11 w-11 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                isEditMode
                  ? 'text-white hover:text-white/75 focus-visible:outline-white/60'
                  : 'text-indigo-300 hover:text-indigo-200 focus-visible:outline-indigo-300/70',
              ].join(' ')}
            >
              {isEditMode ? <CheckIcon className="h-4.5 w-4.5" /> : <PencilIcon className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4 pt-1">
        {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}

        <section className="fz-card rounded-[1.45rem] p-4">
          {isEditMode ? (
            <div className="space-y-3">
              <SongFormFields values={formValues} onChange={setFormValues} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/20 p-3">
                <button
                  type="button"
                  onClick={() => primaryAudioAsset && handlePlayAsset(primaryAudioAsset.id, cachedAssetIds.has(primaryAudioAsset.id))}
                  disabled={!primaryAudioAsset}
                  className={[
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40',
                    isPrimaryAudioPlaying ? 'bg-orange-500 text-white' : 'bg-white/8 text-white hover:bg-white/14',
                  ].join(' ')}
                  aria-label={isPrimaryAudioPlaying ? 'Arreter la chanson' : 'Lire la chanson'}
                >
                  {isPrimaryAudioPlaying ? <StopIcon /> : <PlayIcon />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black leading-tight text-white">{primaryAudioAsset?.filename || 'Aucun fichier audio'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAudioActionsOpen(true)}
                  aria-label="Actions du fichier audio"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/6 text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  <DotsIcon />
                </button>
              </div>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleDirectAudioImport}
                className="hidden"
              />
              <div className="grid grid-cols-4 rounded-[1rem] bg-black/35 px-1 py-3">
                <div className="flex min-w-0 flex-col items-center gap-1.5 px-1 text-center">
                  <p className="text-[0.58rem] font-medium uppercase leading-tight text-[var(--fz-text-muted)]">État</p>
                  <p
                    className={[
                      'truncate text-[0.72rem] font-black uppercase leading-tight',
                      currentSong.status === 'Pret'
                        ? 'text-[var(--fz-success)]'
                        : currentSong.status === 'En cours'
                          ? 'text-[var(--fz-accent-strong)]'
                          : 'text-white/70',
                    ].join(' ')}
                  >
                    {currentSong.status}
                  </p>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-1.5 border-l border-white/10 px-1 text-center">
                  <p className="text-[0.58rem] font-medium uppercase leading-tight text-[var(--fz-text-muted)]">Tone</p>
                  <p className="whitespace-nowrap text-[0.9rem] font-black leading-tight text-white">{currentSong.key || '--'}</p>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-1.5 border-l border-white/10 px-1 text-center">
                  <p className="text-[0.58rem] font-medium uppercase leading-tight text-[var(--fz-text-muted)]">Tempo</p>
                  <p className="whitespace-nowrap text-[0.9rem] font-black leading-tight text-white">{currentSong.bpm || '--'}</p>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-1.5 border-l border-white/10 px-1 text-center">
                  <p className="text-[0.58rem] font-medium uppercase leading-tight text-[var(--fz-text-muted)]">Durée</p>
                  <p className="whitespace-nowrap text-[0.9rem] font-black leading-tight text-white">{formatSongDuration(currentSong.durationSeconds)}</p>
                </div>
              </div>

              {currentSong.notes ? (
                <section className="space-y-2">
                  <p className="px-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Notes</p>
                  <div className="rounded-[1rem] border border-white/8 bg-black/20 p-3.5">
                    <p className="whitespace-pre-line text-[0.9rem] leading-7 text-white/78">{currentSong.notes}</p>
                  </div>
                </section>
              ) : null}

              <section className="space-y-2">
                <p className="px-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Paroles</p>
                <div className="rounded-[1rem] border border-white/8 bg-black/20 p-3.5">
                  <p className="whitespace-pre-line text-[0.95rem] leading-7 text-white/88">
                    {currentSong.lyrics || 'Aucune parole pour le moment.'}
                  </p>
                </div>
              </section>

            </div>
          )}
        </section>
      </section>

      {isAudioActionsOpen ? (
        <FormDialog
          eyebrow="Audio"
          title="Actions audio"
          closeLabel="Fermer les actions audio"
          placement="bottom"
          onClose={() => setIsAudioActionsOpen(false)}
        >
          <div className="space-y-4">
            <div>
              <p className="truncate text-sm font-black text-white">{primaryAudioAsset?.filename || 'Aucun fichier audio associé'}</p>
              <p className="mt-1 text-xs text-white/45">Sélectionner la piste à lire</p>
            </div>

            {assets === undefined ? (
              <p className="rounded-xl border border-white/8 bg-white/5 p-3 text-sm text-white/50">Chargement des pistes...</p>
            ) : assets.length > 0 ? (
              <div className="space-y-2">
                {assets.map((asset) => {
                  const isThisPlaying = currentTrack?.assetId === asset.id && status === 'playing';
                  const isCached = cachedAssetIds.has(asset.id);

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        setIsAudioActionsOpen(false);
                        handlePlayAsset(asset.id, isCached);
                      }}
                      className={["flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition", isThisPlaying ? 'border-orange-400/35 bg-orange-500/10' : 'border-white/8 bg-white/5 hover:bg-white/10'].join(' ')}
                    >
                      <span className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-full", isThisPlaying ? 'bg-orange-500 text-white' : 'bg-white text-[#111316]'].join(' ')}>
                        {isThisPlaying ? <StopIcon /> : <PlayIcon />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{asset.filename}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-white/8 bg-white/5 p-3 text-sm text-white/50">Aucune piste associée.</p>
            )}

            <div className="grid gap-2 border-t border-white/8 pt-4">
              <button
                type="button"
                disabled={isUploadingAudio}
                onClick={() => {
                  setIsAudioActionsOpen(false);
                  audioInputRef.current?.click();
                }}
                className="fz-button-primary px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] disabled:opacity-60"
              >
                {isUploadingAudio ? 'Import en cours...' : 'Importer un audio'}
              </button>
            <button
              type="button"
              onClick={() => {
                setIsAudioActionsOpen(false);
                setSelectedAssetToLinkId(unlinkedAssets?.[0]?.id ?? '');
                setIsLinkDialogOpen(true);
              }}
              className="fz-button-secondary px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-white"
            >
              Associer un audio
            </button>
            </div>
          </div>
        </FormDialog>
      ) : null}

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Voulez-vous supprimer cette chanson ?"
        description="La chanson sera retiree de la liste active sur cet appareil. Cette action demande une confirmation explicite."
        confirmLabel="Supprimer"
        isBusy={isSaving}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSong}
      />

      {isLinkDialogOpen ? (
        <FormDialog
          eyebrow="Audio"
          title="Lier une musique"
          onClose={() => setIsLinkDialogOpen(false)}
        >
          <div className="space-y-4">
            {unlinkedAssets && unlinkedAssets.length > 0 ? (
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">
                  Fichier importe
                </span>
                <select
                  value={selectedAssetToLinkId}
                  onChange={(event) => setSelectedAssetToLinkId(event.target.value)}
                  className="fz-input text-sm"
                >
                  {unlinkedAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.filename}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="rounded-[1rem] border border-white/8 bg-white/5 p-3 text-sm text-white/60">
                Aucun fichier audio non lie disponible dans Musiques.
              </p>
            )}

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => void handleLinkExistingAsset()}
                disabled={!unlinkedAssets || unlinkedAssets.length === 0}
                className="fz-button-primary px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em] disabled:opacity-50"
              >
                Lier a cette chanson
              </button>
              <Link
                to="/musiques"
                onClick={() => setIsLinkDialogOpen(false)}
                className="fz-button-secondary flex items-center justify-center px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em] text-white"
              >
                Ouvrir Musiques
              </Link>
            </div>
          </div>
        </FormDialog>
      ) : null}

      {duplicatePrompt ? (
        <FormDialog
          eyebrow="Doublon"
          title="Piste deja importee"
          closeLabel="Annuler l'import de cette piste"
          onClose={() => resolveDuplicatePrompt({ action: 'cancel' })}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--fz-text-muted)]">
              Le fichier <span className="font-black text-white">{duplicatePrompt.existingFilename}</span> existe deja dans les musiques.
            </p>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">
                Nouveau nom
              </span>
              <input
                value={duplicatePrompt.renameValue}
                onChange={(event) =>
                  setDuplicatePrompt({
                    ...duplicatePrompt,
                    renameValue: event.target.value,
                    error: null,
                  })
                }
                className="fz-input text-sm"
              />
            </label>

            {duplicatePrompt.error ? <p className="text-sm font-semibold text-rose-400">{duplicatePrompt.error}</p> : null}

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => resolveDuplicatePrompt({ action: 'replace' })}
                className="rounded-[1rem] border border-orange-500/30 bg-orange-500/12 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em] text-orange-200 transition hover:bg-orange-500/18"
              >
                Remplacer
              </button>
              <button
                type="button"
                onClick={handleRenameDecision}
                className="fz-button-primary px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em]"
              >
                Renommer et importer
              </button>
              <button
                type="button"
                onClick={() => resolveDuplicatePrompt({ action: 'cancel' })}
                className="fz-button-secondary px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em] text-white"
              >
                Annuler
              </button>
            </div>
          </div>
        </FormDialog>
      ) : null}
    </div>
  );
}
