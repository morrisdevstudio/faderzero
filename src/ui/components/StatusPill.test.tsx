import { render, screen } from '@testing-library/react';
import { StatusPill } from './StatusPill';

describe('StatusPill', () => {
  it.each([
    ['Brouillon', 'default'],
    ['En cours', 'accent'],
    ['Prêt', 'success'],
  ] as const)('renders %s with the %s tone', (label, tone) => {
    render(<StatusPill label={label} tone={tone} />);

    const pill = screen.getByText(label);
    expect(pill.tagName).toBe('SPAN');
    expect(pill).toHaveClass('whitespace-nowrap', 'rounded-full');
  });

  it('uses the neutral tone by default', () => {
    render(<StatusPill label="Mode PWA" />);

    expect(screen.getByText('Mode PWA')).toHaveClass('text-[var(--fz-text-muted)]');
  });
});
