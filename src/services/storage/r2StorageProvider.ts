import { createAudioSignedUrl, uploadAudioObject } from '@/services/audio/r2Client';
import { refreshAudioQuota } from '@/services/supabase/audioQuota';
import { supabase } from '@/services/supabase/client';
import {
  StorageProviderError,
  type StorageProvider,
  type StorageUploadSession,
} from './types';

interface R2StorageProviderDependencies {
  reserveUpload: (workspaceId: string, sizeBytes: number, durationSeconds?: number) => Promise<string>;
  uploadObject: (key: string, body: Blob, reservationId: string) => Promise<void>;
  completeUpload: (reservationId: string, key: string) => Promise<void>;
  releaseUpload: (reservationId: string) => Promise<void>;
  createReadUrl: (key: string) => Promise<string>;
  getQuota: typeof refreshAudioQuota;
  checkHealth: () => Promise<boolean>;
}

export function createR2StorageProvider(dependencies: R2StorageProviderDependencies): StorageProvider {
  function assertSession(session: StorageUploadSession): void {
    if (session.providerId !== 'faderzero_r2') {
      throw new StorageProviderError('invalid_upload', 'Session de stockage incompatible.', 'faderzero_r2');
    }
  }

  return {
    id: 'faderzero_r2',
    capabilities: new Set(['read', 'download', 'quota', 'health']),

    async createUploadSession(request) {
      const sessionId = await dependencies.reserveUpload(
        request.workspaceId,
        request.sizeBytes,
        request.durationSeconds,
      );
      return {
        providerId: 'faderzero_r2',
        sessionId,
        workspaceId: request.workspaceId,
        logicalKey: request.logicalKey,
      };
    },

    async upload(session, body) {
      assertSession(session);
      await dependencies.uploadObject(session.logicalKey, body, session.sessionId);
      return { physicalIdentifier: session.logicalKey };
    },

    async finalizeUpload(session) {
      assertSession(session);
      await dependencies.completeUpload(session.sessionId, session.logicalKey);
      return { providerId: 'faderzero_r2', physicalKey: session.logicalKey };
    },

    async abortUpload(session) {
      assertSession(session);
      await dependencies.releaseUpload(session.sessionId);
    },

    async createReadUrl(_workspaceId, logicalKey) {
      return dependencies.createReadUrl(logicalKey);
    },

    async createDownloadUrl(_workspaceId, logicalKey) {
      return dependencies.createReadUrl(logicalKey);
    },

    async deleteObject() {
      throw new StorageProviderError(
        'capability_unavailable',
        'La suppression physique audio R2 n’est pas encore disponible.',
        'faderzero_r2',
      );
    },

    async getQuota(workspaceId) {
      const quota = await dependencies.getQuota(workspaceId);
      return {
        unit: quota.unit,
        usedAmount: quota.usedAmount,
        reservedAmount: quota.reservedAmount,
        limitAmount: quota.limitAmount,
        remainingAmount: quota.remainingAmount,
      };
    },

    checkHealth: dependencies.checkHealth,
  };
}

const apiUrl = (import.meta.env.VITE_AUDIO_API_URL ?? '').replace(/\/$/, '');

export const r2StorageProvider = createR2StorageProvider({
  async reserveUpload(workspaceId, sizeBytes, durationSeconds) {
    const { data, error } = await supabase.rpc('reserve_audio_upload', {
      p_workspace_id: workspaceId,
      p_requested_bytes: sizeBytes,
      p_requested_seconds: durationSeconds ?? null,
    });
    if (error || typeof data !== 'string') {
      throw error ?? new StorageProviderError('invalid_upload', 'Réservation audio invalide.', 'faderzero_r2');
    }
    return data;
  },
  uploadObject: uploadAudioObject,
  async completeUpload(reservationId, key) {
    const { error } = await supabase.rpc('complete_audio_upload_reservation', {
      p_reservation_id: reservationId,
      p_storage_path: key,
    });
    if (error) throw error;
  },
  async releaseUpload(reservationId) {
    const { error } = await supabase.rpc('release_audio_upload_reservation', {
      p_reservation_id: reservationId,
    });
    if (error) throw error;
  },
  createReadUrl: createAudioSignedUrl,
  getQuota: refreshAudioQuota,
  async checkHealth() {
    if (!apiUrl) return false;
    const response = await fetch(`${apiUrl}/health`);
    return response.ok;
  },
});
