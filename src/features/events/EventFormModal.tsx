import React, { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormDialog } from '@/components/FormDialog';
import { eventsRepository } from '@/db/repositories/eventsRepository';
import type { EventRecord, EventType } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { DateField } from '@/ui/components/DateField';
import { SelectField } from '@/ui/components/SelectField';
import { TextArea } from '@/ui/components/TextArea';
import { TextField } from '@/ui/components/TextField';
import { TimeField } from '@/ui/components/TimeField';

interface EventFormModalProps {
  event?: EventRecord | null;
  initialDate?: Date | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

function formatDateToInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addHoursToTime(timeStr: string, hours: number): { time: string; daysAdded: number } {
  const parts = (timeStr || '00:00').split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  let totalMinutes = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m) + hours * 60;
  let daysAdded = 0;

  while (totalMinutes >= 24 * 60) {
    totalMinutes -= 24 * 60;
    daysAdded += 1;
  }
  while (totalMinutes < 0) {
    totalMinutes += 24 * 60;
    daysAdded -= 1;
  }

  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  const time = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  return { time, daysAdded };
}

function addDaysToDateString(dateStr: string, days: number): string {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDateToInput(d);
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  event,
  initialDate,
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
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setIsConfirmDeleteOpen(false);
    if (event) {
      setTitle(event.title);
      setEventType(event.eventType);
      setTargetWorkspaceId(event.workspaceId || activeWorkspace?.id || workspaces[0]?.id || '');
      const start = new Date(event.startAt);
      setStartDate(formatDateToInput(start));
      setStartTime(start.toTimeString().slice(0, 5));

      if (event.endAt) {
        const end = new Date(event.endAt);
        setEndDate(formatDateToInput(end));
        setEndTime(end.toTimeString().slice(0, 5));
      } else {
        setEndDate('');
        setEndTime('');
      }

      setLocation(event.location || '');
      setNotes(event.notes || '');
    } else {
      const baseDate = initialDate || new Date();
      const dateStr = formatDateToInput(baseDate);
      setTitle('');
      setEventType('rehearsal');
      setTargetWorkspaceId(activeWorkspace?.id || workspaces[0]?.id || '');
      setStartDate(dateStr);
      setStartTime('20:00');
      setEndDate(dateStr);
      setEndTime('22:00');
      setLocation('');
      setNotes('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event, initialDate]);

  if (!isOpen) return null;

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    // Automatic sync: if end date is missing or earlier than new start date, update end date to start date
    if (!endDate || (endDate && newStart > endDate)) {
      setEndDate(newStart);
    }
  };

  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    if (!endDate || startDate === endDate) {
      if (endTime && newStartTime >= endTime) {
        const { time: targetEndTime, daysAdded } = addHoursToTime(newStartTime, 1);
        setEndTime(targetEndTime);
        if (daysAdded > 0 && startDate) {
          setEndDate(addDaysToDateString(startDate, daysAdded));
        }
      }
    }
  };

  const handleEndTimeChange = (newEndTime: string) => {
    setEndTime(newEndTime);
    if (!endDate || startDate === endDate) {
      if (startTime && newEndTime <= startTime) {
        const { time: targetStartTime, daysAdded } = addHoursToTime(newEndTime, -1);
        setStartTime(targetStartTime);
        if (daysAdded < 0 && startDate) {
          setStartDate(addDaysToDateString(startDate, daysAdded));
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Le titre de l'événement est requis.");
      return;
    }

    if (endDate && startDate && endDate < startDate) {
      setError("La date de fin ne peut pas être antérieure à la date de début.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const effectiveStartDate = startDate || formatDateToInput(new Date());
      const startMs = new Date(`${effectiveStartDate}T${startTime || '00:00'}`).getTime();
      const endMs = endDate ? new Date(`${endDate}T${endTime || '00:00'}`).getTime() : undefined;

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
      setError(err.message || "Échec de l'enregistrement de l'événement.");
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
      setError(err.message || "Échec de la suppression.");
      setLoading(false);
    }
  };

  return (
    <>
      <FormDialog
        title={event ? 'Modifier l’événement' : 'Nouvel événement'}
        closeLabel="Fermer le formulaire d’événement"
        closeDisabled={loading || isConfirmDeleteOpen}
        onClose={onClose}
      >

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="fz-field-label mb-1 block">
              Titre de l’événement
            </label>
            <TextField
              aria-label="Titre de l’événement"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Répétition générale, Concert au Studio..."
              required
            />
          </div>

          {!event && workspaces.length > 0 && (
            <div>
              <label className="fz-field-label mb-1 block">
                Espace / Groupe
              </label>
              <SelectField
                aria-label="Espace ou groupe"
                value={targetWorkspaceId}
                onChange={(e) => setTargetWorkspaceId(e.target.value)}
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.type === 'personal' ? `Perso (${ws.name})` : `Groupe: ${ws.name}`}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="fz-field-label mb-1 block">
                Type
              </label>
              <SelectField
                aria-label="Type d’événement"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
              >
                <option value="rehearsal">Répétition</option>
                <option value="concert">Concert</option>
                <option value="meeting">Réunion</option>
                <option value="other">Autre</option>
              </SelectField>
            </div>
            <div>
              <label className="fz-field-label mb-1 block">
                Lieu
              </label>
              <TextField
                aria-label="Lieu"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Salle 3, Studio A..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="fz-field-label mb-1 block">
                Date de début (optionnelle)
              </label>
              <DateField
                aria-label="Date de début"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div>
              <label className="fz-field-label mb-1 block">
                Heure de début (optionnelle)
              </label>
              <TimeField
                aria-label="Heure de début"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="fz-field-label mb-1 block">
                Date de fin (optionnelle)
              </label>
              <DateField
                aria-label="Date de fin"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="fz-field-label mb-1 block">
                Heure de fin
              </label>
              <TimeField
                aria-label="Heure de fin"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="fz-field-label mb-1 block">
              Notes
            </label>
            <TextArea
              aria-label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ordre du jour, liste du matériel, instructions..."
              resize="none"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {event ? (
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(true)}
                disabled={loading}
                className="fz-button-danger min-h-11 px-4 text-xs font-bold"
              >
                Supprimer
              </button>
            ) : (
              <div />
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="fz-button-secondary min-h-11 px-4 text-xs font-semibold text-white/80"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="fz-button-primary min-h-11 px-4 text-xs font-bold disabled:opacity-60"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </FormDialog>

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title="Supprimer l’événement"
        description="L’événement sera retiré de votre calendrier. Cette action demande une confirmation explicite."
        confirmLabel="Supprimer"
        isBusy={loading}
        onConfirm={async () => {
          setIsConfirmDeleteOpen(false);
          await handleDelete();
        }}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </>
  );
};
