import { forwardRef, type InputHTMLAttributes } from 'react';

export type TimeFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'type' | 'size'>;

export const TimeField = forwardRef<HTMLInputElement, TimeFieldProps>(function TimeField(props, ref) {
  return <input {...props} ref={ref} type="time" className="fz-text-field fz-temporal-field" />;
});
