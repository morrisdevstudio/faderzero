import { useEffect, useState } from 'react';

export type SortMode = 'title-asc' | 'title-desc' | 'updated-desc' | 'updated-asc';

export interface MenuFilter {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

interface SortMenuProps {
  value: SortMode;
  onChange: (value: SortMode) => void;
  label?: string;
  filter?: MenuFilter;
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

export function SortMenu({ value, onChange, label = 'Trier', filter }: SortMenuProps) {
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
            className="fz-card w-full max-w-md rounded-[1.25rem] p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 id="sort-menu-title" className="text-[1.28rem] font-black tracking-tight text-white">{label}</h2>
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
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--fz-text-muted)]">Tri</p>
                <div role="menu" className="divide-y divide-white/8 border-y border-white/8">
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
                      className="flex min-h-12 w-full items-center justify-between px-1 py-3 text-left text-sm font-black text-white transition hover:bg-white/5"
                    >
                      <span>{option.label}</span>
                      {value === option.value ? <span className="text-[var(--fz-accent-strong)]" aria-hidden="true">✓</span> : null}
                    </button>
                  ))}
                </div>
              </div>
              {filter ? (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--fz-text-muted)]">{filter.label}</p>
                  <div className="divide-y divide-white/8 border-y border-white/8">
                    {filter.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={filter.value === option.value}
                        onClick={() => {
                          filter.onChange(option.value);
                          setIsOpen(false);
                        }}
                        className="flex min-h-12 w-full items-center justify-between px-1 py-3 text-left text-sm font-black text-white transition hover:bg-white/5"
                      >
                        <span>{option.label}</span>
                        {filter.value === option.value ? <span className="text-[var(--fz-accent-strong)]" aria-hidden="true">✓</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
