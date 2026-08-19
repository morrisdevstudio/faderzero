import { render, screen } from '@testing-library/react';
import { Eye } from 'lucide-react';
import { FzIcon } from './FzIcon';
import { publishedIconUsageOverrides } from './published.generated';

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

  it('applies a published icon to its stable usage', () => {
    publishedIconUsageOverrides['login.password.visibility'] = Eye;
    const { container } = render(<FzIcon name="close" usageId="login.password.visibility" />);
    expect(container.querySelector('svg')).toHaveClass('lucide-eye');
    delete publishedIconUsageOverrides['login.password.visibility'];
  });

  it('renders play, pause, and stop with fill currentColor by default', () => {
    const { container: playContainer } = render(<FzIcon name="play" usageId="test.play" />);
    expect(playContainer.querySelector('svg')).toHaveAttribute('fill', 'currentColor');

    const { container: pauseContainer } = render(<FzIcon name="pause" usageId="test.pause" />);
    expect(pauseContainer.querySelector('svg')).toHaveAttribute('fill', 'currentColor');

    const { container: stopContainer } = render(<FzIcon name="stop" usageId="test.stop" />);
    expect(stopContainer.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  });

  it('keeps fill none for other standard icons', () => {
    const { container: recordContainer } = render(<FzIcon name="record" usageId="test.record" />);
    expect(recordContainer.querySelector('svg')).toHaveAttribute('fill', 'none');

    const { container: editContainer } = render(<FzIcon name="edit" usageId="test.edit" />);
    expect(editContainer.querySelector('svg')).toHaveAttribute('fill', 'none');
  });
});
