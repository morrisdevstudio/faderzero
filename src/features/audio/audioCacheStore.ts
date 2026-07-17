import { create } from 'zustand';
import { getSongAssetPlaybackUrl } from '@/services/supabase/storage';

interface AudioCacheState {
  cachedAssetIds: Set<string>;
  downloadingAssetIds: Record<string, number>; // assetId -> progress percentage (0-100)
  isChecking: boolean;
  error: string | null;
  checkCacheStatus: () => Promise<void>;
  downloadAsset: (workspaceId: string, assetId: string) => Promise<void>;
  removeAsset: (assetId: string) => Promise<void>;
  clearCache: () => Promise<void>;
}

export const useAudioCacheStore = create<AudioCacheState>((set) => ({
  cachedAssetIds: new Set<string>(),
  downloadingAssetIds: {},
  isChecking: false,
  error: null,

  async checkCacheStatus() {
    if (typeof caches === 'undefined') return;
    set({ isChecking: true });
    try {
      const cache = await caches.open('faderzero-audio-cache');
      const requests = await cache.keys();
      const cachedIds = new Set<string>();
      for (const req of requests) {
        const url = new URL(req.url, window.location.href);
        const match = url.pathname.match(/\/audio\/([^/]+)/);
        if (match && match[1]) {
          cachedIds.add(match[1]);
        }
      }
      set({ cachedAssetIds: cachedIds, isChecking: false });
    } catch (err) {
      console.error('Failed to check audio cache status:', err);
      set({ isChecking: false });
    }
  },

  async downloadAsset(workspaceId, assetId) {
    if (typeof caches === 'undefined') return;
    set((state) => ({
      downloadingAssetIds: { ...state.downloadingAssetIds, [assetId]: 0 },
      error: null,
    }));

    try {
      // 1. Get play URL
      const playbackUrl = await getSongAssetPlaybackUrl(workspaceId, assetId);

      // 2. Fetch the audio file with progress monitoring
      const response = await fetch(playbackUrl);
      if (!response.ok) {
        throw new Error(`Erreur de téléchargement: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Impossible d'accéder au corps de la réponse");
      }

      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (total > 0) {
          const progress = Math.round((receivedLength / total) * 100);
          set((state) => ({
            downloadingAssetIds: { ...state.downloadingAssetIds, [assetId]: progress },
          }));
        }
      }

      // Combine chunks into a single Uint8Array
      const combined = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        combined.set(chunk, position);
        position += chunk.length;
      }

      const mimeType = response.headers.get('content-type') || 'audio/mpeg';
      const blob = new Blob([combined], { type: mimeType });

      // 3. Put in Cache Storage
      const cache = await caches.open('faderzero-audio-cache');
      const cleanResponse = new Response(blob, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': blob.size.toString(),
        },
      });

      await cache.put(`/audio/${assetId}`, cleanResponse);

      // 4. Update store state
      set((state) => {
        const nextCached = new Set(state.cachedAssetIds);
        nextCached.add(assetId);
        const nextDownloading = { ...state.downloadingAssetIds };
        delete nextDownloading[assetId];
        return {
          cachedAssetIds: nextCached,
          downloadingAssetIds: nextDownloading,
        };
      });
    } catch (err: any) {
      console.error('Failed to download audio asset:', err);
      set((state) => {
        const nextDownloading = { ...state.downloadingAssetIds };
        delete nextDownloading[assetId];
        return {
          downloadingAssetIds: nextDownloading,
          error: err.message || "Échec du téléchargement",
        };
      });
      throw err;
    }
  },

  async removeAsset(assetId) {
    if (typeof caches === 'undefined') return;
    try {
      const cache = await caches.open('faderzero-audio-cache');
      await cache.delete(`/audio/${assetId}`);
      set((state) => {
        const nextCached = new Set(state.cachedAssetIds);
        nextCached.delete(assetId);
        return { cachedAssetIds: nextCached };
      });
    } catch (err) {
      console.error('Failed to remove asset from cache:', err);
    }
  },

  async clearCache() {
    if (typeof caches === 'undefined') return;
    try {
      await caches.delete('faderzero-audio-cache');
      set({ cachedAssetIds: new Set<string>() });
    } catch (err) {
      console.error('Failed to clear audio cache:', err);
    }
  },
}));

// Helper function to get cached audio as local URL
export async function getCachedAudioUrl(assetId: string): Promise<string | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open('faderzero-audio-cache');
    const matched = await cache.match(`/audio/${assetId}`);
    if (!matched) return null;
    const blob = await matched.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Error matching cache for playback:', err);
    return null;
  }
}
