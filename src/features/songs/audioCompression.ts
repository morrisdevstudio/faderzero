export const MAX_AUDIO_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const DEFAULT_MP3_MIME_TYPE = 'audio/mpeg';
const MAX_MP3_BITRATE_KBPS = 192;
const MIN_MP3_BITRATE_KBPS = 32;
const BITRATE_STEP_KBPS = 16;
const MP3_FRAME_SAMPLE_COUNT = 1152;
const TARGET_SIZE_MARGIN = 0.94;

export interface AudioCompressionProgress {
  phase: 'compression';
  progress: number;
  label: string;
}

export type AudioCompressionProgressHandler = (progress: AudioCompressionProgress) => void;

type Mp3EncoderConstructor = new (
  channels: number,
  sampleRate: number,
  kbps: number
) => {
  encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
  flush(): Int8Array;
};

let Mp3EncoderConstructorCache: Mp3EncoderConstructor | null = null;

export function isMp3File(file: File) {
  return file.type === DEFAULT_MP3_MIME_TYPE || file.name.toLowerCase().endsWith('.mp3');
}

export function buildCompressedFileName(originalName: string) {
  const trimmedName = originalName.trim();
  const baseName = trimmedName.includes('.') ? trimmedName.replace(/\.[^/.]+$/, '') : trimmedName;
  const safeBaseName = baseName || 'audio';

  return `${safeBaseName}.mp3`;
}

export function estimateTargetBitrateKbps(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return MAX_MP3_BITRATE_KBPS;
  }

  const targetBits = MAX_AUDIO_FILE_SIZE_BYTES * 8 * TARGET_SIZE_MARGIN;
  const estimatedBitrate = Math.floor(targetBits / durationSeconds / 1000);

  return clampBitrateKbps(estimatedBitrate);
}

export async function compressAudioForUpload(
  file: File,
  onProgress?: AudioCompressionProgressHandler
): Promise<File> {
  onProgress?.({ phase: 'compression', progress: 0, label: 'Preparation du fichier audio' });

  if (isMp3File(file) && file.size <= MAX_AUDIO_FILE_SIZE_BYTES) {
    onProgress?.({ phase: 'compression', progress: 100, label: 'Compression inutile' });
    return file;
  }

  onProgress?.({ phase: 'compression', progress: 8, label: 'Decodage audio' });
  const audioBuffer = await decodeAudioFile(file);
  const channelCount = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const targetBitrate = estimateTargetBitrateKbps(audioBuffer.duration);
  onProgress?.({ phase: 'compression', progress: 18, label: 'Initialisation MP3' });
  const Mp3Encoder = await getMp3EncoderConstructor();
  const bitrateAttempts = buildBitrateAttempts(targetBitrate);

  for (let attemptIndex = 0; attemptIndex < bitrateAttempts.length; attemptIndex += 1) {
    const bitrateKbps = bitrateAttempts[attemptIndex] ?? MIN_MP3_BITRATE_KBPS;
    const encodedBlob = await encodeAudioBufferToMp3(
      audioBuffer,
      channelCount,
      sampleRate,
      bitrateKbps,
      Mp3Encoder,
      (encodingProgress) => {
        const attemptSpan = 74 / bitrateAttempts.length;
        const progress = 20 + attemptIndex * attemptSpan + encodingProgress * attemptSpan;
        onProgress?.({
          phase: 'compression',
          progress: Math.min(96, Math.round(progress)),
          label: `Compression MP3 ${bitrateKbps} kbps`,
        });
      }
    );

    if (encodedBlob.size <= MAX_AUDIO_FILE_SIZE_BYTES) {
      onProgress?.({ phase: 'compression', progress: 100, label: 'Compression terminee' });
      return new File([encodedBlob], buildCompressedFileName(file.name), {
        type: DEFAULT_MP3_MIME_TYPE,
        lastModified: Date.now(),
      });
    }
  }

  throw new Error("Le fichier audio depasse 5 Mo meme apres compression en MP3.");
}

function clampBitrateKbps(value: number) {
  return Math.max(MIN_MP3_BITRATE_KBPS, Math.min(MAX_MP3_BITRATE_KBPS, value));
}

function buildBitrateAttempts(targetBitrate: number) {
  const bitrates: number[] = [];
  for (
    let bitrateKbps = targetBitrate;
    bitrateKbps >= MIN_MP3_BITRATE_KBPS;
    bitrateKbps -= BITRATE_STEP_KBPS
  ) {
    bitrates.push(bitrateKbps);
  }

  return bitrates.length > 0 ? bitrates : [MIN_MP3_BITRATE_KBPS];
}

async function decodeAudioFile(file: File) {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Ce navigateur ne supporte pas la compression audio locale.");
  }

  const audioContext = new AudioContextConstructor();

  try {
    const fileBuffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(fileBuffer.slice(0));
  } catch {
    throw new Error("Impossible de decoder ce fichier audio pour le convertir en MP3.");
  } finally {
    await audioContext.close();
  }
}

async function encodeAudioBufferToMp3(
  audioBuffer: AudioBuffer,
  channelCount: number,
  sampleRate: number,
  bitrateKbps: number,
  Mp3Encoder: Mp3EncoderConstructor,
  onProgress?: (progress: number) => void
) {
  const encoder = new Mp3Encoder(channelCount, sampleRate, bitrateKbps);
  const leftChannel = float32ToInt16(audioBuffer.getChannelData(0));
  const rightChannel =
    channelCount === 2 ? float32ToInt16(audioBuffer.getChannelData(1)) : leftChannel;
  const chunks: Int8Array[] = [];

  for (let offset = 0; offset < leftChannel.length; offset += MP3_FRAME_SAMPLE_COUNT) {
    const leftChunk = leftChannel.subarray(offset, offset + MP3_FRAME_SAMPLE_COUNT);
    const rightChunk = rightChannel.subarray(offset, offset + MP3_FRAME_SAMPLE_COUNT);
    const encodedChunk =
      channelCount === 2 ? encoder.encodeBuffer(leftChunk, rightChunk) : encoder.encodeBuffer(leftChunk);

    if (encodedChunk.length > 0) {
      chunks.push(encodedChunk);
    }

    if (offset % (MP3_FRAME_SAMPLE_COUNT * 24) === 0) {
      onProgress?.(offset / leftChannel.length);
      await waitForUiFrame();
    }
  }

  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) {
    chunks.push(finalChunk);
  }

  onProgress?.(1);
  return new Blob(chunks.map((chunk) => Uint8Array.from(chunk)), { type: DEFAULT_MP3_MIME_TYPE });
}

function waitForUiFrame() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

async function getMp3EncoderConstructor() {
  if (Mp3EncoderConstructorCache) {
    return Mp3EncoderConstructorCache;
  }

  const { default: lamejsBrowserSource } = await import('lamejs/lame.all.js?raw');
  const lamejs = new Function(`${lamejsBrowserSource}; return lamejs;`)() as {
    Mp3Encoder: Mp3EncoderConstructor;
  };
  Mp3EncoderConstructorCache = lamejs.Mp3Encoder;

  return Mp3EncoderConstructorCache;
}

function float32ToInt16(channelData: Float32Array) {
  const output = new Int16Array(channelData.length);

  for (let index = 0; index < channelData.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[index] ?? 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}
