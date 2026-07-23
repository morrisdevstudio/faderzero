import { useEffect, useMemo, useState } from 'react';
import { eventsRepository } from '@/db/repositories/eventsRepository';
import type { EventRecord } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { EventFormModal } from './EventFormModal';

type CalendarViewMode = 'agenda' | 'month';
type SpaceFilter = 'all' | 'personal' | 'groups' | string;

const EVENT_TYPE_LABELS: Record<string, string> = {
  rehearsal: 'Répétition',
  concert: 'Concert',
  meeting: 'Réunion',
  other: 'Autre',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  rehearsal: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  concert: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  meeting: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  other: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
};

const EVENT_TYPE_DOT_COLORS: Record<string, string> = {
  rehearsal: 'bg-blue-400',
  concert: 'bg-orange-400',
  meeting: 'bg-purple-400',
  other: 'bg-zinc-400',
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function CalendarPage() {
  const { workspaces } = useAuthStore();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('agenda');
  const [spaceFilter, setSpaceFilter] = useState<SpaceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [creationDate, setCreationDate] = useState<Date | null>(null);
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

  // Month grid calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    const str = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [currentDate]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
    const daysInMonth = lastDayOfMonth.getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = new Date().toDateString();
    const days = [];

    // Prev month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({
        date,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: date.toDateString() === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: date.toDateString() === todayStr,
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: date.toDateString() === todayStr,
      });
    }

    return days;
  }, [year, month]);

  const eventsByDayString = useMemo(() => {
    const map = new Map<string, EventRecord[]>();
    for (const evt of filteredEvents) {
      const dateKey = new Date(evt.startAt).toDateString();
      const list = map.get(dateKey) || [];
      list.push(evt);
      map.set(dateKey, list);
    }
    return map;
  }, [filteredEvents]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleTodayMonth = () => {
    setCurrentDate(new Date());
  };

  const handleEditEvent = (event: EventRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedEvent(event);
    setCreationDate(null);
    setIsModalOpen(true);
  };

  const handleCreateNew = (date?: Date) => {
    setSelectedEvent(null);
    setCreationDate(date || null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header section */}
      <section className="-mt-5 space-y-3 bg-[var(--fz-bg)] px-1 pb-3 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[2rem] font-black tracking-tight text-white">Événements</h1>
            <p className="mt-0.5 text-xs text-[var(--fz-text-muted)]">
              Planning consolidé de vos groupes et projets personnels
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleCreateNew()}
            aria-label="Nouvel événement"
            className="fz-button-primary h-11 w-11 shrink-0 p-0"
          >
            <PlusIcon />
          </button>
        </div>

        {/* Space filter tabs */}
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
            Tous les événements
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

        {/* View mode switcher & Search input */}
        <div className="flex items-center gap-2 pt-1">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un événement..."
            className="fz-input min-w-0 flex-1 text-sm"
          />

          {/* Toggle buttons: List vs Calendar (Icon only) */}
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/8 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              aria-label="Vue Liste"
              title="Vue Liste"
              className={[
                'rounded-lg p-2 transition',
                viewMode === 'agenda'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              <ListIcon />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              aria-label="Vue Calendrier"
              title="Vue Calendrier"
              className={[
                'rounded-lg p-2 transition',
                viewMode === 'month'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              <CalendarIcon />
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-500">Chargement du calendrier...</div>
      ) : viewMode === 'month' ? (
        /* Month Calendar View */
        <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/60 p-3 shadow-xl md:p-4">
          {/* Month Navigation Bar */}
          <div className="flex items-center justify-between pb-2 border-b border-white/8">
            <h2 className="text-base font-bold text-white md:text-lg">{monthName}</h2>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleTodayMonth}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Mois précédent"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Mois suivant"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-1 md:gap-1.5">
            {calendarDays.map((item, idx) => {
              const dayEvents = eventsByDayString.get(item.date.toDateString()) || [];
              return (
                <div
                  key={idx}
                  onClick={() => handleCreateNew()}
                  className={[
                    'group relative min-h-[64px] rounded-xl border p-1.5 transition flex flex-col justify-between cursor-pointer md:min-h-[85px]',
                    item.isCurrentMonth
                      ? 'border-white/6 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'
                      : 'border-transparent bg-zinc-950/20 opacity-40 hover:opacity-70',
                    item.isToday ? 'ring-1 ring-orange-500/80 bg-orange-500/5' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={[
                        'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                        item.isToday
                          ? 'bg-orange-500 text-white'
                          : item.isCurrentMonth
                          ? 'text-zinc-300'
                          : 'text-zinc-600',
                      ].join(' ')}
                    >
                      {item.dayNumber}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-orange-400 md:hidden">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Day Events list (desktop/tablet) or dots (mobile) */}
                  <div className="mt-1 space-y-1">
                    {/* Mobile dots */}
                    <div className="flex flex-wrap gap-1 md:hidden">
                      {dayEvents.map((evt) => (
                        <span
                          key={evt.id}
                          className={[
                            'h-1.5 w-1.5 rounded-full',
                            EVENT_TYPE_DOT_COLORS[evt.eventType] || 'bg-zinc-400',
                          ].join(' ')}
                        />
                      ))}
                    </div>

                    {/* Desktop pills */}
                    <div className="hidden space-y-1 md:block">
                      {dayEvents.slice(0, 3).map((evt) => {
                        const timeStr = new Date(evt.startAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => handleEditEvent(evt, e)}
                            title={`${evt.title} (${timeStr})`}
                            className={[
                              'truncate rounded px-1.5 py-0.5 text-[10px] font-semibold transition hover:scale-[1.02]',
                              EVENT_TYPE_COLORS[evt.eventType] || EVENT_TYPE_COLORS.other,
                            ].join(' ')}
                          >
                            <span className="font-bold opacity-80 mr-1">{timeStr}</span>
                            {evt.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] font-bold text-zinc-400 pl-1">
                          +{dayEvents.length - 3} de plus
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm text-white/50">
            {searchQuery || spaceFilter !== 'all'
              ? 'Aucun événement ne correspond à vos filtres.'
              : 'Aucun événement prévu pour le moment.'}
          </p>
          <button
            onClick={() => handleCreateNew()}
            className="mt-3 text-xs font-bold text-orange-400 hover:underline"
          >
            Créer un événement
          </button>
        </div>
      ) : (
        /* Agenda List View */
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
                      {EVENT_TYPE_LABELS[evt.eventType] || 'Événement'}
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
                    <p className="text-xs text-zinc-400">📍 {evt.location}</p>
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
        initialDate={creationDate}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadEvents}
      />
    </div>
  );
}
