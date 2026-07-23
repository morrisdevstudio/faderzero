import type { LocalMigrationReport } from '@/db/userDataMigration';
import { FADERZERO_LOCAL_SCHEMA_VERSION } from '@/db/db';
import { createId } from '@/lib/createId';
import { supabase } from '@/services/supabase/client';

const CLIENT_ID_STORAGE_KEY = 'faderzero_compatibility_client_id';
const APP_VERSION = import.meta.env.VITE_APP_VERSION?.trim() || 'development';

export interface CompatibilityObservation {
  clientId: string;
  appVersion: string;
  localSchemaVersion: number;
  migrationStatus: 'completed' | 'recovery_required';
  legacyRecordCount: number;
  recoveryItemCount: number;
}

export function getCompatibilityClientId(): string {
  const stored = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (stored) return stored;

  const clientId = createId();
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  return clientId;
}

export function buildCompatibilityObservation(
  report: LocalMigrationReport,
  options?: { clientId?: string; appVersion?: string },
): CompatibilityObservation {
  return {
    clientId: options?.clientId ?? getCompatibilityClientId(),
    appVersion: options?.appVersion?.trim() || APP_VERSION,
    localSchemaVersion: FADERZERO_LOCAL_SCHEMA_VERSION,
    migrationStatus: report.recoveryCount > 0 ? 'recovery_required' : 'completed',
    legacyRecordCount: Object.values(report.sourceCounts).reduce((total, count) => total + count, 0),
    recoveryItemCount: report.recoveryCount,
  };
}

export async function reportClientCompatibility(report: LocalMigrationReport): Promise<void> {
  const observation = buildCompatibilityObservation(report);
  const { error } = await supabase.rpc('report_client_compatibility', {
    p_client_id: observation.clientId,
    p_app_version: observation.appVersion,
    p_local_schema_version: observation.localSchemaVersion,
    p_migration_status: observation.migrationStatus,
    p_legacy_record_count: observation.legacyRecordCount,
    p_recovery_item_count: observation.recoveryItemCount,
  });

  if (error) throw error;
}
