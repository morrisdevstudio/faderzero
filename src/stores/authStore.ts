import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase/client';
import {
  getSession,
  signOut as apiSignOut,
  signInWithPassword as apiSignInWithPassword,
  signUpWithPassword as apiSignUpWithPassword,
  updatePassword as apiUpdatePassword,
  type PasswordSignUpResult,
} from '@/services/supabase/auth';
import {
  getUserWorkspaces,
  createWorkspace as apiCreateWorkspace,
  acceptWorkspaceInvite as apiAcceptWorkspaceInvite,
  type Workspace,
} from '@/services/supabase/workspace';
import { pullRemoteChanges } from '@/services/supabase/sync';

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
  signUp: (email: string, password: string) => Promise<PasswordSignUpResult>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  setActiveWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string) => Promise<void>;
  joinWorkspaceByInvite: (token: string) => Promise<Workspace>;
  clearFeedback: () => void;
}

const LOCAL_STORAGE_KEY = 'faderzero_active_workspace_id';
const LOCAL_WORKSPACES_KEY_PREFIX = 'faderzero_cached_workspaces';
const WORKSPACE_REQUEST_TIMEOUT_MS = 8000;

function getWorkspacesStorageKey(userId: string) {
  return `${LOCAL_WORKSPACES_KEY_PREFIX}:${userId}`;
}

function getCachedWorkspaces(userId: string): Workspace[] {
  try {
    const value = localStorage.getItem(getWorkspacesStorageKey(userId));
    if (!value) return [];

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Workspace[]) : [];
  } catch {
    return [];
  }
}

function cacheWorkspaces(userId: string, workspaces: Workspace[]) {
  localStorage.setItem(getWorkspacesStorageKey(userId), JSON.stringify(workspaces));
}

async function getWorkspacesWithTimeout(): Promise<Workspace[]> {
  return Promise.race([
    getUserWorkspaces(),
    new Promise<Workspace[]>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('Le serveur est indisponible. Utilisation des donnees locales.')),
        WORKSPACE_REQUEST_TIMEOUT_MS,
      );
    }),
  ]);
}

async function loadWorkspaces(userId: string): Promise<Workspace[]> {
  const cachedWorkspaces = getCachedWorkspaces(userId);
  if (cachedWorkspaces.length > 0 || !navigator.onLine) {
    return cachedWorkspaces;
  }

  const workspaces = await getWorkspacesWithTimeout();
  cacheWorkspaces(userId, workspaces);
  return workspaces;
}

function getActiveWorkspace(workspaces: Workspace[]): Workspace | null {
  const storedId = localStorage.getItem(LOCAL_STORAGE_KEY);
  return workspaces.find((w) => w.id === storedId) || workspaces[0] || null;
}

function getWorkspaceById(workspaces: Workspace[], workspaceId: string | null | undefined): Workspace | null {
  if (!workspaceId) return null;
  return workspaces.find((workspace) => workspace.id === workspaceId) || null;
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
        const workspaces = await loadWorkspaces(get().session?.user.id ?? '');
        const active = getActiveWorkspace(workspaces);

        if (active) {
          localStorage.setItem(LOCAL_STORAGE_KEY, active.id);
        }

        set({ workspaces, activeWorkspace: active });
      }

      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        const currentSession = get().session;
        if (newSession?.user?.id !== currentSession?.user?.id) {
          set({ session: newSession, loading: true, error: null });
          if (newSession) {
            try {
              const workspaces = await loadWorkspaces(get().session?.user.id ?? '');
              const active = getActiveWorkspace(workspaces);

              if (active) {
                localStorage.setItem(LOCAL_STORAGE_KEY, active.id);
              }

              set({
                workspaces,
                activeWorkspace: active,
                loading: false,
                infoMessage: null,
              });
            } catch (err: any) {
              set({ error: err.message, loading: false });
            }
          } else {
            set({ workspaces: [], activeWorkspace: null, loading: false });
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        } else {
          set({ session: newSession });
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
      await apiSignInWithPassword(email, password);
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signUp: async (email, password) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      const result = await apiSignUpWithPassword(email, password);

      set({
        loading: false,
        infoMessage: result.needsEmailConfirmation
          ? "Compte cree. Confirmez votre adresse e-mail pour vous connecter."
          : null,
      });

      return result;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signOut: async () => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      await apiSignOut();
      set({ session: null, workspaces: [], activeWorkspace: null, loading: false });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updatePassword: async (password) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      await apiUpdatePassword(password);
      set({
        loading: false,
        infoMessage: 'Mot de passe mis a jour.',
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  setActiveWorkspace: (workspace) => {
    set({ activeWorkspace: workspace, error: null, infoMessage: null });
    localStorage.setItem(LOCAL_STORAGE_KEY, workspace.id);

    if (navigator.onLine) {
      void pullRemoteChanges(workspace.id).catch((err: any) => {
        set({
          error: err?.message || 'Impossible de charger les donnees du groupe selectionne.',
        });
      });
    }
  },

  createWorkspace: async (name) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      const newWorkspace = await apiCreateWorkspace(name);
      const workspaces = await loadWorkspaces(get().session?.user.id ?? '');
      set({
        workspaces,
        activeWorkspace: newWorkspace,
        loading: false,
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, newWorkspace.id);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  joinWorkspaceByInvite: async (token) => {
    set({ loading: true, error: null, infoMessage: null });
    try {
      const currentActiveWorkspace = get().activeWorkspace;
      const joinedWorkspace = await apiAcceptWorkspaceInvite(token);
      const workspaces = await loadWorkspaces(get().session?.user.id ?? '');
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
      }

      return joinedWorkspace;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  clearFeedback: () => {
    set({ error: null, infoMessage: null });
  },
}));
