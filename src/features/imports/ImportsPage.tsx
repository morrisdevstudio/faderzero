import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import { SortMenu, type SortMode } from '@/components/SortMenu';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import type { AudioTrack } from '@/features/audio/audioPlayerStore';
import { useAudioPlayerStore } from '@/features/audio/audioPlayerStore';
import { buildCompressedFileName } from '@/features/songs/audioCompression';
import { formatSongDuration } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { uploadSongAsset, type SongAssetUploadProgress } from '@/services/supabase/storage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAudioCacheStore } from '@/features/audio/audioCacheStore';
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

interface ImportProgressState {
  id: string;
  fileName: string;
  currentFileIndex: number;
  totalFiles: number;
  phase: SongAssetUploadProgress['phase'] | 'preparing' | 'done' | 'error';
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

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function DownloadCloudIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 13v8M8 17l4 4 4-4" />
      <path d="M20.38 8.57A9 9 0 0 0 4 9.08a7 7 0 0 0 .37 13.89" />
    </svg>
  );
}

function CachedIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v7" />
      <path d="m9.3 12.2 2.7 2.7 2.7-2.7" />
    </svg>
  );
}

function LinkSongIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
    </svg>
  );
}

function RemoveCacheIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6.7 6.7A7 7 0 0 0 4 20h13" />
      <path d="M9.2 4.2A9 9 0 0 1 20 15.4" />
      <path d="m5 5 14 14" />
    </svg>
  );
}

function PrimaryIcon({ active, ...props }: IconProps & { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </svg>
  );
}

function TrashIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="m6 7 1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronIcon({ className, isOpen }: { className?: string; isOpen: boolean }) {
  return (
    <svg
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

export function ImportsPage() {
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const importedTracks = useLiveQuery(() => songAssetsRepository.listImportedTracks(), [activeWorkspaceId]);
  const songs = useLiveQuery(() => songsRepository.list(), [activeWorkspaceId]);
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
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importProgressItems, setImportProgressItems] = useState<ImportProgressState[]>([]);
  const [isImportProgressDismissed, setIsImportProgressDismissed] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePromptState | null>(null);
  const [singleLinkPrompt, setSingleLinkPrompt] = useState<SingleLinkPromptState | null>(null);
  const [batchLinkPrompt, setBatchLinkPrompt] = useState<BatchLinkPromptState | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<DeletePromptState | null>(null);
  const [isDeletingAsset, setIsDeletingAsset] = useState(false);
  const [openTrackMenu, setOpenTrackMenu] = useState<TrackMenuState | null>(null);
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
    if (!openTrackMenu) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenTrackMenu(null);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openTrackMenu]);
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
  const playableTracks = (() => {
    if (!filteredImportedTracks) return [];

    const groupsMap = new Map<string, { songId?: string; songTitle?: string; assets: ImportedTrack[]; latestUpdatedAt: number }>();
    const unassociatedAssets: ImportedTrack[] = [];

    for (const asset of filteredImportedTracks) {
      if (asset.songId && asset.song) {
        const existing = groupsMap.get(asset.songId);
        if (existing) {
          existing.assets.push(asset);
          existing.latestUpdatedAt = Math.max(existing.latestUpdatedAt, asset.updatedAt, asset.song.updatedAt);
        } else {
          groupsMap.set(asset.songId, {
            songId: asset.songId,
            songTitle: asset.song.title,
            assets: [asset],
            latestUpdatedAt: Math.max(asset.updatedAt, asset.song.updatedAt),
          });
        }
      } else {
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

    const sortedSongGroups = Array.from(groupsMap.values())
      .map((group) => ({ ...group, assets: sortAssets(group.assets) }))
      .sort((left, right) => {
        if (sortMode === 'title-asc' || sortMode === 'title-desc') {
          const comparison = (left.songTitle ?? '').localeCompare(right.songTitle ?? '', 'fr', { sensitivity: 'base' });
          return sortMode === 'title-asc' ? comparison : -comparison;
        }

        const comparison = left.latestUpdatedAt - right.latestUpdatedAt;
        return sortMode === 'updated-asc' ? comparison : -comparison;
      });

    const groups: Array<{ songId?: string; songTitle?: string; assets: ImportedTrack[] }> = [...sortedSongGroups];
    if (unassociatedAssets.length > 0) {
      groups.push({
        songTitle: 'Sans association',
        assets: sortAssets(unassociatedAssets),
      });
    }

    return groups;
  })();

  const groupedTracks = playableTracks; // Alias for clarity in rendering
  const flatPlayableTracks = groupedTracks.flatMap((g) => {
    if (!g.songId) return g.assets;
    const mainAsset = (g.assets.find((a) => a.id === primaryTracks[g.songId!]) || g.assets[0])!;
    const otherAssets = g.assets.filter((a) => a.id !== mainAsset.id);
    return [mainAsset, ...otherAssets];
  }).map(toTrack);
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
    if (progress.phase === 'done') {
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
    if (progress.phase === 'done') {
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
      const reservedFilenames = new Set(existingTracksByFilename.keys());
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
            const assetId = await uploadSongAsset(workspaceId, undefined, preparedImport.file, {
              filename: preparedImport.filename,
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
              phase: 'done',
              compressionProgress: 100,
              uploadProgress: 100,
              label: 'Import termine',
            });
            updateBatchLinkPromptItem(preparedImport.id, (currentItem) => ({
              ...currentItem,
              status: 'ready',
              error: null,
            }));

            return { id: preparedImport.id, filename: preparedImport.filename, assetId, success: true as const };
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
      const successfulResultsById = new Map(
        successfulResults.map((result) => [result.id, result.assetId] as const)
      );

      if (batchDecision.action === 'confirm') {
        for (const item of batchDecision.items) {
          if (!item.selectedSongId) {
            continue;
          }

          const assetId = successfulResultsById.get(item.id);
          if (assetId) {
            await linkAssetToSong(assetId, item.selectedSongId);
          }
        }
      }

      const importedCount = successfulResults.length;
      const failedCount = uploadResults.length - importedCount;
      setImportMessage(
        `${importedCount} piste${importedCount > 1 ? 's' : ''} importee${importedCount > 1 ? 's' : ''}` +
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
    setOpenTrackMenu(null);
    setDeletePrompt({ assetId, filename });
  }

  async function handleDeleteAsset() {
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
    setOpenTrackMenu(null);
    const decision = await askSingleLinkDecision(asset.id, asset.filename);
    if (decision.action === 'link') {
      await linkAssetToSong(asset.id, decision.songId);
    }
  }

  function handleSetPrimaryTrack(songId: string, assetId: string) {
    localStorage.setItem(`fz-primary-track:${songId}`, assetId);
    setPrimaryTracks((prev) => ({
      ...prev,
      [songId]: assetId,
    }));
    setOpenTrackMenu(null);
  }

  function handleUnsetPrimaryTrack(songId: string) {
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

  return (
    <div className="space-y-4">
      <section
        className="sticky z-30 -mx-1 -mt-5 border-b border-white/8 bg-[var(--fz-bg)] px-1 pb-3 pt-2"
        style={{ top: 'calc(var(--fz-header-height, 64px) + var(--fz-viewport-offset-top, 0px))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-[2rem] font-black tracking-tight text-white">Musiques</h1>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            aria-label={isImporting ? 'Import en cours' : 'Importer des pistes'}
            className="fz-button-primary inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 disabled:opacity-60"
          >
            <UploadIcon />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Rechercher un fichier ou une chanson..."
            aria-label="Rechercher dans les musiques"
            className="fz-input min-w-0 flex-1 text-sm"
          />
          <SortMenu value={sortMode} onChange={setSortMode} label="Trier les musiques" />
        </div>
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
                  <CloseIcon />
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
                        {progress.phase === 'done' ? 'Termine' : progress.phase === 'error' ? 'Erreur' : 'En cours'}
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
      </section>

      <section className="space-y-3">
        {importedTracks === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture des musiques" description="Ouverture de la bibliotheque audio locale..." />
        ) : importedTracks.length === 0 ? (
          <FeatureCard
            eyebrow="Audio"
            title="Aucune piste importee"
            description="Importe une ou plusieurs pistes audio pour creer automatiquement les chansons associees."
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="fz-button-primary inline-flex w-full items-center justify-center gap-2 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] disabled:opacity-60"
            >
              <UploadIcon />
              Importer des pistes
            </button>
          </FeatureCard>
        ) : filteredImportedTracks?.length === 0 ? (
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
                        ? isCurrent ? 'bg-orange-500/10' : ''
                        : isCurrent ? 'border-orange-400/35 bg-orange-500/10' : 'border-white/8 bg-white/5',
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
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-[#111316] hover:bg-white/88',
                          shakingAssetId === asset.id
                            ? 'animate-fz-shake border-2 border-rose-500 bg-rose-500/20 text-rose-300'
                            : '',
                        ].join(' ')}
                      >
                        {isPlaying ? (
                          <StopIcon />
                        ) : (
                          <PlayIcon />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <h2 className="flex items-center gap-1.5 truncate text-[1.02rem] font-black tracking-tight text-white">
                          <span className="truncate">{asset.filename}</span>
                          {isPrimary && (
                            <span className="shrink-0 inline-flex items-center rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.08em] text-orange-400 border border-orange-500/12">
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
                            <CachedIcon className="h-4 w-4" />
                          </div>
                        ) : isOnline ? (
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/6 text-white/45"
                            title="Télécharger hors ligne"
                          >
                            <DownloadCloudIcon className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full text-white/25"
                            title="Indisponible hors ligne"
                          >
                            <DownloadCloudIcon className="h-3.5 w-3.5" />
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
                          <DotsIcon />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              };

              return (
                <div key={group.songId} className="overflow-hidden rounded-[1.35rem] border border-white/8 bg-white/5">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
                      {group.songTitle}
                    </h3>
                    <Link
                      to={`/songs/${group.songId}`}
                      className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--fz-accent)] hover:underline"
                    >
                      Voir la chanson
                    </Link>
                  </div>
                  <div className="px-3">
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
                          className="-mx-3 flex w-[calc(100%+1.5rem)] items-center justify-center border-t border-white/6 px-3 py-3 text-white/60 transition hover:bg-white/5 hover:text-white"
                        >
                          <ChevronIcon isOpen={isExpanded} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            } else {
              // Unassociated group: show all
              return (
                <div key="unassociated" className="space-y-2">
                  <div className="flex items-center justify-between px-1 pt-2">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
                      {group.songTitle || 'Sans association'}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {group.assets.map((asset) => {
                      const isCurrent = currentTrack?.assetId === asset.id;
                      const isPlaying = isCurrent && status === 'playing';

                      return (
                        <article
                          key={asset.id}
                          className={[
                            'rounded-[1.2rem] border px-4 py-3.5 transition-all duration-200',
                            isCurrent ? 'border-orange-400/35 bg-orange-500/10' : 'border-white/8 bg-white/5',
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
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-white text-[#111316] hover:bg-white/88',
                                shakingAssetId === asset.id
                                  ? 'animate-fz-shake border-2 border-rose-500 bg-rose-500/20 text-rose-300'
                                  : '',
                              ].join(' ')}
                            >
                              {isPlaying ? (
                                <StopIcon />
                              ) : (
                                <PlayIcon />
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
                                  <CachedIcon className="h-4 w-4" />
                                </div>
                              ) : isOnline ? (
                                <div
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/6 text-white/45"
                                  title="Télécharger hors ligne"
                                >
                                  <DownloadCloudIcon className="h-3.5 w-3.5" />
                                </div>
                              ) : (
                                <div
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/25"
                                  title="Indisponible hors ligne"
                                >
                                  <DownloadCloudIcon className="h-3.5 w-3.5" />
                                </div>
                              )) : null}

                              <button
                                type="button"
                                onClick={() => setOpenTrackMenu((current) => current?.asset.id === asset.id ? null : { asset, isPrimary: false, isCached: cachedAssetIds.has(asset.id), isOnline })}
                                aria-label="Actions du fichier audio"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-white/75 transition hover:bg-white/10 hover:text-white"
                              >
                                <DotsIcon />
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
                &times;
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
                {currentTrack?.assetId === openTrackMenu.asset.id && status === 'playing' ? <StopIcon /> : <PlayIcon />}
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
              <button
                type="button"
                onClick={() => void handleAssociateAsset(openTrackMenu.asset)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-white transition hover:bg-white/10"
              >
                <LinkSongIcon className="h-5 w-5 shrink-0 text-white/70" />
                <span>Associer à une chanson</span>
              </button>
              <button
                type="button"
                disabled={!openTrackMenu.isCached && !openTrackMenu.isOnline}
                onClick={() => handleToggleTrackCache(openTrackMenu.asset.id, openTrackMenu.isCached)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {openTrackMenu.isCached ? (
                  <RemoveCacheIcon className="h-5 w-5 shrink-0 text-white/70" />
                ) : (
                  <DownloadCloudIcon className="h-5 w-5 shrink-0 text-white/70" />
                )}
                <span>{openTrackMenu.isCached ? 'Supprimer du cache' : 'Mettre en cache hors ligne'}</span>
              </button>
              {openTrackMenu.songId ? (
                <button
                  type="button"
                  onClick={() => openTrackMenu.isPrimary
                    ? handleUnsetPrimaryTrack(openTrackMenu.songId!)
                    : handleSetPrimaryTrack(openTrackMenu.songId!, openTrackMenu.asset.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-white transition hover:bg-white/10"
                >
                  <PrimaryIcon active={openTrackMenu.isPrimary} className="h-5 w-5 shrink-0 text-white/70" />
                  <span>{openTrackMenu.isPrimary ? 'Ne plus définir comme principal' : 'Définir comme principal'}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleRequestDeleteAsset(openTrackMenu.asset.id, openTrackMenu.asset.filename)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-rose-400/10 bg-rose-500/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-rose-300 transition hover:bg-rose-500/12"
              >
                <TrashIcon className="h-5 w-5 shrink-0" />
                <span>Supprimer</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {duplicatePrompt ? (
        <FormDialog
          title="Piste deja importee"
          closeLabel="Annuler l'import de cette piste"
          onClose={() => resolveDuplicatePrompt({ action: 'cancel' })}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--fz-text-muted)]">
              Le fichier <span className="font-black text-white">{duplicatePrompt.existingFilename}</span> existe deja dans les musiques
              avec la chanson <span className="font-black text-white">{duplicatePrompt.existingTitle}</span>.
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

      {singleLinkPrompt ? (
        <FormDialog
          title="Lier a une chanson ?"
          closeLabel="Ne pas lier ce fichier"
          onClose={() => resolveSingleLinkPrompt({ action: 'skip' })}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--fz-text-muted)]">
              Voulez-vous lier <span className="font-black text-white">{singleLinkPrompt.filename}</span> a une chanson du repertoire ?
            </p>

            {songs && songs.length > 0 ? (
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">
                  Chanson
                </span>
                <select
                  value={singleLinkPrompt.selectedSongId}
                  onChange={(event) =>
                    setSingleLinkPrompt({ ...singleLinkPrompt, selectedSongId: event.target.value, error: null })
                  }
                  className="fz-input text-sm"
                >
                  {songs.map((song) => (
                    <option key={song.id} value={song.id}>
                      {song.title || 'Sans titre'}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="rounded-[1rem] border border-white/8 bg-white/5 p-3 text-sm text-white/60">
                Aucune chanson disponible dans le repertoire.
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
                      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">
                        Chanson
                      </span>
                      <select
                        value={item.selectedSongId}
                        onChange={(event) =>
                          updateBatchLinkPromptItem(item.id, (currentItem) => ({
                            ...currentItem,
                            selectedSongId: event.target.value,
                          }))
                        }
                        className="fz-input text-sm"
                      >
                        <option value="">Garder en musique seule</option>
                        {songs.map((song) => (
                          <option key={song.id} value={song.id}>
                            {song.title || 'Sans titre'}
                          </option>
                        ))}
                      </select>
                    </label>

                    {item.error ? <p className="mt-2 text-sm font-semibold text-rose-400">{item.error}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-[1rem] border border-white/8 bg-white/5 p-3 text-sm text-white/60">
                Aucune chanson disponible dans le repertoire. Les uploads continuent, puis les pistes resteront dans Musiques.
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
        isOpen={deletePrompt !== null}
        title="Voulez-vous supprimer ce fichier audio ?"
        description={
          deletePrompt
            ? `Le fichier ${deletePrompt.filename} sera retire des musiques sur cet appareil apres confirmation.`
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
