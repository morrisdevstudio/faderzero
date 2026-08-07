import { useCallback, useEffect, useMemo, useState } from 'react';

export const editableKeys = ['lucideIcon', 'faderzeroName', 'reason', 'status', 'notes'] as const;
export type EditableKey = typeof editableKeys[number];
export type EditableOccurrenceFields = Partial<Record<EditableKey, string>>;
export type CatalogOccurrence = {
  occurrenceId: string;
  proposal?: { lucideIcon?: string; faderzeroName?: string; reason?: string };
  decision?: { status?: string; notes?: string };
  status?: string;
};

function comparable(value: unknown) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value.trim() : JSON.stringify(value);
}

export function editableValues(item: CatalogOccurrence): EditableOccurrenceFields {
  return {
    lucideIcon: item.proposal?.lucideIcon,
    faderzeroName: item.proposal?.faderzeroName,
    reason: item.proposal?.reason,
    status: item.decision?.status ?? item.status,
    notes: item.decision?.notes,
  };
}

function valuesFor(items: CatalogOccurrence[]) {
  return Object.fromEntries(items.map((item) => [item.occurrenceId, editableValues(item)]));
}

export function useIconCatalogEdits(items: CatalogOccurrence[]) {
  const [serverValues, setServerValues] = useState<Record<string, EditableOccurrenceFields>>({});
  const [drafts, setDrafts] = useState<Record<string, EditableOccurrenceFields>>({});

  useEffect(() => {
    setServerValues(valuesFor(items));
    // A targeted server update must never erase another local draft.
    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => items.some((item) => item.occurrenceId === id))));
  }, [items]);

  const changed = useCallback((id: string, values = { ...serverValues[id], ...drafts[id] }) => editableKeys.filter((key) => comparable(values[key]) !== comparable(serverValues[id]?.[key])), [drafts, serverValues]);
  const dirtyOccurrenceIds = useMemo(() => Object.keys(drafts).filter((id) => changed(id).length > 0), [drafts, changed]);

  const getDraft = useCallback((id: string) => ({ ...serverValues[id], ...drafts[id] }), [drafts, serverValues]);
  const updateField = useCallback((id: string, key: EditableKey, value: string) => setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } })), []);
  const resetOccurrence = useCallback((id: string) => setDrafts((current) => { const next = { ...current }; delete next[id]; return next; }), []);
  const resetAll = useCallback(() => setDrafts({}), []);
  const commitOccurrence = useCallback((item: CatalogOccurrence, sent?: EditableOccurrenceFields) => {
    setServerValues((current) => ({ ...current, [item.occurrenceId]: editableValues(item) }));
    setDrafts((current) => {
      const currentDraft = { ...serverValues[item.occurrenceId], ...current[item.occurrenceId] };
      if (sent && editableKeys.some((key) => comparable(currentDraft[key]) !== comparable(sent[key]))) return current;
      const next = { ...current }; delete next[item.occurrenceId]; return next;
    });
  }, [serverValues]);
  const replaceServerValues = useCallback((nextItems: CatalogOccurrence[], preserveDrafts: boolean) => {
    setServerValues(valuesFor(nextItems));
    if (!preserveDrafts) setDrafts({});
  }, []);

  return { getDraft, updateField, resetOccurrence, resetAll, commitOccurrence, replaceServerValues, isOccurrenceDirty: (id: string) => changed(id).length > 0, getDirtyFields: (id: string) => changed(id), dirtyOccurrenceIds, dirtyCount: dirtyOccurrenceIds.length, hasUnsavedChanges: dirtyOccurrenceIds.length > 0 };
}
