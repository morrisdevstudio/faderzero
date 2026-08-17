import { fireEvent, render, screen } from '@testing-library/react';
import { PasswordField } from './PasswordField';
import { SearchField } from './SearchField';
import { TextArea } from './TextArea';
import { TextField } from './TextField';

describe('canonical form fields', () => {
  it('forwards native text field attributes', () => {
    render(<TextField type="email" aria-label="Adresse e-mail" required disabled />);

    const field = screen.getByRole('textbox', { name: 'Adresse e-mail' });
    expect(field).toHaveAttribute('type', 'email');
    expect(field).toBeRequired();
    expect(field).toBeDisabled();
  });

  it('renders a semantic search field', () => {
    render(<SearchField aria-label="Rechercher" placeholder="Rechercher…" />);

    expect(screen.getByRole('searchbox', { name: 'Rechercher' })).toHaveClass('fz-search-field');
  });

  it('shows and hides a password without changing its value', () => {
    render(<PasswordField aria-label="Mot de passe" defaultValue="secret" />);
    const field = screen.getByLabelText('Mot de passe');

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveValue('secret');

    fireEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('keeps multiline behavior explicit', () => {
    render(<TextArea aria-label="Notes" rows={6} resize="none" />);

    const field = screen.getByRole('textbox', { name: 'Notes' });
    expect(field).toHaveAttribute('rows', '6');
    expect(field).toHaveAttribute('data-resize', 'none');
  });
});
