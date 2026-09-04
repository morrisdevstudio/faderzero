import { describe, expect, it } from 'vitest';
import { readSettingsView, settingsParent, settingsUrl, type SettingsTab } from './settingsNavigation';

describe('settings navigation', () => {
  it.each([
    ['', 'home'], ['?tab=groupe', 'home'], ['?tab=compte', 'security'],
    ['?tab=sync', 'sync'], ['?view=profile&tab=sync', 'profile'],
    ['?view=unknown&tab=sync', 'home'], ['?view=security&reset-password=1', 'password'],
  ])('resolves %s to %s', (search, expected) => expect(readSettingsView(search)).toBe(expected));

  it.each([['compte', 'security'], ['groupe', 'home'], ['sync', 'sync']] as const)(
    'keeps defaultTab=%s compatible', (tab: SettingsTab, expected) => expect(readSettingsView('', tab)).toBe(expected),
  );
  it('prioritizes recognized deletion links', () => {
    expect(readSettingsView('?view=profile&reset-password=1', undefined, true)).toBe('delete-account');
  });
  it('preserves invitation context and encodes workspace IDs', () => {
    const url = settingsUrl('group-members', '?invite=secret&custom=keep&tab=groupe', 'group & 1');
    const params = new URL(url, 'https://example.test').searchParams;
    expect(params.get('invite')).toBe('secret');
    expect(params.get('custom')).toBe('keep');
    expect(params.get('workspace')).toBe('group & 1');
    expect(params.has('tab')).toBe(false);
  });
  it('leaves special flows without trapping Back on the same screen', () => {
    expect(settingsUrl('security', '?reset-password=1&delete-account=token')).toBe('/account?view=security');
    expect(settingsUrl('home', '?workspace=old&view=sync&tab=sync')).toBe('/account');
  });
  it.each([
    ['group-identity', 'group'], ['group-members', 'group'], ['group-admin', 'group'],
    ['create-group', 'add-group'], ['join-group', 'add-group'],
    ['email', 'security'], ['google', 'security'], ['password', 'security'], ['delete-account', 'security'],
    ['group', 'home'], ['personal', 'home'], ['profile', 'home'], ['sync', 'home'],
  ] as const)('returns from %s to %s', (view, parent) => expect(settingsParent(view)).toBe(parent));
});
