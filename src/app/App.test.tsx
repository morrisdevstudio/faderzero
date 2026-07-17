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
    expect(screen.getByText('+ Nouvelle')).toBeInTheDocument();
  });
});
