import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingInviteToken, readPendingInviteToken } from './inviteContext';

describe('pending invite context', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/account');
    vi.useRealTimers();
  });

  it('removes the secret from the URL immediately and keeps it temporarily', () => {
    window.history.replaceState({}, '', '/account?invite=secret-token&tab=profile');

    expect(readPendingInviteToken()).toBe('secret-token');
    expect(window.location.search).toBe('?tab=profile');
    expect(readPendingInviteToken()).toBe('secret-token');
  });

  it('expires the stored context after 24 hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-22T10:00:00.000Z'));
    window.history.replaceState({}, '', '/account?invite=secret-token');
    expect(readPendingInviteToken()).toBe('secret-token');

    vi.setSystemTime(new Date('2026-07-23T10:00:01.000Z'));
    expect(readPendingInviteToken()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('migrates the legacy raw local value without losing it', () => {
    localStorage.setItem('faderzero_pending_invite_token', 'legacy-secret');
    expect(readPendingInviteToken()).toBe('legacy-secret');
    expect(localStorage.getItem('faderzero_pending_invite_token')).toContain('expiresAt');
  });

  it('clears both storage and any URL parameter', () => {
    window.history.replaceState({}, '', '/account?invite=secret-token');
    readPendingInviteToken();
    clearPendingInviteToken();
    expect(localStorage.length).toBe(0);
    expect(window.location.search).toBe('');
  });
});
