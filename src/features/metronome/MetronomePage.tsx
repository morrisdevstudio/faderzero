import { useEffect, useMemo, useRef, useState, type SVGProps } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FormDialog } from '@/components/FormDialog';
import { PickerDialog, WheelColumn } from '@/components/PickerDialog';
import { setlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import { clampBeatsPerBar, clampBpm, MetronomeEngine } from '@/features/metronome/metronomeEngine';
import { bpmOptions, formatSetDuration } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';

const TAP_MEMORY = 5;

type MetronomeSubdivision = 1 | 2 | 3 | 4;

const subdivisionOptions: Array<{ value: MetronomeSubdivision; symbol: string; label: string }> = [
  { value: 1, symbol: '♩', label: 'Noire' },
  { value: 2, symbol: '♫', label: 'Croches' },
  { value: 3, symbol: '3', label: 'Triolets' },
  { value: 4, symbol: '♬', label: 'Doubles' },
];

type IconProps = SVGProps<SVGSVGElement>;

function SetlistIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M9 7h10" />
      <path d="M9 12h10" />
      <path d="M9 17h10" />
      <path d="M4 7h.01" />
      <path d="M4 12h.01" />
      <path d="M4 17h.01" />
    </svg>
  );
}

function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function FullscreenIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 3H3v5" />
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
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
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Subdivision du temps">
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
              <span className={compact ? 'text-lg leading-none' : 'text-2xl leading-none'} aria-hidden="true">
                {option.symbol}
              </span>
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

  const [isSetlistModalOpen, setIsSetlistModalOpen] = useState(false);
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [editingBpmSongId, setEditingBpmSongId] = useState<string | null>(null);

  const setlists = useLiveQuery(() => setlistsRepository.listSummaries(), [activeWorkspaceId]);
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
    }
  }, [isLiveViewOpen, setlistSongs, selectedSongId]);

  const navigationButtonClass =
    "pointer-events-auto relative isolate flex min-h-16 items-center rounded-xl border border-white/10 bg-[#111318] px-3 text-xs font-black text-white/70 transition before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-xl before:bg-black/45 before:blur-2xl before:backdrop-blur-lg before:content-[''] hover:bg-[#1a1d22] hover:text-white active:bg-[#20242a] disabled:cursor-not-allowed disabled:opacity-35";

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
    if (songBpm && songBpm > 0) {
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
      playSongTempo(songBpm, songId);
    } else {
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
    <div className="space-y-4">
      <section className="space-y-3 -mt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-white shrink-0">
              <path d="M7 20h10" />
              <path d="M8.5 20 11 5h2l2.5 15" />
              <path d="M10 11h4" />
              <path d="M14.5 7.5 18 5" />
            </svg>
            <h1 className="text-[2rem] font-black tracking-tight text-white">Métronome</h1>
          </div>
          <button
            type="button"
            onClick={() => setIsSetlistModalOpen(true)}
            aria-label="Choisir une setlist"
            className="fz-button-primary h-11 w-11 shrink-0 p-0 flex items-center justify-center"
            title="Choisir une setlist"
          >
            <SetlistIcon className="h-5 w-5" />
          </button>
        </div>
      </section>

      <section aria-label="Contrôles du métronome" className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
        <div className="flex items-end justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              setEditingBpmSongId(null);
              setIsTempoPickerOpen(true);
            }}
            className="group -m-1.5 flex flex-col items-start rounded-2xl p-1.5 text-left transition hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            title="Cliquer pour changer le tempo"
          >
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--fz-text-muted)] transition-colors group-hover:text-white/80">Tempo</p>
            <div className="mt-2 text-5xl font-black tracking-tight text-white transition-transform origin-left group-hover:scale-105">{bpm}</div>
          </button>
          <div className="text-right">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--fz-text-muted)]">Mesure</p>
            <div className="mt-2 text-4xl font-black text-white">{beatsPerBar}/4</div>
          </div>
        </div>

        <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${beatsPerBar}, minmax(0, 1fr))` }}>
          {beatSlots.map((slot) => {
            const isAccent = slot === 0;

            return (
              <div
                key={slot}
                className="grid h-14 gap-1"
                style={{ gridTemplateColumns: `repeat(${subdivision}, minmax(0, 1fr))` }}
              >
                {subdivisionSlots.map((subdivisionSlot) => {
                  const isMainBeat = subdivisionSlot === 0;
                  const isActive = slot === activeBeat && subdivisionSlot === activeSubdivision && isRunning;

                  return (
                    <div
                      key={subdivisionSlot}
                      className={[
                        'rounded-lg border transition',
                        isActive && isAccent && isMainBeat
                          ? 'border-[rgba(255,58,99,0.35)] bg-[rgba(255,58,99,0.9)] shadow-[0_0_24px_rgba(255,58,99,0.55)]'
                          : isActive && isMainBeat
                            ? 'border-[rgba(255,198,92,0.28)] bg-[rgba(255,198,92,0.88)] shadow-[0_0_18px_rgba(255,198,92,0.35)]'
                            : isActive
                              ? 'border-cyan-300/45 bg-cyan-300/85 shadow-[0_0_16px_rgba(103,232,249,0.35)]'
                              : isAccent && isMainBeat
                                ? 'border-white/10 bg-white/10'
                                : isMainBeat
                                  ? 'border-white/6 bg-white/6'
                                  : 'border-cyan-300/10 bg-cyan-300/5',
                      ].join(' ')}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <SubdivisionSelector value={subdivision} onChange={setSubdivision} />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => updateBpm(bpm - 1)}
            className="fz-button-secondary px-4 py-4 text-lg font-black text-white"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleTapTempo}
            className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-4 text-sm font-black uppercase tracking-[0.14em] text-white"
          >
            Tap tempo
          </button>
          <button
            type="button"
            onClick={() => updateBpm(bpm + 1)}
            className="fz-button-secondary px-4 py-4 text-lg font-black text-white"
          >
            +
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => updateBeatsPerBarValue(beatsPerBar - 1)}
            className="rounded-[1.1rem] border border-white/10 bg-white/5 px-3 py-3 text-sm font-black uppercase tracking-[0.14em] text-white"
          >
            - Beat
          </button>
          <div className="flex items-center justify-center rounded-[1.1rem] border border-white/8 bg-black/25 px-3 py-3 text-sm font-black uppercase tracking-[0.16em] text-white">
            {beatsPerBar}/4
          </div>
          <button
            type="button"
            onClick={() => updateBeatsPerBarValue(beatsPerBar + 1)}
            className="rounded-[1.1rem] border border-white/10 bg-white/5 px-3 py-3 text-sm font-black uppercase tracking-[0.14em] text-white"
          >
            + Beat
          </button>
        </div>

        {audioError ? <p className="mt-4 text-sm font-semibold text-rose-400">{audioError}</p> : null}

        <button
          type="button"
          onClick={handleTogglePlayback}
          className="fz-button-primary mt-4 w-full px-4 py-4 text-sm font-black uppercase tracking-[0.18em]"
        >
          {isRunning ? 'Stopper le clic' : 'Lancer le clic'}
        </button>
      </section>

      {/* MODAL POPUP SÉLECTION DE SETLIST */}
      {isSetlistModalOpen ? (
        <FormDialog
          title="Sélectionner une setlist"
          placement="bottom"
          onClose={() => setIsSetlistModalOpen(false)}
        >
          {setlists === undefined ? (
            <p className="text-sm text-[var(--fz-text-muted)] py-4">Chargement des setlists...</p>
          ) : setlists.length === 0 ? (
            <div className="fz-card-soft rounded-[1.2rem] px-4 py-5 text-sm text-[var(--fz-text-muted)]">
              Aucune setlist disponible.
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {setlists.map((setlist) => (
                <button
                  key={setlist.id}
                  type="button"
                  onClick={() => {
                    setSelectedSetlistId(setlist.id);
                    setIsSetlistModalOpen(false);
                    setIsLiveViewOpen(true);
                  }}
                  className="w-full text-left fz-card-soft block rounded-[1.2rem] px-4 py-3.5 transition hover:border-[var(--fz-border-strong)] hover:bg-white/10"
                >
                  <h3 className="truncate text-base font-black text-white">{setlist.name}</h3>
                  <p className="mt-1 truncate text-xs text-[var(--fz-text-muted)]">
                    {setlist.songCount} morceau{setlist.songCount > 1 ? 'x' : ''}
                    {' · '}
                    {formatSetDuration(setlist.totalDurationSeconds)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </FormDialog>
      ) : null}

      {/* VUE EN PLEIN ÉCRAN TYPE PROMPTEUR POUR LA SETLIST */}
      {isLiveViewOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--fz-bg)]">
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
                  <CloseIcon className="h-5 w-5" />
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
                    <FullscreenIcon className="h-5 w-5" />
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
                    className="group flex flex-col items-start justify-center rounded-xl p-1 text-left transition hover:bg-white/5 justify-self-start"
                    title="Changer le tempo"
                  >
                    <span className="block text-xs font-black uppercase tracking-[0.22em] text-[var(--fz-text-muted)]">TEMPO</span>
                    <span className="block mt-1.5 text-5xl font-black tracking-tight text-white leading-none">{bpm}</span>
                  </button>

                  <div className="flex items-center justify-center justify-self-center">
                    <button
                      type="button"
                      onClick={handleTogglePlayback}
                      className={[
                        'flex h-16 w-16 items-center justify-center rounded-full transition transform active:scale-95 shadow-lg shrink-0',
                        isRunning
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30',
                      ].join(' ')}
                      title={isRunning ? 'Stopper le métronome' : 'Lancer le métronome'}
                    >
                      {isRunning ? (
                        <PauseIcon className="h-7 w-7" />
                      ) : (
                        <PlayIcon className="h-7 w-7 ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col items-end justify-center text-right justify-self-end">
                    <span className="block text-xs font-black uppercase tracking-[0.22em] text-[var(--fz-text-muted)]">MESURE</span>
                    <div className="block mt-1.5 text-4xl font-black text-white leading-none">{beatsPerBar}/4</div>
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
                                  ? 'border-[rgba(255,58,99,0.35)] bg-[rgba(255,58,99,0.9)] shadow-[0_0_24px_rgba(255,58,99,0.55)]'
                                  : isActive && isMainBeat
                                    ? 'border-[rgba(255,198,92,0.28)] bg-[rgba(255,198,92,0.88)] shadow-[0_0_18px_rgba(255,198,92,0.35)]'
                                    : isActive
                                      ? 'border-cyan-300/45 bg-cyan-300/85 shadow-[0_0_16px_rgba(103,232,249,0.35)]'
                                      : isAccent && isMainBeat
                                        ? 'border-white/10 bg-white/10'
                                        : isMainBeat
                                          ? 'border-white/6 bg-white/6'
                                          : 'border-cyan-300/10 bg-cyan-300/5',
                              ].join(' ')}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <SubdivisionSelector value={subdivision} onChange={setSubdivision} compact />
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
                          onTouchEnd={cancelLongPress}
                          onTouchCancel={cancelLongPress}
                          onClick={() => handleSongClick(entry.songId, entry.songBpm)}
                          className={[
                            'w-full text-left rounded-2xl border p-4 transition flex items-center justify-between gap-4 select-none',
                            isSelected
                              ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
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
                                entry.songBpm ? 'bg-white/10 text-emerald-400' : 'text-white/40',
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
          <div className="pointer-events-none fixed inset-x-0 bottom-[max(4rem,env(safe-area-inset-bottom))] z-30">
            <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 sm:px-6">
              <button
                type="button"
                disabled={!previousSong}
                onClick={() => previousSong && handleSongClick(previousSong.songId, previousSong.songBpm)}
                className={`${navigationButtonClass} justify-start text-left`}
              >
                <span>
                  ‹ Précédent
                  <br />
                  <span className="text-white">{previousSong?.songTitle ?? 'Début'}</span>
                </span>
              </button>

              <button
                type="button"
                disabled={!nextSong}
                onClick={() => nextSong && handleSongClick(nextSong.songId, nextSong.songBpm)}
                className={`${navigationButtonClass} justify-end text-right`}
              >
                <span>
                  Suivant ›
                  <br />
                  <span className="text-white">{nextSong?.songTitle ?? 'Fin'}</span>
                </span>
              </button>
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
    </div>
  );
}

