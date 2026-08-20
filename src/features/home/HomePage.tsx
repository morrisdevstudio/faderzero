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
import { PageHeader } from '@/ui/components/PageHeader';
import { StatusPill } from '@/ui/components/StatusPill';
import { Button } from '@/ui/components/Button';
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
  const { workspaces, activeWorkspace } = useAuthStore();
  const { getBadgeColor, getBadgeText } = useWorkspaceBadgeColors();
  const { playQueue, togglePlayPause, status: audioStatus, queue, currentIndex } = useAudioPlayerStore();

  const [upcomingEvents, setUpcomingEvents] = useState<EventRecord[]>([]);
  const [recentSongs, setRecentSongs] = useState<SongRecord[]>([]);
  const [songAssetsMap, setSongAssetsMap] = useState<Map<string, SongAssetRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false);

  const bookingLeads = useLiveQuery(() => bookingRepository.listLeads(activeWorkspace?.id), [activeWorkspace?.id]) ?? [];
  const dueBookingCount = bookingLeads.filter((lead) => lead.stage !== 'closed' && lead.nextActionAt <= Date.now()).length;

  const currentPlayingTrack = currentIndex >= 0 ? queue[currentIndex] : undefined;

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Prochains événements
        const eventsData = await eventsRepository.listUpcoming(activeWorkspace?.id, 3);

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
  }, [activeWorkspace?.id]);

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

  const heroSong = recentSongs[0];
  const heroAsset = heroSong ? songAssetsMap.get(heroSong.id) : undefined;
  const heroWorkspace = heroSong ? workspaces.find((w) => w.id === heroSong.workspaceId) : undefined;
  const heroBadgeColor = heroWorkspace ? getBadgeColor(heroWorkspace.id, heroWorkspace.type) : undefined;
  const heroBadgeInitials = heroWorkspace ? getBadgeText(heroWorkspace.id, heroWorkspace.name) : 'FZ';
  const isHeroAudioPlaying = heroAsset && currentPlayingTrack?.assetId === heroAsset.id && audioStatus === 'playing';

  return (
    <div className="space-y-6">
      <PageHeader icon={<FzIcon name="home" usageId="page-header.home" size="xl" />} title="Accueil" />

      {/* 1. CARTE HERO : DERNIÈRE MODIFICATION / STUDIO REC */}
      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 text-center text-xs text-zinc-500">
          Chargement de l&apos;espace...
        </div>
      ) : heroSong ? (
        <Link
          to={`/songs/${heroSong.id}`}
          aria-label={`Dernière modification : ${heroSong.title || 'Sans titre'}`}
          className="group relative block overflow-hidden rounded-[1.8rem] border border-white/12 bg-gradient-to-br from-white/[0.07] via-white/[0.02] to-transparent p-5 shadow-xl backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.99]"
        >
          {/* Header de la carte : Workspace & Timestamp */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white shadow-sm border border-white/20"
                style={{ backgroundColor: heroBadgeColor?.hex || '#ff3a63' }}
              >
                {heroBadgeInitials}
              </div>
              <span className="truncate text-xs font-bold tracking-wide text-zinc-200">
                {heroWorkspace?.name || 'Mon Espace'}
              </span>
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-zinc-400">
              {formatRelativeTimeFr(heroSong.updatedAt || heroSong.createdAt)}
            </span>
          </div>

          {/* Corps de la carte avec Play compact si audio présent */}
          <div className="flex items-center gap-3.5">
            {heroAsset ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handlePlaySongAsset(heroSong, heroAsset);
                }}
                aria-label={isHeroAudioPlaying ? `Pause ${heroSong.title}` : `Écouter ${heroSong.title}`}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition active:scale-90 ${
                  isHeroAudioPlaying
                    ? 'border-rose-500 bg-[#ff3a63] text-white shadow-[0_0_16px_rgba(255,58,99,0.5)]'
                    : 'border-white/15 bg-white/10 text-white hover:border-rose-400/50 hover:bg-white/20'
                }`}
              >
                <FzIcon name={isHeroAudioPlaying ? 'pause' : 'play'} usageId="home.hero.audio" size="md" />
              </button>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="truncate text-xl font-black tracking-tight text-white">
                  {heroSong.title || 'Sans titre'}
                </h2>
                <StatusPill label={getSongStatusLabel(heroSong.status)} tone={getSongStatusTone(heroSong.status)} />
              </div>

              <p className="mt-1 flex items-center gap-2 truncate text-xs font-medium text-zinc-300">
                {heroSong.bpm ? <span className="font-bold text-amber-300">{heroSong.bpm} BPM</span> : null}
                {heroSong.bpm && heroSong.key ? <span className="text-white/30">·</span> : null}
                {heroSong.key ? <span>Ton : <strong className="text-white">{heroSong.key}</strong></span> : null}
                {(heroSong.bpm || heroSong.key) && heroSong.durationSeconds ? <span className="text-white/30">·</span> : null}
                {heroSong.durationSeconds ? <span>{formatSongDuration(heroSong.durationSeconds)}</span> : null}
              </p>
            </div>
          </div>
        </Link>
      ) : (
        <div className="rounded-[1.8rem] border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
          <h2 className="text-base font-black text-white">Bienvenue dans FaderZero</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Commence par enregistrer une idée vocale ou créer les paroles de ton premier morceau.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="primary" onClick={() => navigate('/songs/new/write')}>
              Créer un morceau
            </Button>
            <Button variant="secondary" onClick={() => setIsVoiceRecorderOpen(true)}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {/* 2. GRILLE DES FONCTIONS DE L'APP */}
      <section aria-label="Fonctions de l'application" className="space-y-2.5">
        <h2 className="px-1 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
          Fonctions & Outils
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {/* 1. Enregistrer */}
          <button
            type="button"
            onClick={() => setIsVoiceRecorderOpen(true)}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/20 hover:bg-white/[0.07] active:scale-95"
            aria-label="Enregistrer une idée vocale"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-[#ff3a63] transition group-hover:scale-105">
              <FzIcon name="record" usageId="home.toolbox.record" size="lg" />
            </div>
            <span className="text-[10px] font-bold text-zinc-200">Enregistrer</span>
          </button>

          {/* 2. Métronome */}
          <Link
            to="/metronome"
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/20 hover:bg-white/[0.07] active:scale-95"
            aria-label="Ouvrir le métronome"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400 transition group-hover:scale-105">
              <FzIcon name="metronome" usageId="home.toolbox.metronome" size="lg" />
            </div>
            <span className="text-[10px] font-bold text-zinc-200">Métronome</span>
          </Link>

          {/* 3. Prompteur */}
          <Link
            to="/prompter"
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/20 hover:bg-white/[0.07] active:scale-95"
            aria-label="Ouvrir le prompteur"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-400 transition group-hover:scale-105">
              <FzIcon name="prompter" usageId="home.toolbox.prompter" size="lg" />
            </div>
            <span className="text-[10px] font-bold text-zinc-200">Prompteur</span>
          </Link>

          {/* 4. Nouveau morceau */}
          <Link
            to="/songs/new/write"
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/20 hover:bg-white/[0.07] active:scale-95"
            aria-label="Créer un nouveau morceau"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 transition group-hover:scale-105">
              <FzIcon name="add" usageId="home.toolbox.new-song" size="lg" />
            </div>
            <span className="text-[10px] font-bold text-zinc-200">Nouveau</span>
          </Link>

          {/* 5. Morceaux / Répertoire */}
          <Link
            to="/songs"
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/20 hover:bg-white/[0.07] active:scale-95"
            aria-label="Ouvrir le répertoire de morceaux"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-400 transition group-hover:scale-105">
              <FzIcon name="songs" usageId="home.toolbox.songs" size="lg" />
            </div>
            <span className="text-[10px] font-bold text-zinc-200">Morceaux</span>
          </Link>

          {/* 6. Setlists */}
          <Link
            to="/setlists"
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/20 hover:bg-white/[0.07] active:scale-95"
            aria-label="Ouvrir les setlists"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-400 transition group-hover:scale-105">
              <FzIcon name="setlist" usageId="home.toolbox.setlists" size="lg" />
            </div>
            <span className="text-[10px] font-bold text-zinc-200">Setlists</span>
          </Link>

          {/* 7. Calendrier */}
          <Link
            to="/calendar"
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/20 hover:bg-white/[0.07] active:scale-95"
            aria-label="Ouvrir le calendrier"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/15 text-teal-400 transition group-hover:scale-105">
              <FzIcon name="calendar" usageId="home.toolbox.calendar" size="lg" />
            </div>
            <span className="text-[10px] font-bold text-zinc-200">Calendrier</span>
          </Link>

          {/* 8. Booking avec pastille rouge de relances */}
          <Link
            to="/booking"
            className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/20 hover:bg-white/[0.07] active:scale-95"
            aria-label={dueBookingCount > 0 ? `Ouvrir le booking (${dueBookingCount} relance${dueBookingCount > 1 ? 's' : ''} à traiter)` : 'Ouvrir le booking'}
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/15 text-orange-400 transition group-hover:scale-105">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
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
            <span className="text-[10px] font-bold text-zinc-200">Booking</span>
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
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center">
            <p className="text-xs text-zinc-500">Aucun concert ou répétition programmé.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {upcomingEvents.map((evt) => {
              const startDate = new Date(evt.startAt);
              return (
                <ContentRow
                  key={evt.id}
                  mode="link"
                  to="/calendar"
                  title={evt.title}
                  metadata={`${startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                  status={
                    <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                      {evt.eventType}
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 4. DERNIÈRES MODIFICATIONS DE TOUS LES GROUPES */}
      <section aria-label="Dernières modifications du répertoire" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Activité Répertoire (Tous les groupes)
          </h2>
          <Link to="/songs" className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline">
            Tout voir
          </Link>
        </div>

        {loading ? (
          <p className="py-2 text-center text-xs text-zinc-500">Chargement des créations...</p>
        ) : recentSongs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center">
            <p className="text-xs text-zinc-500">Aucune chanson dans vos espaces.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {recentSongs.map((song) => {
              const asset = songAssetsMap.get(song.id);
              const ws = workspaces.find((w) => w.id === song.workspaceId);
              const badgeColor = ws ? getBadgeColor(ws.id, ws.type) : undefined;
              const isThisAudioPlaying = asset && currentPlayingTrack?.assetId === asset.id && audioStatus === 'playing';

              const subtitle = (
                <span className="flex items-center gap-1.5 truncate text-xs text-zinc-400">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: badgeColor?.hex || '#ff3a63' }}
                  />
                  <span className="font-semibold text-zinc-300">{ws?.name || 'Mon Espace'}</span>
                  <span className="text-white/30">·</span>
                  <span>{formatRelativeTimeFr(song.updatedAt || song.createdAt)}</span>
                </span>
              );

              const metadata = `${song.bpm ? `${song.bpm} BPM` : 'BPM --'} · ${song.key || 'Ton --'} · ${formatSongDuration(song.durationSeconds)}`;
              const statusPill = <StatusPill label={getSongStatusLabel(song.status)} tone={getSongStatusTone(song.status)} />;

              if (asset) {
                return (
                  <ContentRow
                    key={song.id}
                    mode="controls"
                    to={`/songs/${song.id}`}
                    leading={
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
                    subtitle={subtitle}
                    metadata={metadata}
                    status={statusPill}
                  />
                );
              }

              return (
                <ContentRow
                  key={song.id}
                  mode="link"
                  to={`/songs/${song.id}`}
                  leading={
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-black transition group-hover:border-white/20 group-hover:bg-white/10 group-active:scale-95"
                      style={{ color: badgeColor?.hex }}
                    >
                      <FzIcon name="songs" usageId="home.list.no-audio" size="md" />
                    </div>
                  }
                  title={song.title || 'Sans titre'}
                  subtitle={subtitle}
                  metadata={metadata}
                  status={statusPill}
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
