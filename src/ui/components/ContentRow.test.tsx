import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ContentRow } from './ContentRow';

describe('ContentRow', () => {
  it('renders in link mode with title and metadata inside a Link', () => {
    render(
      <MemoryRouter>
        <ContentRow
          mode="link"
          to="/songs/123"
          title="Last Train Home"
          metadata="120 BPM · Am · 4:12"
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/songs/123');
    expect(screen.getByText('Last Train Home')).toBeInTheDocument();
    expect(screen.getByText('120 BPM · Am · 4:12')).toBeInTheDocument();
  });

  it('renders in button mode with click handler and disabled support', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <ContentRow
        mode="button"
        onClick={onClick}
        title="Répétition générale"
        subtitle="18:00 - 20:00"
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Répétition générale')).toBeInTheDocument();
    expect(screen.getByText('18:00 - 20:00')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <ContentRow
        mode="button"
        onClick={onClick}
        title="Répétition générale"
        disabled
      />,
    );

    expect(button).toBeDisabled();
  });

  it('renders in controls mode with leading, trailing, and status slots', () => {
    render(
      <ContentRow
        mode="controls"
        title="Piste_01.wav"
        metadata="3:45 · 44.1kHz"
        leading={<span data-testid="leading-play">PLAY</span>}
        trailing={<button type="button" data-testid="trailing-menu">...</button>}
        status={<span data-testid="status-pill">Prêt</span>}
      />,
    );

    expect(screen.getByText('Piste_01.wav')).toBeInTheDocument();
    expect(screen.getByText('3:45 · 44.1kHz')).toBeInTheDocument();
    expect(screen.getByTestId('leading-play')).toBeInTheDocument();
    expect(screen.getByTestId('trailing-menu')).toBeInTheDocument();
    expect(screen.getByTestId('status-pill')).toBeInTheDocument();
  });

  it('renders in controls mode with to wrapping the entire central area in a Link', () => {
    render(
      <MemoryRouter>
        <ContentRow
          mode="controls"
          to="/songs/456"
          title="Kwkldl"
          metadata="86 BPM · Ton -- · 00:00"
          status={<span data-testid="status-pill">Prêt</span>}
          trailing={<button type="button" data-testid="play-btn">PLAY</button>}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/songs/456');
    expect(link).toContainElement(screen.getByText('Kwkldl'));
    expect(link).toContainElement(screen.getByText('86 BPM · Ton -- · 00:00'));
    expect(link).toContainElement(screen.getByTestId('status-pill'));
    expect(link).not.toContainElement(screen.getByTestId('play-btn'));
  });
});
