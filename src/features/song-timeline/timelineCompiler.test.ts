import { describe, expect, it } from 'vitest';
import type { TimelineSectionRecord } from '@/db/schema';
import { compileTimeline, getBarDuration, getTimelinePosition } from './timelineCompiler';

function section(patch: Partial<TimelineSectionRecord> = {}): TimelineSectionRecord {
  return {
    id: 'section-1', timelineId: 'timeline-1', workspaceId: 'workspace-1', position: 0,
    name: 'Intro', bars: 2, tempo: 120, numerator: 4, denominator: 4, tempoUnit: 'quarter',
    clickEnabled: true, accentFirstBeat: true, clickResolution: 'denominator', subdivision: 1, beatSounds: [[0], [1], [1], [1]], countInMode: 'none',
    countInBars: 0, createdAt: 1, updatedAt: 1, ...patch,
  };
}

describe('timelineCompiler', () => {
  it('compiles bars and a starting count-in on absolute audio time', () => {
    const compiled = compileTimeline({ startCountInBars: 1 }, [section()]);
    expect(getBarDuration(section())).toBe(2);
    expect(compiled.duration).toBe(6);
    expect(compiled.events).toHaveLength(12);
    expect(compiled.sections[0]).toMatchObject({ startTime: 2, endTime: 6 });
    expect(compiled.events[0]).toMatchObject({ time: 0, countIn: true, sound: 'accent' });
  });

  it('supports compound meters and subdivisions with per-pulse sounds', () => {
    const compound = section({ numerator: 6, denominator: 8, tempo: 60, tempoUnit: 'dottedQuarter', bars: 1 });
    const denominator = compileTimeline({ startCountInBars: 0 }, [compound]);
    const subdivided = compileTimeline({ startCountInBars: 0 }, [{ ...compound, subdivision: 3, beatSounds: [[0, 2, 2], [1, 2, 2], [1, 2, 2], [1, 2, 2], [1, 2, 2], [1, 2, 2]] }]);
    expect(getBarDuration(compound)).toBe(2);
    expect(denominator.events).toHaveLength(6);
    expect(subdivided.events).toHaveLength(18);
    expect(subdivided.events[1]).toMatchObject({ sound: 'low' });
  });

  it('inserts count-ins and exposes the current section and bar', () => {
    const compiled = compileTimeline({ startCountInBars: 0 }, [
      section(),
      section({ id: 'section-2', position: 1, name: 'Couplet', bars: 1, countInMode: 'inserted', countInBars: 1 }),
    ]);
    expect(compiled.sections[1]).toMatchObject({ startTime: 6, endTime: 8 });
    expect(getTimelinePosition(compiled, 7.1)?.section.name).toBe('Couplet');
    expect(getTimelinePosition(compiled, 7.1)?.barIndex).toBe(0);
  });
});
