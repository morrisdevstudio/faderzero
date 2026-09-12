import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetronomePage } from './MetronomePage';

const mocks = vi.hoisted(() => ({
  updateSong: vi.fn(),
  songs: [] as any[],
  setlists: [] as any[],
  setlistSongs: [] as any[],
  engineInstances: [] as any[],
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => unknown) => {
    try {
      const result = querier();
      if (result instanceof Promise) {
        return false;
      }
      return result;
    } catch {
      return undefined;
    }
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeWorkspace: { id: 'workspace-1', role: 'owner' },
      workspaces: [{ id: 'workspace-1', role: 'owner' }],
    }),
}));

vi.mock('@/db/repositories/songsRepository', () => ({
  songsRepository: {
    list: () => mocks.songs,
    update: (...args: unknown[]) => mocks.updateSong(...args),
  },
}));

vi.mock('@/db/repositories/setlistsRepository', () => ({
  setlistsRepository: {
    listSummaries: () => mocks.setlists,
  },
}));

vi.mock('@/db/repositories/setlistSongsRepository', () => ({
  setlistSongsRepository: {
    listDetailedBySetlistId: () => mocks.setlistSongs,
  },
}));

vi.mock('@/features/metronome/metronomeEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/metronome/metronomeEngine')>();
  class FakeMetronomeEngine {
    updateConfig = vi.fn();
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
    setBeatListener = vi.fn();

    constructor() {
      mocks.engineInstances.push(this);
    }
  }
  return {
    ...actual,
    MetronomeEngine: FakeMetronomeEngine,
  };
});

function renderMetronomePage() {
  return render(
    <MemoryRouter>
      <MetronomePage />
    </MemoryRouter>,
  );
}

describe('MetronomePage - Pickers Valider & Annuler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSong.mockResolvedValue(undefined);
    mocks.songs = [
      {
        id: 'song-1',
        title: 'Chanson 1',
        bpm: 100,
        status: 'Idee',
        durationSeconds: 120,
      },
    ];
    mocks.setlists = [];
    mocks.setlistSongs = [];
  });

  it('annule la modification du tempo si la pop-up est fermée sans valider', () => {
    renderMetronomePage();

    const tempoButton = screen.getByRole('button', { name: /120\s*BPM/i });
    expect(tempoButton).toBeInTheDocument();

    fireEvent.click(tempoButton);
    expect(screen.getByRole('dialog', { name: 'Sélectionner le tempo' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '140 BPM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(screen.queryByRole('dialog', { name: 'Sélectionner le tempo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /120\s*BPM/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /140\s*BPM/i })).not.toBeInTheDocument();
  });

  it("applique la modification du tempo lorsqu'on clique sur Valider", async () => {
    renderMetronomePage();

    const tempoButton = screen.getByRole('button', { name: /120\s*BPM/i });
    fireEvent.click(tempoButton);

    expect(screen.getByRole('dialog', { name: 'Sélectionner le tempo' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '140 BPM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));

    expect(screen.queryByRole('dialog', { name: 'Sélectionner le tempo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /140\s*BPM/i })).toBeInTheDocument();
  });

  it('annule la modification de la signature rythmique si fermée sans valider', () => {
    renderMetronomePage();

    const signatureButton = screen.getByRole('button', { name: /4\/4/i });
    expect(signatureButton).toBeInTheDocument();

    fireEvent.click(signatureButton);
    expect(screen.getByRole('dialog', { name: 'Signature rythmique' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '6 Temps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(screen.queryByRole('dialog', { name: 'Signature rythmique' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /4\/4/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /6\/4/i })).not.toBeInTheDocument();
  });

  it("applique la modification de la signature rythmique lorsqu'on clique sur Valider", () => {
    renderMetronomePage();

    const signatureButton = screen.getByRole('button', { name: /4\/4/i });
    fireEvent.click(signatureButton);

    expect(screen.getByRole('dialog', { name: 'Signature rythmique' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '6 Temps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));

    expect(screen.queryByRole('dialog', { name: 'Signature rythmique' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /6\/4/i })).toBeInTheDocument();
  });

  it("annule la modification du tempo d'une chanson si fermée sans valider", () => {
    mocks.songs = [
      {
        id: 'song-2',
        title: 'Chanson sans tempo',
        status: 'Idee',
        durationSeconds: 120,
      },
    ];

    renderMetronomePage();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer le métronome' }));
    fireEvent.click(screen.getByRole('button', { name: /Chanson sans tempo/i }));

    expect(screen.getByRole('dialog', { name: 'Régler le tempo de la chanson' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '150 BPM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(mocks.updateSong).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Régler le tempo de la chanson' })).not.toBeInTheDocument();
  });

  it("applique la modification du tempo d'une chanson au clic sur Valider", async () => {
    mocks.songs = [
      {
        id: 'song-2',
        title: 'Chanson sans tempo',
        status: 'Idee',
        durationSeconds: 120,
      },
    ];

    renderMetronomePage();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer le métronome' }));
    fireEvent.click(screen.getByRole('button', { name: /Chanson sans tempo/i }));

    expect(screen.getByRole('dialog', { name: 'Régler le tempo de la chanson' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '150 BPM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));

    await waitFor(() => {
      expect(mocks.updateSong).toHaveBeenCalledWith('song-2', { bpm: 150 });
      expect(screen.queryByRole('dialog', { name: 'Régler le tempo de la chanson' })).not.toBeInTheDocument();
    });
  });
});

describe('MetronomePage - Personnalisation des 3 sons par temps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.songs = [];
    mocks.setlists = [];
    mocks.setlistSongs = [];
    mocks.engineInstances = [];
  });

  it('affiche les 4 temps avec leurs sons et couleurs par défaut', () => {
    renderMetronomePage();

    expect(screen.getByRole('button', { name: 'Temps 1 : Son aigu. Cliquer pour changer.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Temps 2 : Son médium. Cliquer pour changer.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Temps 3 : Son médium. Cliquer pour changer.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Temps 4 : Son médium. Cliquer pour changer.' })).toBeInTheDocument();
  });

  it('permet de faire défiler les 3 sons en boucle au clic sur chaque temps', () => {
    renderMetronomePage();

    const beat1Button = screen.getByRole('button', { name: 'Temps 1 : Son aigu. Cliquer pour changer.' });

    // 1er clic sur temps 1 : passe à son médium
    fireEvent.click(beat1Button);
    expect(screen.getByRole('button', { name: 'Temps 1 : Son médium. Cliquer pour changer.' })).toBeInTheDocument();

    // 2ème clic sur temps 1 : passe à son grave
    fireEvent.click(beat1Button);
    expect(screen.getByRole('button', { name: 'Temps 1 : Son grave. Cliquer pour changer.' })).toBeInTheDocument();

    // 3ème clic sur temps 1 : boucle et revient à son aigu
    fireEvent.click(beat1Button);
    expect(screen.getByRole('button', { name: 'Temps 1 : Son aigu. Cliquer pour changer.' })).toBeInTheDocument();

    // Clic sur temps 2 (qui était médium) : passe à son grave
    const beat2Button = screen.getByRole('button', { name: 'Temps 2 : Son médium. Cliquer pour changer.' });
    fireEvent.click(beat2Button);
    expect(screen.getByRole('button', { name: 'Temps 2 : Son grave. Cliquer pour changer.' })).toBeInTheDocument();
  });

  it('transmet les sons mis à jour au moteur de métronome', () => {
    renderMetronomePage();

    const engine = mocks.engineInstances[0];
    expect(engine).toBeDefined();

    const beat1Button = screen.getByRole('button', { name: 'Temps 1 : Son aigu. Cliquer pour changer.' });
    fireEvent.click(beat1Button);

    expect(engine.updateConfig).toHaveBeenCalledWith({
      beatSounds: [[1], [1], [1], [1]],
    });

    fireEvent.click(beat1Button);
    expect(engine.updateConfig).toHaveBeenCalledWith({
      beatSounds: [[2], [1], [1], [1]],
    });
  });

  it('permet de changer individuellement le son de chaque subdivision', () => {
    renderMetronomePage();

    // Ouvre le sélecteur de subdivision et choisit les croches (2 par temps)
    fireEvent.click(screen.getByTitle('Cliquer pour changer la subdivision'));
    expect(screen.getByRole('dialog', { name: 'Subdivision des temps' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Croches' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    // Temps 1 a maintenant 2 boutons de subdivision
    const sub1 = screen.getByRole('button', { name: 'Temps 1 subdivision 1 : Son aigu. Cliquer pour changer.' });
    const sub2 = screen.getByRole('button', { name: 'Temps 1 subdivision 2 : Son grave. Cliquer pour changer.' });

    expect(sub1).toBeInTheDocument();
    expect(sub2).toBeInTheDocument();

    // Clic sur la 2ème croche du temps 1 : passe de grave (2) à aigu (0)
    fireEvent.click(sub2);
    expect(screen.getByRole('button', { name: 'Temps 1 subdivision 2 : Son aigu. Cliquer pour changer.' })).toBeInTheDocument();

    // La 1ère croche reste inchangée (aigu)
    expect(screen.getByRole('button', { name: 'Temps 1 subdivision 1 : Son aigu. Cliquer pour changer.' })).toBeInTheDocument();

    // 2ème clic sur la 2ème croche : passe à médium (1)
    fireEvent.click(screen.getByRole('button', { name: 'Temps 1 subdivision 2 : Son aigu. Cliquer pour changer.' }));
    expect(screen.getByRole('button', { name: 'Temps 1 subdivision 2 : Son médium. Cliquer pour changer.' })).toBeInTheDocument();
  });
});

