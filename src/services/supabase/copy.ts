import { supabase } from './client';
import { getSession } from './auth';
import { getUserWorkspaces, canWriteWorkspace, type Workspace } from './workspace';
import { refreshAudioQuota } from './audioQuota';
import { createId } from '@/lib/createId';
import { createStorageReadUrl, deleteStorageObject, uploadStorageObject } from '@/services/storage';

export interface CopySongOptions {
  includeAudio?: boolean;
}

export interface CopySongResult {
  songId: string;
  title: string;
  targetWorkspaceId: string;
  includeAudio: boolean;
}

interface SourceSongAsset {
  workspace_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  asset_type: string | null;
  label: string | null;
  recorded_at: string | null;
  sort_order: number | null;
  content_hash: string | null;
}

export async function listAvailableTargetWorkspaces(currentWorkspaceId: string): Promise<Workspace[]> {
  const workspaces = await getUserWorkspaces();
  return workspaces.filter(
    (ws) => ws.id !== currentWorkspaceId && canWriteWorkspace(ws.role)
  );
}

export async function copySongToWorkspace(
  songId: string,
  targetWorkspaceId: string,
  options: CopySongOptions = {}
): Promise<CopySongResult> {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Connectez-vous pour copier une chanson.');
  }

  const includeAudio = Boolean(options.includeAudio);

  let sourceAssets: SourceSongAsset[] = [];

  // If audio is included, pre-check target workspace quota and retain the
  // source metadata needed to create independent target files afterwards.
  if (includeAudio) {
    const { data: assets, error: assetsError } = await supabase
      .from('song_assets')
      .select('workspace_id,storage_path,filename,mime_type,size_bytes,duration_seconds,asset_type,label,recorded_at,sort_order,content_hash')
      .eq('song_id', songId)
      .is('deleted_at', null);
    if (assetsError) throw assetsError;
    sourceAssets = (assets ?? []) as SourceSongAsset[];

    if (sourceAssets.length > 0) {
      const totalDuration = sourceAssets.reduce((sum, asset) => sum + (asset.duration_seconds || 0), 0);

      try {
        const quota = await refreshAudioQuota(targetWorkspaceId);
        if (quota.usedAmount + quota.reservedAmount + totalDuration > quota.limitAmount) {
          throw new Error("La copie est impossible : l'espace de destination a dépassé sa limite d'audio.");
        }
      } catch (err: any) {
        if (err.message?.startsWith('La copie est impossible')) throw err;
      }
    }
  }

  const { data, error } = await supabase.rpc('copy_song_to_workspace', {
    p_song_id: songId,
    p_target_workspace_id: targetWorkspaceId,
    p_include_audio: includeAudio,
    p_duplicate_audio: includeAudio,
  });

  if (error) {
    if (error.message?.includes('TARGET_WORKSPACE_WRITE_DENIED')) {
      throw new Error("Vous n'avez pas l'autorisation d'écrire dans l'espace de destination.");
    }
    if (error.message?.includes('SONG_NOT_FOUND')) {
      throw new Error('Chanson introuvable.');
    }
    if (error.message?.includes('TARGET_AUDIO_QUOTA_EXCEEDED')) {
      throw new Error("La copie est impossible : l'espace de destination a dépassé sa limite d'audio.");
    }
    throw new Error(error.message || 'Échec de la copie de la chanson.');
  }

  const result = typeof data === 'string' ? JSON.parse(data) : data;
  if (includeAudio && sourceAssets.length > 0) {
    await copySongAudioFiles(sourceAssets, result.song_id, targetWorkspaceId);
  }
  return {
    songId: result.song_id,
    title: result.title,
    targetWorkspaceId: result.target_workspace_id,
    includeAudio: Boolean(result.include_audio),
  };
}

async function copySongAudioFiles(
  sourceAssets: SourceSongAsset[],
  targetSongId: string,
  targetWorkspaceId: string,
): Promise<void> {
  const uploadedPaths: string[] = [];
  const createdAssetIds: string[] = [];

  try {
    for (const sourceAsset of sourceAssets) {
      const sourceUrl = await createStorageReadUrl(sourceAsset.workspace_id, sourceAsset.storage_path);
      const sourceResponse = await fetch(sourceUrl);
      if (!sourceResponse.ok) throw new Error(`Lecture du fichier audio impossible (${sourceResponse.status}).`);
      const body = await sourceResponse.blob();
      if (body.size !== Number(sourceAsset.size_bytes)) throw new Error('La taille du fichier audio source est incohérente.');

      const assetId = createId();
      const storagePath = `workspaces/${targetWorkspaceId}/songs/${targetSongId}/${assetId}.mp3`;
      const location = await uploadStorageObject({
        workspaceId: targetWorkspaceId,
        logicalKey: storagePath,
        sizeBytes: body.size,
        mimeType: sourceAsset.mime_type,
        objectKind: 'audio',
        ...(sourceAsset.duration_seconds !== null ? { durationSeconds: sourceAsset.duration_seconds } : {}),
        ...(sourceAsset.content_hash ? { contentHash: sourceAsset.content_hash } : {}),
      }, body);
      uploadedPaths.push(storagePath);

      const { error } = await supabase.from('song_assets').insert({
        id: assetId,
        workspace_id: targetWorkspaceId,
        song_id: targetSongId,
        storage_path: storagePath,
        storage_object_id: location.storageObjectId ?? null,
        filename: sourceAsset.filename,
        mime_type: sourceAsset.mime_type,
        size_bytes: sourceAsset.size_bytes,
        duration_seconds: sourceAsset.duration_seconds,
        asset_type: sourceAsset.asset_type ?? 'other',
        label: sourceAsset.label,
        recorded_at: sourceAsset.recorded_at,
        sort_order: sourceAsset.sort_order ?? 0,
        content_hash: sourceAsset.content_hash,
      });
      if (error) throw error;
      createdAssetIds.push(assetId);
    }
  } catch (error) {
    await Promise.all(createdAssetIds.map((id) =>
      supabase.from('song_assets').delete().eq('id', id).eq('workspace_id', targetWorkspaceId),
    ));
    await Promise.all(uploadedPaths.map((path) => deleteStorageObject(targetWorkspaceId, path).catch(() => undefined)));
    await supabase.from('songs').delete().eq('id', targetSongId).eq('workspace_id', targetWorkspaceId);
    throw error;
  }
}
