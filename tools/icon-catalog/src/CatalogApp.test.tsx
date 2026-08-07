import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogApp } from './CatalogApp';

const inventory = { icons: [
  { occurrenceId: 'one', name: 'CalendarIcon', format: 'svg', source: '/favicon.svg', file: 'src/a.tsx', line: 1, fingerprint: 'same', status: 'discovered', proposal: { lucideIcon: 'Calendar' }, decision: { status: 'review', notes: '' } },
  { occurrenceId: 'two', name: 'ClockIcon', format: 'svg', source: '/favicon.svg', file: 'src/b.tsx', line: 2, fingerprint: 'same', status: 'discovered' },
] };
const loader = vi.fn(async () => ({ revision: 'revision', inventory }));

describe('CatalogApp local edits', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); loader.mockClear(); });
  it('shows dirty row and count, cancels only that row, without PATCH', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<CatalogApp loader={loader} />);
    await screen.findByText('CalendarIcon');
    fireEvent.change(screen.getAllByLabelText('Notes')[0], { target: { value: 'local note' } });
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('1 ligne modifiée');
    expect(screen.getByText('Modifications non enregistrées')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler les modifications' }));
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('0 modification');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('filters dirty rows, combines search, and exposes an empty state', async () => {
    render(<CatalogApp loader={loader} />);
    await screen.findByText('CalendarIcon');
    fireEvent.change(screen.getAllByLabelText('Notes')[1], { target: { value: 'dirty' } });
    fireEvent.click(screen.getByLabelText('Afficher uniquement les lignes modifiées'));
    expect(screen.queryByText('CalendarIcon')).not.toBeInTheDocument();
    expect(screen.getByText('ClockIcon')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Recherche plein texte'), { target: { value: 'calendar' } });
    expect(screen.getByText('Aucune occurrence ne correspond aux filtres actifs.')).toBeInTheDocument();
  });
  it('confirms global cancellation and protects reload and beforeunload', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const add = vi.spyOn(window, 'addEventListener'); const remove = vi.spyOn(window, 'removeEventListener');
    render(<CatalogApp loader={loader} />);
    await screen.findByText('CalendarIcon');
    fireEvent.change(screen.getAllByLabelText('Notes')[0], { target: { value: 'first' } });
    fireEvent.change(screen.getAllByLabelText('Notes')[1], { target: { value: 'second' } });
    await waitFor(() => expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function)));
    fireEvent.click(screen.getByRole('button', { name: 'Tout annuler' }));
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('2 lignes modifiées');
    fireEvent.click(screen.getByRole('button', { name: 'Recharger' }));
    expect(confirm).toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Tout annuler' }));
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('0 modification');
    await waitFor(() => expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function)));
  });
  it('saves only the edited line and clears its dirty state after success', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 'sha256:new', occurrence: { ...inventory.icons[0], decision: { status: 'review', notes: 'saved locally' } } }) });
    vi.stubGlobal('fetch', fetch);
    render(<CatalogApp loader={loader} />);
    await screen.findByText('CalendarIcon');
    fireEvent.change(screen.getAllByLabelText('Notes')[0], { target: { value: 'saved locally' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0]);
    await screen.findByText('Enregistré');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain('/occurrences/one');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ revision: 'revision', changes: { decision: { notes: 'saved locally' } } });
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('0 modification');
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
  });
});
