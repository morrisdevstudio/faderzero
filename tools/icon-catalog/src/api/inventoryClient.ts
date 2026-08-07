export type LoadedInventory = { revision: string; inventory: { icons: Record<string, unknown>[] } };
export type OccurrenceChanges = { proposal?: Partial<{ lucideIcon: string; faderzeroName: string; reason: string }>; decision?: Partial<{ status: string; notes: string }> };
export class InventoryApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); this.name = 'InventoryApiError'; }
}
async function body(response: Response) {
  try { return await response.json() as Record<string, unknown>; } catch { throw new InventoryApiError(response.status, 'INVALID_RESPONSE', 'Réponse serveur invalide.'); }
}
function error(response: Response, payload: Record<string, unknown>) {
  const value = payload.error as { code?: unknown; message?: unknown } | undefined;
  return new InventoryApiError(response.status, typeof value?.code === 'string' ? value.code : 'HTTP_ERROR', typeof value?.message === 'string' ? value.message : 'Erreur du catalogue.');
}
export async function loadInventory(): Promise<LoadedInventory> {
  let response: Response;
  try { response = await fetch('/api/icon-inventory'); } catch { throw new InventoryApiError(0, 'NETWORK_ERROR', 'Impossible de contacter le catalogue.'); }
  const payload = await body(response);
  if (!response.ok) throw error(response, payload);
  if (typeof payload.revision !== 'string' || !payload.revision || !payload.inventory || typeof payload.inventory !== 'object') throw new InventoryApiError(response.status, 'INVALID_RESPONSE', 'Réponse serveur incomplète.');
  return payload as unknown as LoadedInventory;
}
export async function updateOccurrence(id: string, revision: string, changes: OccurrenceChanges): Promise<{ revision: string; occurrence: Record<string, unknown> }> {
  let response: Response;
  try { response = await fetch(`/api/icon-inventory/occurrences/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision, changes }) }); } catch { throw new InventoryApiError(0, 'NETWORK_ERROR', 'Impossible de contacter le catalogue.'); }
  const payload = await body(response);
  if (!response.ok) throw error(response, payload);
  if (typeof payload.revision !== 'string' || !payload.revision || !payload.occurrence || typeof payload.occurrence !== 'object') throw new InventoryApiError(response.status, 'INVALID_RESPONSE', 'Réponse serveur incomplète.');
  return payload as { revision: string; occurrence: Record<string, unknown> };
}
