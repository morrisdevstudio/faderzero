import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach } from 'vitest';
import { resetBackLayersForTests } from '@/navigation/inAppBack';
import { PickerDialog, WheelColumn } from './PickerDialog';

beforeEach(() => {
  resetBackLayersForTests();
});

afterEach(() => {
  resetBackLayersForTests();
});

function TestPicker({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <PickerDialog
      title="Sélectionner le tempo"
      onClose={() => {
        onClose?.();
        setOpen(false);
      }}
    >
      <button type="button">120 BPM</button>
    </PickerDialog>
  );
}

function TestWheel() {
  const [value, setValue] = useState('94');
  return <WheelColumn options={['93', '94', '95']} selectedValue={value} onSelect={setValue} suffix="BPM" />;
}

describe('WheelColumn', () => {
  it('suit le défilement sans attendre le retour de la valeur enregistrée', () => {
    const onSelect = vi.fn();
    const { container, unmount } = render(<WheelColumn options={['93', '94', '95']} selectedValue="94" onSelect={onSelect} suffix="BPM" />);
    const scrollArea = screen.getByRole('button', { name: '95 BPM' }).parentElement!;
    fireEvent.scroll(scrollArea, { target: { scrollTop: 128 } });
    expect(container.querySelector('[data-picker-selected="true"]')).toHaveTextContent('95');
    expect(screen.getByRole('button', { name: '95 BPM' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.scroll(scrollArea, { target: { scrollTop: 0 } });
    expect(container.querySelector('[data-picker-selected="true"]')).toHaveTextContent('93');
    expect(onSelect).toHaveBeenLastCalledWith('93');
    unmount();
  });

  it('adapte immédiatement le gras à la position réelle et conserve le centrage final', () => {
    vi.useFakeTimers();
    const { unmount } = render(<TestWheel />);
    try {
      const last = screen.getByRole('button', { name: '95 BPM' });
      const scrollArea = last.parentElement!;
      fireEvent.scroll(scrollArea, { target: { scrollTop: 105 } });
      expect(Number(last.style.getPropertyValue('--wheel-emphasis'))).toBeCloseTo(0.28125);
      act(() => { vi.advanceTimersByTime(100); });
      fireEvent.scroll(scrollArea, { target: { scrollTop: 118 } });
      act(() => { vi.advanceTimersByTime(100); });
      expect(Number(last.style.getPropertyValue('--wheel-emphasis'))).toBeCloseTo(0.6875);
      act(() => { vi.advanceTimersByTime(80); });
      expect(scrollArea.scrollTop).toBe(128);
      expect(last.style.getPropertyValue('--wheel-emphasis')).toBe('1');
      fireEvent.scroll(scrollArea, { target: { scrollTop: 64 } });
      expect(last.style.getPropertyValue('--wheel-emphasis')).toBe('');
      expect(screen.getByRole('button', { name: '94 BPM' }).style.getPropertyValue('--wheel-emphasis')).toBe('1');
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it('centre une valeur touchée et permet le réglage au clavier sans sortir des bornes', () => {
    render(<TestWheel />);
    const next = screen.getByRole('button', { name: '95 BPM' });
    const scrollArea = next.parentElement!;
    fireEvent.click(next);
    expect(next).toHaveAttribute('aria-pressed', 'true');
    expect(scrollArea.scrollTop).toBe(128);
    fireEvent.keyDown(next, { key: 'ArrowUp' });
    const middle = screen.getByRole('button', { name: '94 BPM' });
    expect(middle).toHaveFocus();
    expect(middle).toHaveAttribute('aria-pressed', 'true');
    expect(scrollArea.scrollTop).toBe(64);
    fireEvent.keyDown(middle, { key: 'Home' });
    const first = screen.getByRole('button', { name: '93 BPM' });
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(first).toHaveFocus();
    expect(scrollArea.scrollTop).toBe(0);
    expect(screen.getAllByRole('button').filter(button => button.tabIndex === 0)).toEqual([first]);
  });
});

describe('PickerDialog', () => {
  it('associe son titre et sa description au dialogue', () => {
    render(
      <PickerDialog
        title="Sélectionner le tempo"
        description="Choisis une valeur en BPM."
        onClose={() => {}}
      >
        <button type="button">120 BPM</button>
      </PickerDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Sélectionner le tempo' });
    expect(dialog).toHaveClass('fz-dialog-panel', 'fz-dialog-panel--bottom');
    expect(dialog).toHaveAccessibleDescription('Choisis une valeur en BPM.');
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
  });

  it('affiche une action d’en-tête à côté de la fermeture', () => {
    render(
      <PickerDialog
        title="Sélectionner le tempo"
        headerActions={<button type="button">Métronome</button>}
        onClose={() => {}}
      >
        Contenu
      </PickerDialog>,
    );

    expect(screen.getByRole('button', { name: 'Métronome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });

  it('respecte les safe areas du viewport', () => {
    render(<PickerDialog title="Sélectionner le tempo" onClose={() => {}}>Contenu</PickerDialog>);

    const backdrop = screen.getByRole('dialog', { name: 'Sélectionner le tempo' }).parentElement;
    expect(backdrop).toHaveClass(
      'pb-[max(1rem,env(safe-area-inset-bottom))]',
      'pl-[max(1rem,env(safe-area-inset-left))]',
      'pr-[max(1rem,env(safe-area-inset-right))]',
      'pt-[max(4rem,env(safe-area-inset-top))]',
    );
  });

  it('ferme avec Échap et boucle le focus entre ses contrôles', () => {
    const onClose = vi.fn();
    render(
      <PickerDialog title="Sélectionner la tonalité" onClose={onClose}>
        <button type="button">Do</button>
        <button type="button">Ré</button>
      </PickerDialog>,
    );

    const closeButton = screen.getByRole('button', { name: 'Fermer' });
    const lastOption = screen.getByRole('button', { name: 'Ré' });

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastOption).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ferme depuis le backdrop sans réagir à un clic dans le panneau', () => {
    const onClose = vi.fn();
    render(
      <PickerDialog title="Sélectionner le tempo" onClose={onClose}>
        <button type="button">120 BPM</button>
      </PickerDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Sélectionner le tempo' });
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ferme le picker sur le retour navigateur', () => {
    const onClose = vi.fn();
    render(
      <PickerDialog title="Sélectionner le tempo" onClose={onClose}>
        <button type="button">120 BPM</button>
      </PickerDialog>,
    );

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('reste ouvert après le double montage Strict Mode', async () => {
    render(
      <StrictMode>
        <TestPicker />
      </StrictMode>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('dialog', { name: 'Sélectionner le tempo' })).toBeInTheDocument();
  });
});
