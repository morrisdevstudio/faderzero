import type { IssueReportDraftRecord } from '@/db/schema';
import { supabase } from '@/services/supabase/client';

export interface CreatedIssueReport {
  issueNumber: number;
  issueUrl: string;
}

export async function submitIssueReport(draft: IssueReportDraftRecord, screenshot?: Blob): Promise<CreatedIssueReport> {
  const apiUrl = import.meta.env.VITE_ISSUE_REPORT_API_URL?.trim().replace(/\/$/, '');
  if (!apiUrl) throw new Error('Le service de signalement GitHub n’est pas configuré.');

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Reconnectez-vous avant d’envoyer le signalement.');

  const payload = new FormData();
  payload.set('id', draft.id);
  payload.set('category', draft.category);
  payload.set('title', draft.title.trim());
  payload.set('description', draft.description.trim());
  payload.set('diagnostics', JSON.stringify(draft.diagnostics));
  if (screenshot) payload.set('screenshot', screenshot, `${draft.id}.webp`);

  const response = await fetch(`${apiUrl}/reports`, {
    method: 'POST',
    headers: { authorization: `Bearer ${data.session.access_token}` },
    body: payload,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(isErrorBody(body) ? body.error : `Envoi impossible (${response.status}).`);
  }
  if (!isCreatedIssue(body)) throw new Error('Réponse invalide du service de signalement.');
  return body;
}

function isErrorBody(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}

function isCreatedIssue(value: unknown): value is CreatedIssueReport {
  return typeof value === 'object' && value !== null &&
    'issueNumber' in value && typeof value.issueNumber === 'number' &&
    'issueUrl' in value && typeof value.issueUrl === 'string';
}

