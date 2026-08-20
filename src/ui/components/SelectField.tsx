import { forwardRef, type SelectHTMLAttributes } from 'react';

export type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'style' | 'size'>;

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(props, ref) {
  return (
    <select
      {...props}
      ref={ref}
      className="fz-text-field fz-select-field !text-white font-bold"
      style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
    />
  );
});
