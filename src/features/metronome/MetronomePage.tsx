import { useEffect, useMemo, useRef, useState } from 'react';
import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/components/StatusPill';
import { clampBeatsPerBar, clampBpm, MetronomeEngine } from '@/features/metronome/metronomeEngine';

const TAP_MEMORY = 5;

export function MetronomePage() {
  const engineRef = useRef<MetronomeEngine | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const [bpm, setBpm] = useState(120);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [isRunning, setIsRunning] = useState(false);
  const [activeBeat, setActiveBeat] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  if (engineRef.current === null) {
    engineRef.current = new MetronomeEngine();
  }

  useEffect(() => {
    const engine = engineRef.current;
    if (engine === null) {
      return;
    }

    engine.setBeatListener(({ beatInBar }) => {
      setActiveBeat(beatInBar);
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

  const beatSlots = useMemo(() => Array.from({ length: beatsPerBar }, (_, index) => index), [beatsPerBar]);

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
      } else {
        setAudioError(null);
        await engine.start({ bpm, beatsPerBar });
        setIsRunning(true);
      }
    } catch {
      setAudioError("Impossible de demarrer l'audio sur cet appareil.");
      setIsRunning(false);
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

  return (
    <div className="space-y-4">
      <FeatureCard
        eyebrow="Metronome"
        title={`${bpm} BPM`}
        description="Le clic est pilote par un scheduler Web Audio anticipe, pour garder la pulsation meme si l'UI bouge."
        aside={`${beatsPerBar}/4`}
      >
        <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--fz-text-muted)]">Tempo</p>
              <div className="mt-2 text-5xl font-black tracking-tight text-white">{bpm}</div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--fz-text-muted)]">Mesure</p>
              <div className="mt-2 text-4xl font-black text-white">{beatsPerBar}/4</div>
            </div>
          </div>

          <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${beatsPerBar}, minmax(0, 1fr))` }}>
            {beatSlots.map((slot) => {
              const isAccent = slot === 0;
              const isActive = slot === activeBeat && isRunning;

              return (
                <div
                  key={slot}
                  className={[
                    'h-14 rounded-xl border transition',
                    isActive && isAccent
                      ? 'border-[rgba(255,58,99,0.35)] bg-[rgba(255,58,99,0.9)] shadow-[0_0_24px_rgba(255,58,99,0.55)]'
                      : isActive
                        ? 'border-[rgba(255,198,92,0.28)] bg-[rgba(255,198,92,0.88)] shadow-[0_0_18px_rgba(255,198,92,0.35)]'
                        : isAccent
                          ? 'border-white/10 bg-white/10'
                          : 'border-white/6 bg-white/6',
                  ].join(' ')}
                />
              );
            })}
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
        </div>

        <div className="flex flex-wrap gap-3">
          <StatusPill label="Web Audio" tone="accent" />
          <StatusPill label="Offline" tone="success" />
          <StatusPill label={isRunning ? 'Sync active' : 'Pret a jouer'} />
        </div>
      </FeatureCard>
    </div>
  );
}
