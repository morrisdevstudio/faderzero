import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/components/LoginPage';
import { WorkspaceInvitePage } from '@/components/WorkspaceInvitePage';
import { WorkspaceSelectionPage } from '@/components/WorkspaceSelectionPage';
import { pushPendingMutations, pullRemoteChanges, syncPersonalContacts } from '@/services/supabase/sync';
import { subscribeToWorkspaceChanges } from '@/services/supabase/realtime';
import { db } from '@/db/db';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { clearPendingInviteToken, readPendingInviteToken } from '@/services/supabase/inviteContext';
import { processPendingAudioUploads } from '@/services/audio/pendingUploads';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { FzIcon } from '@/ui/icons';
import { resolveViewTarget } from '@/utils/domainRouting';

import { SplashScreen } from '@/components/SplashScreen';

const LandingPage = lazy(async () => ({ default: (await import('@/features/landing/LandingPage')).LandingPage }));

function SyncBootstrap() {
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const session = useAuthStore((state) => state.session);
  const refreshWorkspaceAccess = useAuthStore((state) => state.refreshWorkspaceAccess);
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const isOnline = useOnlineStatus();
  const syncInFlightRef = useRef(false);
  const [isForcingSync, setIsForcingSync] = useState(false);
  const [dismissedFailureKey, setDismissedFailureKey] = useState<string | null>(null);

  const pendingMutationCount = useLiveQuery(async () => {
    if (!activeWorkspace || !canWrite) {
      return 0;
    }

    return db.syncQueue
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .filter((item) => item.status === 'pending' || item.status === 'failed')
      .count();
  }, [activeWorkspace?.id, canWrite]);

  const failedMutation = useLiveQuery(async () => {
    if (!activeWorkspace || !canWrite) {
      return null;
    }

    const failedItems = await db.syncQueue
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .filter((item) => item.status === 'failed')
      .toArray();

    failedItems.sort((left, right) => (right.lastTriedAt ?? 0) - (left.lastTriedAt ?? 0));
    return failedItems[0] ?? null;
  }, [activeWorkspace?.id, canWrite]);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    const workspaceId = activeWorkspace.id;
    let isDisposed = false;

    async function runSyncCycle() {
      if (syncInFlightRef.current || isDisposed || !isOnline) {
        return;
      }

      syncInFlightRef.current = true;

      try {
        if (session?.user.id) await syncPersonalContacts(session.user.id);
        const verifiedWorkspaces = await refreshWorkspaceAccess();
        const verifiedWorkspace = verifiedWorkspaces.find(({ id }) => id === workspaceId);
        if (!verifiedWorkspace) return;
        if (canWriteWorkspace(verifiedWorkspace.role)) {
          await processPendingAudioUploads(workspaceId);
          await pushPendingMutations(workspaceId);
        }
        await pullRemoteChanges(workspaceId);
      } catch (error) {
        console.error('[Auto Sync]', error);
      } finally {
        syncInFlightRef.current = false;
      }
    }

    let debounceTimer: number | null = null;
    function scheduleSyncCycle(delayMs = 400) {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        void runSyncCycle();
      }, delayMs);
    }

    void runSyncCycle();

    const subscription = isOnline
      ? subscribeToWorkspaceChanges(workspaceId, () => {
          scheduleSyncCycle(400);
        })
      : null;

    function handleOnline() {
      void runSyncCycle();
    }

    const intervalId = window.setInterval(() => {
      void runSyncCycle();
    }, 15000);

    window.addEventListener('online', handleOnline);

    return () => {
      isDisposed = true;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      subscription?.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.clearInterval(intervalId);
    };
  }, [activeWorkspace, canWrite, isOnline, refreshWorkspaceAccess, session?.user.id]);

  useEffect(() => {
    if (!activeWorkspace || !canWrite || !pendingMutationCount || pendingMutationCount <= 0 || !isOnline) {
      return;
    }

    void (async () => {
      if (syncInFlightRef.current) {
        return;
      }

      syncInFlightRef.current = true;

      try {
        const verifiedWorkspaces = await refreshWorkspaceAccess();
        const verifiedWorkspace = verifiedWorkspaces.find(({ id }) => id === activeWorkspace.id);
        if (!verifiedWorkspace) return;
        if (canWriteWorkspace(verifiedWorkspace.role)) {
          await processPendingAudioUploads(activeWorkspace.id);
          await pushPendingMutations(activeWorkspace.id);
        }
        await pullRemoteChanges(activeWorkspace.id);
      } catch (error) {
        console.error('[Queue Triggered Sync]', error);
      } finally {
        syncInFlightRef.current = false;
      }
    })();
  }, [activeWorkspace, canWrite, isOnline, pendingMutationCount, refreshWorkspaceAccess]);

  async function handleForceSync() {
    if (!activeWorkspace || !canWrite || !isOnline || syncInFlightRef.current || isForcingSync) {
      return;
    }

    setIsForcingSync(true);
    syncInFlightRef.current = true;

    try {
      const verifiedWorkspaces = await refreshWorkspaceAccess();
      const verifiedWorkspace = verifiedWorkspaces.find(({ id }) => id === activeWorkspace.id);
      if (!verifiedWorkspace || !canWriteWorkspace(verifiedWorkspace.role)) return;
      if (session?.user.id) await syncPersonalContacts(session.user.id);
      await processPendingAudioUploads(activeWorkspace.id);
      await pushPendingMutations(activeWorkspace.id, { includeFailed: true });
      await pullRemoteChanges(activeWorkspace.id);
    } catch (error) {
      console.error('[Forced Sync]', error);
    } finally {
      syncInFlightRef.current = false;
      setIsForcingSync(false);
    }
  }

  const failureKey = failedMutation
    ? `${failedMutation.id ?? failedMutation.entityId}:${failedMutation.lastTriedAt ?? 0}`
    : null;

  if (!failedMutation || dismissedFailureKey === failureKey) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-rose-500/25 bg-[#240b10]/95 px-4 py-3 text-sm text-rose-100 shadow-2xl backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="font-black uppercase tracking-[0.14em] text-rose-300">Synchronisation en echec</p>
          <p className="truncate text-xs text-rose-100/85">
            {failedMutation.errorMessage || 'Une modification n a pas pu etre envoyee. Forcez la synchronisation.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleForceSync()}
          disabled={isForcingSync || !isOnline}
          className="rounded-xl border border-rose-300/30 bg-rose-400/15 px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-rose-50 transition hover:bg-rose-400/25 disabled:opacity-60"
        >
          {isForcingSync ? 'Retry...' : 'Forcer la synchro'}
        </button>
        <button
          type="button"
          onClick={() => setDismissedFailureKey(failureKey)}
          aria-label="Masquer l’alerte de synchronisation"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-rose-100/75 transition hover:bg-rose-400/15 hover:text-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200"
        >
          <FzIcon name="close" usageId="sync.failure.dismiss" size="md" />
        </button>
      </div>
    </div>
  );
}

export function AppContent() {
  const { session, activeWorkspace, loading, initialize, initialized } = useAuthStore();
  const [inviteToken, setInviteToken] = useState<string | null>(() => readPendingInviteToken());
  const [animatedUserId, setAnimatedUserId] = useState<string | null>(null);
  const [enteredUserId, setEnteredUserId] = useState<string | null>(null);
  const sessionUserId = session?.user.id ?? null;

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const nextToken = readPendingInviteToken();
    setInviteToken((currentToken) => (currentToken === nextToken ? currentToken : nextToken));
  }, [session]);

  useEffect(() => {
    if (!sessionUserId) {
      setAnimatedUserId(null);
      setEnteredUserId(null);
      return;
    }

    if (initialized && !loading && animatedUserId === sessionUserId) {
      setEnteredUserId(sessionUserId);
    }
  }, [animatedUserId, initialized, loading, sessionUserId]);

  if (!initialized && !sessionUserId) {
    return <SplashScreen key="session-initialization" />;
  }

  if (!session) {
    if (!inviteToken) {
      const viewTarget = resolveViewTarget();
      if (viewTarget === 'landing') {
        return (
          <Suspense fallback={<SplashScreen animated={false} />}>
            <LandingPage />
          </Suspense>
        );
      }
    }
    return <LoginPage inviteTokenPresent={Boolean(inviteToken)} />;
  }

  if (enteredUserId !== sessionUserId) {
    return (
      <SplashScreen
        key={`authenticated-${sessionUserId}`}
        onComplete={() => setAnimatedUserId(sessionUserId)}
      />
    );
  }

  if (inviteToken) {
    return (
      <WorkspaceInvitePage
        inviteToken={inviteToken}
        onDismiss={() => {
          clearPendingInviteToken();
          setInviteToken(null);
        }}
      />
    );
  }

  if (!activeWorkspace) {
    return <WorkspaceSelectionPage />;
  }

  return <AppRouter />;
}

export function App() {
  return (
    <AppProviders>
      <SyncBootstrap />
      <AppContent />
    </AppProviders>
  );
}
