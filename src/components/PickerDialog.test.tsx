import { fireEvent, render, screen } from '@testing-library/react';
import { PickerDialog } from './PickerDialog';

describe('PickerDialog', () => {
  it('associe son titre et sa description au dialogue', () => {
    render(
      <PickerDialog
        title="Sélectionner le tempo"
        description="Choisis une valeur en BPM."
        onClose={() => {}}
      >
        <button type="button">120 BPM</button>
      </PickerDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Sélectionner le tempo' });
    expect(dialog).toHaveClass('fz-dialog-panel', 'fz-dialog-panel--bottom');
    expect(dialog).toHaveAccessibleDescription('Choisis une valeur en BPM.');
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
  });

  it('respecte les safe areas du viewport', () => {
    render(<PickerDialog title="Sélectionner le tempo" onClose={() => {}}>Contenu</PickerDialog>);

    const backdrop = screen.getByRole('dialog', { name: 'Sélectionner le tempo' }).parentElement;
    expect(backdrop).toHaveClass(
      'pb-[max(1rem,env(safe-area-inset-bottom))]',
      'pl-[max(1rem,env(safe-area-inset-left))]',
      'pr-[max(1rem,env(safe-area-inset-right))]',
      'pt-[max(4rem,env(safe-area-inset-top))]',
    );
  });

  it('ferme avec Échap et boucle le focus entre ses contrôles', () => {
    const onClose = vi.fn();
    render(
      <PickerDialog title="Sélectionner la tonalité" onClose={onClose}>
        <button type="button">Do</button>
        <button type="button">Ré</button>
      </PickerDialog>,
    );

    const closeButton = screen.getByRole('button', { name: 'Fermer' });
    const lastOption = screen.getByRole('button', { name: 'Ré' });

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastOption).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ferme depuis le backdrop sans réagir à un clic dans le panneau', () => {
    const onClose = vi.fn();
    render(
      <PickerDialog title="Sélectionner le tempo" onClose={onClose}>
        <button type="button">120 BPM</button>
      </PickerDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Sélectionner le tempo' });
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
