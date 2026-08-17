import { useState, type ReactNode } from 'react';

interface AppHeaderGroup {
  name: string;
  initials: string;
  avatarUrl?: string | null | undefined;
  badgeColor?: string;
}

interface AppHeaderProps {
  logo: ReactNode;
  currentGroup: AppHeaderGroup;
  onChangeGroup: () => void;
  status?: ReactNode;
}

function GroupBadge({ group }: { group: AppHeaderGroup }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(group.avatarUrl) && !imageFailed;

  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 text-[0.75rem] font-black uppercase tracking-wider text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)] sm:h-12 sm:w-12"
      style={{ backgroundColor: group.badgeColor ?? 'var(--fz-accent)' }}
    >
      {showImage ? (
        <img
          src={group.avatarUrl ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        group.initials
      )}
    </span>
  );
}

export function AppHeader({ logo, currentGroup, onChangeGroup, status }: AppHeaderProps) {
  return (
    <div className="mx-auto h-16 w-full max-w-md px-4 sm:h-[72px] sm:px-5">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="shrink-0">{logo}</div>
        <button
          type="button"
          onClick={onChangeGroup}
          aria-label={`Changer de groupe (${currentGroup.name})`}
          title={currentGroup.name}
          className="group flex min-w-0 flex-1 items-center justify-end gap-2 border-0 bg-transparent p-0 text-inherit transition-opacity duration-150 hover:opacity-90 active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-accent-strong)] motion-reduce:transition-none"
        >
          <span className="flex min-w-0 flex-1 flex-col items-end justify-center leading-none">
            <span className="w-full truncate text-right text-[0.82rem] font-black uppercase tracking-wider text-[#f5f0ea]">
              {currentGroup.name}
            </span>
            {status}
          </span>
          <GroupBadge key={`${currentGroup.name}:${currentGroup.avatarUrl ?? 'initials'}`} group={currentGroup} />
        </button>
      </div>
    </div>
  );
}
