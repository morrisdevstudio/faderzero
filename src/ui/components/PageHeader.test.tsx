import { fireEvent, render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the shared title row and its actions', () => {
    render(
      <PageHeader
        icon={<svg data-testid="page-icon" />}
        title="Morceaux"
        actions={<button type="button">Ajouter</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Morceaux' })).toBeInTheDocument();
    expect(screen.getByTestId('page-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it('renders the optional search row and forwards text changes', () => {
    const onChange = vi.fn();
    render(
      <PageHeader
        icon={<svg />}
        title="Setlists"
        search={{
          value: '',
          onChange,
          placeholder: 'Rechercher une setlist…',
          'aria-label': 'Rechercher dans les setlists',
        }}
        sortAction={<button type="button">Trier</button>}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher dans les setlists' }), {
      target: { value: 'Festival' },
    });

    expect(onChange).toHaveBeenCalledWith('Festival');
    expect(screen.getByRole('button', { name: 'Trier' })).toBeInTheDocument();
  });
});
