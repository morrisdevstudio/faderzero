import type { AudioContextLike, OscillatorNodeLike } from '@/features/metronome/metronomeEngine';
import type { CompiledTimeline, CompiledTimelineEvent } from './timelineCompiler';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.12;
const START_DELAY_SECONDS = 0.05;

type TimerId = ReturnType<typeof window.setTimeout>;

export interface TimelinePlaybackSnapshot {
  status: 'stopped' | 'playing' | 'paused' | 'ended';
  position: number;
  event?: CompiledTimelineEvent;
}

interface TimelinePlaybackOptions {
  createAudioContext?: () => AudioContextLike;
  setTimer?: (callback: () => void, delayMs: number) => TimerId;
  clearTimer?: (timerId: TimerId) => void;
  lookaheadMs?: number;
  scheduleAheadSeconds?: number;
}

export class TimelinePlaybackEngine {
  private readonly createAudioContext: () => AudioContextLike;
  private readonly setTimer: (callback: () => void, delayMs: number) => TimerId;
  private readonly clearTimer: (timerId: TimerId) => void;
  private readonly lookaheadMs: number;
  private readonly scheduleAheadSeconds: number;
  private audioContext: AudioContextLike | null = null;
  private timeline: CompiledTimeline | null = null;
  private timerId: TimerId | null = null;
  private notificationTimers = new Set<TimerId>();
  private scheduledNodes = new Set<OscillatorNodeLike>();
  private eventIndex = 0;
  private anchorAudioTime = 0;
  private pausedPosition = 0;
  private generation = 0;
  private volume = 0.75;
  private status: TimelinePlaybackSnapshot['status'] = 'stopped';
  private listener: ((snapshot: TimelinePlaybackSnapshot) => void) | null = null;

  constructor(options: TimelinePlaybackOptions = {}) {
    this.createAudioContext = options.createAudioContext ?? createDefaultAudioContext;
    this.setTimer = options.setTimer ?? window.setTimeout.bind(window);
    this.clearTimer = options.clearTimer ?? window.clearTimeout.bind(window);
    this.lookaheadMs = options.lookaheadMs ?? LOOKAHEAD_MS;
    this.scheduleAheadSeconds = options.scheduleAheadSeconds ?? SCHEDULE_AHEAD_SECONDS;
  }

  setListener(listener: ((snapshot: TimelinePlaybackSnapshot) => void) | null) {
    this.listener = listener;
  }

  get snapshot(): TimelinePlaybackSnapshot {
    return { status: this.status, position: this.getPosition() };
  }

  async play(timeline?: CompiledTimeline, position = this.pausedPosition, volume = this.volume) {
    if (timeline) this.timeline = timeline;
    if (!this.timeline || this.timeline.duration <= 0) return;
    const context = this.getAudioContext();
    if (context.state !== 'running') await context.resume();
    this.clearScheduling();
    this.generation += 1;
    this.volume = Math.min(1, Math.max(0, volume));
    this.pausedPosition = Math.min(this.timeline.duration, Math.max(0, position));
    this.anchorAudioTime = context.currentTime + START_DELAY_SECONDS - this.pausedPosition;
    this.eventIndex = this.timeline.events.findIndex((event) => event.time >= this.pausedPosition);
    if (this.eventIndex < 0) this.eventIndex = this.timeline.events.length;
    this.status = 'playing';
    this.listener?.({ status: this.status, position: this.pausedPosition });
    this.schedulerTick();
  }

  pause() {
    if (this.status !== 'playing') return;
    this.pausedPosition = this.getPosition();
    this.status = 'paused';
    this.generation += 1;
    this.clearScheduling();
    this.listener?.({ status: this.status, position: this.pausedPosition });
  }

  stop() {
    this.status = 'stopped';
    this.pausedPosition = 0;
    this.generation += 1;
    this.clearScheduling();
    this.listener?.({ status: this.status, position: 0 });
  }

  async seek(position: number) {
    const timeline = this.timeline;
    if (!timeline) return;
    const nextPosition = Math.min(timeline.duration, Math.max(0, position));
    if (this.status === 'playing') await this.play(timeline, nextPosition, this.volume);
    else {
      this.pausedPosition = nextPosition;
      this.listener?.({ status: this.status, position: nextPosition });
    }
  }

  private getPosition() {
    if (this.status !== 'playing' || !this.audioContext || !this.timeline) return this.pausedPosition;
    return Math.min(this.timeline.duration, Math.max(0, this.audioContext.currentTime - this.anchorAudioTime));
  }

  private getAudioContext() {
    if (!this.audioContext) this.audioContext = this.createAudioContext();
    return this.audioContext;
  }

  private schedulerTick = () => {
    if (this.status !== 'playing' || !this.timeline) return;
    const context = this.getAudioContext();
    const generation = this.generation;
    const scheduleUntil = context.currentTime + this.scheduleAheadSeconds;
    while (this.eventIndex < this.timeline.events.length) {
      const event = this.timeline.events[this.eventIndex]!;
      const audioTime = this.anchorAudioTime + event.time;
      if (audioTime >= scheduleUntil) break;
      if (audioTime >= context.currentTime) this.scheduleEvent(event, audioTime, generation);
      this.eventIndex += 1;
    }
    if (context.currentTime - this.anchorAudioTime >= this.timeline.duration) {
      this.status = 'ended';
      this.pausedPosition = this.timeline.duration;
      this.clearScheduling();
      this.listener?.({ status: 'ended', position: this.pausedPosition });
      return;
    }
    this.timerId = this.setTimer(this.schedulerTick, this.lookaheadMs);
  };

  private scheduleEvent(event: CompiledTimelineEvent, audioTime: number, generation: number) {
    const context = this.getAudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequency = event.sound === 'accent' ? 1760 : event.sound === 'countIn' ? 1100 : event.sound === 'low' ? 880 : 1320;
    const peak = (event.sound === 'accent' ? 0.9 : event.sound === 'countIn' ? 0.65 : event.sound === 'low' ? 0.48 : 0.52) * this.volume;
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, audioTime);
    gain.gain.setValueAtTime(0.0001, audioTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), audioTime + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioTime + 0.03);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(audioTime);
    oscillator.stop(audioTime + 0.03);
    this.scheduledNodes.add(oscillator);

    const notificationTimer = this.setTimer(() => {
      this.notificationTimers.delete(notificationTimer);
      this.scheduledNodes.delete(oscillator);
      if (generation === this.generation && this.status === 'playing') {
        this.listener?.({ status: this.status, position: event.time, event });
      }
    }, Math.max(0, (audioTime - context.currentTime) * 1000));
    this.notificationTimers.add(notificationTimer);
  }

  private clearScheduling() {
    if (this.timerId !== null) this.clearTimer(this.timerId);
    this.timerId = null;
    for (const timer of this.notificationTimers) this.clearTimer(timer);
    this.notificationTimers.clear();
    for (const node of this.scheduledNodes) {
      try { node.stop(this.audioContext?.currentTime ?? 0); } catch { /* node already ended */ }
    }
    this.scheduledNodes.clear();
  }
}

function createDefaultAudioContext(): AudioContextLike {
  const Constructor = window.AudioContext ?? window.webkitAudioContext;
  if (!Constructor) throw new Error('Web Audio API indisponible.');
  return new Constructor();
}
