import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FzIcon, type IconRoleKey } from '@/ui/icons';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: IconRoleKey;
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}

interface ContextMenuProps {
  ariaLabel: string;
  trigger: ReactNode;
  items: ContextMenuItem[];
}

/** A compact, anchored action menu for contextual row controls. */
export function ContextMenu({ ariaLabel, trigger, items }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-accent)]"
      >
        {trigger}
      </button>
      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          className="absolute right-0 top-[calc(100%+0.25rem)] z-30 min-w-52 overflow-hidden rounded-xl border border-white/10 bg-[var(--fz-bg-elevated)] p-1 shadow-xl"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setIsOpen(false);
                item.onSelect();
              }}
              className={[
                'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40',
                item.tone === 'danger' ? 'text-rose-300 hover:bg-rose-500/10' : 'text-white',
              ].join(' ')}
            >
              <FzIcon name={item.icon} usageId={`context-menu.${item.id}`} size="sm" className="shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
