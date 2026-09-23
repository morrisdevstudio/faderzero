export type StorageProviderId =
  | 'faderzero_r2'
  | 'google_drive'
  | 'dropbox'
  | 'onedrive'
  | 'webdav';

export type StorageCapability =
  | 'resumable_upload'
  | 'read'
  | 'download'
  | 'delete'
  | 'quota'
  | 'health';

export type StorageErrorCode =
  | 'capability_unavailable'
  | 'connection_unavailable'
  | 'invalid_upload'
  | 'quota_exceeded'
  | 'provider_unavailable';

export class StorageProviderError extends Error {
  readonly code: StorageErrorCode;
  readonly providerId: StorageProviderId | undefined;

  constructor(
    code: StorageErrorCode,
    message: string,
    providerId?: StorageProviderId,
  ) {
    super(message);
    this.name = 'StorageProviderError';
    this.code = code;
    this.providerId = providerId;
  }
}

export interface StorageUploadRequest {
  workspaceId: string;
  logicalKey: string;
  sizeBytes: number;
  mimeType: string;
  durationSeconds?: number;
  objectKind?: 'audio' | 'epk_media' | 'document';
  contentHash?: string;
  resumeSessionId?: string;
  targetProviderId?: StorageProviderId;
  onSessionCreated?: (session: StorageUploadSession) => void | Promise<void>;
}

export interface StorageUploadSession {
  providerId: StorageProviderId;
  sessionId: string;
  workspaceId: string;
  logicalKey: string;
  resumableSessionUri?: string;
  confirmedBytes?: number;
  expiresAt?: string;
}

export interface StorageUploadReceipt {
  physicalIdentifier: string;
}

export interface StorageLocation {
  providerId: StorageProviderId;
  physicalKey: string;
  storageObjectId?: string;
}

export interface StorageQuota {
  unit: 'bytes' | 'seconds';
  usedAmount: number;
  reservedAmount: number;
  limitAmount: number;
  remainingAmount: number;
}

export interface StorageProvider {
  readonly id: StorageProviderId;
  readonly capabilities: ReadonlySet<StorageCapability>;
  createUploadSession(request: StorageUploadRequest): Promise<StorageUploadSession>;
  upload(session: StorageUploadSession, body: Blob): Promise<StorageUploadReceipt>;
  finalizeUpload(session: StorageUploadSession, receipt?: StorageUploadReceipt, request?: StorageUploadRequest): Promise<StorageLocation>;
  abortUpload(session: StorageUploadSession): Promise<void>;
  createReadUrl(workspaceId: string, logicalKey: string): Promise<string>;
  createDownloadUrl(workspaceId: string, logicalKey: string): Promise<string>;
  deleteObject(workspaceId: string, logicalKey: string): Promise<void>;
  getQuota(workspaceId: string): Promise<StorageQuota>;
  checkHealth(): Promise<boolean>;
}

export function assertStorageCapability(provider: StorageProvider, capability: StorageCapability): void {
  if (!provider.capabilities.has(capability)) {
    throw new StorageProviderError('capability_unavailable', `La capacité ${capability} n’est pas disponible.`, provider.id);
  }
}
