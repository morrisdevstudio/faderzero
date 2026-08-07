import { readFile } from 'node:fs/promises';

export class SpritePreviewError extends Error {
  constructor(public readonly code: 'INVALID_SYMBOL_ID' | 'SYMBOL_NOT_FOUND' | 'SPRITE_INVALID' | 'SPRITE_READ_FAILED', message: string) {
    super(message);
  }
}

export const isSafeSpriteSymbolId = (symbolId: string) => /^[A-Za-z0-9_-]+$/.test(symbolId);

const attribute = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match?.[1] ?? match?.[2];
};

const validViewBox = (value: string | undefined) => Boolean(value && /^[-+0-9.eE]+(?:[\s,]+[-+0-9.eE]+){3}$/.test(value.trim()));

function assertSafeSvg(fragment: string) {
  if (/<\s*(?:script|foreignObject)\b/i.test(fragment)) throw new SpritePreviewError('SPRITE_INVALID', 'Le symbole contient un élément non autorisé.');
  if (/\son[a-z]+\s*=/i.test(fragment)) throw new SpritePreviewError('SPRITE_INVALID', 'Le symbole contient un gestionnaire d’événement non autorisé.');
  if (/(?:href|xlink:href)\s*=\s*["']\s*(?:(?:https?|file):|\/\/)/i.test(fragment) || /url\(\s*(?:(?:https?|file):|\/\/)/i.test(fragment)) throw new SpritePreviewError('SPRITE_INVALID', 'Le symbole contient une référence externe non autorisée.');
}

/** Extracts a symbol with a focused scanner; it does not parse arbitrary HTML. */
export function createStandaloneSpriteSvg(sprite: string, symbolId: string): string {
  if (!isSafeSpriteSymbolId(symbolId)) throw new SpritePreviewError('INVALID_SYMBOL_ID', 'Identifiant de symbole invalide.');
  const root = sprite.match(/<svg\b[^>]*>/i)?.[0];
  const rootViewBox = root ? attribute(root, 'viewBox') : undefined;
  const symbols = /<symbol\b[^>]*>/gi;
  let opening: RegExpExecArray | null;
  while ((opening = symbols.exec(sprite))) {
    const closeIndex = sprite.indexOf('</symbol>', symbols.lastIndex);
    if (closeIndex < 0) throw new SpritePreviewError('SPRITE_INVALID', 'Sprite SVG incomplet.');
    const openingTag = opening[0];
    const id = attribute(openingTag, 'id');
    const content = sprite.slice(symbols.lastIndex, closeIndex);
    symbols.lastIndex = closeIndex + '</symbol>'.length;
    if (id !== symbolId) continue;
    assertSafeSvg(`${openingTag}${content}`);
    const viewBox = attribute(openingTag, 'viewBox') ?? rootViewBox;
    if (!validViewBox(viewBox)) throw new SpritePreviewError('SPRITE_INVALID', 'Le symbole ne possède pas de viewBox valide.');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`;
  }
  throw new SpritePreviewError('SYMBOL_NOT_FOUND', 'Symbole du sprite introuvable.');
}

export type SpriteFileReader = (path: string, encoding: 'utf8') => Promise<string>;

export async function loadStandaloneSpriteSvg(symbolId: string, spritePath: string, fileReader: SpriteFileReader = readFile): Promise<string> {
  try { return createStandaloneSpriteSvg(await fileReader(spritePath, 'utf8'), symbolId); }
  catch (error) {
    if (error instanceof SpritePreviewError) throw error;
    throw new SpritePreviewError('SPRITE_READ_FAILED', 'Lecture du sprite impossible.');
  }
}
