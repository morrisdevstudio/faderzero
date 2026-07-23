import { describe, expect, it } from 'vitest';
import {
  buildSyncExportPayload,
  deserializeSyncQrFragment,
  fragmentCompressedPayload,
  MAX_QR_FRAGMENTS,
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

  it('rejects QR fragments with unexpected fields or invalid boundaries', () => {
    const fragment = {
      protocol: SYNC_PROTOCOL,
      protocolVersion: SYNC_PROTOCOL_VERSION,
      transferId: 'transfer-strict',
      index: 2,
      total: 1,
      payloadHash: 'a'.repeat(64),
      chunk: 'abc',
      injected: true,
    };

    expect(() => deserializeSyncQrFragment(JSON.stringify(fragment))).toThrow('unexpected fields');
    delete (fragment as Partial<typeof fragment>).injected;
    expect(() => deserializeSyncQrFragment(JSON.stringify(fragment))).toThrow('index exceeds total');
  });

  it('rejects fragment collections over the configured limit', async () => {
    const fragment = fragmentCompressedPayload('abc', 'a'.repeat(64), 'transfer-limit')[0];
    expect(fragment).toBeDefined();

    await expect(reconstructSyncExportPayload(Array.from({ length: MAX_QR_FRAGMENTS + 1 }, () => fragment!)))
      .rejects.toThrow('Too many QR fragments.');
  });

  it('rejects highly expanded decompressed payloads', async () => {
    const exportPayload = await buildSyncExportPayload({
      songs: [{
        id: 'song-expanded',
        title: 'Expanded',
        lyrics: 'a'.repeat(200_000),
        createdAt: 1,
        updatedAt: 1,
      }],
      setlists: [],
      setlistSongs: [],
    });
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(exportPayload));
    const fragments = fragmentCompressedPayload(compressed, exportPayload.payloadHash, 'transfer-expanded');

    await expect(reconstructSyncExportPayload(fragments)).rejects.toThrow('Decompressed QR payload exceeds');
  });

  it('rejects duplicate IDs and dangling relationships', async () => {
    const exportPayload = await buildSyncExportPayload({
      songs: [
        { id: 'song-1', title: 'A', lyrics: '', createdAt: 1, updatedAt: 1 },
        { id: 'song-1', title: 'B', lyrics: '', createdAt: 1, updatedAt: 1 },
      ],
      setlists: [{ id: 'set-1', name: 'Set', createdAt: 1, updatedAt: 1 }],
      setlistSongs: [{ id: 'entry-1', setlistId: 'set-1', songId: 'missing', position: 0, createdAt: 1, updatedAt: 1 }],
    });
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(exportPayload));
    const fragments = fragmentCompressedPayload(compressed, exportPayload.payloadHash, 'transfer-invalid');

    await expect(reconstructSyncExportPayload(fragments)).rejects.toThrow('duplicate identifiers');
  });
});
