import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCachedAudioUrl: vi.fn(),
  getSongAssetPlaybackUrl: vi.fn(),
}));

vi.mock('@/services/supabase/storage', () => ({
  getSongAssetPlaybackUrl: mocks.getSongAssetPlaybackUrl,
}));

vi.mock('@/features/audio/audioCacheStore', () => ({
  getCachedAudioUrl: mocks.getCachedAudioUrl,
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({ activeWorkspace: { id: 'workspace-1' } }),
  },
}));

import { useAudioPlayerStore, type AudioTrack } from '@/features/audio/audioPlayerStore';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const trackA: AudioTrack = { assetId: 'asset-a', title: 'A', filename: 'a.mp3' };
const trackB: AudioTrack = { assetId: 'asset-b', title: 'B', filename: 'b.mp3' };

describe('audio player generation guards', () => {
  const audio = {
    src: '',
    currentTime: 0,
    duration: Number.NaN,
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    load: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    removeAttribute: vi.fn(),
  };

  beforeAll(() => {
    vi.stubGlobal('Audio', vi.fn(function AudioMock() {
      return audio;
    }));
  });

  beforeEach(() => {
    audio.src = '';
    audio.currentTime = 0;
    audio.duration = Number.NaN;
    audio.pause.mockClear();
    audio.play.mockReset();
    audio.play.mockResolvedValue(undefined);
    audio.load.mockClear();
    audio.removeAttribute.mockClear();
    mocks.getCachedAudioUrl.mockReset();
    mocks.getSongAssetPlaybackUrl.mockReset();
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    useAudioPlayerStore.setState({
      queue: [],
      currentIndex: -1,
      status: 'idle',
      error: null,
      currentTime: 0,
      duration: 0,
    });
    useAudioPlayerStore.getState().stop();
  });

  afterEach(() => {
    useAudioPlayerStore.getState().stop();
    vi.restoreAllMocks();
  });

  it('keeps the latest playback request and revokes a stale cached URL', async () => {
    const firstCache = deferred<string | null>();
    mocks.getCachedAudioUrl
      .mockImplementationOnce(() => firstCache.promise)
      .mockResolvedValueOnce('blob:b');

    const firstPlay = useAudioPlayerStore.getState().playQueue([trackA]);
    const secondPlay = useAudioPlayerStore.getState().playQueue([trackB]);

    await secondPlay;
    firstCache.resolve('blob:a');
    await firstPlay;

    expect(audio.src).toBe('blob:b');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a');
    expect(useAudioPlayerStore.getState().queue[0]?.assetId).toBe('asset-b');
    expect(useAudioPlayerStore.getState().error).toBeNull();
  });

  it('does not report a playback error after stop() wins the generation race', async () => {
    const playGate = deferred<void>();
    mocks.getCachedAudioUrl.mockResolvedValue('blob:a');
    audio.play.mockImplementation(() => playGate.promise);

    const pendingPlay = useAudioPlayerStore.getState().playQueue([trackA]);
    await vi.waitFor(() => {
      expect(audio.play).toHaveBeenCalled();
    });

    useAudioPlayerStore.getState().stop();
    playGate.resolve();
    await pendingPlay;

    expect(useAudioPlayerStore.getState()).toMatchObject({
      status: 'idle',
      error: null,
      currentTime: 0,
    });
  });
});
