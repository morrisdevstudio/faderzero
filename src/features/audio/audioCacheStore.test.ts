import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, destroyTestDatabase } from '@/test/dbTestUtils';
import type { FaderZeroDatabase } from '@/db/db';
import {
  LEGACY_AUDIO_CACHE_NAME,
  configureAudioCacheContext,
  getAudioCacheName,
  migrateLegacyAudioCache,
  useAudioCacheStore,
} from '@/features/audio/audioCacheStore';

class MemoryCache {
  private entries = new Map<string, Response>();

  private key(value: RequestInfo | URL) {
    const raw = typeof value === 'string' ? value : value instanceof URL ? value.toString() : value.url;
    return new URL(raw, 'http://localhost').toString();
  }

  async keys() {
    return [...this.entries.keys()].map((key) => new Request(key));
  }

  async match(value: RequestInfo | URL) {
    return this.entries.get(this.key(value))?.clone();
  }

  async put(value: RequestInfo | URL, response: Response) {
    this.entries.set(this.key(value), response.clone());
  }

  async delete(value: RequestInfo | URL) {
    return this.entries.delete(this.key(value));
  }
}

describe('partitioned audio cache', () => {
  let database: FaderZeroDatabase;
  let cacheEntries: Map<string, MemoryCache>;

  beforeEach(async () => {
    database = await createTestDatabase('audio-cache-partition');
    cacheEntries = new Map();
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        open: async (name: string) => {
          const cache = cacheEntries.get(name) ?? new MemoryCache();
          cacheEntries.set(name, cache);
          return cache;
        },
        delete: async (name: string) => cacheEntries.delete(name),
      },
    });
  });

  afterEach(async () => {
    configureAudioCacheContext(null, null);
    await destroyTestDatabase(database);
    Reflect.deleteProperty(globalThis, 'caches');
  });

  it('copies a verified legacy blob only into its user and workspace partition', async () => {
    await database.songAssets.put({
      id: 'asset-a',
      workspaceId: 'workspace-a',
      storagePath: 'legacy/asset-a.mp3',
      filename: 'asset-a.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 3,
      createdAt: 1,
      updatedAt: 1,
    });
    const legacy = await caches.open(LEGACY_AUDIO_CACHE_NAME);
    await legacy.put('/audio/asset-a', new Response('abc'));
    expect((await (await legacy.match('/audio/asset-a'))?.blob())?.size).toBe(3);
    expect(await database.songAssets.get('asset-a')).toBeDefined();

    await expect(migrateLegacyAudioCache('user-a', database)).resolves.toEqual({ copied: 1, skipped: 0 });
    expect(await legacy.match('/audio/asset-a')).toBeDefined();
    const partition = await caches.open(getAudioCacheName('user-a', 'workspace-a'));
    expect((await (await partition.match('/audio/asset-a'))?.blob())?.size).toBe(3);
    expect(cacheEntries.has(getAudioCacheName('user-b', 'workspace-a'))).toBe(false);

    configureAudioCacheContext('user-a', 'workspace-a');
    await useAudioCacheStore.getState().checkCacheStatus();
    expect(useAudioCacheStore.getState().cachedAssetIds.has('asset-a')).toBe(true);
  });

  it('leaves a size mismatch exclusively in the legacy cache', async () => {
    await database.songAssets.put({
      id: 'asset-b',
      workspaceId: 'workspace-a',
      storagePath: 'legacy/asset-b.mp3',
      filename: 'asset-b.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 9,
      createdAt: 1,
      updatedAt: 1,
    });
    const legacy = await caches.open(LEGACY_AUDIO_CACHE_NAME);
    await legacy.put('/audio/asset-b', new Response('abc'));

    await expect(migrateLegacyAudioCache('user-a', database)).resolves.toEqual({ copied: 0, skipped: 1 });
    expect(await legacy.match('/audio/asset-b')).toBeDefined();
    expect(cacheEntries.has(getAudioCacheName('user-a', 'workspace-a'))).toBe(false);
  });
});
