import { useLiveQuery } from 'dexie-react-hooks';
import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/ui/components/StatusPill';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import { formatSetDuration, formatSongDuration, getSongStatusLabel, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { ContentRow } from '@/ui/components/ContentRow';
import { PageHeader } from '@/ui/components/PageHeader';
import { FzIcon } from '@/ui/icons';

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
              <FzIcon name="setlist" usageId="prompter.section.setlists" size="md" />
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
              <ContentRow
                key={setlist.id}
                mode="link"
                to={`/prompter/play?setlistId=${encodeURIComponent(setlist.id)}`}
                title={setlist.name}
                metadata={`${setlist.songCount} morceau${setlist.songCount > 1 ? 'x' : ''} · ${formatSetDuration(setlist.totalDurationSeconds)}`}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="prompter-songs-title" className="space-y-3">
        <div>
          <div className="-mx-4 border-y border-white/10 bg-white/[0.035] px-5 py-5">
            <h2 id="prompter-songs-title" className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              <FzIcon name="songs" usageId="prompter.section.songs" size="md" />
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
              <ContentRow
                key={song.id}
                mode="link"
                to={`/prompter/play?songId=${encodeURIComponent(song.id)}`}
                title={song.title || 'Sans titre'}
                metadata={`${song.bpm ? `${song.bpm} BPM` : 'BPM --'} · ${song.key || 'Ton --'} · ${formatSongDuration(song.durationSeconds)}`}
                status={<StatusPill label={getSongStatusLabel(song.status)} tone={getSongStatusTone(song.status)} />}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
