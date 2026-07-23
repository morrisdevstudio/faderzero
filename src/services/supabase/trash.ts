import { supabase } from './client';
import { refreshAudioQuota } from './audioQuota';

export interface TrashedItem {
  id: string;
  workspaceId: string;
  entityType: 'song' | 'setlist' | 'songAsset';
  title: string;
  sizeBytes?: number;
  durationSeconds?: number;
  deletedAt: string;
  expiresAt: string;
}

export async function listTrashedItems(workspaceId: string): Promise<TrashedItem[]> {
  const items: TrashedItem[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Songs
  const { data: songs } = await supabase
    .from('songs')
    .select('id, workspace_id, title, deleted_at')
    .eq('workspace_id', workspaceId)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', sevenDaysAgo);

  if (songs) {
    for (const song of songs) {
      const deletedDate = new Date(song.deleted_at);
      const expiresDate = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      items.push({
        id: song.id,
        workspaceId: song.workspace_id,
        entityType: 'song',
        title: song.title || 'Chanson sans titre',
        deletedAt: song.deleted_at,
        expiresAt: expiresDate.toISOString(),
      });
    }
  }

  // Setlists
  const { data: setlists } = await supabase
    .from('setlists')
    .select('id, workspace_id, name, deleted_at')
    .eq('workspace_id', workspaceId)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', sevenDaysAgo);

  if (setlists) {
    for (const setlist of setlists) {
      const deletedDate = new Date(setlist.deleted_at);
      const expiresDate = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      items.push({
        id: setlist.id,
        workspaceId: setlist.workspace_id,
        entityType: 'setlist',
        title: setlist.name || 'Setlist sans titre',
        deletedAt: setlist.deleted_at,
        expiresAt: expiresDate.toISOString(),
      });
    }
  }

  // Song assets
  const { data: assets } = await supabase
    .from('song_assets')
    .select('id, workspace_id, filename, size_bytes, duration_seconds, deleted_at')
    .eq('workspace_id', workspaceId)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', sevenDaysAgo);

  if (assets) {
    for (const asset of assets) {
      const deletedDate = new Date(asset.deleted_at);
      const expiresDate = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      items.push({
        id: asset.id,
        workspaceId: asset.workspace_id,
        entityType: 'songAsset',
        title: asset.filename || 'Fichier audio',
        sizeBytes: asset.size_bytes,
        durationSeconds: asset.duration_seconds,
        deletedAt: asset.deleted_at,
        expiresAt: expiresDate.toISOString(),
      });
    }
  }

  return items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

export async function softDeleteContent(
  workspaceId: string,
  entityType: 'song' | 'setlist' | 'songAsset',
  entityId: string
): Promise<void> {
  const table = entityType === 'songAsset' ? 'song_assets' : entityType === 'setlist' ? 'setlists' : 'songs';
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', entityId)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
}

export async function restoreTrashedContent(
  workspaceId: string,
  entityType: 'song' | 'setlist' | 'songAsset',
  entityId: string
): Promise<void> {
  // If entity is a songAsset, pre-check quota
  if (entityType === 'songAsset') {
    const { data: asset } = await supabase
      .from('song_assets')
      .select('size_bytes, duration_seconds')
      .eq('id', entityId)
      .single();

    if (asset) {
      try {
        const quota = await refreshAudioQuota(workspaceId);
        if (quota.unit === 'bytes') {
          const potentialUsed = quota.usedAmount + (asset.size_bytes || 0);
          if (potentialUsed > quota.limitAmount) {
            throw new Error("Impossible de restaurer cet audio : le quota d'espace de groupe (5 Gio) serait depasse.");
          }
        } else {
          const potentialUsed = quota.usedAmount + (asset.duration_seconds || 0);
          if (potentialUsed > quota.limitAmount) {
            throw new Error("Impossible de restaurer cet audio : le quota d'espace personnel (1 heure) serait depasse.");
          }
        }
      } catch (err: any) {
        if (err.message?.includes('depasse')) throw err;
        // Ignore remote RPC failure during local/offline tests
      }
    }
  }

  const table = entityType === 'songAsset' ? 'song_assets' : entityType === 'setlist' ? 'setlists' : 'songs';
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: null })
    .eq('id', entityId)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
}

export async function purgeExpiredTrash(
  workspaceId: string,
  dryRun: boolean = true
): Promise<{ purgedCount: number; dryRun: boolean }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let count = 0;

  for (const table of ['songs', 'setlists', 'song_assets']) {
    const { data } = await supabase
      .from(table)
      .select('id')
      .eq('workspace_id', workspaceId)
      .not('deleted_at', 'is', null)
      .lte('deleted_at', sevenDaysAgo);

    const expired = data || [];
    count += expired.length;

    if (!dryRun && expired.length > 0) {
      const ids = expired.map((item: any) => item.id);
      await supabase.from(table).delete().in('id', ids);
    }
  }

  return { purgedCount: count, dryRun };
}
