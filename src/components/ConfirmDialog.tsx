import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useDialogAccessibility } from './useDialogAccessibility';

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
  const titleId = useId();
  const descriptionId = useId();
  const requestCancel = () => {
    if (!isBusy) {
      onCancel();
    }
  };
  const dialogRef = useDialogAccessibility(requestCancel, isOpen);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(4rem,env(safe-area-inset-top))] sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="fz-card fz-dialog-panel fz-dialog-panel--bottom w-full max-w-sm rounded-[1.5rem] p-5"
      >
        <h2 id={titleId} className="text-[1.35rem] font-black tracking-tight text-white">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-[var(--fz-text-muted)]">{description}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={requestCancel}
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
