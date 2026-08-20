import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useDialogAccessibility } from '@/components/useDialogAccessibility';
import { FormDialog } from '@/components/FormDialog';
import { AudioMiniPlayer } from '@/features/audio/AudioMiniPlayer';
import { QuickVoiceRecorder } from '@/features/recorder/QuickVoiceRecorder';
import { useAuthStore } from '@/stores/authStore';
import { useForcedOffline, useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useWorkspaceBadgeColors } from '@/services/workspaceColors';
import { toggleForcedOffline } from '@/services/connectivity';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { FzIcon } from '@/ui/icons';
import { AppHeader } from '@/ui/components/AppHeader';
import { FaderLogo } from '@/ui/components/FaderLogo';
import { UndoToast } from '@/components/UndoToast';
import { useUndoToastStore } from '@/stores/undoToastStore';

const scrollPositions = new Map<string, number>();

function FaderHeaderLogo() {
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreNextClickRef = useRef(false);

  function clearLongPress() {
    if (longPressTimeoutRef.current !== null) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    pointerStartRef.current = null;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLAnchorElement>) {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTimeoutRef.current = null;
      pointerStartRef.current = null;
      ignoreNextClickRef.current = true;
      toggleForcedOffline();
    }, 700);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLAnchorElement>) {
    const pointerStart = pointerStartRef.current;
    if (!pointerStart) return;
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 10) {
      clearLongPress();
    }
  }

  return (
    <NavLink
      to="/home"
      className="flex items-center transition hover:opacity-90"
      aria-label="FaderZero Accueil"
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerMove={handlePointerMove}
      onClick={(event) => {
        if (!ignoreNextClickRef.current) return;
        ignoreNextClickRef.current = false;
        event.preventDefault();
      }}
    >
      <FaderLogo className="h-[34px] w-auto text-white sm:h-10" />
    </NavLink>
  );
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const workspaces = useAuthStore((state) => state.workspaces);
  const clearFeedback = useAuthStore((state) => state.clearFeedback);
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const undoToast = useUndoToastStore((state) => state.toast);
  const dismissUndoToast = useUndoToastStore((state) => state.dismissUndoToast);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState(false);
  const [isLiveMenuOpen, setIsLiveMenuOpen] = useState(false);
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false);
  const [voiceRecorderMessage, setVoiceRecorderMessage] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const isForcedOffline = useForcedOffline();
  const { getBadgeColor, getBadgeText } = useWorkspaceBadgeColors();
  const [headerHeight, setHeaderHeight] = useState(64);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  const headerRef = useRef<HTMLElement | null>(null);

  const workspaceInitials = getBadgeText(activeWorkspace?.id, activeWorkspace?.name);
  const activeBadgeColor = getBadgeColor(activeWorkspace?.id, activeWorkspace?.type);
  const isLiveActive =
    isVoiceRecorderOpen ||
    location.pathname.startsWith('/prompter') ||
    location.pathname.startsWith('/metronome');
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const quickActionDialogRef = useDialogAccessibility(() => setIsLiveMenuOpen(false), isLiveMenuOpen);

  useEffect(() => {
    if (!voiceRecorderMessage) return;
    const timeoutId = window.setTimeout(() => setVoiceRecorderMessage(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [voiceRecorderMessage]);

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
        className="fixed inset-x-0 z-30 bg-[var(--fz-bg)]/98 backdrop-blur-sm"
        style={{ top: `${viewportOffsetTop}px` }}
      >
        <AppHeader
          logo={<FaderHeaderLogo />}
          currentGroup={{
            name: activeWorkspace?.name ?? 'Mon Espace',
            initials: workspaceInitials,
            avatarUrl: activeWorkspace?.logoUrl,
            badgeColor: activeBadgeColor.hex,
          }}
          onChangeGroup={() => setIsWorkspacePickerOpen(true)}
          status={!isOnline ? (
            <span
              className="mt-1 flex w-full items-center justify-end text-right text-[0.58rem] font-bold uppercase tracking-[0.14em] text-amber-300"
              aria-live="polite"
            >
              <span className="mr-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
              {isForcedOffline ? 'Hors ligne · test' : 'Hors ligne'}
            </span>
          ) : undefined}
        />
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
                  const initials = getBadgeText(workspace.id, workspace.name);
                  const badgeColor = getBadgeColor(workspace.id, workspace.type);

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
                        'w-full rounded-[1.2rem] border px-4 py-3.5 text-left transition flex items-center gap-3.5',
                        isActive
                          ? 'border-white/25 bg-white/10 shadow-[0_12px_28px_rgba(0,0,0,0.35)]'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8',
                      ].join(' ')}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white shadow-md border border-white/20"
                        style={{ backgroundColor: badgeColor.hex }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#f5f0ea] truncate">{workspace.name}</p>
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
      <nav className="fixed inset-x-0 bottom-0 z-50 bg-[#0c0d10]/96 border-t border-white/10 shadow-[0_-16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-around px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
          {/* 1. Accueil */}
          <NavLink
            to="/home"
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors',
                isActive ? 'text-[#ff3a63] font-bold' : 'text-white/40 hover:text-white/70',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <FzIcon name="home" usageId="app-shell.navigation.home" className={['h-5 w-5 transition-colors', isActive ? 'text-[#ff3a63]' : 'text-white/40'].join(' ')} />
                <span className="text-[0.6rem] uppercase tracking-wider">Accueil</span>
                <span className={['h-1 w-1 rounded-full transition-all', isActive ? 'bg-[#ff3a63] opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'].join(' ')} />
              </>
            )}
          </NavLink>

          {/* 2. Calendrier */}
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors',
                isActive ? 'text-teal-400 font-bold' : 'text-white/40 hover:text-white/70',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <FzIcon name="calendar" usageId="app-shell.navigation.calendar" className={['h-5 w-5 transition-colors', isActive ? 'text-teal-400' : 'text-white/40'].join(' ')} />
                <span className="text-[0.6rem] uppercase tracking-wider">Calendrier</span>
                <span className={['h-1 w-1 rounded-full transition-all', isActive ? 'bg-teal-400 opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'].join(' ')} />
              </>
            )}
          </NavLink>

          {/* 3. Mode Live (Bouton REC rouge avec Popover Prompteur & Click) */}
          <div id="live-mode-container" className="relative flex flex-1 flex-col items-center justify-center -mt-4 z-40">
            <button
              type="button"
              onClick={() => setIsLiveMenuOpen((prev) => !prev)}
              aria-label="Actions rapides (Enregistrer, Écrire, Prompteur et Click)"
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
            </button>
          </div>

          {/* 3. Morceaux */}
          <NavLink
            to="/songs"
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors',
                isActive ? 'text-indigo-400 font-bold' : 'text-white/40 hover:text-white/70',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <FzIcon name="songs" usageId="app-shell.navigation.songs" className={['h-5 w-5 transition-colors', isActive ? 'text-indigo-400' : 'text-white/40'].join(' ')} />
                <span className="text-[0.6rem] uppercase tracking-wider">Morceaux</span>
                <span className={['h-1 w-1 rounded-full transition-all', isActive ? 'bg-indigo-400 opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'].join(' ')} />
              </>
            )}
          </NavLink>

          {/* 5. Setlist */}
          <NavLink
            to="/setlists"
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors',
                isActive ? 'text-fuchsia-400 font-bold' : 'text-white/40 hover:text-white/70',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <FzIcon name="setlist" usageId="app-shell.navigation.setlists" className={['h-5 w-5 transition-colors', isActive ? 'text-fuchsia-400' : 'text-white/40'].join(' ')} />
                <span className="text-[0.6rem] uppercase tracking-wider">Setlist</span>
                <span className={['h-1 w-1 rounded-full transition-all', isActive ? 'bg-fuchsia-400 opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'].join(' ')} />
              </>
            )}
          </NavLink>
        </div>
      </nav>

      {isLiveMenuOpen ? (
        createPortal(
          <>
            <div
              data-testid="quick-actions-backdrop"
              className="fixed inset-x-0 top-0 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-40 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in touch-none select-none"
              onClick={() => setIsLiveMenuOpen(false)}
              onTouchMove={(e) => e.preventDefault()}
              onWheel={(e) => e.preventDefault()}
              aria-hidden="true"
            />
            <div
              ref={quickActionDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Créer ou jouer"
              tabIndex={-1}
              className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-1rem)] max-w-[30rem] -translate-x-1/2 rounded-t-[2.5rem] border border-white/15 bg-[#14161b]/98 px-6 pb-6 pt-6 shadow-[0_-20px_55px_rgba(0,0,0,0.7)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 outline-none"
            >
              <h2 className="text-xl font-black tracking-tight text-white">Créer ou jouer</h2>
              <div className="mt-8 grid grid-cols-2 gap-4">
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsLiveMenuOpen(false);
                      setVoiceRecorderMessage(null);
                      setIsVoiceRecorderOpen(true);
                    }}
                    className="flex min-h-36 flex-col items-center justify-center gap-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-center text-white transition hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-[0.98]"
                  >
                    <FzIcon name="record" usageId="app-shell.quick-actions.record" size="xl" className="h-10 w-10 text-[#ff3a63]" />
                    <span className="text-xs font-medium leading-tight">Enregistrer une idée</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIsLiveMenuOpen(false);
                    navigate('/songs/new/write');
                  }}
                  className="flex min-h-36 flex-col items-center justify-center gap-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-center text-white transition hover:border-emerald-500/30 hover:bg-emerald-500/10 active:scale-[0.98]"
                >
                  <FzIcon name="edit" usageId="app-shell.quick-actions.write" size="xl" className="h-10 w-10 text-emerald-400" />
                  <span className="text-xs font-medium leading-tight">Nouvelles paroles</span>
                </button>
                <NavLink
                  to="/prompter"
                  onClick={() => setIsLiveMenuOpen(false)}
                  className={({ isActive }) =>
                    [
                      'flex min-h-36 flex-col items-center justify-center gap-5 rounded-[1.5rem] border p-4 text-center transition active:scale-[0.98]',
                      isActive
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-100'
                        : 'border-white/10 bg-black/20 text-white hover:border-sky-500/30 hover:bg-sky-500/10',
                    ].join(' ')
                  }
                >
                  <FzIcon name="prompter" usageId="app-shell.quick-actions.prompter" size="xl" className="h-10 w-10 text-sky-400" />
                  <span className="text-xs font-medium leading-tight">Prompteur</span>
                </NavLink>
                <NavLink
                  to="/metronome"
                  onClick={() => setIsLiveMenuOpen(false)}
                  className={({ isActive }) =>
                    [
                      'flex min-h-36 flex-col items-center justify-center gap-5 rounded-[1.5rem] border p-4 text-center transition active:scale-[0.98]',
                      isActive
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-100'
                        : 'border-white/10 bg-black/20 text-white hover:border-amber-500/30 hover:bg-amber-500/10',
                    ].join(' ')
                  }
                >
                  <FzIcon name="metronome" usageId="app-shell.quick-actions.metronome" size="xl" className="h-10 w-10 text-amber-400" />
                  <span className="text-xs font-medium leading-tight">Métronome</span>
                </NavLink>
              </div>
            </div>
          </>,
          document.body,
        )
      ) : null}

      {isVoiceRecorderOpen ? (
        <QuickVoiceRecorder
          onClose={() => setIsVoiceRecorderOpen(false)}
          onComplete={({ message, songId }) => {
            setIsVoiceRecorderOpen(false);
            setVoiceRecorderMessage(message);
            if (songId) {
              navigate(`/songs/${songId}`);
            }
          }}
        />
      ) : null}

      {voiceRecorderMessage ? (
        <div
          className="fixed inset-x-4 bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-[55] mx-auto max-w-sm rounded-2xl border border-emerald-300/25 bg-[#14221c]/95 px-4 py-3 text-center text-sm font-bold text-emerald-100 shadow-2xl backdrop-blur-xl"
          role="status"
        >
          {voiceRecorderMessage}
        </div>
      ) : null}

      {undoToast ? (
        <UndoToast
          key={undoToast.id}
          message={undoToast.message}
          onUndo={async () => {
            const undoFn = undoToast.onUndo;
            dismissUndoToast();
            await undoFn();
          }}
          onDismiss={dismissUndoToast}
          durationMs={undoToast.durationMs ?? 5000}
        />
      ) : null}
    </div>
  );
}
