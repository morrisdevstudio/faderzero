import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from '@/app/App';
import { announcePwaUpdate, type ApplyPwaUpdate } from '@/services/pwa/update';
import { isAppHostname } from '@/utils/domainRouting';
import '@/app/styles.css';

// The public EPK is a dynamic Pages Function response.  Its HTML must never
// be satisfied by the application service worker, otherwise a freshly
// published revision can look stale after a reload.
if (isAppHostname() || import.meta.env.DEV) {
  let applyUpdate: ApplyPwaUpdate | undefined;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (applyUpdate) announcePwaUpdate(applyUpdate);
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
