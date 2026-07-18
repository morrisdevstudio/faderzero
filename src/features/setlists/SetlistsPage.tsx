import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FeatureCard } from '@/components/FeatureCard';
import { FormDialog } from '@/components/FormDialog';
import { SortMenu, type SortMode } from '@/components/SortMenu';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { formatSetDuration } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SetlistsPage() {
  const navigate = useNavigate();
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isVirtualKeyboardOpen, setIsVirtualKeyboardOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('title-asc');
  const setlists = useLiveQuery(() => setlistsRepository.listSummaries(), [activeWorkspaceId]);
  const shouldReleaseStickyHeader = isSearchFocused && isVirtualKeyboardOpen;

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
          <div className="min-w-0 flex-1">
            <h1 className="min-w-0 text-[2rem] font-black tracking-tight text-white">Setlists</h1>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCreateOpen(true);
              setName('');
              setNotes('');
              setError(null);
            }}
            aria-label="Nouvelle setlist"
            className="fz-button-primary h-11 w-11 shrink-0 p-0"
          >
            <PlusIcon />
          </button>
        </div>

        {setlists && setlists.length > 0 ? (
          <div className="flex items-center gap-2">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Rechercher une setlist..."
              className="fz-input min-w-0 flex-1 text-sm"
            />
            <SortMenu value={sortMode} onChange={setSortMode} label="Trier les setlists" />
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        {filteredSetlists === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture des setlists" description="Ouverture de la base locale..." />
        ) : filteredSetlists.length === 0 && !searchQuery.trim() ? (
          <FeatureCard
            eyebrow="Vide"
            title="Vos setlists sont vides"
            description="Creez une premiere setlist pour preparer le live web sans casser l'application Expo."
          >
            <button
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
            </button>
          </FeatureCard>
        ) : filteredSetlists.length === 0 ? (
          <FeatureCard
            eyebrow="Recherche"
            title="Aucune setlist ne correspond"
            description="Essayez un autre nom, une autre date ou un mot-cle dans les notes."
          />
        ) : (
          filteredSetlists.map((setlist) => (
            <Link
              key={setlist.id}
              to={`/setlists/${setlist.id}`}
              className="fz-card block rounded-[1.2rem] px-4 py-3.5 transition hover:border-[var(--fz-border-strong)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[1.12rem] font-black tracking-tight text-white">{setlist.name}</h2>
                  <p className="mt-2 truncate whitespace-nowrap text-[0.82rem] text-[var(--fz-text-muted)]">
                    {setlist.songCount} morceau{setlist.songCount > 1 ? 'x' : ''}
                    {' · '}
                    {formatSetDuration(setlist.totalDurationSeconds)}
                  </p>
                </div>

              </div>
            </Link>
          ))
        )}
      </section>

      {isCreateOpen ? (
        <FormDialog title="Nouvelle setlist" onClose={() => setIsCreateOpen(false)}>
          <form className="space-y-3" onSubmit={handleCreateSetlist}>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
                Nom
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex. Festival ete 2026"
                autoFocus
                disabled={isSaving}
                className="fz-input text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Intentions de scene, rappels ou contexte"
                rows={3}
                disabled={isSaving}
                className="fz-input min-h-28 resize-y text-sm"
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
