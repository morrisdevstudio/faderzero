import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useGoBack } from '@/hooks/useGoBack';
import { hasInAppHistory, resetBackLayersForTests } from '@/navigation/inAppBack';

function BackProbe({ fallback }: { fallback: string }) {
  const location = useLocation();
  const goBack = useGoBack(fallback);
  return (
    <div>
      <p>{`${location.pathname}${location.search}`}</p>
      <button type="button" onClick={goBack}>Retour</button>
    </div>
  );
}

afterEach(() => {
  resetBackLayersForTests();
});

describe('in-app back', () => {
  it('replays the previous screen when the connected app has a history entry', () => {
    render(
      <MemoryRouter initialEntries={['/home', '/songs/song-1']}>
        <Routes>
          <Route path="/home" element={<p>Accueil</p>} />
          <Route path="/songs/:songId" element={<BackProbe fallback="/home" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('/songs/song-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });

  it('falls back when the screen is the first in-app entry', () => {
    render(
      <MemoryRouter initialEntries={['/songs/song-1']}>
        <Routes>
          <Route path="/home" element={<p>Accueil</p>} />
          <Route path="/songs/:songId" element={<BackProbe fallback="/home" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(hasInAppHistory()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });
});
