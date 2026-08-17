import { forwardRef, type InputHTMLAttributes } from 'react';

export type DateTimeFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'type' | 'size'>;

export const DateTimeField = forwardRef<HTMLInputElement, DateTimeFieldProps>(function DateTimeField(props, ref) {
  return <input {...props} ref={ref} type="datetime-local" className="fz-text-field fz-temporal-field" />;
});
