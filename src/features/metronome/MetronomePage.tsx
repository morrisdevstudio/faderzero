import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FeatureCard } from '@/components/FeatureCard';
import { PickerDialog, WheelColumn } from '@/components/PickerDialog';
import { setlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import {
  clampBeatsPerBar,
  clampBpm,
  clampSubdivision,
  getDefaultBeatSounds,
  normalizeBeatSounds,
  MetronomeEngine,
} from '@/features/metronome/metronomeEngine';
import { bpmOptions, formatSetDuration, formatSongDuration, getSongStatusLabel, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { ContentRow } from '@/ui/components/ContentRow';
import { PageHeader } from '@/ui/components/PageHeader';
import { StatusPill } from '@/ui/components/StatusPill';
import { Button } from '@/ui/components/Button';
import { FzIcon } from '@/ui/icons';
import { useNavigate } from 'react-router-dom';
import { songTimelinesRepository, type SongTimelineBundle } from '@/db/repositories/songTimelinesRepository';
import type { TimelineSectionRecord } from '@/db/schema';
import { compileTimeline, getTimelinePosition, type CompiledTimelineEvent } from '@/features/song-timeline/timelineCompiler';
import { TimelinePlaybackEngine, type TimelinePlaybackSnapshot } from '@/features/song-timeline/timelinePlaybackEngine';
import { StructureLockedTempoNotice } from '@/features/song-timeline/StructureLockedTempoNotice';

const TAP_MEMORY = 5;

export type MetronomeSubdivision = 1 | 2 | 3 | 4 | 5 | 6;

const subdivisionOptions: Array<{ value: MetronomeSubdivision; symbol: string; label: string }> = [
  { value: 1, symbol: '♩', label: 'Noire' },
  { value: 2, symbol: '♫', label: 'Croches' },
  { value: 3, symbol: '3', label: 'Triolets' },
  { value: 4, symbol: '♬', label: 'Doubles' },
  { value: 5, symbol: '5', label: 'Quintolets' },
  { value: 6, symbol: '6', label: 'Sextolets' },
];



export function SubdivisionIcon({ value, className = 'h-7 w-7' }: { value: MetronomeSubdivision; className?: string }) {
  switch (value) {
    case 1:
      // Quarter Note (Noire)
      return (
        <svg viewBox="0 0 36 36" fill="currentColor" className={className} aria-hidden="true">
          <ellipse cx="14" cy="24" rx="4.5" ry="3" transform="rotate(-20 14 24)" fill="currentColor" />
          <line x1="18" y1="23.5" x2="18" y2="8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 2:
      // Eighth Notes (Croches)
      return (
        <svg viewBox="0 0 36 36" fill="currentColor" className={className} aria-hidden="true">
          <ellipse cx="10" cy="24" rx="3.8" ry="2.6" transform="rotate(-20 10 24)" fill="currentColor" />
          <ellipse cx="23" cy="24" rx="3.8" ry="2.6" transform="rotate(-20 23 24)" fill="currentColor" />
          <line x1="13.2" y1="23.5" x2="13.2" y2="10" stroke="currentColor" strokeWidth="2" />
          <line x1="26.2" y1="23.5" x2="26.2" y2="10" stroke="currentColor" strokeWidth="2" />
          <line x1="13.2" y1="10" x2="26.2" y2="10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="butt" />
        </svg>
      );
    case 3:
      // Triolet (3 notes + arc + "3")
      return (
        <svg viewBox="0 0 36 36" fill="currentColor" className={className} aria-hidden="true">
          <ellipse cx="7" cy="25" rx="3.2" ry="2.2" transform="rotate(-20 7 25)" fill="currentColor" />
          <ellipse cx="17" cy="25" rx="3.2" ry="2.2" transform="rotate(-20 17 25)" fill="currentColor" />
          <ellipse cx="27" cy="25" rx="3.2" ry="2.2" transform="rotate(-20 27 25)" fill="currentColor" />
          <line x1="9.7" y1="24.5" x2="9.7" y2="14" stroke="currentColor" strokeWidth="1.8" />
          <line x1="19.7" y1="24.5" x2="19.7" y2="14" stroke="currentColor" strokeWidth="1.8" />
          <line x1="29.7" y1="24.5" x2="29.7" y2="14" stroke="currentColor" strokeWidth="1.8" />
          <line x1="9.7" y1="13.5" x2="29.7" y2="13.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="butt" />
          <path d="M 6.5 11 Q 19.7 5.5 32.9 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <text x="19.7" y="6" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="currentColor" style={{ fontFamily: 'sans-serif' }}>3</text>
        </svg>
      );
    case 4:
      // Sixteenth Notes (Doubles croches)
      return (
        <svg viewBox="0 0 36 36" fill="currentColor" className={className} aria-hidden="true">
          <ellipse cx="6" cy="25" rx="2.8" ry="2" transform="rotate(-20 6 25)" fill="currentColor" />
          <ellipse cx="13.5" cy="25" rx="2.8" ry="2" transform="rotate(-20 13.5 25)" fill="currentColor" />
          <ellipse cx="21" cy="25" rx="2.8" ry="2" transform="rotate(-20 21 25)" fill="currentColor" />
          <ellipse cx="28.5" cy="25" rx="2.8" ry="2" transform="rotate(-20 28.5 25)" fill="currentColor" />
          <line x1="8.3" y1="24.5" x2="8.3" y2="12" stroke="currentColor" strokeWidth="1.6" />
          <line x1="15.8" y1="24.5" x2="15.8" y2="12" stroke="currentColor" strokeWidth="1.6" />
          <line x1="23.3" y1="24.5" x2="23.3" y2="12" stroke="currentColor" strokeWidth="1.6" />
          <line x1="30.8" y1="24.5" x2="30.8" y2="12" stroke="currentColor" strokeWidth="1.6" />
          <line x1="8.3" y1="11.5" x2="30.8" y2="11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="butt" />
          <line x1="8.3" y1="15.5" x2="30.8" y2="15.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="butt" />
        </svg>
      );
    case 5:
      // Quintolet (5 notes + arc + "5")
      return (
        <svg viewBox="0 0 36 36" fill="currentColor" className={className} aria-hidden="true">
          <ellipse cx="5" cy="26" rx="2.4" ry="1.7" transform="rotate(-20 5 26)" fill="currentColor" />
          <ellipse cx="11" cy="26" rx="2.4" ry="1.7" transform="rotate(-20 11 26)" fill="currentColor" />
          <ellipse cx="17" cy="26" rx="2.4" ry="1.7" transform="rotate(-20 17 26)" fill="currentColor" />
          <ellipse cx="23" cy="26" rx="2.4" ry="1.7" transform="rotate(-20 23 26)" fill="currentColor" />
          <ellipse cx="29" cy="26" rx="2.4" ry="1.7" transform="rotate(-20 29 26)" fill="currentColor" />
          <line x1="7" y1="25.5" x2="7" y2="14" stroke="currentColor" strokeWidth="1.4" />
          <line x1="13" y1="25.5" x2="13" y2="14" stroke="currentColor" strokeWidth="1.4" />
          <line x1="19" y1="25.5" x2="19" y2="14" stroke="currentColor" strokeWidth="1.4" />
          <line x1="25" y1="25.5" x2="25" y2="14" stroke="currentColor" strokeWidth="1.4" />
          <line x1="31" y1="25.5" x2="31" y2="14" stroke="currentColor" strokeWidth="1.4" />
          <line x1="7" y1="13.5" x2="31" y2="13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" />
          <line x1="7" y1="17" x2="31" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" />
          <path d="M 5 11.5 Q 19 6 33 11.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <text x="19" y="6.5" textAnchor="middle" fontSize="6.2" fontWeight="900" fill="currentColor" style={{ fontFamily: 'sans-serif' }}>5</text>
        </svg>
      );
    case 6:
      // Sextolet (6 notes + arc + "6")
      return (
        <svg viewBox="0 0 36 36" fill="currentColor" className={className} aria-hidden="true">
          <ellipse cx="4.5" cy="26" rx="2.1" ry="1.5" transform="rotate(-20 4.5 26)" fill="currentColor" />
          <ellipse cx="9.8" cy="26" rx="2.1" ry="1.5" transform="rotate(-20 9.8 26)" fill="currentColor" />
          <ellipse cx="15.1" cy="26" rx="2.1" ry="1.5" transform="rotate(-20 15.1 26)" fill="currentColor" />
          <ellipse cx="20.4" cy="26" rx="2.1" ry="1.5" transform="rotate(-20 20.4 26)" fill="currentColor" />
          <ellipse cx="25.7" cy="26" rx="2.1" ry="1.5" transform="rotate(-20 25.7 26)" fill="currentColor" />
          <ellipse cx="31" cy="26" rx="2.1" ry="1.5" transform="rotate(-20 31 26)" fill="currentColor" />
          <line x1="6.3" y1="25.5" x2="6.3" y2="14" stroke="currentColor" strokeWidth="1.3" />
          <line x1="11.6" y1="25.5" x2="11.6" y2="14" stroke="currentColor" strokeWidth="1.3" />
          <line x1="16.9" y1="25.5" x2="16.9" y2="14" stroke="currentColor" strokeWidth="1.3" />
          <line x1="22.2" y1="25.5" x2="22.2" y2="14" stroke="currentColor" strokeWidth="1.3" />
          <line x1="27.5" y1="25.5" x2="27.5" y2="14" stroke="currentColor" strokeWidth="1.3" />
          <line x1="32.8" y1="25.5" x2="32.8" y2="14" stroke="currentColor" strokeWidth="1.3" />
          <line x1="6.3" y1="13.5" x2="32.8" y2="13.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="butt" />
          <line x1="6.3" y1="17" x2="32.8" y2="17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="butt" />
          <path d="M 4.5 11.5 Q 19.05 6 33.6 11.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <text x="19.05" y="6.5" textAnchor="middle" fontSize="6.2" fontWeight="900" fill="currentColor" style={{ fontFamily: 'sans-serif' }}>6</text>
        </svg>
      );
  }
}

export function SubdivisionSelector({
  value,
  onChange,
  compact = false,
}: {
  value: MetronomeSubdivision;
  onChange: (value: MetronomeSubdivision) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">
        Subdivision
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Subdivision du temps">
        {subdivisionOptions.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={isSelected}
              aria-label={option.label}
              className={[
                'flex flex-col items-center justify-center rounded-xl border font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70',
                compact ? 'min-h-12 px-1 py-1.5' : 'min-h-16 px-2 py-2',
                isSelected
                  ? 'border-cyan-300/55 bg-cyan-300/15 text-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.12)]'
                  : 'border-white/8 bg-white/5 text-white/55 hover:border-white/20 hover:text-white',
              ].join(' ')}
            >
              <SubdivisionIcon value={option.value} className={compact ? 'h-6 w-6' : 'h-8 w-8'} />
              {!compact ? <span className="mt-1 text-[0.58rem] uppercase tracking-wide">{option.label}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SOUND_CONFIGS = [
  {
    name: 'aigu',
    label: 'Son aigu',
    idleClass: 'border-amber-500/40 bg-amber-500/20 hover:border-amber-400/60 hover:bg-amber-500/30 text-amber-300',
    activeMainClass: 'border-amber-300 bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.8)]',
    activeSubClass: 'border-amber-300/60 bg-amber-300/70 shadow-[0_0_16px_rgba(252,211,77,0.4)]',
  },
  {
    name: 'médium',
    label: 'Son médium',
    idleClass: 'border-sky-400/40 bg-sky-500/20 hover:border-sky-300/60 hover:bg-sky-500/30 text-sky-300',
    activeMainClass: 'border-sky-200 bg-sky-300 shadow-[0_0_24px_rgba(56,189,248,0.8)]',
    activeSubClass: 'border-sky-300/60 bg-sky-300/70 shadow-[0_0_16px_rgba(56,189,248,0.4)]',
  },
  {
    name: 'grave',
    label: 'Son grave',
    idleClass: 'border-fuchsia-400/40 bg-fuchsia-500/20 hover:border-fuchsia-300/60 hover:bg-fuchsia-500/30 text-fuchsia-300',
    activeMainClass: 'border-fuchsia-200 bg-fuchsia-300 shadow-[0_0_24px_rgba(232,121,249,0.8)]',
    activeSubClass: 'border-fuchsia-300/60 bg-fuchsia-300/70 shadow-[0_0_16px_rgba(232,121,249,0.4)]',
  },
] as const;

export function MetronomeBeatGrid({
  engine,
  beatsPerBar,
  subdivision,
  beatSounds,
  onCycleSubdivisionSound,
  isRunning,
  heightClass = 'h-7 sm:h-8',
  activeBeat: controlledBeat,
  activeSubdivision: controlledSubdivision,
}: {
  engine?: MetronomeEngine | null;
  beatsPerBar: number;
  subdivision: MetronomeSubdivision;
  beatSounds: number[][];
  onCycleSubdivisionSound?: ((beatIndex: number, subdivisionIndex: number) => void) | undefined;
  isRunning: boolean;
  heightClass?: string;
  activeBeat?: number;
  activeSubdivision?: number;
}) {
  const [internalBeat, setInternalBeat] = useState(0);
  const [internalSubdivision, setInternalSubdivision] = useState(0);
  const isControlled = controlledBeat !== undefined;
  const activeBeat = isControlled ? controlledBeat : internalBeat;
  const activeSubdivision = isControlled ? (controlledSubdivision ?? 0) : internalSubdivision;

  useEffect(() => {
    if (!engine || isControlled) return;
    engine.setBeatListener(({ beatInBar, subdivisionInBeat }) => {
      setInternalBeat(beatInBar);
      setInternalSubdivision(subdivisionInBeat);
    });
    return () => {
      engine.setBeatListener(null);
    };
  }, [engine, isControlled]);

  useEffect(() => {
    if (isControlled || isRunning) return;
    setInternalBeat(0);
    setInternalSubdivision(0);
  }, [isControlled, isRunning]);

  const beatSlots = useMemo(() => Array.from({ length: beatsPerBar }, (_, index) => index), [beatsPerBar]);
  const subdivisionSlots = useMemo(() => Array.from({ length: subdivision }, (_, index) => index), [subdivision]);

  return (
    <div
      className="grid gap-2"
      role="group"
      aria-label="Grille des temps du métronome"
      style={{ gridTemplateColumns: `repeat(${beatsPerBar}, minmax(0, 1fr))` }}
    >
      {beatSlots.map((slot) => {
        return (
          <div
            key={slot}
            className={`grid ${heightClass} gap-1`}
            style={{ gridTemplateColumns: `repeat(${subdivision}, minmax(0, 1fr))` }}
          >
            {subdivisionSlots.map((subdivisionSlot) => {
              const soundType = (beatSounds[slot]?.[subdivisionSlot] ?? (subdivisionSlot === 0 ? (slot === 0 ? 0 : 1) : 2)) % 3;
              const config = SOUND_CONFIGS[soundType] ?? SOUND_CONFIGS[0];
              const isActive = slot === activeBeat && subdivisionSlot === activeSubdivision && isRunning;

              return (
                <button
                  key={subdivisionSlot}
                  type="button"
                  disabled={!onCycleSubdivisionSound}
                  onClick={() => onCycleSubdivisionSound?.(slot, subdivisionSlot)}
                  title={`Temps ${slot + 1}${subdivision > 1 ? `.${subdivisionSlot + 1}` : ''} : ${config.label} (cliquer pour changer)`}
                  aria-label={`Temps ${slot + 1}${subdivision > 1 ? ` subdivision ${subdivisionSlot + 1}` : ''} : ${config.label}. Cliquer pour changer.`}
                  className={[
                    'h-full w-full rounded-lg border transition-all duration-75 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                    onCycleSubdivisionSound ? 'cursor-pointer' : 'cursor-default',
                    isActive
                      ? config.activeMainClass
                      : config.idleClass,
                  ].join(' ')}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function MetronomePage() {
  const navigate = useNavigate();
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const engineRef = useRef<MetronomeEngine | null>(null);
  const timelineEngineRef = useRef<TimelinePlaybackEngine | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  const [bpm, setBpm] = useState(120);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [subdivision, setSubdivision] = useState<MetronomeSubdivision>(1);
  const [beatSounds, setBeatSounds] = useState<number[][]>(() => getDefaultBeatSounds(4, 1));
  const [isRunning, setIsRunning] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isTempoPickerOpen, setIsTempoPickerOpen] = useState(false);
  const [isTimeSignaturePickerOpen, setIsTimeSignaturePickerOpen] = useState(false);
  const [isSubdivisionPickerOpen, setIsSubdivisionPickerOpen] = useState(false);
  const [draftBpm, setDraftBpm] = useState(120);
  const [draftBeatsPerBar, setDraftBeatsPerBar] = useState(4);

  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [editingBpmSongId, setEditingBpmSongId] = useState<string | null>(null);
  const [structureEnabledOverride, setStructureEnabledOverride] = useState<boolean | null>(null);
  const [programmedBundle, setProgrammedBundle] = useState<SongTimelineBundle | null>(null);
  const [timelineSnapshot, setTimelineSnapshot] = useState<TimelinePlaybackSnapshot>({ status: 'stopped', position: 0 });
  const [timelineEvent, setTimelineEvent] = useState<CompiledTimelineEvent | undefined>();

  const setlists = useLiveQuery(() => setlistsRepository.listSummaries(), [activeWorkspaceId]);
  const songs = useLiveQuery(() => songsRepository.list(), [activeWorkspaceId]);
  const programmedBpmsQuery = useLiveQuery(() => songTimelinesRepository.listProgrammedAverageBpms(activeWorkspaceId ?? 'default-workspace'), [activeWorkspaceId]);
  const programmedBpms = programmedBpmsQuery ?? {};
  const programmedSongIdSet = useMemo(() => new Set(Object.keys(programmedBpms)), [programmedBpms]);
  const inactiveStructureSongIds = useLiveQuery(() => songTimelinesRepository.listInactiveStructureSongIds(activeWorkspaceId ?? 'default-workspace'), [activeWorkspaceId]) ?? [];
  const inactiveStructureSongIdSet = useMemo(() => new Set(inactiveStructureSongIds), [inactiveStructureSongIds]);
  const setlistSongs = useLiveQuery(
    () => (selectedSetlistId ? setlistSongsRepository.listDetailedBySetlistId(selectedSetlistId) : Promise.resolve([])),
    [selectedSetlistId, activeWorkspaceId]
  );
  const currentSetlist = useMemo(
    () => setlists?.find((item) => item.id === selectedSetlistId),
    [setlists, selectedSetlistId]
  );
  const compiledTimeline = useMemo(
    () => (programmedBundle ? compileTimeline(programmedBundle.timeline, programmedBundle.sections) : null),
    [programmedBundle],
  );
  const timelinePosition = compiledTimeline ? getTimelinePosition(compiledTimeline, timelineSnapshot.position) : null;
  const currentProgrammedSection = programmedBundle && timelinePosition
    ? programmedBundle.sections.find((section) => section.id === timelinePosition.section.id) ?? programmedBundle.sections[timelinePosition.section.sectionIndex]
    : programmedBundle?.sections[0];
  const isProgrammedMode = Boolean(programmedBundle?.sections.length && programmedBundle.timeline.enabled !== false);
  const displayBpm = currentProgrammedSection?.tempo ?? bpm;
  const displayBeatsPerBar = currentProgrammedSection?.numerator ?? beatsPerBar;
  const displaySubdivision = (currentProgrammedSection?.subdivision ?? subdivision) as MetronomeSubdivision;
  const displayBeatSounds = currentProgrammedSection
    ? normalizeBeatSounds(currentProgrammedSection.beatSounds, displayBeatsPerBar, displaySubdivision)
    : beatSounds;
  const programmedActiveBeat = timelineEvent
    ? (timelineEvent.countIn ? timelineEvent.pulseIndex : Math.floor(timelineEvent.pulseIndex / displaySubdivision))
    : 0;
  const programmedActiveSubdivision = timelineEvent && !timelineEvent.countIn ? timelineEvent.pulseIndex % displaySubdivision : 0;
  const programmedSectionIndex = timelinePosition?.section.sectionIndex ?? 0;

  const currentIndex = useMemo(() => {
    if (!setlistSongs || !selectedSongId) return -1;
    return setlistSongs.findIndex((song) => song.songId === selectedSongId);
  }, [setlistSongs, selectedSongId]);

  const previousSong = useMemo(() => {
    if (!setlistSongs || currentIndex <= 0) return undefined;
    return setlistSongs[currentIndex - 1];
  }, [setlistSongs, currentIndex]);

  const nextSong = useMemo(() => {
    if (!setlistSongs || currentIndex < 0 || currentIndex >= setlistSongs.length - 1) return undefined;
    return setlistSongs[currentIndex + 1];
  }, [setlistSongs, currentIndex]);

  useEffect(() => {
    const firstSong = setlistSongs?.[0];
    if (isLiveViewOpen && firstSong && !selectedSongId) {
      setSelectedSongId(firstSong.songId);
      if (firstSong.songBpm && firstSong.songBpm > 0) {
        setBpm(clampBpm(firstSong.songBpm));
      }
    }
  }, [isLiveViewOpen, setlistSongs, selectedSongId]);

  const navigationButtonClass =
    "pointer-events-auto relative isolate flex min-h-16 items-center gap-2.5 rounded-xl border border-white/10 bg-[#111318] px-3.5 py-2 text-xs font-black text-white/70 transition before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-xl before:bg-black/45 before:blur-2xl before:backdrop-blur-lg before:content-[''] hover:bg-[#1a1d22] hover:text-white active:bg-[#20242a] disabled:cursor-not-allowed disabled:opacity-35";

  if (engineRef.current === null) {
    engineRef.current = new MetronomeEngine();
  }
  if (timelineEngineRef.current === null) {
    timelineEngineRef.current = new TimelinePlaybackEngine();
  }

  useEffect(() => {
    const engine = engineRef.current;
    const timelineEngine = timelineEngineRef.current;
    return () => {
      engine?.stop();
      timelineEngine?.stop();
    };
  }, []);

  useEffect(() => {
    const timelineEngine = timelineEngineRef.current;
    if (!timelineEngine) return;
    timelineEngine.setListener((snapshot) => {
      setTimelineSnapshot(snapshot);
      if (snapshot.status === 'stopped' || snapshot.status === 'ended') {
        setTimelineEvent(undefined);
        setIsRunning(false);
      } else if (snapshot.event) {
        setTimelineEvent(snapshot.event);
      }
      if (snapshot.status === 'playing') setIsRunning(true);
      if (snapshot.status === 'paused') setIsRunning(false);
    });
    const ticker = window.setInterval(() => {
      if (timelineEngine.snapshot.status === 'playing') setTimelineSnapshot(timelineEngine.snapshot);
    }, 100);
    return () => {
      window.clearInterval(ticker);
      timelineEngine.setListener(null);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.updateConfig({ bpm });
  }, [bpm]);

  useEffect(() => {
    engineRef.current?.updateConfig({ beatsPerBar });
  }, [beatsPerBar]);

  useEffect(() => {
    engineRef.current?.updateConfig({ subdivision });
  }, [subdivision]);

  useEffect(() => {
    engineRef.current?.updateConfig({ beatSounds });
  }, [beatSounds]);

  function updateBpm(nextBpm: number) {
    setBpm(clampBpm(nextBpm));
  }

  function updateBeatsPerBarValue(nextValue: number) {
    const nextBeats = clampBeatsPerBar(nextValue);
    setBeatsPerBar(nextBeats);
    setBeatSounds((prev) => normalizeBeatSounds(prev, nextBeats, subdivision));
  }

  function updateSubdivisionValue(nextValue: MetronomeSubdivision) {
    const nextSub = clampSubdivision(nextValue) as MetronomeSubdivision;
    setSubdivision(nextSub);
    setBeatSounds((prev) => normalizeBeatSounds(prev, beatsPerBar, nextSub));
  }

  function cycleSubdivisionSound(beatIndex: number, subdivisionIndex: number) {
    setBeatSounds((prev) => {
      const updated = prev.map((row) => [...row]);
      if (!updated[beatIndex]) {
        updated[beatIndex] = [];
      }
      const current =
        updated[beatIndex]![subdivisionIndex] ??
        (subdivisionIndex === 0 ? (beatIndex === 0 ? 0 : 1) : 2);
      updated[beatIndex]![subdivisionIndex] = (current + 1) % 3;
      return updated;
    });
  }

  function openTempoPicker(songId: string | null = null, initialBpm = bpm) {
    setStructureEnabledOverride(null);
    setEditingBpmSongId(songId);
    setDraftBpm(initialBpm);
    setIsTempoPickerOpen(true);
  }

  function openTimeSignaturePicker() {
    setDraftBeatsPerBar(beatsPerBar);
    setIsTimeSignaturePickerOpen(true);
  }

  async function handleConfirmTempo() {
    if (editingBpmSongId && programmedBpms[editingBpmSongId] !== undefined) {
      setIsTempoPickerOpen(false);
      setEditingBpmSongId(null);
      return;
    }
    updateBpm(draftBpm);
    if (editingBpmSongId) {
      await songsRepository.update(editingBpmSongId, { bpm: draftBpm });
    }
    setIsTempoPickerOpen(false);
    setEditingBpmSongId(null);
  }

  async function handleSetStructureEnabled(enabled: boolean) {
    const songId = editingBpmSongId;
    if (!songId) return;
    setStructureEnabledOverride(enabled);
    const bundle = await songTimelinesRepository.getBySongId(songId);
    if (!bundle) {
      setStructureEnabledOverride(null);
      return;
    }
    await songTimelinesRepository.updateTimeline(bundle.timeline.id, { enabled });
  }

  function handleConfirmTimeSignature() {
    updateBeatsPerBarValue(draftBeatsPerBar);
    setIsTimeSignaturePickerOpen(false);
  }

  async function handleTogglePlayback() {
    try {
      if (isProgrammedMode && compiledTimeline && programmedBundle) {
        const timelineEngine = timelineEngineRef.current;
        if (!timelineEngine) return;
        if (timelineSnapshot.status === 'playing') {
          timelineEngine.pause();
          setIsRunning(false);
          return;
        }
        engineRef.current?.stop();
        setAudioError(null);
        const atEnd = compiledTimeline.duration > 0 && timelineSnapshot.position >= compiledTimeline.duration - 0.05;
        const startAt = timelineSnapshot.status === 'ended' && atEnd
          ? 0
          : timelineSnapshot.status === 'stopped' && timelineSnapshot.position === 0
            ? 0
            : timelineSnapshot.position;
        await timelineEngine.play(compiledTimeline, startAt, programmedBundle.timeline.volume);
        setIsRunning(true);
        return;
      }

      const engine = engineRef.current;
      if (engine === null) {
        return;
      }

      if (isRunning) {
        engine.stop();
        setIsRunning(false);
      } else {
        timelineEngineRef.current?.stop();
        setAudioError(null);
        await engine.start({ bpm, beatsPerBar, subdivision, beatSounds });
        setIsRunning(true);
      }
    } catch {
      setAudioError("Impossible de démarrer l'audio sur cet appareil.");
      setIsRunning(false);
    }
  }

  function clearProgrammedPlayback() {
    timelineEngineRef.current?.stop();
    setProgrammedBundle(null);
    setTimelineEvent(undefined);
    setTimelineSnapshot({ status: 'stopped', position: 0 });
  }

  useEffect(() => {
    if (programmedBpmsQuery === undefined || !programmedBundle) return;
    const songId = programmedBundle.timeline.songId;
    if (programmedBundle.timeline.enabled === false || programmedBpms[songId] === undefined) {
      clearProgrammedPlayback();
      setIsRunning(false);
    }
  }, [programmedBpmsQuery, programmedBpms, programmedBundle]);

  async function startProgrammedSong(songId: string, autoplay = true) {
    setSelectedSongId(songId);
    engineRef.current?.stop();
    timelineEngineRef.current?.stop();
    try {
      const bundle = await songTimelinesRepository.getBySongId(songId);
      if (!bundle || bundle.sections.length === 0 || bundle.timeline.enabled === false) {
        clearProgrammedPlayback();
        return;
      }
      setProgrammedBundle(bundle);
      const compiled = compileTimeline(bundle.timeline, bundle.sections);
      const first = bundle.sections[0]!;
      const nextSub = clampSubdivision(first.subdivision) as MetronomeSubdivision;
      setBpm(clampBpm(first.tempo));
      setBeatsPerBar(clampBeatsPerBar(first.numerator));
      setSubdivision(nextSub);
      setBeatSounds(normalizeBeatSounds(first.beatSounds, first.numerator, nextSub));
      setTimelineSnapshot({ status: 'stopped', position: 0 });
      setTimelineEvent(undefined);
      setAudioError(null);
      if (!autoplay) {
        setIsRunning(false);
        return;
      }
      await timelineEngineRef.current?.play(compiled, 0, bundle.timeline.volume);
      setIsRunning(true);
    } catch {
      setAudioError("Impossible de démarrer l'audio sur cet appareil.");
      setIsRunning(false);
    }
  }

  async function seekProgrammed(position: number) {
    if (!compiledTimeline || !programmedBundle) return;
    const timelineEngine = timelineEngineRef.current;
    if (!timelineEngine) return;
    if (timelineSnapshot.status === 'playing' || timelineSnapshot.status === 'ended') {
      await timelineEngine.play(compiledTimeline, position, programmedBundle.timeline.volume);
      return;
    }
    await timelineEngine.seek(position);
  }

  async function jumpProgrammedSection(direction: -1 | 1) {
    if (!compiledTimeline || !timelinePosition) return;
    const target = compiledTimeline.sections[timelinePosition.section.sectionIndex + direction];
    if (target) await seekProgrammed(target.startTime);
  }

  async function playSongTempo(songBpm?: number, songId?: string) {
    clearProgrammedPlayback();
    if (songId) {
      setSelectedSongId(songId);
    }
    if (!songBpm || songBpm <= 0) {
      openTempoPicker(songId || null, bpm);
      return;
    }
    const nextBpm = clampBpm(songBpm);
    setBpm(nextBpm);
    const engine = engineRef.current;
    if (engine) {
      try {
        setAudioError(null);
        await engine.start({ bpm: nextBpm, beatsPerBar, subdivision, beatSounds });
        setIsRunning(true);
      } catch {
        setAudioError("Impossible de démarrer l'audio sur cet appareil.");
        setIsRunning(false);
      }
    }
  }

  function playOrOpenProgrammed(songId: string, songBpm?: number) {
    if (programmedSongIdSet.has(songId)) {
      void startProgrammedSong(songId);
      return;
    }
    void playSongTempo(songBpm, songId);
  }

  function startLongPress(songId: string, songBpm?: number) {
    isLongPressRef.current = false;
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      setSelectedSongId(songId);
      const targetBpm = songBpm && songBpm > 0 ? clampBpm(songBpm) : bpm;
      openTempoPicker(songId, targetBpm);
    }, 450);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleSongClick(songId: string, songBpm?: number) {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    setSelectedSongId(songId);

    if (programmedSongIdSet.has(songId)) {
      void startProgrammedSong(songId, isRunning);
      return;
    }

    clearProgrammedPlayback();

    if (songBpm && songBpm > 0) {
      if (isRunning) {
        void playSongTempo(songBpm, songId);
      } else {
        setBpm(clampBpm(songBpm));
      }
    } else if (isRunning) {
      openTempoPicker(songId, bpm);
    }
  }

  function handleTapTempo() {
    if (isProgrammedMode) {
      return;
    }
    const now = performance.now();
    const tapTimes = tapTimesRef.current.filter((time) => now - time < 2000);
    tapTimes.push(now);
    tapTimesRef.current = tapTimes.slice(-TAP_MEMORY);

    if (tapTimesRef.current.length < 2) {
      return;
    }

    const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]!);
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

    if (averageInterval <= 0) {
      return;
    }

    updateBpm(60000 / averageInterval);
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Zone fixe / sticky en haut */}
      <div
        className="sticky z-20 -mx-3 -mt-2 border-b border-white/8 bg-[var(--fz-bg)] px-3 pb-3 pt-2 transition-[top] duration-200 ease-out will-change-[top] before:pointer-events-none before:absolute before:bottom-full before:inset-x-0 before:h-32 before:bg-[var(--fz-bg)] before:content-[''] sm:-mx-4 sm:px-4"
        style={{
          top: 'calc(var(--fz-header-offset, var(--fz-header-height, 64px)) + var(--fz-viewport-offset-top, 0px))',
        }}
      >
        <PageHeader
          icon={<FzIcon name="metronome" usageId="page-header.metronome" size="xl" className="text-amber-400" />}
          title="Métronome"
        />

        <section aria-label="Contrôles du métronome" className="mt-3 rounded-[1.5rem] border border-white/10 bg-black/40 p-3 sm:p-4 shadow-xl">
          <div className="grid grid-cols-3 items-center gap-2">
            {/* Gauche : Bouton TAP + Tempo BPM */}
            <div className="flex items-center gap-2 justify-self-start">
              <button
                type="button"
                onClick={handleTapTempo}
                disabled={isProgrammedMode}
                aria-label="Tap tempo"
                className="flex h-11 px-3 items-center justify-center rounded-xl border border-white/10 bg-white/6 hover:bg-white/12 active:scale-95 text-xs font-black uppercase tracking-wider text-white transition shrink-0 disabled:cursor-not-allowed disabled:opacity-35"
                title={isProgrammedMode ? 'Tap indisponible sur un métronome programmé' : 'Taper pour calculer le tempo'}
              >
                TAP
              </button>
              <button
                type="button"
                onClick={() => openTempoPicker()}
                disabled={isProgrammedMode}
                className="group flex items-baseline gap-1 rounded-xl p-1 text-left transition hover:bg-white/6 focus-visible:outline-none disabled:hover:bg-transparent"
                title={isProgrammedMode ? 'Tempo de la section en cours' : 'Cliquer pour changer le tempo'}
              >
                <span className="text-3xl font-black tracking-tight text-white leading-none tabular-nums">{displayBpm}</span>
                <span className="text-[0.65rem] font-black uppercase tracking-wider text-[var(--fz-text-muted)] group-hover:text-white/80">BPM</span>
              </button>
            </div>

            {/* Centre : Bouton Play/Stop rond */}
            <div className="flex items-center justify-center justify-self-center">
              <button
                type="button"
                onClick={() => void handleTogglePlayback()}
                className={[
                  'flex h-12 w-12 items-center justify-center rounded-full transition transform active:scale-95 shadow-lg shrink-0',
                  isRunning
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.25)]',
                ].join(' ')}
                title={isRunning ? 'Stopper le métronome' : 'Lancer le métronome'}
              >
                {isRunning ? (
                  <FzIcon name="pause" usageId="metronome.play.pause" size="md" />
                ) : (
                  <FzIcon name="play" usageId="metronome.play.start" size="md" />
                )}
              </button>
            </div>

            {/* Droite : Signature 4/4 + Subdivision */}
            <div className="flex items-center gap-3 justify-self-end text-right">
              <button
                type="button"
                onClick={() => openTimeSignaturePicker()}
                disabled={isProgrammedMode}
                className="group rounded-xl p-1 text-right transition hover:bg-white/6 focus-visible:outline-none disabled:hover:bg-transparent"
                title={isProgrammedMode ? 'Signature de la section en cours' : 'Cliquer pour changer la signature rythmique'}
              >
                <span className="text-3xl font-black text-white leading-none tabular-nums">{displayBeatsPerBar}/4</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSubdivisionPickerOpen(true)}
                disabled={isProgrammedMode}
                className="group rounded-xl p-1 text-right transition hover:bg-white/6 flex items-center justify-center disabled:hover:bg-transparent"
                title={isProgrammedMode ? 'Subdivision de la section en cours' : 'Cliquer pour changer la subdivision'}
              >
                <SubdivisionIcon value={displaySubdivision} className="h-9 w-9 text-white" />
              </button>
            </div>
          </div>

          {/* Barres de pulsation compactes */}
          <div className="mt-3.5">
            <MetronomeBeatGrid
              engine={isProgrammedMode ? null : engineRef.current}
              beatsPerBar={displayBeatsPerBar}
              subdivision={displaySubdivision}
              beatSounds={displayBeatSounds}
              {...(isProgrammedMode
                ? { isRunning, activeBeat: programmedActiveBeat, activeSubdivision: programmedActiveSubdivision }
                : { isRunning, onCycleSubdivisionSound: cycleSubdivisionSound })}
            />
          </div>

          {isProgrammedMode && programmedBundle ? (
            <ProgrammedSectionControls
              sections={programmedBundle.sections}
              currentIndex={programmedSectionIndex}
              currentBar={timelineSnapshot.loopBar ?? (timelinePosition?.barIndex ?? 0) + 1}
              barCount={currentProgrammedSection?.bars ?? 1}
              onPrevious={() => void jumpProgrammedSection(-1)}
              onNext={() => void jumpProgrammedSection(1)}
            />
          ) : null}

          {audioError ? <p className="mt-2 text-center text-xs font-semibold text-rose-400">{audioError}</p> : null}
        </section>
      </div>

      <section aria-labelledby="metronome-setlists-title" className="space-y-3">
        <div>
          <div className="-mx-4 border-y border-white/10 bg-white/[0.035] px-5 py-5">
            <h2 id="metronome-setlists-title" className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              <FzIcon name="setlist" usageId="metronome.section.setlists" size="md" />
              Setlists
            </h2>
            <p className="mt-2 text-sm text-white/65">Lecture dans l'ordre défini dans la setlist.</p>
          </div>
        </div>

        {setlists === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture des setlists" description="Ouverture de la base locale..." />
        ) : setlists.length === 0 ? (
          <div className="fz-card-soft rounded-[1.2rem] px-4 py-5 text-sm text-[var(--fz-text-muted)]">
            Aucune setlist disponible.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {setlists.map((setlist) => (
              <ContentRow
                key={setlist.id}
                mode="button"
                onClick={() => {
                  setSelectedSongId(null);
                  setSelectedSetlistId(setlist.id);
                  setIsLiveViewOpen(true);
                }}
                title={setlist.name}
                metadata={`${setlist.songCount} morceau${setlist.songCount > 1 ? 'x' : ''} · ${formatSetDuration(setlist.totalDurationSeconds)}`}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="metronome-songs-title" className="space-y-3">
        <div>
          <div className="-mx-4 border-y border-white/10 bg-white/[0.035] px-5 py-5">
            <h2 id="metronome-songs-title" className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              <FzIcon name="songs" usageId="metronome.section.songs" size="md" />
              Chansons
            </h2>
            <p className="mt-2 text-sm text-white/65">Lecture de tout le répertoire par ordre alphabétique.</p>
          </div>
        </div>

        {songs === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture du répertoire" description="Ouverture de la base locale..." />
        ) : songs.length === 0 ? (
          <div className="fz-card-soft rounded-[1.2rem] px-4 py-5 text-sm text-[var(--fz-text-muted)]">
            Aucune chanson disponible.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {songs.map((song) => {
              const programmedBpm = programmedBpms[song.id];
              const isProgrammed = programmedBpm !== undefined;
              return (
              <ContentRow
                key={song.id}
                mode="button"
                onClick={() => playOrOpenProgrammed(song.id, song.bpm)}
                title={song.title || 'Sans titre'}
                metadata={
                  <>
                    {isProgrammed ? (
                      <ProgrammedBpmHighlight bpm={programmedBpm} />
                    ) : (
                      song.bpm ? `${song.bpm} BPM` : 'BPM --'
                    )}
                    {` · ${song.key || 'Ton --'} · ${formatSongDuration(song.durationSeconds)}`}
                  </>
                }
                status={<StatusPill label={getSongStatusLabel(song.status)} tone={getSongStatusTone(song.status)} />}
                {...(isProgrammed ? {
                  'aria-label': `Lancer le métronome programmé de ${song.title || 'Sans titre'}`,
                } : {})}
              />
              );
            })}
          </div>
        )}
      </section>

      {/* VUE EN PLEIN ÉCRAN TYPE PROMPTEUR POUR LA SETLIST */}
      {isLiveViewOpen ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--fz-bg)]">
          {/* Header identique au prompteur */}
          <header className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-[var(--fz-bg)]/98 backdrop-blur-sm">
            <div className="mx-auto w-full max-w-5xl px-4 pb-2 pt-3 sm:px-6">
              <div className="relative flex h-11 items-center">
                <button
                  type="button"
                  onClick={() => setIsLiveViewOpen(false)}
                  aria-label="Fermer le prompteur"
                  className="absolute left-0 z-10 flex h-11 w-11 items-center justify-center text-white/72 transition hover:text-white"
                >
                  <FzIcon name="close" usageId="metronome.live.close" size="md" />
                </button>

                <div className="pointer-events-none absolute inset-x-0 min-w-0 px-24 text-center">
                  <p className="truncate text-[0.72rem] font-black uppercase tracking-[0.26em] text-[var(--fz-text-muted)]">FaderZero</p>
                  <p className="mt-1 truncate text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55">
                    Métronome - {currentSetlist?.name ?? 'Setlist'}
                  </p>
                </div>

                <div className="absolute right-0 z-10 flex items-center">
                  <button
                    type="button"
                    onClick={() => void toggleFullscreen()}
                    aria-label="Plein écran"
                    className="flex h-11 w-11 items-center justify-center text-white/72 transition hover:text-white"
                  >
                    <FzIcon name="fullscreen" usageId="metronome.live.fullscreen" size="md" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Bloc Métronome fixe sous le header (Subheader sticky) */}
          <div className="sticky top-14 z-20 shrink-0 border-b border-white/10 bg-[var(--fz-bg)]/98 backdrop-blur-md px-4 pb-4 pt-3 sm:px-6">
            <div className="mx-auto max-w-2xl w-full">
              <section aria-label="Contrôle direct du métronome" className="rounded-[1.5rem] border border-white/10 bg-black/40 p-4 sm:p-5 shadow-2xl">
                <div className="grid grid-cols-3 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openTempoPicker()}
                    disabled={isProgrammedMode}
                    className="group flex items-baseline gap-1.5 rounded-xl p-1 text-left transition hover:bg-white/5 justify-self-start disabled:hover:bg-transparent"
                    title={isProgrammedMode ? 'Tempo de la section en cours' : 'Changer le tempo'}
                  >
                    <span className="text-4xl font-black tracking-tight text-white leading-none tabular-nums">{displayBpm}</span>
                    <span className="text-xs font-black uppercase tracking-wider text-[var(--fz-text-muted)] group-hover:text-white/80">BPM</span>
                  </button>

                    <div className="flex items-center justify-center justify-self-center">
                    <button
                      type="button"
                      onClick={() => void handleTogglePlayback()}
                      className={[
                        'flex h-14 w-14 items-center justify-center rounded-full transition transform active:scale-95 shadow-lg shrink-0',
                        isRunning
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30',
                      ].join(' ')}
                      title={isRunning ? 'Stopper le métronome' : 'Lancer le métronome'}
                    >
                      {isRunning ? (
                        <FzIcon name="pause" usageId="metronome.play.pause" size="lg" />
                      ) : (
                        <FzIcon name="play" usageId="metronome.play.start" size="lg" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 justify-self-end text-right">
                    <button
                      type="button"
                      onClick={() => openTimeSignaturePicker()}
                      disabled={isProgrammedMode}
                      className="group rounded-xl p-1 text-right transition hover:bg-white/5 disabled:hover:bg-transparent"
                      title={isProgrammedMode ? 'Signature de la section en cours' : 'Changer la signature rythmique'}
                    >
                      <span className="text-4xl font-black text-white leading-none tabular-nums">{displayBeatsPerBar}/4</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsSubdivisionPickerOpen(true)}
                      disabled={isProgrammedMode}
                      className="group rounded-xl p-1 text-right transition hover:bg-white/5 flex items-center justify-center disabled:hover:bg-transparent"
                      title={isProgrammedMode ? 'Subdivision de la section en cours' : 'Changer la subdivision'}
                    >
                      <SubdivisionIcon value={displaySubdivision} className="h-10 w-10 text-white" />
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <MetronomeBeatGrid
                    engine={isProgrammedMode ? null : engineRef.current}
                    beatsPerBar={displayBeatsPerBar}
                    subdivision={displaySubdivision}
                    beatSounds={displayBeatSounds}
                    heightClass="h-8 sm:h-9"
                    {...(isProgrammedMode
                      ? { isRunning, activeBeat: programmedActiveBeat, activeSubdivision: programmedActiveSubdivision }
                      : { isRunning, onCycleSubdivisionSound: cycleSubdivisionSound })}
                  />
                </div>

                {isProgrammedMode && programmedBundle ? (
                  <ProgrammedSectionControls
                    sections={programmedBundle.sections}
                    currentIndex={programmedSectionIndex}
                    currentBar={timelineSnapshot.loopBar ?? (timelinePosition?.barIndex ?? 0) + 1}
                    barCount={currentProgrammedSection?.bars ?? 1}
                    onPrevious={() => void jumpProgrammedSection(-1)}
                    onNext={() => void jumpProgrammedSection(1)}
                  />
                ) : null}

                {audioError ? <p className="mt-3 text-sm font-semibold text-rose-400 text-center">{audioError}</p> : null}
              </section>
            </div>
          </div>

          {/* Zone de contenu défilante (Liste des chansons) */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-28 sm:px-6">
            <div className="mx-auto max-w-2xl w-full">
              <section aria-label="Liste des chansons" className="space-y-3">
                {setlistSongs === undefined ? (
                  <p className="text-sm text-[var(--fz-text-muted)] py-3">Chargement des chansons...</p>
                ) : setlistSongs.length === 0 ? (
                  <div className="fz-card-soft rounded-2xl p-4 text-sm text-[var(--fz-text-muted)]">
                    Aucune chanson dans cette setlist.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {setlistSongs.map((entry, index) => {
                      const isSelected = entry.songId === selectedSongId;
                      const programmedBpm = programmedBpms[entry.songId];
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onMouseDown={() => startLongPress(entry.songId, entry.songBpm)}
                          onMouseUp={cancelLongPress}
                          onMouseLeave={cancelLongPress}
                          onTouchStart={() => startLongPress(entry.songId, entry.songBpm)}
                          onTouchMove={cancelLongPress}
                          onTouchEnd={cancelLongPress}
                          onTouchCancel={cancelLongPress}
                          onClick={() => handleSongClick(entry.songId, entry.songBpm)}
                          className={[
                            'w-full text-left rounded-2xl border p-4 transition flex items-center justify-between gap-4 select-none',
                            isSelected
                              ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                              : 'border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/5',
                          ].join(' ')}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white/80">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-base font-black text-white">{entry.songTitle}</h4>
                              {entry.songArtist ? (
                                <p className="truncate text-xs text-[var(--fz-text-muted)]">{entry.songArtist}</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {entry.songKey ? (
                              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-white/80">
                                {entry.songKey}
                              </span>
                            ) : null}
                            {programmedBpm !== undefined ? (
                              <ProgrammedBpmHighlight bpm={programmedBpm} />
                            ) : (
                              <span
                                className={[
                                  'rounded-lg px-2.5 py-1 text-xs font-black',
                                  entry.songBpm ? 'bg-amber-500/15 text-amber-400' : 'text-white/40',
                                ].join(' ')}
                              >
                                {entry.songBpm ? `${entry.songBpm} BPM` : 'BPM --'}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Navigation Précédent / Suivant en bas (exactement comme dans le prompteur) */}
          <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30">
            <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 sm:px-6">
              {previousSong ? (
                <button
                  type="button"
                  onClick={() => handleSongClick(previousSong.songId, previousSong.songBpm)}
                  aria-label={`Morceau précédent : ${previousSong.songTitle || 'Sans titre'}`}
                  className={`${navigationButtonClass} justify-start text-left`}
                >
                  <span aria-hidden="true" className="shrink-0 text-xl font-black leading-none text-white/70">‹</span>
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="line-clamp-3 break-words text-sm font-black leading-snug text-white">
                      {previousSong.songTitle || 'Sans titre'}
                    </span>
                  </span>
                </button>
              ) : <div />}

              {nextSong ? (
                <button
                  type="button"
                  onClick={() => handleSongClick(nextSong.songId, nextSong.songBpm)}
                  aria-label={`Morceau suivant : ${nextSong.songTitle || 'Sans titre'}`}
                  className={`${navigationButtonClass} justify-end text-right ${!previousSong ? 'col-start-2' : ''}`}
                >
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="line-clamp-3 break-words text-sm font-black leading-snug text-white">
                      {nextSong.songTitle || 'Sans titre'}
                    </span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-xl font-black leading-none text-white/70">›</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isTempoPickerOpen ? (
        <PickerDialog
          title={editingBpmSongId ? 'Régler le tempo de la chanson' : 'Sélectionner le tempo'}
          closeLabel="Fermer"
          headerActions={
            editingBpmSongId && (structureEnabledOverride ?? programmedBpms[editingBpmSongId] !== undefined) === true ? null : (
              <Button
                size="sm"
                variant="secondary"
                disabled={!editingBpmSongId && !selectedSongId}
                aria-label="Ouvrir la structure"
                leadingIcon={<FzIcon name="metronome" usageId="metronome.tempo.structure" size="sm" />}
                onClick={() => {
                  const songId = editingBpmSongId ?? selectedSongId;
                  if (!songId) return;
                  setIsTempoPickerOpen(false);
                  setEditingBpmSongId(null);
                  navigate(`/songs/${songId}/structure`);
                }}
              >
                Structure
              </Button>
            )
          }
          onClose={() => {
            setStructureEnabledOverride(null);
            setIsTempoPickerOpen(false);
            setEditingBpmSongId(null);
          }}
        >
          {editingBpmSongId && (structureEnabledOverride ?? programmedBpms[editingBpmSongId] !== undefined) === true ? (
            <StructureLockedTempoNotice
              bpm={programmedBpms[editingBpmSongId] ?? draftBpm}
              onOpenStructure={() => {
                setIsTempoPickerOpen(false);
                setEditingBpmSongId(null);
                navigate(`/songs/${editingBpmSongId}/structure`);
              }}
              onUseSingleTempo={() => void handleSetStructureEnabled(false)}
            />
          ) : (
            <>
              <WheelColumn
                options={bpmOptions}
                selectedValue={String(draftBpm)}
                onSelect={(value) => {
                  if (value) {
                    setDraftBpm(Number(value));
                  }
                }}
                suffix="BPM"
              />
              <div className="mt-5 space-y-3">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => void handleConfirmTempo()}
                >
                  Valider
                </Button>
                {editingBpmSongId && (structureEnabledOverride ?? !inactiveStructureSongIdSet.has(editingBpmSongId)) === false ? (
                  <Button variant="secondary" fullWidth onClick={() => void handleSetStructureEnabled(true)}>
                    Réactiver la structure
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </PickerDialog>
      ) : null}

      {isTimeSignaturePickerOpen ? (
        <PickerDialog
          title="Signature rythmique"
          description="Nombre de temps par mesure"
          closeLabel="Fermer"
          onClose={() => setIsTimeSignaturePickerOpen(false)}
        >
          <WheelColumn
            options={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']}
            selectedValue={String(draftBeatsPerBar)}
            onSelect={(value) => {
              if (value) {
                setDraftBeatsPerBar(Number(value));
              }
            }}
            suffix="Temps"
          />
          <div className="mt-5">
            <Button
              variant="primary"
              fullWidth
              onClick={handleConfirmTimeSignature}
            >
              Valider
            </Button>
          </div>
        </PickerDialog>
      ) : null}

      {isSubdivisionPickerOpen ? (
        <PickerDialog
          title="Subdivision des temps"
          closeLabel="Fermer"
          onClose={() => setIsSubdivisionPickerOpen(false)}
        >
          <SubdivisionSelector value={subdivision} onChange={updateSubdivisionValue} />
        </PickerDialog>
      ) : null}
    </div>
  );
}

function ProgrammedBpmHighlight({ bpm }: { bpm: number }) {
  return (
    <span
      className="rounded-md bg-amber-400/20 px-1.5 py-0.5 font-black tabular-nums text-amber-300"
      title="Métronome programmé"
    >
      {bpm} BPM
    </span>
  );
}

function ProgrammedSectionControls({
  sections,
  currentIndex,
  currentBar,
  barCount,
  onPrevious,
  onNext,
}: {
  sections: TimelineSectionRecord[];
  currentIndex: number;
  currentBar: number;
  barCount: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const current = sections[currentIndex];
  if (!current) return null;
  const previous = currentIndex > 0 ? sections[currentIndex - 1] : undefined;
  const next = currentIndex < sections.length - 1 ? sections[currentIndex + 1] : undefined;
  const infinite = barCount === 0;
  const barNumber = infinite ? Math.max(1, currentBar) : Math.min(barCount, Math.max(1, currentBar));

  return (
    <div className="mt-4 space-y-3" role="region" aria-label="Sections du métronome programmé">
      <div className="min-w-0 px-1 text-center">
        <p className="truncate text-2xl font-black leading-tight tracking-tight text-white sm:text-[1.75rem]">{current.name}</p>
        <p className="mt-1 text-base font-black uppercase tracking-[0.14em] text-amber-300 tabular-nums">
          Mesure {barNumber} / {infinite ? '∞' : barCount}
        </p>
        <p className="mt-0.5 text-sm font-black uppercase tracking-[0.16em] text-white/50">
          Section {currentIndex + 1} / {sections.length}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!previous}
          onClick={onPrevious}
          aria-label={previous ? `Section précédente : ${previous.name}` : 'Section précédente'}
          className="flex min-h-12 min-w-0 items-center justify-start gap-2 rounded-xl px-3 text-left text-white/70 transition hover:bg-white/6 hover:text-white disabled:opacity-25"
        >
          <FzIcon name="back" usageId="metronome.programmed.previous" size="md" />
          {previous ? <span className="min-w-0 truncate text-sm font-black">{previous.name}</span> : null}
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={onNext}
          aria-label={next ? `Section suivante : ${next.name}` : 'Section suivante'}
          className="flex min-h-12 min-w-0 items-center justify-end gap-2 rounded-xl px-3 text-right text-white/70 transition hover:bg-white/6 hover:text-white disabled:opacity-25"
        >
          {next ? <span className="min-w-0 truncate text-sm font-black">{next.name}</span> : null}
          <FzIcon name="next" usageId="metronome.programmed.next" size="md" />
        </button>
      </div>
    </div>
  );
}
