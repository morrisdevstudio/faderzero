import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import { SortMenu, type SortMode } from '@/components/SortMenu';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { formatSetDuration } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { AddButton } from '@/ui/components/AddButton';
import { ContentRow } from '@/ui/components/ContentRow';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { PageHeader } from '@/ui/components/PageHeader';
import { FzIcon } from '@/ui/icons';
import { TextArea } from '@/ui/components/TextArea';
import { TextField } from '@/ui/components/TextField';

export function SetlistsPage() {
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const activeWorkspaceId = activeWorkspace?.id;
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('title-asc');
  const setlists = useLiveQuery(() => setlistsRepository.listSummaries(), [activeWorkspaceId]);

  const filteredSetlists = useMemo(() => {
    if (!setlists) {
      return undefined;
    }

    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('fr-FR');
    const filtered = normalizedQuery
      ? setlists.filter((setlist) => {
          const haystack = [setlist.name, setlist.notes ?? '', setlist.date ?? '']
            .join(' ')
            .toLocaleLowerCase('fr-FR');

          return haystack.includes(normalizedQuery);
        })
      : setlists;

    return [...filtered].sort((left, right) => {
      if (sortMode === 'title-asc' || sortMode === 'title-desc') {
        const comparison = left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' });
        return sortMode === 'title-asc' ? comparison : -comparison;
      }

      const comparison = left.updatedAt - right.updatedAt;
      return sortMode === 'updated-asc' ? comparison : -comparison;
    });
  }, [searchQuery, setlists, sortMode]);

  async function handleCreateSetlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Donnez un nom a la setlist.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const createdSetlist = await setlistsRepository.create({
        name: trimmedName,
        notes,
      });
      setIsCreateOpen(false);
      setName('');
      setNotes('');
      navigate(`/setlists/${createdSetlist.id}`);
    } catch {
      setError('Impossible de creer la setlist.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<FzIcon name="setlist" usageId="page-header.setlists" size="xl" className="text-fuchsia-400" />}
        title="Setlists"
        actions={canWrite ? <AddButton
          onClick={() => {
            setIsCreateOpen(true);
            setName('');
            setNotes('');
            setError(null);
          }}
          aria-label="Nouvelle setlist"
        /> : undefined}
        search={setlists && setlists.length > 0 ? {
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Rechercher une setlist...',
          'aria-label': 'Rechercher dans les setlists',
        } : undefined}
        sortAction={setlists && setlists.length > 0 ? (
          <SortMenu value={sortMode} onChange={setSortMode} label="Trier les setlists" />
        ) : undefined}
      />

      <section className="divide-y divide-white/10">
        {filteredSetlists === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture des setlists" description="Ouverture de la base locale..." />
        ) : filteredSetlists.length === 0 && !searchQuery.trim() ? (
          <FeatureCard
            eyebrow="Vide"
            title="Vos setlists sont vides"
            description="Creez une premiere setlist pour preparer le live web sans casser l'application Expo."
          >
            {canWrite ? <button
              type="button"
              onClick={() => {
                setIsCreateOpen(true);
                setName('');
                setNotes('');
                setError(null);
              }}
              className="fz-button-primary w-full px-4 py-4 text-sm font-black uppercase tracking-[0.16em]"
            >
              Creer ma premiere setlist
            </button> : null}
          </FeatureCard>
        ) : filteredSetlists.length === 0 ? (
          <FeatureCard
            eyebrow="Recherche"
            title="Aucune setlist ne correspond"
            description="Essayez un autre nom, une autre date ou un mot-cle dans les notes."
          />
        ) : (
          filteredSetlists.map((setlist) => (
            <ContentRow
              key={setlist.id}
              mode="link"
              to={`/setlists/${setlist.id}`}
              title={setlist.name}
              metadata={`${setlist.songCount} morceau${setlist.songCount > 1 ? 'x' : ''} · ${formatSetDuration(setlist.totalDurationSeconds)}`}
            />
          ))
        )}
      </section>

      {canWrite && isCreateOpen ? (
        <FormDialog title="Nouvelle setlist" onClose={() => setIsCreateOpen(false)}>
          <form className="space-y-3" onSubmit={handleCreateSetlist}>
            <label className="block">
              <FieldLabel as="span">Nom</FieldLabel>
              <TextField
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex. Festival ete 2026"
                autoFocus
                disabled={isSaving}
              />
            </label>

            <label className="block">
              <FieldLabel as="span">Notes</FieldLabel>
              <TextArea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Intentions de scene, rappels ou contexte"
                rows={3}
                disabled={isSaving}
              />
            </label>

            {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}

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
