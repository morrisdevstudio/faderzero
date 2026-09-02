export const iconRoleKeys = [
  'add', 'back', 'calendar', 'check', 'chevron-down', 'close', 'delete', 'download', 'edit',
  'fullscreen', 'home', 'menu', 'metronome', 'pause', 'play', 'prompter',
  'record', 'setlist', 'settings', 'songs', 'stop', 'upload',
  'show-password', 'hide-password', 'export-pdf',
  'phone', 'phone-add', 'calendar-add', 'filter', 'email', 'external-link', 'copy',
  'next', 'location', 'users', 'music', 'star',
] as const;

export type BuiltInIconRoleKey = (typeof iconRoleKeys)[number];
export type IconRoleKey = BuiltInIconRoleKey | (string & Record<never, never>);
export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

export type PublishedIconManifest = {
  schemaVersion: 1;
  publicationId: string;
  roles: Record<string, { sourceType: 'lucide' | 'custom'; iconName: string }>;
  usageOverrides: Record<string, { sourceType: 'lucide' | 'custom'; iconName: string }>;
};
