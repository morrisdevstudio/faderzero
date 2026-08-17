import { fireEvent, render, screen } from '@testing-library/react';
import { SelectField } from './SelectField';

describe('SelectField', () => {
  it('renders a native select and forwards its attributes', () => {
    render(
      <SelectField aria-label="Type d’événement" defaultValue="rehearsal" required>
        <option value="rehearsal">Répétition</option>
        <option value="concert">Concert</option>
      </SelectField>,
    );

    const field = screen.getByRole('combobox', { name: 'Type d’événement' });
    expect(field).toHaveClass('fz-text-field', 'fz-select-field');
    expect(field).toBeRequired();
    expect(field).toHaveValue('rehearsal');

    fireEvent.change(field, { target: { value: 'concert' } });
    expect(field).toHaveValue('concert');
  });

  it('supports the native disabled state', () => {
    render(
      <SelectField aria-label="Statut" disabled>
        <option>Confirmé</option>
      </SelectField>,
    );

    expect(screen.getByRole('combobox', { name: 'Statut' })).toBeDisabled();
  });
});
