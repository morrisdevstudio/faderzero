import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadStandaloneSpriteSvg, SpritePreviewError, type SpriteFileReader } from './spritePreview';

const sendJson = (response: ServerResponse, status: number, code: string, message: string) => {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ error: { code, message } }));
};

export function spritePreviewApi(spritePath: string, fileReader?: SpriteFileReader) {
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const match = request.url?.match(/^\/api\/icon-sprite\/([^/?]+)$/);
    if (!match) return next();
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return sendJson(response, 405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.');
    }
    let symbolId: string;
    try { symbolId = decodeURIComponent(match[1]); } catch { return sendJson(response, 400, 'INVALID_SYMBOL_ID', 'Identifiant de symbole invalide.'); }
    return loadStandaloneSpriteSvg(symbolId, spritePath, fileReader)
      .then((svg) => { response.statusCode = 200; response.setHeader('content-type', 'image/svg+xml'); response.end(svg); })
      .catch((error: unknown) => {
        if (error instanceof SpritePreviewError) {
          const status = error.code === 'INVALID_SYMBOL_ID' ? 400 : error.code === 'SYMBOL_NOT_FOUND' ? 404 : 500;
          return sendJson(response, status, error.code, status === 500 ? 'Aperçu du sprite indisponible.' : error.message);
        }
        return sendJson(response, 500, 'SPRITE_READ_FAILED', 'Aperçu du sprite indisponible.');
      });
  };
}
