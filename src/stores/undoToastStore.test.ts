import { act } from '@testing-library/react';
import { useUndoToastStore } from './undoToastStore';

describe('undoToastStore', () => {
  beforeEach(() => {
    act(() => {
      useUndoToastStore.getState().dismissUndoToast();
    });
  });

  it('affiche et ferme un toast d’annulation', () => {
    expect(useUndoToastStore.getState().toast).toBeNull();

    const onUndo = vi.fn();
    act(() => {
      useUndoToastStore.getState().showUndoToast({
        message: 'Morceau supprimé',
        onUndo,
        durationMs: 4000,
      });
    });

    const toast = useUndoToastStore.getState().toast;
    expect(toast).not.toBeNull();
    expect(toast?.message).toBe('Morceau supprimé');
    expect(toast?.durationMs).toBe(4000);

    act(() => {
      useUndoToastStore.getState().dismissUndoToast();
    });

    expect(useUndoToastStore.getState().toast).toBeNull();
  });
});
