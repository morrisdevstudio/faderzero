import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders default secondary button with children and default type button', () => {
    render(<Button>Valider</Button>);

    const button = screen.getByRole('button', { name: 'Valider' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('fz-button-secondary');
    expect(button).toHaveClass('text-sm');
  });

  it('supports all visual variants', () => {
    const { rerender } = render(<Button variant="primary">Enregistrer</Button>);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toHaveClass('fz-button-primary');

    rerender(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveClass('fz-button-danger');

    rerender(<Button variant="ghost">Annuler</Button>);
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveClass('fz-button-ghost');
  });

  it('supports size variants', () => {
    const { rerender } = render(<Button size="sm">Petit</Button>);
    expect(screen.getByRole('button', { name: 'Petit' })).toHaveClass('text-xs');

    rerender(<Button size="lg">Grand</Button>);
    expect(screen.getByRole('button', { name: 'Grand' })).toHaveClass('text-base');
  });

  it('supports fullWidth prop', () => {
    render(<Button fullWidth>Plein écran</Button>);
    expect(screen.getByRole('button', { name: 'Plein écran' })).toHaveClass('w-full');
  });

  it('renders leading and trailing icons', () => {
    render(
      <Button
        leadingIcon={<span data-testid="leading-icon">←</span>}
        trailingIcon={<span data-testid="trailing-icon">→</span>}
      >
        Continuer
      </Button>,
    );

    expect(screen.getByTestId('leading-icon')).toBeInTheDocument();
    expect(screen.getByTestId('trailing-icon')).toBeInTheDocument();
    expect(screen.getByText('Continuer')).toBeInTheDocument();
  });

  it('handles loading state properly', () => {
    render(
      <Button
        loading
        leadingIcon={<span data-testid="leading-icon">←</span>}
        trailingIcon={<span data-testid="trailing-icon">→</span>}
      >
        En cours
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'En cours' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('leading-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trailing-icon')).not.toBeInTheDocument();
  });

  it('forwards interactions and disabled prop', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Cliquer</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Cliquer' }));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<Button onClick={onClick} disabled>Cliquer</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Cliquer' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('forwards ref to button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref test</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toContain('Ref test');
  });
});
