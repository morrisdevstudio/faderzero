import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIconCatalogEdits } from './useIconCatalogEdits';

const items = [
  { occurrenceId: 'one', proposal: { lucideIcon: 'Calendar', reason: 'Base' }, decision: { status: 'review', notes: 'note' }, extra: 'kept' },
  { occurrenceId: 'two', status: 'discovered' },
];

describe('useIconCatalogEdits', () => {
  it('is initially clean and tracks one or many edited fields', () => {
    const { result } = renderHook(() => useIconCatalogEdits(items));
    expect(result.current.dirtyCount).toBe(0);
    act(() => result.current.updateField('one', 'lucideIcon', 'Clock'));
    act(() => result.current.updateField('one', 'notes', 'changed'));
    expect(result.current.getDirtyFields('one')).toEqual(['lucideIcon', 'notes']);
    expect(result.current.dirtyCount).toBe(1);
  });
  it('isolates occurrences and restores an original value', () => {
    const { result } = renderHook(() => useIconCatalogEdits(items));
    act(() => result.current.updateField('one', 'lucideIcon', 'Clock'));
    act(() => result.current.updateField('two', 'notes', 'x'));
    expect(result.current.dirtyCount).toBe(2);
    act(() => result.current.updateField('one', 'lucideIcon', 'Calendar'));
    expect(result.current.isOccurrenceDirty('one')).toBe(false);
    expect(result.current.isOccurrenceDirty('two')).toBe(true);
  });
  it('normalizes absent, null, empty and surrounding spaces for comparison', () => {
    const { result } = renderHook(() => useIconCatalogEdits(items));
    act(() => result.current.updateField('two', 'notes', '   '));
    expect(result.current.hasUnsavedChanges).toBe(false);
    act(() => result.current.updateField('one', 'reason', ' Base '));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
  it('resets one draft, all drafts, and replaces drafts after new server data', () => {
    const { result } = renderHook(() => useIconCatalogEdits(items));
    act(() => result.current.updateField('one', 'status', 'approved'));
    act(() => result.current.updateField('two', 'notes', 'x'));
    act(() => result.current.resetOccurrence('one'));
    expect(result.current.dirtyOccurrenceIds).toEqual(['two']);
    act(() => result.current.resetAll());
    expect(result.current.dirtyCount).toBe(0);
    act(() => result.current.updateField('one', 'notes', 'local'));
    act(() => result.current.replaceServerValues([{ ...items[0], decision: { status: 'approved', notes: 'server' } }], false));
    expect(result.current.dirtyCount).toBe(0);
    expect(result.current.getDraft('one').notes).toBe('server');
  });
});
