import { useId, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FzIcon } from '@/ui/icons';
import { useDialogAccessibility } from './useDialogAccessibility';

interface FormDialogProps extends PropsWithChildren {
  title: string;
  closeLabel?: string;
  closeDisabled?: boolean;
  headerActions?: ReactNode;
  onClose: () => void;
  placement?: 'center' | 'bottom';
}

export function FormDialog({
  title,
  closeLabel = 'Fermer',
  closeDisabled = false,
  headerActions,
  onClose,
  placement = 'center',
  children,
}: FormDialogProps) {
  const isBottomSheet = placement === 'bottom';
  const titleId = useId();
  const requestClose = () => {
    if (!closeDisabled) {
      onClose();
    }
  };
  const dialogRef = useDialogAccessibility(requestClose);

  return createPortal(
    (
    <div
      className={[
        'fixed inset-0 z-[60] flex justify-center bg-black/70 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(4rem,env(safe-area-inset-top))]',
        isBottomSheet
          ? 'items-end pb-[max(1rem,env(safe-area-inset-bottom))]'
          : 'items-start overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]',
      ].join(' ')}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div className={['mx-auto max-h-full w-full', isBottomSheet ? 'max-w-md' : 'max-w-sm'].join(' ')}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={[
            'fz-card fz-dialog-panel p-5',
            isBottomSheet ? 'fz-dialog-panel--bottom rounded-[1.6rem]' : 'rounded-[1.9rem]',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-[1.35rem] font-black text-white">{title}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              <button
                type="button"
                onClick={requestClose}
                disabled={closeDisabled}
                aria-label={closeLabel}
                className="fz-dialog-close"
              >
                <FzIcon name="close" usageId="form-dialog.close" size="md" />
              </button>
            </div>
          </div>

          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
    ),
    document.body,
  );
}
