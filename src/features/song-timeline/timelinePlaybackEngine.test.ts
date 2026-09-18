import { describe, expect, it, vi } from 'vitest';
import type { AudioContextLike, AudioParamLike, GainNodeLike, OscillatorNodeLike } from '@/features/metronome/metronomeEngine';
import { TimelinePlaybackEngine } from './timelinePlaybackEngine';
import type { CompiledTimeline } from './timelineCompiler';

class Param implements AudioParamLike {
  value = 0;
  setValueAtTime(value: number) { this.value = value; }
  exponentialRampToValueAtTime(value: number) { this.value = value; }
}
class Gain implements GainNodeLike { gain = new Param(); connect() {} }
class Oscillator implements OscillatorNodeLike {
  frequency = new Param(); type: OscillatorType = 'sine'; starts: number[] = []; stops: number[] = [];
  connect() {} start(time: number) { this.starts.push(time); } stop(time: number) { this.stops.push(time); }
}
class Context implements AudioContextLike {
  currentTime = 0; state: 'running' | 'suspended' = 'suspended'; destination = {}; oscillators: Oscillator[] = [];
  async resume() { this.state = 'running'; }
  createGain() { return new Gain(); }
  createOscillator() { const oscillator = new Oscillator(); this.oscillators.push(oscillator); return oscillator; }
}

const compiled: CompiledTimeline = {
  duration: 2,
  sections: [{ id: 'a', name: 'Intro', sectionIndex: 0, startTime: 0, endTime: 2, barDuration: 2, bars: 1, infinite: false, tempo: 120, numerator: 4, denominator: 4 }],
  events: [{ time: 0, sectionId: 'a', sectionIndex: 0, barIndex: 0, pulseIndex: 0, sound: 'accent', countIn: false }],
};

describe('TimelinePlaybackEngine', () => {
  it('uses audio time and preserves position across pause and resume', async () => {
    const context = new Context();
    const timers: Array<() => void> = [];
    const engine = new TimelinePlaybackEngine({
      createAudioContext: () => context,
      setTimer: vi.fn((callback: () => void) => { timers.push(callback); return timers.length as ReturnType<typeof window.setTimeout>; }),
      clearTimer: vi.fn(),
    });
    await engine.play(compiled);
    expect(context.oscillators).toHaveLength(1);
    context.currentTime = 0.8;
    engine.pause();
    expect(engine.snapshot.status).toBe('paused');
    expect(engine.snapshot.position).toBeCloseTo(0.75);
    await engine.play();
    expect(engine.snapshot.status).toBe('playing');
    engine.stop();
    expect(engine.snapshot).toMatchObject({ status: 'stopped', position: 0 });
  });

  it('keeps playing past the compiled duration of an infinite section', async () => {
    const infiniteCompiled: CompiledTimeline = {
      duration: 2,
      sections: [{ id: 'a', name: 'Intro', sectionIndex: 0, startTime: 0, endTime: 2, barDuration: 2, bars: 0, infinite: true, tempo: 120, numerator: 4, denominator: 4 }],
      events: [
        { time: 0, sectionId: 'a', sectionIndex: 0, barIndex: 0, pulseIndex: 0, sound: 'accent', countIn: false },
        { time: 0.5, sectionId: 'a', sectionIndex: 0, barIndex: 0, pulseIndex: 1, sound: 'normal', countIn: false },
      ],
    };
    const context = new Context();
    const timers: Array<() => void> = [];
    const engine = new TimelinePlaybackEngine({
      createAudioContext: () => context,
      setTimer: vi.fn((callback: () => void) => { timers.push(callback); return timers.length as ReturnType<typeof window.setTimeout>; }),
      clearTimer: vi.fn(),
      scheduleAheadSeconds: 3,
    });
    await engine.play(infiniteCompiled);
    expect(context.oscillators.length).toBeGreaterThan(2);
    context.currentTime = 3;
    for (const timer of [...timers]) timer();
    expect(engine.snapshot.status).toBe('playing');
    expect(engine.snapshot.loopBar).toBeGreaterThan(1);
  });
});
