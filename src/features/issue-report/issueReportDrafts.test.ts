import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { activateDatabase, createDatabase, getLegacyDatabase, type FaderZeroDatabase } from '@/db/db';
import type { IssueReportDraftRecord } from '@/db/schema';
import { deleteIssueReportDraft, listIssueReportDrafts, saveIssueReportDraft } from './issueReportDrafts';

let database: FaderZeroDatabase;

function draft(id: string): IssueReportDraftRecord {
  return {
    id, userId: 'user-1', stage: 'ready', category: 'bug', title: id, description: 'description', annotations: [],
    diagnostics: { route: '/songs', appVersion: 'test', capturedAt: '2026-09-12T10:00:00Z', viewport: '390×844@3', userAgent: 'test', displayMode: 'browser', online: false },
    createdAt: 1, updatedAt: 1,
  };
}

beforeEach(async () => {
  database = createDatabase(`issue-drafts-${Date.now()}-${Math.random()}`);
  await database.open();
  activateDatabase(database);
});

afterEach(async () => {
  activateDatabase(getLegacyDatabase());
  database.close();
  await database.delete();
});

describe('issue report drafts', () => {
  it('stores, orders and deletes local drafts', async () => {
    await saveIssueReportDraft(draft('first'));
    await saveIssueReportDraft({ ...draft('second'), updatedAt: 2 });
    expect((await listIssueReportDrafts('user-1')).map(({ id }) => id)).toEqual(['second', 'first']);
    await deleteIssueReportDraft('user-1', 'second');
    expect((await listIssueReportDrafts('user-1')).map(({ id }) => id)).toEqual(['first']);
  });

  it('limits new drafts to five while allowing updates', async () => {
    for (let index = 0; index < 5; index += 1) await saveIssueReportDraft(draft(`draft-${index}`));
    await expect(saveIssueReportDraft(draft('sixth'))).rejects.toThrow('Cinq signalements');
    await expect(saveIssueReportDraft({ ...draft('draft-0'), title: 'mis à jour' })).resolves.toBeUndefined();
  });

  it('isolates lists, limits and deletion by Supabase user', async () => {
    await saveIssueReportDraft(draft('mine'));
    await saveIssueReportDraft({ ...draft('theirs'), userId: 'user-2' });
    expect((await listIssueReportDrafts('user-1')).map(({ id }) => id)).toEqual(['mine']);
    await deleteIssueReportDraft('user-1', 'theirs');
    expect((await listIssueReportDrafts('user-2')).map(({ id }) => id)).toEqual(['theirs']);
    for (let index = 0; index < 4; index += 1) await saveIssueReportDraft(draft(`mine-${index}`));
    await expect(saveIssueReportDraft({ ...draft('another-theirs'), userId: 'user-2' })).resolves.toBeUndefined();
  });

  it('adds the issue report table when upgrading a v14 database', async () => {
    const name = `issue-drafts-v14-${Date.now()}-${Math.random()}`;
    const legacy = new Dexie(name);
    legacy.version(14).stores({ songs: 'id' });
    await legacy.open();
    legacy.close();
    const upgraded = createDatabase(name);
    try {
      await upgraded.open();
      expect(upgraded.verno).toBe(17);
      expect(upgraded.tables.map(({ name: tableName }) => tableName)).toContain('issueReportDrafts');
    } finally {
      upgraded.close();
      await upgraded.delete();
    }
  });
});
