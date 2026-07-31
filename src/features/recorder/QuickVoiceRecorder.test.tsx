import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { QuickVoiceRecorder } from './QuickVoiceRecorder';

const recorderHarness = vi.hoisted(() => ({
  callbacks: null as null | {
    onStopped: (recording: { blob: Blob; mimeType: string; durationMs: number }) => void;
  },
  start: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn(),
}));
const uploadAudio = vi.hoisted(() => vi.fn());
const linkRecording = vi.hoisted(() => vi.fn());

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}));

vi.mock('./voiceRecorderEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voiceRecorderEngine')>();

  return {
    ...actual,
    VoiceRecorderEngine: class {
      constructor(callbacks: NonNullable<typeof recorderHarness.callbacks>) {
        recorderHarness.callbacks = callbacks;
      }

      start() {
        return recorderHarness.start();
      }

      cancel() {
        recorderHarness.cancel();
      }
    },
  };
});

vi.mock('@/services/audio/pendingUploads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/audio/pendingUploads')>();
  return {
    ...actual,
    uploadOrQueueSongAsset: uploadAudio,
  };
});

vi.mock('./recordingWorkflow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./recordingWorkflow')>();
  return {
    ...actual,
    linkStagedRecording: linkRecording,
  };
});

describe('QuickVoiceRecorder direct song mode', () => {
  beforeEach(() => {
    recorderHarness.callbacks = null;
    recorderHarness.start.mockClear();
    recorderHarness.cancel.mockClear();
    uploadAudio.mockReset().mockResolvedValue({ status: 'uploaded', assetId: 'asset-1' });
    linkRecording.mockReset().mockResolvedValue(undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    useAuthStore.setState({
      activeWorkspace: {
        id: 'workspace-1',
        name: 'Groupe test',
        createdBy: 'user-1',
        createdAt: '2026-07-30T20:00:00.000Z',
        updatedAt: '2026-07-30T20:00:00.000Z',
        role: 'admin',
        type: 'group',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves and links the recording without asking for a destination', async () => {
    const onComplete = vi.fn();
    render(
      <QuickVoiceRecorder
        directSongId="song-1"
        directSongTitle="Azeaze"
        onClose={vi.fn()}
        onComplete={onComplete}
      />
    );

    await waitFor(() => expect(recorderHarness.start).toHaveBeenCalledOnce());
    act(() => {
      recorderHarness.callbacks?.onStopped({
        blob: new Blob(['voice memo'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        durationMs: 6_000,
      });
    });

    expect(await screen.findByRole('button', { name: 'Enregistrer pour cette chanson' })).toBeInTheDocument();
    expect(screen.queryByText('Créer un audio orphelin')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer pour cette chanson' }));

    await waitFor(() => expect(uploadAudio).toHaveBeenCalledOnce());
    expect(uploadAudio).toHaveBeenCalledWith(
      'workspace-1',
      undefined,
      expect.any(File),
      expect.objectContaining({
        filename: expect.stringMatching(/\.mp3$/),
        normalizePeak: true,
        durationSeconds: 6,
      })
    );
    expect(linkRecording).toHaveBeenCalledWith(
      { status: 'uploaded', assetId: 'asset-1' },
      'song-1',
      expect.objectContaining({ workspaceId: 'workspace-1' })
    );
    expect(onComplete).toHaveBeenCalledWith({
      message: 'Audio enregistré et associé à Azeaze.',
    });
  });
});
