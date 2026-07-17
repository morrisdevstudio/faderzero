const DEFAULT_LOOKAHEAD_MS = 25;
const DEFAULT_SCHEDULE_AHEAD_TIME = 0.12;
const CLICK_DURATION_SECONDS = 0.03;
const START_DELAY_SECONDS = 0.05;

export type AudioContextState = 'running' | 'suspended' | 'closed' | 'interrupted';

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): void;
  exponentialRampToValueAtTime(value: number, time: number): void;
}

export interface GainNodeLike {
  gain: AudioParamLike;
  connect(destination: object): void;
}

export interface OscillatorNodeLike {
  frequency: AudioParamLike;
  type: OscillatorType;
  connect(destination: object): void;
  start(time: number): void;
  stop(time: number): void;
}

export interface AudioContextLike {
  currentTime: number;
  state: AudioContextState;
  destination: object;
  resume(): Promise<void>;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
}

type TimerId = ReturnType<typeof window.setTimeout>;

export interface MetronomeEngineConfig {
  bpm: number;
  beatsPerBar: number;
}

export interface MetronomeEngineOptions {
  createAudioContext?: () => AudioContextLike;
  lookaheadMs?: number;
  scheduleAheadTime?: number;
  setTimer?: (callback: () => void, delayMs: number) => TimerId;
  clearTimer?: (timerId: TimerId) => void;
}

export interface ScheduledBeatEvent {
  beatInBar: number;
  scheduledTime: number;
}

export function clampBpm(value: number) {
  return Math.min(240, Math.max(30, Math.round(value)));
}

export function clampBeatsPerBar(value: number) {
  return Math.min(12, Math.max(1, Math.round(value)));
}

export class MetronomeEngine {
  private readonly createAudioContext: () => AudioContextLike;
  private readonly lookaheadMs: number;
  private readonly scheduleAheadTime: number;
  private readonly setTimer: (callback: () => void, delayMs: number) => TimerId;
  private readonly clearTimer: (timerId: TimerId) => void;

  private audioContext: AudioContextLike | null = null;
  private timerId: TimerId | null = null;
  private beatTimerIds = new Set<TimerId>();
  private isRunning = false;
  private bpm = 120;
  private beatsPerBar = 4;
  private nextBeatIndex = 0;
  private nextNoteTime = 0;
  private scheduleGeneration = 0;
  private beatListener: ((event: ScheduledBeatEvent) => void) | null = null;

  constructor(options: MetronomeEngineOptions = {}) {
    this.createAudioContext = options.createAudioContext ?? createDefaultAudioContext;
    this.lookaheadMs = options.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
    this.scheduleAheadTime = options.scheduleAheadTime ?? DEFAULT_SCHEDULE_AHEAD_TIME;
    this.setTimer = options.setTimer ?? window.setTimeout.bind(window);
    this.clearTimer = options.clearTimer ?? window.clearTimeout.bind(window);
  }

  get running() {
    return this.isRunning;
  }

  get snapshot(): MetronomeEngineConfig {
    return {
      bpm: this.bpm,
      beatsPerBar: this.beatsPerBar,
    };
  }

  setBeatListener(listener: ((event: ScheduledBeatEvent) => void) | null) {
    this.beatListener = listener;
  }

  async start(config: Partial<MetronomeEngineConfig> = {}) {
    this.applyConfig(config);

    if (this.isRunning) {
      return;
    }

    const audioContext = this.getAudioContext();
    if (audioContext.state !== 'running') {
      await audioContext.resume();
    }

    this.isRunning = true;
    this.scheduleGeneration += 1;
    this.nextBeatIndex = 0;
    this.nextNoteTime = audioContext.currentTime + START_DELAY_SECONDS;
    this.schedulerTick();
  }

  stop() {
    this.isRunning = false;
    this.nextBeatIndex = 0;
    this.nextNoteTime = 0;
    this.scheduleGeneration += 1;

    if (this.timerId !== null) {
      this.clearTimer(this.timerId);
      this.timerId = null;
    }

    for (const timerId of this.beatTimerIds) {
      this.clearTimer(timerId);
    }

    this.beatTimerIds.clear();
  }

  updateConfig(config: Partial<MetronomeEngineConfig>) {
    this.applyConfig(config);
  }

  private applyConfig(config: Partial<MetronomeEngineConfig>) {
    if (config.bpm !== undefined) {
      this.bpm = clampBpm(config.bpm);
    }

    if (config.beatsPerBar !== undefined) {
      this.beatsPerBar = clampBeatsPerBar(config.beatsPerBar);
      this.nextBeatIndex %= this.beatsPerBar;
    }
  }

  private getSecondsPerBeat() {
    return 60 / this.bpm;
  }

  private getAudioContext() {
    if (this.audioContext === null) {
      this.audioContext = this.createAudioContext();
    }

    return this.audioContext;
  }

  private schedulerTick = () => {
    if (!this.isRunning) {
      return;
    }

    const audioContext = this.getAudioContext();

    while (this.nextNoteTime < audioContext.currentTime + this.scheduleAheadTime) {
      const beatInBar = this.nextBeatIndex;
      this.scheduleBeat(beatInBar, this.nextNoteTime, this.scheduleGeneration);
      this.advanceBeat();
    }

    this.timerId = this.setTimer(this.schedulerTick, this.lookaheadMs);
  };

  private advanceBeat() {
    this.nextNoteTime += this.getSecondsPerBeat();
    this.nextBeatIndex = (this.nextBeatIndex + 1) % this.beatsPerBar;
  }

  private scheduleBeat(beatInBar: number, scheduledTime: number, generation: number) {
    const audioContext = this.getAudioContext();
    const isAccent = beatInBar === 0;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(isAccent ? 1760 : 1320, scheduledTime);
    gainNode.gain.setValueAtTime(0.0001, scheduledTime);
    gainNode.gain.exponentialRampToValueAtTime(isAccent ? 0.9 : 0.55, scheduledTime + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, scheduledTime + CLICK_DURATION_SECONDS);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(scheduledTime);
    oscillator.stop(scheduledTime + CLICK_DURATION_SECONDS);

    if (this.beatListener === null) {
      return;
    }

    const delayMs = Math.max(0, (scheduledTime - audioContext.currentTime) * 1000);
    const timerId = this.setTimer(() => {
      this.beatTimerIds.delete(timerId);

      if (!this.isRunning || generation !== this.scheduleGeneration) {
        return;
      }

      this.beatListener?.({
        beatInBar,
        scheduledTime,
      });
    }, delayMs);

    this.beatTimerIds.add(timerId);
  }
}

function createDefaultAudioContext(): AudioContextLike {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;

  if (AudioContextConstructor === undefined) {
    throw new Error('Web Audio API is unavailable in this browser.');
  }

  return new AudioContextConstructor();
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
