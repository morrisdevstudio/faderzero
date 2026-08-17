import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { FzIcon } from '@/ui/icons';

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'type' | 'size'> {
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  {
    showPasswordLabel = 'Afficher le mot de passe',
    hidePasswordLabel = 'Masquer le mot de passe',
    disabled,
    ...props
  },
  ref,
) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="relative block w-full">
      <input {...props} ref={ref} disabled={disabled} type={isVisible ? 'text' : 'password'} className="fz-text-field pr-14" />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        disabled={disabled}
        aria-label={isVisible ? hidePasswordLabel : showPasswordLabel}
        aria-pressed={isVisible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/55 transition-colors hover:text-white active:text-white/70 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--fz-accent)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <FzIcon
          name={isVisible ? 'hide-password' : 'show-password'}
          usageId={isVisible ? 'password-field.hide' : 'password-field.show'}
          size="md"
        />
      </button>
    </span>
  );
});
