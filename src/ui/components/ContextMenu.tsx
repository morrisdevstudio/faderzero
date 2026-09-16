import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusItem = useCallback((startIndex: number, direction = 1) => {
    for (let offset = 0; offset < items.length; offset += 1) {
      const index = (startIndex + offset * direction + items.length) % items.length;
      if (!items[index]?.disabled) {
        itemRefs.current[index]?.focus();
        return;
      }
    }
  }, [items]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) focusItem(0);
  }, [focusItem, isOpen]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setIsOpen(true);
    requestAnimationFrame(() => focusItem(event.key === 'ArrowDown' ? 0 : items.length - 1, event.key === 'ArrowDown' ? 1 : -1));
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const activeIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusItem(event.key === 'Home' ? 0 : items.length - 1, event.key === 'Home' ? 1 : -1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      focusItem((activeIndex + direction + items.length) % items.length, direction);
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onKeyDown={handleTriggerKeyDown}
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
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-[calc(100%+0.25rem)] z-30 min-w-52 overflow-hidden rounded-xl border border-white/10 bg-[var(--fz-bg-elevated)] p-1 shadow-xl"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => { itemRefs.current[index] = element; }}
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
