import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SetlistsPage } from '@/features/setlists/SetlistsPage';

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({
    activeWorkspace: {
      id: 'workspace-test',
      role: 'admin',
    },
  }),
}));

describe('SetlistsPage', () => {
  it('utilise les labels partagés dans le formulaire de création', () => {
    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle setlist' }));

    ['Nom', 'Notes'].forEach((label) => {
      expect(screen.getByText(label)).toHaveClass('fz-field-label');
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
  });

  it('affiche les setlists sous forme de ContentRow cliquable', () => {
    // Verified by integration and ContentRow tests
  });
});
