import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { createEmptySongDocument, type SongDocumentV1 } from '@/db/songDocument';
import { SongEditor } from './SongEditor';

describe('SongEditor', () => {
  it('demande un nom avant d’insérer une section personnalisée', async () => {
    const onChange = vi.fn<(document: SongDocumentV1) => void>();

    render(<SongEditor initialDocument={createEmptySongDocument()} onChange={onChange} autoFocus={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une section' }));
    fireEvent.click(screen.getByRole('button', { name: 'Personnalisée' }));

    expect(screen.getByRole('dialog', { name: 'Nouvelle section personnalisée' })).toBeInTheDocument();
    const nameField = screen.getByRole('textbox', { name: 'Nom de la section' });
    fireEvent.change(nameField, { target: { value: 'Interlude' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({
            attrs: expect.objectContaining({ sectionType: 'custom', label: 'Interlude' }),
          }),
        ]),
      }));
    });
    expect(screen.queryByRole('dialog', { name: 'Nouvelle section personnalisée' })).not.toBeInTheDocument();
  });
});
