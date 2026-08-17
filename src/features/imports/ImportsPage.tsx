import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import { SortMenu, type SortMode } from '@/components/SortMenu';
import { StatusPill } from '@/ui/components/StatusPill';
import { SelectField } from '@/ui/components/SelectField';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { db } from '@/db/db';
import type { PendingAudioUploadRecord } from '@/db/schema';
import { songsRepository } from '@/db/repositories/songsRepository';
import type { AudioTrack } from '@/features/audio/audioPlayerStore';
import { useAudioPlayerStore } from '@/features/audio/audioPlayerStore';
import { buildCompressedFileName } from '@/features/songs/audioCompression';
import { formatSongDuration, getSongStatusLabel, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import type { SongAssetUploadProgress } from '@/services/supabase/storage';
import {
  linkPendingAudioUpload,
  removePendingAudioUpload,
  retryPendingAudioUpload,
  uploadOrQueueSongAsset,
} from '@/services/audio/pendingUploads';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { TextField } from '@/ui/components/TextField';
import { useAudioCacheStore } from '@/features/audio/audioCacheStore';
import { useLongPress } from '@/hooks/useLongPress';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import type { SongStatus } from '@/db/schema';
import { AddButton } from '@/ui/components/AddButton';
import { ContentRow } from '@/ui/components/ContentRow';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { PageHeader } from '@/ui/components/PageHeader';
import { FzIcon } from '@/ui/icons';

interface ImportProgressState {
  id: string;
  fileName: string;
  currentFileIndex: number;
  totalFiles: number;
  phase: SongAssetUploadProgress['phase'] | 'preparing' | 'queued' | 'done' | 'error';
  compressionProgress: number;
  uploadProgress: number;
  label: string;
}

type ImportedTrack = Awaited<ReturnType<typeof songAssetsRepository.listImportedTracks>>[number];

interface TrackMenuState {
  asset: ImportedTrack;
  songId?: string;
  isPrimary: boolean;
  isCached: boolean;
  isOnline: boolean;
}

interface AudioPickerState {
  songTitle: string;
  assets: ImportedTrack[];
}

type DuplicateDecision =
  | { action: 'replace' }
  | { action: 'rename'; filename: string }
  | { action: 'cancel' };

type SingleLinkDecision = { action: 'link'; songId: string } | { action: 'skip' };
type BatchLinkDecision =
  | { action: 'confirm'; items: Array<{ id: string; selectedSongId: string }> }
  | { action: 'skip' };

interface DuplicatePromptState {
  fileName: string;
  existingTitle: string;
  existingFilename: string;
  renameValue: string;
  reservedFilenames: string[];
  error: string | null;
}

interface SingleLinkPromptState {
  assetId: string;
  filename: string;
  selectedSongId: string;
  error: string | null;
}

interface BatchLinkPromptItem {
  id: string;
  filename: string;
  selectedSongId: string;
  status: 'uploading' | 'ready' | 'error';
  error: string | null;
}

interface BatchLinkPromptState {
  items: BatchLinkPromptItem[];
}

interface DeletePromptState {
  assetId: string;
  filename: string;
}

function ChevronIcon({ className, isOpen, iconAuditId }: { className?: string; isOpen: boolean; iconAuditId?: string }) {
  return (
    <svg
      data-icon-audit-id={iconAuditId}
      viewBox="0 0 24 24"
      className={['h-4 w-4 transition-transform duration-200', isOpen ? 'rotate-180' : '', className].join(' ')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ProgressBar({ value, tone = 'active' }: { value: number; tone?: 'active' | 'done' | 'error' }) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/8">
      <div className="relative h-full w-full">
        <div
          className={[
            'h-full rounded-full transition-[width] duration-200',
            tone === 'error' ? 'bg-rose-400' : tone === 'done' ? 'bg-white/55' : 'bg-orange-400',
          ].join(' ')}
          style={{ width: `${boundedValue}%` }}
        />
      </div>
    </div>
  );
}

function toTrack(asset: ImportedTrack): AudioTrack {
  const track: AudioTrack = {
    assetId: asset.id,
    title: asset.song?.title || asset.filename,
    filename: asset.filename,
    sizeBytes: asset.sizeBytes,
  };

  if (asset.songId !== undefined) {
    track.songId = asset.songId;
  }
  if (asset.syncStatus !== undefined) {
    track.syncStatus = asset.syncStatus;
  }

  return track;
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

function buildTrackSubtitle(asset: ImportedTrack) {
  const parts = [
    asset.durationSeconds && asset.durationSeconds > 0 ? formatSongDuration(asset.durationSeconds) : '--:--',
  ];

  if (asset.syncStatus === 'pending') {
    parts.push('En attente de sync');
  }

  return parts.join(' - ');
}

function SongPlayButton({
  songTitle,
  assets,
  isPlaying,
  canPlay,
  onPlay,
  onChooseAudio,
}: {
  songTitle: string;
  assets: ImportedTrack[];
  isPlaying: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onChooseAudio: () => void;
}) {
  const longPress = useLongPress({
    onClick: onPlay,
    onLongPress: () => {
      if (assets.length > 1) onChooseAudio();
    },
  });

  return (
    <button
      type="button"
      {...longPress}
      disabled={!canPlay}
      aria-label={isPlaying ? `Arrêter ${songTitle}` : `Lire ${songTitle}`}
      title={assets.length > 1 ? 'Appui long pour choisir un audio' : undefined}
      className={[
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-35',
        isPlaying ? 'bg-[var(--fz-accent)] text-white' : 'bg-white text-[#111316] hover:bg-white/88',
      ].join(' ')}
    >
      {isPlaying ? <FzIcon name="stop" usageId="imports.summary.stop" size="sm" /> : <FzIcon name="play" usageId="imports.summary.play" size="sm" />}
    </button>
  );
}

export function ImportsPage() {
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const activeWorkspaceId = activeWorkspace?.id;
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const importedTracks = useLiveQuery(() => songAssetsRepository.listImportedTracks(), [activeWorkspaceId]);
  const pendingAudioUploads = useLiveQuery<PendingAudioUploadRecord[]>(
    async () =>
      activeWorkspaceId
        ? await db.pendingAudioUploads.where('workspaceId').equals(activeWorkspaceId).sortBy('queuedAt')
        : [],
    [activeWorkspaceId]
  );
  const songs = useLiveQuery(() => songsRepository.list(), [activeWorkspaceId]);
  const songSummaries = useLiveQuery(() => songsRepository.listLibrarySummaries(), [activeWorkspaceId]);
  const playQueue = useAudioPlayerStore((state) => state.playQueue);
  const stop = useAudioPlayerStore((state) => state.stop);
  const currentIndex = useAudioPlayerStore((state) => state.currentIndex);
  const queue = useAudioPlayerStore((state) => state.queue);
  const status = useAudioPlayerStore((state) => state.status);

  const isOnline = useOnlineStatus();
  const { cachedAssetIds, downloadingAssetIds, downloadAsset, removeAsset, checkCacheStatus } = useAudioCacheStore();
  const [shakingAssetId, setShakingAssetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('updated-desc');
  const [statusFilter, setStatusFilter] = useState<SongStatus | 'all'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [isCreateSongOpen, setIsCreateSongOpen] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [isCreatingSong, setIsCreatingSong] = useState(false);
  const [createSongError, setCreateSongError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importProgressItems, setImportProgressItems] = useState<ImportProgressState[]>([]);
  const [isImportProgressDismissed, setIsImportProgressDismissed] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePromptState | null>(null);
  const [singleLinkPrompt, setSingleLinkPrompt] = useState<SingleLinkPromptState | null>(null);
  const [batchLinkPrompt, setBatchLinkPrompt] = useState<BatchLinkPromptState | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<DeletePromptState | null>(null);
  const [isDeletingAsset, setIsDeletingAsset] = useState(false);
  const [openTrackMenu, setOpenTrackMenu] = useState<TrackMenuState | null>(null);
  const [audioPicker, setAudioPicker] = useState<AudioPickerState | null>(null);
  const [expandedSongIds, setExpandedSongIds] = useState<Record<string, boolean>>({});
  const [primaryTracks, setPrimaryTracks] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('fz-primary-track:')) {
          const songId = key.substring('fz-primary-track:'.length);
          initial[songId] = localStorage.getItem(key) || '';
        }
      }
    } catch (e) {
      console.error(e);
    }
    return initial;
  });

  useEffect(() => {
    void checkCacheStatus();
  }, [checkCacheStatus]);

  useEffect(() => {
    if (!openTrackMenu && !audioPicker) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenTrackMenu(null);
        setAudioPicker(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [audioPicker, openTrackMenu]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const duplicateResolverRef = useRef<((decision: DuplicateDecision) => void) | null>(null);
  const singleLinkResolverRef = useRef<((decision: SingleLinkDecision) => void) | null>(null);
  const batchLinkResolverRef = useRef<((decision: BatchLinkDecision) => void) | null>(null);
  const batchLinkPromptRef = useRef<BatchLinkPromptState | null>(null);

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase('fr-FR');
  const filteredImportedTracks = importedTracks?.filter((asset) => {
    if (!normalizedSearchQuery) {
      return true;
    }

    return [asset.filename, asset.song?.title].some((value) =>
      value?.toLocaleLowerCase('fr-FR').includes(normalizedSearchQuery),
    );
  });
  const visibleSongSummaries = songSummaries?.filter((summary) => {
    if (statusFilter !== 'all' && summary.song.status !== statusFilter) return false;
    if (!normalizedSearchQuery) return true;

    return summary.song.title.toLocaleLowerCase('fr-FR').includes(normalizedSearchQuery)
      || filteredImportedTracks?.some((asset) => asset.songId === summary.song.id) === true;
  }).sort((left, right) => {
    if (sortMode === 'title-asc' || sortMode === 'title-desc') {
      const comparison = left.song.title.localeCompare(right.song.title, 'fr', { sensitivity: 'base' });
      return sortMode === 'title-asc' ? comparison : -comparison;
    }

    const comparison = left.song.updatedAt - right.song.updatedAt;
    return sortMode === 'updated-asc' ? comparison : -comparison;
  });
  const playableTracks = (() => {
    if (!filteredImportedTracks) return [];
    if (statusFilter !== 'all') return [];

    const unassociatedAssets: ImportedTrack[] = [];

    for (const asset of filteredImportedTracks) {
      if (!asset.songId || !asset.song) {
        unassociatedAssets.push(asset);
      }
    }

    const sortAssets = (assets: ImportedTrack[]) => [...assets].sort((left, right) => {
      if (sortMode === 'title-asc' || sortMode === 'title-desc') {
        const comparison = left.filename.localeCompare(right.filename, 'fr', { sensitivity: 'base' });
        return sortMode === 'title-asc' ? comparison : -comparison;
      }

      const comparison = left.updatedAt - right.updatedAt;
      return sortMode === 'updated-asc' ? comparison : -comparison;
    });

    const groups: Array<{ songId?: string; songTitle?: string; assets: ImportedTrack[] }> = [];
    if (unassociatedAssets.length > 0) {
      groups.push({
        songTitle: 'Sans association',
        assets: sortAssets(unassociatedAssets),
      });
    }

    return groups;
  })();

  const groupedTracks = playableTracks; // Alias for clarity in rendering
  const flatPlayableTracks = (filteredImportedTracks ?? []).map(toTrack);
  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : undefined;
  const isProgressPanelVisible = importProgressItems.length > 0 && !isImportProgressDismissed;

  function upsertImportProgress(progress: ImportProgressState) {
    setImportProgressItems((currentItems) => {
      const existingIndex = currentItems.findIndex((item) => item.id === progress.id);
      if (existingIndex === -1) {
        return [...currentItems, progress];
      }

      const nextItems = [...currentItems];
      nextItems[existingIndex] = progress;
      return nextItems;
    });
  }

  function updateImportProgressItem(
    id: string,
    updater: (currentItem: ImportProgressState) => ImportProgressState
  ) {
    setImportProgressItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? updater(item) : item))
    );
  }

  function updateBatchLinkPromptItem(
    id: string,
    updater: (currentItem: BatchLinkPromptItem) => BatchLinkPromptItem
  ) {
    setBatchLinkPrompt((currentPrompt) => {
      if (!currentPrompt) {
        return currentPrompt;
      }

      const nextPrompt = {
        ...currentPrompt,
        items: currentPrompt.items.map((item) => (item.id === id ? updater(item) : item)),
      };
      batchLinkPromptRef.current = nextPrompt;
      return nextPrompt;
    });
  }

  function getUnifiedProgress(progress: ImportProgressState) {
    if (progress.phase === 'done' || progress.phase === 'queued') {
      return 100;
    }
    if (progress.phase === 'error') {
      return progress.uploadProgress > 0 ? 50 + progress.uploadProgress * 0.5 : progress.compressionProgress * 0.5;
    }
    if (progress.phase === 'upload') {
      return 50 + progress.uploadProgress * 0.5;
    }
    if (progress.phase === 'compression') {
      return progress.compressionProgress * 0.5;
    }
    return 0;
  }

  function getProgressTone(progress: ImportProgressState) {
    if (progress.phase === 'error') {
      return 'error' as const;
    }
    if (progress.phase === 'done' || progress.phase === 'queued') {
      return 'done' as const;
    }
    return 'active' as const;
  }

  function askDuplicateDecision(
    file: File,
    duplicate: ImportedTrack,
    reservedFilenames: Set<string>
  ) {
    return new Promise<DuplicateDecision>((resolve) => {
      duplicateResolverRef.current = resolve;
      setDuplicatePrompt({
        fileName: file.name,
        existingTitle: duplicate.song?.title || duplicate.filename,
        existingFilename: duplicate.filename,
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

  function askSingleLinkDecision(assetId: string, filename: string) {
    return new Promise<SingleLinkDecision>((resolve) => {
      singleLinkResolverRef.current = resolve;
      setSingleLinkPrompt({
        assetId,
        filename,
        selectedSongId: songs?.[0]?.id ?? '',
        error: null,
      });
    });
  }

  function resolveSingleLinkPrompt(decision: SingleLinkDecision) {
    singleLinkResolverRef.current?.(decision);
    singleLinkResolverRef.current = null;
    setSingleLinkPrompt(null);
  }

  function askBatchLinkDecision(items: BatchLinkPromptItem[]) {
    return new Promise<BatchLinkDecision>((resolve) => {
      batchLinkResolverRef.current = resolve;
      const nextPrompt = { items };
      batchLinkPromptRef.current = nextPrompt;
      setBatchLinkPrompt(nextPrompt);
    });
  }

  function resolveBatchLinkPrompt(action: BatchLinkDecision['action']) {
    if (action === 'confirm') {
      const currentPrompt = batchLinkPromptRef.current;
      batchLinkResolverRef.current?.({
        action: 'confirm',
        items: currentPrompt?.items.map((item) => ({
          id: item.id,
          selectedSongId: item.selectedSongId,
        })) ?? [],
      });
    } else {
      batchLinkResolverRef.current?.({ action: 'skip' });
    }

    batchLinkResolverRef.current = null;
    batchLinkPromptRef.current = null;
    setBatchLinkPrompt(null);
  }

  async function handleConfirmSingleLinkPrompt() {
    if (!canWrite) return;
    if (!singleLinkPrompt) {
      return;
    }

    if (!singleLinkPrompt.selectedSongId) {
      setSingleLinkPrompt({ ...singleLinkPrompt, error: 'Choisis une chanson a associer.' });
      return;
    }

    resolveSingleLinkPrompt({ action: 'link', songId: singleLinkPrompt.selectedSongId });
  }

  async function linkAssetToSong(assetId: string, songId: string) {
    await songAssetsRepository.linkToSong(assetId, songId);
    setImportMessage(null);
  }

  function handleRenameDecision() {
    if (!duplicatePrompt) {
      return;
    }

    const renamedFilename = buildCompressedFileName(duplicatePrompt.renameValue);
    const reservedFilenames = new Set(duplicatePrompt.reservedFilenames);
    if (reservedFilenames.has(renamedFilename)) {
      setDuplicatePrompt({
        ...duplicatePrompt,
        error: 'Ce nom est deja utilise par une piste importee.',
      });
      return;
    }

    resolveDuplicatePrompt({ action: 'rename', filename: renamedFilename });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!canWrite) return;
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setIsImporting(true);
    setImportMessage(null);
    setImportProgressItems([]);
    setIsImportProgressDismissed(false);

    try {
      const workspaceId = useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
      const existingTracks = await songAssetsRepository.listImportedTracks();
      const existingTracksByFilename = new Map(existingTracks.map((track) => [track.filename, track] as const));
      const reservedFilenames = new Set([
        ...existingTracksByFilename.keys(),
        ...(pendingAudioUploads ?? []).map((pendingUpload) => pendingUpload.filename),
      ]);
      let skippedCount = 0;
      const preparedImports: Array<{
        id: string;
        file: File;
        filename: string;
        currentFileIndex: number;
        totalFiles: number;
      }> = [];

      for (const [fileIndex, file] of files.entries()) {
        let finalFilename = buildCompressedFileName(file.name);
        const duplicate = existingTracksByFilename.get(finalFilename);
        if (duplicate) {
          const decision = await askDuplicateDecision(file, duplicate, reservedFilenames);

          if (decision.action === 'cancel') {
            skippedCount += 1;
            continue;
          }

          if (decision.action === 'replace') {
            await songAssetsRepository.softDelete(duplicate.id);
            existingTracksByFilename.delete(finalFilename);
          }

          if (decision.action === 'rename') {
            finalFilename = decision.filename;
          }
        } else if (reservedFilenames.has(finalFilename)) {
          finalFilename = buildCompressedFileName(buildRenamedFileName(file.name, reservedFilenames));
        }

        reservedFilenames.add(finalFilename);
        preparedImports.push({
          id: `${fileIndex}-${finalFilename}`,
          file,
          filename: finalFilename,
          currentFileIndex: fileIndex + 1,
          totalFiles: files.length,
        });
      }

      if (preparedImports.length === 0) {
        setImportMessage(
          skippedCount > 0
            ? `${skippedCount} piste${skippedCount > 1 ? 's' : ''} annulee${skippedCount > 1 ? 's' : ''}.`
            : null
        );
        return;
      }

      const batchDecisionPromise = askBatchLinkDecision(
        preparedImports.map((preparedImport) => ({
          id: preparedImport.id,
          filename: preparedImport.filename,
          selectedSongId: '',
          status: 'uploading',
          error: null,
        }))
      );

      const uploadResultsPromise = Promise.all(
        preparedImports.map(async (preparedImport) => {
          const progressBase = {
            id: preparedImport.id,
            fileName: preparedImport.filename,
            currentFileIndex: preparedImport.currentFileIndex,
            totalFiles: preparedImport.totalFiles,
          };

          upsertImportProgress({
            ...progressBase,
            phase: 'preparing',
            compressionProgress: 0,
            uploadProgress: 0,
            label: 'Preparation de la piste',
          });

          try {
            const result = await uploadOrQueueSongAsset(workspaceId, undefined, preparedImport.file, {
              filename: preparedImport.filename,
              isOnline: () => isOnline,
              onProgress: (progress) => {
                upsertImportProgress({
                  ...progressBase,
                  phase: progress.phase,
                  compressionProgress: progress.phase === 'compression' ? progress.progress : 100,
                  uploadProgress: progress.phase === 'upload' ? progress.progress : 0,
                  label: progress.label,
                });
              },
            });

            upsertImportProgress({
              ...progressBase,
              phase: result.status === 'queued' ? 'queued' : 'done',
              compressionProgress: 100,
              uploadProgress: 100,
              label: result.status === 'queued' ? 'En attente de connexion' : 'Import termine',
            });
            updateBatchLinkPromptItem(preparedImport.id, (currentItem) => ({
              ...currentItem,
              status: 'ready',
              error: null,
            }));

            return {
              id: preparedImport.id,
              filename: preparedImport.filename,
              result,
              success: true as const,
            };
          } catch (error: any) {
            updateImportProgressItem(preparedImport.id, (currentItem) => ({
              ...currentItem,
              phase: 'error',
              label: "L'import a ete interrompu",
            }));
            updateBatchLinkPromptItem(preparedImport.id, (currentItem) => ({
              ...currentItem,
              status: 'error',
              error: error?.message || "Impossible d'importer cette piste audio.",
            }));

            return {
              id: preparedImport.id,
              filename: preparedImport.filename,
              error: error?.message || "Impossible d'importer cette piste audio.",
              success: false as const,
            };
          }
        })
      );

      const [batchDecision, uploadResults] = await Promise.all([batchDecisionPromise, uploadResultsPromise]);
      const successfulResults = uploadResults.filter((result) => result.success);
      const successfulResultsById = new Map(successfulResults.map((result) => [result.id, result.result] as const));

      if (batchDecision.action === 'confirm') {
        for (const item of batchDecision.items) {
          if (!item.selectedSongId) {
            continue;
          }

          const uploadResult = successfulResultsById.get(item.id);
          if (uploadResult?.status === 'uploaded') {
            await linkAssetToSong(uploadResult.assetId, item.selectedSongId);
          } else if (uploadResult?.status === 'queued') {
            const uploadedItem = successfulResults.find((result) => result.id === item.id);
            await linkPendingAudioUpload(uploadResult.pendingUploadId, item.selectedSongId, {
              workspaceId,
              filename: uploadedItem?.filename ?? item.id,
            });
          }
        }
      }

      const importedCount = successfulResults.filter((result) => result.result.status === 'uploaded').length;
      const queuedCount = successfulResults.filter((result) => result.result.status === 'queued').length;
      const failedCount = uploadResults.length - successfulResults.length;
      setImportMessage(
        `${importedCount} piste${importedCount > 1 ? 's' : ''} importee${importedCount > 1 ? 's' : ''}` +
          (queuedCount > 0 ? `, ${queuedCount} en attente de connexion` : '') +
          (skippedCount > 0 ? `, ${skippedCount} annulee${skippedCount > 1 ? 's' : ''}` : '') +
          (failedCount > 0 ? `, ${failedCount} en erreur` : '') +
          '.'
      );
    } catch (error: any) {
      setImportMessage(error.message || "Impossible d'importer les pistes audio.");
    } finally {
      duplicateResolverRef.current?.({ action: 'cancel' });
      singleLinkResolverRef.current?.({ action: 'skip' });
      batchLinkResolverRef.current?.({ action: 'skip' });
      duplicateResolverRef.current = null;
      singleLinkResolverRef.current = null;
      batchLinkResolverRef.current = null;
      batchLinkPromptRef.current = null;
      setDuplicatePrompt(null);
      setSingleLinkPrompt(null);
      setBatchLinkPrompt(null);
      event.target.value = '';
      setIsImporting(false);
    }
  }

  function handlePlay(assetId: string, isCached: boolean) {
    if (!isOnline && !isCached) {
      setShakingAssetId(assetId);
      setTimeout(() => setShakingAssetId(null), 500);
      setImportMessage("Ce fichier n'est pas disponible hors ligne.");
      return;
    }

    if (currentTrack?.assetId === assetId && status === 'playing') {
      stop();
      return;
    }

    void playQueue(flatPlayableTracks, assetId);
  }

  function handleRequestDeleteAsset(assetId: string, filename: string) {
    if (!canWrite) return;
    setOpenTrackMenu(null);
    setDeletePrompt({ assetId, filename });
  }

  async function handleDeleteAsset() {
    if (!canWrite) return;
    if (!deletePrompt) {
      return;
    }

    setIsDeletingAsset(true);

    try {
      await songAssetsRepository.softDelete(deletePrompt.assetId);
      setImportMessage(null);
      setDeletePrompt(null);
    } catch (error: any) {
      setImportMessage(error?.message || "Impossible de supprimer cette piste audio.");
    } finally {
      setIsDeletingAsset(false);
    }
  }

  async function handleAssociateAsset(asset: ImportedTrack) {
    if (!canWrite) return;
    setOpenTrackMenu(null);
    const decision = await askSingleLinkDecision(asset.id, asset.filename);
    if (decision.action === 'link') {
      await linkAssetToSong(asset.id, decision.songId);
    }
  }

  function handleSetPrimaryTrack(songId: string, assetId: string) {
    if (!canWrite) return;
    localStorage.setItem(`fz-primary-track:${songId}`, assetId);
    setPrimaryTracks((prev) => ({
      ...prev,
      [songId]: assetId,
    }));
    setOpenTrackMenu(null);
  }

  function handleUnsetPrimaryTrack(songId: string) {
    if (!canWrite) return;
    localStorage.removeItem(`fz-primary-track:${songId}`);
    setPrimaryTracks((prev) => {
      const next = { ...prev };
      delete next[songId];
      return next;
    });
    setOpenTrackMenu(null);
  }

  function handleToggleTrackCache(assetId: string, isCached: boolean) {
    setOpenTrackMenu(null);
    if (isCached) {
      void removeAsset(assetId);
      return;
    }

    void downloadAsset(activeWorkspaceId || 'default-workspace', assetId);
  }

  async function handleCreateSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || isCreatingSong) return;

    const title = newSongTitle.trim();
    if (!title) {
      setCreateSongError('Le titre est obligatoire.');
      return;
    }

    setIsCreatingSong(true);
    setCreateSongError(null);
    try {
      const song = await songsRepository.create({ title });
      setIsCreateSongOpen(false);
      setNewSongTitle('');
      navigate(`/songs/${song.id}`);
    } catch {
      setCreateSongError('Impossible de créer le morceau.');
    } finally {
      setIsCreatingSong(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <PageHeader
          icon={<FzIcon name="songs" usageId="page-header.songs" size="xl" />}
          title="Morceaux"
          actions={canWrite ? <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              aria-label={isImporting ? 'Import en cours' : 'Importer des fichiers audio'}
              title="Importer des fichiers audio"
              className="fz-button-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 text-white/70 transition hover:text-white disabled:opacity-60"
            >
              <FzIcon name="upload" usageId="page-header.songs.upload" />
            </button>
            <AddButton
              onClick={() => {
                setNewSongTitle('');
                setCreateSongError(null);
                setIsCreateSongOpen(true);
              }}
              aria-label="Créer un morceau"
            />
          </> : undefined}
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: 'Rechercher un morceau ou un audio...',
            'aria-label': 'Rechercher dans les morceaux',
          }}
          sortAction={<SortMenu
            value={sortMode}
            onChange={setSortMode}
            label="Trier les morceaux"
            filter={{
              label: 'Statut',
              value: statusFilter,
              onChange: (value) => setStatusFilter(value as SongStatus | 'all'),
              options: [
                { value: 'all', label: 'Tous les statuts' },
                { value: 'Idee', label: 'Idée' },
                { value: 'En cours', label: 'En cours' },
                { value: 'Pret', label: 'Prêt' },
              ],
            }}
          />}
        />
        {canWrite ? <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        /> : null}
        {importMessage ? <p className="mt-3 text-sm font-semibold text-orange-300">{importMessage}</p> : null}
        {isProgressPanelVisible ? (
          <div className="mt-3 rounded-[1rem] border border-white/8 bg-black/22 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/45">
                  {isImporting ? 'Import en cours' : 'Import termine'}
                </p>
              </div>
              {!isImporting ? (
                <button
                  type="button"
                  onClick={() => setIsImportProgressDismissed(true)}
                  aria-label="Fermer le panneau de progression"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <FzIcon name="close" usageId="imports.progress.close" size="sm" />
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3">
              {importProgressItems.map((progress) => (
                <div key={progress.id} className="rounded-[0.9rem] border border-white/8 bg-white/4 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{progress.fileName}</p>
                      <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/45">
                        Piste {progress.currentFileIndex}/{progress.totalFiles} - {progress.label}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/55">
                        {progress.phase === 'done'
                          ? 'Termine'
                          : progress.phase === 'queued'
                            ? 'En attente'
                            : progress.phase === 'error'
                              ? 'Erreur'
                              : 'En cours'}
                      </p>
                      <p className="mt-1 text-[0.72rem] font-black text-white/82">
                        {Math.round(getUnifiedProgress(progress))}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={getUnifiedProgress(progress)} tone={getProgressTone(progress)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {pendingAudioUploads && pendingAudioUploads.length > 0 ? (
          <div className="mt-3 space-y-2 rounded-[1rem] border border-amber-300/15 bg-amber-300/6 p-3.5">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-amber-200/75">
              Envois audio en attente
            </p>
            {pendingAudioUploads.map((pendingUpload) => (
              <div key={pendingUpload.id} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">{pendingUpload.filename}</p>
                  <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/50">
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
                  <FzIcon name="close" usageId="imports.pending-upload.remove" size="sm" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="border-y border-white/10">
        {songSummaries === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture des morceaux" description="Ouverture de la base locale..." />
        ) : visibleSongSummaries?.map((summary) => {
          const assets = importedTracks?.filter((asset) => asset.songId === summary.song.id) ?? [];
          const primaryAsset = assets.find((asset) => asset.id === primaryTracks[summary.song.id]) ?? assets[0];
          const isPlaying = primaryAsset?.id === currentTrack?.assetId && status === 'playing';
          const canPlay = primaryAsset && (isOnline || cachedAssetIds.has(primaryAsset.id));

          return (
            <ContentRow
              key={summary.song.id}
              mode="controls"
              to={`/songs/${summary.song.id}`}
              title={summary.song.title || 'Sans titre'}
              metadata={
                <>
                  <span className="block truncate">
                    {summary.song.bpm ? `${summary.song.bpm} BPM` : 'BPM --'}
                    {' · '}
                    {summary.song.key || 'Ton --'}
                    {' · '}
                    {formatSongDuration(summary.song.durationSeconds)}
                  </span>
                  <span className="mt-1 flex items-center gap-2 overflow-hidden text-[0.84rem] font-medium text-white/65">
                    <StatusPill
                      label={getSongStatusLabel(summary.song.status)}
                      tone={getSongStatusTone(summary.song.status)}
                    />
                    <span className="truncate">
                      {summary.song.lyrics.trim() ? '✓ Paroles' : '! Paroles manquantes'}
                      {' · '}
                      {summary.audioCount} audio{summary.audioCount > 1 ? 's' : ''}
                      {' · '}
                      {summary.setlistCount} setlist{summary.setlistCount > 1 ? 's' : ''}
                    </span>
                  </span>
                </>
              }
              trailing={
                primaryAsset ? (
                  <SongPlayButton
                    songTitle={summary.song.title}
                    assets={assets}
                    isPlaying={isPlaying}
                    canPlay={Boolean(canPlay)}
                    onPlay={() => handlePlay(primaryAsset.id, cachedAssetIds.has(primaryAsset.id))}
                    onChooseAudio={() => setAudioPicker({ songTitle: summary.song.title, assets })}
                  />
                ) : null
              }
            />
          );
        })}
      </section>

      <section className="space-y-5">
        {importedTracks === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture des audios non classés" description="Ouverture de la bibliotheque audio locale..." />
        ) : importedTracks.length === 0 && songSummaries?.length === 0 ? (
          <FeatureCard
            eyebrow="Audio"
            title="Aucune piste importee"
            description={canWrite ? 'Importe une ou plusieurs pistes audio pour creer automatiquement les chansons associees.' : 'Aucune piste audio disponible dans ce groupe.'}
          >
            {canWrite ? <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="fz-button-primary inline-flex w-full items-center justify-center gap-2 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] disabled:opacity-60"
            >
              <FzIcon name="upload" usageId="imports.empty.upload" size="sm" />
              Importer des pistes
            </button> : null}
          </FeatureCard>
        ) : visibleSongSummaries?.length === 0 && (statusFilter !== 'all' || filteredImportedTracks?.length === 0) ? (
          <FeatureCard
            eyebrow="Recherche"
            title="Aucune musique trouvee"
            description={`Aucun fichier ou aucune chanson ne correspond a « ${searchQuery.trim()} ».`}
          >
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="fz-button-primary w-full px-4 py-4 text-sm font-black uppercase tracking-[0.16em]"
            >
              Effacer la recherche
            </button>
          </FeatureCard>
        ) : (
          groupedTracks.map((group) => {
            if (group.songId) {
              const mainAsset = (group.assets.find((a) => a.id === primaryTracks[group.songId!]) || group.assets[0])!;
              const otherAssets = group.assets.filter((a) => a.id !== mainAsset.id);
              const isExpanded = !!expandedSongIds[group.songId];
              const isMainPrimary = primaryTracks[group.songId] === mainAsset.id;

              const renderAsset = (asset: ImportedTrack, isPrimary: boolean, isGrouped = false) => {
                const isCurrent = currentTrack?.assetId === asset.id;
                const isPlaying = isCurrent && status === 'playing';
                const isCached = cachedAssetIds.has(asset.id);
                const downloadProgress = downloadingAssetIds[asset.id];
                const isDownloading = downloadProgress !== undefined;
                const isGrayedOut = !isOnline && !isCached;

                return (
                  <article
                    key={asset.id}
                    className={[
                      isGrouped
                        ? 'border-b border-white/8 px-1 py-4 last:border-b-0'
                        : 'rounded-[1.2rem] border px-4 py-3.5 transition-all duration-200',
                      isGrouped
                        ? isCurrent ? 'bg-[color:var(--fz-accent)]/10' : ''
                        : isCurrent ? 'border-[color:var(--fz-accent)]/35 bg-[color:var(--fz-accent)]/10' : 'border-white/8 bg-white/5',
                      isGrayedOut ? 'opacity-40 grayscale' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handlePlay(asset.id, isCached)}
                        aria-label={`Lire ${asset.song?.title ?? asset.filename}`}
                        className={[
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                          isPlaying
                            ? 'bg-[var(--fz-accent)] text-white'
                            : 'bg-white text-[#111316] hover:bg-white/88',
                          shakingAssetId === asset.id
                            ? 'animate-fz-shake border-2 border-rose-500 bg-rose-500/20 text-rose-300'
                            : '',
                        ].join(' ')}
                      >
                        {isPlaying ? (
                          <FzIcon name="stop" usageId="imports.track.stop" size="sm" />
                        ) : (
                          <FzIcon name="play" usageId="imports.track.play" size="sm" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <h2 className="flex items-center gap-1.5 truncate text-[1.02rem] font-black tracking-tight text-white">
                          <span className="truncate">{asset.filename}</span>
                          {isPrimary && (
                            <span className="shrink-0 inline-flex items-center rounded-full border border-[color:var(--fz-accent)]/20 bg-[color:var(--fz-accent)]/15 px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.08em] text-[var(--fz-accent-strong)]">
                              Principal
                            </span>
                          )}
                        </h2>
                        <p className="mt-1 truncate text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/45">
                          {buildTrackSubtitle(asset)}
                        </p>
                      </div>
                      <div className="relative shrink-0 flex items-center gap-2">
                        {isCached ? (isDownloading ? (
                          <div className="flex h-7 w-7 items-center justify-center text-orange-400" title={`Mise en cache : ${downloadProgress}%`} aria-label={`Mise en cache : ${downloadProgress}%`}>
                            <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-orange-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </div>
                        ) : isCached ? (
                          <div className="flex h-7 w-7 items-center justify-center text-white/85" title="Disponible hors ligne" aria-label="Disponible hors ligne">
                            <FzIcon name="check" usageId="imports.track.cached" size="sm" />
                          </div>
                        ) : isOnline ? (
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/6 text-white/45"
                            title="Télécharger hors ligne"
                          >
                            <FzIcon name="download" usageId="imports.track.download" size="sm" />
                          </div>
                        ) : (
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full text-white/25"
                            title="Indisponible hors ligne"
                          >
                            <FzIcon name="download" usageId="imports.track.download-disabled" size="sm" />
                          </div>
                        )) : null}

                        <button
                          type="button"
                          onClick={() => setOpenTrackMenu((current) => current?.asset.id === asset.id ? null : {
                            asset,
                            ...(group.songId ? { songId: group.songId } : {}),
                            isPrimary,
                            isCached,
                            isOnline,
                          })}
                          aria-label="Actions du fichier audio"
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-white/75 transition hover:bg-white/10 hover:text-white"
                        >
                          <FzIcon name="menu" usageId="imports.track.menu" size="sm" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              };

              return (
                <div key={group.songId} className="border-y border-white/8">
                  <div className="px-1 pb-2 pt-5">
                    <h3 className="truncate text-[1.16rem] font-black tracking-tight text-white">
                      {group.songTitle}
                    </h3>
                  </div>
                  <div className="px-1">
                    {renderAsset(mainAsset, isMainPrimary, true)}

                    {otherAssets.length > 0 && (
                      <>
                        {isExpanded && (
                          <div className="space-y-2">
                            {otherAssets.map((asset) => {
                              const isAssetPrimary = primaryTracks[group.songId!] === asset.id;
                              return renderAsset(asset, isAssetPrimary, true);
                            })}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedSongIds((prev) => ({ ...prev, [group.songId!]: !prev[group.songId!] }))}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Masquer les pistes supplémentaires' : `Afficher les ${otherAssets.length} pistes supplémentaires`}
                          className="flex w-full items-center justify-center border-t border-white/6 px-3 py-3 text-white/60 transition hover:bg-white/5 hover:text-white"
                        >
                          <ChevronIcon isOpen={isExpanded} iconAuditId="e141b12888456545" />
                        </button>
                      </>
                    )}
                  </div>
                  <Link
                    to={`/songs/${group.songId}`}
                    className="ml-auto flex w-fit items-center gap-1 px-1 py-3 text-sm font-bold text-[var(--fz-accent)] transition hover:text-[var(--fz-accent-strong)] hover:underline"
                  >
                    Voir la chanson <span aria-hidden="true">→</span>
                  </Link>
                </div>
              );
            } else {
              // Unassociated group: show all
              return (
                <div key="unassociated" className="border-y border-white/8">
                  <div className="flex items-center justify-between px-1 pb-2 pt-5">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
                      {group.songTitle || 'Sans association'}
                    </h3>
                  </div>
                  <div className="px-1">
                    {group.assets.map((asset) => {
                      const isCurrent = currentTrack?.assetId === asset.id;
                      const isPlaying = isCurrent && status === 'playing';

                      return (
                        <article
                          key={asset.id}
                          className={[
                            'border-b border-white/8 px-1 py-4 last:border-b-0 transition-colors duration-200',
                            isCurrent ? 'bg-[color:var(--fz-accent)]/10' : '',
                            !isOnline && !cachedAssetIds.has(asset.id) ? 'opacity-40 grayscale' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handlePlay(asset.id, cachedAssetIds.has(asset.id))}
                              aria-label={`Lire ${asset.filename}`}
                              className={[
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                                isPlaying
                                  ? 'bg-[var(--fz-accent)] text-white'
                                  : 'bg-white text-[#111316] hover:bg-white/88',
                                shakingAssetId === asset.id
                                  ? 'animate-fz-shake border-2 border-rose-500 bg-rose-500/20 text-rose-300'
                                  : '',
                              ].join(' ')}
                            >
                              {isPlaying ? (
                                <FzIcon name="stop" usageId="imports.asset.stop" size="sm" />
                              ) : (
                                <FzIcon name="play" usageId="imports.asset.play" size="sm" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <h2 className="truncate text-[1.02rem] font-black tracking-tight text-white">{asset.filename}</h2>
                              <p className="mt-1 truncate text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/45">
                                {buildTrackSubtitle(asset)}
                              </p>
                            </div>
                            <div className="relative shrink-0 flex items-center gap-2">
                              {cachedAssetIds.has(asset.id) ? (downloadingAssetIds[asset.id] !== undefined ? (
                                <div className="flex h-7 w-7 items-center justify-center text-orange-400" title={`Mise en cache : ${downloadingAssetIds[asset.id]}%`} aria-label={`Mise en cache : ${downloadingAssetIds[asset.id]}%`}>
                                  <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-orange-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                </div>
                              ) : cachedAssetIds.has(asset.id) ? (
                                <div className="flex h-7 w-7 items-center justify-center text-white/85" title="Disponible hors ligne" aria-label="Disponible hors ligne">
                                  <FzIcon name="check" usageId="imports.asset.cached" size="sm" />
                                </div>
                              ) : isOnline ? (
                                <div
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/6 text-white/45"
                                  title="Télécharger hors ligne"
                                >
                                  <FzIcon name="download" usageId="imports.asset.download" size="sm" />
                                </div>
                              ) : (
                                <div
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/25"
                                  title="Indisponible hors ligne"
                                >
                                  <FzIcon name="download" usageId="imports.asset.download-disabled" size="sm" />
                                </div>
                              )) : null}

                              <button
                                type="button"
                                onClick={() => setOpenTrackMenu((current) => current?.asset.id === asset.id ? null : { asset, isPrimary: false, isCached: cachedAssetIds.has(asset.id), isOnline })}
                                aria-label="Actions du fichier audio"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-white/75 transition hover:bg-white/10 hover:text-white"
                              >
                                <FzIcon name="menu" usageId="imports.asset.menu" size="sm" />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            }
          })
        )}
      </section>

      {audioPicker ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAudioPicker(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="audio-picker-title"
            className="fz-card w-full max-w-md rounded-[1.25rem] p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--fz-text-muted)]">Choisir un audio</p>
                <h2 id="audio-picker-title" className="truncate text-lg font-black text-white">{audioPicker.songTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setAudioPicker(null)}
                aria-label="Fermer"
                className="fz-dialog-close"
              >
                &times;
              </button>
            </div>
            <div className="divide-y divide-white/8 border-y border-white/8">
              {audioPicker.assets.map((asset) => {
                const isCached = cachedAssetIds.has(asset.id);
                const isAvailable = isOnline || isCached;
                const isPlaying = currentTrack?.assetId === asset.id && status === 'playing';

                return (
                  <button
                    key={asset.id}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      handlePlay(asset.id, isCached);
                      setAudioPicker(null);
                    }}
                    className="flex w-full items-center gap-3 px-1 py-4 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className={[
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      isPlaying ? 'bg-[var(--fz-accent)] text-white' : 'bg-white text-[#111316]',
                    ].join(' ')}>
                      {isPlaying ? <FzIcon name="stop" usageId="imports.picker.stop" size="sm" /> : <FzIcon name="play" usageId="imports.picker.play" size="sm" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-white">{asset.filename}</span>
                      <span className="mt-1 block text-xs font-medium text-[var(--fz-text-muted)]">{buildTrackSubtitle(asset)}</span>
                    </span>
                    {!isAvailable ? <span className="text-xs font-semibold text-white/45">Hors ligne</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {openTrackMenu ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpenTrackMenu(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="track-actions-title"
            className="fz-card w-full max-w-md rounded-[1.6rem] p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="track-actions-title" className="truncate text-[1.28rem] font-black tracking-tight text-white">Audio</h2>
              <button
                type="button"
                onClick={() => setOpenTrackMenu(null)}
                aria-label="Fermer"
                className="fz-dialog-close"
              >
                <FzIcon name="close" usageId="imports.track-menu.close" size="md" />
              </button>
            </div>
            <div className="mb-4 flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setOpenTrackMenu(null);
                  handlePlay(openTrackMenu.asset.id, openTrackMenu.isCached);
                }}
                aria-label={currentTrack?.assetId === openTrackMenu.asset.id && status === 'playing'
                  ? `Arreter ${openTrackMenu.asset.filename}`
                  : `Lire ${openTrackMenu.asset.filename}`}
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition',
                  currentTrack?.assetId === openTrackMenu.asset.id && status === 'playing'
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-[#111316] hover:bg-white/88',
                ].join(' ')}
              >
                {currentTrack?.assetId === openTrackMenu.asset.id && status === 'playing' ? (
                  <FzIcon name="stop" usageId="imports.track-menu.stop" size="sm" />
                ) : (
                  <FzIcon name="play" usageId="imports.track-menu.play" size="sm" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenTrackMenu(null);
                  handlePlay(openTrackMenu.asset.id, openTrackMenu.isCached);
                }}
                className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-white"
              >
                {openTrackMenu.asset.filename}
              </button>
            </div>
            <div className="space-y-2 border-t border-white/8 pt-4">
              {canWrite ? <button
                type="button"
                onClick={() => void handleAssociateAsset(openTrackMenu.asset)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-white transition hover:bg-white/10"
              >
                <FzIcon name="edit" usageId="imports.track-menu.associate" size="md" className="shrink-0 text-white/70" />
                <span>Associer à une chanson</span>
              </button> : null}
              <button
                type="button"
                disabled={!openTrackMenu.isCached && !openTrackMenu.isOnline}
                onClick={() => handleToggleTrackCache(openTrackMenu.asset.id, openTrackMenu.isCached)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {openTrackMenu.isCached ? (
                  <FzIcon name="delete" usageId="imports.track-menu.remove-cache" size="md" className="shrink-0 text-white/70" />
                ) : (
                  <FzIcon name="download" usageId="imports.track-menu.download" size="md" className="shrink-0 text-white/70" />
                )}
                <span>{openTrackMenu.isCached ? 'Supprimer du cache' : 'Mettre en cache hors ligne'}</span>
              </button>
              {canWrite && openTrackMenu.songId ? (
                <button
                  type="button"
                  onClick={() => openTrackMenu.isPrimary
                    ? handleUnsetPrimaryTrack(openTrackMenu.songId!)
                    : handleSetPrimaryTrack(openTrackMenu.songId!, openTrackMenu.asset.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-white transition hover:bg-white/10"
                >
                  <FzIcon name="check" usageId="imports.track-menu.primary" size="md" className="shrink-0 text-white/70" />
                  <span>{openTrackMenu.isPrimary ? 'Ne plus définir comme principal' : 'Définir comme principal'}</span>
                </button>
              ) : null}
              {canWrite ? <button
                type="button"
                onClick={() => handleRequestDeleteAsset(openTrackMenu.asset.id, openTrackMenu.asset.filename)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-rose-400/10 bg-rose-500/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-rose-300 transition hover:bg-rose-500/12"
              >
                <FzIcon name="delete" usageId="imports.track-menu.delete" size="md" className="shrink-0" />
                <span>Supprimer</span>
              </button> : null}
            </div>
          </div>
        </div>
      ) : null}

      {isCreateSongOpen ? (
        <FormDialog title="Nouveau morceau" onClose={() => !isCreatingSong && setIsCreateSongOpen(false)}>
          <form className="space-y-4" onSubmit={handleCreateSong}>
            <label className="block">
              <FieldLabel>Titre</FieldLabel>
              <TextField
                value={newSongTitle}
                onChange={(event) => {
                  setNewSongTitle(event.target.value);
                  setCreateSongError(null);
                }}
                placeholder="Ex. Last Train Home"
                autoFocus
                disabled={isCreatingSong}
              />
            </label>

            {createSongError ? <p className="text-sm font-semibold text-rose-400">{createSongError}</p> : null}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateSongOpen(false)}
                disabled={isCreatingSong}
                className="fz-button-secondary flex-1 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-white disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isCreatingSong || !newSongTitle.trim()}
                className="fz-button-primary flex-1 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] disabled:opacity-50"
              >
                {isCreatingSong ? 'Création...' : 'Créer'}
              </button>
            </div>
          </form>
        </FormDialog>
      ) : null}

      {duplicatePrompt ? (
        <FormDialog
          title="Piste deja importee"
          closeLabel="Annuler l'import de cette piste"
          onClose={() => resolveDuplicatePrompt({ action: 'cancel' })}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--fz-text-muted)]">
              Le fichier <span className="font-black text-white">{duplicatePrompt.existingFilename}</span> existe deja dans les morceaux
              avec la chanson <span className="font-black text-white">{duplicatePrompt.existingTitle}</span>.
            </p>

            <label className="block">
              <FieldLabel>Nouveau nom</FieldLabel>
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

      {singleLinkPrompt ? (
        <FormDialog
          title="Lier a une chanson ?"
          closeLabel="Ne pas lier ce fichier"
          onClose={() => resolveSingleLinkPrompt({ action: 'skip' })}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--fz-text-muted)]">
              Voulez-vous lier <span className="font-black text-white">{singleLinkPrompt.filename}</span> a un morceau ?
            </p>

            {songs && songs.length > 0 ? (
              <label className="block">
                <FieldLabel>Chanson</FieldLabel>
                <SelectField
                  aria-label="Chanson à associer"
                  value={singleLinkPrompt.selectedSongId}
                  onChange={(event) =>
                    setSingleLinkPrompt({ ...singleLinkPrompt, selectedSongId: event.target.value, error: null })
                  }
                >
                  {songs.map((song) => (
                    <option key={song.id} value={song.id}>
                      {song.title || 'Sans titre'}
                    </option>
                  ))}
                </SelectField>
              </label>
            ) : (
              <p className="rounded-[1rem] border border-white/8 bg-white/5 p-3 text-sm text-white/60">
                Aucun morceau disponible.
              </p>
            )}

            {singleLinkPrompt.error ? <p className="text-sm font-semibold text-rose-400">{singleLinkPrompt.error}</p> : null}

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => void handleConfirmSingleLinkPrompt()}
                disabled={!songs || songs.length === 0}
                className="fz-button-primary px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em] disabled:opacity-50"
              >
                Lier
              </button>
              <button
                type="button"
                onClick={() => resolveSingleLinkPrompt({ action: 'skip' })}
                className="fz-button-secondary px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em] text-white"
              >
                Garder en musique seule
              </button>
            </div>
          </div>
        </FormDialog>
      ) : null}

      {batchLinkPrompt ? (
        <FormDialog
          title="Associer les pistes"
          closeLabel="Continuer sans associer"
          onClose={() => resolveBatchLinkPrompt('skip')}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--fz-text-muted)]">
              Choisissez les chansons a associer pendant que les pistes se telechargent. Vous pouvez laisser une piste sans association.
            </p>

            {songs && songs.length > 0 ? (
              <div className="space-y-3">
                {batchLinkPrompt.items.map((item) => (
                  <div key={item.id} className="rounded-[1rem] border border-white/8 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{item.filename}</p>
                        <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/45">
                          {item.status === 'ready'
                            ? 'Pret a associer'
                            : item.status === 'error'
                              ? 'Import en erreur'
                              : 'Upload en cours'}
                        </p>
                      </div>
                    </div>

                    <label className="mt-3 block">
                      <FieldLabel>Chanson</FieldLabel>
                      <SelectField
                        aria-label={`Chanson à associer à ${item.filename}`}
                        value={item.selectedSongId}
                        onChange={(event) =>
                          updateBatchLinkPromptItem(item.id, (currentItem) => ({
                            ...currentItem,
                            selectedSongId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Garder en musique seule</option>
                        {songs.map((song) => (
                          <option key={song.id} value={song.id}>
                            {song.title || 'Sans titre'}
                          </option>
                        ))}
                      </SelectField>
                    </label>

                    {item.error ? <p className="mt-2 text-sm font-semibold text-rose-400">{item.error}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-[1rem] border border-white/8 bg-white/5 p-3 text-sm text-white/60">
                Aucun morceau disponible. Les uploads continuent, puis les pistes resteront dans les audios non classés.
              </p>
            )}

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => resolveBatchLinkPrompt('confirm')}
                className="fz-button-primary px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em]"
              >
                Valider les associations
              </button>
              <button
                type="button"
                onClick={() => resolveBatchLinkPrompt('skip')}
                className="fz-button-secondary px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em] text-white"
              >
                Continuer sans associer
              </button>
            </div>
          </div>
        </FormDialog>
      ) : null}

      <ConfirmDialog
        isOpen={canWrite && deletePrompt !== null}
        title="Voulez-vous supprimer ce fichier audio ?"
        description={
          deletePrompt
            ? `Le fichier ${deletePrompt.filename} sera retire des audios non classés sur cet appareil apres confirmation.`
            : ''
        }
        confirmLabel="Supprimer"
        isBusy={isDeletingAsset}
        onCancel={() => {
          if (!isDeletingAsset) {
            setDeletePrompt(null);
          }
        }}
        onConfirm={handleDeleteAsset}
      />
    </div>
  );
}
