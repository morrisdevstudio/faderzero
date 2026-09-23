import { supabase } from '@/services/supabase/client';
import { createStorageReadUrl, uploadStorageObject } from './index';
import { listWorkspaceStorageConnections } from '@/services/supabase/workspaceStorage';

export interface StorageTransferReport {
  copied: number;
  failed: Array<{ logicalKey: string; message: string }>;
  completedAt: string;
}

interface TransferItem {
  logicalKey: string;
  mimeType: string;
  sizeBytes: number;
  objectKind: 'audio' | 'epk_media' | 'document';
  contentHash?: string;
}

export async function transferWorkspaceStorage(
  workspaceId: string,
  onProgress?: (completed: number, total: number, logicalKey: string) => void,
): Promise<StorageTransferReport> {
  const connections = await listWorkspaceStorageConnections(workspaceId);
  const target = connections.find((connection) => connection.isDefault && connection.status === 'connected');
  if (!target) throw new Error('Aucun stockage de destination actif.');
  const { data: objects, error: objectError } = await supabase
    .from('storage_objects')
    .select('id,logical_key,mime_type,size_bytes,object_kind,content_hash')
    .eq('workspace_id', workspaceId);
  if (objectError) throw objectError;
  const objectIds = (objects ?? []).map((row) => row.id);
  const { data: locations, error: locationError } = objectIds.length
    ? await supabase.from('storage_object_locations').select('storage_object_id,provider_id').in('storage_object_id', objectIds).eq('is_primary', true).eq('verification_status', 'verified')
    : { data: [], error: null };
  if (locationError) throw locationError;
  const primaryProvider = new Map((locations ?? []).map((row) => [row.storage_object_id, row.provider_id]));
  const items: TransferItem[] = (objects ?? [])
    .filter((row) => primaryProvider.get(row.id) !== target.providerId)
    .map((row) => ({
      logicalKey: String(row.logical_key), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes),
      objectKind: row.object_kind as TransferItem['objectKind'],
      ...(typeof row.content_hash === 'string' ? { contentHash: row.content_hash } : {}),
    }));
  const report: StorageTransferReport = { copied: 0, failed: [], completedAt: '' };
  for (const [index, item] of items.entries()) {
    try {
      const sourceUrl = await createStorageReadUrl(workspaceId, item.logicalKey);
      const source = await fetch(sourceUrl);
      if (!source.ok) throw new Error(`Lecture impossible (${source.status})`);
      const blob = await source.blob();
      if (blob.size !== item.sizeBytes) throw new Error('Taille source incohérente');
      await uploadStorageObject({
        workspaceId, logicalKey: item.logicalKey, sizeBytes: item.sizeBytes,
        mimeType: item.mimeType, objectKind: item.objectKind,
        ...(item.contentHash ? { contentHash: item.contentHash } : {}),
      }, blob);
      report.copied += 1;
    } catch (error) {
      report.failed.push({ logicalKey: item.logicalKey, message: error instanceof Error ? error.message : 'Échec du transfert' });
    }
    onProgress?.(index + 1, items.length, item.logicalKey);
  }
  report.completedAt = new Date().toISOString();
  localStorage.setItem(`faderzero:storage-transfer:${workspaceId}`, JSON.stringify(report));
  return report;
}
