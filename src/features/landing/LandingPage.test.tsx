import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders landing page with core pillars and offline banner in French by default', () => {
    render(<LandingPage />);

    // Header & Footer Logos
    expect(screen.getAllByRole('img', { name: 'FaderZero' }).length).toBeGreaterThanOrEqual(1);

    // Hero title
    expect(screen.getByText(/Le cockpit de scène/i)).toBeInTheDocument();
    expect(screen.getByText(/pour les groupes et musiciens live/i)).toBeInTheDocument();

    // Offline banner
    expect(screen.getByText(/ARCHITECTURE OFFLINE-FIRST/i)).toBeInTheDocument();

    // Real Feature pillars
    expect(screen.getByText(/Prompteur de scène haute lisibilité/i)).toBeInTheDocument();
    expect(screen.getByText(/Ordre de passage de concert et transitions personnalisées/i)).toBeInTheDocument();
    expect(screen.getByText(/Métronome visuel synchronisé à votre liste de morceaux/i)).toBeInTheDocument();
    expect(screen.getByText(/Bibliothèque centralisée des paroles et fichiers audio/i)).toBeInTheDocument();
    expect(screen.getByText(/Calendrier de répétitions, balances et dates de concert/i)).toBeInTheDocument();

    // FAQ Section
    expect(screen.getByText(/QUESTIONS FRÉQUENTES/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Une offre claire pour chaque projet musical/i })).toBeInTheDocument();
    expect(screen.getByText('20 h')).toBeInTheDocument();
    expect(screen.getByText(/Sans création de groupe/i)).toBeInTheDocument();
  });

  it('switches seamlessly to English when toggling language', () => {
    render(<LandingPage />);

    // Click on English button in footer or header
    const enButton = screen.getByRole('button', { name: 'English' });
    fireEvent.click(enButton);

    // Check English texts
    expect(screen.getByText(/The live stage cockpit/)).toBeInTheDocument();
    expect(screen.getByText(/for bands and gigging musicians/)).toBeInTheDocument();
    expect(screen.getByText(/OFFLINE-FIRST ARCHITECTURE/)).toBeInTheDocument();
    expect(screen.getAllByText(/Available early 2027/i).length).toBeGreaterThan(0);
  });

  it('allows interacting with the demo tabs (Prompter, Setlist, Metronome)', () => {
    render(<LandingPage />);

    // Switch to Metronome demo tab
    const metroTab = screen.getByRole('button', { name: /métronome scène/i });
    fireEvent.click(metroTab);

    expect(screen.getAllByText(/93/i).length).toBeGreaterThanOrEqual(1);

    // Switch to Setlist demo tab
    const setlistTab = screen.getByRole('button', { name: /setlist concert/i });
    fireEvent.click(setlistTab);
    expect(screen.getAllByText(/aefazf/i).length).toBeGreaterThanOrEqual(1);

    // Switch to Prompter demo tab
    const prompterTab = screen.getByRole('button', { name: /prompteur live/i });
    fireEvent.click(prompterTab);
    expect(screen.getAllByText(/Rien à perdre/i).length).toBeGreaterThanOrEqual(1);
  });

  it('toggles FAQ accordion items', () => {
    render(<LandingPage />);

    const firstQuestionBtn = screen.getByText(/Pourquoi FaderZero fonctionne-t-il sans connexion internet/i);
    expect(firstQuestionBtn).toBeInTheDocument();

    // The first item is open by default
    expect(screen.getByText(/FaderZero est conçu en Offline-First/i)).toBeInTheDocument();

    // Click to close
    fireEvent.click(firstQuestionBtn);
    expect(screen.queryByText(/FaderZero est conçu en Offline-First/i)).not.toBeInTheDocument();

    // Click to re-open
    fireEvent.click(firstQuestionBtn);
    expect(screen.getByText(/FaderZero est conçu en Offline-First/i)).toBeInTheDocument();
  });
});
