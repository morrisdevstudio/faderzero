import type { AudioContextLike } from '@/features/metronome/metronomeEngine';

export const COUNT_IN_VOICE_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;

export interface AudioBufferSourceNodeLike {
  buffer: AudioBuffer | null;
  connect(destination: object): void;
  start(time: number): void;
  stop(time?: number): void;
}

export interface TimelineAudioContextLike extends AudioContextLike {
  decodeAudioData?(data: ArrayBuffer): Promise<AudioBuffer>;
  createBufferSource?(): AudioBufferSourceNodeLike;
}

let cachedContext: TimelineAudioContextLike | null = null;
let cachedLoad: Promise<(AudioBuffer | undefined)[]> | null = null;

export function resetCountInVoiceCache() {
  cachedContext = null;
  cachedLoad = null;
}

export function countInVoiceBufferIndex(pulseIndex: number) {
  if (!Number.isInteger(pulseIndex) || pulseIndex < 0 || pulseIndex >= COUNT_IN_VOICE_WORDS.length) return null;
  return pulseIndex;
}

export async function loadCountInVoiceBuffers(context: TimelineAudioContextLike): Promise<(AudioBuffer | undefined)[]> {
  if (!context.decodeAudioData) return [];
  if (cachedLoad && cachedContext === context) return cachedLoad;
  cachedContext = context;
  cachedLoad = Promise.all(COUNT_IN_VOICE_WORDS.map((word) => loadCountInVoiceWord(context, word)));
  return cachedLoad;
}

async function loadCountInVoiceWord(context: TimelineAudioContextLike, word: (typeof COUNT_IN_VOICE_WORDS)[number]) {
  if (!context.decodeAudioData) return undefined;
  try {
    const response = await fetch(`/sounds/count-in/${word}.wav`);
    if (!response.ok) return undefined;
    const data = await response.arrayBuffer();
    return await context.decodeAudioData(data);
  } catch {
    return undefined;
  }
}
