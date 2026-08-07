import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CurrentIconPreview } from './CurrentIconPreview';

describe('CurrentIconPreview', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('affiche une vraie image publique', () => {
    render(<CurrentIconPreview occurrence={{ source: 'public/favicon.svg', format: 'svg' }} />);
    const image = screen.getByRole('img', { name: 'Icône actuelle : public/favicon.svg' });
    expect(image).toHaveAttribute('src', '/favicon.svg');
    expect(screen.getByText('public/favicon.svg')).toBeInTheDocument();
  });

  it('affiche un symbole du sprite et son état de chargement', () => {
    render(<CurrentIconPreview occurrence={{ source: '/icons.svg#discord-icon', format: 'svg-sprite' }} />);
    const image = screen.getByRole('img', { name: 'Icône actuelle : icons.svg#discord-icon' });
    expect(image).toHaveAttribute('src', '/api/icon-sprite/discord-icon');
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.getByText('Sprite SVG · discord-icon')).toBeInTheDocument();
    fireEvent.load(image);
    expect(screen.queryByText('Chargement…')).not.toBeInTheDocument();
  });

  it('annonce une erreur de symbole sans cercle de secours', () => {
    render(<CurrentIconPreview occurrence={{ source: '/icons.svg#missing', format: 'svg-sprite' }} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('Aperçu indisponible')).toBeInTheDocument();
    expect(screen.getByText('Symbole du sprite introuvable')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('garde une raison explicite pour un composant React', () => {
    render(<CurrentIconPreview occurrence={{ format: 'react-component', name: 'CalendarIcon' }} />);
    expect(screen.getByText('Rendu dépendant des propriétés React')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('charge un aperçu SVG inline via son occurrenceId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    render(<CurrentIconPreview occurrence={{ occurrenceId: 'inline_1', format: 'inline-svg' }} />);
    const image = screen.getByRole('img', { name: 'Icône actuelle : inline_1' });
    expect(image).toHaveAttribute('src', '/api/icon-inline/inline_1');
    expect(screen.getByText('SVG inline')).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/icon-inline/inline_1'));
    fireEvent.load(image);
    expect(screen.queryByText('Chargement…')).not.toBeInTheDocument();
  });

  it('affiche la raison fournie par l’endpoint inline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'occurrence SVG ambiguë' } }) }));
    render(<CurrentIconPreview occurrence={{ occurrenceId: 'inline_2', format: 'inline-svg' }} />);
    expect(await screen.findByText('occurrence SVG ambiguë')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('charge un composant React sans cercle de secours', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    render(<CurrentIconPreview occurrence={{ occurrenceId: 'react_1', name: 'CalendarIcon', format: 'react-component' }} />);
    expect(screen.getByRole('img', { name: 'Icône actuelle : CalendarIcon' })).toHaveAttribute('src', '/api/icon-component/react_1');
    expect(screen.getByText('Composant React · CalendarIcon')).toBeInTheDocument();
  });
  it('utilise une capture Playwright seulement après l’échec statique', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'rendu dépendant des propriétés React' } }) })
      .mockResolvedValueOnce({ ok: true }));
    render(<CurrentIconPreview occurrence={{ occurrenceId: 'dynamic_1', name: 'EyeIcon', format: 'react-component' }} />);
    expect(await screen.findByText('Capture Playwright · dynamic_1')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', '/api/icon-capture/dynamic_1');
  });
});
