import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState, type SVGProps } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SongRecord } from '@/db/schema';
import { setlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import { useAuthStore } from '@/stores/authStore';

type Speed = 0 | 1 | 2 | 3;
type Preferences = { speed: Speed; scale: number };
const PREF_KEY = 'faderzero-prompter-preferences';
const DEFAULTS: Preferences = { speed: 0, scale: 1 };

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null') as Partial<Preferences> | null;
    return { speed: stored?.speed === 1 || stored?.speed === 2 || stored?.speed === 3 ? stored.speed : 0, scale: stored?.scale === 1.15 || stored?.scale === 1.3 ? stored.scale : 1 };
  } catch { return DEFAULTS; }
}

function formatDuration(seconds: number) { const safe = Math.max(0, seconds || 0); return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`; }

type IconProps = SVGProps<SVGSVGElement>;

function CloseIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

function FullscreenIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M8 3H3v5" /><path d="M16 3h5v5" /><path d="M8 21H3v-5" /><path d="M16 21h5v-5" /></svg>;
}

function SettingsIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1.03H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1.03-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
}

function StopIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>;
}

function SpeedIcon({ count, ...props }: IconProps & { count: 1 | 2 | 3 }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>{count === 1 ? <path d="M7 5.5 18 12 7 18.5Z" /> : count === 2 ? <><path d="M3.5 6 12 12l-8.5 6Z" /><path d="M11.5 6 20 12l-8.5 6Z" /></> : <><path d="M2 7 9 12l-7 5Z" /><path d="M8 7l7 5-7 5Z" /><path d="m14 7 7 5-7 5Z" /></>}</svg>;
}

function TextSizeIcon({ scale }: { scale: number }) {
  const sizeClass = scale === 1 ? 'text-[0.62rem]' : scale === 1.15 ? 'text-[0.95rem]' : 'text-[1.3rem]';
  return <span aria-hidden="true" className={`inline-flex items-baseline font-black leading-none tracking-[-0.04em] ${sizeClass}`}><span>A</span><span className="text-[0.65em]">a</span></span>;
}

function Lyrics({ text, scale }: { text: string; scale: number }) {
  if (!text.trim()) return <p className="py-16 text-center italic text-white/55">Aucune parole disponible.</p>;
  return <div className="space-y-5 text-center" style={{ fontSize: `${1.18 * scale}rem`, lineHeight: 1.9 }}>{text.split('\n').map((line, index) => line.trim() ? <p key={`${index}-${line}`} className="m-0 whitespace-pre-wrap font-medium text-white/90">{line.split(/(\[[^\]]+\])/).map((part, partIndex) => part.startsWith('[') && part.endsWith(']') ? <span key={partIndex} className="font-black text-emerald-300">{part.slice(1, -1)}{' '}</span> : <span key={partIndex}>{part}</span>)}</p> : <div key={index} className="h-3" />)}</div>;
}

export function PrompterPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const workspaceId = useAuthStore((state) => state.activeWorkspace?.id);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(params.get('songId'));
  const contentRef = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const resumeTimeoutRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const setlists = useLiveQuery(() => setlistsRepository.list(), [workspaceId]);
  const songs = useLiveQuery(() => songsRepository.list(), [workspaceId]);
  const setlistId = params.get('setlistId');
  const entries = useLiveQuery(() => setlistId ? setlistSongsRepository.listDetailedBySetlistId(setlistId) : Promise.resolve([]), [setlistId, workspaceId]);
  const setlist = setlists?.find((item) => item.id === setlistId);
  const sourceSongs = useMemo(() => { if (!setlistId || !entries) return songs ?? []; const map = new Map((songs ?? []).map((song) => [song.id, song])); return entries.map((entry) => map.get(entry.songId)).filter((song): song is SongRecord => Boolean(song)); }, [entries, setlistId, songs]);
  const selectedSong = sourceSongs.find((song) => song.id === selectedSongId) ?? sourceSongs[0];
  const index = selectedSong ? sourceSongs.findIndex((song) => song.id === selectedSong.id) : -1;
  const previousSong = index > 0 ? sourceSongs[index - 1] : undefined;
  const nextSong = index >= 0 ? sourceSongs[index + 1] : undefined;
  const sourceLabel = setlist?.name ?? 'Toutes les chansons';
  const headerButtonClass = 'flex h-11 w-11 items-center justify-center text-white/72 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35';
  const settingsOptionClass = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';
  const navigationButtonClass = "pointer-events-auto relative isolate flex min-h-16 items-center rounded-xl border border-white/10 bg-[#111318] px-3 text-xs font-black text-white/70 transition before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-xl before:bg-black/45 before:blur-2xl before:backdrop-blur-lg before:content-[''] hover:bg-[#1a1d22] hover:text-white active:bg-[#20242a] disabled:cursor-not-allowed disabled:opacity-35";
  const savePreferences = useCallback((next: Preferences) => { setPreferences(next); localStorage.setItem(PREF_KEY, JSON.stringify(next)); }, []);
  const pauseAutoScroll = useCallback(() => {
    paused.current = true;
    if (resumeTimeoutRef.current !== null) window.clearTimeout(resumeTimeoutRef.current);
  }, []);
  const resumeAutoScrollLater = useCallback(() => {
    if (resumeTimeoutRef.current !== null) window.clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = window.setTimeout(() => {
      paused.current = false;
      resumeTimeoutRef.current = null;
    }, 500);
  }, []);

  useEffect(() => { if (!selectedSong && sourceSongs[0]) setSelectedSongId(sourceSongs[0].id); }, [selectedSong, sourceSongs]);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0, behavior: 'auto' }); }, [selectedSong?.id]);
  useEffect(() => { const node = contentRef.current; if (!node || preferences.speed === 0) return; let last = performance.now(); const tick = (time: number) => { const elapsed = Math.min(time - last, 50); last = time; if (!paused.current) node.scrollTop += elapsed * preferences.speed * 0.026; frameRef.current = requestAnimationFrame(tick); }; frameRef.current = requestAnimationFrame(tick); return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); frameRef.current = null; }; }, [preferences.speed, selectedSong?.id]);
  useEffect(() => () => {
    if (resumeTimeoutRef.current !== null) window.clearTimeout(resumeTimeoutRef.current);
  }, []);
  useEffect(() => {
    const navigatorWithWakeLock = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (!navigatorWithWakeLock.wakeLock) return;

    async function requestScreenLock() {
      if (document.visibilityState !== 'visible' || wakeLockRef.current) return;
      try {
        wakeLockRef.current = await navigatorWithWakeLock.wakeLock!.request('screen');
      } catch {
        // The browser may deny Wake Lock; the prompter remains usable without it.
      }
    }

    const handleVisibilityChange = () => void requestScreenLock();
    void requestScreenLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, []);

  function moveSong(song: SongRecord | undefined) { if (!song) return; setSelectedSongId(song.id); setParams((current) => { const next = new URLSearchParams(current); next.set('songId', song.id); return next; }); }
  async function toggleFullscreen() { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); else await document.exitFullscreen?.(); }
  async function closePrompter() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
    } finally {
      navigate('/prompter');
    }
  }

  if (setlists === undefined || songs === undefined || (setlistId && entries === undefined)) return <div className="flex min-h-[100dvh] items-center justify-center bg-[#08090b] text-sm text-white/60">Chargement du prompteur...</div>;
  return <div className="flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-[var(--fz-bg)] text-white">
    <header className="sticky top-0 z-20 shrink-0 border-b border-white/10 bg-[var(--fz-bg)]/98 backdrop-blur-sm"><div className="mx-auto w-full max-w-5xl px-4 pb-2 pt-3 sm:px-6"><div className="relative flex h-11 items-center"><button type="button" onClick={() => void closePrompter()} aria-label="Quitter le prompteur" className={`absolute left-0 z-10 ${headerButtonClass}`}><CloseIcon className="h-5 w-5" /></button><div className="pointer-events-none absolute inset-x-0 min-w-0 px-24 text-center"><p className="truncate text-[0.72rem] font-black uppercase tracking-[0.26em] text-[var(--fz-text-muted)]">FaderZero</p><p className="mt-1 truncate text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55">Prompteur - {sourceLabel}</p></div><div className="absolute right-0 z-10 flex items-center"><button type="button" onClick={() => void toggleFullscreen()} aria-label="Plein écran" className={headerButtonClass}><FullscreenIcon className="h-5 w-5" /></button><button type="button" onClick={() => setSettingsOpen((value) => !value)} aria-expanded={settingsOpen} aria-label="Réglages" className={[headerButtonClass, settingsOpen ? 'text-emerald-300' : ''].join(' ')}><SettingsIcon className="h-5 w-5" /></button></div></div></div></header>
    {settingsOpen ? (
      <section aria-label="Réglages du prompteur" className="sticky top-16 z-10 shrink-0 border-b border-white/10 bg-[#0d0f13] px-3 py-2">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2">
          <div role="group" aria-label="Vitesse de défilement" className="inline-flex rounded-xl bg-black/35 p-1">
            {([0, 1, 2, 3] as const).map((speed) => {
              const isActive = preferences.speed === speed;
              const label = speed === 0 ? 'Arrêter le défilement' : `Vitesse de défilement ${speed}`;
              return <button key={speed} type="button" onClick={() => savePreferences({ ...preferences, speed })} aria-label={label} title={label} aria-pressed={isActive} className={[settingsOptionClass, isActive ? 'bg-emerald-300 text-[#07100a]' : 'text-white/60 hover:bg-white/8 hover:text-white active:bg-white/12'].join(' ')}>{speed === 0 ? <StopIcon className="h-4 w-4" /> : <SpeedIcon count={speed} className="h-5 w-5" />}</button>;
            })}
          </div>
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-white/10" />
          <div role="group" aria-label="Taille du texte" className="inline-flex rounded-xl bg-black/35 p-1">
            {[1, 1.15, 1.3].map((scale) => {
              const isActive = preferences.scale === scale;
              const label = scale === 1 ? 'Texte normal' : scale === 1.15 ? 'Texte agrandi' : 'Texte très agrandi';
              return <button key={scale} type="button" onClick={() => savePreferences({ ...preferences, scale })} aria-label={label} title={label} aria-pressed={isActive} className={[settingsOptionClass, isActive ? 'bg-emerald-300 text-[#07100a]' : 'text-white/60 hover:bg-white/8 hover:text-white active:bg-white/12'].join(' ')}><TextSizeIcon scale={scale} /></button>;
            })}
          </div>
        </div>
      </section>
    ) : null}
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden bg-black px-4 sm:px-6">{selectedSong ? <><section className="flex h-16 shrink-0 touch-none select-none flex-col justify-center border-b border-white/8 text-center"><h1 className="block w-full truncate text-lg font-black sm:text-xl">{selectedSong.title || 'Sans titre'}</h1><div className="mt-1 flex items-center justify-center gap-2 truncate text-[0.68rem] font-bold text-white/60"><span>{selectedSong.bpm ? `${selectedSong.bpm} BPM` : '— BPM'}</span><span aria-hidden="true">·</span><span>{formatDuration(selectedSong.durationSeconds)}</span><span aria-hidden="true">·</span><span>{selectedSong.key || '— Ton'}</span></div></section><div ref={contentRef} onPointerDown={pauseAutoScroll} onPointerUp={resumeAutoScrollLater} onPointerCancel={resumeAutoScrollLater} onWheel={() => { pauseAutoScroll(); resumeAutoScrollLater(); }} className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-1 py-8 sm:px-12 sm:py-12"><Lyrics text={selectedSong.lyrics} scale={preferences.scale} /><p className="pb-8 pt-20 text-center text-xs italic text-white/35">— Fin du morceau —</p></div><div className="pointer-events-none fixed inset-x-0 bottom-[max(4rem,env(safe-area-inset-bottom))] z-30"><div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 sm:px-6"><button type="button" disabled={!previousSong} onClick={() => moveSong(previousSong)} className={`${navigationButtonClass} justify-start text-left`}><span>‹ Précédent<br /><span className="text-white">{previousSong?.title ?? 'Début'}</span></span></button><button type="button" disabled={!nextSong} onClick={() => moveSong(nextSong)} className={`${navigationButtonClass} justify-end text-right`}><span>Suivant ›<br /><span className="text-white">{nextSong?.title ?? 'Fin'}</span></span></button></div></div></> : <div className="flex flex-1 items-center justify-center text-center"><div><p className="text-lg font-black">Aucun morceau disponible</p><p className="mt-2 text-sm text-white/55">Ajoute des chansons ou choisis une autre source.</p><button type="button" onClick={() => void closePrompter()} className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#111319]">Retour au choix</button></div></div>}</main>
  </div>;
}
