import { useEffect, useState } from 'react';
import { eventsRepository } from '@/db/repositories/eventsRepository';
import type { EventRecord } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { EventFormModal } from './EventFormModal';

type CalendarViewMode = 'agenda' | 'week' | 'month';

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

export function CalendarPage() {
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('agenda');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await eventsRepository.listByWorkspace(activeWorkspace?.id);
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, [activeWorkspace?.id]);

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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">
            Calendrier
          </p>
          <h1 className="mt-1 text-xl font-black uppercase tracking-[0.16em] text-white">
            {activeWorkspace?.name || 'Mon espace'}
          </h1>
        </div>
        <button
          onClick={handleCreateNew}
          className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-400 transition"
        >
          + Événement
        </button>
      </div>

      {/* View mode switcher */}
      <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 p-1.5">
        <div className="flex gap-1">
          {(['agenda', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition',
                viewMode === mode
                  ? 'bg-white/15 text-white'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              {mode === 'agenda' ? 'Agenda' : mode === 'week' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>
        <span className="pr-2 text-[10px] uppercase tracking-wider text-white/40">
          {events.length} événement{events.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Event List / View */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-500">Chargement du calendrier...</div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm text-white/50">Aucun événement prévu pour cet espace.</p>
          <button
            onClick={handleCreateNew}
            className="mt-3 text-xs font-bold text-orange-400 hover:underline"
          >
            Créer le premier événement
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {events.map((evt) => {
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

            return (
              <div
                key={evt.id}
                onClick={() => handleEditEvent(evt)}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-white/8 bg-zinc-900/60 p-4 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase',
                        EVENT_TYPE_COLORS[evt.eventType] || EVENT_TYPE_COLORS.other,
                      ].join(' ')}
                    >
                      {EVENT_TYPE_LABELS[evt.eventType] || 'Événement'}
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

                <div className="text-right">
                  <p className="text-xs font-bold text-orange-300">{dateStr}</p>
                  <p className="text-[11px] text-zinc-400">{timeStr}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal form */}
      <EventFormModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadEvents}
      />
    </div>
  );
}
