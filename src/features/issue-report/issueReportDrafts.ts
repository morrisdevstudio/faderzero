import Dexie from 'dexie';
import { db } from '@/db/db';
import type { IssueReportDraftRecord } from '@/db/schema';

export const MAX_ISSUE_REPORT_DRAFTS = 5;

export async function listIssueReportDrafts(userId: string): Promise<IssueReportDraftRecord[]> {
  return db.issueReportDrafts.where('[userId+updatedAt]').between([userId, Dexie.minKey], [userId, Dexie.maxKey]).reverse().toArray();
}

export async function saveIssueReportDraft(draft: IssueReportDraftRecord): Promise<void> {
  await db.transaction('rw', db.issueReportDrafts, async () => {
    const exists = await db.issueReportDrafts.get(draft.id);
    if (exists && exists.userId !== draft.userId) throw new Error('Ce brouillon appartient à une autre session.');
    const userDraftCount = await db.issueReportDrafts.where('userId').equals(draft.userId).count();
    if (!exists && userDraftCount >= MAX_ISSUE_REPORT_DRAFTS) {
      throw new Error('Cinq signalements sont déjà enregistrés sur cet appareil.');
    }
    await db.issueReportDrafts.put({ ...draft, updatedAt: Date.now() });
  });
}

export async function deleteIssueReportDraft(userId: string, id: string): Promise<void> {
  const draft = await db.issueReportDrafts.get(id);
  if (draft?.userId === userId) await db.issueReportDrafts.delete(id);
}
