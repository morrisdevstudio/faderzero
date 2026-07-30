import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceMemoPlayer } from './VoiceMemoPlayer';

describe('VoiceMemoPlayer', () => {
  it('plays, displays progress and seeks without native browser controls', async () => {
    const { container } = render(<VoiceMemoPlayer src="blob:voice-note" durationMs={6_000} />);
    const audio = container.querySelector('audio');
    expect(audio).not.toHaveAttribute('controls');

    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Écouter la prise' }));
    expect(play).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument();

    const scrubber = screen.getByRole('slider', { name: "Position dans l'enregistrement" });
    fireEvent.change(scrubber, { target: { value: '3' } });
    expect(audio?.currentTime).toBe(3);
    expect(screen.getByText('00:03')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    expect(pause).toHaveBeenCalled();
  });
});
