import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { setForcedOffline } from '@/services/connectivity';
import { useAuthStore } from '@/stores/authStore';

const workspace = {
  id: 'workspace-test',
  name: 'Groupe test',
  createdBy: 'user-test',
  createdAt: '2026-07-20T20:00:00.000Z',
  updatedAt: '2026-07-20T20:00:00.000Z',
  role: 'admin' as const,
  type: 'group' as const,
};

function LocationLabel() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

describe('AppShell logo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    setForcedOffline(false);
    useAuthStore.setState({ activeWorkspace: workspace, workspaces: [workspace] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps short clicks as navigation to home', () => {
    render(
      <MemoryRouter initialEntries={['/songs']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/songs" element={<LocationLabel />} />
            <Route path="/home" element={<LocationLabel />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'FaderZero Accueil' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/home');
  });

  it('toggles forced offline after a long press without navigating', () => {
    render(
      <MemoryRouter initialEntries={['/songs']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/songs" element={<LocationLabel />} />
            <Route path="/home" element={<LocationLabel />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const logo = screen.getByRole('link', { name: 'FaderZero Accueil' });

    fireEvent.pointerDown(logo, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(700));
    fireEvent.pointerUp(logo);
    fireEvent.click(logo);

    expect(screen.getByText('Hors ligne · test')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/songs');

    fireEvent.pointerDown(logo, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(700));
    fireEvent.pointerUp(logo);
    fireEvent.click(logo);

    expect(screen.queryByText('Hors ligne · test')).not.toBeInTheDocument();
  });

  it('offers the voice recorder from the central quick actions button', () => {
    render(
      <MemoryRouter initialEntries={['/songs']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/songs" element={<LocationLabel />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Actions rapides/ }));

    expect(screen.getByRole('button', { name: 'Enregistrer une idée' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouvelles paroles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prompteur' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Métronome' })).toBeInTheDocument();
  });

  it('hides recording for read-only guests', () => {
    useAuthStore.setState({
      activeWorkspace: { ...workspace, role: 'guest' },
      workspaces: [{ ...workspace, role: 'guest' }],
    });

    render(
      <MemoryRouter initialEntries={['/songs']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/songs" element={<LocationLabel />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Actions rapides/ }));

    expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
  });
});
