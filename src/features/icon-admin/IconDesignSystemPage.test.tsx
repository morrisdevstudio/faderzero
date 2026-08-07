import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconCatalog } from './iconCatalogService';

const { createIconRoleMock, isPlatformAdminMock, loadIconCatalogMock } = vi.hoisted(() => ({
  createIconRoleMock: vi.fn(),
  isPlatformAdminMock: vi.fn(),
  loadIconCatalogMock: vi.fn(),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { session: { user: { id: string } } }) => unknown) => selector({ session: { user: { id: 'admin-123' } } }),
}));
vi.mock('./iconCatalogService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./iconCatalogService')>();
  return {
    ...actual,
    createIconRole: createIconRoleMock,
    isPlatformAdmin: isPlatformAdminMock,
    loadIconCatalog: loadIconCatalogMock,
    requestIconPublication: vi.fn(),
    saveIconDecision: vi.fn(),
  };
});

import { IconDesignSystemPage } from './IconDesignSystemPage';

const baseCatalog: IconCatalog = {
  cached: false,
  publications: [],
  roles: [{ key: 'back', label: 'Retour', description: '', sourceType: 'lucide', iconName: 'arrow-left', status: 'approved', version: 1 }],
  occurrences: [{
    usageId: 'login.eye', occurrenceId: 'eye-1', name: 'EyeIcon', route: '/login', pageName: 'Connexion',
    file: 'src/components/LoginPage.tsx', line: 245, format: 'react-component', fingerprint: 'eye',
    source: '<svg />', defaultRoleKey: null, assignedRoleKey: null, overrideIconName: null,
    integrationState: 'legacy', verificationState: 'unverified', version: 1,
  }],
};

describe('IconDesignSystemPage role creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPlatformAdminMock.mockResolvedValue(true);
    loadIconCatalogMock.mockResolvedValue(baseCatalog);
    createIconRoleMock.mockResolvedValue({ key: 'afficher-masquer', label: 'Afficher / masquer', description: '', sourceType: 'lucide', iconName: 'eye', status: 'approved', version: 1 });
  });

  it('creates a missing role with the inferred icon and selects it', async () => {
    render(<MemoryRouter><IconDesignSystemPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /EyeIcon/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer un nouveau rôle' }));
    fireEvent.change(screen.getByLabelText('Nom du rôle'), { target: { value: 'Afficher / masquer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer et sélectionner' }));

    await waitFor(() => expect(createIconRoleMock).toHaveBeenCalledWith({
      label: 'Afficher / masquer', description: '', iconName: 'eye', userId: 'admin-123',
    }));
  });
});
