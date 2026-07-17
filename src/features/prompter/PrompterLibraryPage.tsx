import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/components/StatusPill';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import { formatSetDuration, formatSongDuration, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';

export function PrompterLibraryPage() {
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const setlists = useLiveQuery(() => setlistsRepository.listSummaries(), [activeWorkspaceId]);
  const songs = useLiveQuery(() => songsRepository.list(), [activeWorkspaceId]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[2rem] font-black tracking-tight text-white">Prompteur</h1>
        <p className="mt-1 text-sm text-[var(--fz-text-muted)]">Choisissez une setlist ou une chanson pour commencer.</p>
      </header>

      <section aria-labelledby="prompter-setlists-title" className="space-y-3">
        <div>
          <h2 id="prompter-setlists-title" className="text-xl font-black tracking-tight text-white">
            Setlists
          </h2>
          <p className="mt-1 text-sm text-[var(--fz-text-muted)]">Lecture dans l'ordre défini dans la setlist.</p>
        </div>

        {setlists === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture des setlists" description="Ouverture de la base locale..." />
        ) : setlists.length === 0 ? (
          <div className="fz-card-soft rounded-[1.2rem] px-4 py-5 text-sm text-[var(--fz-text-muted)]">
            Aucune setlist disponible.
          </div>
        ) : (
          setlists.map((setlist) => (
            <Link
              key={setlist.id}
              to={`/prompter/play?setlistId=${encodeURIComponent(setlist.id)}`}
              className="fz-card block rounded-[1.2rem] px-4 py-3.5 transition hover:border-[var(--fz-border-strong)]"
            >
              <h3 className="truncate text-[1.12rem] font-black tracking-tight text-white">{setlist.name}</h3>
              <p className="mt-2 truncate whitespace-nowrap text-[0.82rem] text-[var(--fz-text-muted)]">
                {setlist.songCount} morceau{setlist.songCount > 1 ? 'x' : ''}
                {' · '}
                {formatSetDuration(setlist.totalDurationSeconds)}
              </p>
            </Link>
          ))
        )}
      </section>

      <section aria-labelledby="prompter-songs-title" className="space-y-3">
        <div>
          <h2 id="prompter-songs-title" className="text-xl font-black tracking-tight text-white">
            Chansons
          </h2>
          <p className="mt-1 text-sm text-[var(--fz-text-muted)]">Lecture de tout le répertoire par ordre alphabétique.</p>
        </div>

        {songs === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture du répertoire" description="Ouverture de la base locale..." />
        ) : songs.length === 0 ? (
          <div className="fz-card-soft rounded-[1.2rem] px-4 py-5 text-sm text-[var(--fz-text-muted)]">
            Aucune chanson disponible.
          </div>
        ) : (
          songs.map((song) => (
            <Link
              key={song.id}
              to={`/prompter/play?songId=${encodeURIComponent(song.id)}`}
              className="fz-card block rounded-[1.2rem] px-4 py-3.5 transition hover:border-[var(--fz-border-strong)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[1.12rem] font-black tracking-tight text-white">{song.title || 'Sans titre'}</h3>
                  <p className="mt-2 truncate whitespace-nowrap text-[0.82rem] text-[var(--fz-text-muted)]">
                    {song.bpm ? `${song.bpm} BPM` : 'BPM --'}
                    {' · '}
                    {song.key || 'Ton --'}
                    {' · '}
                    {formatSongDuration(song.durationSeconds)}
                  </p>
                </div>
                <div className="shrink-0 pt-0.5">
                  <StatusPill label={song.status} tone={getSongStatusTone(song.status)} />
                </div>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
