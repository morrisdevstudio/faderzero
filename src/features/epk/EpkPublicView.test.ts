import { createElement } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    expect(container.querySelector('a[href="#espace-pro"] svg')).toHaveClass('lucide-folder');
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    expect(container.querySelector('input.fz-audio-scrubber')).toHaveAttribute('aria-label', 'Position de lecture');
  });

  it('assigne la source audio au premier clic sur la piste déjà sélectionnée', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const modelWithTracks: EpkPublicModel = {
      ...publicModel,
      tracks: [{ id: 'track-1', title: 'Okay', audioUrl: 'https://media.faderzero.com/epks/kicked/okay.mp3' }],
    };

    const { container } = render(createElement(EpkPublicView, { model: modelWithTracks }));
    fireEvent.click(container.querySelector('.epk-now-btn')!);

    await waitFor(() => {
      expect(container.querySelector('audio')?.getAttribute('src')).toBe('https://media.faderzero.com/epks/kicked/okay.mp3');
    });
    expect(play).toHaveBeenCalled();
  });

  it('utilise la route audio publique si le snapshot n’a pas d’audioUrl', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const modelWithTracks: EpkPublicModel = {
      ...publicModel,
      slug: 'kickedtoheaven',
      tracks: [{ id: '13c0bd29-2584-43c0-bcf5-067182171508', title: 'Okay' }],
    };

    const { container } = render(createElement(EpkPublicView, { model: modelWithTracks }));
    fireEvent.click(container.querySelector('.epk-now-btn')!);

    await waitFor(() => {
      expect(container.querySelector('audio')?.getAttribute('src')).toBe(
        '/api/public/kickedtoheaven/tracks/13c0bd29-2584-43c0-bcf5-067182171508/audio',
      );
    });
  });
});

describe('médias publics', () => {
  it('affiche les photos via /media/preview quand le snapshot n’a pas de previewUrl', () => {
    const previewId = 'fc1fdb33-f7c8-4506-8812-d9df05cb9f1d';
    const modelWithPhotos: EpkPublicModel = {
      ...publicModel,
      photos: [{ id: '2c8aae7a-f045-47e2-a9fa-37a373132402', previewAssetId: previewId }],
    };

    const { container } = render(createElement(EpkPublicView, { model: modelWithPhotos }));
    expect(container.querySelector('.epk-photo-carousel img')).toHaveAttribute('src', `/media/preview/${previewId}`);
  });

  it('affiche la miniature YouTube et charge l’iframe au clic', () => {
    const modelWithVideo: EpkPublicModel = {
      ...publicModel,
      videos: [{ id: '09192ea1-74e3-4e67-b3ff-b1bf744b1600', title: 'black cat', provider: 'YOUTUBE', providerVideoId: 'l-JEg4MlMRk' }],
    };

    const { container } = render(createElement(EpkPublicView, { model: modelWithVideo }));
    expect(container.querySelector('.epk-video-poster img')).toHaveAttribute('src', 'https://i.ytimg.com/vi/l-JEg4MlMRk/hqdefault.jpg');
    expect(container.querySelector('.epk-video iframe')).not.toBeInTheDocument();

    fireEvent.click(container.querySelector('.epk-video-poster')!);
    expect(container.querySelector('.epk-video iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/l-JEg4MlMRk?autoplay=1');
  });
});

describe('espace pro public', () => {
  it('affiche l’icône choisie et la description, pas le type', () => {
    const modelWithDocument: EpkPublicModel = {
      ...publicModel,
      documents: [
        {
          id: 'doc-1',
          assetId: 'asset-1',
          title: 'Rider technique',
          description: 'Pour les salles',
          icon: 'file-music',
          updatedAt: '2026-09-04',
        },
      ],
    };

    const { container } = render(createElement(EpkPublicView, { model: modelWithDocument }));
    const section = container.querySelector('#espace-pro');
    expect(section?.querySelector('svg')).toHaveClass('lucide-file-music');
    expect(section).toHaveTextContent('Rider technique');
    expect(section).toHaveTextContent('Pour les salles');
    expect(section).not.toHaveTextContent('TECH_RIDER');
  });

  it('utilise l’icône document si le snapshot n’a pas d’icône', () => {
    const modelWithLegacyDocument: EpkPublicModel = {
      ...publicModel,
      documents: [
        {
          id: 'doc-2',
          assetId: 'asset-2',
          title: 'Ancien fichier',
          type: 'TECH_RIDER',
          updatedAt: '2026-01-01',
        },
      ],
    };

    const { container } = render(createElement(EpkPublicView, { model: modelWithLegacyDocument }));
    const section = container.querySelector('#espace-pro');
    expect(section?.querySelector('svg')).toHaveClass('lucide-file-text');
    expect(section).toHaveTextContent('Ancien fichier');
    expect(section).not.toHaveTextContent('TECH_RIDER');
  });
});
