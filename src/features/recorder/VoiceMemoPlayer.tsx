import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatRecordingDuration } from './voiceRecorderEngine';
import { FzIcon } from '@/ui/icons';

interface VoiceMemoPlayerProps {
  src: string;
  durationMs: number;
}

export function VoiceMemoPlayer({ src, durationMs }: VoiceMemoPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(Math.max(0, durationMs / 1000));
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    setIsPlaying(false);
    setCurrentTime(0);
    setMediaDuration(Math.max(0, durationMs / 1000));
    setPlaybackError(null);

    return () => {
      audio?.pause();
    };
  }, [durationMs, src]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      setPlaybackError(null);
      await audio.play();
      setIsPlaying(true);
    } catch {
      setPlaybackError('Lecture impossible sur cet appareil.');
      setIsPlaying(false);
    }
  }

  function seek(nextTime: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const boundedTime = Math.max(0, Math.min(mediaDuration, nextTime));
    audio.currentTime = boundedTime;
    setCurrentTime(boundedTime);
  }

  const progress = mediaDuration > 0 ? Math.min(100, (currentTime / mediaDuration) * 100) : 0;
  const scrubberStyle = {
    '--fz-audio-progress': `${progress}%`,
  } as CSSProperties;

  return (
    <div className="rounded-2xl bg-white/[0.045] p-3.5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          if (Number.isFinite(nextDuration) && nextDuration > 0) {
            setMediaDuration(nextDuration);
          }
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          aria-label={isPlaying ? 'Mettre en pause' : 'Écouter la prise'}
          className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition-[transform,background-color] duration-150 ease-out hover:bg-white/90 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {isPlaying ? (
            <FzIcon name="pause" usageId="voice-memo-player.pause" size="md" />
          ) : (
            <FzIcon name="play" usageId="voice-memo-player.play" size="md" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <span className="text-sm font-black text-white">Prise enregistrée</span>
            <span className="font-mono text-xs font-bold tabular-nums text-white/70">
              {formatRecordingDuration(mediaDuration * 1000)}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max={Math.max(mediaDuration, 0.01)}
            step="0.01"
            value={Math.min(currentTime, mediaDuration)}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Position dans l'enregistrement"
            className="fz-audio-scrubber"
            style={scrubberStyle}
          />

          <div className="flex items-center justify-between px-1 font-mono text-[0.68rem] font-bold tabular-nums text-white/45">
            <span>{formatRecordingDuration(currentTime * 1000)}</span>
            <span>{isPlaying ? 'Lecture' : 'Prêt'}</span>
          </div>
        </div>
      </div>

      {playbackError ? <p className="mt-2 text-center text-xs text-red-300" role="alert">{playbackError}</p> : null}
    </div>
  );
}
