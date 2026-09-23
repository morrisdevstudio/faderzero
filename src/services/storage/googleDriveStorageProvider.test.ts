import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'user-token' } } })) } },
}));

describe('Google Drive upload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('starts a fresh session when a queued upload references an expired session', async () => {
    vi.stubEnv('VITE_AUDIO_API_URL', 'https://audio.example');
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: 'Upload session unavailable' }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({
        sessionId: 'new-session',
        resumableSessionUri: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=new',
        confirmedBytes: 0,
      }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { googleDriveStorageProvider } = await import('./googleDriveStorageProvider');

    const session = await googleDriveStorageProvider.createUploadSession({
      workspaceId: 'workspace-1',
      logicalKey: 'workspaces/workspace-1/imports/test.mp3',
      objectKind: 'audio',
      mimeType: 'audio/mpeg',
      sizeBytes: 4,
      resumeSessionId: 'expired-session',
    });

    expect(session.sessionId).toBe('new-session');
    expect(session.confirmedBytes).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ sessionId: 'expired-session' });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).not.toHaveProperty('sessionId');
  });

  it('sends audio to the Worker rather than directly to the Google session', async () => {
    vi.stubEnv('VITE_AUDIO_API_URL', 'https://audio.example');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ physicalIdentifier: 'drive-file-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const { googleDriveStorageProvider } = await import('./googleDriveStorageProvider');
    const receipt = await googleDriveStorageProvider.upload({
      providerId: 'google_drive',
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
      logicalKey: 'workspaces/workspace-1/imports/test.mp3',
      resumableSessionUri: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=secret',
      confirmedBytes: 2,
    }, new Blob(['abcd'], { type: 'audio/mpeg' }));

    expect(receipt).toEqual({ physicalIdentifier: 'drive-file-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://audio.example/storage/google-drive/upload-sessions/session-1/content',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          authorization: 'Bearer user-token',
          'content-range': 'bytes 2-3/4',
        }),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('content-length');
    expect(await (fetchMock.mock.calls[0]?.[1]?.body as Blob).text()).toBe('cd');
  });

  it('reuses the receipt when Google already accepted the upload', async () => {
    vi.stubEnv('VITE_AUDIO_API_URL', 'https://audio.example');
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const { googleDriveStorageProvider } = await import('./googleDriveStorageProvider');
    const receipt = await googleDriveStorageProvider.upload({
      providerId: 'google_drive',
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
      logicalKey: 'workspaces/workspace-1/imports/test.mp3',
      resumableSessionUri: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=secret',
      completedPhysicalIdentifier: 'drive-file-1',
    }, new Blob(['abcd'], { type: 'audio/mpeg' }));

    expect(receipt).toEqual({ physicalIdentifier: 'drive-file-1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
