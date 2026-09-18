import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { songTimelinesRepository } from '@/db/repositories/songTimelinesRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import { useGoBack } from '@/hooks/useGoBack';
import { useAuthStore } from '@/stores/authStore';
import { FzIcon } from '@/ui/icons';
import { compileTimeline, getTimelinePosition } from './timelineCompiler';
import { TimelinePlaybackEngine, type TimelinePlaybackSnapshot } from './timelinePlaybackEngine';

export function SongTimelineLivePage() {
  const { songId = '' } = useParams();
  const goBack = useGoBack(`/songs/${songId}/structure`);
  const workspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const song = useLiveQuery(() => songsRepository.getById(songId), [songId, workspaceId]);
  const bundle = useLiveQuery(() => songTimelinesRepository.getBySongId(songId), [songId, workspaceId]);
  const compiled = useMemo(() => bundle ? compileTimeline(bundle.timeline, bundle.sections) : null, [bundle]);
  const engineRef = useRef<TimelinePlaybackEngine | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const [snapshot, setSnapshot] = useState<TimelinePlaybackSnapshot>({ status: 'stopped', position: 0 });
  if (!engineRef.current) engineRef.current = new TimelinePlaybackEngine();
  const current = compiled ? getTimelinePosition(compiled, snapshot.position) : null;
  const next = current && compiled ? compiled.sections[current.section.sectionIndex + 1] : undefined;

  useEffect(() => {
    const engine = engineRef.current!;
    engine.setListener(setSnapshot);
    const ticker = window.setInterval(() => {
      if (engine.snapshot.status === 'playing') setSnapshot(engine.snapshot);
    }, 100);
    return () => { window.clearInterval(ticker); engine.stop(); };
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    async function requestLock() {
      if (!nav.wakeLock || document.visibilityState !== 'visible' || wakeLockRef.current) return;
      try { wakeLockRef.current = await nav.wakeLock.request('screen'); } catch { /* Live works without Wake Lock. */ }
    }
    const visible = () => void requestLock();
    void requestLock();
    document.addEventListener('visibilitychange', visible);
    return () => { document.removeEventListener('visibilitychange', visible); void wakeLockRef.current?.release(); wakeLockRef.current = null; };
  }, []);

  async function toggle() {
    if (!compiled || !bundle) return;
    if (snapshot.status === 'playing') engineRef.current?.pause();
    else await engineRef.current?.play(compiled, snapshot.status === 'paused' ? snapshot.position : 0, bundle.timeline.volume);
  }

  async function jump(direction: -1 | 1) {
    if (!compiled || !current) return;
    const target = compiled.sections[current.section.sectionIndex + direction];
    if (target) await engineRef.current?.seek(target.startTime);
  }

  if (song === undefined || bundle === undefined) return <div className="flex min-h-[100dvh] items-center justify-center bg-[#08090b] text-white/60">Chargement…</div>;
  if (!song || !bundle || !compiled) return <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#08090b] px-6 text-center text-white"><p>Aucune structure programmable.</p><button className="fz-button-secondary px-5 py-3 font-black" onClick={goBack}>Retour à l’éditeur</button></div>;

  const progress = compiled.duration ? Math.min(100, snapshot.position / compiled.duration * 100) : 0;
  return <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-[#08090b] text-white">
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-3 safe-top">
      <button type="button" aria-label="Quitter le mode Live" onClick={goBack} className="flex h-11 w-11 items-center justify-center text-white/70"><FzIcon name="close" usageId="timeline.live.close" size="md" /></button>
      <div className="min-w-0 text-center"><p className="truncate text-[0.62rem] font-black uppercase tracking-[0.22em] text-amber-300">Live</p><h1 className="truncate text-sm font-black">{song.title || 'Sans titre'}</h1></div>
      <button type="button" aria-label="Plein écran" onClick={() => void (!document.fullscreenElement ? document.documentElement.requestFullscreen?.() : document.exitFullscreen?.())} className="flex h-11 w-11 items-center justify-center text-white/70"><FzIcon name="fullscreen" usageId="timeline.live.fullscreen" size="md" /></button>
    </header>
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-between px-5 py-7 text-center sm:px-10">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">Section {current ? current.section.sectionIndex + 1 : 1} / {compiled.sections.length}</p>
        <h2 className="mt-4 text-[clamp(2.8rem,13vw,7rem)] font-black leading-none tracking-[-0.055em] text-white">{current?.section.name ?? compiled.sections[0]?.name}</h2>
        <div className="mt-6 flex items-center justify-center gap-5 text-lg font-black text-amber-300"><span>{current?.section.tempo ?? 0} BPM</span><span aria-hidden="true" className="text-white/20">·</span><span>{current?.section.numerator}/{current?.section.denominator}</span></div>
      </div>
      <div className="py-8">
        <p className="text-[clamp(4rem,24vw,10rem)] font-black tabular-nums leading-none text-white">{current ? current.barIndex + 1 : 1}</p>
        <p className="mt-3 text-xs font-black uppercase tracking-[0.22em] text-white/40">Mesure / {current?.section.bars ?? 1}</p>
        {next ? <p className="mt-8 text-sm font-semibold text-white/45">Ensuite · <span className="text-white/75">{next.name}</span></p> : <p className="mt-8 text-sm font-semibold text-white/35">Dernière section</p>}
      </div>
      <div className="space-y-5">
        <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-300 transition-[width] duration-100" style={{ width: `${progress}%` }} /></div>
        <div className="grid grid-cols-[1fr_5rem_1fr] items-center gap-4">
          <button type="button" disabled={!current || current.section.sectionIndex === 0} onClick={() => void jump(-1)} className="flex min-h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60 disabled:opacity-20"><FzIcon name="back" usageId="timeline.live.previous" size="lg" /></button>
          <button type="button" aria-label={snapshot.status === 'playing' ? 'Pause' : 'Lecture'} onClick={() => void toggle()} className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-300 text-[#191105] shadow-[0_0_45px_rgba(252,211,77,0.22)] active:scale-95"><FzIcon name={snapshot.status === 'playing' ? 'pause' : 'play'} usageId="timeline.live.toggle" size="xl" /></button>
          <button type="button" disabled={!next} onClick={() => void jump(1)} className="flex min-h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60 disabled:opacity-20"><FzIcon name="next" usageId="timeline.live.next" size="lg" /></button>
        </div>
        <button type="button" onClick={() => engineRef.current?.stop()} className="min-h-11 px-5 text-xs font-black uppercase tracking-[0.18em] text-white/45">Arrêter et revenir au début</button>
      </div>
    </main>
  </div>;
}
