import type { ButtonHTMLAttributes } from 'react';
import { FzIcon } from '@/ui/icons';

type AddButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children' | 'className' | 'style' | 'type'> & {
  'aria-label': string;
};

export function AddButton({ 'aria-label': ariaLabel, ...props }: AddButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={ariaLabel}
      className="fz-button-primary fz-add-button"
    >
      <FzIcon name="add" usageId="add-button.icon" className="h-5 w-5 shrink-0" />
    </button>
  );
}
