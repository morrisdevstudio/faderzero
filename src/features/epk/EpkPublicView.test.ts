import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { brandForLink } from './epkBrands';
import { EpkPublicView } from './EpkPublicView';
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

describe('contacts publics', () => {
  it('affiche le rôle et le nom dans l’en-tête et les canaux avec leurs icônes', () => {
    const modelWithContact: EpkPublicModel = {
      ...publicModel,
      contacts: [
        {
          name: 'Yann',
          role: 'Manager',
          email: 'yann@example.com',
          phone: '0612345678',
        },
      ],
    };

    const { container } = render(createElement(EpkPublicView, { model: modelWithContact }));

    const header = container.querySelector('.epk-contact-header');
    expect(header).toBeInTheDocument();
    expect(header?.querySelector('small')).toHaveTextContent('Manager');
    expect(header?.querySelector('strong')).toHaveTextContent('Yann');

    const emailLink = container.querySelector('a[href="mailto:yann@example.com"]');
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveTextContent('yann@example.com');
    expect(emailLink?.querySelector('svg')).toBeInTheDocument();

    const phoneLink = container.querySelector('a[href="tel:0612345678"]');
    expect(phoneLink).toBeInTheDocument();
    expect(phoneLink).toHaveTextContent('0612345678');
    expect(phoneLink?.querySelector('svg')).toBeInTheDocument();
  });
});

describe('lecteur audio public', () => {
  it('affiche les pistes et initialise le lecteur avec la première piste', () => {
    const modelWithTracks: EpkPublicModel = {
      ...publicModel,
      tracks: [
        { id: 'track-1', title: 'Première piste', audioUrl: 'https://example.com/track1.mp3' },
        { id: 'track-2', title: 'Deuxième piste', audioUrl: 'https://example.com/track2.mp3' },
      ],
    };

    const { container } = render(createElement(EpkPublicView, { model: modelWithTracks }));

    const player = container.querySelector('.epk-player');
    expect(player).toBeInTheDocument();

    const tracks = container.querySelectorAll('.epk-track');
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toHaveTextContent('Première piste');
    expect(tracks[1]).toHaveTextContent('Deuxième piste');

    const nowInfo = container.querySelector('.epk-now-info strong');
    expect(nowInfo).toHaveTextContent('Première piste');
  });
});
