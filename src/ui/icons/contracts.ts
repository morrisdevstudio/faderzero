export const iconRoleKeys = [
  'add', 'back', 'calendar', 'check', 'close', 'delete', 'download', 'edit',
  'fullscreen', 'home', 'menu', 'metronome', 'pause', 'play', 'prompter',
  'record', 'setlist', 'settings', 'songs', 'stop', 'upload',
] as const;

export type IconRoleKey = (typeof iconRoleKeys)[number];
export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

export type PublishedIconManifest = {
  schemaVersion: 1;
  publicationId: string;
  roles: Partial<Record<IconRoleKey, { sourceType: 'lucide' | 'custom'; iconName: string }>>;
  usageOverrides: Record<string, { sourceType: 'lucide' | 'custom'; iconName: string }>;
};
