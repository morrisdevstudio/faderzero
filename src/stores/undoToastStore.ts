import { create } from 'zustand';

export interface UndoToastItem {
  id: string;
  message: string;
  onUndo: () => Promise<void> | void;
  durationMs?: number;
}

interface UndoToastStoreState {
  toast: UndoToastItem | null;
  showUndoToast: (item: Omit<UndoToastItem, 'id'>) => void;
  dismissUndoToast: () => void;
}

export const useUndoToastStore = create<UndoToastStoreState>((set) => ({
  toast: null,
  showUndoToast: (item) =>
    set({
      toast: {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
    }),
  dismissUndoToast: () => set({ toast: null }),
}));
