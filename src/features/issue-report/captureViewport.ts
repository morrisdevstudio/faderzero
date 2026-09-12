import type { IssueReportDiagnostics } from '@/db/schema';

const MAX_CAPTURE_WIDTH = 1440;

export async function captureViewport(): Promise<Blob> {
  const { default: html2canvas } = await import('@html2canvas/html2canvas');
  const canvas = await html2canvas(document.documentElement, {
    backgroundColor: '#0c0d10',
    useCORS: true,
    allowTaint: false,
    logging: false,
    width: window.innerWidth,
    height: window.innerHeight,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    x: window.scrollX,
    y: window.scrollY,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    ignoreElements: (element) => element.hasAttribute('data-issue-reporter-ui'),
  });

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
