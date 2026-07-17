import { describe, expect, it } from 'vitest';
import {
  buildSyncExportPayload,
  fragmentCompressedPayload,
  reconstructSyncExportPayload,
  serializeSyncQrFragment,
  SYNC_PROTOCOL,
  SYNC_PROTOCOL_VERSION,
} from '@/features/sync/qrTransfer';
import LZString from 'lz-string';

describe('qrTransfer', () => {
  it('fragments and reconstructs a compressed sync payload', async () => {
    const exportPayload = await buildSyncExportPayload({
      songs: [
        {
          id: 'song-1',
          title: 'Caught In The Echo',
          artist: 'Foo Fighters',
          lyrics: 'Line 1\nLine 2',
          key: 'Am',
          bpm: 120,
          notes: 'Intro long',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      setlists: [
        {
          id: 'set-1',
          name: 'Bataclan',
          date: '2026-07-14',
          notes: 'Encore prete',
          createdAt: 3,
          updatedAt: 4,
        },
      ],
      setlistSongs: [
        {
          id: 'entry-1',
          setlistId: 'set-1',
          songId: 'song-1',
          position: 0,
          createdAt: 5,
          updatedAt: 6,
        },
      ],
    });

    const compressedPayload = LZString.compressToEncodedURIComponent(JSON.stringify(exportPayload));
    const fragments = fragmentCompressedPayload(compressedPayload, exportPayload.payloadHash, 'transfer-1', 40);

    expect(fragments.length).toBeGreaterThan(1);
    expect(fragments.every((fragment) => fragment.transferId === 'transfer-1')).toBe(true);
    expect(fragments.every((fragment) => fragment.payloadHash === exportPayload.payloadHash)).toBe(true);
    expect(fragments.every((fragment) => fragment.total === fragments.length)).toBe(true);

    const rebuiltPayload = await reconstructSyncExportPayload(fragments.map(serializeSyncQrFragment));

    expect(rebuiltPayload).toEqual(exportPayload);
  });

  it('rejects reconstruction when fragment metadata are inconsistent', async () => {
    const exportPayload = await buildSyncExportPayload({
      songs: [],
      setlists: [],
      setlistSongs: [],
    });
    const compressedPayload = LZString.compressToEncodedURIComponent(JSON.stringify(exportPayload));
    const fragments = fragmentCompressedPayload(compressedPayload, exportPayload.payloadHash, 'transfer-2', 10);
    const secondFragment = fragments[1];

    expect(secondFragment).toBeDefined();

    const firstFragment = fragments[0];

    expect(firstFragment).toBeDefined();

    const tamperedFragments = [
      firstFragment!,
      {
        ...secondFragment!,
        transferId: 'transfer-3',
      },
    ];

    await expect(reconstructSyncExportPayload(tamperedFragments)).rejects.toThrow('Inconsistent fragment metadata.');
  });

  it('builds export payloads with the expected protocol envelope', async () => {
    const exportPayload = await buildSyncExportPayload({
      songs: [],
      setlists: [],
      setlistSongs: [],
    });

    expect(exportPayload.protocol).toBe(SYNC_PROTOCOL);
    expect(exportPayload.protocolVersion).toBe(SYNC_PROTOCOL_VERSION);
    expect(exportPayload.sourceApp).toBe('faderzero-pwa');
    expect(exportPayload.payloadHash).toHaveLength(64);
  });
});
