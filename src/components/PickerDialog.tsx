import { useCallback, useEffect, useId, useRef, useState, type PropsWithChildren, type ReactNode, type UIEvent } from 'react';
import { createPortal } from 'react-dom';
import { useBackLayer } from '@/hooks/useBackLayer';
import { FzIcon } from '@/ui/icons';
import { useDialogAccessibility } from './useDialogAccessibility';

const wheelItemHeight = 64;
const wheelViewportHeight = 256;
const wheelCenterPadding = wheelViewportHeight / 2 - wheelItemHeight / 2;

export function PickerDialog({
  title,
  description,
  closeLabel = 'Fermer',
  headerActions,
  onClose,
  children,
}: PropsWithChildren<{
  title: string;
  description?: string | undefined;
  closeLabel?: string | undefined;
  headerActions?: ReactNode | undefined;
  onClose: () => void;
}>) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useDialogAccessibility(onClose);
  useBackLayer(true, onClose);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(4rem,env(safe-area-inset-top))] sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="fz-card fz-dialog-panel fz-dialog-panel--bottom w-full max-w-md rounded-[1.6rem] p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[1.28rem] font-black tracking-tight text-white">{title}</h2>
            {description ? <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--fz-text-muted)]">{description}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="fz-dialog-close"
            >
              <FzIcon name="close" usageId="picker-dialog.close" size="md" />
            </button>
          </div>
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
  const programmaticScrollTopRef = useRef<number | null>(null);
  const hasInitializedScrollRef = useRef(false);
  const [centeredValue, setCenteredValue] = useState(selectedValue);
  const emphasizedItemRef = useRef<HTMLButtonElement | null>(null);

  const updateEmphasis = useCallback((element: HTMLDivElement, scrollTop: number) => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(scrollTop / wheelItemHeight)));
    const item = element.querySelectorAll('button')[index];
    if (emphasizedItemRef.current !== item) {
      emphasizedItemRef.current?.style.removeProperty('--wheel-emphasis');
    }
    const proximity = Math.max(0, 1 - Math.abs(scrollTop - index * wheelItemHeight) / (wheelItemHeight / 2));
    item?.style.setProperty('--wheel-emphasis', String(proximity));
    emphasizedItemRef.current = item ?? null;
  }, [options.length]);

  useEffect(() => {
    if (hasInitializedScrollRef.current) {
      if (scrollAreaRef.current) updateEmphasis(scrollAreaRef.current, scrollAreaRef.current.scrollTop);
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
    updateEmphasis(element, nextScrollTop);
    hasInitializedScrollRef.current = true;
  }, [options, selectedValue, updateEmphasis]);

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
    setCenteredValue(nextValue);
    if (nextValue !== selectedValue) {
      onSelect(nextValue);
    }
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nextScrollTop = element.scrollTop;
    const programmaticScrollTop = programmaticScrollTopRef.current;
    programmaticScrollTopRef.current = null;
    if (programmaticScrollTop !== null && Math.abs(nextScrollTop - programmaticScrollTop) < 1) return;
    // Update the moving row directly, before asynchronous persistence can rerender it.
    updateEmphasis(element, nextScrollTop);
    commitCenteredValue(nextScrollTop);

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      const snappedTop = Math.round(element.scrollTop / wheelItemHeight) * wheelItemHeight;
      if (element.scrollTop !== snappedTop) {
        programmaticScrollTopRef.current = snappedTop;
        element.scrollTop = snappedTop;
      }
      updateEmphasis(element, element.scrollTop);
    }, 180);
  }

  function selectIndex(index: number, focus = false) {
    const boundedIndex = Math.max(0, Math.min(options.length - 1, index));
    const element = scrollAreaRef.current;
    if (!element || options.length === 0) return;
    if (scrollTimeoutRef.current !== null) window.clearTimeout(scrollTimeoutRef.current);
    const targetTop = boundedIndex * wheelItemHeight;
    if (element.scrollTop !== targetTop) {
      programmaticScrollTopRef.current = targetTop;
      element.scrollTop = targetTop;
    }
    updateEmphasis(element, targetTop);
    setCenteredValue(options[boundedIndex]!);
    onSelect(options[boundedIndex]!);
    if (focus) element.querySelectorAll('button')[boundedIndex]?.focus({ preventScroll: true });
  }

  return (
    <div
      className={[
        'relative h-64 overflow-hidden',
        framed ? 'rounded-2xl bg-white/4' : 'bg-transparent',
      ].join(' ')}
    >
      {framed ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-2 top-1/2 h-14 -translate-y-1/2 rounded-xl bg-white/8"
        />
      ) : null}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="relative z-10 h-full snap-y snap-proximity overflow-y-auto overscroll-contain scrollbar-none"
        style={{ maskImage: 'linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)' }}
      >
        <div style={{ height: `${wheelCenterPadding}px` }} />
        {options.map((option, index) => {
          const displayValue = option || emptyLabel;

          return (
            <button
              key={`${suffix ?? 'value'}-${displayValue}`}
              type="button"
              data-picker-selected={option === centeredValue ? 'true' : 'false'}
              aria-pressed={option === centeredValue}
              aria-label={suffix ? `${displayValue} ${suffix}` : displayValue}
              tabIndex={option === centeredValue || (!options.includes(centeredValue) && index === 0) ? 0 : -1}
              onClick={() => selectIndex(index)}
              onKeyDown={(event) => {
                const targetIndex = event.key === 'ArrowDown' ? index + 1
                  : event.key === 'ArrowUp' ? index - 1
                  : event.key === 'Home' ? 0
                  : event.key === 'End' ? options.length - 1 : null;
                if (targetIndex === null) return;
                event.preventDefault();
                selectIndex(targetIndex, true);
              }}
              className={[
                'flex h-16 w-full snap-center items-center justify-center gap-2 px-3 text-center tabular-nums focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--fz-accent)]',
              ].join(' ')}
              style={{ color: 'color-mix(in srgb, var(--fz-text-muted), white calc(var(--wheel-emphasis, 0) * 100%))' }}
            >
              <span
                className="inline-block text-xl"
                style={{ fontWeight: 'calc(500 + var(--wheel-emphasis, 0) * 400)', transform: 'scale(calc(1 + var(--wheel-emphasis, 0) * 0.4))' }}
              >{displayValue}</span>
              {suffix ? <span className="text-xs font-semibold text-[var(--fz-text-muted)]">{suffix}</span> : null}
            </button>
          );
        })}
        <div style={{ height: `${wheelCenterPadding}px` }} />
      </div>
    </div>
  );
}
