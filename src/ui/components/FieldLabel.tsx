import type { HTMLAttributes, ReactNode } from 'react';

export interface FieldLabelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  as?: 'label' | 'span';
}

export function FieldLabel({
  children,
  htmlFor,
  required = false,
  optional = false,
  as = 'label',
  className = '',
  ...props
}: FieldLabelProps) {
  const Component = as;
  return (
    <Component
      {...props}
      {...(as === 'label' && htmlFor ? { htmlFor } : {})}
      className={['fz-field-label', className].filter(Boolean).join(' ')}
    >
      {children}
      {required ? (
        <span className="ml-1 text-[var(--fz-accent)]" aria-hidden="true">
          *
        </span>
      ) : null}
      {optional ? (
        <span className="ml-1 text-[0.65rem] font-normal normal-case tracking-normal text-white/40">
          (optionnel)
        </span>
      ) : null}
    </Component>
  );
}
