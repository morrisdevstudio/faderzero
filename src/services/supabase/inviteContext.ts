const INVITE_STORAGE_KEY = 'faderzero_pending_invite_token';
const INVITE_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredInviteContext {
  token: string;
  expiresAt: number;
}

function persistInviteToken(token: string, expiresAt = Date.now() + INVITE_CONTEXT_TTL_MS) {
  const context: StoredInviteContext = { token, expiresAt };
  localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify(context));
}

function removeInviteFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('invite')) return;
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', url.toString());
}

export function readPendingInviteToken(): string | null {
  const url = new URL(window.location.href);
  const inviteFromUrl = url.searchParams.get('invite')?.trim();

  if (inviteFromUrl) {
    removeInviteFromUrl();
    persistInviteToken(inviteFromUrl);
    return inviteFromUrl;
  }

  const storedValue = localStorage.getItem(INVITE_STORAGE_KEY);
  if (!storedValue) return null;

  try {
    const context = JSON.parse(storedValue) as Partial<StoredInviteContext>;
    if (typeof context.token !== 'string' || !context.token || typeof context.expiresAt !== 'number') {
      throw new Error('INVALID_INVITE_CONTEXT');
    }
    if (context.expiresAt <= Date.now()) {
      clearPendingInviteToken();
      return null;
    }
    return context.token;
  } catch {
    // Compatibility with the raw localStorage value used by the previous version.
    const legacyToken = storedValue.trim();
    if (!legacyToken) {
      clearPendingInviteToken();
      return null;
    }
    persistInviteToken(legacyToken);
    return legacyToken;
  }
}

export function clearPendingInviteToken() {
  removeInviteFromUrl();
  localStorage.removeItem(INVITE_STORAGE_KEY);
}
