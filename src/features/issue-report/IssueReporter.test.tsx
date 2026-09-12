import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueReporter } from './IssueReporter';

const draftMocks = vi.hoisted(() => ({
  list: vi.fn(), save: vi.fn(), remove: vi.fn(),
}));
const captureMocks = vi.hoisted(() => ({ capture: vi.fn() }));

vi.mock('./issueReportDrafts', () => ({
  MAX_ISSUE_REPORT_DRAFTS: 5,
  listIssueReportDrafts: draftMocks.list,
  saveIssueReportDraft: draftMocks.save,
  deleteIssueReportDraft: draftMocks.remove,
}));
vi.mock('./captureViewport', () => ({
  captureViewport: captureMocks.capture,
  collectIssueReportDiagnostics: () => ({ route: '/songs', appVersion: 'test', capturedAt: '2026-09-12T10:00:00Z', viewport: '390×844@3', userAgent: 'test', displayMode: 'browser', online: true }),
  canvasToWebp: vi.fn(),
}));

describe('IssueReporter hot corner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    draftMocks.list.mockResolvedValue([]);
    draftMocks.save.mockResolvedValue(undefined);
    captureMocks.capture.mockResolvedValue(new Blob(['capture'], { type: 'image/webp' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stays unavailable for every other account', async () => {
    render(<IssueReporter email="other@example.com" userId="user-2" pathname="/songs" online />);
    fireEvent.pointerDown(document, { clientX: 10, clientY: 10, button: 0 });
    await act(() => vi.advanceTimersByTimeAsync(1300));
    expect(captureMocks.capture).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the annotation editor after a 1.2 second press for the approved account', async () => {
    render(<IssueReporter email="YANN.CHOUTEAU@gmail.com" userId="user-1" pathname="/songs" online />);
    fireEvent.pointerDown(document, { clientX: 10, clientY: 10, button: 0 });
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(captureMocks.capture).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Annoter la capture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trait libre' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ellipse' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Flèche' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Texte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masquer une zone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler la dernière annotation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rétablir la dernière annotation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Effacer toutes les annotations' })).toBeInTheDocument();
    expect(screen.getByLabelText('Capture à annoter au pointeur')).toHaveClass('w-full', 'h-auto', 'shrink-0');
    expect(screen.getByLabelText('Capture à annoter au pointeur')).not.toHaveClass('max-h-full');
  });

  it('does not intercept a short press', async () => {
    const click = vi.fn();
    render(<><button onClick={click}>Sous le coin</button><IssueReporter email="yann.chouteau@gmail.com" userId="user-1" pathname="/songs" online /></>);
    const button = screen.getByRole('button', { name: 'Sous le coin' });
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerUp(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.click(button);
    await act(() => vi.advanceTimersByTimeAsync(1300));
    expect(click).toHaveBeenCalledOnce();
    expect(captureMocks.capture).not.toHaveBeenCalled();
  });

  it('locks activation while the first draft lookup is still pending', async () => {
    let resolveDrafts: ((value: never[]) => void) | undefined;
    draftMocks.list.mockReturnValueOnce(new Promise((resolve) => { resolveDrafts = resolve; }));
    render(<IssueReporter email="yann.chouteau@gmail.com" userId="user-1" pathname="/songs" online />);
    fireEvent.pointerDown(document, { clientX: 10, clientY: 10, button: 0 });
    await act(() => vi.advanceTimersByTimeAsync(1200));
    fireEvent.pointerDown(document, { clientX: 10, clientY: 10, button: 0 });
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(draftMocks.list).toHaveBeenCalledOnce();
    await act(async () => { resolveDrafts?.([]); });
    expect(captureMocks.capture).toHaveBeenCalledOnce();
  });

  it('focuses the editor controls and closes the editor with Escape', async () => {
    render(<IssueReporter email="yann.chouteau@gmail.com" userId="user-1" pathname="/songs" online />);
    fireEvent.pointerDown(document, { clientX: 10, clientY: 10, button: 0 });
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(screen.getByRole('button', { name: 'Fermer l’éditeur' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await act(async () => undefined);
    expect(screen.queryByRole('dialog', { name: 'Annoter la capture' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Signalements GitHub' })).toBeInTheDocument();
  });
});
