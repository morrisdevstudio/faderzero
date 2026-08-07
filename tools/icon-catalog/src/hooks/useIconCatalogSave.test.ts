import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InventoryApiError, updateOccurrence } from '../api/inventoryClient';
import { useIconCatalogSave, validateEditableFields } from './useIconCatalogSave';

vi.mock('../api/inventoryClient', async () => {
  const actual = await vi.importActual<typeof import('../api/inventoryClient')>('../api/inventoryClient');
  return { ...actual, updateOccurrence: vi.fn() };
});
const update = vi.mocked(updateOccurrence);
const occurrence = { occurrenceId: 'one', proposal: { lucideIcon: 'Calendar', reason: 'old' }, decision: { status: 'review', notes: 'old' }, sourceFile: 'kept', unknown: true };

function setup(draft = { ...occurrence.proposal, status: 'review', notes: 'new' }) {
  let revision = 'sha256:one'; const setRevision = vi.fn((next: string) => { revision = next; });
  const getDraft = vi.fn(() => draft); const getDirtyFields = vi.fn(() => ['notes'] as const); const commitOccurrence = vi.fn(); const replaceServerValues = vi.fn(); const updateServerOccurrence = vi.fn(); const load = vi.fn(async () => ({ revision: 'sha256:remote', inventory: { icons: [occurrence] } })); const replaceInventory = vi.fn();
  const hook = renderHook(() => useIconCatalogSave({ revision, setRevision, getDraft, getDirtyFields, commitOccurrence, replaceServerValues, updateServerOccurrence, load, replaceInventory }));
  return { ...hook, setRevision, getDraft, getDirtyFields, commitOccurrence, replaceServerValues, updateServerOccurrence, load, replaceInventory };
}

describe('useIconCatalogSave', () => {
  beforeEach(() => { update.mockReset(); });
  it('saves one dirty occurrence with only its changed allowed field and chains revisions', async () => {
    update.mockResolvedValueOnce({ revision: 'sha256:two', occurrence }).mockResolvedValueOnce({ revision: 'sha256:three', occurrence });
    const test = setup();
    await act(async () => { await test.result.current.saveOccurrence('one'); });
    expect(update).toHaveBeenCalledWith('one', 'sha256:one', { decision: { notes: 'new' } });
    expect(JSON.stringify(update.mock.calls[0][2])).not.toContain('sourceFile');
    expect(test.commitOccurrence).toHaveBeenCalledWith(occurrence, expect.objectContaining({ notes: 'new' }));
    await act(async () => { await test.result.current.saveOccurrence('one'); });
    expect(update.mock.calls[1][1]).toBe('sha256:two');
  });
  it('preserves drafts after 400, 404, network and revision conflict errors', async () => {
    const cases = [new InventoryApiError(400, 'INVALID_CHANGES', 'bad'), new InventoryApiError(404, 'OCCURRENCE_NOT_FOUND', 'gone'), new InventoryApiError(409, 'REVISION_CONFLICT', 'old'), new Error('offline')];
    for (const error of cases) {
      update.mockRejectedValueOnce(error); const test = setup();
      await act(async () => { await test.result.current.saveOccurrence('one'); });
      expect(test.commitOccurrence).not.toHaveBeenCalled();
      expect(test.result.current.getSaveState('one').status).toBe(error instanceof InventoryApiError && error.status === 409 ? 'conflict' : 'error');
    }
  });
  it('reloads a conflict revision without discarding the draft', async () => {
    update.mockRejectedValueOnce(new InventoryApiError(409, 'REVISION_CONFLICT', 'old')); const test = setup();
    await act(async () => { await test.result.current.saveOccurrence('one'); });
    await act(async () => { await test.result.current.resolveConflictByReloading('one'); });
    expect(test.load).toHaveBeenCalledOnce(); expect(test.setRevision).toHaveBeenCalledWith('sha256:remote');
    expect(test.replaceServerValues).toHaveBeenCalledWith([occurrence], true);
    expect(test.commitOccurrence).not.toHaveBeenCalled();
  });
  it('does not send a clean, invalid, or duplicate save', async () => {
    const clean = setup(); clean.getDirtyFields.mockReturnValue([]);
    await act(async () => { await clean.result.current.saveOccurrence('one'); }); expect(update).not.toHaveBeenCalled();
    const invalid = setup({ lucideIcon: '<svg>', status: 'review' }); invalid.getDirtyFields.mockReturnValue(['lucideIcon']);
    await act(async () => { await invalid.result.current.saveOccurrence('one'); }); expect(update).not.toHaveBeenCalled(); expect(invalid.result.current.getFieldErrors('one').lucideIcon).toBeTruthy();
    let resolve!: (value: { revision: string; occurrence: Record<string, unknown> }) => void; update.mockReturnValueOnce(new Promise((done) => { resolve = done; })); const pending = setup();
    act(() => { void pending.result.current.saveOccurrence('one'); void pending.result.current.saveOccurrence('one'); }); expect(update).toHaveBeenCalledOnce();
    await act(async () => { resolve({ revision: 'sha256:two', occurrence }); });
  });
  it('validates allowed statuses and lengths locally', () => {
    expect(validateEditableFields({ status: 'bogus' }, ['status']).status).toBeTruthy();
    expect(validateEditableFields({ notes: 'x'.repeat(4001) }, ['notes']).notes).toBeTruthy();
    expect(validateEditableFields({ notes: 'line one\nline two' }, ['notes'])).toEqual({});
  });
  it('saves a frozen dirty queue sequentially with chained revisions', async () => {
    let revision = 'sha256:r0'; const setRevision = vi.fn((next: string) => { revision = next; });
    const ids = ['a', 'b', 'c']; const items = Object.fromEntries(ids.map((id) => [id, { ...occurrence, occurrenceId: id, decision: { status: 'review', notes: id } }]));
    update.mockImplementation(async (id, currentRevision) => ({ revision: `sha256:r${Number(currentRevision.slice(-1)) + 1}`, occurrence: items[id] }));
    const test = renderHook(() => useIconCatalogSave({ revision, setRevision, dirtyOccurrenceIds: ids, getDraft: (id) => ({ status: 'review', notes: `${id}-draft` }), getDirtyFields: () => ['notes'], commitOccurrence: vi.fn(), replaceServerValues: vi.fn(), updateServerOccurrence: vi.fn(), load: vi.fn(), replaceInventory: vi.fn() }));
    await act(async () => { await test.result.current.saveAllDirtyOccurrences(); });
    expect(update.mock.calls.map((call) => [call[0], call[1]])).toEqual([['a', 'sha256:r0'], ['b', 'sha256:r1'], ['c', 'sha256:r2']]);
    expect(test.result.current.bulkSaveState).toMatchObject({ status: 'completed', saved: 3 });
  });
});
