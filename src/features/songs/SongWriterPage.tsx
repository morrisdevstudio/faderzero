import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type SVGProps } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormDialog } from '@/components/FormDialog';
import { songsRepository } from '@/db/repositories/songsRepository';
import {
  createEmptySongDocument,
  deriveSongTitle,
  normalizeSongDocument,
  songDocumentToText,
  type SongDocumentV1,
} from '@/db/songDocument';
import { SongEditor } from '@/features/songs/editor/SongEditor';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { useAuthStore } from '@/stores/authStore';

type IconProps = SVGProps<SVGSVGElement>;
type LocalSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function BackIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  const [offsetTop, setOffsetTop] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    function updateInset() {
      if (!viewport) {
        return;
      }
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
      setOffsetTop(Math.max(0, Math.round(viewport.offsetTop)));
    }

    updateInset();
    viewport.addEventListener('resize', updateInset);
    viewport.addEventListener('scroll', updateInset);
    return () => {
      viewport.removeEventListener('resize', updateInset);
      viewport.removeEventListener('scroll', updateInset);
    };
  }, []);

  return { inset, offsetTop };
}

function requestPersistentStorage() {
  try {
    if (localStorage.getItem('fz-writing-storage-persist-requested') === 'true') {
      return;
    }
    localStorage.setItem('fz-writing-storage-persist-requested', 'true');
    void navigator.storage?.persist?.().catch(() => false);
  } catch {
    // Persistence is an optional resilience enhancement.
  }
}

export function SongWriterPage() {
  const { songId = '' } = useParams();
  const isDraft = songId === 'new';
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const activeWorkspaceId = activeWorkspace?.id;
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const isOnline = useOnlineStatus();
  const song = useLiveQuery(
    () => isDraft ? undefined : songsRepository.getById(songId),
    [songId, activeWorkspaceId, isDraft],
  );
  const { inset: keyboardInset, offsetTop: viewportOffsetTop } = useKeyboardInset();
  const [title, setTitle] = useState('');
  const [localSaveState, setLocalSaveState] = useState<LocalSaveState>('idle');
  const [isDraftSaveOpen, setIsDraftSaveOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const initializedSongIdRef = useRef('');
  const draftDocumentRef = useRef(createEmptySongDocument());
  const documentRef = useRef<SongDocumentV1 | null>(isDraft ? draftDocumentRef.current : null);
  const titleRef = useRef('');
  const changeVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (isDraft || !song || initializedSongIdRef.current === song.id) {
      return;
    }

    initializedSongIdRef.current = song.id;
    documentRef.current = normalizeSongDocument(song.lyricsDocument, song.lyrics);
    titleRef.current = song.title;
    setTitle(song.title);
  }, [isDraft, song]);

  const performSave = useCallback(async () => {
    if (!song || !documentRef.current || changeVersionRef.current <= savedVersionRef.current) {
      return;
    }

    const targetVersion = changeVersionRef.current;
    const documentSnapshot = documentRef.current;
    const derivedTitle = titleRef.current.trim() || deriveSongTitle(documentSnapshot);
    setLocalSaveState('saving');

    if (derivedTitle !== titleRef.current) {
      titleRef.current = derivedTitle;
      setTitle(derivedTitle);
    }

    try {
      await songsRepository.update(song.id, {
        title: derivedTitle,
        lyricsDocument: documentSnapshot,
      });
      savedVersionRef.current = targetVersion;
      setLocalSaveState(changeVersionRef.current > targetVersion ? 'dirty' : 'saved');
      requestPersistentStorage();
    } catch {
      setLocalSaveState('error');
    }
  }, [song]);

  const flush = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveChainRef.current = saveChainRef.current.then(performSave);
    return saveChainRef.current;
  }, [performSave]);

  const scheduleSave = useCallback(() => {
    changeVersionRef.current += 1;
    setLocalSaveState('dirty');
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flush();
    }, 250);
  }, [flush]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void flush();
      }
    }

    function handlePageHide() {
      void flush();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      void flush();
    };
  }, [flush]);

  async function handleBack() {
    if (isDraft) {
      const draftDocument = documentRef.current ?? draftDocumentRef.current;
      if (!songDocumentToText(draftDocument).trim()) {
        navigate('/songs');
        return;
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setDraftTitle('');
      setDraftSaveError(null);
      setIsDraftSaveOpen(true);
      return;
    }

    await flush();
    navigate(`/songs/${songId}`);
  }

  function handleDocumentChange(nextDocument: SongDocumentV1) {
    documentRef.current = nextDocument;
    if (!isDraft) {
      scheduleSave();
    }
  }

  function handleTitleChange(nextTitle: string) {
    titleRef.current = nextTitle;
    setTitle(nextTitle);
    scheduleSave();
  }

  async function handleCreateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      setDraftSaveError('Le titre est obligatoire.');
      return;
    }

    setIsCreatingDraft(true);
    setDraftSaveError(null);
    try {
      const createdSong = await songsRepository.create({
        title: trimmedTitle,
        lyricsDocument: documentRef.current ?? draftDocumentRef.current,
      });
      navigate(`/songs/${createdSong.id}`);
    } catch {
      setDraftSaveError("Impossible d'enregistrer la chanson.");
      setIsCreatingDraft(false);
    }
  }

  if (!isDraft && song === undefined) {
    return <div className="fz-writer-state">Ouverture du morceau…</div>;
  }

  if (!isDraft && (!song || song.deletedAt !== undefined)) {
    return (
      <div className="fz-writer-state">
        <p>Ce morceau n’est plus disponible.</p>
        <button type="button" onClick={() => navigate('/songs')}>Retour au répertoire</button>
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="fz-writer-state">
        <p>Tu peux consulter ce morceau, mais pas modifier ses paroles.</p>
        <button type="button" onClick={() => navigate(isDraft ? '/songs' : `/songs/${song?.id}`)}>Retour au morceau</button>
      </div>
    );
  }

  const saveLabel =
    isDraft
      ? 'Brouillon'
      : localSaveState === 'saving'
      ? 'Enregistrement…'
      : localSaveState === 'error'
        ? 'Non enregistré'
        : !isOnline && (localSaveState === 'saved' || song?.syncStatus === 'pending')
          ? 'Enregistré hors ligne'
          : song?.syncStatus === 'synced' && localSaveState !== 'dirty'
            ? 'Synchronisé'
            : localSaveState === 'dirty'
              ? 'Modification…'
              : song?.syncStatus === 'conflict'
                ? 'Conflit'
                : 'Synchronisation…';
  const statusTone =
    localSaveState === 'error' || song?.syncStatus === 'conflict'
      ? 'error'
      : song?.syncStatus === 'synced' && localSaveState !== 'dirty' && localSaveState !== 'saving'
        ? 'success'
        : 'neutral';
  const pageStyle = {
    '--fz-writer-keyboard-inset': `${keyboardInset}px`,
    '--fz-writer-viewport-offset-top': `${viewportOffsetTop}px`,
  } as CSSProperties;

  return (
    <div className="fz-writer-page" style={pageStyle}>
      <header className="fz-writer-header">
        <button type="button" onClick={() => void handleBack()} aria-label="Retour au morceau">
          <BackIcon />
        </button>
        {isDraft ? (
          <div className="fz-writer-draft-title">Nouvelle chanson</div>
        ) : (
          <input
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            placeholder="Sans titre"
            aria-label="Titre du morceau"
          />
        )}
        <div className={`fz-writer-status is-${statusTone}`} aria-live="polite" title={saveLabel}>
          <CheckIcon />
          <span>{saveLabel}</span>
        </div>
      </header>

      <main>
        <SongEditor
          initialDocument={
            isDraft
              ? draftDocumentRef.current
              : normalizeSongDocument(song?.lyricsDocument, song?.lyrics)
          }
          onChange={handleDocumentChange}
        />
      </main>

      {isDraft && isDraftSaveOpen ? (
        <FormDialog
          title="Enregistrer la chanson ?"
          closeLabel="Continuer à écrire"
          onClose={() => setIsDraftSaveOpen(false)}
        >
          <form className="space-y-4" onSubmit={(event) => void handleCreateDraft(event)}>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
                Titre
              </span>
              <input
                value={draftTitle}
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  setDraftSaveError(null);
                }}
                placeholder="Titre de la chanson"
                autoFocus
                disabled={isCreatingDraft}
                className="fz-input text-sm"
              />
            </label>

            {draftSaveError ? <p className="text-sm font-semibold text-rose-400">{draftSaveError}</p> : null}

            <div className="flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={isCreatingDraft}
                className="fz-button-primary w-full px-4 py-3 text-sm font-black disabled:opacity-60"
              >
                {isCreatingDraft ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/songs')}
                disabled={isCreatingDraft}
                className="fz-button-secondary w-full px-4 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                Quitter sans enregistrer
              </button>
            </div>
          </form>
        </FormDialog>
      ) : null}
    </div>
  );
}
