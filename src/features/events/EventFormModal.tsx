import React, { useEffect, useState } from 'react';
import { eventsRepository } from '@/db/repositories/eventsRepository';
import type { EventRecord, EventType } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';

interface EventFormModalProps {
  event?: EventRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  event,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { workspaces, activeWorkspace } = useAuthStore();
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('rehearsal');
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('20:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('22:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (event) {
        setTitle(event.title);
        setEventType(event.eventType);
        setTargetWorkspaceId(event.workspaceId || activeWorkspace?.id || workspaces[0]?.id || '');
        const start = new Date(event.startAt);
        setStartDate(start.toISOString().split('T')[0] ?? '');
        setStartTime(start.toTimeString().slice(0, 5));

        if (event.endAt) {
          const end = new Date(event.endAt);
          setEndDate(end.toISOString().split('T')[0] ?? '');
          setEndTime(end.toTimeString().slice(0, 5));
        } else {
          setEndDate('');
          setEndTime('');
        }

        setLocation(event.location || '');
        setNotes(event.notes || '');
      } else {
        const today = new Date().toISOString().split('T')[0] ?? '';
        setTitle('');
        setEventType('rehearsal');
        setTargetWorkspaceId(activeWorkspace?.id || workspaces[0]?.id || '');
        setStartDate(today);
        setStartTime('20:00');
        setEndDate(today);
        setEndTime('22:00');
        setLocation('');
        setNotes('');
      }
    }
  }, [isOpen, event, activeWorkspace?.id, workspaces]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Le titre de l'\u00e9v\u00e9nement est requis.");
      return;
    }

    if (!startDate || !startTime) {
      setError("La date et l'heure de d\u00e9but sont requises.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startMs = new Date(`${startDate}T${startTime}`).getTime();
      const endMs = endDate && endTime ? new Date(`${endDate}T${endTime}`).getTime() : undefined;

      const optionalFields = {
        ...(endMs !== undefined ? { endAt: endMs } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };

      if (event) {
        await eventsRepository.update(event.id, {
          title,
          eventType,
          startAt: startMs,
          ...optionalFields,
        });
      } else {
        await eventsRepository.create({
          title,
          eventType,
          startAt: startMs,
          ...optionalFields,
        }, targetWorkspaceId || activeWorkspace?.id);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "\u00c9chec de l'enregistrement de l'\u00e9v\u00e9nement.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || loading) return;
    setLoading(true);
    try {
      await eventsRepository.softDelete(event.id);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "\u00c9chec de la suppression.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2 className="text-lg font-bold text-zinc-100">
            {event ? 'Modifier l\u2019\u00e9v\u00e9nement' : 'Nouvel \u00e9v\u00e9nement'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Fermer
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Titre de l\u2019\u00e9v\u00e9nement
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: R\u00e9p\u00e9tition g\u00e9n\u00e9rale, Concert au Studio..."
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none"
            />
          </div>

          {!event && workspaces.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Espace / Groupe
              </label>
              <select
                value={targetWorkspaceId}
                onChange={(e) => setTargetWorkspaceId(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.type === 'personal' ? `Perso (${ws.name})` : `Groupe: ${ws.name}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none"
              >
                <option value="rehearsal">R\u00e9p\u00e9tition</option>
                <option value="concert">Concert</option>
                <option value="meeting">R\u00e9union</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Lieu
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Salle 3, Studio A..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Date de d\u00e9but
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Heure de d\u00e9but
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Date de fin (optionnelle)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Heure de fin
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ordre du jour, liste du mat\u00e9riel, instructions..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
            {event ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20"
              >
                Supprimer
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-400"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
