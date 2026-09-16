import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function ThrowingChild(): never {
  throw new Error('Erreur de test');
}

describe('AppErrorBoundary', () => {
  it('affiche une récupération et relance l’application à la demande', () => {
    const onRetry = vi.fn();

    render(<AppErrorBoundary onRetry={onRetry}><ThrowingChild /></AppErrorBoundary>);

    expect(screen.getByRole('heading', { name: 'Impossible d’afficher cette page' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
