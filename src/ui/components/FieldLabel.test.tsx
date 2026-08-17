import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldLabel } from './FieldLabel';

describe('FieldLabel', () => {
  it('renders label with children and default fz-field-label class', () => {
    render(<FieldLabel htmlFor="songName">Titre du morceau</FieldLabel>);

    const label = screen.getByText('Titre du morceau');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'songName');
    expect(label).toHaveClass('fz-field-label');
  });

  it('renders required asterisk indicator when required is true', () => {
    render(
      <FieldLabel htmlFor="email" required>
        Adresse e-mail
      </FieldLabel>,
    );

    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders optional text indicator when optional is true', () => {
    render(
      <FieldLabel htmlFor="notes" optional>
        Notes
      </FieldLabel>,
    );

    expect(screen.getByText('(optionnel)')).toBeInTheDocument();
  });

  it('supports custom className concatenation', () => {
    render(
      <FieldLabel htmlFor="customField" className="col-span-2 text-red-500">
        Champ spécial
      </FieldLabel>,
    );

    const label = screen.getByText('Champ spécial');
    expect(label).toHaveClass('fz-field-label');
    expect(label).toHaveClass('col-span-2');
    expect(label).toHaveClass('text-red-500');
  });
});
