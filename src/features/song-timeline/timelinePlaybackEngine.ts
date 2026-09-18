import type { AudioContextLike } from '@/features/metronome/metronomeEngine';
import {
  countInVoiceBufferIndex,
  loadCountInVoiceBuffers,
  type AudioBufferSourceNodeLike,
  type TimelineAudioContextLike,
} from './countInVoice';
import type { CompiledTimeline, CompiledTimelineEvent, CompiledTimelineSection } from './timelineCompiler';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.12;
const START_DELAY_SECONDS = 0.05;

type TimerId = ReturnType<typeof window.setTimeout>;
type ScheduledAudioNode = { stop(time: number): void };

export interface TimelinePlaybackSnapshot {
  status: 'stopped' | 'playing' | 'paused' | 'ended';
  position: number;
  loopBar?: number;
  event?: CompiledTimelineEvent;
}

interface TimelinePlaybackOptions {
  createAudioContext?: () => AudioContextLike;
  setTimer?: (callback: () => void, delayMs: number) => TimerId;
  clearTimer?: (timerId: TimerId) => void;
  lookaheadMs?: number;
  scheduleAheadSeconds?: number;
  loadCountInVoiceBuffers?: (context: TimelineAudioContextLike) => Promise<(AudioBuffer | undefined)[]>;
}

export class TimelinePlaybackEngine {
  private readonly createAudioContext: () => AudioContextLike;
  private readonly setTimer: (callback: () => void, delayMs: number) => TimerId;
  private readonly clearTimer: (timerId: TimerId) => void;
  private readonly lookaheadMs: number;
  private readonly scheduleAheadSeconds: number;
  private readonly loadCountInVoiceBuffers: (context: TimelineAudioContextLike) => Promise<(AudioBuffer | undefined)[]>;
  private audioContext: AudioContextLike | null = null;
  private timeline: CompiledTimeline | null = null;
  private timerId: TimerId | null = null;
  private notificationTimers = new Set<TimerId>();
  private scheduledNodes = new Set<ScheduledAudioNode>();
  private voiceBuffers: (AudioBuffer | undefined)[] = [];
  private eventIndex = 0;
  private anchorAudioTime = 0;
  private pausedPosition = 0;
  private generation = 0;
  private volume = 1;
  private status: TimelinePlaybackSnapshot['status'] = 'stopped';
  private loopingSectionId: string | null = null;
  private resumedLoopBars = 0;
  private scheduledLoopKeys = new Set<string>();
  private listener: ((snapshot: TimelinePlaybackSnapshot) => void) | null = null;

  constructor(options: TimelinePlaybackOptions = {}) {
    this.createAudioContext = options.createAudioContext ?? createDefaultAudioContext;
    this.setTimer = options.setTimer ?? window.setTimeout.bind(window);
    this.clearTimer = options.clearTimer ?? window.clearTimeout.bind(window);
    this.lookaheadMs = options.lookaheadMs ?? LOOKAHEAD_MS;
    this.scheduleAheadSeconds = options.scheduleAheadSeconds ?? SCHEDULE_AHEAD_SECONDS;
    this.loadCountInVoiceBuffers = options.loadCountInVoiceBuffers ?? loadCountInVoiceBuffers;
  }

  setListener(listener: ((snapshot: TimelinePlaybackSnapshot) => void) | null) {
    this.listener = listener;
  }

  get snapshot(): TimelinePlaybackSnapshot {
    return this.buildSnapshot();
  }

  async play(timeline?: CompiledTimeline, position = this.pausedPosition, volume = this.volume) {
    if (timeline) this.timeline = timeline;
    if (!this.timeline || this.timeline.duration <= 0) return;
    const previousLoopingId = this.loopingSectionId;
    const previousResumedLoopBars = this.resumedLoopBars;
    const wasPaused = this.status === 'paused';
    const context = this.getAudioContext();
    if (context.state !== 'running') await context.resume();
    this.clearScheduling();
    this.generation += 1;
    this.volume = Math.min(1, Math.max(0, volume));
    this.assignLoopingSection(position);
    const continuingLoop = wasPaused && this.loopingSectionId !== null && this.loopingSectionId === previousLoopingId;
    this.resumedLoopBars = continuingLoop ? previousResumedLoopBars : 0;
    this.pausedPosition = this.loopingSectionId
      ? Math.max(0, position)
      : Math.min(this.timeline.duration, Math.max(0, position));
    if (this.timeline.countInSound === 'voice') await this.ensureVoiceBuffers();
    this.anchorAudioTime = context.currentTime + START_DELAY_SECONDS - this.pausedPosition;
    this.eventIndex = this.timeline.events.findIndex((event) => event.time >= this.pausedPosition);
    if (this.eventIndex < 0) this.eventIndex = this.timeline.events.length;
    this.status = 'playing';
    this.listener?.(this.buildSnapshot());
    this.schedulerTick();
  }

  pause() {
    if (this.status !== 'playing') return;
    const looping = this.getLoopingSection();
    const raw = this.getRawPosition();
    if (looping) {
      this.resumedLoopBars = Math.floor(Math.max(0, raw - looping.startTime) / looping.barDuration);
      this.pausedPosition = looping.startTime + (Math.max(0, raw - looping.startTime) % looping.barDuration);
    } else {
      this.pausedPosition = this.getPosition();
    }
    this.status = 'paused';
    this.generation += 1;
    this.clearScheduling();
    this.listener?.(this.buildSnapshot());
  }

  stop() {
    this.status = 'stopped';
    this.pausedPosition = 0;
    this.loopingSectionId = null;
    this.resumedLoopBars = 0;
    this.generation += 1;
    this.clearScheduling();
    this.listener?.(this.buildSnapshot());
  }

  async seek(position: number) {
    const timeline = this.timeline;
    if (!timeline) return;
    const nextPosition = Math.min(timeline.duration, Math.max(0, position));
    this.resumedLoopBars = 0;
    this.assignLoopingSection(nextPosition);
    if (this.status === 'playing') await this.play(timeline, nextPosition, this.volume);
    else {
      this.pausedPosition = nextPosition;
      this.listener?.(this.buildSnapshot());
    }
  }

  private getAudioContext() {
    if (!this.audioContext) this.audioContext = this.createAudioContext();
    return this.audioContext;
  }

  private async ensureVoiceBuffers() {
    this.voiceBuffers = await this.loadCountInVoiceBuffers(this.getAudioContext());
  }

  private getRawPosition() {
    if (this.status !== 'playing' || !this.audioContext || !this.timeline) return this.pausedPosition;
    return Math.max(0, this.audioContext.currentTime - this.anchorAudioTime);
  }

  private getPosition() {
    const raw = this.getRawPosition();
    const looping = this.getLoopingSection();
    if (looping && (this.status === 'playing' || this.status === 'paused')) {
      const elapsed = Math.max(0, raw - looping.startTime);
      return looping.startTime + (elapsed % looping.barDuration);
    }
    if (!this.timeline) return this.pausedPosition;
    return Math.min(this.timeline.duration, raw);
  }

  private getLoopBar() {
    const looping = this.getLoopingSection();
    if (!looping) return undefined;
    const raw = this.status === 'playing' ? this.getRawPosition() : this.pausedPosition;
    const sessionBars = Math.floor(Math.max(0, raw - looping.startTime) / looping.barDuration);
    return this.resumedLoopBars + sessionBars + 1;
  }

  private getLoopingSection(): CompiledTimelineSection | undefined {
    if (!this.timeline || !this.loopingSectionId) return undefined;
    return this.timeline.sections.find((section) => section.id === this.loopingSectionId && section.infinite);
  }

  private assignLoopingSection(position: number) {
    const section = this.timeline?.sections.find((candidate) => position + 1e-9 >= candidate.startTime && position < candidate.endTime);
    this.loopingSectionId = section?.infinite ? section.id : null;
  }

  private captureLoopingSection() {
    if (this.loopingSectionId || !this.timeline) return;
    const raw = this.getRawPosition();
    const inWindow = this.timeline.sections.find((section) => section.infinite && raw >= section.startTime && raw < section.endTime);
    if (inWindow) {
      this.loopingSectionId = inWindow.id;
      return;
    }
    const last = this.timeline.sections.at(-1);
    if (last?.infinite && raw >= last.startTime) this.loopingSectionId = last.id;
  }

  private buildSnapshot(event?: CompiledTimelineEvent): TimelinePlaybackSnapshot {
    const loopBar = this.getLoopBar();
    return {
      status: this.status,
      position: this.getPosition(),
      ...(loopBar !== undefined ? { loopBar } : {}),
      ...(event ? { event } : {}),
    };
  }

  private schedulerTick = () => {
    if (this.status !== 'playing' || !this.timeline) return;
    this.captureLoopingSection();
    const looping = this.getLoopingSection();
    const context = this.getAudioContext();
    const generation = this.generation;
    const scheduleUntil = context.currentTime + this.scheduleAheadSeconds;
    while (this.eventIndex < this.timeline.events.length) {
      const event = this.timeline.events[this.eventIndex]!;
      const eventSection = this.timeline.sections[event.sectionIndex];
      if (eventSection?.infinite && !event.countIn) {
        this.eventIndex += 1;
        continue;
      }
      const audioTime = this.anchorAudioTime + event.time;
      if (audioTime >= scheduleUntil) break;
      if (audioTime >= context.currentTime) this.scheduleEvent(event, audioTime, generation);
      this.eventIndex += 1;
    }
    this.scheduleLoopedEvents(scheduleUntil, generation);
    if (!looping && context.currentTime - this.anchorAudioTime >= this.timeline.duration) {
      this.status = 'ended';
      this.pausedPosition = this.timeline.duration;
      this.clearScheduling();
      this.listener?.(this.buildSnapshot());
      return;
    }
    this.timerId = this.setTimer(this.schedulerTick, this.lookaheadMs);
  };

  private scheduleLoopedEvents(scheduleUntil: number, generation: number) {
    const timeline = this.timeline;
    const looping = this.getLoopingSection();
    if (!timeline || !looping) return;
    const template = timeline.events.filter((event) => event.sectionId === looping.id && !event.countIn);
    if (template.length === 0) return;
    const context = this.getAudioContext();
    const raw = this.getRawPosition();
    const fromCycle = Math.max(0, Math.floor((raw - looping.startTime) / looping.barDuration));
    const untilCycle = Math.max(
      fromCycle,
      Math.ceil((scheduleUntil - this.anchorAudioTime - looping.startTime) / looping.barDuration),
    );
    for (let cycle = fromCycle; cycle <= untilCycle; cycle += 1) {
      for (const event of template) {
        const time = looping.startTime + cycle * looping.barDuration + (event.time - looping.startTime);
        const audioTime = this.anchorAudioTime + time;
        if (audioTime >= scheduleUntil || audioTime < context.currentTime) continue;
        const key = `${cycle}:${event.pulseIndex}:${event.time}`;
        if (this.scheduledLoopKeys.has(key)) continue;
        this.scheduledLoopKeys.add(key);
        this.scheduleEvent({
          ...event,
          time,
          barIndex: this.resumedLoopBars + cycle,
        }, audioTime, generation);
      }
    }
  }

  private scheduleEvent(event: CompiledTimelineEvent, audioTime: number, generation: number) {
    if (event.countIn && this.timeline?.countInSound === 'voice') this.scheduleVoice(event, audioTime);
    this.scheduleClick(event, audioTime, generation);
  }

  private scheduleVoice(event: CompiledTimelineEvent, audioTime: number) {
    const voiceIndex = countInVoiceBufferIndex(event.pulseIndex);
    const buffer = voiceIndex === null ? undefined : this.voiceBuffers[voiceIndex];
    const context = this.getAudioContext() as TimelineAudioContextLike;
    if (!buffer || !context.createBufferSource) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(Math.max(0.0001, 0.9 * this.volume), audioTime);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(audioTime);
    this.scheduledNodes.add(source);
  }

  private scheduleClick(event: CompiledTimelineEvent, audioTime: number, generation: number) {
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
    this.trackScheduledNode(oscillator, event, audioTime, generation);
  }

  private trackScheduledNode(node: ScheduledAudioNode | AudioBufferSourceNodeLike, event: CompiledTimelineEvent, audioTime: number, generation: number) {
    const context = this.getAudioContext();
    this.scheduledNodes.add(node);
    const notificationTimer = this.setTimer(() => {
      this.notificationTimers.delete(notificationTimer);
      this.scheduledNodes.delete(node);
      if (generation === this.generation && this.status === 'playing') {
        this.listener?.(this.buildSnapshot(event));
      }
    }, Math.max(0, (audioTime - context.currentTime) * 1000));
    this.notificationTimers.add(notificationTimer);
  }

  private clearScheduling() {
    if (this.timerId !== null) this.clearTimer(this.timerId);
    this.timerId = null;
    for (const timer of this.notificationTimers) this.clearTimer(timer);
    this.notificationTimers.clear();
    this.scheduledLoopKeys.clear();
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
