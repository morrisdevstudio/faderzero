export type SettingsTab = 'compte' | 'groupe' | 'sync';

export const settingsViews = [
  'home', 'add-group', 'create-group', 'join-group', 'group', 'group-identity',
  'group-members', 'group-admin', 'profile', 'security', 'email', 'google',
  'password', 'delete-account', 'personal', 'sync',
] as const;
export type SettingsView = typeof settingsViews[number];

export function readSettingsView(search: string, defaultTab?: SettingsTab, hasDeletionToken = false): SettingsView {
  const params = new URLSearchParams(search);
  if (hasDeletionToken) return 'delete-account';
  if (params.get('reset-password') === '1') return 'password';
  const view = params.get('view');
  if (view !== null) return settingsViews.includes(view as SettingsView) ? view as SettingsView : 'home';
  const tab = params.get('tab') ?? defaultTab;
  if (tab === 'sync') return 'sync';
  if (tab === 'compte') return 'security';
  return 'home';
}

export function settingsParent(view: SettingsView): SettingsView {
  if (['group-identity', 'group-members', 'group-admin'].includes(view)) return 'group';
  if (view === 'create-group' || view === 'join-group') return 'add-group';
  if (['email', 'google', 'password', 'delete-account'].includes(view)) return 'security';
  return 'home';
}

export function settingsUrl(view: SettingsView, search = '', workspaceId?: string): string {
  const params = new URLSearchParams(search);
  params.delete('tab');
  params.delete('workspace');
  // Explicit navigation leaves these one-off flows; other query context stays intact.
  if (view !== 'password') params.delete('reset-password');
  if (view !== 'delete-account') params.delete('delete-account');
  if (view === 'home') params.delete('view');
  else params.set('view', view);
  if (workspaceId && (view === 'personal' || view === 'group' || view.startsWith('group-'))) params.set('workspace', workspaceId);
  const query = params.toString();
  return `/account${query ? `?${query}` : ''}`;
}

export const settingsTitles: Record<SettingsView, string> = {
  home: 'Paramètres', 'add-group': 'Ajouter un groupe', 'create-group': 'Créer un groupe',
  'join-group': 'Rejoindre un groupe', group: 'Groupe', 'group-identity': 'Identité du groupe',
  'group-members': 'Membres et invitations', 'group-admin': 'Administration', profile: 'Profil',
  security: 'Connexion et sécurité', email: 'Adresse e-mail', google: 'Connexion Google',
  password: 'Mot de passe', 'delete-account': 'Supprimer mon compte', personal: 'Mon espace', sync: 'Synchronisation',
};
