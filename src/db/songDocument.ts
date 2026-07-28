import { createId } from '@/lib/createId';

export const SONG_DOCUMENT_VERSION = 1 as const;

export const songSectionTypes = [
  'free',
  'verse',
  'prechorus',
  'chorus',
  'bridge',
  'intro',
  'outro',
  'solo',
  'custom',
] as const;

export type SongSectionType = (typeof songSectionTypes)[number];

export interface SongTextNode {
  type: 'text';
  text: string;
}

export interface SongParagraphNode {
  type: 'paragraph';
  attrs: { id: string };
  content?: SongTextNode[];
}

export interface SongSectionNode {
  type: 'songSection';
  attrs: {
    id: string;
    sectionType: SongSectionType;
    label: string;
  };
  content: SongParagraphNode[];
}

export interface SongDocumentV1 {
  type: 'doc';
  content: SongSectionNode[];
}

const sectionLabels: Record<Exclude<SongSectionType, 'free' | 'custom'>, string> = {
  verse: 'Couplet',
  prechorus: 'Pré-refrain',
  chorus: 'Refrain',
  bridge: 'Pont',
  intro: 'Intro',
  outro: 'Outro',
  solo: 'Solo',
};

const sectionAliases = new Map<string, SongSectionType>([
  ['couplet', 'verse'],
  ['verse', 'verse'],
  ['pre-refrain', 'prechorus'],
  ['pré-refrain', 'prechorus'],
  ['prechorus', 'prechorus'],
  ['refrain', 'chorus'],
  ['chorus', 'chorus'],
  ['pont', 'bridge'],
  ['bridge', 'bridge'],
  ['intro', 'intro'],
  ['outro', 'outro'],
  ['solo', 'solo'],
]);

function paragraph(text = ''): SongParagraphNode {
  return {
    type: 'paragraph',
    attrs: { id: createId() },
    ...(text ? { content: [{ type: 'text', text }] } : {}),
  };
}

export function getDefaultSectionLabel(type: SongSectionType) {
  if (type === 'free' || type === 'custom') {
    return '';
  }

  return sectionLabels[type];
}

export function createSongSection(type: SongSectionType = 'free', label = getDefaultSectionLabel(type)): SongSectionNode {
  return {
    type: 'songSection',
    attrs: {
      id: createId(),
      sectionType: type,
      label,
    },
    content: [paragraph()],
  };
}

export function createEmptySongDocument(): SongDocumentV1 {
  return {
    type: 'doc',
    content: [createSongSection()],
  };
}

function parseSectionHeader(line: string) {
  const candidate = line.trim().replace(/^\[|\]$/g, '').trim();
  const match = candidate.match(/^(.+?)(?:\s+(\d+))?$/u);
  if (!match) {
    return null;
  }

  const baseLabel = match[1]?.trim() ?? '';
  const normalized = baseLabel.toLocaleLowerCase('fr-FR').replace(/\s+/g, '-');
  const sectionType = sectionAliases.get(normalized);
  if (!sectionType) {
    return null;
  }

  const suffix = match[2] ? ` ${match[2]}` : '';
  return {
    sectionType,
    label: `${getDefaultSectionLabel(sectionType)}${suffix}`,
  };
}

export function textToSongDocument(value: string): SongDocumentV1 {
  const normalizedValue = value.replace(/\r\n?/g, '\n');
  if (!normalizedValue.trim()) {
    return createEmptySongDocument();
  }

  const sections: SongSectionNode[] = [];
  let activeSection: SongSectionNode | null = null;

  function ensureSection() {
    if (!activeSection) {
      activeSection = createSongSection();
      sections.push(activeSection);
    }
    return activeSection;
  }

  for (const line of normalizedValue.split('\n')) {
    const header = parseSectionHeader(line);
    if (header) {
      activeSection = createSongSection(header.sectionType, header.label);
      sections.push(activeSection);
      continue;
    }

    const section = ensureSection();
    if (section.content.length === 1 && !section.content[0]?.content && line === '') {
      continue;
    }
    if (section.content.length === 1 && !section.content[0]?.content) {
      section.content[0] = paragraph(line);
    } else {
      section.content.push(paragraph(line));
    }
  }

  return {
    type: 'doc',
    content: sections.length > 0 ? sections : [createSongSection()],
  };
}

function paragraphText(node: SongParagraphNode) {
  return node.content?.map((child) => child.text).join('') ?? '';
}

export function songDocumentToText(document: SongDocumentV1) {
  return document.content
    .map((section) => {
      const lines = section.content.map(paragraphText);
      const header = section.attrs.sectionType === 'free' ? '' : `[${section.attrs.label || getDefaultSectionLabel(section.attrs.sectionType)}]`;
      return [header, ...lines].filter((line, index) => index > 0 || Boolean(line)).join('\n').trimEnd();
    })
    .filter(Boolean)
    .join('\n\n');
}

export function deriveSongTitle(document: SongDocumentV1, maxLength = 60) {
  for (const section of document.content) {
    for (const currentParagraph of section.content) {
      const text = paragraphText(currentParagraph).trim();
      if (text) {
        return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…` : text;
      }
    }
  }

  return '';
}

export function isSongDocument(value: unknown): value is SongDocumentV1 {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SongDocumentV1>;
  return candidate.type === 'doc' && Array.isArray(candidate.content) && candidate.content.length > 0;
}

export function normalizeSongDocument(value: unknown, fallbackText = ''): SongDocumentV1 {
  return isSongDocument(value) ? value : textToSongDocument(fallbackText);
}
