import { createContext, useContext } from 'react';
import type { InstallEnvironment } from './installEnvironment';

export interface InstallContextValue {
  environment: InstallEnvironment;
  isInstalledThisSession: boolean;
  requestNativeInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export const InstallContext = createContext<InstallContextValue | null>(null);

export function useInstall() {
  const value = useContext(InstallContext);
  if (!value) throw new Error('useInstall must be used within InstallProvider.');
  return value;
}
