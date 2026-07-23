import { supabase } from './client';
import { getSession } from './auth';
import { getUserWorkspaces, canWriteWorkspace, type Workspace } from './workspace';
import { refreshAudioQuota } from './audioQuota';

export interface CopySongOptions {
  includeAudio?: boolean;
}

export interface CopySongResult {
  songId: string;
  title: string;
  targetWorkspaceId: string;
  includeAudio: boolean;
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

  // If audio is included, pre-check target workspace quota
  if (includeAudio) {
    const { data: assets } = await supabase
      .from('song_assets')
      .select('size_bytes, duration_seconds')
      .eq('song_id', songId)
      .is('deleted_at', null);

    if (assets && assets.length > 0) {
      const totalSize = assets.reduce((sum: number, a: any) => sum + (a.size_bytes || 0), 0);
      const totalDuration = assets.reduce((sum: number, a: any) => sum + (a.duration_seconds || 0), 0);

      try {
        const quota = await refreshAudioQuota(targetWorkspaceId);
        if (quota.unit === 'bytes') {
          if (quota.usedAmount + totalSize > quota.limitAmount) {
            throw new Error("La copie est impossible : l'espace de destination n'a pas assez de quota audio (limite de 5 Gio dépassée).");
          }
        } else {
          if (quota.usedAmount + totalDuration > quota.limitAmount) {
            throw new Error("La copie est impossible : l'espace personnel de destination a dépassé sa limite de 1 heure d'audio.");
          }
        }
      } catch (err: any) {
        if (err.message?.includes('dépassée')) throw err;
      }
    }
  }

  const { data, error } = await supabase.rpc('copy_song_to_workspace', {
    p_song_id: songId,
    p_target_workspace_id: targetWorkspaceId,
    p_include_audio: includeAudio,
  });

  if (error) {
    if (error.message?.includes('TARGET_WORKSPACE_WRITE_DENIED')) {
      throw new Error("Vous n'avez pas l'autorisation d'écrire dans l'espace de destination.");
    }
    if (error.message?.includes('SONG_NOT_FOUND')) {
      throw new Error('Chanson introuvable.');
    }
    throw new Error(error.message || 'Échec de la copie de la chanson.');
  }

  const result = typeof data === 'string' ? JSON.parse(data) : data;
  return {
    songId: result.song_id,
    title: result.title,
    targetWorkspaceId: result.target_workspace_id,
    includeAudio: Boolean(result.include_audio),
  };
}
