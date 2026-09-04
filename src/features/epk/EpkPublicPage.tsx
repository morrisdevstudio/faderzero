import { EpkPublicView } from './EpkPublicView';
import type { EpkPublicModel } from './epkPresentation';

declare global {
  interface Window {
    __FZ_EPK_MODEL__?: EpkPublicModel;
  }
}

/** The Pages Function injects this sanitized, published-only model. */
export function EpkPublicPage() {
  const model = window.__FZ_EPK_MODEL__;
  if (!model) return null;
  return <EpkPublicView model={model} />;
}
