import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isBusy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy) {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBusy, isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="fz-card w-full max-w-sm rounded-[1.5rem] p-5"
      >
        <h2 id="confirm-dialog-title" className="text-[1.35rem] font-black tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--fz-text-muted)]">{description}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="fz-button-secondary px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isBusy}
            className="fz-button-danger px-4 py-3 text-sm font-black uppercase tracking-[0.16em] disabled:opacity-50"
          >
            {isBusy ? 'Suppression...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
