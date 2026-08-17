import { forwardRef, type InputHTMLAttributes } from 'react';

type TextFieldType = 'text' | 'email' | 'tel' | 'url';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'type' | 'size'> {
  type?: TextFieldType;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { type = 'text', ...props },
  ref,
) {
  return <input {...props} ref={ref} type={type} className="fz-text-field" />;
});
