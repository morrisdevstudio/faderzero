import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    workspaces: [{ id: 'personal-1', name: 'Personnel', type: 'personal' }],
    activeWorkspace: { id: 'personal-1', name: 'Personnel', type: 'personal' },
    setActiveWorkspace: vi.fn(),
  }),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}));

vi.mock('@/db/repositories/eventsRepository', () => ({
  eventsRepository: {
    listUpcoming: vi.fn().mockResolvedValue([
      {
        id: 'evt-1',
        title: 'Concert au Bikini',
        eventType: 'Concert',
        startAt: new Date('2026-09-15T20:00:00Z').getTime(),
      },
    ]),
  },
}));

vi.mock('@/db/db', () => ({
  db: {
    songs: {
      filter: () => ({
        toArray: vi.fn().mockResolvedValue([
          {
            id: 'song-1',
            workspaceId: 'personal-1',
            title: 'New Creation',
            status: 'Idee',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            durationSeconds: 180,
            bpm: 120,
            key: 'Am',
          },
          {
            id: 'song-2',
            workspaceId: 'personal-1',
            title: 'Song No Audio',
            status: 'En cours',
            createdAt: Date.now() - 1000,
            updatedAt: Date.now() - 1000,
            durationSeconds: 200,
            bpm: 100,
            key: 'C',
          },
        ]),
      }),
    },
    songAssets: {
      filter: () => ({
        toArray: vi.fn().mockResolvedValue([
          {
            id: 'asset-1',
            songId: 'song-1',
            workspaceId: 'personal-1',
            filename: 'demo.mp3',
          },
        ]),
      }),
    },
  },
}));

describe('HomePage', () => {
  it('renders cockpit with Hero card, events, toolbox, and recent songs', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Fonctions & Outils')).toBeInTheDocument();
    expect(await screen.findByText('Concert au Bikini')).toBeInTheDocument();
    expect(await screen.findAllByText('New Creation')).toHaveLength(2); // In Hero + in list
    expect(screen.getByLabelText('Dernière modification : New Creation')).toHaveAttribute('href', '/songs/song-1');
    expect(screen.getAllByLabelText('Écouter New Creation')).toHaveLength(2);

    // Navigation tiles
    expect(screen.getByRole('link', { name: /booking/i })).toHaveAttribute('href', '/booking');
    expect(screen.getByRole('link', { name: /setlists/i })).toHaveAttribute('href', '/setlists');

    const songNoAudioLink = await screen.findByRole('link', { name: /Song No Audio/i });
    expect(songNoAudioLink).toHaveAttribute('href', '/songs/song-2');
  });
});
