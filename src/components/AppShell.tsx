import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type SVGProps } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { AudioMiniPlayer } from '@/features/audio/AudioMiniPlayer';
import { useAuthStore } from '@/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type IconProps = SVGProps<SVGSVGElement>;

const scrollPositions = new Map<string, number>();

function CalendarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

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
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
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

function FaderHeaderLogo() {
  return (
    <NavLink
      to="/home"
      className="flex items-center gap-2 transition hover:opacity-90"
      aria-label="FaderZero Accueil"
    >
      <div className="flex h-[34px] items-center">
        <svg viewBox="0 0 20 80" className="h-full w-[9px] fill-white">
          <rect x="9" y="0" width="2" height="80" rx="0.5" />
          <rect x="2" y="20" width="16" height="24" rx="2" />
        </svg>
      </div>
      <div className="flex w-[70px] flex-col justify-center text-white font-extrabold text-[14px] font-sans">
        <div className="flex w-full justify-between leading-[1.05]">
          <span>F</span><span>A</span><span>D</span><span>E</span><span>R</span>
        </div>
        <div className="flex w-full justify-between leading-[1.05]">
          <span>Z</span><span>E</span><span>R</span><span>O</span>
        </div>
      </div>
    </NavLink>
  );
}

function getWorkspaceInitials(name?: string): string {
  if (!name) return 'ME';
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed.toUpperCase();
  const words = trimmed.split(/\s+/);
  const [firstWord = '', secondWord = ''] = words;
  if (firstWord && secondWord) {
    return (firstWord.charAt(0) + secondWord.charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function AppShell() {
  const location = useLocation();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const workspaces = useAuthStore((state) => state.workspaces);
  const clearFeedback = useAuthStore((state) => state.clearFeedback);
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState(false);
  const [isLiveMenuOpen, setIsLiveMenuOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const [headerHeight, setHeaderHeight] = useState(64);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  const headerRef = useRef<HTMLElement | null>(null);

  const workspaceInitials = getWorkspaceInitials(activeWorkspace?.name);
  const isLiveActive = location.pathname.startsWith('/prompter') || location.pathname.startsWith('/metronome');

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
    setIsWorkspacePickerOpen(false);
    setIsLiveMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isLiveMenuOpen) return;

    function handleGlobalPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('#live-mode-container')) {
        setIsLiveMenuOpen(false);
      }
    }

    window.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => {
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
    };
  }, [isLiveMenuOpen]);

  useLayoutEffect(() => {
    const scrollKey = `${location.pathname}${location.search}`;
    const restorePosition = scrollPositions.get(scrollKey) ?? 0;
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: restorePosition, behavior: 'instant' as ScrollBehavior });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      scrollPositions.set(scrollKey, window.scrollY);
    };
  }, [location.key, location.pathname, location.search]);

  const shellStyle = {
    '--fz-header-height': `${headerHeight}px`,
    '--fz-viewport-offset-top': `${viewportOffsetTop}px`,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-[var(--fz-bg)] text-[#f5f0ea]" style={shellStyle}>
      {/* Top Header */}
      <header
        ref={headerRef}
        className="fixed inset-x-0 z-40 bg-[var(--fz-bg)]/98 backdrop-blur-sm"
        style={{ top: `${viewportOffsetTop}px` }}
      >
        <div className="mx-auto w-full max-w-md px-4 pb-2 pt-3 sm:px-5">
          <div className="relative flex h-11 items-center justify-between">
            <FaderHeaderLogo />

            <div className="flex items-center gap-2">
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
                aria-label={`Changer de groupe (${activeWorkspace?.name ?? 'Mon Espace'})`}
                title={activeWorkspace?.name ?? 'Changer de groupe'}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ff3a63]/40 bg-gradient-to-b from-[#ff3a63]/25 to-[#ff2f5c]/15 text-[0.72rem] font-black uppercase tracking-wider text-rose-200 shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition hover:border-[#ff3a63] hover:scale-105 hover:bg-[#ff3a63]/35"
              >
                {workspaceInitials}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Workspace Picker Dialog */}
      {isWorkspacePickerOpen ? (
        <FormDialog
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
                          ? 'border-[#ff3a63]/40 bg-[#ff3a63]/12 shadow-[0_16px_36px_rgba(255,58,99,0.14)]'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#f5f0ea]">{workspace.name}</p>
                          <p className="mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-white/40">
                            {isActive ? 'Groupe actuellement utilise' : 'Activer ce groupe'}
                          </p>
                        </div>
                        <span
                          className={[
                            'rounded-full px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em]',
                            isActive ? 'bg-[#ff3a63] text-white' : 'border border-white/10 bg-black/20 text-white/55',
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
              Paramètres
            </NavLink>
          </div>
        </FormDialog>
      ) : null}

      {/* Main Content Area */}
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-3 pb-32 sm:px-4" style={{ paddingTop: `${headerHeight + 12}px` }}>
        <main className="flex-1 py-2">
          <Outlet />
        </main>
      </div>

      {/* Audio Player */}
      <AudioMiniPlayer />

      {/* Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 bg-[#0c0d10]/96 border-t border-white/10 shadow-[0_-16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-around px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
          {/* 1. Calendrier */}
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors',
                isActive ? 'text-white font-bold' : 'text-white/40 hover:text-white/70',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <CalendarIcon className={['h-5 w-5 transition-colors', isActive ? 'text-white' : 'text-white/40'].join(' ')} />
                <span className="text-[0.6rem] uppercase tracking-wider">Calendrier</span>
                <span className={['h-1 w-1 rounded-full transition-all', isActive ? 'bg-[#ff3a63] opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'].join(' ')} />
              </>
            )}
          </NavLink>

          {/* 2. Musique */}
          <NavLink
            to="/musiques"
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors',
                isActive ? 'text-white font-bold' : 'text-white/40 hover:text-white/70',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <ImportsIcon className={['h-5 w-5 transition-colors', isActive ? 'text-white' : 'text-white/40'].join(' ')} />
                <span className="text-[0.6rem] uppercase tracking-wider">Musique</span>
                <span className={['h-1 w-1 rounded-full transition-all', isActive ? 'bg-[#ff3a63] opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'].join(' ')} />
              </>
            )}
          </NavLink>

          {/* 3. Mode Live (Bouton REC rouge avec Popover Prompteur & Click) */}
          <div id="live-mode-container" className="relative flex flex-1 flex-col items-center justify-center -mt-4 z-50">
            {isLiveMenuOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/10"
                  onClick={() => setIsLiveMenuOpen(false)}
                  onTouchStart={() => setIsLiveMenuOpen(false)}
                />
                <div className="absolute bottom-22 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 bg-transparent border-0 shadow-none p-0 whitespace-nowrap animate-in fade-in slide-in-from-bottom-3">
                  <NavLink
                    to="/prompter"
                    onClick={() => setIsLiveMenuOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex min-w-[180px] items-center justify-center gap-3 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-[0.14em] transition-all backdrop-blur-2xl active:scale-95',
                        isActive
                          ? 'bg-[#ff3a63]/25 text-rose-200 border border-[#ff3a63]/60 shadow-[0_0_20px_rgba(255,58,99,0.4)]'
                          : 'bg-[#14161b]/98 text-white border border-white/20 hover:bg-white/18 hover:border-white/35 shadow-[0_14px_36px_rgba(0,0,0,0.7)]',
                      ].join(' ')
                    }
                  >
                    <PrompterIcon className="h-5 w-5 text-[#ff547b]" />
                    Prompteur
                  </NavLink>
                  <NavLink
                    to="/metronome"
                    onClick={() => setIsLiveMenuOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex min-w-[180px] items-center justify-center gap-3 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-[0.14em] transition-all backdrop-blur-2xl active:scale-95',
                        isActive
                          ? 'bg-[#ff3a63]/25 text-rose-200 border border-[#ff3a63]/60 shadow-[0_0_20px_rgba(255,58,99,0.4)]'
                          : 'bg-[#14161b]/98 text-white border border-white/20 hover:bg-white/18 hover:border-white/35 shadow-[0_14px_36px_rgba(0,0,0,0.7)]',
                      ].join(' ')
                    }
                  >
                    <MetronomeIcon className="h-5 w-5 text-[#ff547b]" />
                    Click
                  </NavLink>
                </div>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => setIsLiveMenuOpen((prev) => !prev)}
              aria-label="Mode Live (Prompteur & Click)"
              className="group flex flex-col items-center justify-center gap-1 py-1 text-center transition-colors focus:outline-none z-40"
            >
              <div
                className={[
                  'flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-red-500 to-red-700 shadow-[0_0_18px_rgba(239,68,68,0.55)] transition-all group-hover:scale-105',
                  isLiveActive || isLiveMenuOpen
                    ? 'ring-2 ring-red-400 ring-offset-2 ring-offset-[#0c0d10] shadow-[0_0_24px_rgba(239,68,68,0.85)] scale-105'
                    : '',
                ].join(' ')}
              >
                <span className="h-3.5 w-3.5 rounded-full bg-white shadow-inner animate-pulse" />
              </div>
              <span className={['text-[0.58rem] font-black uppercase tracking-wider', isLiveActive || isLiveMenuOpen ? 'text-red-400 font-black' : 'text-white/70'].join(' ')}>
                Mode Live
              </span>
            </button>
          </div>

          {/* 4. Répertoire */}
          <NavLink
            to="/songs"
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors',
                isActive ? 'text-white font-bold' : 'text-white/40 hover:text-white/70',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <SongsIcon className={['h-5 w-5 transition-colors', isActive ? 'text-white' : 'text-white/40'].join(' ')} />
                <span className="text-[0.6rem] uppercase tracking-wider">Répertoire</span>
                <span className={['h-1 w-1 rounded-full transition-all', isActive ? 'bg-[#ff3a63] opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'].join(' ')} />
              </>
            )}
          </NavLink>

          {/* 5. Setlist */}
          <NavLink
            to="/setlists"
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors',
                isActive ? 'text-white font-bold' : 'text-white/40 hover:text-white/70',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <SetlistIcon className={['h-5 w-5 transition-colors', isActive ? 'text-white' : 'text-white/40'].join(' ')} />
                <span className="text-[0.6rem] uppercase tracking-wider">Setlist</span>
                <span className={['h-1 w-1 rounded-full transition-all', isActive ? 'bg-[#ff3a63] opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'].join(' ')} />
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
