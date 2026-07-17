import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from '@/app/router';
import { vi } from 'vitest';

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

describe('AppRouter', () => {
  it('renders the songs page shell', () => {
    render(
      <MemoryRouter initialEntries={['/songs']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Repertoire' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouvelle chanson' })).toBeInTheDocument();
  });

  it('renders setlists before songs on the prompter library page', () => {
    render(
      <MemoryRouter initialEntries={['/prompter']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Prompteur' })).toBeInTheDocument();
    const setlistsHeading = screen.getByRole('heading', { level: 2, name: 'Setlists' });
    const songsHeading = screen.getByRole('heading', { level: 2, name: 'Chansons' });
    expect(setlistsHeading.compareDocumentPosition(songsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
