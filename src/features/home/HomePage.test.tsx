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
      where: () => ({
        equals: () => ({
          filter: () => ({
            toArray: vi.fn().mockResolvedValue([
              {
                id: 'song-1',
                title: 'New Creation',
                status: 'draft',
                createdAt: Date.now(),
                durationSeconds: 180,
                bpm: 120,
                key: 'Am',
              },
            ]),
          }),
        }),
      }),
    },
  },
}));

vi.mock('@/services/newsFeed', () => ({
  getWorkspaceNewsFeed: vi.fn().mockResolvedValue([]),
}));

describe('HomePage', () => {
  it('renders dashboard with ContentRow for events and songs', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Mon Espace')).toBeInTheDocument();
    expect(await screen.findByText('Concert au Bikini')).toBeInTheDocument();
    expect(await screen.findByText('New Creation')).toBeInTheDocument();
  });
});
