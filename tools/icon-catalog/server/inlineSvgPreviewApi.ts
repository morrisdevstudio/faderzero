import type { IncomingMessage, ServerResponse } from 'node:http';
import type { InventoryRepository } from './inventoryRepository';
import { previewInlineSvg } from './inlineSvgPreview';

const sendJson = (response: ServerResponse, status: number, code: string, message: string) => { response.statusCode = status; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ error: { code, message } })); };

export function inlineSvgPreviewApi(repository: InventoryRepository, repositoryRoot: string) {
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const match = request.url?.match(/^\/api\/icon-inline\/([^/?]+)$/);
    if (!match) return next();
    if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return sendJson(response, 405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.'); }
    let occurrenceId: string;
    try { occurrenceId = decodeURIComponent(match[1]); } catch { return sendJson(response, 400, 'INVALID_OCCURRENCE_ID', 'Identifiant invalide.'); }
    if (!/^[A-Za-z0-9_-]+$/.test(occurrenceId)) return sendJson(response, 400, 'INVALID_OCCURRENCE_ID', 'Identifiant invalide.');
    return repository.read().then(async ({ inventory }) => {
      const occurrence = inventory.icons.find((icon) => icon.occurrenceId === occurrenceId);
      if (!occurrence) return sendJson(response, 404, 'OCCURRENCE_NOT_FOUND', 'Occurrence inconnue.');
      if (occurrence.format !== 'inline-svg' || occurrence.kind !== 'inline-svg') return sendJson(response, 400, 'INCOMPATIBLE_OCCURRENCE', 'Occurrence incompatible.');
      const preview = await previewInlineSvg(repositoryRoot, occurrence);
      if (preview.status === 'available') { response.statusCode = 200; response.setHeader('content-type', 'image/svg+xml'); return response.end(preview.svg); }
      const status = preview.reason === 'Fichier source introuvable' ? 404 : preview.reason === 'SVG dynamique non extractible statiquement' || preview.reason === 'occurrence SVG ambiguë' ? 409 : 400;
      return sendJson(response, status, 'INLINE_SVG_UNAVAILABLE', preview.reason);
    }).catch(() => sendJson(response, 500, 'INLINE_SVG_READ_FAILED', 'Aperçu SVG indisponible.'));
  };
}
