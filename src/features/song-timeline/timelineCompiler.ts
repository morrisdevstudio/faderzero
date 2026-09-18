import { normalizeBeatSounds } from '@/features/metronome/metronomeEngine';
import type { SongTimelineRecord, TimelineSectionRecord, TimelineTempoUnit } from '@/db/schema';

export const TIMELINE_LIMITS = {
  tempo: { min: 20, max: 400 },
  bars: { min: 1, max: 999 },
  numerator: { min: 1, max: 32 },
  countInBars: { min: 0, max: 8 },
} as const;

const QUARTER_LENGTHS: Record<TimelineTempoUnit, number> = {
  quarter: 1,
  eighth: 0.5,
  dottedQuarter: 1.5,
  half: 2,
};

export type TimelineSound = 'accent' | 'normal' | 'low' | 'countIn';

export interface CompiledTimelineEvent {
  time: number;
  sectionId: string;
  sectionIndex: number;
  barIndex: number;
  pulseIndex: number;
  sound: TimelineSound;
  countIn: boolean;
}

export interface CompiledTimelineSection {
  id: string;
  name: string;
  sectionIndex: number;
  startTime: number;
  endTime: number;
  barDuration: number;
  bars: number;
  tempo: number;
  numerator: number;
  denominator: number;
}

export interface CompiledTimeline {
  duration: number;
  events: CompiledTimelineEvent[];
  sections: CompiledTimelineSection[];
}

export function clampTimelineNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)));
}

export function getBarDuration(section: Pick<TimelineSectionRecord, 'tempo' | 'tempoUnit' | 'numerator' | 'denominator'>) {
  const tempo = clampTimelineNumber(section.tempo, TIMELINE_LIMITS.tempo.min, TIMELINE_LIMITS.tempo.max);
  const quarterNotesPerBar = section.numerator * (4 / section.denominator);
  return quarterNotesPerBar * (60 / tempo) / QUARTER_LENGTHS[section.tempoUnit];
}

function addCountInEvents(
  events: CompiledTimelineEvent[],
  section: TimelineSectionRecord,
  sectionIndex: number,
  startTime: number,
  bars: number,
) {
  const barDuration = getBarDuration(section);
  const pulseDuration = barDuration / section.numerator;
  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    for (let pulseIndex = 0; pulseIndex < section.numerator; pulseIndex += 1) {
      events.push({
        time: startTime + barIndex * barDuration + pulseIndex * pulseDuration,
        sectionId: section.id,
        sectionIndex,
        barIndex: -bars + barIndex,
        pulseIndex,
        sound: pulseIndex === 0 ? 'accent' : 'countIn',
        countIn: true,
      });
    }
  }
}

export function compileTimeline(
  timeline: Pick<SongTimelineRecord, 'startCountInBars'>,
  sourceSections: TimelineSectionRecord[],
): CompiledTimeline {
  const sections = sourceSections
    .filter((section) => section.deletedAt === undefined)
    .sort((left, right) => left.position - right.position);
  if (sections.length === 0) return { duration: 0, events: [], sections: [] };

  const events: CompiledTimelineEvent[] = [];
  const compiledSections: CompiledTimelineSection[] = [];
  let cursor = 0;

  const firstSection = sections[0]!;
  const startCountInBars = clampTimelineNumber(timeline.startCountInBars, 0, TIMELINE_LIMITS.countInBars.max);
  if (startCountInBars > 0) {
    addCountInEvents(events, firstSection, 0, cursor, startCountInBars);
    cursor += getBarDuration(firstSection) * startCountInBars;
  }

  sections.forEach((section, sectionIndex) => {
    const bars = clampTimelineNumber(section.bars, TIMELINE_LIMITS.bars.min, TIMELINE_LIMITS.bars.max);
    const countInBars = clampTimelineNumber(section.countInBars, 0, TIMELINE_LIMITS.countInBars.max);
    const barDuration = getBarDuration(section);
    if (sectionIndex > 0 && section.countInMode === 'inserted' && countInBars > 0) {
      addCountInEvents(events, section, sectionIndex, cursor, countInBars);
      cursor += barDuration * countInBars;
    }

    const startTime = cursor;
    const endTime = startTime + bars * barDuration;
    compiledSections.push({
      id: section.id,
      name: section.name,
      sectionIndex,
      startTime,
      endTime,
      barDuration,
      bars,
      tempo: section.tempo,
      numerator: section.numerator,
      denominator: section.denominator,
    });

    if (section.clickEnabled) {
      const subdivision = section.subdivision ?? 1;
      const pulseDuration = barDuration / section.numerator / subdivision;
      const beatSounds = normalizeBeatSounds(section.beatSounds, section.numerator, subdivision);
      for (let barIndex = 0; barIndex < bars; barIndex += 1) {
        for (let pulseIndex = 0; pulseIndex * pulseDuration < barDuration - 0.000_001; pulseIndex += 1) {
          const beatIndex = Math.floor(pulseIndex / subdivision);
          const subdivisionIndex = pulseIndex % subdivision;
          const soundType = beatSounds[beatIndex]?.[subdivisionIndex] ?? 1;
          events.push({
            time: startTime + barIndex * barDuration + pulseIndex * pulseDuration,
            sectionId: section.id,
            sectionIndex,
            barIndex,
            pulseIndex,
            sound: soundType === 0 ? 'accent' : soundType === 2 ? 'low' : 'normal',
            countIn: false,
          });
        }
      }
    }

    if (sectionIndex > 0 && section.countInMode === 'overlay' && countInBars > 0) {
      const overlayDuration = Math.min(startTime, barDuration * countInBars);
      const overlayStart = startTime - overlayDuration;
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index]!;
        if (!event.countIn && event.time >= overlayStart && event.time < startTime) events.splice(index, 1);
      }
      const effectiveBars = Math.floor(overlayDuration / barDuration);
      if (effectiveBars > 0) addCountInEvents(events, section, sectionIndex, overlayStart, effectiveBars);
    }

    cursor = endTime;
  });

  events.sort((left, right) => left.time - right.time);
  return { duration: cursor, events, sections: compiledSections };
}

export function getTimelinePosition(compiled: CompiledTimeline, time: number) {
  const safeTime = Math.min(compiled.duration, Math.max(0, time));
  const section = compiled.sections.find((candidate) => safeTime < candidate.endTime)
    ?? compiled.sections.at(-1);
  if (!section) return null;
  const elapsed = Math.max(0, safeTime - section.startTime);
  return {
    section,
    barIndex: Math.min(section.bars - 1, Math.floor(elapsed / section.barDuration)),
    progress: section.endTime === section.startTime ? 1 : elapsed / (section.endTime - section.startTime),
  };
}
