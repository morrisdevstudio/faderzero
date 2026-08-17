import { render, screen } from '@testing-library/react';
import { DateField } from './DateField';
import { DateTimeField } from './DateTimeField';
import { TimeField } from './TimeField';

describe('canonical temporal fields', () => {
  it('renders a native date field and forwards its constraints', () => {
    render(<DateField aria-label="Date cible" min="2026-08-17" max="2026-12-31" required />);

    const field = screen.getByLabelText('Date cible');
    expect(field).toHaveAttribute('type', 'date');
    expect(field).toHaveAttribute('min', '2026-08-17');
    expect(field).toHaveAttribute('max', '2026-12-31');
    expect(field).toBeRequired();
  });

  it('renders a native time field and forwards its step', () => {
    render(<TimeField aria-label="Heure" step={900} />);

    const field = screen.getByLabelText('Heure');
    expect(field).toHaveAttribute('type', 'time');
    expect(field).toHaveAttribute('step', '900');
  });

  it('renders a native local date and time field', () => {
    render(<DateTimeField aria-label="Prochaine relance" />);

    expect(screen.getByLabelText('Prochaine relance')).toHaveAttribute('type', 'datetime-local');
  });
});
