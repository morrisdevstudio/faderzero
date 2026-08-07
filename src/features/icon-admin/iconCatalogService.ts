import { supabase } from '@/services/supabase/client';
import fallbackInventoryRaw from '../../../docs/icon-audit/icon-inventory.json?raw';

export type IconRole = {
  key: string;
  label: string;
  description: string;
  sourceType: 'lucide' | 'custom';
  iconName: string;
  status: 'draft' | 'approved' | 'deprecated';
  version: number;
};

export type IconOccurrence = {
  usageId: string;
  occurrenceId: string;
  name: string;
  route: string;
  pageName: string;
  file: string;
  line: number;
  format: string;
  fingerprint: string;
  source: string;
  defaultRoleKey: string | null;
  assignedRoleKey: string | null;
  overrideIconName: string | null;
  integrationState: 'legacy' | 'registry' | 'custom-kept' | 'ignored' | 'stale';
  verificationState: 'unverified' | 'verified';
  version: number;
};

export type IconPublication = {
  id: string;
  status: 'queued' | 'building' | 'active' | 'failed';
  requestedAt: string;
  completedAt: string | null;
  sourceRevision: string;
};

export type IconCatalog = { roles: IconRole[]; occurrences: IconOccurrence[]; publications: IconPublication[]; cached: boolean };

const cacheKey = 'faderzero:icon-design-system:v1';

const roleByLegacyName: Record<string, string> = {
  ArrowDownIcon: 'menu', ArrowUpIcon: 'menu', BackIcon: 'back', CalendarIcon: 'calendar',
  CachedIcon: 'download', CheckIcon: 'check', ChevronDownIcon: 'menu', ChevronIcon: 'menu',
  CloseIcon: 'close', DownloadCloudIcon: 'download', DotsIcon: 'menu', EditLineIcon: 'edit',
  FullscreenIcon: 'fullscreen', HomeIcon: 'home', LinkAudioIcon: 'edit', LinkSongIcon: 'edit',
  MetronomeIcon: 'metronome', MicrophoneIcon: 'record', PauseIcon: 'pause', PencilIcon: 'edit',
  PlayIcon: 'play', PlusIcon: 'add', PrimaryAudioIcon: 'check', PrimaryIcon: 'check',
  PrompterIcon: 'prompter', RecordAudioIcon: 'record', RecordIdeaIcon: 'record',
  SetlistIcon: 'setlist', SettingsIcon: 'settings', SongsIcon: 'songs', StopIcon: 'stop',
  TrashIcon: 'delete', UploadAudioIcon: 'upload', UploadIcon: 'upload', WriteIcon: 'edit',
};

const defaultRoles: IconRole[] = [
  ['add', 'Ajouter', 'plus'], ['back', 'Retour', 'arrow-left'], ['calendar', 'Calendrier', 'calendar-days'],
  ['check', 'Valider', 'check'], ['close', 'Fermer', 'x'], ['delete', 'Supprimer', 'trash-2'],
  ['download', 'Télécharger', 'cloud-download'], ['edit', 'Modifier', 'pencil'],
  ['fullscreen', 'Plein écran', 'maximize'], ['home', 'Accueil', 'house'],
  ['menu', 'Plus d’actions', 'ellipsis'], ['metronome', 'Métronome', 'audio-waveform'],
  ['pause', 'Pause', 'pause'], ['play', 'Lecture', 'play'], ['prompter', 'Prompteur', 'monitor-up'],
  ['record', 'Enregistrer', 'mic'], ['setlist', 'Setlist', 'list-music'],
  ['settings', 'Réglages', 'settings'], ['songs', 'Morceaux', 'library'],
  ['stop', 'Arrêt', 'square'], ['upload', 'Importer', 'upload'],
].map(([key, label, iconName]) => ({ key: key!, label: label!, iconName: iconName!, description: '', sourceType: 'lucide', status: 'approved', version: 1 }));

function fallbackOccurrences(): IconOccurrence[] {
  const parsed = JSON.parse(fallbackInventoryRaw) as { icons?: Array<Record<string, unknown>> };
  return (parsed.icons ?? []).map((item) => {
    const proposal = item.proposal as Record<string, unknown> | undefined;
    const decision = item.decision as Record<string, unknown> | undefined;
    const name = String(item.name ?? 'Icône');
    const role = typeof proposal?.faderzeroName === 'string' && proposal.faderzeroName
      ? proposal.faderzeroName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : roleByLegacyName[name] ?? null;
    return {
      usageId: `legacy:${String(item.occurrenceId)}`,
      occurrenceId: String(item.occurrenceId), name,
      route: String(item.route ?? ''), pageName: String(item.pageName ?? ''),
      file: String(item.file ?? ''), line: Number(item.line ?? 0), format: String(item.format ?? ''),
      fingerprint: String(item.fingerprint ?? ''), source: String(item.source ?? ''),
      defaultRoleKey: role, assignedRoleKey: role,
      overrideIconName: typeof proposal?.lucideIcon === 'string' ? proposal.lucideIcon.replace(/^Lucide/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() : null,
      integrationState: decision?.status === 'custom-kept' ? 'custom-kept' : 'legacy',
      verificationState: decision?.status === 'verified' ? 'verified' : 'unverified', version: 1,
    };
  });
}

function readCache(): IconCatalog | null {
  try { const value = localStorage.getItem(cacheKey); return value ? { ...(JSON.parse(value) as IconCatalog), cached: true } : null; } catch { return null; }
}

function writeCache(value: IconCatalog) {
  try { localStorage.setItem(cacheKey, JSON.stringify({ ...value, cached: false })); } catch { /* storage is best effort */ }
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) return import.meta.env.DEV;
  return Boolean(data);
}

export async function loadIconCatalog(): Promise<IconCatalog> {
  if (!navigator.onLine) return readCache() ?? { roles: defaultRoles, occurrences: fallbackOccurrences(), publications: [], cached: true };
  const [rolesResult, occurrencesResult, publicationsResult] = await Promise.all([
    supabase.from('design_icon_roles').select('*').order('label'),
    supabase.from('design_icon_occurrences').select('*').order('usage_id'),
    supabase.from('design_icon_publications').select('id,status,requested_at,completed_at,source_revision').order('requested_at', { ascending: false }).limit(12),
  ]);
  if (rolesResult.error || occurrencesResult.error || publicationsResult.error) {
    const cached = readCache();
    if (cached) return cached;
    return { roles: defaultRoles, occurrences: fallbackOccurrences(), publications: [], cached: true };
  }
  const roles: IconRole[] = (rolesResult.data ?? []).map((row) => ({
    key: row.key, label: row.label, description: row.description, sourceType: row.source_type,
    iconName: row.icon_name, status: row.status, version: Number(row.version),
  }));
  const remoteOccurrences: IconOccurrence[] = (occurrencesResult.data ?? []).map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      usageId: row.usage_id, occurrenceId: row.occurrence_id, name: String(metadata.name ?? row.usage_id),
      route: String(metadata.route ?? ''), pageName: String(metadata.pageName ?? ''), file: String(metadata.file ?? ''),
      line: Number(metadata.line ?? 0), format: String(metadata.format ?? ''), fingerprint: String(metadata.fingerprint ?? ''),
      source: String(metadata.source ?? ''), defaultRoleKey: row.default_role_key, assignedRoleKey: row.assigned_role_key,
      overrideIconName: row.override_icon_name, integrationState: row.integration_state,
      verificationState: row.verification_state, version: Number(row.version),
    };
  });
  const value: IconCatalog = {
    roles: roles.length ? roles : defaultRoles,
    occurrences: remoteOccurrences.length ? remoteOccurrences : fallbackOccurrences(),
    publications: (publicationsResult.data ?? []).map((row) => ({ id: row.id, status: row.status, requestedAt: row.requested_at, completedAt: row.completed_at, sourceRevision: row.source_revision })),
    cached: false,
  };
  writeCache(value);
  return value;
}

export async function saveIconDecision(input: {
  occurrence: IconOccurrence; roleKey: string; iconName: string; exception: boolean; userId: string;
}) {
  const role = input.roleKey || null;
  const nextOccurrence = {
    usage_id: input.occurrence.usageId,
    occurrence_id: input.occurrence.occurrenceId,
    default_role_key: input.occurrence.defaultRoleKey,
    assigned_role_key: role,
    override_source_type: input.exception ? 'lucide' : null,
    override_icon_name: input.exception ? input.iconName : null,
    integration_state: input.occurrence.integrationState,
    verification_state: input.occurrence.verificationState,
    metadata: {
      name: input.occurrence.name, route: input.occurrence.route, pageName: input.occurrence.pageName,
      file: input.occurrence.file, line: input.occurrence.line, format: input.occurrence.format,
      fingerprint: input.occurrence.fingerprint, source: input.occurrence.source,
    },
    version: input.occurrence.version + 1, updated_by: input.userId, updated_at: new Date().toISOString(),
  };
  const { data: updated, error: occurrenceError } = await supabase.from('design_icon_occurrences')
    .update(nextOccurrence)
    .eq('usage_id', input.occurrence.usageId)
    .eq('version', input.occurrence.version)
    .select('usage_id')
    .maybeSingle();
  if (occurrenceError) throw occurrenceError;
  if (!updated) {
    if (input.occurrence.version > 1) throw new Error('Cette icône a été modifiée ailleurs. Rechargez le catalogue.');
    const { error: insertError } = await supabase.from('design_icon_occurrences').insert(nextOccurrence);
    if (insertError?.code === '23505') throw new Error('Cette icône a été modifiée ailleurs. Rechargez le catalogue.');
    if (insertError) throw insertError;
  }
  if (!input.exception && role) {
    const { error: roleError } = await supabase.from('design_icon_roles').update({
      icon_name: input.iconName, status: 'approved', updated_by: input.userId, updated_at: new Date().toISOString(),
    }).eq('key', role);
    if (roleError) throw roleError;
  }
}

export async function requestIconPublication() {
  const { data, error } = await supabase.functions.invoke('publish-icon-system', { body: {} });
  if (error) throw error;
  return data as { publicationId: string; status: string };
}
