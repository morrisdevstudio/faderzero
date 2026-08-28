import type { EpkVideo } from './epk';

export function youtubeThumbnailUrl(video: Pick<EpkVideo, 'provider' | 'providerVideoId'>): string | undefined {
  return video.provider === 'YOUTUBE' && video.providerVideoId
    ? `https://i.ytimg.com/vi/${encodeURIComponent(video.providerVideoId)}/hqdefault.jpg`
    : undefined;
}
