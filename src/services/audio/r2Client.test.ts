import { describe, expect, it, vi } from 'vitest';
import { createR2AudioClient } from './r2Client';

describe('R2 audio client', () => {
  it('uploads an audio object with the Supabase bearer token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    const client = createR2AudioClient({
      apiUrl: 'https://audio.example.workers.dev/',
      fetch: fetchMock,
      getAccessToken: async () => 'access-token',
    });
    const file = new Blob(['audio'], { type: 'audio/mpeg' });

    await client.uploadObject('workspaces/work-1/imports/asset.mp3', file);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://audio.example.workers.dev/objects/workspaces/work-1/imports/asset.mp3',
      expect.objectContaining({
        method: 'PUT',
        body: file,
        headers: expect.objectContaining({ authorization: 'Bearer access-token' }),
      })
    );
  });

  it('requests a signed playback URL', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      signedUrl: 'https://audio.example.workers.dev/objects/example?signature=signed',
    }));
    const client = createR2AudioClient({
      apiUrl: 'https://audio.example.workers.dev',
      fetch: fetchMock,
      getAccessToken: async () => 'access-token',
    });

    await expect(client.createSignedUrl('workspaces/work-1/imports/asset.mp3')).resolves.toContain(
      'signature=signed'
    );
  });

  it('surfaces Worker API errors', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { error: 'Forbidden' },
      { status: 403 }
    ));
    const client = createR2AudioClient({
      apiUrl: 'https://audio.example.workers.dev',
      fetch: fetchMock,
      getAccessToken: async () => 'access-token',
    });

    await expect(client.createSignedUrl('workspaces/work-1/imports/asset.mp3')).rejects.toThrow('Forbidden');
  });
});
