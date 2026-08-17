import type { ReactNode } from 'react';
import { SearchField } from '@/ui/components/SearchField';

interface PageHeaderSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  'aria-label'?: string;
}

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  actions?: ReactNode;
  search?: PageHeaderSearch | undefined;
  sortAction?: ReactNode;
}

export function PageHeader({ icon, title, actions, search, sortAction }: PageHeaderProps) {
  return (
    <header className="-mt-2 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-white" aria-hidden="true">
            {icon}
          </span>
          <h1 className="min-w-0 flex-1 truncate text-[2rem] font-black tracking-tight text-white">{title}</h1>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {search ? (
        <div className="flex items-center gap-2">
          <SearchField
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search['aria-label'] ?? search.placeholder}
          />
          {sortAction}
        </div>
      ) : null}
    </header>
  );
}
