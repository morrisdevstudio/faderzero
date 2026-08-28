import type { BrandIconName } from '@/ui/icons';

export const brandByLabel = {
  spotify: 'spotify',
  'apple music': 'appleMusic',
  'youtube music': 'youtubeMusic',
  deezer: 'deezer',
  soundcloud: 'soundcloud',
  bandcamp: 'bandcamp',
  'amazon music': 'amazonMusic',
  tidal: 'tidal',
  qobuz: 'qobuz',
  youtube: 'youtube',
  instagram: 'instagram',
  facebook: 'facebook',
  x: 'x',
  twitter: 'x',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
} satisfies Record<string, BrandIconName>;

export const brandUrlMatchers: Array<[BrandIconName, RegExp]> = [
  ['youtubeMusic', /music\.youtube\.com/],
  ['appleMusic', /music\.apple\.com/],
  ['amazonMusic', /music\.amazon\./],
  ['spotify', /spotify\./],
  ['deezer', /deezer\./],
  ['soundcloud', /soundcloud\./],
  ['bandcamp', /bandcamp\./],
  ['tidal', /tidal\./],
  ['qobuz', /qobuz\./],
  ['youtube', /youtube\.|youtu\.be/],
  ['instagram', /instagram\./],
  ['facebook', /facebook\.|fb\.com/],
  ['x', /(?:^|\.)x\.com|twitter\.com/],
  ['tiktok', /tiktok\./],
  ['linkedin', /linkedin\./],
];

export const socialBrands = new Set<BrandIconName>(['instagram', 'facebook', 'youtube', 'x', 'tiktok', 'linkedin']);

export function normalizeBrandLabel(label: string) {
  return label.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function brandForLink(link: { label?: string | null; kind?: string | null; url: string }) {
  const brandFromLabel = brandByLabel[normalizeBrandLabel(link.label || link.kind || '') as keyof typeof brandByLabel];
  return brandFromLabel ?? brandUrlMatchers.find(([, matcher]) => matcher.test(link.url.toLowerCase()))?.[0];
}
