import type { PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

interface FormDialogProps extends PropsWithChildren {
  eyebrow?: string;
  title: string;
  closeLabel?: string;
  onClose: () => void;
  placement?: 'center' | 'bottom';
}

export function FormDialog({ eyebrow, title, closeLabel = 'Fermer', onClose, placement = 'center', children }: FormDialogProps) {
  const isBottomSheet = placement === 'bottom';

  return createPortal(
    (
    <div
      className={[
        'fixed inset-0 z-50 flex justify-center bg-black/70 px-4 pt-16',
        isBottomSheet ? 'items-end pb-4' : 'items-start overflow-y-auto pb-5',
      ].join(' ')}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={['mx-auto w-full', isBottomSheet ? 'max-w-md' : 'max-w-sm'].join(' ')}>
        <div
          role="dialog"
          aria-modal="true"
          className={[
            'fz-card max-h-[calc(100dvh-2.5rem)] overflow-y-auto p-5',
            isBottomSheet ? 'rounded-[1.6rem]' : 'rounded-[1.9rem]',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {eyebrow ? (
                <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">{eyebrow}</p>
              ) : null}
              <h2 className={[eyebrow ? 'mt-2' : '', 'text-[1.35rem] font-black text-white'].join(' ')}>{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="fz-dialog-close"
            >
              &times;
            </button>
          </div>

          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
    ),
    document.body,
  );
}
