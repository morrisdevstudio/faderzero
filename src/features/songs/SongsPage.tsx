import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import { SortMenu, type SortMode } from '@/components/SortMenu';
import { StatusPill } from '@/components/StatusPill';
import { songsRepository } from '@/db/repositories/songsRepository';
import { formatSongDuration, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { canWriteWorkspace } from '@/services/supabase/workspace';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SongsPage() {
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const activeWorkspaceId = activeWorkspace?.id;
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('title-asc');
  const songs = useLiveQuery(() => songsRepository.list({ query: searchQuery }), [searchQuery, activeWorkspaceId]);
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

  async function handleCreateSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;

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
      <section className="space-y-3 -mt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-[#ff3a63] shrink-0">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6.5 17H20" />
              <path d="M12 7v5" />
              <circle cx="10.5" cy="12" r="1.5" />
            </svg>
            <h1 className="min-w-0 flex-1 text-[2rem] font-black tracking-tight text-white">Répertoire</h1>
          </div>
          {canWrite ? <button
            type="button"
            onClick={() => {
              setIsCreateOpen(true);
              setNewSongTitle('');
              setCreationError(null);
            }}
            aria-label="Nouvelle chanson"
            className="fz-button-primary h-11 w-11 shrink-0 p-0"
          >
            <PlusIcon />
          </button> : null}
        </div>

        {songs && (songs.length > 0 || searchQuery.trim()) ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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
            description={canWrite ? "Cree une premiere chanson pour lancer le repertoire web sans casser l'app Expo." : 'Aucune chanson disponible dans ce groupe.'}
          >
            {canWrite ? <button
              type="button"
              onClick={() => {
                setIsCreateOpen(true);
                setNewSongTitle('');
                setCreationError(null);
              }}
              className="fz-button-primary w-full px-4 py-4 text-sm font-black uppercase tracking-[0.16em]"
            >
              Creer ma premiere chanson
            </button> : null}
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

      {canWrite && isCreateOpen ? (
        <FormDialog title="Nouvelle chanson" onClose={() => setIsCreateOpen(false)}>
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
