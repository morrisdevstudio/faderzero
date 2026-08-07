import { render, screen } from '@testing-library/react';
import { FzIcon } from './FzIcon';

describe('FzIcon', () => {
  it('is decorative by default and exposes its usage in development', () => {
    const { container } = render(<FzIcon name="home" usageId="navigation.home" />);
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('focusable', 'false');
    expect(icon).toHaveAttribute('data-icon-usage', 'navigation.home');
  });

  it('requires an accessible name for a meaningful icon', () => {
    render(<FzIcon name="close" usageId="dialog.close" decorative={false} aria-label="Fermer" />);
    expect(screen.getByLabelText('Fermer')).not.toHaveAttribute('aria-hidden');
  });
});
