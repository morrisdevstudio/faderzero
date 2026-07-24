import { useLayoutEffect, useRef, useState, type ChangeEvent, type FocusEvent } from 'react';
import { PickerDialog, PickerTrigger, WheelColumn } from '@/components/PickerDialog';
import type { SongStatus } from '@/db/schema';
import { bpmOptions, songStatusOptions } from '@/features/songs/songPresentation';

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
const durationMinuteOptions = Array.from({ length: 100 }, (_, index) => String(index).padStart(2, '0'));
const durationSecondOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const lyricsBlockOptions = ['[Couplet]', '[Intro]', '[Refrain]', '[Pont]', '[Solo]'] as const;

function formatDurationLabel(minutes: string, seconds: string) {
  return `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
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

