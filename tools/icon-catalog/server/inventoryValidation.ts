export const STATUSES = new Set(['discovered','review','proposed','approved','rejected','migrated','verified','custom-kept']);
export type Inventory = { schemaVersion: number; icons: Array<Record<string, unknown>>; [key: string]: unknown };
export function validateInventory(value: unknown): asserts value is Inventory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_ROOT');
  const document = value as Record<string, unknown>;
  if (typeof document.schemaVersion !== 'number' || !Array.isArray(document.icons)) throw new Error('INVALID_INVENTORY');
  const ids = new Set<string>();
  for (const icon of document.icons) {
    if (!icon || typeof icon !== 'object' || Array.isArray(icon)) throw new Error('INVALID_OCCURRENCE');
    const item = icon as Record<string, unknown>, id = item.occurrenceId;
    if (typeof id !== 'string' || !id.trim()) throw new Error('INVALID_OCCURRENCE_ID');
    if (ids.has(id)) throw new Error('DUPLICATE_OCCURRENCE_ID'); ids.add(id);
    const decision = item.decision;
    if (decision !== undefined && (!decision || typeof decision !== 'object' || Array.isArray(decision))) throw new Error('INVALID_DECISION');
    if (decision && (decision as Record<string, unknown>).status !== undefined && !STATUSES.has((decision as Record<string, unknown>).status as string)) throw new Error('INVALID_STATUS');
  }
}
export function validateChanges(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_CHANGES');
  const changes = value as Record<string, unknown>, allowed = new Set(['proposal','decision']);
  if (Object.keys(changes).some((key) => !allowed.has(key))) throw new Error('FORBIDDEN_FIELD');
  for (const [section, keys] of Object.entries({ proposal:['lucideIcon','faderzeroName','reason'], decision:['status','notes'] })) {
    const part = changes[section]; if (part === undefined) continue;
    if (!part || typeof part !== 'object' || Array.isArray(part) || Object.keys(part as object).some((key) => !keys.includes(key))) throw new Error('FORBIDDEN_FIELD');
    if (section === 'decision' && (part as Record<string, unknown>).status !== undefined && !STATUSES.has((part as Record<string, unknown>).status as string)) throw new Error('INVALID_STATUS');
  }
  return changes as { proposal?: Record<string, unknown>; decision?: Record<string, unknown> };
}
