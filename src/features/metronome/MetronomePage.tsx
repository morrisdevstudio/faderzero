import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FeatureCard } from '@/components/FeatureCard';
import { PickerDialog, WheelColumn } from '@/components/PickerDialog';
import { setlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import { clampBeatsPerBar, clampBpm, MetronomeEngine } from '@/features/metronome/metronomeEngine';
import { bpmOptions, formatSetDuration, formatSongDuration, getSongStatusLabel, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { ContentRow } from '@/ui/components/ContentRow';
import { PageHeader } from '@/ui/components/PageHeader';
import { StatusPill } from '@/ui/components/StatusPill';
import { FzIcon } from '@/ui/icons';

const TAP_MEMORY = 5;

type MetronomeSubdivision = 1 | 2 | 3 | 4 | 5 | 6;

const subdivisionOptions: Array<{ value: MetronomeSubdivision; symbol: string; label: string }> = [
  { value: 1, symbol: '♩', label: 'Noire' },
  { value: 2, symbol: '♫', label: 'Croches' },
  { value: 3, symbol: '3', label: 'Triolets' },
  { value: 4, symbol: '♬', label: 'Doubles' },
  { value: 5, symbol: '5', label: 'Quintolets' },
  { value: 6, symbol: '6', label: 'Sextolets' },
];



function SubdivisionIcon({ value, className = 'h-7 w-7' }: { value: MetronomeSubdivision; className?: string }) {
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

function SubdivisionSelector({
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

export function MetronomePage() {
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const engineRef = useRef<MetronomeEngine | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  const [bpm, setBpm] = useState(120);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [subdivision, setSubdivision] = useState<MetronomeSubdivision>(1);
  const [isRunning, setIsRunning] = useState(false);
  const [activeBeat, setActiveBeat] = useState(0);
  const [activeSubdivision, setActiveSubdivision] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isTempoPickerOpen, setIsTempoPickerOpen] = useState(false);
  const [isTimeSignaturePickerOpen, setIsTimeSignaturePickerOpen] = useState(false);
  const [isSubdivisionPickerOpen, setIsSubdivisionPickerOpen] = useState(false);

  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [editingBpmSongId, setEditingBpmSongId] = useState<string | null>(null);

  const setlists = useLiveQuery(() => setlistsRepository.listSummaries(), [activeWorkspaceId]);
  const songs = useLiveQuery(() => songsRepository.list(), [activeWorkspaceId]);
  const setlistSongs = useLiveQuery(
    () => (selectedSetlistId ? setlistSongsRepository.listDetailedBySetlistId(selectedSetlistId) : Promise.resolve([])),
    [selectedSetlistId, activeWorkspaceId]
  );
  const currentSetlist = useMemo(
    () => setlists?.find((item) => item.id === selectedSetlistId),
    [setlists, selectedSetlistId]
  );

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

  useEffect(() => {
    const engine = engineRef.current;
    if (engine === null) {
      return;
    }

    engine.setBeatListener(({ beatInBar, subdivisionInBeat }) => {
      setActiveBeat(beatInBar);
      setActiveSubdivision(subdivisionInBeat);
    });

    return () => {
      engine.setBeatListener(null);
      engine.stop();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.updateConfig({ bpm });
  }, [bpm]);

  useEffect(() => {
    engineRef.current?.updateConfig({ beatsPerBar });
    setActiveBeat((current) => current % beatsPerBar);
  }, [beatsPerBar]);

  useEffect(() => {
    engineRef.current?.updateConfig({ subdivision });
    setActiveSubdivision(0);
  }, [subdivision]);

  const beatSlots = useMemo(() => Array.from({ length: beatsPerBar }, (_, index) => index), [beatsPerBar]);
  const subdivisionSlots = useMemo(() => Array.from({ length: subdivision }, (_, index) => index), [subdivision]);

  function updateBpm(nextBpm: number) {
    setBpm(clampBpm(nextBpm));
  }

  function updateBeatsPerBarValue(nextValue: number) {
    setBeatsPerBar(clampBeatsPerBar(nextValue));
  }

  async function handleTogglePlayback() {
    const engine = engineRef.current;
    if (engine === null) {
      return;
    }

    try {
      if (isRunning) {
        engine.stop();
        setIsRunning(false);
        setActiveBeat(0);
        setActiveSubdivision(0);
      } else {
        setAudioError(null);
        await engine.start({ bpm, beatsPerBar, subdivision });
        setIsRunning(true);
      }
    } catch {
      setAudioError("Impossible de démarrer l'audio sur cet appareil.");
      setIsRunning(false);
    }
  }

  async function playSongTempo(songBpm?: number, songId?: string) {
    if (songId) {
      setSelectedSongId(songId);
    }
    if (!songBpm || songBpm <= 0) {
      if (songId) {
        setEditingBpmSongId(songId);
      }
      setIsTempoPickerOpen(true);
      return;
    }
    const nextBpm = clampBpm(songBpm);
    setBpm(nextBpm);
    const engine = engineRef.current;
    if (engine) {
      try {
        setAudioError(null);
        await engine.start({ bpm: nextBpm, beatsPerBar, subdivision });
        setIsRunning(true);
      } catch {
        setAudioError("Impossible de démarrer l'audio sur cet appareil.");
        setIsRunning(false);
      }
    }
  }

  function startLongPress(songId: string, songBpm?: number) {
    isLongPressRef.current = false;
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      setSelectedSongId(songId);
      setEditingBpmSongId(songId);
      if (songBpm && songBpm > 0) {
        setBpm(clampBpm(songBpm));
      }
      setIsTempoPickerOpen(true);
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

    if (songBpm && songBpm > 0) {
      if (isRunning) {
        void playSongTempo(songBpm, songId);
      } else {
        setBpm(clampBpm(songBpm));
      }
    } else if (isRunning) {
      setEditingBpmSongId(songId);
      setIsTempoPickerOpen(true);
    }
  }

  function handleTapTempo() {
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
      <div className="sticky top-0 z-20 -mx-4 -mt-4 bg-[var(--fz-bg)]/95 px-4 pb-3 pt-4 backdrop-blur-md border-b border-white/8 sm:-mx-6 sm:px-6">
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
                aria-label="Tap tempo"
                className="flex h-10 px-3 items-center justify-center rounded-xl border border-white/10 bg-white/6 hover:bg-white/12 active:scale-95 text-xs font-black uppercase tracking-wider text-white transition shrink-0"
                title="Taper pour calculer le tempo"
              >
                TAP
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingBpmSongId(null);
                  setIsTempoPickerOpen(true);
                }}
                className="group flex items-baseline gap-1 rounded-xl p-1 text-left transition hover:bg-white/6 focus-visible:outline-none"
                title="Cliquer pour changer le tempo"
              >
                <span className="text-3xl font-black tracking-tight text-white leading-none">{bpm}</span>
                <span className="text-[0.65rem] font-black uppercase tracking-wider text-[var(--fz-text-muted)] group-hover:text-white/80">BPM</span>
              </button>
            </div>

            {/* Centre : Bouton Play/Stop rond */}
            <div className="flex items-center justify-center justify-self-center">
              <button
                type="button"
                onClick={handleTogglePlayback}
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
                onClick={() => setIsTimeSignaturePickerOpen(true)}
                className="group rounded-xl p-1 text-right transition hover:bg-white/6 focus-visible:outline-none"
                title="Cliquer pour changer la signature rythmique"
              >
                <span className="text-3xl font-black text-white leading-none">{beatsPerBar}/4</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSubdivisionPickerOpen(true)}
                className="group rounded-xl p-1 text-right transition hover:bg-white/6 flex items-center justify-center"
                title="Cliquer pour changer la subdivision"
              >
                <SubdivisionIcon value={subdivision} className="h-9 w-9 text-white" />
              </button>
            </div>
          </div>

          {/* Barres de pulsation compactes */}
          <div className="mt-3.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${beatsPerBar}, minmax(0, 1fr))` }}>
            {beatSlots.map((slot) => {
              const isAccent = slot === 0;

              return (
                <div
                  key={slot}
                  className="grid h-6 sm:h-7 gap-1"
                  style={{ gridTemplateColumns: `repeat(${subdivision}, minmax(0, 1fr))` }}
                >
                  {subdivisionSlots.map((subdivisionSlot) => {
                    const isMainBeat = subdivisionSlot === 0;
                    const isActive = slot === activeBeat && subdivisionSlot === activeSubdivision && isRunning;

                    return (
                      <div
                        key={subdivisionSlot}
                        className={[
                          'rounded-md border transition',
                          isActive && isAccent && isMainBeat
                            ? 'border-amber-400/50 bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.65)]'
                            : isActive && isMainBeat
                              ? 'border-amber-400/30 bg-amber-400/80 shadow-[0_0_18px_rgba(251,191,36,0.4)]'
                              : isActive
                                ? 'border-amber-300/40 bg-amber-300/70 shadow-[0_0_16px_rgba(252,211,77,0.3)]'
                                : isAccent && isMainBeat
                                  ? 'border-white/10 bg-white/10'
                                  : isMainBeat
                                    ? 'border-white/6 bg-white/6'
                                    : 'border-amber-400/10 bg-amber-400/5',
                        ].join(' ')}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

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
            {songs.map((song) => (
              <ContentRow
                key={song.id}
                mode="button"
                onClick={() => void playSongTempo(song.bpm, song.id)}
                title={song.title || 'Sans titre'}
                metadata={`${song.bpm ? `${song.bpm} BPM` : 'BPM --'} · ${song.key || 'Ton --'} · ${formatSongDuration(song.durationSeconds)}`}
                status={<StatusPill label={getSongStatusLabel(song.status)} tone={getSongStatusTone(song.status)} />}
              />
            ))}
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
                    onClick={() => {
                      setEditingBpmSongId(null);
                      setIsTempoPickerOpen(true);
                    }}
                    className="group flex items-baseline gap-1.5 rounded-xl p-1 text-left transition hover:bg-white/5 justify-self-start"
                    title="Changer le tempo"
                  >
                    <span className="text-4xl font-black tracking-tight text-white leading-none">{bpm}</span>
                    <span className="text-xs font-black uppercase tracking-wider text-[var(--fz-text-muted)] group-hover:text-white/80">BPM</span>
                  </button>

                    <div className="flex items-center justify-center justify-self-center">
                    <button
                      type="button"
                      onClick={handleTogglePlayback}
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
                      onClick={() => setIsTimeSignaturePickerOpen(true)}
                      className="group rounded-xl p-1 text-right transition hover:bg-white/5"
                      title="Changer la signature rythmique"
                    >
                      <span className="text-4xl font-black text-white leading-none">{beatsPerBar}/4</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsSubdivisionPickerOpen(true)}
                      className="group rounded-xl p-1 text-right transition hover:bg-white/5 flex items-center justify-center"
                      title="Changer la subdivision"
                    >
                      <SubdivisionIcon value={subdivision} className="h-10 w-10 text-white" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${beatsPerBar}, minmax(0, 1fr))` }}>
                  {beatSlots.map((slot) => {
                    const isAccent = slot === 0;

                    return (
                      <div
                        key={slot}
                        className="grid h-7 gap-1"
                        style={{ gridTemplateColumns: `repeat(${subdivision}, minmax(0, 1fr))` }}
                      >
                        {subdivisionSlots.map((subdivisionSlot) => {
                          const isMainBeat = subdivisionSlot === 0;
                          const isActive = slot === activeBeat && subdivisionSlot === activeSubdivision && isRunning;

                          return (
                            <div
                              key={subdivisionSlot}
                              className={[
                                'rounded-md border transition',
                                isActive && isAccent && isMainBeat
                                  ? 'border-amber-400/50 bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.65)]'
                                  : isActive && isMainBeat
                                    ? 'border-amber-400/30 bg-amber-400/80 shadow-[0_0_18px_rgba(251,191,36,0.4)]'
                                    : isActive
                                      ? 'border-amber-300/40 bg-amber-300/70 shadow-[0_0_16px_rgba(252,211,77,0.3)]'
                                      : isAccent && isMainBeat
                                        ? 'border-white/10 bg-white/10'
                                        : isMainBeat
                                          ? 'border-white/6 bg-white/6'
                                          : 'border-amber-400/10 bg-amber-400/5',
                              ].join(' ')}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

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
                            <span
                              className={[
                                'rounded-lg px-2.5 py-1 text-xs font-black',
                                entry.songBpm ? 'bg-amber-500/15 text-amber-400' : 'text-white/40',
                              ].join(' ')}
                            >
                              {entry.songBpm ? `${entry.songBpm} BPM` : 'BPM --'}
                            </span>
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
          onClose={() => {
            setIsTempoPickerOpen(false);
            setEditingBpmSongId(null);
          }}
        >
          <WheelColumn
            options={bpmOptions}
            selectedValue={String(bpm)}
            onSelect={async (value) => {
              if (value) {
                const nextBpm = Number(value);
                updateBpm(nextBpm);
                if (editingBpmSongId) {
                  await songsRepository.update(editingBpmSongId, { bpm: nextBpm });
                }
              }
            }}
            suffix="BPM"
          />
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
            selectedValue={String(beatsPerBar)}
            onSelect={(value) => {
              if (value) {
                updateBeatsPerBarValue(Number(value));
              }
            }}
            suffix="Temps"
          />
        </PickerDialog>
      ) : null}

      {isSubdivisionPickerOpen ? (
        <PickerDialog
          title="Subdivision des temps"
          closeLabel="Fermer"
          onClose={() => setIsSubdivisionPickerOpen(false)}
        >
          <SubdivisionSelector value={subdivision} onChange={setSubdivision} />
        </PickerDialog>
      ) : null}
    </div>
  );
}
