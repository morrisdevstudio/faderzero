import type { StorageCapability, StorageProviderId } from './types';

export interface StorageProviderDefinition {
  id: StorageProviderId;
  label: string;
  available: boolean;
  capabilities: ReadonlySet<StorageCapability>;
}

export const storageProviderCatalog: readonly StorageProviderDefinition[] = [
  { id: 'faderzero_r2', label: 'Faderzero Cloud', available: true, capabilities: new Set(['read', 'download', 'quota', 'health']) },
  { id: 'google_drive', label: 'Google Drive', available: true, capabilities: new Set(['resumable_upload', 'read', 'download', 'delete', 'quota', 'health']) },
  { id: 'dropbox', label: 'Dropbox', available: false, capabilities: new Set(['resumable_upload', 'read', 'download', 'delete', 'quota', 'health']) },
  { id: 'onedrive', label: 'OneDrive', available: false, capabilities: new Set(['resumable_upload', 'read', 'download', 'delete', 'quota', 'health']) },
  { id: 'webdav', label: 'WebDAV / Nextcloud', available: false, capabilities: new Set(['resumable_upload', 'read', 'download', 'delete', 'quota', 'health']) },
] as const;
