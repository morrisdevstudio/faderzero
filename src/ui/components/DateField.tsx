import { forwardRef, type InputHTMLAttributes } from 'react';

export type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'type' | 'size'>;

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(props, ref) {
  return <input {...props} ref={ref} type="date" className="fz-text-field fz-temporal-field" />;
});
