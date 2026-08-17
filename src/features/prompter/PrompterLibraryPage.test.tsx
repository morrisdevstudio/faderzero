import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PrompterLibraryPage } from './PrompterLibraryPage';

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => {
    // Return sample setlists and songs
    return [
      {
        id: 'setlist-1',
        name: 'Setlist Tour 2026',
        songCount: 12,
        totalDurationSeconds: 2700,
      },
    ];
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({
    activeWorkspace: {
      id: 'workspace-test',
    },
  }),
}));

describe('PrompterLibraryPage', () => {
  it('renders setlists and songs using ContentRow links', () => {
    render(
      <MemoryRouter>
        <PrompterLibraryPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Prompteur')).toBeInTheDocument();
    expect(screen.getByText('Setlist Tour 2026')).toBeInTheDocument();
    expect(screen.getByText('12 morceaux · 45:00')).toBeInTheDocument();
  });
});
