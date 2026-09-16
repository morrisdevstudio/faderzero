export const PWA_UPDATE_AVAILABLE_EVENT = 'faderzero:pwa-update-available';

export type ApplyPwaUpdate = (reloadPage?: boolean) => Promise<void>;

export function announcePwaUpdate(applyUpdate: ApplyPwaUpdate) {
  window.dispatchEvent(
    new CustomEvent<ApplyPwaUpdate>(PWA_UPDATE_AVAILABLE_EVENT, { detail: applyUpdate }),
  );
}
