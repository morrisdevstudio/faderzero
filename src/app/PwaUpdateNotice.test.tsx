import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PwaUpdateNotice } from '@/app/PwaUpdateNotice';
import { PWA_UPDATE_AVAILABLE_EVENT } from '@/services/pwa/update';

describe('PwaUpdateNotice', () => {
  it('only applies a waiting update after the user asks for it', () => {
    const applyUpdate = vi.fn().mockResolvedValue(undefined);
    render(<PwaUpdateNotice />);

    expect(screen.queryByText('Une mise à jour est prête.')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(PWA_UPDATE_AVAILABLE_EVENT, { detail: applyUpdate }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }));

    expect(applyUpdate).toHaveBeenCalledWith();
  });
});
