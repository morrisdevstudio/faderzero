import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { FzIcon } from '@/ui/icons';

interface DetailHeaderProps {
  title: string;
  subtitle?: string | undefined;
  onBack: () => void;
  backLabel: string;
  actions?: ReactNode;
  titleInteraction?: Omit<ComponentPropsWithoutRef<'h1'>, 'children' | 'className' | 'style'> | undefined;
}

export function DetailHeader({ title, subtitle, onBack, backLabel, actions, titleInteraction }: DetailHeaderProps) {
  return (
    <header
      className="sticky z-30 -mx-1 -mt-5 border-b border-white/8 bg-[var(--fz-bg)] px-1 pb-4 pt-2"
      style={{ top: 'calc(var(--fz-header-height, 64px) + var(--fz-viewport-offset-top, 0px))' }}
    >
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-white/80 transition-colors hover:text-white active:text-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
        >
          <FzIcon name="back" usageId="detail-header.back" size="md" />
        </button>

        <div className="min-w-0 text-left">
          <h1
            {...titleInteraction}
            className={[
              'truncate text-xl font-black tracking-tight text-white',
              titleInteraction ? 'cursor-pointer select-none transition-colors hover:text-white/85' : '',
            ].join(' ')}
          >
            {title}
          </h1>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-[var(--fz-text-muted)]">{subtitle}</p> : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center justify-end gap-1 text-white/80 [&>*]:flex [&>*]:h-11 [&>*]:w-11 [&>*]:shrink-0 [&>*]:items-center [&>*]:justify-center [&>*]:transition-colors [&>*]:hover:text-white [&>*]:active:text-white/60 [&>*]:focus-visible:outline-2 [&>*]:focus-visible:outline-offset-2 [&>*]:focus-visible:outline-white/60">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
