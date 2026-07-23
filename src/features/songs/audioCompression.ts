import { Mp3Encoder } from '@breezystack/lamejs';

export const MAX_AUDIO_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const DEFAULT_MP3_MIME_TYPE = 'audio/mpeg';
const MP3_BITRATE_KBPS = 192;
const MP3_FRAME_SAMPLE_COUNT = 1152;

export interface AudioCompressionProgress {
  phase: 'compression';
  progress: number;
  label: string;
}

export type AudioCompressionProgressHandler = (progress: AudioCompressionProgress) => void;

export function isMp3File(file: File) {
  return file.type === DEFAULT_MP3_MIME_TYPE || file.name.toLowerCase().endsWith('.mp3');
}

export function buildCompressedFileName(originalName: string) {
  const trimmedName = originalName.trim();
  const baseName = trimmedName.includes('.') ? trimmedName.replace(/\.[^/.]+$/, '') : trimmedName;
  return `${baseName || 'audio'}.mp3`;
}

export function estimateTargetBitrateKbps(_durationSeconds: number) {
  return MP3_BITRATE_KBPS;
}

export async function compressAudioForUpload(
  file: File,
  onProgress?: AudioCompressionProgressHandler
): Promise<File> {
  onProgress?.({ phase: 'compression', progress: 0, label: 'Preparation du fichier audio' });
  onProgress?.({ phase: 'compression', progress: 8, label: 'Decodage audio' });
  const audioBuffer = await decodeAudioFile(file);
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  onProgress?.({ phase: 'compression', progress: 18, label: 'Initialisation MP3' });
  const encodedBlob = await encodeAudioBufferToMp3(audioBuffer, channels, (progress) => {
    onProgress?.({ phase: 'compression', progress: Math.min(96, Math.round(20 + progress * 74)), label: 'Compression MP3 192 kbps' });
  });

  if (encodedBlob.size > MAX_AUDIO_FILE_SIZE_BYTES) {
    throw new Error('Le fichier audio depasse 50 Mo apres conversion en MP3 192 kb/s.');
  }
  onProgress?.({ phase: 'compression', progress: 100, label: 'Compression terminee' });
  return new File([encodedBlob], buildCompressedFileName(file.name), {
    type: DEFAULT_MP3_MIME_TYPE,
    lastModified: Date.now(),
  });
}

async function decodeAudioFile(file: File) {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Ce navigateur ne supporte pas la compression audio locale.');
  const audioContext = new AudioContextConstructor();
  try {
    return await audioContext.decodeAudioData((await file.arrayBuffer()).slice(0));
  } catch {
    throw new Error('Impossible de decoder ce fichier audio pour le convertir en MP3.');
  } finally {
    await audioContext.close();
  }
}

function encodeAudioBufferToMp3(
  audioBuffer: AudioBuffer,
  channels: number,
  onProgress?: (progress: number) => void
) {
  const left = float32ToInt16(audioBuffer.getChannelData(0));
  const right = channels === 2 ? float32ToInt16(audioBuffer.getChannelData(1)) : left;
  return typeof Worker === 'undefined'
    ? encodeOnCurrentThread(left, right, channels, audioBuffer.sampleRate, onProgress)
    : encodeInWorker(left, right, channels, audioBuffer.sampleRate, onProgress);
}

async function encodeOnCurrentThread(left: Int16Array, right: Int16Array, channels: number, sampleRate: number, onProgress?: (progress: number) => void) {
  const encoder = new Mp3Encoder(channels, sampleRate, MP3_BITRATE_KBPS);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < left.length; offset += MP3_FRAME_SAMPLE_COUNT) {
    const encoded = channels === 2
      ? encoder.encodeBuffer(left.subarray(offset, offset + MP3_FRAME_SAMPLE_COUNT), right.subarray(offset, offset + MP3_FRAME_SAMPLE_COUNT))
      : encoder.encodeBuffer(left.subarray(offset, offset + MP3_FRAME_SAMPLE_COUNT));
    if (encoded.length > 0) chunks.push(Uint8Array.from(encoded));
    if (offset % (MP3_FRAME_SAMPLE_COUNT * 24) === 0) {
      onProgress?.(offset / Math.max(left.length, 1));
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }
  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) chunks.push(Uint8Array.from(finalChunk));
  onProgress?.(1);
  return new Blob(chunks.map(copyToArrayBuffer), { type: DEFAULT_MP3_MIME_TYPE });
}

function encodeInWorker(left: Int16Array, right: Int16Array, channels: number, sampleRate: number, onProgress?: (progress: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./audioCompression.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ type: string; progress?: number; chunks?: Uint8Array[]; message?: string }>) => {
      if (event.data.type === 'progress') {
        onProgress?.(event.data.progress ?? 0);
        return;
      }
      worker.terminate();
      if (event.data.type === 'complete' && event.data.chunks) {
        resolve(new Blob(event.data.chunks.map(copyToArrayBuffer), { type: DEFAULT_MP3_MIME_TYPE }));
        return;
      }
      reject(new Error(event.data.message ?? 'Encodage MP3 impossible.'));
    };
    worker.onerror = () => { worker.terminate(); reject(new Error('Encodage MP3 impossible.')); };
    worker.postMessage({ type: 'encode', channels, sampleRate, bitrateKbps: MP3_BITRATE_KBPS, leftBuffer: left.buffer, rightBuffer: right.buffer }, [left.buffer, right.buffer]);
  });
}

function float32ToInt16(channelData: Float32Array) {
  const output = new Int16Array(channelData.length);
  for (let index = 0; index < channelData.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[index] ?? 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function copyToArrayBuffer(chunk: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(chunk.byteLength);
  copy.set(chunk);
  return copy.buffer;
}
