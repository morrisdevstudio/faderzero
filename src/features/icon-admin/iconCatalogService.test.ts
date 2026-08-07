import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, insertMock, selectMock, singleMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({ supabase: { from: fromMock } }));

import { createIconRole } from './iconCatalogService';

describe('createIconRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({ insert: insertMock });
    insertMock.mockReturnValue({ select: selectMock });
    selectMock.mockReturnValue({ single: singleMock });
  });

  it('creates an approved Lucide role for the current administrator', async () => {
    singleMock.mockResolvedValue({
      data: { key: 'exporter-en-pdf', label: 'Exporter en PDF', description: 'Crée le document final.', source_type: 'lucide', icon_name: 'file-down', status: 'approved', version: 1 },
      error: null,
    });

    await expect(createIconRole({ label: ' Exporter en PDF ', description: ' Crée le document final. ', iconName: 'file-down', userId: 'admin-123' })).resolves.toMatchObject({
      key: 'exporter-en-pdf', label: 'Exporter en PDF', iconName: 'file-down', status: 'approved',
    });
    expect(fromMock).toHaveBeenCalledWith('design_icon_roles');
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ key: 'exporter-en-pdf', label: 'Exporter en PDF', updated_by: 'admin-123' }));
  });

  it('returns a useful message when the role already exists', async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: '23505' } });
    await expect(createIconRole({ label: 'Exporter en PDF', description: '', iconName: 'file-down', userId: 'admin-123' })).rejects.toThrow('Un rôle avec ce nom existe déjà.');
  });
});
