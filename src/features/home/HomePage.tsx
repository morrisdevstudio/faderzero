import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { eventsRepository } from '@/db/repositories/eventsRepository';
import { getWorkspaceNewsFeed, type NewsFeedItem } from '@/services/newsFeed';
import type { EventRecord, SongRecord } from '@/db/schema';
import { db } from '@/db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { bookingRepository } from '@/db/repositories/bookingRepository';
import { formatSongDuration, getSongStatusLabel, getSongStatusTone } from '@/features/songs/songPresentation';
import { ContentRow } from '@/ui/components/ContentRow';
import { PageHeader } from '@/ui/components/PageHeader';
import { StatusPill } from '@/ui/components/StatusPill';
import { FzIcon } from '@/ui/icons';

interface GroupFeedSummary {
  workspaceId: string;
  groupName: string;
  items: NewsFeedItem[];
}

export function HomePage() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useAuthStore();
  const [upcomingEvents, setUpcomingEvents] = useState<EventRecord[]>([]);
  const [recentCreations, setRecentCreations] = useState<SongRecord[]>([]);
  const [groupSummaries, setGroupSummaries] = useState<GroupFeedSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const bookingLeads = useLiveQuery(() => bookingRepository.listLeads(activeWorkspace?.id), [activeWorkspace?.id]) ?? [];
  const dueBookingCount = bookingLeads.filter((lead) => lead.stage !== 'closed' && lead.nextActionAt <= Date.now()).length;

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Next 3 upcoming events for active workspace or personal
        const eventsData = await eventsRepository.listUpcoming(activeWorkspace?.id, 3);

        // 2. Next 3 recent personal creations
        const personalWs = workspaces.find((w) => w.type === 'personal') || activeWorkspace;
        let creationsData: SongRecord[] = [];
        if (personalWs) {
          creationsData = await db.songs
            .where('workspaceId')
            .equals(personalWs.id)
            .filter((s) => s.deletedAt === undefined)
            .toArray();
          creationsData.sort((a, b) => b.createdAt - a.createdAt);
          creationsData = creationsData.slice(0, 3);
        }

        // 3. Groups activity news feeds
        const groups = workspaces.filter((w) => w.type === 'group');
        const groupFeeds: GroupFeedSummary[] = [];

        for (const grp of groups) {
          const feed = await getWorkspaceNewsFeed(grp.id, 3);
          groupFeeds.push({
            workspaceId: grp.id,
            groupName: grp.name,
            items: feed,
          });
        }

        if (active) {
          setUpcomingEvents(eventsData);
          setRecentCreations(creationsData);
          setGroupSummaries(groupFeeds);
        }
      } catch {
        if (active) {
          setUpcomingEvents([]);
          setRecentCreations([]);
          setGroupSummaries([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboardData();

    return () => {
      active = false;
    };
  }, [activeWorkspace?.id, workspaces]);

  return (
    <div className="space-y-6">
      <PageHeader icon={<FzIcon name="home" usageId="page-header.home" size="xl" />} title="Mon Espace" />

      <Link to="/booking" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 transition hover:bg-rose-400/15">
        <span><span className="block text-[0.65rem] font-black uppercase tracking-[0.16em] text-rose-200">Prospection</span><span className="mt-0.5 block text-sm font-bold text-white">{dueBookingCount > 0 ? `${dueBookingCount} relance${dueBookingCount > 1 ? 's' : ''} à traiter` : 'Aucune relance en retard'}</span></span>
        <span className="text-lg font-black text-rose-200" aria-hidden="true">→</span>
      </Link>

      {/* 1. Prochains événements */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
            Prochains événements (3)
          </h2>
          <Link to="/calendar" className="text-xs font-semibold text-white/80 hover:text-white hover:underline">
            Voir le calendrier
          </Link>
        </div>

        {loading ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Chargement des événements...</p>
        ) : upcomingEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
            <p className="text-xs text-zinc-500">Aucun événement à venir.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
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
                    <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] uppercase font-bold text-white">
                      {evt.eventType}
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Dernières créations personnelles */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
            Dernières créations (3)
          </h2>
          <Link to="/songs" className="text-xs font-semibold text-white/80 hover:text-white hover:underline">
            Voir le répertoire
          </Link>
        </div>

        {loading ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Chargement des créations...</p>
        ) : recentCreations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
            <p className="text-xs text-zinc-500">Aucune création personnelle récente.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {recentCreations.map((song) => (
              <ContentRow
                key={song.id}
                mode="link"
                to={`/songs/${song.id}`}
                title={song.title}
                subtitle={song.artist || 'FaderZero'}
                metadata={`${song.bpm ? `${song.bpm} BPM` : 'BPM --'} · ${song.key || 'Ton --'} · ${formatSongDuration(song.durationSeconds)}`}
                status={<StatusPill label={getSongStatusLabel(song.status)} tone={getSongStatusTone(song.status)} />}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3. Activité récente des groupes */}
      <section className="space-y-4">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wider text-zinc-300">
          Nouveautés des groupes
        </h2>

        {loading ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Chargement de l'activité...</p>
        ) : groupSummaries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
            <p className="text-xs text-zinc-500">Aucun groupe actif.</p>
          </div>
        ) : (
          groupSummaries.map((group) => (
            <div
              key={group.workspaceId}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-white/8 pb-2">
                <h3 className="text-sm font-bold text-white">{group.groupName}</h3>
                <button
                  onClick={() => {
                    const ws = workspaces.find((w) => w.id === group.workspaceId);
                    if (ws) setActiveWorkspace(ws);
                  }}
                  className="text-[11px] font-semibold text-white/80 hover:text-white hover:underline"
                >
                  Basculer sur ce groupe
                </button>
              </div>

              {group.items.length === 0 ? (
                <p className="text-xs text-zinc-500 py-1">Aucune nouveauté récente dans ce groupe.</p>
              ) : (
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-white/6 bg-zinc-900/50 p-2.5"
                    >
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">{item.title}</p>
                        {item.isCopy && (
                          <p className="text-[10px] text-zinc-400">
                            Copie d'origine de {item.originalAuthor || 'Auteur'}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {item.hasAudio ? '🎵 Audio présent' : 'Texte seul'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
