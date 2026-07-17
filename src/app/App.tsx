import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/components/LoginPage';
import { WorkspaceInvitePage } from '@/components/WorkspaceInvitePage';
import { WorkspaceSelectionPage } from '@/components/WorkspaceSelectionPage';
import { pushPendingMutations, pullRemoteChanges } from '@/services/supabase/sync';
import { subscribeToWorkspaceChanges } from '@/services/supabase/realtime';
import { db } from '@/db/db';

const INVITE_STORAGE_KEY = 'faderzero_pending_invite_token';

function readInviteToken(): string | null {
  const url = new URL(window.location.href);
  const inviteFromUrl = url.searchParams.get('invite');

  if (inviteFromUrl) {
    localStorage.setItem(INVITE_STORAGE_KEY, inviteFromUrl);
    return inviteFromUrl;
  }

  return localStorage.getItem(INVITE_STORAGE_KEY);
}

function clearInviteToken() {
  const url = new URL(window.location.href);
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', url.toString());
  localStorage.removeItem(INVITE_STORAGE_KEY);
}

function SyncBootstrap() {
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const syncInFlightRef = useRef(false);
  const [isForcingSync, setIsForcingSync] = useState(false);

  const pendingMutationCount = useLiveQuery(async () => {
    if (!activeWorkspace) {
      return 0;
    }

    return db.syncQueue
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .filter((item) => item.status === 'pending' || item.status === 'failed')
      .count();
  }, [activeWorkspace?.id]);

  const failedMutation = useLiveQuery(async () => {
    if (!activeWorkspace) {
      return null;
    }

    const failedItems = await db.syncQueue
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .filter((item) => item.status === 'failed')
      .toArray();

    failedItems.sort((left, right) => (right.lastTriedAt ?? 0) - (left.lastTriedAt ?? 0));
    return failedItems[0] ?? null;
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    const workspaceId = activeWorkspace.id;
    let isDisposed = false;

    async function runSyncCycle() {
      if (syncInFlightRef.current || isDisposed || !navigator.onLine) {
        return;
      }

      syncInFlightRef.current = true;

      try {
        await pushPendingMutations(workspaceId);
        await pullRemoteChanges(workspaceId);
      } catch (error) {
        console.error('[Auto Sync]', error);
      } finally {
        syncInFlightRef.current = false;
      }
    }

    void runSyncCycle();

    const subscription = subscribeToWorkspaceChanges(workspaceId, () => {
      void runSyncCycle();
    });

    function handleOnline() {
      void runSyncCycle();
    }

    const intervalId = window.setInterval(() => {
      void runSyncCycle();
    }, 15000);

    window.addEventListener('online', handleOnline);

    return () => {
      isDisposed = true;
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.clearInterval(intervalId);
    };
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace || !pendingMutationCount || pendingMutationCount <= 0 || !navigator.onLine) {
      return;
    }

    void (async () => {
      if (syncInFlightRef.current) {
        return;
      }

      syncInFlightRef.current = true;

      try {
        await pushPendingMutations(activeWorkspace.id);
        await pullRemoteChanges(activeWorkspace.id);
      } catch (error) {
        console.error('[Queue Triggered Sync]', error);
      } finally {
        syncInFlightRef.current = false;
      }
    })();
  }, [activeWorkspace, pendingMutationCount]);

  async function handleForceSync() {
    if (!activeWorkspace || syncInFlightRef.current || isForcingSync) {
      return;
    }

    setIsForcingSync(true);
    syncInFlightRef.current = true;

    try {
      await pushPendingMutations(activeWorkspace.id, { includeFailed: true });
      await pullRemoteChanges(activeWorkspace.id);
    } catch (error) {
      console.error('[Forced Sync]', error);
    } finally {
      syncInFlightRef.current = false;
      setIsForcingSync(false);
    }
  }

  if (!failedMutation) {
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
          disabled={isForcingSync}
          className="rounded-xl border border-rose-300/30 bg-rose-400/15 px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-rose-50 transition hover:bg-rose-400/25 disabled:opacity-60"
        >
          {isForcingSync ? 'Retry...' : 'Forcer la synchro'}
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { session, activeWorkspace, loading, initialize, initialized } = useAuthStore();
  const [inviteToken, setInviteToken] = useState<string | null>(() => readInviteToken());

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const nextToken = readInviteToken();
    setInviteToken((currentToken) => (currentToken === nextToken ? currentToken : nextToken));
  }, [session]);

  if (loading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c0d10] text-[#f5f0ea]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-orange-500 mx-auto mb-4" />
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/40">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage inviteTokenPresent={Boolean(inviteToken)} />;
  }

  if (inviteToken) {
    return (
      <WorkspaceInvitePage
        inviteToken={inviteToken}
        onDismiss={() => {
          clearInviteToken();
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
