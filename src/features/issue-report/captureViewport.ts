import type { IssueReportDiagnostics } from '@/db/schema';

const MAX_CAPTURE_WIDTH = 1440;

export async function captureViewport(): Promise<Blob> {
  const { default: html2canvas } = await import('@html2canvas/html2canvas');
  await document.fonts?.ready.catch(() => undefined);
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const options = {
    backgroundColor: '#0c0d10',
    useCORS: true,
    allowTaint: false,
    logging: false,
    width: viewportWidth,
    height: viewportHeight,
    windowWidth: viewportWidth,
    windowHeight: viewportHeight,
    x: window.scrollX,
    y: window.scrollY,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    ignoreElements: (element: Element) => element.hasAttribute('data-issue-reporter-ui'),
    onclone: (clonedDocument: Document) => {
      clonedDocument.documentElement.style.width = `${viewportWidth}px`;
      clonedDocument.body.style.width = `${viewportWidth}px`;
      clonedDocument.body.style.overflowX = 'hidden';
    },
  };

  let lastError: unknown;
  for (const foreignObjectRendering of [true, false]) {
    try {
      const canvas = await html2canvas(document.body, { ...options, foreignObjectRendering });
      if (canvas.width <= 0 || canvas.height <= 0) throw new Error('Capture vide.');
      return await resizeAndEncode(canvas);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Capture impossible sur ce navigateur.');
}

async function resizeAndEncode(canvas: HTMLCanvasElement): Promise<Blob> {
  const scale = Math.min(1, MAX_CAPTURE_WIDTH / canvas.width);
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(canvas.width * scale));
  output.height = Math.max(1, Math.round(canvas.height * scale));
  const context = output.getContext('2d');
  if (!context) throw new Error('Canvas indisponible sur ce navigateur.');
  context.drawImage(canvas, 0, 0, output.width, output.height);
  return canvasToWebp(output);
}

export function collectIssueReportDiagnostics(pathname: string, online = navigator.onLine): IssueReportDiagnostics {
  return {
    route: pathname,
    appVersion: import.meta.env.VITE_APP_VERSION?.trim() || 'development',
    capturedAt: new Date().toISOString(),
    viewport: `${window.innerWidth}×${window.innerHeight}@${window.devicePixelRatio || 1}`,
    userAgent: navigator.userAgent,
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    online,
  };
}

export function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return encode(0);

  function encode(index: number): Promise<Blob> {
    const qualities = [0.86, 0.7, 0.5];
    const quality = qualities[index];
    if (quality === undefined) return Promise.reject(new Error('La capture dépasse la limite de 5 Mio.'));
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Conversion de la capture impossible.'));
        } else if (blob.size <= 5 * 1024 * 1024) {
          resolve(blob);
        } else {
          void encode(index + 1).then(resolve, reject);
        }
      }, 'image/webp', quality);
    });
  }
}
