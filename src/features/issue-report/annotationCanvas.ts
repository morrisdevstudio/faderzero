import type { IssueReportAnnotation, IssueReportAnnotationPoint } from '@/db/schema';
import { canvasToWebp } from './captureViewport';

export type AnnotationTool = 'freehand' | 'ellipse' | 'arrow' | 'text' | 'mask';

export function drawAnnotations(
  context: CanvasRenderingContext2D,
  annotations: readonly IssueReportAnnotation[],
  preview?: IssueReportAnnotation,
): void {
  for (const annotation of preview ? [...annotations, preview] : annotations) drawAnnotation(context, annotation);
}

export function drawAnnotation(context: CanvasRenderingContext2D, annotation: IssueReportAnnotation): void {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = 5;
  context.strokeStyle = '#ff315c';
  context.fillStyle = '#ff315c';

  if (annotation.type === 'freehand') {
    const [first, ...rest] = annotation.points;
    if (first) {
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (const point of rest) context.lineTo(point.x, point.y);
      context.stroke();
    }
  } else if (annotation.type === 'ellipse') {
    const centerX = (annotation.start.x + annotation.end.x) / 2;
    const centerY = (annotation.start.y + annotation.end.y) / 2;
    context.beginPath();
    context.ellipse(centerX, centerY, Math.abs(annotation.end.x - annotation.start.x) / 2, Math.abs(annotation.end.y - annotation.start.y) / 2, 0, 0, Math.PI * 2);
    context.stroke();
  } else if (annotation.type === 'mask') {
    context.fillStyle = '#090909';
    context.fillRect(annotation.start.x, annotation.start.y, annotation.end.x - annotation.start.x, annotation.end.y - annotation.start.y);
  } else if (annotation.type === 'arrow') {
    const angle = Math.atan2(annotation.end.y - annotation.start.y, annotation.end.x - annotation.start.x);
    const head = 18;
    context.beginPath();
    context.moveTo(annotation.start.x, annotation.start.y);
    context.lineTo(annotation.end.x, annotation.end.y);
    context.lineTo(annotation.end.x - head * Math.cos(angle - Math.PI / 6), annotation.end.y - head * Math.sin(angle - Math.PI / 6));
    context.moveTo(annotation.end.x, annotation.end.y);
    context.lineTo(annotation.end.x - head * Math.cos(angle + Math.PI / 6), annotation.end.y - head * Math.sin(angle + Math.PI / 6));
    context.stroke();
  } else if (annotation.type === 'text') {
    context.font = '700 24px system-ui, sans-serif';
    context.textBaseline = 'top';
    const metrics = context.measureText(annotation.text);
    context.fillStyle = 'rgba(9,9,9,.82)';
    context.fillRect(annotation.at.x - 5, annotation.at.y - 4, metrics.width + 10, 34);
    context.fillStyle = '#ff315c';
    context.fillText(annotation.text, annotation.at.x, annotation.at.y);
  }
  context.restore();
}

export function canvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): IssueReportAnnotationPoint {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (clientX - bounds.left) * canvas.width / bounds.width)),
    y: Math.max(0, Math.min(canvas.height, (clientY - bounds.top) * canvas.height / bounds.height)),
  };
}

export async function renderAnnotatedScreenshot(
  screenshot: Blob,
  annotations: readonly IssueReportAnnotation[],
): Promise<Blob> {
  const bitmap = await createImageBitmap(screenshot);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponible sur ce navigateur.');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  drawAnnotations(context, annotations);
  return canvasToWebp(canvas);
}
