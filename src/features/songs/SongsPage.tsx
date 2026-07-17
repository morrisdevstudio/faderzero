import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import { SortMenu, type SortMode } from '@/components/SortMenu';
import { StatusPill } from '@/components/StatusPill';
import { songsRepository } from '@/db/repositories/songsRepository';
import { formatSongDuration, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';

export function SongsPage() {
  const navigate = useNavigate();
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isVirtualKeyboardOpen, setIsVirtualKeyboardOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('title-asc');
  const songs = useLiveQuery(() => songsRepository.list({ query: searchQuery }), [searchQuery, activeWorkspaceId]);
  const shouldReleaseStickyHeader = isSearchFocused && isVirtualKeyboardOpen;
  const sortedSongs = songs
    ? [...songs].sort((left, right) => {
        if (sortMode === 'title-asc' || sortMode === 'title-desc') {
          const comparison = left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' });
          return sortMode === 'title-asc' ? comparison : -comparison;
        }

        const comparison = left.updatedAt - right.updatedAt;
        return sortMode === 'updated-asc' ? comparison : -comparison;
      })
    : undefined;

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    const activeViewport = viewport;

    function updateKeyboardState() {
      const activeElement = document.activeElement;
      const isEditableElement =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);

      const keyboardHeight = window.innerHeight - activeViewport.height;
      setIsVirtualKeyboardOpen(isEditableElement && keyboardHeight > 150);
    }

    updateKeyboardState();
    activeViewport.addEventListener('resize', updateKeyboardState);
    activeViewport.addEventListener('scroll', updateKeyboardState);
    window.addEventListener('focusin', updateKeyboardState);
    window.addEventListener('focusout', updateKeyboardState);

    return () => {
      activeViewport.removeEventListener('resize', updateKeyboardState);
      activeViewport.removeEventListener('scroll', updateKeyboardState);
      window.removeEventListener('focusin', updateKeyboardState);
      window.removeEventListener('focusout', updateKeyboardState);
    };
  }, []);

  async function handleCreateSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = newSongTitle.trim();
    if (!trimmedTitle) {
      setCreationError('Le titre est obligatoire.');
      return;
    }

    setIsSaving(true);
    setCreationError(null);

    try {
      const createdSong = await songsRepository.create({
        title: trimmedTitle,
      });
      setIsCreateOpen(false);
      setNewSongTitle('');
      navigate(`/songs/${createdSong.id}`);
    } catch {
      setCreationError('Impossible de creer la chanson.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section
        className={[
          'space-y-3 -mt-5 bg-[var(--fz-bg)] px-1 pb-3 pt-2',
          shouldReleaseStickyHeader ? 'relative z-20' : 'sticky z-30 -mx-1 border-b border-white/8',
        ].join(' ')}
        style={
          shouldReleaseStickyHeader
            ? undefined
            : {
                top: 'calc(var(--fz-header-height, 64px) + var(--fz-viewport-offset-top, 0px))',
              }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-[2rem] font-black tracking-tight text-white">Repertoire</h1>
          <button
            type="button"
            onClick={() => {
              setIsCreateOpen(true);
              setNewSongTitle('');
              setCreationError(null);
            }}
            className="fz-button-primary px-4 py-2.5 text-[0.82rem] font-black tracking-[0.01em]"
          >
            + Nouvelle
          </button>
        </div>

        {songs && (songs.length > 0 || searchQuery.trim()) ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Rechercher une chanson..."
              className="fz-input min-w-0 flex-1 text-sm"
            />
            <SortMenu value={sortMode} onChange={setSortMode} label="Trier le répertoire" />
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        {songs === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture du repertoire" description="Ouverture de la base locale..." />
        ) : songs.length === 0 && searchQuery.trim() ? (
          <FeatureCard
            eyebrow="Recherche"
            title="Aucune chanson trouvee"
            description={`Aucune chanson ne correspond a « ${searchQuery.trim()} » dans votre repertoire.`}
          >
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="fz-button-primary w-full px-4 py-4 text-sm font-black uppercase tracking-[0.16em]"
            >
              Effacer la recherche
            </button>
          </FeatureCard>
        ) : songs.length === 0 ? (
          <FeatureCard
            eyebrow="Vide"
            title="Votre repertoire est vide"
            description="Cree une premiere chanson pour lancer le repertoire web sans casser l'app Expo."
          >
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(true);
                setNewSongTitle('');
                setCreationError(null);
              }}
              className="fz-button-primary w-full px-4 py-4 text-sm font-black uppercase tracking-[0.16em]"
            >
              Creer ma premiere chanson
            </button>
          </FeatureCard>
        ) : (
          sortedSongs?.map((song) => (
            <Link
              key={song.id}
              to={`/songs/${song.id}`}
              className="fz-card block rounded-[1.2rem] px-4 py-3.5 transition hover:border-[var(--fz-border-strong)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[1.12rem] font-black tracking-tight text-white">{song.title || 'Sans titre'}</h2>
                  <p className="mt-2 truncate whitespace-nowrap text-[0.82rem] text-[var(--fz-text-muted)]">
                    {song.bpm ? `${song.bpm} BPM` : 'BPM --'}
                    {' · '}
                    {song.key || 'Ton --'}
                    {' · '}
                    {formatSongDuration(song.durationSeconds)}
                    {' · '}
                    Modifie le {new Date(song.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex shrink-0 items-start pt-0.5">
                  <StatusPill label={song.status} tone={getSongStatusTone(song.status)} />
                </div>
              </div>
            </Link>
          ))
        )}
      </section>

      {isCreateOpen ? (
        <FormDialog eyebrow="Creation" title="Nouvelle chanson" onClose={() => setIsCreateOpen(false)}>
          <form className="space-y-3" onSubmit={handleCreateSong}>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
                  Titre
                </span>
                <input
                  value={newSongTitle}
                  onChange={(event) => setNewSongTitle(event.target.value)}
                  placeholder="Saisissez le titre de la chanson"
                  autoFocus
                  disabled={isSaving}
                  className="fz-input text-sm"
                />
              </label>

              {creationError ? <p className="text-sm font-semibold text-rose-400">{creationError}</p> : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="fz-button-secondary flex-1 px-4 py-2.5 text-[0.82rem] font-black uppercase tracking-[0.12em] text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="fz-button-primary flex-1 px-4 py-2.5 text-[0.82rem] font-black uppercase tracking-[0.12em] disabled:opacity-60"
                >
                  {isSaving ? 'Creation...' : 'Creer'}
                </button>
              </div>
          </form>
        </FormDialog>
      ) : null}
    </div>
  );
}
