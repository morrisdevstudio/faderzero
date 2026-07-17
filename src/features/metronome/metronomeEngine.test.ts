import { describe, expect, it, vi } from 'vitest';
import {
  clampBeatsPerBar,
  clampBpm,
  MetronomeEngine,
  type AudioContextLike,
  type AudioParamLike,
  type GainNodeLike,
  type OscillatorNodeLike,
} from '@/features/metronome/metronomeEngine';

class FakeAudioParam implements AudioParamLike {
  value = 0;
  readonly events: Array<{ type: string; value: number; time: number }> = [];

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: 'ramp', value, time });
  }
}

class FakeGainNode implements GainNodeLike {
  gain = new FakeAudioParam();

  connect(_destination: object) {}
}

class FakeOscillatorNode implements OscillatorNodeLike {
  frequency = new FakeAudioParam();
  type: OscillatorType = 'sine';
  readonly starts: number[] = [];
  readonly stops: number[] = [];

  connect(_destination: GainNodeLike) {}

  start(time: number) {
    this.starts.push(time);
  }

  stop(time: number) {
    this.stops.push(time);
  }
}

class FakeAudioContext implements AudioContextLike {
  currentTime = 0;
  state: 'running' | 'suspended' | 'closed' | 'interrupted' = 'suspended';
  destination = {};
  readonly oscillators: FakeOscillatorNode[] = [];

  async resume() {
    this.state = 'running';
  }

  createGain() {
    return new FakeGainNode();
  }

  createOscillator() {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

describe('metronomeEngine', () => {
  it('clamps bpm and beats per bar into safe ranges', () => {
    expect(clampBpm(12)).toBe(30);
    expect(clampBpm(241)).toBe(240);
    expect(clampBpm(121.2)).toBe(121);
    expect(clampBeatsPerBar(0)).toBe(1);
    expect(clampBeatsPerBar(15)).toBe(12);
  });

  it('schedules accented and regular beats against audio time', async () => {
    const audioContext = new FakeAudioContext();
    const scheduledCallbacks: Array<{ callback: () => void; delayMs: number }> = [];
    const beatEvents: number[] = [];

    const engine = new MetronomeEngine({
      createAudioContext: () => audioContext,
      lookaheadMs: 25,
      scheduleAheadTime: 0.15,
      setTimer: vi.fn((callback: () => void, delayMs: number) => {
        scheduledCallbacks.push({ callback, delayMs });
        return scheduledCallbacks.length as ReturnType<typeof window.setTimeout>;
      }),
      clearTimer: vi.fn(),
    });

    engine.setBeatListener((event) => {
      beatEvents.push(event.beatInBar);
    });

    await engine.start({ bpm: 120, beatsPerBar: 4 });

    expect(audioContext.state).toBe('running');
    expect(audioContext.oscillators).toHaveLength(1);
    expect(audioContext.oscillators[0]?.frequency.events[0]).toMatchObject({ value: 1760, time: 0.05 });

    audioContext.currentTime = 0.45;
    runNextSchedulerTick(scheduledCallbacks);

    expect(audioContext.oscillators).toHaveLength(2);
    expect(audioContext.oscillators[1]?.frequency.events[0]).toMatchObject({ value: 1320, time: 0.55 });

    runDueBeatCallbacks(scheduledCallbacks);

    expect(beatEvents).toEqual([0, 1]);
  });

  it('uses updated bpm for future scheduling without restarting the engine', async () => {
    const audioContext = new FakeAudioContext();
    const scheduledCallbacks: Array<{ callback: () => void; delayMs: number }> = [];

    const engine = new MetronomeEngine({
      createAudioContext: () => audioContext,
      lookaheadMs: 25,
      scheduleAheadTime: 0.15,
      setTimer: vi.fn((callback: () => void, delayMs: number) => {
        scheduledCallbacks.push({ callback, delayMs });
        return scheduledCallbacks.length as ReturnType<typeof window.setTimeout>;
      }),
      clearTimer: vi.fn(),
    });

    await engine.start({ bpm: 120, beatsPerBar: 4 });
    engine.updateConfig({ bpm: 60 });

    audioContext.currentTime = 0.45;
    runNextSchedulerTick(scheduledCallbacks);

    expect(audioContext.oscillators[1]?.starts[0]).toBe(0.55);

    audioContext.currentTime = 1.45;
    runNextSchedulerTick(scheduledCallbacks);

    expect(audioContext.oscillators[2]?.starts[0]).toBe(1.55);
  });

  it('stops pending callbacks when the engine is stopped', async () => {
    const audioContext = new FakeAudioContext();
    const scheduledCallbacks: Array<{ callback: () => void; delayMs: number }> = [];
    const beatListener = vi.fn();

    const engine = new MetronomeEngine({
      createAudioContext: () => audioContext,
      setTimer: vi.fn((callback: () => void, delayMs: number) => {
        scheduledCallbacks.push({ callback, delayMs });
        return scheduledCallbacks.length as ReturnType<typeof window.setTimeout>;
      }),
      clearTimer: vi.fn(),
    });

    engine.setBeatListener(beatListener);

    await engine.start({ bpm: 120, beatsPerBar: 4 });
    engine.stop();

    scheduledCallbacks.splice(0).forEach(({ callback }) => callback());

    expect(beatListener).not.toHaveBeenCalled();
    expect(engine.running).toBe(false);
  });
});

function runNextSchedulerTick(queue: Array<{ callback: () => void; delayMs: number }>) {
  const schedulerIndex = queue.findIndex((entry) => entry.delayMs === 25);
  const schedulerEntry = schedulerIndex >= 0 ? queue.splice(schedulerIndex, 1)[0] : undefined;

  schedulerEntry?.callback();
}

function runDueBeatCallbacks(queue: Array<{ callback: () => void; delayMs: number }>) {
  const dueCallbacks = queue.filter((entry) => entry.delayMs !== 25);

  queue.splice(0, queue.length, ...queue.filter((entry) => entry.delayMs === 25));
  dueCallbacks.forEach(({ callback }) => callback());
}
