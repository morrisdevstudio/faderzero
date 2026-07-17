import { create } from 'zustand';
import { getSongAssetPlaybackUrl } from '@/services/supabase/storage';
import { useAuthStore } from '@/stores/authStore';
import { getCachedAudioUrl } from '@/features/audio/audioCacheStore';

export interface AudioTrack {
  assetId: string;
  songId?: string;
  title: string;
  filename: string;
  sizeBytes?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface AudioPlayerState {
  queue: AudioTrack[];
  currentIndex: number;
  status: PlaybackStatus;
  error: string | null;
  currentTime: number;
  duration: number;
  playQueue: (tracks: AudioTrack[], startAssetId?: string) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (timeSeconds: number) => void;
}

let audioElement: HTMLAudioElement | null = null;
let activeObjectURL: string | null = null;

function getCurrentTrack(state: AudioPlayerState) {
  return state.currentIndex >= 0 ? state.queue[state.currentIndex] : undefined;
}

function ensureAudioElement(
  set: (partial: Partial<AudioPlayerState>) => void,
  get: () => AudioPlayerState
) {
  if (audioElement) {
    return audioElement;
  }

  audioElement = new Audio();
  audioElement.addEventListener('play', () => set({ status: 'playing', error: null }));
  audioElement.addEventListener('pause', () => {
    if (get().status !== 'idle') {
      set({ status: 'paused' });
    }
  });
  audioElement.addEventListener('timeupdate', () => {
    if (!audioElement) {
      return;
    }

    set({
      currentTime: audioElement.currentTime,
      duration: Number.isFinite(audioElement.duration) ? audioElement.duration : 0,
    });
  });
  audioElement.addEventListener('loadedmetadata', () => {
    if (!audioElement) {
      return;
    }

    set({
      duration: Number.isFinite(audioElement.duration) ? audioElement.duration : 0,
    });
  });
  audioElement.addEventListener('ended', () => {
    void get().next();
  });
  audioElement.addEventListener('error', () => {
    set({ status: 'error', error: 'Impossible de lire cette piste.' });
  });

  return audioElement;
}

async function playTrackAtIndex(
  index: number,
  set: (partial: Partial<AudioPlayerState>) => void,
  get: () => AudioPlayerState
) {
  const track = get().queue[index];
  if (!track) {
    return;
  }

  const audio = ensureAudioElement(set, get);
  const workspaceId = useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
  set({ currentIndex: index, status: 'loading', error: null, currentTime: 0, duration: 0 });

  try {
    audio.pause();
    if (activeObjectURL) {
      URL.revokeObjectURL(activeObjectURL);
      activeObjectURL = null;
    }

    const cachedUrl = await getCachedAudioUrl(track.assetId);
    if (cachedUrl) {
      audio.src = cachedUrl;
      activeObjectURL = cachedUrl;
    } else {
      if (!navigator.onLine) {
        set({ status: 'error', error: 'Hors ligne et morceau non disponible en cache.' });
        return;
      }
      audio.src = await getSongAssetPlaybackUrl(workspaceId, track.assetId);
    }
    audio.currentTime = 0;
    await audio.play();
  } catch {
    set({ status: 'error', error: 'Impossible de lancer la lecture audio.' });
  }
}

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  status: 'idle',
  error: null,
  currentTime: 0,
  duration: 0,

  async playQueue(tracks, startAssetId) {
    if (tracks.length === 0) {
      return;
    }

    const requestedIndex = startAssetId
      ? tracks.findIndex((track) => track.assetId === startAssetId)
      : 0;
    const nextIndex = requestedIndex >= 0 ? requestedIndex : 0;

    set({ queue: tracks, currentIndex: nextIndex });
    await playTrackAtIndex(nextIndex, set, get);
  },

  async togglePlayPause() {
    const state = get();
    const track = getCurrentTrack(state);
    if (!track) {
      return;
    }

    const audio = ensureAudioElement(set, get);
    if (state.status === 'playing') {
      audio.pause();
      return;
    }

    if (!audio.src) {
      await playTrackAtIndex(state.currentIndex, set, get);
      return;
    }

    try {
      await audio.play();
    } catch {
      set({ status: 'error', error: 'Impossible de reprendre la lecture audio.' });
    }
  },

  stop() {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.removeAttribute('src');
      audioElement.load();
    }
    if (activeObjectURL) {
      URL.revokeObjectURL(activeObjectURL);
      activeObjectURL = null;
    }

    set({ status: 'idle', currentTime: 0, duration: 0, error: null });
  },

  async next() {
    const state = get();
    if (state.currentIndex < state.queue.length - 1) {
      await playTrackAtIndex(state.currentIndex + 1, set, get);
      return;
    }

    get().stop();
  },

  async previous() {
    const state = get();
    if (state.currentIndex > 0) {
      await playTrackAtIndex(state.currentIndex - 1, set, get);
      return;
    }

    if (audioElement) {
      audioElement.currentTime = 0;
    }
    set({ currentTime: 0 });
  },

  seek(timeSeconds) {
    if (!audioElement) {
      return;
    }

    audioElement.currentTime = Math.max(0, Math.min(timeSeconds, audioElement.duration || 0));
    set({ currentTime: audioElement.currentTime });
  },
}));
