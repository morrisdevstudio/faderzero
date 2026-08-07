import { readFile, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

type ReportEntry = { occurrenceId?: unknown; status?: unknown; file?: unknown; reason?: unknown };

function sendJson(response: ServerResponse, status: number, code: string, message: string) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ error: { code, message } }));
}

function isInside(root: string, candidate: string) {
  const path = relative(root, candidate);
  return path && !path.startsWith(`..${sep}`) && path !== '..';
}

export function iconCaptureApi(repositoryRoot: string) {
  const auditDirectory = resolve(repositoryRoot, 'docs/icon-audit');
  const runtimeDirectory = resolve(auditDirectory, 'screenshots/icons/runtime');
  const reportPath = resolve(auditDirectory, 'capture-report.json');
  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const match = request.url?.match(/^\/api\/icon-capture\/([^/?]+)$/);
    if (!match) return next();
    if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return sendJson(response, 405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.'); }
    let occurrenceId: string;
    try { occurrenceId = decodeURIComponent(match[1]); } catch { return sendJson(response, 400, 'INVALID_OCCURRENCE_ID', 'Identifiant invalide.'); }
    if (!/^[A-Za-z0-9_-]+$/.test(occurrenceId)) return sendJson(response, 400, 'INVALID_OCCURRENCE_ID', 'Identifiant invalide.');
    try {
      const report = JSON.parse(await readFile(reportPath, 'utf8')) as { occurrences?: ReportEntry[] };
      const entry = report.occurrences?.find((candidate) => candidate.occurrenceId === occurrenceId);
      if (!entry) return sendJson(response, 404, 'CAPTURE_NOT_FOUND', 'Capture inconnue.');
      if (entry.status !== 'captured') return sendJson(response, 409, 'CAPTURE_BLOCKED', typeof entry.reason === 'string' ? entry.reason : 'Capture non disponible.');
      if (typeof entry.file !== 'string' || !/^screenshots\/icons\/runtime\/[A-Za-z0-9_-]+\.png$/.test(entry.file)) return sendJson(response, 404, 'CAPTURE_NOT_FOUND', 'Capture inconnue.');
      const runtimeRoot = await realpath(runtimeDirectory);
      const file = await realpath(resolve(auditDirectory, entry.file));
      if (!isInside(runtimeRoot, file)) return sendJson(response, 404, 'CAPTURE_NOT_FOUND', 'Capture inconnue.');
      const image = await readFile(file);
      response.statusCode = 200;
      response.setHeader('content-type', 'image/png');
      return response.end(image);
    } catch {
      return sendJson(response, 500, 'CAPTURE_READ_FAILED', 'Capture indisponible.');
    }
  };
}
