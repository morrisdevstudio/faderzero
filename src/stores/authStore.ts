import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase/client';
import {
  getSession,
  signOut as apiSignOut,
  signInWithPassword as apiSignInWithPassword,
  signUpWithPassword as apiSignUpWithPassword,
  changePassword as apiChangePassword,
  completePasswordRecovery as apiCompletePasswordRecovery,
  requestEmailChange as apiRequestEmailChange,
  requestPasswordReset as apiRequestPasswordReset,
  resendSignupConfirmation as apiResendSignupConfirmation,
  type PasswordSignUpResult,
} from '@/services/supabase/auth';
import {
  getUserWorkspaces,
  createWorkspace as apiCreateWorkspace,
  acceptWorkspaceInvite as apiAcceptWorkspaceInvite,
  type Workspace,
  normalizeWorkspaceRole,
  normalizeWorkspaceType,
  } from '@/services/supabase/workspace';
import { deactivateUserDatabase, getActiveDatabase } from '@/db/db';
import {
  activateUserData,
  purgeRevokedWorkspaceData,
} from '@/db/userDataMigration';
import {
  configureAudioCacheContext,
  migrateLegacyAudioCache,
  purgeWorkspaceAudioCache,
} from '@/features/audio/audioCacheStore';
import {
  deleteCurrentAccount as apiDeleteCurrentAccount,
  requestAccountDeletion as apiRequestAccountDeletion,
} from '@/services/supabase/accountDeletion';
import { reportClientCompatibility } from '@/services/supabase/compatibilityObservation';

interface AuthState {
  session: Session | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  infoMessage: string | null;
  initialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<PasswordSignUpResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  completePasswordRecovery: (newPassword: string) => Promise<void>;
  requestEmailChange: (email: string) => Promise<void>;
  requestAccountDeletion: () => Promise<void>;
  deleteCurrentAccount: (token: string) => Promise<void>;
  setActiveWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string) => Promise<void>;
  joinWorkspaceByInvite: (token: string) => Promise<Workspace>;
  refreshWorkspaceAccess: () => Promise<Workspace[]>;
  clearFeedback: () => void;
}

const LOCAL_STORAGE_KEY = 'faderzero_active_workspace_id';
const LOCAL_WORKSPACES_KEY_PREFIX = 'faderzero_cached_workspaces';
const WORKSPACE_REQUEST_TIMEOUT_MS = 5000;
const preparedAudioCacheFingerprints = new Map<string, string>();

interface LoadedWorkspaces {
  workspaces: Workspace[];
  verifiedByServer: boolean;
}

function getWorkspacesStorageKey(userId: string) {
  return `${LOCAL_WORKSPACES_KEY_PREFIX}:${userId}`;
}

function getCachedWorkspaces(userId: string): Workspace[] {
  try {
    const raw = localStorage.getItem(getWorkspacesStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      id: String(item.id),
      name: String(item.name),
      createdBy: String(item.createdBy),
      createdAt: String(item.createdAt),
      updatedAt: String(item.updatedAt),
      logoUrl: item.logoUrl ? String(item.logoUrl) : null,
      role: normalizeWorkspaceRole(item.role),
      type: normalizeWorkspaceType(item.type),
    }));
  } catch {
    return [];
  }
}

function cacheWorkspaces(userId: string, workspaces: Workspace[]) {
  try {
    localStorage.setItem(getWorkspacesStorageKey(userId), JSON.stringify(workspaces));
  } catch {}
}

async function getWorkspacesWithTimeout(): Promise<Workspace[]> {
  const fetchPromise = getUserWorkspaces();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('TIMEOUT')), WORKSPACE_REQUEST_TIMEOUT_MS);
  });
  return Promise.race([fetchPromise, timeoutPromise]);
}

async function loadWorkspaces(userId: string): Promise<LoadedWorkspaces> {
  const cachedWorkspaces = getCachedWorkspaces(userId);
  if (!navigator.onLine) {
    return { workspaces: cachedWorkspaces, verifiedByServer: false };
  }

  try {
    const workspaces = await getWorkspacesWithTimeout();
    cacheWorkspaces(userId, workspaces);
    return { workspaces, verifiedByServer: true };
  } catch (error) {
    if (cachedWorkspaces.length > 0) {
      return { workspaces: cachedWorkspaces, verifiedByServer: false };
    }
    const demoWorkspaces: Workspace[] = [
      { id: 'ws-alpha', name: 'Groupe Alpha', createdBy: userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), role: 'admin', type: 'group' },
      { id: 'ws-beta', name: 'Groupe Beta', createdBy: userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), role: 'admin', type: 'group' },
      { id: 'ws-personal', name: 'Mon Espace', createdBy: userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), role: 'admin', type: 'personal' },
    ];
    return { workspaces: demoWorkspaces, verifiedByServer: false };
  }
}

async function prepareUserLocalData(userId: string, loaded: LoadedWorkspaces) {
  const allowedWorkspaceIds = new Set(loaded.workspaces.map(({ id }) => id));
  const fingerprint = [...allowedWorkspaceIds].sort().join('|');
  const migrationReport = await activateUserData(userId, allowedWorkspaceIds);
  let revokedWorkspaceIds: string[] = [];
  if (loaded.verifiedByServer) {
    revokedWorkspaceIds = await purgeRevokedWorkspaceData(allowedWorkspaceIds);
    await Promise.all(revokedWorkspaceIds.map((workspaceId) => purgeWorkspaceAudioCache(userId, workspaceId)));
  }
  if (preparedAudioCacheFingerprints.get(userId) !== fingerprint) {
    await migrateLegacyAudioCache(userId, getActiveDatabase());
    preparedAudioCacheFingerprints.set(userId, fingerprint);
  }
  if (loaded.verifiedByServer && navigator.onLine) {
    try {
      await reportClientCompatibility(migrationReport);
    } catch (error) {
      console.warn('[Compatibility Observation]', error);
    }
  }
  return revokedWorkspaceIds;
}

function getWorkspaceById(workspaces: Workspace[], workspaceId: string | null | undefined): Workspace | undefined {
  if (!workspaceId) return undefined;
  return workspaces.find(({ id }) => id === workspaceId);
}

export function selectInitialWorkspace(workspaces: Workspace[]): Workspace | undefined {
  const personalWorkspace = workspaces.find((workspace) => workspace.type === 'personal');
  if (personalWorkspace) return personalWorkspace;
  const storedId = localStorage.getItem(LOCAL_STORAGE_KEY);
  const storedWorkspace = getWorkspaceById(workspaces, storedId);
  if (storedWorkspace) return storedWorkspace;
  return workspaces[0];
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  workspaces: [],
  activeWorkspace: null,
  loading: true,
  error: null,
  infoMessage: null,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    try {
      const session = await getSession();
      set({ session });

      if (session) {
        const userId = session.user.id;
        const loaded = await loadWorkspaces(userId);
        const workspaces = loaded.workspaces;
        const active = selectInitialWorkspace(workspaces);

        await prepareUserLocalData(userId, loaded);
        configureAudioCacheContext(userId, active?.id ?? null);

        if (active) {
          localStorage.setItem(LOCAL_STORAGE_KEY, active.id);
        }

        set({ workspaces, activeWorkspace: active ?? null });
      }

      supabase.auth.onAuthStateChange(async (event, newSession) => {
        const currentSession = get().session;
        if (newSession?.user?.id !== currentSession?.user?.id) {
          set({ session: newSession, loading: true, error: null });
          if (newSession) {
            try {
              const userId = newSession.user.id;
              const loaded = await loadWorkspaces(userId);
              const workspaces = loaded.workspaces;
              const active = selectInitialWorkspace(workspaces);

              await prepareUserLocalData(userId, loaded);
              configureAudioCacheContext(userId, active?.id ?? null);

              if (active) {
                localStorage.setItem(LOCAL_STORAGE_KEY, active.id);
              }

              set({
                workspaces,
                activeWorkspace: active ?? null,
                loading: false,
                infoMessage: null,
              });
            } catch (err: any) {
              set({ error: err.message, loading: false });
            }
          } else {
            await deactivateUserDatabase();
            configureAudioCacheContext(null, null);
            set({ session: null, workspaces: [], activeWorkspace: null, loading: false });
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        } else {
          set({
            session: newSession,
            infoMessage: event === 'USER_UPDATED' ? 'Votre adresse e-mail a été confirmée.' : get().infoMessage,
          });
        }
      });

      set({ initialized: true, loading: false });
    } catch (err: any) {
      set({ error: err.message, initialized: true, loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      const authRes = await apiSignInWithPassword(email, password);
      const userSession = authRes.session;
      if (userSession) {
        const userId = userSession.user.id;
        const loaded = await loadWorkspaces(userId);
        const workspaces = loaded.workspaces;
        const active = selectInitialWorkspace(workspaces);

        await prepareUserLocalData(userId, loaded);
        configureAudioCacheContext(userId, active?.id ?? null);

        if (active) {
          localStorage.setItem(LOCAL_STORAGE_KEY, active.id);
        }

        set({
          session: userSession,
          workspaces,
          activeWorkspace: active ?? null,
          loading: false,
          initialized: true,
          error: null,
        });
        return;
      }
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signUp: async (displayName, email, password) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      const result = await apiSignUpWithPassword(displayName, email, password);

      await deactivateUserDatabase();
      configureAudioCacheContext(null, null);
      set({ session: null, workspaces: [], activeWorkspace: null, loading: false });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return result;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  requestPasswordReset: async (email) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      await apiRequestPasswordReset(email);
      set({
        loading: false,
        infoMessage: 'Si un compte correspond a cette adresse, un e-mail de reinitialisation a ete envoye.',
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  resendSignupConfirmation: async (email) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      await apiResendSignupConfirmation(email);
      set({
        loading: false,
        infoMessage: 'E-mail de confirmation renvoye.',
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signOut: async () => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      if (!navigator.onLine) {
        const pendingMutations = await getActiveDatabase().syncQueue
          .filter((item) => item.status !== 'conflict')
          .count();
        if (pendingMutations > 0) {
          throw new Error(
            `${pendingMutations} modification(s) locale(s) doivent être synchronisées avant la déconnexion.`,
          );
        }
      }
      await apiSignOut();
      await deactivateUserDatabase();
      configureAudioCacheContext(null, null);
      set({ session: null, workspaces: [], activeWorkspace: null, loading: false });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updatePassword: async (currentPassword, newPassword) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      await apiChangePassword(currentPassword, newPassword);
      await deactivateUserDatabase();
      configureAudioCacheContext(null, null);
      set({
        session: null,
        workspaces: [],
        activeWorkspace: null,
        loading: false,
        infoMessage: 'Mot de passe mis a jour. Reconnectez-vous sur chaque appareil.',
      });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  completePasswordRecovery: async (newPassword) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      await apiCompletePasswordRecovery(newPassword);
      await deactivateUserDatabase();
      configureAudioCacheContext(null, null);
      set({
        session: null,
        workspaces: [],
        activeWorkspace: null,
        loading: false,
        infoMessage: 'Mot de passe reinitialise. Connectez-vous avec votre nouveau mot de passe.',
      });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  requestEmailChange: async (email) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      await apiRequestEmailChange(email);
      set({
        loading: false,
        infoMessage: 'Un e-mail de confirmation a ete envoye aux deux adresses.',
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  requestAccountDeletion: async () => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      await apiRequestAccountDeletion();
      set({
        loading: false,
        infoMessage: 'Si la suppression est autorisee, un lien a ete envoye par e-mail.',
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deleteCurrentAccount: async (token) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      await apiDeleteCurrentAccount(token);
      await deactivateUserDatabase();
      configureAudioCacheContext(null, null);
      set({
        session: null,
        workspaces: [],
        activeWorkspace: null,
        loading: false,
        infoMessage: 'Votre compte a ete supprime.',
      });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  setActiveWorkspace: (workspace) => {
    set({ activeWorkspace: workspace, error: null, infoMessage: null });
    localStorage.setItem(LOCAL_STORAGE_KEY, workspace.id);
    const userId = get().session?.user.id;
    if (userId) {
      configureAudioCacheContext(userId, workspace.id);
    }
  },

  createWorkspace: async (name) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      const userId = get().session?.user.id ?? '';
      let newWorkspace: Workspace;
      try {
        newWorkspace = await apiCreateWorkspace(name);
      } catch (err: any) {
        if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
          newWorkspace = {
            id: `ws-${Date.now()}`,
            name: name.trim(),
            createdBy: userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: 'admin',
            type: 'group',
          };
        } else {
          throw err;
        }
      }

      const loaded = await loadWorkspaces(userId);
      const existingWorkspaces = get().workspaces;
      let workspaces = [...loaded.workspaces];
      for (const existing of existingWorkspaces) {
        if (!workspaces.some((w) => w.id === existing.id)) {
          workspaces.push(existing);
        }
      }
      if (!workspaces.some((w) => w.id === newWorkspace.id)) {
        workspaces = [newWorkspace, ...workspaces];
      }
      cacheWorkspaces(userId, workspaces);
      await prepareUserLocalData(userId, { workspaces, verifiedByServer: loaded.verifiedByServer });
      set({
        workspaces,
        activeWorkspace: newWorkspace,
        loading: false,
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, newWorkspace.id);
      configureAudioCacheContext(userId, newWorkspace.id);
    } catch (err: any) {
      console.error('[createWorkspace error]', err);
      set({ error: err.message || 'Erreur lors de la cr�ation du groupe.', loading: false });
      throw err;
    }
  },

  joinWorkspaceByInvite: async (token) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      const currentActiveWorkspace = get().activeWorkspace;
      const joinedWorkspace = await apiAcceptWorkspaceInvite(token);
      const userId = get().session?.user.id ?? '';
      const loaded = await loadWorkspaces(userId);
      const existingWorkspaces = get().workspaces;
      let workspaces = [...loaded.workspaces];
      for (const existing of existingWorkspaces) {
        if (!workspaces.some((w) => w.id === existing.id)) {
          workspaces.push(existing);
        }
      }
      if (!workspaces.some((w) => w.id === joinedWorkspace.id)) {
        workspaces = [joinedWorkspace, ...workspaces];
      }
      cacheWorkspaces(userId, workspaces);
      await prepareUserLocalData(userId, { workspaces, verifiedByServer: loaded.verifiedByServer });
      const preservedActiveWorkspace = getWorkspaceById(workspaces, currentActiveWorkspace?.id);
      const nextActiveWorkspace = preservedActiveWorkspace || joinedWorkspace;

      set({
        workspaces,
        activeWorkspace: nextActiveWorkspace,
        loading: false,
        infoMessage:
          preservedActiveWorkspace && preservedActiveWorkspace.id !== joinedWorkspace.id
            ? `Vous avez rejoint ${joinedWorkspace.name}. Groupe actif conserve: ${preservedActiveWorkspace.name}.`
            : `Vous avez rejoint ${joinedWorkspace.name}.`,
      });

      if (nextActiveWorkspace) {
        localStorage.setItem(LOCAL_STORAGE_KEY, nextActiveWorkspace.id);
        configureAudioCacheContext(userId, nextActiveWorkspace.id);
      }
      return joinedWorkspace;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  refreshWorkspaceAccess: async () => {
    const currentSession = get().session;
    if (!currentSession) return [];

    const loaded = await loadWorkspaces(currentSession.user.id);
    cacheWorkspaces(currentSession.user.id, loaded.workspaces);
    await prepareUserLocalData(currentSession.user.id, loaded);
    const active = getWorkspaceById(loaded.workspaces, get().activeWorkspace?.id) || selectInitialWorkspace(loaded.workspaces);
    if (active) localStorage.setItem(LOCAL_STORAGE_KEY, active.id);
    else localStorage.removeItem(LOCAL_STORAGE_KEY);
    configureAudioCacheContext(currentSession.user.id, active?.id ?? null);
    set({ workspaces: loaded.workspaces, activeWorkspace: active ?? null });
    return loaded.workspaces;
  },

  clearFeedback: () => {
    set({ error: null, infoMessage: null });
  },
}));

if (typeof window !== 'undefined') { (window as any).useAuthStore = useAuthStore; }
