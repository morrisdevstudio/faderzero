import { fireEvent, render, screen } from '@testing-library/react';
import { UndoToast } from './UndoToast';

describe('UndoToast', () => {
  it('affiche le message, déclenche onUndo et onDismiss', () => {
    const onUndo = vi.fn();
    const onDismiss = vi.fn();

    render(
      <UndoToast
        message="Morceau supprimé"
        onUndo={onUndo}
        onDismiss={onDismiss}
        durationMs={10000}
      />
    );

    expect(screen.getByText('Morceau supprimé')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
