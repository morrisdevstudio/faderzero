import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type SVGProps } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { AudioMiniPlayer } from '@/features/audio/AudioMiniPlayer';
import { useAuthStore } from '@/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type IconProps = SVGProps<SVGSVGElement>;

function SongsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
    </svg>
  );
}

function SetlistIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M9 7h10" />
      <path d="M9 12h10" />
      <path d="M9 17h10" />
      <path d="M4 7h.01" />
      <path d="M4 12h.01" />
      <path d="M4 17h.01" />
    </svg>
  );
}

function ImportsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 15V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
      <path d="M8 17h8" />
    </svg>
  );
}

function PrompterIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="5" width="16" height="12" rx="2.5" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function SyncIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M7.5 8.5A7 7 0 0 1 19 12" />
      <path d="M16.5 15.5A7 7 0 0 1 5 12" />
    </svg>
  );
}

function MetronomeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 20h10" />
      <path d="M8.5 20 11 5h2l2.5 15" />
      <path d="M10 11h4" />
      <path d="M14.5 7.5 18 5" />
    </svg>
  );
}

function AccountIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

function WorkspaceSwitchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7.5 7.5A7 7 0 0 1 19 10" />
      <path d="M19 5v5h-5" />
      <path d="M16.5 16.5A7 7 0 0 1 5 14" />
      <path d="M5 19v-5h5" />
    </svg>
  );
}

function MenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

const navItems = [
  { to: '/songs', label: 'Songs', Icon: SongsIcon },
  { to: '/musiques', label: 'Musiques', Icon: ImportsIcon },
  { to: '/setlists', label: 'Setlists', Icon: SetlistIcon },
  { to: '/prompter', label: 'Prompter', Icon: PrompterIcon },
  { to: '/sync', label: 'Sync', Icon: SyncIcon },
  { to: '/metronome', label: 'Click', Icon: MetronomeIcon },
  { to: '/account', label: 'Compte', Icon: AccountIcon },
] as const;

export function AppShell() {
  const location = useLocation();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const workspaces = useAuthStore((state) => state.workspaces);
  const clearFeedback = useAuthStore((state) => state.clearFeedback);
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const [headerHeight, setHeaderHeight] = useState(64);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  const headerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    function updateHeaderHeight() {
      if (!headerRef.current) {
        return;
      }

      setHeaderHeight(Math.ceil(headerRef.current.getBoundingClientRect().height));
    }

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateHeaderHeight();
          })
        : null;

    if (headerRef.current && resizeObserver) {
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    function updateViewportOffset() {
      if (!viewport) {
        return;
      }

      setViewportOffsetTop(Math.max(0, Math.round(viewport.offsetTop)));
    }

    updateViewportOffset();
    viewport.addEventListener('resize', updateViewportOffset);
    viewport.addEventListener('scroll', updateViewportOffset);

    return () => {
      viewport.removeEventListener('resize', updateViewportOffset);
      viewport.removeEventListener('scroll', updateViewportOffset);
    };
  }, []);



  useEffect(() => {
    setIsMenuOpen(false);
    setIsWorkspacePickerOpen(false);
  }, [location.pathname]);

  const shellStyle = {
    '--fz-header-height': `${headerHeight}px`,
    '--fz-viewport-offset-top': `${viewportOffsetTop}px`,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-[var(--fz-bg)] text-[#f5f0ea]" style={shellStyle}>
      <header
        ref={headerRef}
        className="fixed inset-x-0 z-40 bg-[var(--fz-bg)]/98 backdrop-blur-sm"
        style={{ top: `${viewportOffsetTop}px` }}
      >
        <div className="mx-auto w-full max-w-md px-4 pb-2 pt-3 sm:px-5">
          <div className="relative flex h-11 items-center">
            <button
              type="button"
              onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
              aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="absolute left-0 z-10 flex h-11 w-11 items-center justify-center text-white"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className="pointer-events-none absolute inset-x-0 min-w-0 px-14 text-center">
              <p className="truncate text-[0.72rem] font-black uppercase tracking-[0.26em] text-[var(--fz-text-muted)]">
                FaderZero
              </p>
              <p className="mt-1 truncate text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55">
                {activeWorkspace?.name ?? 'Aucun groupe'}
              </p>
            </div>
            <div className="absolute right-0 z-10 flex items-center gap-1">
              {!isOnline ? (
                <span
                  className="flex items-center gap-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-amber-300/90"
                  aria-live="polite"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
                  Hors ligne
                </span>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" title="En ligne" />
              )}
              <button
                type="button"
                onClick={() => setIsWorkspacePickerOpen(true)}
                aria-label="Changer de groupe"
                className="flex h-11 w-11 items-center justify-center text-white/72 transition hover:text-white"
              >
                <WorkspaceSwitchIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>
      {isMenuOpen ? (
        <div
          className="fixed inset-x-0 bottom-0 z-50 bg-black/48 backdrop-blur-[1px]"
          style={{ top: `${headerHeight + viewportOffsetTop}px` }}
          onClick={() => setIsMenuOpen(false)}
        >
          <div className="mx-auto w-full max-w-md px-4 pt-3 sm:px-5">
            <nav
              className="rounded-[1.4rem] border border-white/10 bg-[rgba(12,13,16,0.96)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-[1rem] px-3 py-3 transition',
                        isActive ? 'bg-white text-[#111319]' : 'text-[var(--fz-text-muted)] hover:bg-white/5',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={[
                            'flex h-9 w-9 items-center justify-center rounded-full transition',
                            isActive ? 'bg-[#111319] text-white' : 'bg-white/6 text-white/85',
                          ].join(' ')}
                        >
                          <item.Icon className="h-4.5 w-4.5" />
                        </span>
                        <span
                          className={[
                            'text-[0.72rem] font-black uppercase tracking-[0.16em]',
                            isActive ? 'text-[#111319]' : 'text-white',
                          ].join(' ')}
                        >
                          {item.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
        </div>
      ) : null}
      {isWorkspacePickerOpen ? (
        <FormDialog
          eyebrow="Groupes"
          title="Choisir un groupe"
          closeLabel="Fermer le selecteur de groupe"
          onClose={() => setIsWorkspacePickerOpen(false)}
        >
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--fz-text-muted)]">
              Positionne-toi sur le groupe actif a utiliser dans l&apos;app.
            </p>
            <div className="space-y-2.5">
              {workspaces.length > 0 ? (
                workspaces.map((workspace) => {
                  const isActive = workspace.id === activeWorkspace?.id;

                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() => {
                        clearFeedback();
                        setActiveWorkspace(workspace);
                        setIsWorkspacePickerOpen(false);
                      }}
                      className={[
                        'w-full rounded-[1.2rem] border px-4 py-4 text-left transition',
                        isActive
                          ? 'border-orange-400/40 bg-orange-500/12 shadow-[0_16px_36px_rgba(249,115,22,0.14)]'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{workspace.name}</p>
                          <p className="mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-white/40">
                            {isActive ? 'Groupe actuellement utilise' : 'Activer ce groupe'}
                          </p>
                        </div>
                        <span
                          className={[
                            'rounded-full px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em]',
                            isActive ? 'bg-orange-500 text-white' : 'border border-white/10 bg-black/20 text-white/55',
                          ].join(' ')}
                        >
                          {isActive ? 'Actif' : 'Switch'}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-white/12 bg-black/15 px-4 py-5 text-sm text-white/55">
                  Aucun groupe pour le moment. Ouvre la page compte pour creer ton premier workspace.
                </div>
              )}
            </div>
            <NavLink
              to="/account"
              onClick={() => setIsWorkspacePickerOpen(false)}
              className="flex w-full items-center justify-center rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
            >
              Gerer mes groupes
            </NavLink>
          </div>
        </FormDialog>
      ) : null}
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-3 pb-28 sm:px-4" style={{ paddingTop: `${headerHeight + 12}px` }}>
        <main className="flex-1 py-2">
          <Outlet />
        </main>
      </div>
      <AudioMiniPlayer />
    </div>
  );
}
