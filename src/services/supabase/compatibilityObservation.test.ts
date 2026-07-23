import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabase/client', () => ({ supabase: { rpc } }));

import {
  buildCompatibilityObservation,
  getCompatibilityClientId,
  reportClientCompatibility,
} from './compatibilityObservation';

const migrationReport = {
  databaseName: 'faderzero-pwa-user-user-1',
  sourceCounts: { songs: 2, setlists: 1 },
  copiedCounts: { songs: 2, setlists: 1 },
  recoveryCount: 0,
  resumed: false,
};

describe('compatibility observation', () => {
  beforeEach(() => {
    localStorage.clear();
    rpc.mockReset();
  });

  it('uses a stable client id and summarizes a completed migration', () => {
    const clientId = getCompatibilityClientId();
    expect(getCompatibilityClientId()).toBe(clientId);
    expect(buildCompatibilityObservation(migrationReport, { clientId, appVersion: 'release-1' })).toEqual({
      clientId,
      appVersion: 'release-1',
      localSchemaVersion: 10,
      migrationStatus: 'completed',
      legacyRecordCount: 3,
      recoveryItemCount: 0,
    });
  });

  it('reports recovery-required clients without exposing migrated records', async () => {
    rpc.mockResolvedValue({ error: null });
    await reportClientCompatibility({ ...migrationReport, recoveryCount: 2 });

    expect(rpc).toHaveBeenCalledWith('report_client_compatibility', expect.objectContaining({
      p_local_schema_version: 10,
      p_migration_status: 'recovery_required',
      p_legacy_record_count: 3,
      p_recovery_item_count: 2,
    }));
  });

  it('propagates an RPC failure so the caller can record the missing evidence', async () => {
    rpc.mockResolvedValue({ error: new Error('offline') });
    await expect(reportClientCompatibility(migrationReport)).rejects.toThrow('offline');
  });
});
