import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { brandForLink, EpkPublicView } from './EpkPublicView';
import { DEFAULT_EPK_EDITORIAL, DEFAULT_EPK_SECTION_ORDER, type EpkPublicModel } from './epkPresentation';

const publicModel: EpkPublicModel = {
  name: 'Groupe test',
  slug: 'groupe-test',
  genres: ['Rock'],
  accentColor: '#ff3a63',
  sectionOrder: DEFAULT_EPK_SECTION_ORDER,
  hiddenSections: [],
  editorial: DEFAULT_EPK_EDITORIAL,
  videos: [],
  tracks: [],
  photos: [],
  documents: [],
  contacts: [],
  links: [],
};

describe('bannière publique', () => {
  it('ne remplace pas une phrase d’accroche vide par le style musical', () => {
    const { container } = render(createElement(EpkPublicView, { model: publicModel }));

    expect(container.querySelector('.epk-chip')).toHaveTextContent('Rock');
    expect(container.querySelector('.epk-hero-content > p')).not.toBeInTheDocument();
  });
});

describe('brandForLink', () => {
  it('priorise le réseau sélectionné sur une URL copiée depuis un autre service', () => {
    expect(brandForLink({ label: 'X', url: 'https://www.instagram.com/groupe/' })).toBe('x');
    expect(brandForLink({ label: 'TikTok', url: 'https://www.instagram.com/groupe/' })).toBe('tiktok');
    expect(brandForLink({ label: 'LinkedIn', url: 'https://www.instagram.com/groupe/' })).toBe('linkedin');
  });

  it('ne reconnaît plus Twitch comme un réseau public', () => {
    expect(brandForLink({ label: 'Twitch', url: 'https://www.twitch.tv/groupe' })).toBeUndefined();
  });

  it.each([
    ['Spotify', 'spotify'],
    ['Apple Music', 'appleMusic'],
    ['YouTube Music', 'youtubeMusic'],
    ['Deezer', 'deezer'],
    ['SoundCloud', 'soundcloud'],
    ['Bandcamp', 'bandcamp'],
    ['Amazon Music', 'amazonMusic'],
    ['Tidal', 'tidal'],
    ['Qobuz', 'qobuz'],
    ['Instagram', 'instagram'],
    ['Facebook', 'facebook'],
    ['YouTube', 'youtube'],
    ['X', 'x'],
    ['TikTok', 'tiktok'],
    ['LinkedIn', 'linkedin']
  ] as const)('associe %s à son logo officiel', (label, brand) => {
    expect(brandForLink({ label, url: 'https://example.com/profil' })).toBe(brand);
  });
});
