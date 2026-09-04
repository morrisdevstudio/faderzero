import { useId } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/ui/components/Button';
import { FzIcon } from '@/ui/icons';
import { useDialogAccessibility } from './useDialogAccessibility';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  closeLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  isBusy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  onDismiss?: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  closeLabel = 'Fermer',
  confirmVariant = 'danger',
  isBusy = false,
  onConfirm,
  onCancel,
  onDismiss,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const requestCancel = () => {
    if (!isBusy) {
      onCancel();
    }
  };
  const requestDismiss = () => {
    if (!isBusy) {
      (onDismiss ?? onCancel)();
    }
  };
  const dialogRef = useDialogAccessibility(requestDismiss, isOpen);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(4rem,env(safe-area-inset-top))] sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestDismiss();
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
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-[1.35rem] font-black tracking-tight text-white">
            {title}
          </h2>
          {onDismiss ? (
            <button
              type="button"
              onClick={requestDismiss}
              disabled={isBusy}
              aria-label={closeLabel}
              className="fz-dialog-close shrink-0"
            >
              <FzIcon name="close" usageId="confirm-dialog.close" size="md" />
            </button>
          ) : null}
        </div>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-[var(--fz-text-muted)]">{description}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            onClick={requestCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => void onConfirm()}
            loading={isBusy}
            disabled={isBusy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
