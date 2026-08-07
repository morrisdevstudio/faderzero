import { useCallback, useRef, useState } from 'react';
import { InventoryApiError, updateOccurrence, type OccurrenceChanges } from '../api/inventoryClient';
import { type CatalogOccurrence, type EditableKey, type EditableOccurrenceFields } from './useIconCatalogEdits';

const allowedStatuses = new Set(['discovered', 'review', 'proposed', 'approved', 'rejected', 'migrated', 'verified', 'custom-kept']);
const limits: Record<EditableKey, number> = { lucideIcon: 128, faderzeroName: 128, reason: 2000, status: 32, notes: 4000 };
export type RowSaveState = { status: 'idle' } | { status: 'pending' } | { status: 'saving' } | { status: 'saved' } | { status: 'error'; message: string } | { status: 'conflict'; message: string } | { status: 'conflict-dismissed'; message: string };
export type BulkSaveState = { status: 'idle' } | { status: 'saving'; total: number; completed: number; currentOccurrenceId: string } | { status: 'completed'; total: number; saved: number } | { status: 'stopped'; total: number; saved: number; failedOccurrenceId: string; reason: 'validation' | 'conflict' | 'http' | 'network' };
export type FieldErrors = Partial<Record<EditableKey, string>>;

export function buildChanges(fields: EditableOccurrenceFields, dirtyFields: EditableKey[]): OccurrenceChanges {
  const proposal: Record<string, string> = {};
  const decision: Record<string, string> = {};
  for (const key of dirtyFields) {
    const value = (fields[key] ?? '').trim();
    if (key === 'lucideIcon' || key === 'faderzeroName' || key === 'reason') proposal[key] = value;
    else decision[key] = value;
  }
  return { ...(Object.keys(proposal).length ? { proposal } : {}), ...(Object.keys(decision).length ? { decision } : {}) };
}

export function validateEditableFields(fields: EditableOccurrenceFields, dirtyFields: EditableKey[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of dirtyFields) {
    const value = fields[key] ?? '';
    if (typeof value !== 'string') errors[key] = 'Valeur invalide.';
    else if (value.length > limits[key]) errors[key] = `Maximum ${limits[key]} caractères.`;
    else if ((key === 'lucideIcon' || key === 'faderzeroName') && /[<>]/.test(value)) errors[key] = 'Le HTML n’est pas autorisé.';
    else if (key === 'status' && !allowedStatuses.has(value.trim())) errors[key] = 'Statut non autorisé.';
  }
  return errors;
}

type Params = {
  revision: string;
  setRevision: (revision: string) => void;
  getDraft: (id: string) => EditableOccurrenceFields;
  getDirtyFields: (id: string) => EditableKey[];
  commitOccurrence: (item: CatalogOccurrence, sent?: EditableOccurrenceFields) => void;
  replaceServerValues: (items: CatalogOccurrence[], preserveDrafts: boolean) => void;
  updateServerOccurrence: (id: string, item: CatalogOccurrence) => void;
  load: () => Promise<{ revision: string; inventory: { icons: CatalogOccurrence[] } }>;
  replaceInventory: (inventory: { icons: CatalogOccurrence[] }) => void;
  dirtyOccurrenceIds: string[];
};

export function useIconCatalogSave(params: Params) {
  const revisionRef = useRef(params.revision);
  revisionRef.current = params.revision;
  const [states, setStates] = useState<Record<string, RowSaveState>>({});
  const [bulkSaveState, setBulkSaveState] = useState<BulkSaveState>({ status: 'idle' });
  const [errors, setErrors] = useState<Record<string, FieldErrors>>({});
  const saving = useRef(new Set<string>());
  const setState = useCallback((id: string, state: RowSaveState) => setStates((current) => ({ ...current, [id]: state })), []);
  const saveOccurrence = useCallback(async (id: string) => {
    if (saving.current.has(id)) return;
    const dirtyFields = params.getDirtyFields(id);
    if (!dirtyFields.length) return;
    const validation = validateEditableFields(params.getDraft(id), dirtyFields);
    setErrors((current) => ({ ...current, [id]: validation }));
    if (Object.keys(validation).length) { setState(id, { status: 'error', message: 'Corrigez les champs invalides.' }); return; }
    saving.current.add(id); setState(id, { status: 'saving' });
    try {
      const result = await updateOccurrence(id, revisionRef.current, buildChanges(params.getDraft(id), dirtyFields));
      revisionRef.current = result.revision; params.setRevision(result.revision);
      params.updateServerOccurrence(id, result.occurrence as CatalogOccurrence);
      params.commitOccurrence(result.occurrence as CatalogOccurrence, params.getDraft(id));
      setErrors((current) => ({ ...current, [id]: {} })); setState(id, { status: 'saved' });
      window.setTimeout(() => setState(id, { status: 'idle' }), 2500);
    } catch (error) {
      if (error instanceof InventoryApiError && error.status === 409) setState(id, { status: 'conflict', message: 'L’inventaire a été modifié depuis son chargement.' });
      else if (error instanceof InventoryApiError && error.status === 400) setState(id, { status: 'error', message: 'Les données envoyées ne sont pas valides.' });
      else if (error instanceof InventoryApiError && error.status === 404) setState(id, { status: 'error', message: 'Cette occurrence n’existe plus dans l’inventaire.' });
      else setState(id, { status: 'error', message: 'Échec de l’enregistrement. Les modifications locales sont conservées.' });
    } finally { saving.current.delete(id); }
  }, [params, setState]);
  const resolveConflictByReloading = useCallback(async (id: string) => {
    const loaded = await params.load(); revisionRef.current = loaded.revision; params.setRevision(loaded.revision);
    params.replaceInventory(loaded.inventory); params.replaceServerValues(loaded.inventory.icons, true);
    setState(id, { status: 'idle' });
  }, [params, setState]);
  const dismissConflict = useCallback((id: string) => setState(id, { status: 'conflict-dismissed', message: 'Conflit conservé : le brouillon local n’a pas été modifié.' }), [setState]);
  const showConflict = useCallback((id: string) => setState(id, { status: 'conflict', message: 'L’inventaire a été modifié depuis son chargement.' }), [setState]);
  const clearStates = useCallback(() => { setStates({}); setErrors({}); }, []);
  const saveAllDirtyOccurrences = useCallback(async () => {
    if (bulkSaveState.status === 'saving') return;
    const queue = params.dirtyOccurrenceIds.map((id) => ({ id, draft: params.getDraft(id), dirtyFields: params.getDirtyFields(id) })).filter((entry) => entry.dirtyFields.length);
    const invalid = queue.find((entry) => Object.keys(validateEditableFields(entry.draft, entry.dirtyFields)).length > 0);
    if (invalid) { setErrors((current) => ({ ...current, [invalid.id]: validateEditableFields(invalid.draft, invalid.dirtyFields) })); setBulkSaveState({ status: 'stopped', total: queue.length, saved: 0, failedOccurrenceId: invalid.id, reason: 'validation' }); return; }
    for (const entry of queue) setState(entry.id, { status: 'pending' });
    let saved = 0;
    for (const entry of queue) {
      setState(entry.id, { status: 'saving' }); setBulkSaveState({ status: 'saving', total: queue.length, completed: saved, currentOccurrenceId: entry.id });
      try {
        const result = await updateOccurrence(entry.id, revisionRef.current, buildChanges(entry.draft, entry.dirtyFields));
        revisionRef.current = result.revision; params.setRevision(result.revision); params.updateServerOccurrence(entry.id, result.occurrence as CatalogOccurrence); params.commitOccurrence(result.occurrence as CatalogOccurrence, entry.draft); setState(entry.id, { status: 'saved' }); saved += 1;
      } catch (error) {
        const reason: BulkSaveState extends { status: 'stopped'; reason: infer Value } ? Value : never = error instanceof InventoryApiError && error.status === 409 ? 'conflict' : error instanceof InventoryApiError && error.status === 0 ? 'network' : 'http';
        const message = reason === 'conflict' ? 'L’inventaire a été modifié depuis son chargement.' : 'Échec de l’enregistrement. Les modifications restantes sont conservées.';
        setState(entry.id, reason === 'conflict' ? { status: 'conflict', message } : { status: 'error', message }); setBulkSaveState({ status: 'stopped', total: queue.length, saved, failedOccurrenceId: entry.id, reason }); return;
      }
    }
    setBulkSaveState({ status: 'completed', total: queue.length, saved }); window.setTimeout(() => setBulkSaveState({ status: 'idle' }), 2500);
  }, [bulkSaveState.status, params, setState]);
  const isBulkSaving = bulkSaveState.status === 'saving';
  return { saveOccurrence, saveAllDirtyOccurrences, bulkSaveState, isBulkSaving, resolveConflictByReloading, dismissConflict, showConflict, getSaveState: (id: string) => states[id] ?? { status: 'idle' }, getFieldErrors: (id: string) => errors[id] ?? {}, clearStates };
}
