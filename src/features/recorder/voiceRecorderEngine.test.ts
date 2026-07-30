import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultRecordingName,
  formatRecordingDuration,
  getMicrophoneErrorMessage,
  getRecordingFileExtension,
  selectSupportedRecordingMimeType,
  VoiceRecorderEngine,
  type VoiceRecorderDependencies,
} from './voiceRecorderEngine';

describe('voiceRecorderEngine helpers', () => {
  it('selects the first recording format supported by the browser', () => {
    const MediaRecorderConstructor: Pick<typeof MediaRecorder, 'isTypeSupported'> = {
      isTypeSupported: (mimeType: string) => mimeType === 'audio/mp4',
    };

    expect(selectSupportedRecordingMimeType(MediaRecorderConstructor)).toBe('audio/mp4');
  });

  it('maps recording containers to useful file extensions', () => {
    expect(getRecordingFileExtension('audio/mp4;codecs=mp4a.40.2')).toBe('m4a');
    expect(getRecordingFileExtension('audio/ogg;codecs=opus')).toBe('ogg');
    expect(getRecordingFileExtension('audio/webm;codecs=opus')).toBe('webm');
  });

  it('formats duration and the default French recording name', () => {
    expect(formatRecordingDuration(65_900)).toBe('01:05');
    expect(createDefaultRecordingName(new Date(2026, 6, 30, 22, 15))).toBe('Idée 30-07-2026 22-15');
  });

  it('humanizes microphone permission and device errors', () => {
    expect(getMicrophoneErrorMessage(new DOMException('', 'NotAllowedError'))).toContain('refusé');
    expect(getMicrophoneErrorMessage(new DOMException('', 'NotFoundError'))).toContain('Aucun microphone');
  });

  it('releases a microphone granted after the recording was cancelled', async () => {
    let grantMicrophone: ((stream: MediaStream) => void) | undefined;
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    const dependencies = {
      mediaDevices: {
        getUserMedia: () => new Promise<MediaStream>((resolve) => {
          grantMicrophone = resolve;
        }),
      },
      MediaRecorderConstructor: class extends EventTarget {} as unknown as typeof MediaRecorder,
      now: () => 0,
      setInterval: window.setInterval.bind(window),
      clearInterval: window.clearInterval.bind(window),
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
    } satisfies VoiceRecorderDependencies;
    const engine = new VoiceRecorderEngine({
      onStopped: vi.fn(),
      onError: vi.fn(),
    }, { dependencies });

    const starting = engine.start();
    engine.cancel();
    grantMicrophone?.(stream);

    await expect(starting).rejects.toThrow('annulé');
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it('automatically stops at the configured duration and returns the captured blob', async () => {
    vi.useFakeTimers();
    try {
      let currentTime = 0;
      const stopTrack = vi.fn();
      const stream = {
        getTracks: () => [{ stop: stopTrack }],
      } as unknown as MediaStream;

      class FakeMediaRecorder extends EventTarget {
        static isTypeSupported(mimeType: string) {
          return mimeType === 'audio/webm;codecs=opus';
        }

        state: RecordingState = 'inactive';
        readonly mimeType = 'audio/webm;codecs=opus';

        start() {
          this.state = 'recording';
        }

        stop() {
          this.state = 'inactive';
          const dataEvent = new Event('dataavailable') as BlobEvent;
          Object.defineProperty(dataEvent, 'data', {
            value: new Blob(['recorded sound'], { type: this.mimeType }),
          });
          this.dispatchEvent(dataEvent);
          this.dispatchEvent(new Event('stop'));
        }
      }

      const onStopped = vi.fn();
      const dependencies = {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(stream),
        },
        MediaRecorderConstructor: FakeMediaRecorder as unknown as typeof MediaRecorder,
        now: () => currentTime,
        setInterval: window.setInterval.bind(window),
        clearInterval: window.clearInterval.bind(window),
        setTimeout: window.setTimeout.bind(window),
        clearTimeout: window.clearTimeout.bind(window),
      } satisfies VoiceRecorderDependencies;
      const engine = new VoiceRecorderEngine({
        onStopped,
        onError: vi.fn(),
      }, { maxDurationMs: 1_000, dependencies });

      await engine.start();
      currentTime = 1_000;
      await vi.advanceTimersByTimeAsync(1_000);

      expect(onStopped).toHaveBeenCalledOnce();
      expect(onStopped.mock.calls[0]?.[0]).toMatchObject({
        durationMs: 1_000,
        mimeType: 'audio/webm;codecs=opus',
      });
      expect(onStopped.mock.calls[0]?.[0].blob.size).toBeGreaterThan(0);
      expect(stopTrack).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
