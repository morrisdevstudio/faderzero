import { fireEvent, render, screen } from '@testing-library/react';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('renders one group switcher and forwards its action', () => {
    const onChangeGroup = vi.fn();
    render(
      <AppHeader
        logo={<span>FaderZero</span>}
        currentGroup={{ name: 'Kicked To Heaven', initials: 'KTH' }}
        onChangeGroup={onChangeGroup}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Changer de groupe (Kicked To Heaven)' }));

    expect(onChangeGroup).toHaveBeenCalledOnce();
    expect(screen.getByText('KTH')).toBeInTheDocument();
  });

  it('shows the group image and falls back to initials when it fails', () => {
    render(
      <AppHeader
        logo={<span>FaderZero</span>}
        currentGroup={{ name: 'Kicked To Heaven', initials: 'KTH', avatarUrl: '/group-logo.png' }}
        onChangeGroup={() => {}}
      />,
    );

    const image = screen.getByRole('presentation');
    expect(image).toHaveAttribute('src', '/group-logo.png');

    fireEvent.error(image);
    expect(screen.getByText('KTH')).toBeInTheDocument();
  });

  it('keeps the optional connectivity status inside the switcher', () => {
    render(
      <AppHeader
        logo={<span>FaderZero</span>}
        currentGroup={{ name: 'Mon Espace', initials: 'ME' }}
        onChangeGroup={() => {}}
        status={<span>Hors ligne</span>}
      />,
    );

    expect(screen.getByText('Hors ligne')).toBeInTheDocument();
  });
});
