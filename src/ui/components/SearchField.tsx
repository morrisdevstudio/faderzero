import { forwardRef, type InputHTMLAttributes } from 'react';

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'type' | 'size'>;

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(props, ref) {
  return <input {...props} ref={ref} type="search" className="fz-text-field fz-search-field" />;
});
