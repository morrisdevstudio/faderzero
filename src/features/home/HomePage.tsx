import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '@/stores/authStore';
import { useAudioPlayerStore } from '@/features/audio/audioPlayerStore';
import { eventsRepository } from '@/db/repositories/eventsRepository';
import { bookingRepository } from '@/db/repositories/bookingRepository';
import type { EventRecord, SongAssetRecord, SongRecord } from '@/db/schema';
import { db } from '@/db/db';
import { useWorkspaceBadgeColors } from '@/services/workspaceColors';
import { formatSongDuration, getSongStatusLabel, getSongStatusTone } from '@/features/songs/songPresentation';
import { ContentRow } from '@/ui/components/ContentRow';
import { StatusPill } from '@/ui/components/StatusPill';
import { FzIcon } from '@/ui/icons';
import { QuickVoiceRecorder } from '@/features/recorder/QuickVoiceRecorder';

function formatRelativeTimeFr(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function HomePage() {
  const navigate = useNavigate();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useAuthStore();
  const { getBadgeColor } = useWorkspaceBadgeColors();
  const { playQueue, togglePlayPause, status: audioStatus, queue, currentIndex } = useAudioPlayerStore();

  const [upcomingEvents, setUpcomingEvents] = useState<EventRecord[]>([]);
  const [recentSongs, setRecentSongs] = useState<SongRecord[]>([]);
  const [songAssetsMap, setSongAssetsMap] = useState<Map<string, SongAssetRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false);

  const bookingLeads = useLiveQuery(() => bookingRepository.listLeads(activeWorkspace?.id), [activeWorkspace?.id]) ?? [];
  const dueBookingCount = bookingLeads.filter((lead) => lead.stage !== 'closed' && lead.nextActionAt <= Date.now()).length;

  const currentPlayingTrack = currentIndex >= 0 ? queue[currentIndex] : undefined;

  const workspacesKey = workspaces.map((w) => w.id).join(',');

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const workspaceIds = workspaces.map((w) => w.id);
        // 1. Prochains événements à travers tous les espaces
        const eventsData = await eventsRepository.listUpcoming(workspaceIds.length > 0 ? workspaceIds : undefined, 3);

        // 2. Dernières chansons modifiées à travers TOUS les espaces
        const allSongs = await db.songs
          .filter((s) => s.deletedAt === undefined)
          .toArray();

        allSongs.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        const topSongs = allSongs.slice(0, 6);

        // 3. Fichiers audio associés
        const songIds = topSongs.map((s) => s.id);
        const assets = await db.songAssets
          .filter((a) => a.deletedAt === undefined && a.songId !== undefined && songIds.includes(a.songId))
          .toArray();

        const assetsMap = new Map<string, SongAssetRecord>();
        for (const asset of assets) {
          if (asset.songId && !assetsMap.has(asset.songId)) {
            assetsMap.set(asset.songId, asset);
          }
        }

        if (active) {
          setUpcomingEvents(eventsData);
          setRecentSongs(topSongs);
          setSongAssetsMap(assetsMap);
        }
      } catch {
        if (active) {
          setUpcomingEvents([]);
          setRecentSongs([]);
          setSongAssetsMap(new Map());
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [activeWorkspace?.id, workspacesKey]);

  const handlePlaySongAsset = async (song: SongRecord, asset: SongAssetRecord) => {
    const isThisPlaying = currentPlayingTrack?.assetId === asset.id;
    if (isThisPlaying) {
      await togglePlayPause();
      return;
    }

    await playQueue([
      {
        assetId: asset.id,
        songId: song.id,
        title: song.title || 'Sans titre',
        filename: asset.filename,
      },
    ]);
  };

  const handleSelectSong = (song: SongRecord) => {
    if (song.workspaceId && song.workspaceId !== activeWorkspace?.id) {
      const targetWorkspace = workspaces.find((w) => w.id === song.workspaceId);
      if (targetWorkspace) {
        setActiveWorkspace(targetWorkspace);
      }
    }
  };

  const handleSelectEvent = (evt: EventRecord) => {
    if (evt.workspaceId && evt.workspaceId !== activeWorkspace?.id) {
      const targetWorkspace = workspaces.find((w) => w.id === evt.workspaceId);
      if (targetWorkspace) {
        setActiveWorkspace(targetWorkspace);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* GRILLE DES FONCTIONS DE L'APP */}
      <section aria-label="Fonctions de l'application">
        <div className="grid grid-cols-4 gap-2">
          {/* 1. Enregistrer */}
          <button
            type="button"
            onClick={() => setIsVoiceRecorderOpen(true)}
            className="group flex min-h-22 flex-col items-center justify-center gap-2 p-3 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Enregistrer une idée vocale"
          >
            <div className="flex h-12 w-12 items-center justify-center text-[#ff3a63] transition group-hover:scale-105">
              <FzIcon name="record" usageId="home.toolbox.record" size="xl" />
            </div>
            <span className="text-[11px] font-bold text-zinc-200">Enregistrer</span>
          </button>

          {/* 2. Métronome */}
          <Link
            to="/metronome"
            className="group flex min-h-22 flex-col items-center justify-center gap-2 p-3 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Ouvrir le métronome"
          >
            <div className="flex h-12 w-12 items-center justify-center text-amber-400 transition group-hover:scale-105">
              <FzIcon name="metronome" usageId="home.toolbox.metronome" size="xl" />
            </div>
            <span className="text-[11px] font-bold text-zinc-200">Métronome</span>
          </Link>

          {/* 3. Prompteur */}
          <Link
            to="/prompter"
            className="group flex min-h-22 flex-col items-center justify-center gap-2 p-3 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Ouvrir le prompteur"
          >
            <div className="flex h-12 w-12 items-center justify-center text-sky-400 transition group-hover:scale-105">
              <FzIcon name="prompter" usageId="home.toolbox.prompter" size="xl" />
            </div>
            <span className="text-[11px] font-bold text-zinc-200">Prompteur</span>
          </Link>

          {/* 4. Nouveau morceau */}
          <Link
            to="/songs/new/write"
            className="group flex min-h-22 flex-col items-center justify-center gap-2 p-3 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Créer un nouveau morceau"
          >
            <div className="flex h-12 w-12 items-center justify-center text-emerald-400 transition group-hover:scale-105">
              <FzIcon name="add" usageId="home.toolbox.new-song" size="xl" />
            </div>
            <span className="text-[11px] font-bold text-zinc-200">Nouveau</span>
          </Link>

          {/* 5. Morceaux / Répertoire */}
          <Link
            to="/songs"
            className="group flex min-h-22 flex-col items-center justify-center gap-2 p-3 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Ouvrir le répertoire de morceaux"
          >
            <div className="flex h-12 w-12 items-center justify-center text-indigo-400 transition group-hover:scale-105">
              <FzIcon name="songs" usageId="home.toolbox.songs" size="xl" />
            </div>
            <span className="text-[11px] font-bold text-zinc-200">Morceaux</span>
          </Link>

          {/* 6. Setlists */}
          <Link
            to="/setlists"
            className="group flex min-h-22 flex-col items-center justify-center gap-2 p-3 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Ouvrir les setlists"
          >
            <div className="flex h-12 w-12 items-center justify-center text-fuchsia-400 transition group-hover:scale-105">
              <FzIcon name="setlist" usageId="home.toolbox.setlists" size="xl" />
            </div>
            <span className="text-[11px] font-bold text-zinc-200">Setlists</span>
          </Link>

          {/* 7. Calendrier */}
          <Link
            to="/calendar"
            className="group flex min-h-22 flex-col items-center justify-center gap-2 p-3 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Ouvrir le calendrier"
          >
            <div className="flex h-12 w-12 items-center justify-center text-teal-400 transition group-hover:scale-105">
              <FzIcon name="calendar" usageId="home.toolbox.calendar" size="xl" />
            </div>
            <span className="text-[11px] font-bold text-zinc-200">Calendrier</span>
          </Link>

          {/* 8. Booking avec pastille rouge de relances */}
          <Link
            to="/booking"
            className="group relative flex min-h-22 flex-col items-center justify-center gap-2 p-3 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={dueBookingCount > 0 ? `Ouvrir le booking (${dueBookingCount} relance${dueBookingCount > 1 ? 's' : ''} à traiter)` : 'Ouvrir le booking'}
          >
            <div className="relative flex h-12 w-12 items-center justify-center text-orange-400 transition group-hover:scale-105">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
              >
                <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>

              {dueBookingCount > 0 ? (
                <span
                  className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#ff3a63] px-1 text-[9px] font-black text-white shadow-md ring-2 ring-[#08090b] animate-pulse"
                  aria-label={`${dueBookingCount} relances`}
                >
                  {dueBookingCount}
                </span>
              ) : null}
            </div>
            <span className="text-[11px] font-bold text-zinc-200">Booking</span>
          </Link>
        </div>
      </section>

      {/* 3. PROCHAINS ÉVÉNEMENTS (CONCERTS & RÉPÉTITIONS) */}
      <section aria-label="Prochains événements" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Prochaines Dates ({upcomingEvents.length})
          </h2>
          <Link to="/calendar" className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline">
            Voir le calendrier
          </Link>
        </div>

        {loading ? (
          <p className="py-2 text-center text-xs text-zinc-500">Chargement des événements...</p>
        ) : upcomingEvents.length === 0 ? (
          <div className="border-y border-white/10 py-5 text-center">
            <p className="text-xs text-zinc-500">Aucun concert ou répétition programmé.</p>
          </div>
        ) : (
          <div className="border-y border-white/10">
            {upcomingEvents.map((evt) => {
              const startDate = new Date(evt.startAt);
              const workspace = workspaces.find((item) => item.id === evt.workspaceId);
              const workspaceColor = getBadgeColor(evt.workspaceId, workspace?.type).hex;
              return (
                <ContentRow
                  key={evt.id}
                  mode="link"
                  to="/calendar"
                  onClick={() => handleSelectEvent(evt)}
                  className="border-l-2"
                  style={{ borderLeftColor: workspaceColor }}
                  title={evt.title}
                  metadata={
                    <>
                      <span className="block truncate">
                        {startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' · '}
                        {startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="mt-1 flex items-center gap-2 overflow-hidden text-[0.84rem] font-medium text-white/65">
                        <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.68rem] font-black uppercase leading-none tracking-[0.16em] text-white/70">
                          {evt.eventType}
                        </span>
                        <span className="truncate">{workspace?.name || 'Mon Espace'}</span>
                      </span>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 4. DERNIÈRES MODIFICATIONS DE TOUS LES GROUPES */}
      <section aria-label="Dernières modifications du répertoire" className="space-y-3">
        <div className="px-1">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Activité
          </h2>
        </div>

        {loading ? (
          <p className="py-2 text-center text-xs text-zinc-500">Chargement des créations...</p>
        ) : recentSongs.length === 0 ? (
          <div className="border-y border-white/10 py-5 text-center">
            <p className="text-xs text-zinc-500">Aucune chanson dans vos espaces.</p>
          </div>
        ) : (
          <div className="border-y border-white/10">
            {recentSongs.map((song) => {
              const asset = songAssetsMap.get(song.id);
              const ws = workspaces.find((w) => w.id === song.workspaceId);
              const badgeColor = ws ? getBadgeColor(ws.id, ws.type) : undefined;
              const isThisAudioPlaying = asset && currentPlayingTrack?.assetId === asset.id && audioStatus === 'playing';

              const statusPill = <StatusPill label={getSongStatusLabel(song.status)} tone={getSongStatusTone(song.status)} />;
              const metadata = (
                <>
                  <span className="block truncate">
                    {song.bpm ? `${song.bpm} BPM` : 'BPM --'}
                    {' · '}
                    {song.key || 'Ton --'}
                    {' · '}
                    {formatSongDuration(song.durationSeconds)}
                  </span>
                  <span className="mt-1 flex items-center gap-2 overflow-hidden text-[0.84rem] font-medium text-white/65">
                    {statusPill}
                    <span className="truncate">
                      {ws?.name || 'Mon Espace'} · {formatRelativeTimeFr(song.updatedAt || song.createdAt)}
                    </span>
                  </span>
                </>
              );

              if (asset) {
                return (
                  <ContentRow
                    key={song.id}
                    mode="controls"
                    to={`/songs/${song.id}`}
                    onClick={() => handleSelectSong(song)}
                    className="border-l-2"
                    style={{ borderLeftColor: badgeColor?.hex || '#ff3a63' }}
                    trailing={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePlaySongAsset(song, asset);
                        }}
                        aria-label={isThisAudioPlaying ? `Pause ${song.title}` : `Écouter ${song.title}`}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-95 ${
                          isThisAudioPlaying
                            ? 'border-rose-500 bg-[#ff3a63] text-white shadow-lg'
                            : 'border-white/10 bg-white/5 text-white/80 hover:border-rose-400/50 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <FzIcon name={isThisAudioPlaying ? 'pause' : 'play'} usageId="home.list.audio-play" size="md" />
                      </button>
                    }
                    title={song.title || 'Sans titre'}
                    metadata={metadata}
                  />
                );
              }

              return (
                <ContentRow
                  key={song.id}
                  mode="link"
                  to={`/songs/${song.id}`}
                  onClick={() => handleSelectSong(song)}
                  className="border-l-2"
                  style={{ borderLeftColor: badgeColor?.hex || '#ff3a63' }}
                  title={song.title || 'Sans titre'}
                  metadata={metadata}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Enregistreur vocal rapide */}
      {isVoiceRecorderOpen ? (
        <QuickVoiceRecorder
          onClose={() => setIsVoiceRecorderOpen(false)}
          onComplete={({ songId }) => {
            setIsVoiceRecorderOpen(false);
            if (songId) {
              navigate(`/songs/${songId}`);
            }
          }}
        />
      ) : null}
    </div>
  );
}
