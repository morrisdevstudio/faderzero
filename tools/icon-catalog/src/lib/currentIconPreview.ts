export type IconOccurrenceForPreview = {
  occurrenceId?: unknown;
  name?: unknown;
  format?: unknown;
  source?: unknown;
  file?: unknown;
  kind?: unknown;
};

export type CurrentIconPreviewResult =
  | { status: 'available'; type: 'public-file'; url: string; format: string; label: string }
  | { status: 'available'; type: 'sprite'; url: string; format: 'Sprite SVG'; label: string; symbolId: string }
  | { status: 'available'; type: 'inline'; url: string; format: 'SVG inline'; label: string }
  | { status: 'available'; type: 'component'; url: string; format: 'Composant React'; label: string }
  | { status: 'unavailable'; reason: string };

const graphicExtensions = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp']);

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function publicGraphicUrl(value: string): string | undefined {
  const normalized = value.replace(/^\/+/, '');
  if (
    /^(?:\.\.(?:[\\/]|$)|file:|https?:|[a-z]:\\)/i.test(value)
    || value.includes('..')
    || value.includes('\\')
    || normalized.startsWith('/')
  ) {
    return undefined;
  }

  const relative = normalized.replace(/^public\//i, '');
  if (!relative || relative.includes(':') || relative.includes('//')) return undefined;
  const extension = relative.split('.').pop()?.toLowerCase();
  return extension && graphicExtensions.has(extension) ? `/${relative}` : undefined;
}

function unavailableFor(occurrence: IconOccurrenceForPreview): CurrentIconPreviewResult {
  if (occurrence.format === 'react-component' || occurrence.kind === 'react-icon-component') {
    return { status: 'unavailable', reason: 'Composant React — traitement prévu ultérieurement' };
  }
  if (occurrence.format === 'inline-svg' || occurrence.kind === 'inline-svg') {
    return { status: 'unavailable', reason: 'SVG inline — traitement prévu ultérieurement' };
  }
  if (
    occurrence.kind === 'svg-sprite-use'
    || occurrence.format === 'svg-sprite'
    || asText(occurrence.file)?.replace(/\\/g, '/').endsWith('/icons.svg')
    || asText(occurrence.source)?.includes('<use')
  ) {
    return { status: 'unavailable', reason: 'Symbole de sprite — traitement prévu ultérieurement' };
  }

  const candidates = [asText(occurrence.source), asText(occurrence.name), asText(occurrence.file)].filter(
    (value): value is string => Boolean(value),
  );
  if (candidates.some((candidate) => /\.[a-z0-9]+$/i.test(candidate)) && candidates.some((candidate) => !/\.(?:svg|png|jpg|jpeg|webp)$/i.test(candidate))) {
    return { status: 'unavailable', reason: 'Format non pris en charge' };
  }
  if (candidates.some((candidate) => /\.(?:svg|png|jpg|jpeg|webp)$/i.test(candidate))) {
    return { status: 'unavailable', reason: 'Fichier public introuvable' };
  }
  return { status: 'unavailable', reason: 'Source non identifiée' };
}

/** Reads only an explicit fragment; it never guesses a symbol for the whole sprite. */
export function resolveSpriteSymbolId(value: unknown): string | undefined {
  const source = asText(value);
  if (!source) return undefined;
  const match = source.match(/^(?:#|(?:\/?|public\/)?icons\.svg#)([A-Za-z0-9_-]+)$/i);
  return match?.[1];
}

function spritePreview(occurrence: IconOccurrenceForPreview): CurrentIconPreviewResult | undefined {
  for (const candidate of [occurrence.source, occurrence.name, occurrence.file]) {
    const symbolId = resolveSpriteSymbolId(candidate);
    if (symbolId) {
      return {
        status: 'available', type: 'sprite', url: `/api/icon-sprite/${encodeURIComponent(symbolId)}`,
        format: 'Sprite SVG', label: `icons.svg#${symbolId}`, symbolId,
      };
    }
  }
  return undefined;
}

/** Resolves only a safe, root-public asset URL. It never exposes local paths. */
export function resolveCurrentIconPreview(occurrence: IconOccurrenceForPreview): CurrentIconPreviewResult {
  const sprite = spritePreview(occurrence);
  if (sprite) return sprite;
  if (occurrence.format === 'inline-svg' || occurrence.kind === 'inline-svg') {
    const occurrenceId = asText(occurrence.occurrenceId);
    return occurrenceId && /^[A-Za-z0-9_-]+$/.test(occurrenceId)
      ? { status: 'available', type: 'inline', url: `/api/icon-inline/${encodeURIComponent(occurrenceId)}`, format: 'SVG inline', label: occurrenceId }
      : { status: 'unavailable', reason: 'SVG dynamique non extractible statiquement' };
  }
  if (occurrence.format === 'react-component' || occurrence.kind === 'react-icon-component') {
    const occurrenceId = asText(occurrence.occurrenceId);
    const component = asText(occurrence.name);
    return occurrenceId && component && /^[A-Za-z0-9_-]+$/.test(occurrenceId)
      ? { status: 'available', type: 'component', url: `/api/icon-component/${encodeURIComponent(occurrenceId)}`, format: 'Composant React', label: component }
      : { status: 'unavailable', reason: 'Rendu dépendant des propriétés React' };
  }
  if (
    occurrence.kind === 'svg-sprite-use'
    || occurrence.format === 'svg-sprite'
    || asText(occurrence.source)?.includes('<use')
    || asText(occurrence.file)?.replace(/\\/g, '/').endsWith('/icons.svg')
  ) {
    return unavailableFor(occurrence);
  }

  for (const candidate of [asText(occurrence.source), asText(occurrence.name), asText(occurrence.file)]) {
    if (!candidate || candidate.includes('<svg')) continue;
    const url = publicGraphicUrl(candidate);
    if (url) {
      return {
        status: 'available',
        type: 'public-file',
        url,
        format: url.split('.').pop()!.toLowerCase(),
        label: candidate,
      };
    }
  }

  return unavailableFor(occurrence);
}
