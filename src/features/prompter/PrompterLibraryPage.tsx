import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/ui/components/StatusPill';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import { formatSetDuration, formatSongDuration, getSongStatusLabel, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { PageHeader } from '@/ui/components/PageHeader';
import { FzIcon } from '@/ui/icons';

function SetlistSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 6h10M9 12h10M9 18h10" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function SongsSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

export function PrompterLibraryPage() {
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const setlists = useLiveQuery(() => setlistsRepository.listSummaries(), [activeWorkspaceId]);
  const songs = useLiveQuery(() => songsRepository.list(), [activeWorkspaceId]);

  return (
    <div className="space-y-8">
      <PageHeader icon={<FzIcon name="prompter" usageId="page-header.prompter" size="xl" />} title="Prompteur" />

      <section aria-labelledby="prompter-setlists-title" className="space-y-3">
        <div>
          <div className="-mx-4 border-y border-white/10 bg-white/[0.035] px-5 py-5">
            <h2 id="prompter-setlists-title" className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              <SetlistSectionIcon />
              Setlists
            </h2>
            <p className="mt-2 text-sm text-white/65">Lecture dans l'ordre défini dans la setlist.</p>
          </div>
        </div>

        {setlists === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture des setlists" description="Ouverture de la base locale..." />
        ) : setlists.length === 0 ? (
          <div className="fz-card-soft rounded-[1.2rem] px-4 py-5 text-sm text-[var(--fz-text-muted)]">
            Aucune setlist disponible.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
          {setlists.map((setlist) => (
            <Link
              key={setlist.id}
              to={`/prompter/play?setlistId=${encodeURIComponent(setlist.id)}`}
              className="block px-1 py-5 transition first:pt-1 last:pb-1 hover:bg-white/[0.02]"
            >
              <h3 className="truncate text-[1.35rem] font-black tracking-tight text-white">{setlist.name}</h3>
              <p className="mt-2 truncate whitespace-nowrap text-[0.82rem] text-[var(--fz-text-muted)]">
                {setlist.songCount} morceau{setlist.songCount > 1 ? 'x' : ''}
                {' · '}
                {formatSetDuration(setlist.totalDurationSeconds)}
              </p>
            </Link>
          ))}
          </div>
        )}
      </section>

      <section aria-labelledby="prompter-songs-title" className="space-y-3">
        <div>
          <div className="-mx-4 border-y border-white/10 bg-white/[0.035] px-5 py-5">
            <h2 id="prompter-songs-title" className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              <SongsSectionIcon />
              Chansons
            </h2>
            <p className="mt-2 text-sm text-white/65">Lecture de tout le répertoire par ordre alphabétique.</p>
          </div>
        </div>

        {songs === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture du répertoire" description="Ouverture de la base locale..." />
        ) : songs.length === 0 ? (
          <div className="fz-card-soft rounded-[1.2rem] px-4 py-5 text-sm text-[var(--fz-text-muted)]">
            Aucune chanson disponible.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
          {songs.map((song) => (
            <Link
              key={song.id}
              to={`/prompter/play?songId=${encodeURIComponent(song.id)}`}
              className="block px-1 py-5 transition first:pt-1 last:pb-1 hover:bg-white/[0.02]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[1.35rem] font-black tracking-tight text-white">{song.title || 'Sans titre'}</h3>
                  <p className="mt-2 truncate whitespace-nowrap text-[0.82rem] text-[var(--fz-text-muted)]">
                    {song.bpm ? `${song.bpm} BPM` : 'BPM --'}
                    {' · '}
                    {song.key || 'Ton --'}
                    {' · '}
                    {formatSongDuration(song.durationSeconds)}
                  </p>
                </div>
                <div className="shrink-0 pt-0.5">
                  <StatusPill label={getSongStatusLabel(song.status)} tone={getSongStatusTone(song.status)} />
                </div>
              </div>
            </Link>
          ))}
          </div>
        )}
      </section>
    </div>
  );
}
