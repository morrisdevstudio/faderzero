import type { SetlistRecord, SetlistSongDetail } from '@/db/schema';
import { formatSongDuration } from '@/features/songs/songPresentation';

const PAGE_WIDTH_PT = 595.28;
const PAGE_HEIGHT_PT = 841.89;
const MM_TO_PT = 72 / 25.4;
const PX_TO_PT = 72 / 96;
const PAGE_MARGIN_PT = 3 * MM_TO_PT;

const PDF_HEADER_BOTTOM_MARGIN = 8;
const PDF_TITLE_FONT_SIZE = 12;
const PDF_TITLE_LINE_HEIGHT = 16;
const PDF_SONG_TITLE_FONT_SIZE = 16;
const PDF_SONG_META_FONT_SIZE = 7;
const PDF_SONG_META_LINE_HEIGHT = 9;
const PDF_SONG_ENTRY_HEIGHT = 32;
const PDF_SONGS_LIST_LEFT_PADDING = 20;
const PDF_TRANSITION_ARROW_LANE_WIDTH = 20;
const PDF_MIN_CONTENT_SCALE = 1.85;
const PDF_MEDIUM_CONTENT_SCALE = 2.1;
const PDF_MAX_CONTENT_SCALE = 2.35;
const PDF_HEADER_HEIGHT_PX = PDF_TITLE_LINE_HEIGHT + PDF_HEADER_BOTTOM_MARGIN;

type SongPdfEntry = {
  kind: 'song';
  id: string;
  title: string;
  metaText: string;
  showArrow: boolean;
};

type EndingPdfEntry = {
  kind: 'ending';
  id: string;
  metaText: string;
};

type PdfEntry = SongPdfEntry | EndingPdfEntry;

function clampText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapePdfText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ');
}

function toPdfByteArray(value: string) {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0) & 0xff));
}

function sanitizePdfFileName(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatPdfDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function getPdfContentScale(songCount: number) {
  if (songCount <= 8) return PDF_MAX_CONTENT_SCALE;
  if (songCount <= 12) return PDF_MEDIUM_CONTENT_SCALE;
  return PDF_MIN_CONTENT_SCALE;
}

function uppercase(value: string) {
  return value.toLocaleUpperCase('fr-FR');
}

function buildTransitionMeta(entry: SetlistSongDetail, setlist: SetlistRecord, durationSeconds: number) {
  const parts: string[] = [];
  const annotation = entry.annotation?.trim();
  const showKey = setlist.keyDisplayMode === 'all' || (setlist.keyDisplayMode !== 'none' && entry.noteShowKey);
  const showBpm = setlist.bpmDisplayMode === 'all' || (setlist.bpmDisplayMode !== 'none' && entry.noteShowBpm);

  if (showKey) {
    parts.push(entry.songKey || '— Ton');
  }
  if (showBpm) {
    parts.push(entry.songBpm !== undefined ? `${entry.songBpm} BPM` : '— BPM');
  }
  if (annotation) {
    parts.push(`[${annotation}]`);
  }
  if (durationSeconds > 0) {
    parts.push(formatSongDuration(durationSeconds));
  }

  return uppercase(parts.join(' · '));
}

function buildPdfEntries(
  setlist: SetlistRecord,
  entries: SetlistSongDetail[],
  songDurationsById: Map<string, number>,
) {
  const pdfEntries: PdfEntry[] = entries.map((entry, index) => ({
    kind: 'song',
    id: entry.id,
    title: clampText(uppercase(entry.songTitle || 'Sans titre'), 44),
    metaText: clampText(buildTransitionMeta(entry, setlist, songDurationsById.get(entry.songId) ?? 0), 76),
    showArrow: index > 0 && (entry.isDirectSegue ?? false),
  }));

  const closingAnnotation = setlist.closingAnnotation?.trim();
  if (closingAnnotation) {
    pdfEntries.push({
      kind: 'ending',
      id: 'ending-note',
      metaText: clampText(uppercase(`[${closingAnnotation}]`), 76),
    });
  }

  return pdfEntries;
}

function moveTo(x: number, y: number) {
  return `${x.toFixed(2)} ${y.toFixed(2)} m`;
}

function lineTo(x: number, y: number) {
  return `${x.toFixed(2)} ${y.toFixed(2)} l`;
}

function curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  return `${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${x3.toFixed(2)} ${y3.toFixed(2)} c`;
}

function addText(commands: string[], text: string, x: number, y: number, font: string, sizePt: number, colorRgb: [number, number, number]) {
  if (!text) {
    return;
  }

  commands.push('BT');
  commands.push(`/${font} ${sizePt.toFixed(2)} Tf`);
  commands.push(`${colorRgb[0].toFixed(3)} ${colorRgb[1].toFixed(3)} ${colorRgb[2].toFixed(3)} rg`);
  commands.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
  commands.push(`(${escapePdfText(text)}) Tj`);
  commands.push('ET');
}

function addSegueArrow(commands: string[], x: number, currentRowTop: number, rowHeightPt: number, scale: number) {
  const laneWidthPt = PDF_TRANSITION_ARROW_LANE_WIDTH * PX_TO_PT * scale;
  const strokeWidthPt = Math.max(1, 2.35 * scale);
  const titleCenterOffsetPt = (PDF_SONG_META_LINE_HEIGHT + PDF_SONG_TITLE_FONT_SIZE * 0.52) * PX_TO_PT * scale;

  const startY = currentRowTop + rowHeightPt - titleCenterOffsetPt;
  const endY = currentRowTop - titleCenterOffsetPt;
  const laneRightX = x + laneWidthPt * 0.84;
  const curveInsetX = x + laneWidthPt * 0.08;
  const arrowBaseX = laneRightX - laneWidthPt * 0.12;
  const arrowTipX = laneRightX;
  const arrowHalfHeight = 3.2 * scale;

  commands.push('q');
  commands.push('0.110 0.098 0.090 RG');
  commands.push(`${strokeWidthPt.toFixed(2)} w`);
  commands.push(moveTo(laneRightX, startY));
  commands.push(curveTo(curveInsetX, startY, curveInsetX, endY, arrowBaseX, endY));
  commands.push('S');
  commands.push(moveTo(arrowTipX, endY));
  commands.push(lineTo(arrowBaseX, endY + arrowHalfHeight));
  commands.push(lineTo(arrowBaseX, endY - arrowHalfHeight));
  commands.push('h');
  commands.push('f');
  commands.push('Q');
}

function buildPageContent(
  setlist: SetlistRecord,
  entries: PdfEntry[],
  contentScale: number,
) {
  const commands: string[] = [];
  const title = clampText(uppercase(setlist.name || 'Setlist'), 40);
  const marginLeft = PAGE_MARGIN_PT;
  const marginTop = PAGE_MARGIN_PT;
  const headerHeightPt = PDF_HEADER_HEIGHT_PX * PX_TO_PT;
  const contentStartTopPt = marginTop + headerHeightPt;
  const contentScalePt = PX_TO_PT * contentScale;
  const rowHeightPt = PDF_SONG_ENTRY_HEIGHT * contentScalePt;
  const listPaddingLeftPt = PDF_SONGS_LIST_LEFT_PADDING * contentScalePt;
  const titleY = PAGE_HEIGHT_PT - marginTop - PDF_TITLE_FONT_SIZE * PX_TO_PT;

  addText(commands, title, marginLeft, titleY, 'F2', PDF_TITLE_FONT_SIZE * PX_TO_PT, [0.11, 0.098, 0.09]);

  entries.forEach((entry, rowIndex) => {
    const topPt = PAGE_HEIGHT_PT - contentStartTopPt - rowIndex * rowHeightPt;
    const metaX = marginLeft + listPaddingLeftPt;
    const metaY = topPt - PDF_SONG_META_FONT_SIZE * contentScalePt;

    addText(commands, entry.metaText, metaX, metaY, 'F3', PDF_SONG_META_FONT_SIZE * contentScalePt, [0.451, 0.451, 0.451]);

    if (entry.kind === 'song') {
      const titleYLine = topPt - (PDF_SONG_META_LINE_HEIGHT + PDF_SONG_TITLE_FONT_SIZE) * contentScalePt;
      addText(commands, entry.title, metaX, titleYLine, 'F2', PDF_SONG_TITLE_FONT_SIZE * contentScalePt, [0, 0, 0]);

      if (entry.showArrow) {
        addSegueArrow(commands, marginLeft, topPt, rowHeightPt, contentScale);
      }
    }
  });

  return commands.join('\n');
}

function buildPdfDocument(objects: string[]) {
  const firstChunk = toPdfByteArray('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const chunks: Uint8Array[] = [firstChunk];
  const offsets: number[] = [0];
  let currentOffset = firstChunk.length;

  objects.forEach((objectContent, index) => {
    offsets.push(currentOffset);
    const objectBytes = toPdfByteArray(`${index + 1} 0 obj\n${objectContent}\nendobj\n`);
    chunks.push(objectBytes);
    currentOffset += objectBytes.length;
  });

  const xrefOffset = currentOffset;
  const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (let index = 1; index < offsets.length; index += 1) {
    xrefLines.push(`${String(offsets[index]).padStart(10, '0')} 00000 n `);
  }

  const trailer = [
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n');

  chunks.push(toPdfByteArray(`${xrefLines.join('\n')}\n${trailer}`));

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

export function generateSetlistPdfBytes(
  setlist: SetlistRecord,
  entries: SetlistSongDetail[],
  songDurationsById: Map<string, number>,
) {
  const pdfEntries = buildPdfEntries(setlist, entries, songDurationsById);
  const contentScale = getPdfContentScale(entries.length);
  const innerPageHeightPx = (PAGE_HEIGHT_PT - PAGE_MARGIN_PT * 2) / PX_TO_PT;
  const scaledContentHeightPx = Math.max(0, (innerPageHeightPx - PDF_HEADER_HEIGHT_PX) / contentScale);
  const rowsPerPage = Math.max(1, Math.floor(scaledContentHeightPx / PDF_SONG_ENTRY_HEIGHT));
  const pagedEntries: PdfEntry[][] = [];

  for (let index = 0; index < pdfEntries.length; index += rowsPerPage) {
    pagedEntries.push(pdfEntries.slice(index, index + rowsPerPage));
  }

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const baseObjectCount = 5;
  for (let index = 0; index < pagedEntries.length; index += 1) {
    pageObjectIds.push(baseObjectCount + index * 2 + 1);
    contentObjectIds.push(baseObjectCount + index * 2 + 2);
  }

  objects.push(`<< /Type /Pages /Count ${pagedEntries.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique >>');

  pagedEntries.forEach((pageEntries, pageIndex) => {
    const content = buildPageContent(setlist, pageEntries, contentScale);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT.toFixed(2)} ${PAGE_HEIGHT_PT.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjectIds[pageIndex]} 0 R >>`,
    );
    objects.push(`<< /Length ${toPdfByteArray(content).length} >>\nstream\n${content}\nendstream`);
  });

  return buildPdfDocument(objects);
}

export function downloadSetlistPdf(
  setlist: SetlistRecord,
  entries: SetlistSongDetail[],
  songDurationsById: Map<string, number>,
) {
  if (entries.length === 0) {
    throw new Error('EMPTY_SETLIST');
  }

  const bytes = generateSetlistPdfBytes(setlist, entries, songDurationsById);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);
  const exportDate = formatPdfDate(new Date());
  const setlistName = sanitizePdfFileName(setlist.name || 'Setlist') || 'Setlist';
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${setlistName}_${exportDate}.pdf`;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 1000);
}
