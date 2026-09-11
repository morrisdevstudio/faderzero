import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

const mockSetActiveWorkspace = vi.fn();
const mockWorkspaces = [
  { id: 'personal-1', name: 'Personnel', type: 'personal' },
  { id: 'group-a', name: 'Groupe A', type: 'group' },
];

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    workspaces: mockWorkspaces,
    activeWorkspace: { id: 'personal-1', name: 'Personnel', type: 'personal' },
    setActiveWorkspace: mockSetActiveWorkspace,
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
        workspaceId: 'group-a',
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
            workspaceId: 'group-a',
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
  it('renders cockpit with events, toolbox, and recent songs', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.queryByText('Fonctions & Outils')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Activité' })).toBeInTheDocument();
    expect(screen.queryByText('Tout voir')).not.toBeInTheDocument();
    const eventTitle = await screen.findByText('Concert au Bikini');
    const eventTile = eventTitle.closest('.fz-content-row');
    expect(eventTile).toHaveClass('border-l-2');
    expect((eventTile as HTMLElement).style.borderLeftColor).not.toBe('');
    expect(eventTile?.parentElement).toHaveClass('border-y');
    expect(eventTile?.parentElement).not.toHaveClass('rounded-2xl', 'bg-white/[0.02]');
    expect(await screen.findAllByText('New Creation')).toHaveLength(1);
    expect(screen.queryByLabelText('Dernière modification : New Creation')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Écouter New Creation')).toHaveLength(1);

    // Navigation tiles
    expect(screen.getByRole('link', { name: /booking/i })).toHaveAttribute('href', '/booking');
    expect(screen.getByRole('link', { name: /setlists/i })).toHaveAttribute('href', '/setlists');

    const songNoAudioLink = await screen.findByRole('link', { name: /Song No Audio/i });
    expect(songNoAudioLink).toHaveAttribute('href', '/songs/song-2');
    expect(songNoAudioLink).toHaveClass('border-l-2');
    expect(songNoAudioLink.style.borderLeftColor).toBe((eventTile as HTMLElement).style.borderLeftColor);
    expect(songNoAudioLink.parentElement).toHaveClass('border-y');
    expect(songNoAudioLink.querySelector('[data-icon="songs"]')).not.toBeInTheDocument();

    fireEvent.click(songNoAudioLink);
    expect(mockSetActiveWorkspace).toHaveBeenCalledWith(mockWorkspaces[1]);
  });
});
