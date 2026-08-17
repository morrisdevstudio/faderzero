import { fireEvent, render, screen } from '@testing-library/react';
import { AddButton } from './AddButton';

describe('AddButton', () => {
  it('exposes its contextual label and the shared add icon', () => {
    const { container } = render(<AddButton aria-label="Ajouter une chanson" />);

    expect(screen.getByRole('button', { name: 'Ajouter une chanson' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Ajouter une chanson' })).toHaveClass('fz-add-button');
    expect(container.querySelector('svg')).toHaveAttribute('data-icon-usage', 'add-button.icon');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).toHaveAttribute('width', '20');
    expect(container.querySelector('svg')).toHaveAttribute('height', '20');
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '2');
  });

  it('forwards interaction and disabled states', () => {
    const onClick = vi.fn();
    const { rerender } = render(<AddButton aria-label="Ajouter" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<AddButton aria-label="Ajouter" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
