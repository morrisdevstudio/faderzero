import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  beforeEach(() => localStorage.clear());

  it('renders the product-led landing, its pricing, and legal links', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('img', { name: 'FaderZero' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { name: /Du premier riff/i })).toBeInTheDocument();
    expect(screen.getByText(/Une app qui suit le groupe/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Sur scène,/i })).toBeInTheDocument();
    expect(screen.getByText(/Quand le réseau lâche/i)).toBeInTheDocument();
    expect(screen.getByText(/Electronic press kit/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Une offre claire pour chaque projet musical/i })).toBeInTheDocument();
    expect(screen.getByText('20 h')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mentions légales/i })).toHaveAttribute('href', '/legal-notices');
    expect(screen.getByRole('link', { name: /Confidentialité/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /Conditions d’utilisation/i })).toHaveAttribute('href', '/terms');
  });

  it('keeps the landing and pricing content available in English', () => {
    render(<LandingPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'English' })[0]!);

    expect(screen.getByRole('heading', { name: /From the first riff/i })).toBeInTheDocument();
    expect(screen.getByText(/The band workspace/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Available early 2027/i)).toHaveLength(2);
    expect(screen.getByText(/No group creation/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Legal notices/i })).toHaveAttribute('href', '/legal-notices');
  });
});
