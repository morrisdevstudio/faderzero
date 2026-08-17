import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormDialog } from '@/components/FormDialog';
import { songsRepository } from '@/db/repositories/songsRepository';
import { buildCompressedFileName } from '@/features/songs/audioCompression';
import {
  uploadOrQueueSongAsset,
  type AudioUploadResult,
} from '@/services/audio/pendingUploads';
import type { SongAssetUploadProgress } from '@/services/supabase/storage';
import { useAuthStore } from '@/stores/authStore';
import { linkStagedRecording, type RecordingDestination } from './recordingWorkflow';
import {
  createDefaultRecordingName,
  formatRecordingDuration,
  getRecordingFileExtension,
  MAX_VOICE_RECORDING_DURATION_MS,
  VoiceRecorderEngine,
  type CapturedRecording,
  type RecorderState,
} from './voiceRecorderEngine';
import { VoiceMemoPlayer } from './VoiceMemoPlayer';
import { SearchField } from '@/ui/components/SearchField';
import { TextField } from '@/ui/components/TextField';

interface QuickVoiceRecorderProps {
  onClose: () => void;
  onComplete: (result: { message: string; songId?: string }) => void;
  directSongId?: string;
  directSongTitle?: string;
}

function MicrophoneIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

function formatProgress(progress: SongAssetUploadProgress) {
  return {
    value: progress.phase === 'compression' ? progress.progress * 0.55 : 55 + progress.progress * 0.45,
    label: progress.label,
  };
}

function normalizeRecordingName(value: string) {
  return value.trim().replace(/\.(mp3|m4a|mp4|webm|ogg)$/i, '').trim();
}

export function QuickVoiceRecorder({
  onClose,
  onComplete,
  directSongId,
  directSongTitle,
}: QuickVoiceRecorderProps) {
  const activeWorkspace = useAuthStore((current) => current.activeWorkspace);
  const activeWorkspaceId = activeWorkspace?.id;
  const songs = useLiveQuery(() => songsRepository.list(), [activeWorkspaceId]);
  const [recorderState, setRecorderState] = useState<RecorderState>('requesting');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [capturedRecording, setCapturedRecording] = useState<CapturedRecording | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordingName, setRecordingName] = useState(() => createDefaultRecordingName());
  const [destination, setDestination] = useState<RecordingDestination>(
    directSongId ? { type: 'existingSong', songId: directSongId } : { type: 'orphan' }
  );
  const [songQuery, setSongQuery] = useState('');
  const [newSongTitle, setNewSongTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState({ value: 0, label: '' });
  const [isDiscardConfirmationOpen, setIsDiscardConfirmationOpen] = useState(false);
  const [isAudioStaged, setIsAudioStaged] = useState(false);
  const engineRef = useRef<VoiceRecorderEngine | null>(null);
  const mountedRef = useRef(true);
  const previewUrlRef = useRef<string | null>(null);
  const stagedUploadRef = useRef<AudioUploadResult | null>(null);
  const stagedSongIdRef = useRef<string | null>(null);

  const replacePreviewUrl = useCallback((nextUrl: string | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }, []);

  const beginRecording = useCallback(async () => {
    engineRef.current?.cancel();
    engineRef.current = null;
    stagedUploadRef.current = null;
    stagedSongIdRef.current = null;
    replacePreviewUrl(null);
    setCapturedRecording(null);
    setRecordingName(createDefaultRecordingName());
    setDestination(directSongId ? { type: 'existingSong', songId: directSongId } : { type: 'orphan' });
    setNewSongTitle('');
    setSongQuery('');
    setIsAudioStaged(false);
    setProgress({ value: 0, label: '' });
    setElapsedMs(0);
    setAudioLevel(0);
    setErrorMessage(null);
    setRecorderState('requesting');

    const engine = new VoiceRecorderEngine({
      onElapsed: (value) => {
        if (mountedRef.current) setElapsedMs(value);
      },
      onLevel: (value) => {
        if (mountedRef.current) setAudioLevel(value);
      },
      onStopped: (recording) => {
        if (!mountedRef.current) return;
        engineRef.current = null;
        setCapturedRecording(recording);
        replacePreviewUrl(URL.createObjectURL(recording.blob));
        setRecorderState('review');
      },
      onError: (error) => {
        if (!mountedRef.current) return;
        engineRef.current = null;
        setErrorMessage(error.message);
        setRecorderState('error');
      },
    });
    engineRef.current = engine;

    try {
      await engine.start();
      if (mountedRef.current && engineRef.current === engine) {
        setRecorderState('recording');
      }
    } catch (error) {
      if (!mountedRef.current || engineRef.current !== engine) return;
      engineRef.current = null;
      setErrorMessage(error instanceof Error ? error.message : "Impossible de démarrer l'enregistrement.");
      setRecorderState('error');
    }
  }, [directSongId, replacePreviewUrl]);

  useEffect(() => {
    mountedRef.current = true;
    void beginRecording();

    return () => {
      mountedRef.current = false;
      engineRef.current?.cancel();
      engineRef.current = null;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [beginRecording]);

  const filteredSongs = useMemo(() => {
    const normalizedQuery = songQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return songs ?? [];
    return (songs ?? []).filter((song) =>
      [song.title, song.artist].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))
    );
  }, [songQuery, songs]);

  function requestClose() {
    if (recorderState === 'saving') return;
    if (recorderState === 'recording' || capturedRecording) {
      setIsDiscardConfirmationOpen(true);
      return;
    }
    engineRef.current?.cancel();
    onClose();
  }

  function confirmClose() {
    engineRef.current?.cancel();
    engineRef.current = null;
    setIsDiscardConfirmationOpen(false);
    onClose();
  }

  function openDestinationChoice() {
    const normalizedName = normalizeRecordingName(recordingName);
    if (!normalizedName) {
      setErrorMessage("Donnez un nom à l'enregistrement.");
      return;
    }
    setRecordingName(normalizedName);
    if (directSongId) {
      setDestination({ type: 'existingSong', songId: directSongId });
    }
    setNewSongTitle(normalizedName);
    setErrorMessage(null);
    setRecorderState('choosingDestination');
  }

  function chooseDestination(nextDestination: RecordingDestination) {
    setDestination(nextDestination);
    setErrorMessage(null);
    if (nextDestination.type === 'newSong' && !newSongTitle.trim()) {
      setNewSongTitle(normalizeRecordingName(recordingName));
    }
  }

  async function saveRecording() {
    if (!capturedRecording || !activeWorkspaceId) {
      setErrorMessage("Aucun espace actif ne permet de sauvegarder cet audio.");
      return;
    }

    const normalizedName = normalizeRecordingName(recordingName);
    if (!normalizedName) {
      setErrorMessage("Donnez un nom à l'enregistrement.");
      return;
    }
    const effectiveDestination: RecordingDestination = directSongId
      ? { type: 'existingSong', songId: directSongId }
      : destination;
    if (effectiveDestination.type === 'existingSong' && !effectiveDestination.songId) {
      setErrorMessage('Choisissez une chanson existante.');
      return;
    }
    if (effectiveDestination.type === 'newSong' && !newSongTitle.trim()) {
      setErrorMessage('Donnez un titre à la nouvelle chanson.');
      return;
    }

    setRecorderState('saving');
    setErrorMessage(null);
    const filename = buildCompressedFileName(normalizedName);

    try {
      let uploadResult = stagedUploadRef.current;
      if (!uploadResult) {
        const extension = getRecordingFileExtension(capturedRecording.mimeType);
        const sourceFile = new File(
          [capturedRecording.blob],
          `${normalizedName}.${extension}`,
          { type: capturedRecording.mimeType }
        );
        uploadResult = await uploadOrQueueSongAsset(activeWorkspaceId, undefined, sourceFile, {
          filename,
          normalizePeak: true,
          durationSeconds: Math.max(1, Math.ceil(capturedRecording.durationMs / 1000)),
          onProgress: (nextProgress) => setProgress(formatProgress(nextProgress)),
        });
        stagedUploadRef.current = uploadResult;
        setIsAudioStaged(true);
      }

      if (effectiveDestination.type === 'orphan') {
        onComplete({
          message: uploadResult.status === 'queued'
            ? 'Idée enregistrée hors ligne. Elle sera envoyée dès le retour du réseau.'
            : 'Idée enregistrée dans Musique.',
        });
        return;
      }

      let songId: string;
      if (effectiveDestination.type === 'newSong') {
        if (!stagedSongIdRef.current) {
          const song = await songsRepository.create({
            title: newSongTitle.trim(),
            status: 'Idee',
          });
          stagedSongIdRef.current = song.id;
        }
        songId = stagedSongIdRef.current;
      } else {
        songId = effectiveDestination.songId;
      }

      await linkStagedRecording(uploadResult, songId, {
        workspaceId: activeWorkspaceId,
        filename,
      });

      onComplete({
        message: directSongId
          ? `Audio enregistré et associé à ${directSongTitle || 'la chanson'}.`
          : effectiveDestination.type === 'newSong'
          ? 'Idée enregistrée et nouvelle chanson créée.'
          : 'Idée enregistrée et associée à la chanson.',
        ...(effectiveDestination.type === 'newSong' ? { songId } : {}),
      });
    } catch (error) {
      const errorDetails = getSaveErrorMessage(error);
      setErrorMessage(
        `${errorDetails}` +
        (stagedUploadRef.current ? " L'audio reste conservé comme piste orpheline." : '')
      );
      setRecorderState(directSongId ? 'review' : 'choosingDestination');
    }
  }

  const dialogTitle =
    recorderState === 'recording'
      ? 'Enregistrement en cours'
      : recorderState === 'review'
        ? 'Écouter votre idée'
        : directSongId && recorderState === 'saving'
          ? 'Associer l’audio'
          : recorderState === 'choosingDestination' || recorderState === 'saving'
          ? 'Ranger votre idée'
          : 'Magnéto';

  return (
    <>
      <FormDialog title={dialogTitle} closeLabel="Fermer le magnéto" onClose={requestClose} placement="bottom">
        {recorderState === 'requesting' ? (
          <div className="py-8 text-center" aria-live="polite">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <MicrophoneIcon className="h-7 w-7 animate-pulse" />
            </div>
            <p className="mt-5 text-sm font-black text-white">Autorisation du microphone…</p>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              Acceptez la demande du navigateur pour démarrer immédiatement.
            </p>
          </div>
        ) : null}

        {recorderState === 'recording' ? (
          <div className="space-y-6 text-center">
            <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full bg-red-500/20 transition-transform duration-100"
                style={{ transform: `scale(${1 + audioLevel * 0.24})` }}
                aria-hidden="true"
              />
              <span className="absolute inset-3 rounded-full bg-red-500/25" aria-hidden="true" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                <MicrophoneIcon className="h-8 w-8" />
              </div>
            </div>
            <div>
              <p className="font-mono text-4xl font-black tabular-nums text-white">
                {formatRecordingDuration(elapsedMs)}
              </p>
              <p className="mt-2 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/45">
                Limite {formatRecordingDuration(MAX_VOICE_RECORDING_DURATION_MS)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void engineRef.current?.stop()}
              className="fz-button-primary flex w-full items-center justify-center gap-3 px-5 py-4 text-sm font-black uppercase tracking-[0.16em]"
            >
              <span className="h-4 w-4 rounded-sm bg-white" aria-hidden="true" />
              Stop
            </button>
            <button
              type="button"
              onClick={() => setIsDiscardConfirmationOpen(true)}
              className="w-full py-2 text-xs font-black uppercase tracking-[0.14em] text-white/55"
            >
              Annuler
            </button>
          </div>
        ) : null}

        {recorderState === 'review' && capturedRecording && previewUrl ? (
          <div className="space-y-5">
            <VoiceMemoPlayer src={previewUrl} durationMs={capturedRecording.durationMs} />
            <label className="block">
              <span className="fz-field-label mb-2 block">
                Nom de l’audio
              </span>
              <TextField
                value={recordingName}
                onChange={(event) => setRecordingName(event.target.value)}
                disabled={isAudioStaged}
                maxLength={120}
                autoComplete="off"
              />
            </label>
            {errorMessage ? <p className="text-sm text-red-300" role="alert">{errorMessage}</p> : null}
            <button
              type="button"
              onClick={() => {
                if (directSongId) {
                  void saveRecording();
                  return;
                }
                openDestinationChoice();
              }}
              className="fz-button-primary w-full px-5 py-4 text-sm font-black uppercase tracking-[0.14em]"
            >
              {directSongId ? 'Enregistrer pour cette chanson' : 'Ranger cet audio'}
            </button>
            <button
              type="button"
              onClick={() => void beginRecording()}
              className="w-full rounded-xl border border-white/12 bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/75"
            >
              Refaire
            </button>
          </div>
        ) : null}

        {recorderState === 'saving' && directSongId && capturedRecording ? (
          <div className="space-y-5 py-2">
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.045] px-4 py-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                <MicrophoneIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white/55">Association en cours</p>
                <p className="truncate text-sm font-black text-white">{directSongTitle || 'Cette chanson'}</p>
              </div>
            </div>
            <div className="space-y-2" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-red-500 transition-[width]" style={{ width: `${progress.value}%` }} />
              </div>
              <p className="text-center text-xs font-bold text-white/55">{progress.label || 'Sauvegarde…'}</p>
            </div>
          </div>
        ) : null}

        {(recorderState === 'choosingDestination' || recorderState === 'saving') && !directSongId && capturedRecording ? (
          <div className="space-y-4">
            <label className="block">
              <span className="fz-field-label mb-2 block">
                Nom de l’audio
              </span>
              <TextField
                value={recordingName}
                onChange={(event) => setRecordingName(event.target.value)}
                disabled={recorderState === 'saving' || isAudioStaged}
                maxLength={120}
              />
            </label>

            <div className="grid gap-2" role="radiogroup" aria-label="Destination de l'enregistrement">
              <button
                type="button"
                role="radio"
                aria-checked={destination.type === 'existingSong'}
                onClick={() => chooseDestination({ type: 'existingSong', songId: songs?.[0]?.id ?? '' })}
                disabled={recorderState === 'saving'}
                className={[
                  'rounded-2xl border px-4 py-3 text-left transition',
                  destination.type === 'existingSong' ? 'border-red-400/65 bg-red-500/15' : 'border-white/10 bg-white/5',
                ].join(' ')}
              >
                <span className="block text-sm font-black text-white">Associer à une chanson</span>
                <span className="mt-1 block text-xs text-white/50">Choisir dans le répertoire</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={destination.type === 'newSong'}
                onClick={() => chooseDestination({ type: 'newSong', title: newSongTitle || recordingName })}
                disabled={recorderState === 'saving'}
                className={[
                  'rounded-2xl border px-4 py-3 text-left transition',
                  destination.type === 'newSong' ? 'border-red-400/65 bg-red-500/15' : 'border-white/10 bg-white/5',
                ].join(' ')}
              >
                <span className="block text-sm font-black text-white">Créer une nouvelle chanson</span>
                <span className="mt-1 block text-xs text-white/50">Créée au statut Idée</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={destination.type === 'orphan'}
                onClick={() => chooseDestination({ type: 'orphan' })}
                disabled={recorderState === 'saving'}
                className={[
                  'rounded-2xl border px-4 py-3 text-left transition',
                  destination.type === 'orphan' ? 'border-red-400/65 bg-red-500/15' : 'border-white/10 bg-white/5',
                ].join(' ')}
              >
                <span className="block text-sm font-black text-white">Créer un audio orphelin</span>
                <span className="mt-1 block text-xs text-white/50">Visible dans Musique, sans chanson</span>
              </button>
            </div>

            {destination.type === 'existingSong' ? (
              <div className="space-y-2">
                <SearchField
                  value={songQuery}
                  onChange={(event) => setSongQuery(event.target.value)}
                  placeholder="Rechercher une chanson"
                  disabled={recorderState === 'saving'}
                />
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-black/20 p-2">
                  {filteredSongs.length > 0 ? filteredSongs.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => setDestination({ type: 'existingSong', songId: song.id })}
                      className={[
                        'w-full rounded-lg px-3 py-2 text-left text-sm',
                        destination.songId === song.id ? 'bg-red-500/20 text-white' : 'text-white/70 hover:bg-white/6',
                      ].join(' ')}
                    >
                      <span className="block font-bold">{song.title}</span>
                      {song.artist ? <span className="block text-xs text-white/45">{song.artist}</span> : null}
                    </button>
                  )) : (
                    <p className="px-2 py-3 text-center text-xs text-white/45">Aucune chanson trouvée.</p>
                  )}
                </div>
              </div>
            ) : null}

            {destination.type === 'newSong' ? (
              <label className="block">
                <span className="fz-field-label mb-2 block">
                  Titre de la chanson
                </span>
                <TextField
                  value={newSongTitle}
                  onChange={(event) => {
                    setNewSongTitle(event.target.value);
                    setDestination({ type: 'newSong', title: event.target.value });
                  }}
                  disabled={recorderState === 'saving'}
                  maxLength={160}
                />
              </label>
            ) : null}

            {errorMessage ? <p className="text-sm leading-relaxed text-red-300" role="alert">{errorMessage}</p> : null}

            {recorderState === 'saving' ? (
              <div className="space-y-2" aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-red-500 transition-[width]" style={{ width: `${progress.value}%` }} />
                </div>
                <p className="text-center text-xs font-bold text-white/55">{progress.label || 'Sauvegarde…'}</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecorderState('review')}
                  className="flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white/70"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={() => void saveRecording()}
                  className="fz-button-primary flex-[1.5] px-4 py-3 text-xs font-black uppercase tracking-[0.12em]"
                >
                  Enregistrer
                </button>
              </div>
            )}
          </div>
        ) : null}

        {recorderState === 'error' ? (
          <div className="space-y-5 py-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <MicrophoneIcon className="h-7 w-7" />
            </div>
            <p className="text-sm leading-relaxed text-red-200" role="alert">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void beginRecording()}
              className="fz-button-primary w-full px-5 py-4 text-sm font-black uppercase tracking-[0.14em]"
            >
              Réessayer
            </button>
          </div>
        ) : null}
      </FormDialog>

      <ConfirmDialog
        isOpen={isDiscardConfirmationOpen}
        title={isAudioStaged ? 'Fermer le magnéto ?' : 'Supprimer cette prise ?'}
        description={
          isAudioStaged
            ? "L'audio déjà sauvegardé restera disponible comme piste orpheline dans Musique."
            : "La prise temporaire sera définitivement supprimée de cet appareil."
        }
        confirmLabel={isAudioStaged ? 'Fermer' : 'Supprimer'}
        cancelLabel="Continuer"
        onConfirm={confirmClose}
        onCancel={() => setIsDiscardConfirmationOpen(false)}
      />
    </>
  );
}

function getSaveErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return "Impossible de sauvegarder l'enregistrement.";
}
