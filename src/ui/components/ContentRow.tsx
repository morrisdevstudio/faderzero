import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface BaseContentRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  metadata?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  status?: ReactNode;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

export interface LinkContentRowProps extends BaseContentRowProps {
  mode: 'link';
  to: string;
  onClick?: () => void;
}

export interface ButtonContentRowProps extends BaseContentRowProps {
  mode: 'button';
  onClick: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export interface ControlsContentRowProps extends BaseContentRowProps {
  mode: 'controls';
  to?: string;
  id?: string;
}

export type ContentRowProps = LinkContentRowProps | ButtonContentRowProps | ControlsContentRowProps;

export function ContentRow(props: ContentRowProps) {
  const { title, subtitle, metadata, leading, trailing, status, className = '', style, 'aria-label': ariaLabel } = props;

  const baseClasses = [
    'fz-content-row group relative flex items-center justify-between gap-3.5 border-b border-white/10 px-2 py-4.5 text-left transition hover:bg-white/[0.03] active:bg-white/[0.05] last:border-b-0',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const centerContent = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-[1.12rem] font-black tracking-tight text-[var(--fz-text)] group-hover:text-white">
          {title}
        </h2>
        {status ? <div className="flex shrink-0 items-center">{status}</div> : null}
      </div>
      {subtitle ? (
        <p className="mt-0.5 truncate text-xs font-semibold text-white/60">{subtitle}</p>
      ) : null}
      {metadata ? (
        <div className="mt-1 truncate text-[0.82rem] font-medium text-[var(--fz-text-muted)]">
          {metadata}
        </div>
      ) : null}
    </>
  );

  if (props.mode === 'link') {
    return (
      <Link
        to={props.to}
        onClick={props.onClick}
        aria-label={ariaLabel}
        style={style}
        className={`block ${baseClasses}`}
      >
        <div className="flex w-full items-center justify-between gap-3.5">
          {leading ? <div className="flex shrink-0 items-center">{leading}</div> : null}
          <div className="min-w-0 flex-1">{centerContent}</div>
          {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
        </div>
      </Link>
    );
  }

  if (props.mode === 'button') {
    return (
      <button
        type={props.type ?? 'button'}
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={ariaLabel}
        style={style}
        className={`w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${baseClasses}`}
      >
        <div className="flex w-full items-center justify-between gap-3.5">
          {leading ? <div className="flex shrink-0 items-center">{leading}</div> : null}
          <div className="min-w-0 flex-1">{centerContent}</div>
          {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
        </div>
      </button>
    );
  }

  return (
    <div id={props.id} aria-label={ariaLabel} style={style} className={baseClasses}>
      {leading ? <div className="flex shrink-0 items-center">{leading}</div> : null}
      {props.to ? (
        <Link to={props.to} className="block min-w-0 flex-1">
          {centerContent}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{centerContent}</div>
      )}
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
