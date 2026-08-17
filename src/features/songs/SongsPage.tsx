import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import { SortMenu, type SortMode } from '@/components/SortMenu';
import { StatusPill } from '@/ui/components/StatusPill';
import { songsRepository } from '@/db/repositories/songsRepository';
import { formatSongDuration, getSongStatusLabel, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { AddButton } from '@/ui/components/AddButton';
import { ContentRow } from '@/ui/components/ContentRow';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { PageHeader } from '@/ui/components/PageHeader';
import { TextField } from '@/ui/components/TextField';
import { FzIcon } from '@/ui/icons';

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

  function handleCreateQuickIdea() {
    if (!canWrite || isSaving) return;
    navigate('/songs/new/write');
  }

  function openCreateDialog() {
    setIsCreateOpen(true);
    setNewSongTitle('');
    setCreationError(null);
  }

  const showTools = Boolean(songs && (songs.length > 0 || searchQuery.trim()));

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<FzIcon name="songs" usageId="page-header.songs" size="xl" />}
        title="Répertoire"
        actions={canWrite ? (
          <AddButton
            onClick={openCreateDialog}
            aria-label="Nouvelle chanson"
            title="Nouvelle chanson"
          />
        ) : undefined}
        search={showTools ? {
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Rechercher une chanson...',
          'aria-label': 'Rechercher dans le répertoire',
        } : undefined}
        sortAction={showTools ? (
          <SortMenu value={sortMode} onChange={setSortMode} label="Trier le répertoire" />
        ) : undefined}
      />

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
            description={canWrite ? 'Crée une première chanson ou saisis directement une idée.' : 'Aucune chanson disponible dans ce groupe.'}
          >
            {canWrite ? (
              <div className="fz-actions-row">
                <button
                  type="button"
                  onClick={() => void handleCreateQuickIdea()}
                  disabled={isSaving}
                  className="fz-button-primary px-4 py-4 text-sm font-black"
                >
                  Saisir une idée
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(true);
                    setNewSongTitle('');
                    setCreationError(null);
                  }}
                  className="fz-button-secondary px-4 py-4 text-sm font-black"
                >
                  Créer avec un titre
                </button>
              </div>
            ) : null}
          </FeatureCard>
        ) : (
          sortedSongs?.map((song) => (
            <ContentRow
              key={song.id}
              mode="link"
              to={`/songs/${song.id}`}
              title={song.title || 'Sans titre'}
              metadata={`${song.bpm ? `${song.bpm} BPM` : 'BPM --'} · ${song.key || 'Ton --'} · ${formatSongDuration(song.durationSeconds)} · Modifie le ${new Date(song.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              status={<StatusPill label={getSongStatusLabel(song.status)} tone={getSongStatusTone(song.status)} />}
            />
          ))
        )}
      </section>

      {canWrite && isCreateOpen ? (
        <FormDialog title="Nouvelle chanson" onClose={() => setIsCreateOpen(false)}>
          <form className="space-y-3" onSubmit={handleCreateSong}>
              <label className="block">
                <FieldLabel>Titre</FieldLabel>
                <TextField
                  value={newSongTitle}
                  onChange={(event) => setNewSongTitle(event.target.value)}
                  placeholder="Saisissez le titre de la chanson"
                  autoFocus
                  disabled={isSaving}
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
