export const iconRoleKeys = [
  'add', 'back', 'calendar', 'check', 'chevron-down', 'close', 'delete', 'download', 'edit',
  'folder', 'fullscreen', 'home', 'menu', 'metronome', 'pause', 'play', 'prompter',
  'record', 'setlist', 'settings', 'songs', 'stop', 'upload',
  'show-password', 'hide-password', 'export-pdf',
  'phone', 'phone-add', 'calendar-add', 'filter', 'email', 'external-link', 'copy',
  'next', 'location', 'users', 'music', 'star',
  'clipboard-list', 'list-checks', 'wrench', 'cable', 'mic-vocal', 'speaker',
  'audio-lines', 'images', 'briefcase-business', 'file-music', 'file-archive', 'file-text',
  'globe-2', 'flag', 'building-2', 'guitar', 'drum', 'music-note', 'user-round',
  'clock', 'heart', 'radio', 'disc-3', 'zap', 'flame', 'languages', 'sparkles',
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
