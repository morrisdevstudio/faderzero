import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FocusEvent, type PropsWithChildren, type UIEvent } from 'react';
import { createPortal } from 'react-dom';
import type { SongStatus } from '@/db/schema';
import { songStatusOptions } from '@/features/songs/songPresentation';

export interface SongFormValues {
  title: string;
  lyrics: string;
  key: string;
  bpm: string;
  status: SongStatus;
  durationMinutes: string;
  durationSeconds: string;
  notes: string;
}

interface SongFormFieldsProps {
  values: SongFormValues;
  onChange: (nextValues: SongFormValues) => void;
  disabled?: boolean;
}

type ActivePicker = 'status' | 'key' | 'bpm' | 'duration' | null;

const keyOptions = ['', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const bpmOptions = ['', ...Array.from({ length: 271 }, (_, index) => String(index + 30))];
const durationMinuteOptions = Array.from({ length: 100 }, (_, index) => String(index).padStart(2, '0'));
const durationSecondOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const lyricsBlockOptions = ['[Couplet]', '[Intro]', '[Refrain]', '[Pont]', '[Solo]'] as const;
const wheelItemHeight = 64;
const wheelViewportHeight = 256;
const wheelCenterPadding = wheelViewportHeight / 2 - wheelItemHeight / 2;

function formatDurationLabel(minutes: string, seconds: string) {
  return `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
}

function PickerDialog({
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
        className="w-full max-w-md rounded-[1.6rem] border border-white/10 bg-[var(--fz-bg)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
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

function PickerTrigger({
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

function WheelColumn({
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

export function SongFormFields({ values, onChange, disabled = false }: SongFormFieldsProps) {
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [isLyricsFocused, setIsLyricsFocused] = useState(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lyricsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lyricsShortcutPointerDownRef = useRef(false);

  useLayoutEffect(() => {
    const textarea = notesTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [values.notes]);

  useLayoutEffect(() => {
    const textarea = lyricsTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [values.lyrics]);

  function updateField<K extends keyof SongFormValues>(field: K, value: SongFormValues[K]) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  function handleTextAreaChange(field: 'lyrics' | 'notes') {
    return (event: ChangeEvent<HTMLTextAreaElement>) => {
      updateField(field, event.target.value);
    };
  }

  function handleInputChange(field: 'title') {
    return (event: ChangeEvent<HTMLInputElement>) => {
      updateField(field, event.target.value);
    };
  }

  function handleDurationChange(field: 'durationMinutes' | 'durationSeconds', value: string) {
    updateField(field, value);
  }

  function handleLyricsFocus() {
    setIsLyricsFocused(true);
  }

  function handleLyricsBlur(event: FocusEvent<HTMLTextAreaElement>) {
    const nextFocusedElement = event.relatedTarget;
    if (nextFocusedElement instanceof HTMLElement && nextFocusedElement.dataset.lyricsShortcut === 'true') {
      return;
    }

    setIsLyricsFocused(false);
  }

  function insertLyricsBlock(blockLabel: string) {
    const textarea = lyricsTextareaRef.current;
    const currentValue = values.lyrics;

    if (!textarea) {
      updateField('lyrics', currentValue ? `${currentValue}\n\n${blockLabel}\n` : `${blockLabel}\n`);
      return;
    }

    const selectionStart = textarea.selectionStart ?? currentValue.length;
    const selectionEnd = textarea.selectionEnd ?? currentValue.length;
    const prefix = currentValue.slice(0, selectionStart);
    const suffix = currentValue.slice(selectionEnd);
    const needsLeadingBreak = prefix.length > 0 && !prefix.endsWith('\n') ? '\n' : '';
    const needsExtraGap = prefix.length > 0 ? '\n' : '';
    const insertion = `${needsLeadingBreak}${needsExtraGap}${blockLabel}\n`;
    const nextValue = `${prefix}${insertion}${suffix}`;
    const nextCursorPosition = prefix.length + insertion.length;

    updateField('lyrics', nextValue);
    setIsLyricsFocused(true);

    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    }, 0);
  }

  return (
    <>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Titre</span>
          <input
            value={values.title}
            onChange={handleInputChange('title')}
            placeholder="Ex. Last Train Home"
            disabled={disabled}
            className="fz-input text-base"
          />
        </label>

        <div className="grid grid-cols-4 gap-2">
          <PickerTrigger
            label="Etat"
            value={songStatusOptions.find((option) => option.value === values.status)?.label ?? values.status}
            onClick={() => setActivePicker('status')}
            disabled={disabled}
          />
          <PickerTrigger
            label="Tonalite"
            value={values.key || '--'}
            onClick={() => setActivePicker('key')}
            disabled={disabled}
          />
          <PickerTrigger
            label="TEMPO"
            value={values.bpm ? `${values.bpm} BPM` : '--'}
            onClick={() => setActivePicker('bpm')}
            disabled={disabled}
          />
          <PickerTrigger
            label="Duree"
            value={formatDurationLabel(values.durationMinutes, values.durationSeconds)}
            onClick={() => setActivePicker('duration')}
            disabled={disabled}
          />
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Notes</span>
          <textarea
            ref={notesTextareaRef}
            value={values.notes}
            onChange={handleTextAreaChange('notes')}
            rows={1}
            placeholder="Repere scene, structure, remarques..."
            disabled={disabled}
            className="fz-input min-h-0 resize-none overflow-hidden text-sm leading-6"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Paroles</span>
          {isLyricsFocused ? (
            <div
              className="sticky z-20 mb-3 rounded-[1rem] bg-[var(--fz-panel-strong)] py-1"
              style={{ top: 'calc(var(--fz-header-height, 64px) + var(--fz-viewport-offset-top, 0px) + 76px)' }}
            >
              <div className="overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch]">
                <div className="flex min-w-max items-center gap-2 px-1 py-1">
                  {lyricsBlockOptions.map((blockLabel) => (
                    <button
                      key={blockLabel}
                      type="button"
                      data-lyrics-shortcut="true"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        lyricsShortcutPointerDownRef.current = true;
                      }}
                      onClick={(event) => {
                        const isPointerClick = event.detail > 0;
                        const receivedPointerDown = lyricsShortcutPointerDownRef.current;
                        lyricsShortcutPointerDownRef.current = false;

                        // The toolbar appears on textarea focus and can move under an
                        // already-started pointer click. Only accept pointer clicks
                        // whose pointerdown actually started on this shortcut.
                        if (isPointerClick && !receivedPointerDown) {
                          return;
                        }

                        insertLyricsBlock(blockLabel);
                      }}
                      className="shrink-0 whitespace-nowrap rounded-[0.85rem] border border-white/10 bg-black/18 px-3 py-2 text-sm font-black text-white/82 transition hover:bg-white/8"
                    >
                      {blockLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <textarea
            ref={lyricsTextareaRef}
            value={values.lyrics}
            onChange={handleTextAreaChange('lyrics')}
            onFocus={handleLyricsFocus}
            onBlur={handleLyricsBlur}
            rows={10}
            placeholder="Couplets, refrains, accords..."
            disabled={disabled}
            className="fz-input min-h-52 resize-none overflow-hidden text-sm leading-7"
          />
        </label>

      </div>

      {activePicker === 'status' ? (
        <PickerDialog title="Statut de creation" onClose={() => setActivePicker(null)}>
          <div className="grid grid-cols-3 gap-3">
            {songStatusOptions.map((statusOption) => {
              const isSelected = values.status === statusOption.value;
              return (
                <button
                  key={statusOption.value}
                  type="button"
                  data-picker-selected={isSelected ? 'true' : 'false'}
                  onClick={() => {
                    updateField('status', statusOption.value);
                    setActivePicker(null);
                  }}
                  className={[
                    'rounded-2xl px-4 py-4 text-sm font-black transition',
                    isSelected ? 'bg-indigo-500 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]' : 'bg-white/6 text-white/78',
                  ].join(' ')}
                >
                  {statusOption.label}
                </button>
              );
            })}
          </div>
        </PickerDialog>
      ) : null}

      {activePicker === 'key' ? (
        <PickerDialog title="Selectionner la Tonalite" onClose={() => setActivePicker(null)}>
          <div className="grid grid-cols-4 gap-3">
            {keyOptions.map((keyOption) => {
              const displayValue = keyOption || '--';
              const isSelected = values.key === keyOption;

              return (
                <button
                  key={displayValue}
                  type="button"
                  data-picker-selected={isSelected ? 'true' : 'false'}
                  onClick={() => {
                    updateField('key', keyOption);
                    setActivePicker(null);
                  }}
                  className={[
                    'rounded-2xl px-4 py-4 text-sm font-black transition',
                    isSelected ? 'bg-emerald-500 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]' : 'bg-white/6 text-white/78',
                  ].join(' ')}
                >
                  {displayValue}
                </button>
              );
            })}
          </div>
        </PickerDialog>
      ) : null}

      {activePicker === 'bpm' ? (
        <PickerDialog title="Sélectionner le tempo" closeLabel="Fermer" onClose={() => setActivePicker(null)}>
          <WheelColumn options={bpmOptions} selectedValue={values.bpm} onSelect={(value) => updateField('bpm', value)} suffix="BPM" />
        </PickerDialog>
      ) : null}

      {activePicker === 'duration' ? (
        <PickerDialog title="Sélectionner la durée" closeLabel="Fermer" onClose={() => setActivePicker(null)}>
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/35 p-2">
            <div className="relative grid grid-cols-2 overflow-hidden rounded-xl">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-1/2 z-0 h-14 -translate-y-1/2 rounded-xl bg-white/8 ring-1 ring-inset ring-white/18" />
              <div aria-hidden="true" className="pointer-events-none absolute bottom-4 left-1/2 top-4 z-20 w-px bg-white/8" />
              <WheelColumn
                options={durationMinuteOptions}
                selectedValue={values.durationMinutes}
                onSelect={(value) => handleDurationChange('durationMinutes', value)}
                suffix="min"
                framed={false}
              />
              <WheelColumn
                options={durationSecondOptions}
                selectedValue={values.durationSeconds}
                onSelect={(value) => handleDurationChange('durationSeconds', value)}
                suffix="sec"
                framed={false}
              />
            </div>
          </div>
        </PickerDialog>
      ) : null}
    </>
  );
}

