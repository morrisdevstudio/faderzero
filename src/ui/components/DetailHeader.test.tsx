import { fireEvent, render, screen } from '@testing-library/react';
import { DetailHeader } from './DetailHeader';
import { FzIcon } from '@/ui/icons';

describe('DetailHeader', () => {
  it('renders the title, subtitle and shared back action', () => {
    const onBack = vi.fn();
    render(
      <DetailHeader
        title="Le Chabada"
        subtitle="Angers · 22 août 2026"
        onBack={onBack}
        backLabel="Retour au booking"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retour au booking' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { level: 1, name: 'Le Chabada' })).toBeInTheDocument();
    expect(screen.getByText('Angers · 22 août 2026')).toBeInTheDocument();
  });

  it('renders icon-only actions without inventing their behavior', () => {
    render(
      <DetailHeader
        title="Booking"
        onBack={() => {}}
        backLabel="Retour au calendrier"
        actions={<button type="button" aria-label="Ajouter une proposition"><FzIcon name="add" usageId="detail-header.test-add" /></button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ajouter une proposition' })).toBeInTheDocument();
  });
});
