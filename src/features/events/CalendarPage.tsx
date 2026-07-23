import { useEffect, useMemo, useState } from 'react';
import { eventsRepository } from '@/db/repositories/eventsRepository';
import type { EventRecord } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { EventFormModal } from './EventFormModal';

type CalendarViewMode = 'agenda' | 'week' | 'month';
type SpaceFilter = 'all' | 'personal' | 'groups' | string;

const EVENT_TYPE_LABELS: Record<string, string> = {
  rehearsal: 'R?p?tition',
  concert: 'Concert',
  meeting: 'R?union',
  other: 'Autre',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  rehearsal: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  concert: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  meeting: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  other: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CalendarPage() {
  const { workspaces } = useAuthStore();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('agenda');
  const [spaceFilter, setSpaceFilter] = useState<SpaceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await eventsRepository.listAll();
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const workspaceMap = useMemo(() => {
    const map = new Map<string, { name: string; type: 'personal' | 'group' }>();
    for (const ws of workspaces) {
      map.set(ws.id, { name: ws.name, type: ws.type });
    }
    return map;
  }, [workspaces]);

  const groupWorkspaces = useMemo(() => {
    return workspaces.filter((w) => w.type === 'group');
  }, [workspaces]);

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const wsInfo = workspaceMap.get(evt.workspaceId);
      const isPersonal = wsInfo?.type === 'personal' || evt.workspaceId === 'personal' || evt.workspaceId === 'default-workspace';
      const isGroup = wsInfo?.type === 'group';

      if (spaceFilter === 'personal') {
        if (!isPersonal) return false;
      } else if (spaceFilter === 'groups') {
        if (!isGroup) return false;
      } else if (spaceFilter !== 'all') {
        if (evt.workspaceId !== spaceFilter) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesTitle = evt.title.toLowerCase().includes(query);
        const matchesLocation = evt.location?.toLowerCase().includes(query) ?? false;
        const matchesNotes = evt.notes?.toLowerCase().includes(query) ?? false;
        const matchesType = (EVENT_TYPE_LABELS[evt.eventType] || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesLocation && !matchesNotes && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }, [events, spaceFilter, searchQuery, workspaceMap]);

  const handleEditEvent = (event: EventRecord) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <section className="-mt-5 space-y-3 bg-[var(--fz-bg)] px-1 pb-3 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[2rem] font-black tracking-tight text-white">?v?nements</h1>
            <p className="mt-0.5 text-xs text-[var(--fz-text-muted)]">
              Planning consolid? de vos groupes et projets personnels
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateNew}
            aria-label="Nouvel ?v?nement"
            className="fz-button-primary h-11 w-11 shrink-0 p-0"
          >
            <PlusIcon />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setSpaceFilter('all')}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-bold transition',
              spaceFilter === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            Tous les ?v?nements
          </button>

          <button
            type="button"
            onClick={() => setSpaceFilter('personal')}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-bold transition',
              spaceFilter === 'personal'
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            Perso
          </button>

          <button
            type="button"
            onClick={() => setSpaceFilter('groups')}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-bold transition',
              spaceFilter === 'groups'
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            Groupes
          </button>

          {groupWorkspaces.length > 1 && (
            <select
              value={['all', 'personal', 'groups'].includes(spaceFilter) ? '' : spaceFilter}
              onChange={(e) => {
                if (e.target.value) setSpaceFilter(e.target.value);
              }}
              className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs font-bold text-zinc-300 focus:outline-none"
            >
              <option value="" disabled>Filtrer par groupe...</option>
              {groupWorkspaces.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un ?v?nement..."
            className="fz-input min-w-0 flex-1 text-sm"
          />

          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/8 bg-black/20 p-1">
            {(['agenda', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={[
                  'rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition',
                  viewMode === mode
                    ? 'bg-white/15 text-white'
                    : 'text-white/40 hover:text-white/70',
                ].join(' ')}
              >
                {mode === 'agenda' ? 'Agenda' : mode === 'week' ? 'Sem' : 'Mois'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-500">Chargement du calendrier...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm text-white/50">
            {searchQuery || spaceFilter !== 'all'
              ? 'Aucun ?v?nement ne correspond ? vos filtres.'
              : 'Aucun ?v?nement pr?vu pour le moment.'}
          </p>
          <button
            onClick={handleCreateNew}
            className="mt-3 text-xs font-bold text-orange-400 hover:underline"
          >
            Cr?er un ?v?nement
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEvents.map((evt) => {
            const startDate = new Date(evt.startAt);
            const dateStr = startDate.toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });
            const timeStr = startDate.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const wsInfo = workspaceMap.get(evt.workspaceId);
            const isPersonal = wsInfo?.type === 'personal' || evt.workspaceId === 'personal' || evt.workspaceId === 'default-workspace';
            const spaceBadgeText = isPersonal
              ? 'Perso'
              : wsInfo?.name
              ? `Groupe: ${wsInfo.name}`
              : 'Groupe';

            return (
              <div
                key={evt.id}
                onClick={() => handleEditEvent(evt)}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-white/8 bg-zinc-900/60 p-4 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        'rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase',
                        EVENT_TYPE_COLORS[evt.eventType] || EVENT_TYPE_COLORS.other,
                      ].join(' ')}
                    >
                      {EVENT_TYPE_LABELS[evt.eventType] || '?v?nement'}
                    </span>

                    <span
                      className={[
                        'rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase',
                        isPersonal
                          ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                      ].join(' ')}
                    >
                      {spaceBadgeText}
                    </span>

                    <h3 className="text-sm font-bold text-white">{evt.title}</h3>
                  </div>

                  {evt.location && (
                    <p className="text-xs text-zinc-400">?? {evt.location}</p>
                  )}
                  {evt.notes && (
                    <p className="line-clamp-1 text-xs text-zinc-500">{evt.notes}</p>
                  )}
                </div>

                <div className="shrink-0 text-right pl-3">
                  <p className="text-xs font-bold text-orange-300">{dateStr}</p>
                  <p className="text-[11px] text-zinc-400">{timeStr}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EventFormModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadEvents}
      />
    </div>
  );
}
