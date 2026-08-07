import { useEffect, useMemo, useState } from 'react';
import { resolveCurrentIconPreview, type IconOccurrenceForPreview } from '../lib/currentIconPreview';

type Props = { occurrence: IconOccurrenceForPreview };

function errorMessage(payload: unknown, fallback: string) {
  return typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'object' && payload.error !== null && 'message' in payload.error && typeof payload.error.message === 'string' ? payload.error.message : fallback;
}

export function CurrentIconPreview({ occurrence }: Props) {
  const preview = useMemo(() => resolveCurrentIconPreview(occurrence), [occurrence]);
  const staticCandidate = preview.status === 'available' && (preview.type === 'inline' || preview.type === 'component');
  const [displayUrl, setDisplayUrl] = useState(preview.status === 'available' ? preview.url : undefined);
  const [reason, setReason] = useState<string | undefined>(preview.status === 'unavailable' ? preview.reason : undefined);
  const [loading, setLoading] = useState(staticCandidate || (preview.status === 'available' && preview.type === 'sprite'));
  const [isCapture, setIsCapture] = useState(false);

  useEffect(() => {
    let active = true;
    const fallback = preview.status === 'unavailable' ? preview.reason : preview.type === 'component' ? 'Rendu dépendant des propriétés React' : 'SVG dynamique non extractible statiquement';
    setDisplayUrl(preview.status === 'available' ? preview.url : undefined);
    setReason(preview.status === 'unavailable' ? preview.reason : undefined);
    setLoading(staticCandidate || (preview.status === 'available' && preview.type === 'sprite'));
    setIsCapture(false);
    if (!staticCandidate || preview.status !== 'available' || typeof occurrence.occurrenceId !== 'string') return () => { active = false; };
    void fetch(preview.url).then(async (response) => {
      if (response.ok) return;
      const staticPayload = await response.json().catch(() => undefined);
      const staticReason = errorMessage(staticPayload, fallback);
      const captureResponse = await fetch(`/api/icon-capture/${encodeURIComponent(occurrence.occurrenceId)}`);
      if (captureResponse.ok) {
        if (active) { setDisplayUrl(`/api/icon-capture/${encodeURIComponent(occurrence.occurrenceId)}`); setReason(staticReason); setIsCapture(true); setLoading(false); }
        return;
      }
      const capturePayload = await captureResponse.json().catch(() => undefined);
      if (active) { setDisplayUrl(undefined); setReason(errorMessage(capturePayload, staticReason)); setLoading(false); }
    }).catch(() => { if (active) { setDisplayUrl(undefined); setReason(fallback); setLoading(false); } });
    return () => { active = false; };
  }, [occurrence.occurrenceId, preview, staticCandidate]);

  if (preview.status === 'unavailable' || !displayUrl) return <section className="current-icon-preview current-icon-preview--unavailable" aria-label="Icône actuelle"><strong>Icône actuelle</strong><span>Aperçu indisponible</span><small>{reason ?? preview.reason}</small></section>;
  const label = isCapture ? `Capture Playwright · ${String(occurrence.occurrenceId)}` : preview.label;
  return <section className="current-icon-preview" aria-label="Icône actuelle"><strong>Icône actuelle</strong><div className="current-icon-preview__image">{loading && <span className="current-icon-preview__loading">Chargement…</span>}<img src={displayUrl} alt={`Icône actuelle : ${label}`} onLoad={() => setLoading(false)} onError={() => { setLoading(false); setReason(preview.status === 'available' && preview.type === 'sprite' ? 'Symbole du sprite introuvable' : 'Fichier public introuvable'); setDisplayUrl(undefined); }} /></div><small>{label}</small><small>Format : {isCapture ? 'Capture Playwright' : preview.format}</small>{isCapture && reason && <small>{reason}</small>}{preview.status === 'available' && preview.type === 'sprite' && <small>Sprite SVG · {preview.symbolId}</small>}{preview.status === 'available' && preview.type === 'inline' && <small>SVG inline</small>}{preview.status === 'available' && preview.type === 'component' && <small>Composant React · {preview.label}</small>}</section>;
}
