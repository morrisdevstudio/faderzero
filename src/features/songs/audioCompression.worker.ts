import { Mp3Encoder } from '@breezystack/lamejs';

const MP3_FRAME_SAMPLE_COUNT = 1152;

interface EncodeMessage {
  type: 'encode';
  channels: number;
  sampleRate: number;
  bitrateKbps: number;
  leftBuffer: ArrayBuffer;
  rightBuffer: ArrayBuffer;
}

self.onmessage = (event: MessageEvent<EncodeMessage>) => {
  if (event.data.type !== 'encode') return;
  try {
    const { channels, sampleRate, bitrateKbps } = event.data;
    const left = new Int16Array(event.data.leftBuffer);
    const right = new Int16Array(event.data.rightBuffer);
    const encoder = new Mp3Encoder(channels, sampleRate, bitrateKbps);
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < left.length; offset += MP3_FRAME_SAMPLE_COUNT) {
      const leftChunk = left.subarray(offset, offset + MP3_FRAME_SAMPLE_COUNT);
      const rightChunk = right.subarray(offset, offset + MP3_FRAME_SAMPLE_COUNT);
      const encoded = channels === 2 ? encoder.encodeBuffer(leftChunk, rightChunk) : encoder.encodeBuffer(leftChunk);
      if (encoded.length > 0) chunks.push(Uint8Array.from(encoded));
      if (offset % (MP3_FRAME_SAMPLE_COUNT * 24) === 0) {
        self.postMessage({ type: 'progress', progress: offset / Math.max(left.length, 1) });
      }
    }
    const finalChunk = encoder.flush();
    if (finalChunk.length > 0) chunks.push(Uint8Array.from(finalChunk));
    self.postMessage({ type: 'complete', chunks });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Encodage MP3 impossible.' });
  }
};
