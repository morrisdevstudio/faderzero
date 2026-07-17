import { Link } from 'react-router-dom';
import { useAudioPlayerStore } from '@/features/audio/audioPlayerStore';
import { formatSongDuration } from '@/features/songs/songPresentation';

function PreviousIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M6 5h2v14H6z" />
      <path d="m19 6-9 6 9 6z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M7 7h10v10H7z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M16 5h2v14h-2z" />
      <path d="m5 6 9 6-9 6z" />
    </svg>
  );
}

function formatTime(value: number) {
  return formatSongDuration(Math.floor(value));
}

export function AudioMiniPlayer() {
  const queue = useAudioPlayerStore((state) => state.queue);
  const currentIndex = useAudioPlayerStore((state) => state.currentIndex);
  const status = useAudioPlayerStore((state) => state.status);
  const currentTime = useAudioPlayerStore((state) => state.currentTime);
  const duration = useAudioPlayerStore((state) => state.duration);
  const error = useAudioPlayerStore((state) => state.error);
  const togglePlayPause = useAudioPlayerStore((state) => state.togglePlayPause);
  const stop = useAudioPlayerStore((state) => state.stop);
  const previous = useAudioPlayerStore((state) => state.previous);
  const next = useAudioPlayerStore((state) => state.next);
  const seek = useAudioPlayerStore((state) => state.seek);
  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : undefined;

  if (!currentTrack || status === 'idle') {
    return null;
  }

  const isPlaying = status === 'playing';
  const canGoPrevious = currentIndex > 0 || currentTime > 0;
  const canGoNext = currentIndex < queue.length - 1;
  const progressValue = duration > 0 ? Math.min(currentTime, duration) : 0;

  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#111316]/96 text-white shadow-[0_-22px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-md px-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-3 sm:px-4">
        <div className="flex items-center gap-3">
          {currentTrack.songId ? (
            <Link
              to={`/songs/${currentTrack.songId}`}
              className="min-w-0 flex-1"
              aria-label={`Ouvrir ${currentTrack.title}`}
            >
              <p className="truncate text-[0.95rem] font-black tracking-tight text-white">{currentTrack.title}</p>
              <p className="mt-0.5 truncate text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/45">
                {status === 'loading' ? 'Chargement audio' : currentTrack.filename}
              </p>
            </Link>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.95rem] font-black tracking-tight text-white">{currentTrack.title}</p>
              <p className="mt-0.5 truncate text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/45">
                {status === 'loading' ? 'Chargement audio' : currentTrack.filename}
              </p>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void previous()}
              disabled={!canGoPrevious}
              aria-label="Piste precedente"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/78 transition hover:bg-white/8 hover:text-white disabled:opacity-35"
            >
              <PreviousIcon />
            </button>
            <button
              type="button"
              onClick={() => void togglePlayPause()}
              aria-label={isPlaying ? 'Pause' : 'Lecture'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#111316] transition hover:bg-white/88"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              onClick={() => stop()}
              aria-label="Stop"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/78 transition hover:bg-white/8 hover:text-white"
            >
              <StopIcon />
            </button>
            <button
              type="button"
              onClick={() => void next()}
              disabled={!canGoNext}
              aria-label="Piste suivante"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/78 transition hover:bg-white/8 hover:text-white disabled:opacity-35"
            >
              <NextIcon />
            </button>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-[2.7rem_minmax(0,1fr)_2.7rem] items-center gap-2 text-[0.62rem] font-semibold text-white/45">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={progressValue}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Position de lecture"
            className="h-1.5 w-full accent-white"
          />
          <span className="text-right">{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>

        {error ? <p className="mt-2 text-[0.7rem] font-semibold text-rose-300">{error}</p> : null}
      </div>
    </aside>
  );
}
