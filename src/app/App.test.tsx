import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from '@/app/router';
import { vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

const testWorkspace = {
  id: 'workspace-test',
  name: 'Test workspace',
  createdBy: 'user-test',
  createdAt: '2026-07-20T20:00:00.000Z',
  updatedAt: '2026-07-20T20:00:00.000Z',
  role: 'admin' as const,
  type: 'group' as const,
};

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

describe('AppRouter', () => {
  it('renders the songs page shell', async () => {
    useAuthStore.setState({ activeWorkspace: testWorkspace });
    render(
      <MemoryRouter initialEntries={['/songs']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Repertoire' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouvelle chanson' })).toBeInTheDocument();
  });

  it('keeps the songs page read-only for a guest', async () => {
    useAuthStore.setState({ activeWorkspace: { ...testWorkspace, role: 'guest' } });

    render(
      <MemoryRouter initialEntries={['/songs']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Repertoire' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nouvelle chanson' })).not.toBeInTheDocument();
  });

  it('renders setlists before songs on the prompter library page', async () => {
    render(
      <MemoryRouter initialEntries={['/prompter']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Prompteur' })).toBeInTheDocument();
    const setlistsHeading = await screen.findByRole('heading', { level: 2, name: 'Setlists' });
    const songsHeading = screen.getByRole('heading', { level: 2, name: 'Chansons' });
    expect(setlistsHeading.compareDocumentPosition(songsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
