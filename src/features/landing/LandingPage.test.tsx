import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('mounts the supplied landing document and its primary calls to action', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { name: /Du premier riff\s*au dernier rappel/i })).toBeInTheDocument();
    expect(screen.getByText(/Une app qui suit le groupe/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Sur scène,?\s*zéro friction/i })).toBeInTheDocument();
    expect(screen.getByText(/Quand le réseau lâche/i)).toBeInTheDocument();
    expect(screen.getByText(/Electronic press kit/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Une offre claire pour chaque projet musical/i })).toBeInTheDocument();
    expect(screen.getByText('20 h')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ouvrir FaderZero/i })).toHaveAttribute('href', 'https://fader.pages.dev/?view=app');
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute('href', '/legal-notices');
    expect(screen.getByRole('link', { name: 'Politique cookies' })).toHaveAttribute('href', '/cookies');
  });
});
