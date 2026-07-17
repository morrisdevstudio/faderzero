import { useEffect, useState } from 'react';

export type SortMode = 'title-asc' | 'title-desc' | 'updated-desc' | 'updated-asc';

interface SortMenuProps {
  value: SortMode;
  onChange: (value: SortMode) => void;
  label?: string;
}

const options: Array<{ value: SortMode; label: string }> = [
  { value: 'title-asc', label: 'A → Z' },
  { value: 'title-desc', label: 'Z → A' },
  { value: 'updated-desc', label: 'Modification récente' },
  { value: 'updated-asc', label: 'Modification ancienne' },
];

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 5v14" />
      <path d="m4 8 3-3 3 3" />
      <path d="M17 19V5" />
      <path d="m14 16 3 3 3-3" />
    </svg>
  );
}

export function SortMenu({ value, onChange, label = 'Trier' }: SortMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0]!;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`${label} : ${selectedOption.label}`}
        className="flex h-10 w-10 items-center justify-center text-white/65 transition hover:text-white"
      >
        <span className="h-5 w-5">
          <SortIcon />
        </span>
      </button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sort-menu-title"
            className="w-full max-w-md rounded-[1.6rem] border border-white/10 bg-[var(--fz-bg)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Tri</p>
                <h2 id="sort-menu-title" className="mt-1 text-[1.28rem] font-black tracking-tight text-white">{label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer"
                className="fz-dialog-close"
              >
                &times;
              </button>
            </div>
            <div role="menu" className="space-y-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={value === option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={[
                    'min-h-12 w-full rounded-xl border px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] transition',
                    value === option.value
                      ? 'border-white/20 bg-white text-[#111319]'
                      : 'border-white/8 bg-white/5 text-white hover:bg-white/10',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
