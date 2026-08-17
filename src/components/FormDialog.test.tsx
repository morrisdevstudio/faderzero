import { fireEvent, render, screen } from '@testing-library/react';
import { FormDialog } from './FormDialog';

describe('FormDialog', () => {
  it('associe son titre, verrouille le défilement et restaure le focus', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Ouvrir';
    document.body.append(opener);
    opener.focus();
    document.body.style.overflow = 'auto';

    const { unmount } = render(
      <FormDialog title="Nouveau morceau" onClose={() => {}}>
        <input aria-label="Titre du morceau" />
      </FormDialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Nouveau morceau' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Nouveau morceau' })).toHaveClass('fz-dialog-panel');
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    unmount();

    expect(opener).toHaveFocus();
    expect(document.body).toHaveStyle({ overflow: 'auto' });
    opener.remove();
    document.body.style.overflow = '';
  });

  it('respecte les safe areas du viewport', () => {
    render(<FormDialog title="Nouveau morceau" onClose={() => {}}>Contenu</FormDialog>);

    const backdrop = screen.getByRole('dialog', { name: 'Nouveau morceau' }).parentElement?.parentElement;
    expect(backdrop).toHaveClass(
      'pl-[max(1rem,env(safe-area-inset-left))]',
      'pr-[max(1rem,env(safe-area-inset-right))]',
      'pt-[max(4rem,env(safe-area-inset-top))]',
    );
  });

  it('ferme avec Échap et maintient la navigation au clavier dans le dialogue', () => {
    const onClose = vi.fn();
    render(
      <FormDialog title="Modifier le morceau" onClose={onClose}>
        <input aria-label="Titre du morceau" />
        <button type="button">Enregistrer</button>
      </FormDialog>,
    );

    const closeButton = screen.getByRole('button', { name: 'Fermer' });
    const saveButton = screen.getByRole('button', { name: 'Enregistrer' });

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(saveButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ferme depuis le backdrop sans réagir à un clic dans le panneau', () => {
    const onClose = vi.fn();
    render(
      <FormDialog title="Nouveau morceau" onClose={onClose}>
        <button type="button">Enregistrer</button>
      </FormDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Nouveau morceau' });
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = dialog.parentElement?.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('peut verrouiller toutes les méthodes de fermeture pendant une action', () => {
    const onClose = vi.fn();
    render(
      <FormDialog title="Copie en cours" closeDisabled onClose={onClose}>
        Contenu
      </FormDialog>,
    );

    const closeButton = screen.getByRole('button', { name: 'Fermer' });
    expect(closeButton).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(closeButton);
    fireEvent.click(screen.getByRole('dialog', { name: 'Copie en cours' }).parentElement!.parentElement!);

    expect(onClose).not.toHaveBeenCalled();
  });
});
