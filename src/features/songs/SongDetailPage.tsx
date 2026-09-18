import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import { useGoBack, useLeaveScreen } from '@/hooks/useGoBack';
import { HOME_FALLBACK } from '@/navigation/inAppBack';
import { songsRepository } from '@/db/repositories/songsRepository';
import { songTimelinesRepository } from '@/db/repositories/songTimelinesRepository';
import type { AudioTrack } from '@/features/audio/audioPlayerStore';
import { useAudioPlayerStore } from '@/features/audio/audioPlayerStore';
import { SongFormFields, type SongFormValues } from '@/features/songs/SongFormFields';
import { bpmOptions, formatSongDuration, getSongStatusLabel, getSongStatusTone, songStatusOptions } from '@/features/songs/songPresentation';
import { PickerDialog, WheelColumn } from '@/components/PickerDialog';
import { useAuthStore } from '@/stores/authStore';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { db } from '@/db/db';
import { buildCompressedFileName } from '@/features/songs/audioCompression';
import {
  removePendingAudioUpload,
  retryPendingAudioUpload,
  uploadOrQueueSongAsset,
} from '@/services/audio/pendingUploads';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useLongPress } from '@/hooks/useLongPress';
import { useAudioCacheStore } from '@/features/audio/audioCacheStore';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { CopySongModal } from '@/features/songs/CopySongModal';
import type { SongStatus } from '@/db/schema';
import { QuickVoiceRecorder } from '@/features/recorder/QuickVoiceRecorder';
import { ContentRow } from '@/ui/components/ContentRow';
import { ContextMenu } from '@/ui/components/ContextMenu';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { useUndoToastStore } from '@/stores/undoToastStore';
import { FzIcon } from '@/ui/icons';
import { StatusPill } from '@/ui/components/StatusPill';
import { SelectField } from '@/ui/components/SelectField';
import { TextArea } from '@/ui/components/TextArea';
import { TextField } from '@/ui/components/TextField';
import { Button } from '@/ui/components/Button';

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

const keyOptions = ['', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const durationMinuteOptions = Array.from({ length: 100 }, (_, index) => String(index).padStart(2, '0'));
const durationSecondOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

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

function getPrimaryTrackStorageKey(songId: string) {
  return `fz-primary-track:${songId}`;
}

function readStoredPrimaryTrackId(songId: string) {
  if (!songId) {
    return '';
  }

  try {
    return localStorage.getItem(getPrimaryTrackStorageKey(songId)) || '';
  } catch {
    return '';
  }
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
  const goBack = useGoBack(HOME_FALLBACK);
  const leave = useLeaveScreen(HOME_FALLBACK);
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const workspaces = useAuthStore((state) => state.workspaces);
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const activeWorkspaceId = activeWorkspace?.id;
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const song = useLiveQuery(() => songsRepository.getById(songId), [songId, activeWorkspaceId]);

  const isSwitchingWorkspace = useLiveQuery(async () => {
    if (!songId) return false;
    const storedSong = await db.songs.get(songId);
    if (!storedSong || storedSong.deletedAt !== undefined) return false;
    return (
      storedSong.workspaceId !== activeWorkspace?.id &&
      workspaces.some((w) => w.id === storedSong.workspaceId)
    );
  }, [songId, activeWorkspace?.id, workspaces]);

  useEffect(() => {
    if (!songId) return;

    let isMounted = true;
    void (async () => {
      const storedSong = await db.songs.get(songId);
      if (!isMounted || !storedSong || storedSong.deletedAt !== undefined) return;

      if (storedSong.workspaceId && storedSong.workspaceId !== activeWorkspace?.id) {
        const targetWorkspace = workspaces.find((w) => w.id === storedSong.workspaceId);
        if (targetWorkspace) {
          setActiveWorkspace(targetWorkspace);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [songId, activeWorkspace?.id, workspaces, setActiveWorkspace]);
  const [formValues, setFormValues] = useState<SongFormValues>(initialFormValues);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isAudioActionsOpen, setIsAudioActionsOpen] = useState(false);
  const [assetPendingDeletion, setAssetPendingDeletion] = useState<{ id: string; filename: string } | null>(null);
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePromptState | null>(null);
  const [selectedAssetToLinkId, setSelectedAssetToLinkId] = useState('');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [primaryTrackId, setPrimaryTrackId] = useState(() => readStoredPrimaryTrackId(songId));
  const [error, setError] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const duplicateResolverRef = useRef<((decision: DuplicateDecision) => void) | null>(null);

  const isOnline = useOnlineStatus();
  const {
    cachedAssetIds,
    downloadingAssetIds,
    checkCacheStatus,
    downloadAsset,
    removeAsset,
  } = useAudioCacheStore();

  type QuickEditField = 'title' | 'status' | 'key' | 'bpm' | 'duration' | 'notes' | null;
  const [quickEditField, setQuickEditField] = useState<QuickEditField>(null);
  const [quickValue, setQuickValue] = useState<string>('');
  const [quickDuration, setQuickDuration] = useState<{ minutes: string; seconds: string }>({ minutes: '00', seconds: '00' });

  const titleLongPress = useLongPress({
    onLongPress: () => {
      if (canWrite && song) {
        setQuickValue(song.title || '');
        setQuickEditField('title');
      }
    },
  });

  async function handleSaveQuickField() {
    if (!canWrite || !song) return;

    try {
      if (quickEditField === 'title') {
        const trimmed = quickValue.trim();
        if (!trimmed) return;
        await songsRepository.update(song.id, { title: trimmed });
      } else if (quickEditField === 'status') {
        await songsRepository.update(song.id, { status: quickValue as SongStatus });
      } else if (quickEditField === 'key') {
        await songsRepository.update(song.id, { key: quickValue.trim() });
      } else if (quickEditField === 'bpm') {
        const parsed = quickValue.trim() ? Number(quickValue) : undefined;
        if (parsed !== undefined && !Number.isNaN(parsed)) {
          await songsRepository.update(song.id, { bpm: parsed });
        }
      } else if (quickEditField === 'duration') {
        const mins = Math.max(0, Number(quickDuration.minutes) || 0);
        const secs = Math.min(59, Math.max(0, Number(quickDuration.seconds) || 0));
        await songsRepository.update(song.id, { durationSeconds: mins * 60 + secs });
      } else if (quickEditField === 'notes') {
        await songsRepository.update(song.id, { notes: quickValue });
      } else if (quickEditField === 'lyrics') {
        await songsRepository.update(song.id, { lyrics: quickValue });
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise a jour.');
    } finally {
      setQuickEditField(null);
    }
  }

  const assets = useLiveQuery(() => songAssetsRepository.listBySongId(songId), [songId, activeWorkspaceId]);
  const pendingAudioUploads = useLiveQuery(
    () =>
      db.pendingAudioUploads
        .where('songId')
        .equals(songId)
        .filter((item) => item.workspaceId === activeWorkspaceId)
        .sortBy('queuedAt'),
    [songId, activeWorkspaceId]
  );
  const unlinkedAssets = useLiveQuery(() => songAssetsRepository.listUnlinkedTracks(), [activeWorkspaceId]);
  const timelineBundle = useLiveQuery(() => songTimelinesRepository.getBySongId(songId), [songId, activeWorkspaceId]);
  const programmedAverageBpm =
    timelineBundle && timelineBundle.sections.length > 0
      ? Math.round(timelineBundle.sections.reduce((sum, section) => sum + section.tempo, 0) / timelineBundle.sections.length)
      : undefined;
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
    if (!canWrite) return;
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingAudio(true);
    setError(null);
    setAudioNotice(null);

    try {
      const workspaceId = useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
      const importedTracks = await songAssetsRepository.listImportedTracks();
      const importedTracksByFilename = new Map(importedTracks.map((track) => [track.filename, track] as const));
      const queuedFilenames = new Set(
        (pendingAudioUploads ?? []).map((pendingUpload) => pendingUpload.filename)
      );
      const reservedFilenames = new Set([...importedTracksByFilename.keys(), ...queuedFilenames]);
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
      } else if (queuedFilenames.has(finalFilename)) {
        const decision = await askDuplicateDecision(file, reservedFilenames);
        if (decision.action === 'cancel') {
          return;
        }
        if (decision.action === 'replace') {
          const queuedDuplicate = pendingAudioUploads?.find(
            (pendingUpload) => pendingUpload.filename === finalFilename
          );
          if (queuedDuplicate) {
            await removePendingAudioUpload(queuedDuplicate.id);
          }
        }
        if (decision.action === 'rename') {
          finalFilename = decision.filename;
        }
      }

      const result = await uploadOrQueueSongAsset(workspaceId, songId, file, {
        filename: finalFilename,
      });
      setAudioNotice(
        result.status === 'queued'
          ? 'Audio conserve sur cet appareil. Envoi automatique au retour de la connexion.'
          : 'Audio importe.'
      );
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
    if (!canWrite) return;
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
    setPrimaryTrackId(readStoredPrimaryTrackId(songId));
  }, [songId]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canWrite || !isEditMode || isSaving) {
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
  }, [canWrite, formValues, isEditMode, isSaving, song]);

  if (song === undefined || isSwitchingWorkspace) {
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
  const primaryAudioAsset = assets?.find((asset) => asset.id === primaryTrackId) ?? assets?.[0];
  const orderedAudioAssets = assets && primaryAudioAsset
    ? [primaryAudioAsset, ...assets.filter((asset) => asset.id !== primaryAudioAsset.id)]
    : assets;

  async function handleDeleteSong() {
    if (!canWrite) return;
    setIsSaving(true);
    setError(null);

    try {
      const songToDelete = currentSong;
      await songsRepository.softDelete(songToDelete.id);
      setIsDeleteDialogOpen(false);
      await leave();
      useUndoToastStore.getState().showUndoToast({
        message: `Morceau « ${songToDelete.title} » supprimé`,
        onUndo: async () => {
          await songsRepository.restore(songToDelete.id);
        },
      });
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
    orderedAudioAssets?.map((asset) => {
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

  const isPrimaryAudioPlaying = primaryAudioAsset?.id === currentTrack?.assetId && status === 'playing';

  function handleSetPrimaryAudio(assetId: string) {
    if (!canWrite) return;
    try {
      localStorage.setItem(getPrimaryTrackStorageKey(currentSong.id), assetId);
    } catch {
      // The visual state still updates if storage is unavailable.
    }

    setPrimaryTrackId(assetId);
  }

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

  async function handleToggleAudioCache(assetId: string, isCached: boolean) {
    setError(null);
    setAudioNotice(null);

    try {
      if (isCached) {
        await removeAsset(assetId);
        setAudioNotice('Fichier retiré du cache hors ligne.');
        return;
      }

      if (!activeWorkspaceId) {
        throw new Error('Aucun espace de travail actif.');
      }

      await downloadAsset(activeWorkspaceId, assetId);
      setAudioNotice('Fichier disponible hors ligne.');
    } catch (cacheError) {
      setError(cacheError instanceof Error ? cacheError.message : 'Impossible de mettre ce fichier en cache.');
    }
  }

  async function handleUnlinkAudio(assetId: string, filename: string) {
    if (!canWrite) return;
    try {
      await songAssetsRepository.unlinkFromSong(assetId);
      if (primaryTrackId === assetId) {
        try {
          localStorage.removeItem(getPrimaryTrackStorageKey(currentSong.id));
        } catch {
          // The next available track becomes the fallback primary track.
        }
        setPrimaryTrackId('');
      }
      setAudioNotice(`${filename} n'est plus associé à ce morceau.`);
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : "Impossible de dissocier ce fichier audio.");
    }
  }

  async function handleDeleteAudio() {
    if (!canWrite || !assetPendingDeletion) return;
    const { id, filename } = assetPendingDeletion;
    try {
      await songAssetsRepository.softDelete(id);
      if (primaryTrackId === id) {
        try {
          localStorage.removeItem(getPrimaryTrackStorageKey(currentSong.id));
        } catch {
          // The next available track becomes the fallback primary track.
        }
        setPrimaryTrackId('');
      }
      setAudioNotice(`${filename} a été supprimé.`);
      setAssetPendingDeletion(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Impossible de supprimer ce fichier audio.');
    }
  }

  return (
    <div className="space-y-4">
      <DetailHeader
        title={currentSong.title || 'Sans titre'}
        onBack={goBack}
        backLabel="Retour"
        titleInteraction={canWrite ? { title: 'Appui long pour modifier le titre', ...titleLongPress } : undefined}
        actions={
          <>
            {canWrite && !isEditMode ? (
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(true)}
                aria-label="Copier vers un autre espace"
                title="Copier vers un autre espace"
                className="text-amber-400 hover:text-amber-300 active:text-amber-500"
              >
                <FzIcon name="copy" usageId="song-detail.copy" size="md" />
              </button>
            ) : null}

            {canWrite ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isSaving}
                aria-label="Supprimer la chanson"
                title="Supprimer la chanson"
                className="text-rose-400 hover:text-rose-300 active:text-rose-500 disabled:opacity-60"
              >
                <FzIcon name="delete" usageId="song-detail.delete" size="md" />
              </button>
            ) : null}

            {canWrite && isEditMode ? (
              <button
                type="button"
                onClick={() => handleCloseEdit()}
                aria-label="Terminer la modification"
                title="Terminer"
                className="text-emerald-400 hover:text-emerald-300 active:text-emerald-500"
              >
                <FzIcon name="check" usageId="song-detail.finish-edit" size="md" />
              </button>
            ) : null}
          </>
        }
      />

      <section className="space-y-4 pt-1">
        {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}
        {audioNotice ? <p className="text-sm font-semibold text-amber-300">{audioNotice}</p> : null}

        <section>
          {canWrite && isEditMode ? (
            <div className="space-y-3">
              <SongFormFields values={formValues} onChange={setFormValues} showLyrics={false} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-white/8 px-2 pb-4">
                <button
                  type="button"
                  onClick={() => primaryAudioAsset && handlePlayAsset(primaryAudioAsset.id, cachedAssetIds.has(primaryAudioAsset.id))}
                  disabled={!primaryAudioAsset}
                  className={[
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
                    isPrimaryAudioPlaying ? 'bg-[var(--fz-accent)] text-white shadow-md' : 'bg-white/10 text-white hover:bg-white/15 active:scale-95',
                  ].join(' ')}
                  aria-label={isPrimaryAudioPlaying ? 'Arreter la chanson' : 'Lire la chanson'}
                >
                  {isPrimaryAudioPlaying ? <FzIcon name="stop" usageId="song-detail.primary-audio.stop" size="sm" /> : <FzIcon name="play" usageId="song-detail.primary-audio.play" size="sm" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black leading-tight text-white">{primaryAudioAsset?.filename || 'Aucun fichier audio'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAudioActionsOpen(true)}
                  aria-label="Gérer les pistes audio"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-accent)]"
                >
                  <FzIcon name="menu" usageId="song-detail.primary-audio.menu" size="sm" />
                </button>
              </div>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleDirectAudioImport}
                className="hidden"
              />
              <div className="grid grid-cols-4 border-b border-white/8 px-1 pb-4">
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => {
                    setQuickValue(currentSong.status);
                    setQuickEditField('status');
                  }}
                  aria-label="Modifier l'état"
                  className={[
                    'flex min-h-11 min-w-0 flex-col items-center justify-center gap-1.5 px-1 text-center',
                    canWrite ? 'cursor-pointer transition hover:bg-white/5 active:opacity-75' : 'cursor-default',
                  ].join(' ')}
                  title={canWrite ? "Modifier l'état" : undefined}
                >
                  <p className="text-[0.58rem] font-medium uppercase leading-tight text-[var(--fz-text-muted)]">État</p>
                  <StatusPill
                    label={getSongStatusLabel(currentSong.status)}
                    tone={getSongStatusTone(currentSong.status)}
                  />
                </button>
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => {
                    setQuickValue(currentSong.key || '');
                    setQuickEditField('key');
                  }}
                  aria-label="Modifier la tonalité"
                  className={[
                    'flex min-h-11 min-w-0 flex-col items-center justify-center gap-1.5 border-l border-white/10 px-1 text-center',
                    canWrite ? 'cursor-pointer transition hover:bg-white/5 active:opacity-75' : 'cursor-default',
                  ].join(' ')}
                  title={canWrite ? 'Modifier la tonalité' : undefined}
                >
                  <p className="text-[0.58rem] font-medium uppercase leading-tight text-[var(--fz-text-muted)]">Tone</p>
                  <p className="whitespace-nowrap text-[0.9rem] font-black leading-tight text-white">{currentSong.key || '--'}</p>
                </button>
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => {
                    setQuickValue(currentSong.bpm !== undefined ? String(currentSong.bpm) : '');
                    setQuickEditField('bpm');
                  }}
                  aria-label="Modifier le tempo"
                  className={[
                    'flex min-h-11 min-w-0 flex-col items-center justify-center gap-1.5 border-l border-white/10 px-1 text-center',
                    canWrite ? 'cursor-pointer transition hover:bg-white/5 active:opacity-75' : 'cursor-default',
                  ].join(' ')}
                  title={canWrite ? 'Modifier le tempo' : undefined}
                >
                  <p className="text-[0.58rem] font-medium uppercase leading-tight text-[var(--fz-text-muted)]">Tempo</p>
                  {programmedAverageBpm !== undefined ? (
                    <span
                      className="whitespace-nowrap rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[0.9rem] font-black tabular-nums leading-tight text-amber-300"
                      title="Métronome programmé"
                    >
                      {programmedAverageBpm} BPM
                    </span>
                  ) : (
                    <p className="whitespace-nowrap text-[0.9rem] font-black leading-tight text-white">{currentSong.bpm || '--'}</p>
                  )}
                </button>
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => {
                    const duration = toDurationFields(currentSong.durationSeconds);
                    setQuickDuration({ minutes: duration.durationMinutes, seconds: duration.durationSeconds });
                    setQuickEditField('duration');
                  }}
                  aria-label="Modifier la durée"
                  className={[
                    'flex min-h-11 min-w-0 flex-col items-center justify-center gap-1.5 border-l border-white/10 px-1 text-center',
                    canWrite ? 'cursor-pointer transition hover:bg-white/5 active:opacity-75' : 'cursor-default',
                  ].join(' ')}
                  title={canWrite ? 'Modifier la durée' : undefined}
                >
                  <p className="text-[0.58rem] font-medium uppercase leading-tight text-[var(--fz-text-muted)]">Durée</p>
                  <p className="whitespace-nowrap text-[0.9rem] font-black leading-tight text-white">{formatSongDuration(currentSong.durationSeconds)}</p>
                </button>
              </div>

              <section aria-labelledby="song-notes-heading" className="space-y-2 border-b border-white/8 pb-4">
                <div className="flex min-h-11 items-center justify-between gap-3 px-2">
                  <p id="song-notes-heading" className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Notes</p>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickValue(currentSong.notes || '');
                        setQuickEditField('notes');
                      }}
                      aria-label="Modifier les notes"
                      title="Modifier les notes"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/6 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-accent)] active:scale-95"
                    >
                      <FzIcon name="edit" usageId="song-detail.notes.edit" size="sm" />
                    </button>
                  ) : null}
                </div>
                <p className={[
                  'whitespace-pre-line px-2 text-[0.9rem] leading-7',
                  currentSong.notes?.trim() ? 'text-white/78' : 'text-[var(--fz-text-muted)]',
                ].join(' ')}>
                  {currentSong.notes?.trim() || 'Aucune note pour le moment.'}
                </p>
              </section>

              <section aria-labelledby="song-lyrics-heading" className="space-y-2 border-b border-white/8 pb-4">
                <div className="flex min-h-11 items-center justify-between gap-3 px-2">
                  <p id="song-lyrics-heading" className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Paroles</p>
                  <div className="flex items-center">
                    <Link
                      to={`/prompter/play?songId=${encodeURIComponent(currentSong.id)}`}
                      aria-label="Ouvrir cette chanson dans le prompteur"
                      title="Ouvrir le prompteur"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sky-400 transition hover:bg-white/6 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-accent)] active:scale-95 active:text-sky-500"
                    >
                      <FzIcon name="prompter" usageId="song-detail.lyrics.prompter" size="sm" className="text-sky-400" />
                    </Link>
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/songs/${currentSong.id}/write`)}
                        aria-label="Modifier les paroles"
                        title="Modifier les paroles"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/6 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-accent)] active:scale-95"
                      >
                        <FzIcon name="edit" usageId="song-detail.lyrics.edit" size="sm" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="whitespace-pre-line px-2 text-[0.95rem] leading-7 text-white/88">
                  {currentSong.lyrics || 'Aucune parole pour le moment.'}
                </p>
              </section>

            </div>
          )}
        </section>
      </section>

      {isAudioActionsOpen ? (
        <FormDialog
          title="Audio"
          closeLabel="Fermer les actions audio"
          placement="bottom"
          onClose={() => setIsAudioActionsOpen(false)}
        >
          <div className="space-y-4">
            {error ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{error}</p> : null}
            {audioNotice ? <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-100">{audioNotice}</p> : null}
            {assets === undefined ? (
              <p className="rounded-xl border border-white/8 bg-white/5 p-3 text-sm text-white/50">Chargement des pistes...</p>
            ) : assets.length > 0 ? (
              <div className="divide-y divide-white/10">
                {assets.map((asset) => {
                  const isThisPlaying = currentTrack?.assetId === asset.id && status === 'playing';
                  const isCached = cachedAssetIds.has(asset.id);
                  const isPrimary = primaryAudioAsset?.id === asset.id;
                  const isDownloading = downloadingAssetIds[asset.id] !== undefined;

                  return (
                    <ContentRow
                      key={asset.id}
                      mode="controls"
                      leading={
                        <button
                          type="button"
                          onClick={() => {
                            setIsAudioActionsOpen(false);
                            handlePlayAsset(asset.id, isCached);
                          }}
                          aria-label={isThisPlaying ? `Arreter ${asset.filename}` : `Lire ${asset.filename}`}
                          className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition", isThisPlaying ? 'bg-[var(--fz-accent)] text-white' : 'bg-white/10 text-white hover:bg-white/15 active:scale-95'].join(' ')}
                        >
                          {isThisPlaying ? <FzIcon name="stop" usageId="song-detail.track.stop" size="sm" /> : <FzIcon name="play" usageId="song-detail.track.play" size="sm" />}
                        </button>
                      }
                      title={
                        <button
                          type="button"
                          onClick={() => {
                            setIsAudioActionsOpen(false);
                            handlePlayAsset(asset.id, isCached);
                          }}
                          className="truncate text-left text-sm font-semibold text-white hover:underline"
                        >
                          {asset.filename}
                        </button>
                      }
                      trailing={
                        <div className="flex shrink-0 items-center gap-1">
                          {canWrite ? (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryAudio(asset.id)}
                              aria-label={isPrimary ? `${asset.filename} est la piste favorite` : `Définir ${asset.filename} comme piste favorite`}
                              title={isPrimary ? 'Piste favorite' : 'Définir comme favorite'}
                              className={[
                                'flex h-11 w-11 shrink-0 items-center justify-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300',
                                isPrimary ? 'text-amber-300 hover:text-amber-200' : 'text-white/55 hover:text-white',
                              ].join(' ')}
                            >
                              <FzIcon
                                name="star"
                                usageId="song-detail.track.favorite"
                                size="sm"
                                fill={isPrimary ? 'currentColor' : 'none'}
                              />
                            </button>
                          ) : null}
                          <ContextMenu
                            ariaLabel={`Actions pour ${asset.filename}`}
                            trigger={<FzIcon name="menu" usageId="song-detail.track.menu" size="sm" />}
                            items={[
                              {
                                id: `download-local-${asset.id}`,
                                label: isCached ? 'Retirer du local' : 'Télécharger en local',
                                icon: isCached ? 'delete' : 'download',
                                disabled: isDownloading || (!isCached && !isOnline),
                                onSelect: () => void handleToggleAudioCache(asset.id, isCached),
                              },
                              ...(canWrite ? [
                                {
                                  id: `unlink-audio-${asset.id}`,
                                  label: 'Dissocier du morceau',
                                  icon: 'edit' as const,
                                  onSelect: () => void handleUnlinkAudio(asset.id, asset.filename),
                                },
                                {
                                  id: `delete-audio-${asset.id}`,
                                  label: 'Supprimer',
                                  icon: 'delete' as const,
                                  tone: 'danger' as const,
                                  onSelect: () => setAssetPendingDeletion({ id: asset.id, filename: asset.filename }),
                                },
                              ] : []),
                            ]}
                          />
                        </div>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-white/8 bg-white/5 p-3 text-sm text-white/50">Aucune piste associée.</p>
            )}

            {pendingAudioUploads && pendingAudioUploads.length > 0 ? (
              <div className="space-y-2 border-t border-white/8 pt-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/45">
                  Envois en attente
                </p>
                {pendingAudioUploads.map((pendingUpload) => (
                  <div
                    key={pendingUpload.id}
                    className="flex items-center gap-3 rounded-xl border border-amber-300/15 bg-amber-300/6 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{pendingUpload.filename}</p>
                      <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-200/75">
                        {pendingUpload.status === 'uploading'
                          ? 'Envoi en cours'
                          : pendingUpload.status === 'failed'
                            ? 'Echec - reessayer'
                            : 'En attente de connexion'}
                      </p>
                      {pendingUpload.errorMessage ? (
                        <p className="mt-1 truncate text-xs text-rose-300">{pendingUpload.errorMessage}</p>
                      ) : null}
                    </div>
                    {pendingUpload.status === 'failed' ? (
                      <button
                        type="button"
                        onClick={() => void retryPendingAudioUpload(pendingUpload.id)}
                        className="rounded-lg bg-white/10 px-2.5 py-2 text-[0.62rem] font-black uppercase text-white"
                      >
                        Reessayer
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void removePendingAudioUpload(pendingUpload.id)}
                      disabled={pendingUpload.status === 'uploading'}
                      aria-label={`Annuler l'envoi de ${pendingUpload.filename}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-rose-300 disabled:opacity-30"
                    >
                      <FzIcon name="delete" usageId="song-detail.pending-upload.remove" size="sm" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {canWrite ? <div className="grid gap-2 border-t border-white/8 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsAudioActionsOpen(false);
                  setAudioNotice(null);
                  setError(null);
                  setIsVoiceRecorderOpen(true);
                }}
                className="fz-button-primary flex items-center justify-center gap-2 px-4 py-3 text-sm font-black uppercase leading-5 tracking-[0.12em] disabled:opacity-60"
              >
                <FzIcon name="record" usageId="song-detail.audio.record" size="md" className="shrink-0" />
                <span>Enregistrer un audio</span>
              </button>
              <button
                type="button"
                disabled={isUploadingAudio}
                onClick={() => {
                  setIsAudioActionsOpen(false);
                  audioInputRef.current?.click();
                }}
                className="fz-button-secondary flex items-center justify-center gap-2 px-4 py-3 text-sm font-black uppercase leading-5 tracking-[0.12em] text-white disabled:opacity-60"
              >
                <FzIcon name="upload" usageId="song-detail.audio.upload" size="md" className="shrink-0 text-white/75" />
                <span>{isUploadingAudio ? 'Import en cours...' : 'Importer un audio'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAudioActionsOpen(false);
                  setSelectedAssetToLinkId(unlinkedAssets?.[0]?.id ?? '');
                  setIsLinkDialogOpen(true);
                }}
                className="fz-button-secondary flex items-center justify-center gap-2 px-4 py-3 text-sm font-black uppercase leading-5 tracking-[0.12em] text-white"
              >
                <FzIcon name="edit" usageId="song-detail.audio.link" size="md" className="shrink-0 text-white/75" />
                <span>Associer un audio</span>
              </button>
            </div> : null}
          </div>
        </FormDialog>
      ) : null}

      {isVoiceRecorderOpen ? (
        <QuickVoiceRecorder
          directSongId={currentSong.id}
          directSongTitle={currentSong.title}
          onClose={() => setIsVoiceRecorderOpen(false)}
          onComplete={({ message }) => {
            setIsVoiceRecorderOpen(false);
            setAudioNotice(message);
            setError(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        isOpen={assetPendingDeletion !== null}
        title="Supprimer ce fichier audio ?"
        description={assetPendingDeletion ? `${assetPendingDeletion.filename} sera définitivement supprimé de la bibliothèque.` : ''}
        confirmLabel="Supprimer"
        onConfirm={() => void handleDeleteAudio()}
        onCancel={() => setAssetPendingDeletion(null)}
      />

      <ConfirmDialog
        isOpen={canWrite && isDeleteDialogOpen}
        title="Voulez-vous supprimer cette chanson ?"
        description="La chanson sera retiree de la liste active sur cet appareil. Cette action demande une confirmation explicite."
        confirmLabel="Supprimer"
        isBusy={isSaving}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSong}
      />

      {canWrite && isLinkDialogOpen ? (
        <FormDialog
          title="Lier une musique"
          onClose={() => setIsLinkDialogOpen(false)}
        >
          <div className="space-y-4">
            {unlinkedAssets && unlinkedAssets.length > 0 ? (
              <label className="block">
                <span className="fz-field-label mb-2 block">
                  Fichier importe
                </span>
                <SelectField
                  aria-label="Fichier importé à associer"
                  value={selectedAssetToLinkId}
                  onChange={(event) => setSelectedAssetToLinkId(event.target.value)}
                >
                  {unlinkedAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.filename}
                    </option>
                  ))}
                </SelectField>
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


      {canWrite && (
        <CopySongModal
          songId={currentSong.id}
          songTitle={currentSong.title}
          currentWorkspaceId={currentSong.workspaceId}
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          onSuccess={() => setIsCopyModalOpen(false)}
        />
      )}

      {duplicatePrompt ? (
        <FormDialog
          title="Piste deja importee"
          closeLabel="Annuler l'import de cette piste"
          onClose={() => resolveDuplicatePrompt({ action: 'cancel' })}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--fz-text-muted)]">
              Le fichier <span className="font-black text-white">{duplicatePrompt.existingFilename}</span> existe deja dans les musiques.
            </p>

            <label className="block">
              <span className="fz-field-label mb-2 block">
                Nouveau nom
              </span>
              <TextField
                value={duplicatePrompt.renameValue}
                onChange={(event) =>
                  setDuplicatePrompt({
                    ...duplicatePrompt,
                    renameValue: event.target.value,
                    error: null,
                  })
                }
              />
            </label>

            {duplicatePrompt.error ? <p className="text-sm font-semibold text-rose-400">{duplicatePrompt.error}</p> : null}

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => resolveDuplicatePrompt({ action: 'replace' })}
                className="rounded-[1rem] border border-white/20 bg-white/10 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em] text-white transition hover:bg-white/15"
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

      {quickEditField === 'title' ? (
        <FormDialog
          title="Modifier le titre"
          onClose={() => setQuickEditField(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveQuickField();
            }}
            className="space-y-4"
          >
            <TextField
              type="text"
              value={quickValue}
              onChange={(e) => setQuickValue(e.target.value)}
              placeholder="Titre du morceau"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuickEditField(null)}
                className="fz-button-secondary px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="fz-button-primary px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em]"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </FormDialog>
      ) : null}

      {quickEditField === 'status' ? (
        <PickerDialog title="Statut de création" onClose={() => setQuickEditField(null)}>
          <div className="grid grid-cols-3 gap-3">
            {songStatusOptions.map((statusOption) => {
              const isSelected = currentSong.status === statusOption.value;
              return (
                <button
                  key={statusOption.value}
                  type="button"
                  data-picker-selected={isSelected ? 'true' : 'false'}
                  onClick={() => {
                    void (async () => {
                      await songsRepository.update(currentSong.id, { status: statusOption.value });
                      setQuickEditField(null);
                    })();
                  }}
                  className={[
                    'rounded-2xl px-4 py-4 text-sm font-black transition',
                    isSelected
                      ? 'bg-indigo-500 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]'
                      : 'bg-white/6 text-white/78 hover:bg-white/10',
                  ].join(' ')}
                >
                  {statusOption.label}
                </button>
              );
            })}
          </div>
        </PickerDialog>
      ) : null}

      {quickEditField === 'key' ? (
        <PickerDialog title="Sélectionner la Tonalité" onClose={() => setQuickEditField(null)}>
          <div className="grid grid-cols-4 gap-3">
            {keyOptions.map((keyOption) => {
              const displayValue = keyOption || '--';
              const isSelected = (currentSong.key || '') === keyOption;

              return (
                <button
                  key={displayValue}
                  type="button"
                  data-picker-selected={isSelected ? 'true' : 'false'}
                  onClick={() => {
                    void (async () => {
                      await songsRepository.update(currentSong.id, { key: keyOption });
                      setQuickEditField(null);
                    })();
                  }}
                  className={[
                    'rounded-2xl px-4 py-4 text-sm font-black transition',
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                      : 'bg-white/6 text-white/78 hover:bg-white/10',
                  ].join(' ')}
                >
                  {displayValue}
                </button>
              );
            })}
          </div>
        </PickerDialog>
      ) : null}

      {quickEditField === 'bpm' ? (
        <PickerDialog
          title="Sélectionner le tempo"
          closeLabel="Fermer"
          headerActions={
            <Button
              size="sm"
              variant="secondary"
              aria-label="Ouvrir la programmation du métronome"
              leadingIcon={<FzIcon name="metronome" usageId="song-detail.tempo.structure" size="sm" />}
              onClick={() => {
                setQuickEditField(null);
                navigate(`/songs/${songId}/structure`);
              }}
            >
              Métronome
            </Button>
          }
          onClose={() => setQuickEditField(null)}
        >
          <WheelColumn
            options={bpmOptions}
            selectedValue={quickValue}
            onSelect={(val) => {
              setQuickValue(val);
            }}
            suffix="BPM"
          />
          <div className="mt-5">
            <Button
              variant="primary"
              fullWidth
              onClick={() => void handleSaveQuickField()}
            >
              Valider
            </Button>
          </div>
        </PickerDialog>
      ) : null}

      {quickEditField === 'duration' ? (
        <PickerDialog title="Sélectionner la durée" closeLabel="Fermer" onClose={() => setQuickEditField(null)}>
          <div className="overflow-hidden rounded-2xl bg-white/4 p-2">
            <div className="relative grid grid-cols-2 overflow-hidden rounded-xl">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-14 -translate-y-1/2 rounded-lg bg-white/8" />
              <div aria-hidden="true" className="pointer-events-none absolute bottom-4 left-1/2 top-4 z-20 w-px bg-white/8" />
              <WheelColumn
                options={durationMinuteOptions}
                selectedValue={quickDuration.minutes}
                onSelect={(val) => {
                  setQuickDuration((prev) => ({ ...prev, minutes: val }));
                }}
                suffix="min"
                framed={false}
              />
              <WheelColumn
                options={durationSecondOptions}
                selectedValue={quickDuration.seconds}
                onSelect={(val) => {
                  setQuickDuration((prev) => ({ ...prev, seconds: val }));
                }}
                suffix="sec"
                framed={false}
              />
            </div>
          </div>
          <div className="mt-5">
            <Button
              variant="primary"
              fullWidth
              onClick={() => void handleSaveQuickField()}
            >
              Valider
            </Button>
          </div>
        </PickerDialog>
      ) : null}

      {quickEditField === 'notes' ? (
        <FormDialog
          title={song?.notes?.trim() ? 'Modifier les notes' : 'Ajouter une note'}
          placement="bottom"
          onClose={() => setQuickEditField(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveQuickField();
            }}
            className="space-y-4"
          >
            <TextArea
              aria-label="Notes"
              rows={4}
              value={quickValue}
              onChange={(e) => setQuickValue(e.target.value)}
              placeholder="Repere scene, structure, remarques..."
              resize="none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuickEditField(null)}
                className="fz-button-secondary px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="fz-button-primary px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em]"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </FormDialog>
      ) : null}
    </div>
  );
}
