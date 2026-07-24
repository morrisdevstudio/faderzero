import { useEffect, useRef, type PropsWithChildren, type UIEvent } from 'react';
import { createPortal } from 'react-dom';

const wheelItemHeight = 64;
const wheelViewportHeight = 256;
const wheelCenterPadding = wheelViewportHeight / 2 - wheelItemHeight / 2;

export function PickerDialog({
  title,
  description,
  closeLabel = 'Fermer',
  onClose,
  children,
}: PropsWithChildren<{ title: string; description?: string; closeLabel?: string; onClose: () => void }>) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="fz-card w-full max-w-md rounded-[1.6rem] p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[1.28rem] font-black tracking-tight text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-[var(--fz-text-muted)]">{description}</p> : null}
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
    </div>,
    document.body,
  );
}

export function PickerTrigger({
  label,
  value,
  onClick,
  disabled = false,
  emphasized = false,
}: {
  label: string;
  value: string;
  onClick: () => void;
  disabled?: boolean;
  emphasized?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex w-full min-w-0 flex-col items-center justify-between gap-1 rounded-[1rem] border p-2.5 text-center transition disabled:opacity-60',
        emphasized ? 'border-white/16 bg-black/24' : 'border-white/8 bg-white/4',
      ].join(' ')}
    >
      <span className="block text-[0.62rem] font-black uppercase leading-tight tracking-[0.16em] text-[var(--fz-text-muted)]">{label}</span>
      <span className="block whitespace-nowrap text-[0.9rem] font-black leading-tight text-white">{value}</span>
    </button>
  );
}

export function WheelColumn({
  options,
  selectedValue,
  onSelect,
  suffix,
  emptyLabel = '--',
  framed = true,
}: {
  options: readonly string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  suffix?: string;
  emptyLabel?: string;
  framed?: boolean;
}) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const hasInitializedScrollRef = useRef(false);

  useEffect(() => {
    if (hasInitializedScrollRef.current) {
      return;
    }

    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option === selectedValue),
    );
    const nextScrollTop = selectedIndex * wheelItemHeight;
    const element = scrollAreaRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = nextScrollTop;
    hasInitializedScrollRef.current = true;
  }, [options, selectedValue]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  function commitCenteredValue(scrollTop: number) {
    const nextIndex = Math.max(0, Math.min(options.length - 1, Math.round(scrollTop / wheelItemHeight)));
    const nextValue = options[nextIndex] ?? '';
    if (nextValue !== selectedValue) {
      onSelect(nextValue);
    }
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nextScrollTop = element.scrollTop;
    commitCenteredValue(nextScrollTop);

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      element.scrollTo({
        top: Math.round(nextScrollTop / wheelItemHeight) * wheelItemHeight,
        behavior: 'auto',
      });
    }, 180);
  }

  return (
    <div
      className={[
        'relative h-64 overflow-hidden',
        framed ? 'rounded-2xl border border-white/8 bg-black/45' : 'bg-transparent',
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14 bg-gradient-to-b from-black via-black/55 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-14 bg-gradient-to-t from-black via-black/55 to-transparent"
      />
      {framed ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-2 top-1/2 z-30 h-14 -translate-y-1/2 rounded-xl bg-white/8 ring-1 ring-inset ring-white/20"
        />
      ) : null}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="relative z-10 h-full snap-y snap-proximity overflow-y-auto overscroll-contain scrollbar-none"
      >
        <div style={{ height: `${wheelCenterPadding}px` }} />
        {options.map((option) => {
          const displayValue = option || emptyLabel;

          return (
            <button
              key={`${suffix ?? 'value'}-${displayValue}`}
              type="button"
              data-picker-selected={option === selectedValue ? 'true' : 'false'}
              onClick={() => onSelect(option)}
              className={[
                'flex h-16 w-full snap-center items-center justify-center gap-1.5 px-3 text-center text-[1.05rem] font-black tabular-nums transition-colors',
                option === selectedValue ? 'text-white' : 'text-white/45',
              ].join(' ')}
            >
              <span>{displayValue}</span>
              {suffix ? <span className={option === selectedValue ? 'text-white/70' : 'text-white/35'}>{suffix}</span> : null}
            </button>
          );
        })}
        <div style={{ height: `${wheelCenterPadding}px` }} />
      </div>
    </div>
  );
}
