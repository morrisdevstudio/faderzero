import type { ComponentPropsWithoutRef } from 'react';

const brands = {
  spotify: [new URL('../../../docs/icones/spotify-1ED760.svg', import.meta.url).href, '#1ED760'],
  appleMusic: [new URL('../../../docs/icones/applemusic-FA243C.svg', import.meta.url).href, '#FA243C'],
  youtubeMusic: [new URL('../../../docs/icones/youtubemusic-FF0000.svg', import.meta.url).href, '#FF0000'],
  deezer: [new URL('../../../docs/icones/deezer-A238FF.svg', import.meta.url).href, '#A238FF'],
  soundcloud: [new URL('../../../docs/icones/soundcloud-FF5500.svg', import.meta.url).href, '#FF5500'],
  bandcamp: [new URL('../../../docs/icones/bandcamp-408294.svg', import.meta.url).href, '#408294'],
  amazonMusic: [new URL('../../../docs/icones/amazon-music-6ae7ef.svg', import.meta.url).href, '#6AE7EF'],
  tidal: [new URL('../../../docs/icones/tidal-000000.svg', import.meta.url).href, '#000000'],
  qobuz: [new URL('../../../docs/icones/qobuz-000000.svg', import.meta.url).href, '#000000'],
  youtube: [new URL('../../../docs/icones/youtube-FF0000.svg', import.meta.url).href, '#FF0000'],
  instagram: [new URL('../../../docs/icones/instagram-FF0069.svg', import.meta.url).href, '#FF0069'],
  facebook: [new URL('../../../docs/icones/facebook-0866FF.svg', import.meta.url).href, '#0866FF'],
  x: [new URL('../../../docs/icones/x-000000.svg', import.meta.url).href, '#000000'],
  tiktok: [new URL('../../../docs/icones/tiktok-000000.svg', import.meta.url).href, '#000000'],
  linkedin: [new URL('../../../docs/icones/linkedin-0c61c0.svg', import.meta.url).href, '#0C61C0']
} as const;

export type BrandIconName = keyof typeof brands;

type Props = Omit<ComponentPropsWithoutRef<'span'>, 'children' | 'color'> & {
  name: BrandIconName;
};

export function BrandIcon({ name, ...props }: Props) {
  const [assetUrl, color] = brands[name];
  const needsContrast = color === '#000000';
  const mask = `url("${assetUrl}") center / contain no-repeat`;

  return (
    <span
      {...props}
      style={{
        display: 'inline-block',
        width: 24,
        height: 24,
        flex: '0 0 auto',
        ...(needsContrast ? { backgroundColor: '#FFFFFF', borderRadius: '22%', padding: 2 } : {}),
        ...props.style
      }}
      aria-hidden="true"
      data-brand-icon={name}
    >
      <span
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          backgroundColor: color,
          mask,
          WebkitMask: mask
        }}
      />
    </span>
  );
}
