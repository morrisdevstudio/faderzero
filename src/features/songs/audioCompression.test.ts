import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_AUDIO_FILE_SIZE_BYTES,
  buildCompressedFileName,
  compressAudioForUpload,
  estimateTargetBitrateKbps,
  isMp3File,
} from '@/features/songs/audioCompression';

describe('audioCompression helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes imported files to an mp3 filename', () => {
    expect(buildCompressedFileName('backing-track.wav')).toBe('backing-track.mp3');
    expect(buildCompressedFileName('demo')).toBe('demo.mp3');
    expect(buildCompressedFileName('   ')).toBe('audio.mp3');
  });

  it('detects mp3 files from mime type or extension', () => {
    expect(isMp3File(new File(['data'], 'mix.wav', { type: 'audio/mpeg' }))).toBe(true);
    expect(isMp3File(new File(['data'], 'mix.MP3', { type: '' }))).toBe(true);
    expect(isMp3File(new File(['data'], 'mix.wav', { type: 'audio/wav' }))).toBe(false);
  });

  it('uses the uniform 192 kb/s MP3 bitrate', () => {
    expect(estimateTargetBitrateKbps(30)).toBe(192);
    expect(estimateTargetBitrateKbps(60 * 5)).toBe(192);
    expect(estimateTargetBitrateKbps(60 * 30)).toBe(192);
  });

  it('keeps the Worker-compatible 50 Mo ceiling constant', () => {
    expect(MAX_AUDIO_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });

  it('encodes decoded audio to an mp3 file under the upload ceiling', async () => {
    const progressEvents: number[] = [];

    class FakeAudioContext {
      async decodeAudioData() {
        return {
          duration: 1,
          numberOfChannels: 1,
          sampleRate: 44100,
          getChannelData: () => new Float32Array(44100),
        };
      }

      async close() {}
    }

    vi.stubGlobal('AudioContext', FakeAudioContext);

    const compressedFile = await compressAudioForUpload(
      new File([new Uint8Array([1, 2, 3])], 'recording.wav', { type: 'audio/wav' }),
      (progress) => {
        progressEvents.push(progress.progress);
      }
    );

    expect(compressedFile.name).toBe('recording.mp3');
    expect(compressedFile.type).toBe('audio/mpeg');
    expect(compressedFile.size).toBeLessThanOrEqual(MAX_AUDIO_FILE_SIZE_BYTES);
    expect(progressEvents[0]).toBe(0);
    expect(progressEvents.at(-1)).toBe(100);
  });

  it('re-encodes MP3 inputs so every upload uses the uniform bitrate', async () => {
    const decodeAudioData = vi.fn(async () => ({
      duration: 1,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(44100),
    }));
    class FakeAudioContext {
      decodeAudioData = decodeAudioData;
      async close() {}
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const result = await compressAudioForUpload(
      new File([new Uint8Array([0xff, 0xfb, 0x90, 0x64])], 'legacy.mp3', { type: 'audio/mpeg' })
    );

    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(result.name).toBe('legacy.mp3');
    expect(result).not.toBeInstanceOf(Promise);
  });
});
