import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const inventoryPath = resolve(root, 'docs/icon-audit/icon-inventory.json');
const migrationPath = resolve(root, 'docs/icon-audit/icon-migration.json');

const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));

const roleByLegacyName = {
  ArrowDownIcon: 'menu',
  ArrowUpIcon: 'menu',
  BackIcon: 'back',
  CalendarIcon: 'calendar',
  CachedIcon: 'download',
  CheckIcon: 'check',
  ChevronDownIcon: 'menu',
  ChevronIcon: 'menu',
  CloseIcon: 'close',
  DownloadCloudIcon: 'download',
  DotsIcon: 'menu',
  EditLineIcon: 'edit',
  FullscreenIcon: 'fullscreen',
  HomeIcon: 'home',
  LinkAudioIcon: 'edit',
  LinkSongIcon: 'edit',
  MetronomeIcon: 'metronome',
  MicrophoneIcon: 'record',
  PauseIcon: 'pause',
  PencilIcon: 'edit',
  PlayIcon: 'play',
  PlusIcon: 'add',
  PrimaryAudioIcon: 'check',
  PrimaryIcon: 'check',
  PrompterIcon: 'prompter',
  RecordAudioIcon: 'record',
  RecordIdeaIcon: 'record',
  SetlistIcon: 'setlist',
  SettingsIcon: 'settings',
  SongsIcon: 'songs',
  StopIcon: 'stop',
  TrashIcon: 'delete',
  UploadAudioIcon: 'upload',
  UploadIcon: 'upload',
  WriteIcon: 'edit',
};

const migrations = (inventory.icons ?? [])
  .filter((item) => item.format === 'inline-svg' || item.format === 'react-component')
  .map((item) => {
    const isAlreadyMigrated = item.name === 'FzIcon';
    const inferredRole = roleByLegacyName[item.name] ?? null;
    return {
      occurrenceId: item.occurrenceId,
      file: item.file,
      line: item.line,
      name: item.name,
      role: inferredRole,
      status: isAlreadyMigrated ? 'migrated' : inferredRole ? 'approved' : item.status || 'discovered',
    };
  });

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  total: migrations.length,
  migrated: migrations.filter((m) => m.status === 'migrated').length,
  approved: migrations.filter((m) => m.status === 'approved').length,
  migrations,
};

writeFileSync(migrationPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`[icons:export] Exported ${migrations.length} occurrences (${output.migrated} migrated, ${output.approved} approved) to ${migrationPath}`);
