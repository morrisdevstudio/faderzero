import { createHash } from 'node:crypto';
import { realpath, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import ts from 'typescript';

export type InlineSvgOccurrence = { occurrenceId?: unknown; file?: unknown; line?: unknown; fingerprint?: unknown; format?: unknown; kind?: unknown };
export type InlineSvgPreview =
  | { status: 'available'; svg: string; sourceFile: string; fingerprint: string }
  | { status: 'unavailable'; reason: 'SVG dynamique non extractible statiquement' | 'occurrence SVG ambiguë' | 'SVG inline introuvable' | 'Fichier source introuvable' | 'Fichier source non autorisé' };

const allowedTags = new Set(['svg', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'g']);
const allowedAttributes = new Set(['viewBox', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'fillRule', 'clipRule', 'opacity', 'transform', 'd', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'strokeMiterlimit', 'strokeDasharray', 'strokeDashoffset']);
const svgAttributeName: Record<string, string> = { strokeWidth: 'stroke-width', strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin', fillRule: 'fill-rule', clipRule: 'clip-rule', strokeMiterlimit: 'stroke-miterlimit', strokeDasharray: 'stroke-dasharray', strokeDashoffset: 'stroke-dashoffset' };

const escapeXml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const jsxName = (node: ts.JsxTagNameExpression) => node.getText();

function literalValue(attribute: ts.JsxAttribute): string | undefined {
  if (!attribute.initializer) return '';
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression && (ts.isStringLiteral(attribute.initializer.expression) || ts.isNumericLiteral(attribute.initializer.expression))) return attribute.initializer.expression.text;
  return undefined;
}

function serializeAttributes(properties: ts.JsxAttributes['properties']): { valid: boolean; text: string } {
  const attributes: string[] = [];
  for (const property of properties) {
    if (ts.isJsxSpreadAttribute(property)) return { valid: false, text: '' };
    const name = property.name.text;
    if (/^on/i.test(name) || name === 'dangerouslySetInnerHTML') return { valid: false, text: '' };
    if (name === 'className' || name === 'class' || name === 'style' || name === 'width' || name === 'height' || name.startsWith('aria-')) continue;
    const value = literalValue(property);
    if (value === undefined) return { valid: false, text: '' };
    if (!allowedAttributes.has(name)) continue;
    if (/(?:https?:|file:|\/\/)/i.test(value) || /url\(\s*(?:(?:https?|file):|\/\/)/i.test(value)) return { valid: false, text: '' };
    attributes.push(`${svgAttributeName[name] ?? name}="${escapeXml(value)}"`);
  }
  return { valid: true, text: attributes.join(' ') };
}

function serializeElement(node: ts.JsxElement | ts.JsxSelfClosingElement): string | undefined {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const tag = jsxName(opening.tagName).toLowerCase();
  if (!allowedTags.has(tag)) return undefined;
  const attributes = serializeAttributes(opening.attributes.properties);
  if (!attributes.valid) return undefined;
  const openingText = `<${tag}${attributes.text ? ` ${attributes.text}` : ''}`;
  if (ts.isJsxSelfClosingElement(node)) return `${openingText}/>`;
  const children: string[] = [];
  for (const child of node.children) {
    if (ts.isJsxText(child)) { if (child.text.trim()) return undefined; continue; }
    if (!ts.isJsxElement(child) && !ts.isJsxSelfClosingElement(child)) return undefined;
    const serialized = serializeElement(child);
    if (!serialized) return undefined;
    children.push(serialized);
  }
  return `${openingText}>${children.join('')}</${tag}>`;
}

function collectSvgElements(sourceFile: ts.SourceFile) {
  const elements: ts.JsxElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && jsxName(node.openingElement.tagName).toLowerCase() === 'svg') elements.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return elements;
}

export function fingerprintInlineSvg(svg: string) { return createHash('sha256').update(svg.replace(/\s+/g, ' ').trim()).digest('hex'); }

function auditCompatibleFingerprint(svg: string) {
  const geometry: Record<string, string[]> = { path: ['d'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'], polygon: ['points'] };
  const tokens: string[] = [];
  for (const match of svg.matchAll(/<([a-z]+)\b([^>]*)\/?>(?:<\/\1>)?/gi)) {
    const tag = match[1].toLowerCase(), attributes = match[2];
    const values = new Map([...attributes.matchAll(/([:\w-]+)="([^"]*)"/g)].map((item) => [item[1], item[2]]));
    if (tag === 'svg') tokens.push(`<svg${values.has('viewBox') ? ` viewBox="${values.get('viewBox')}"` : ''}>`);
    else if (geometry[tag]) tokens.push(`<${tag}${geometry[tag].filter((name) => values.has(name)).map((name) => ` ${name}="${values.get(name)}"`).join('')}/>`);
  }
  tokens.push('</svg>');
  return createHash('sha256').update(tokens.join('')).digest('hex');
}

export function extractInlineSvg(source: string, occurrence: InlineSvgOccurrence): InlineSvgPreview {
  const sourceFile = ts.createSourceFile('inline.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const candidates = collectSvgElements(sourceFile).filter((node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 === occurrence.line);
  if (candidates.length > 1) return { status: 'unavailable', reason: 'occurrence SVG ambiguë' };
  if (candidates.length === 0) return { status: 'unavailable', reason: 'SVG inline introuvable' };
  const serialized = serializeElement(candidates[0]);
  if (!serialized) return { status: 'unavailable', reason: 'SVG dynamique non extractible statiquement' };
  const viewBox = serialized.match(/\bviewBox="([^"]+)"/)?.[1];
  if (!viewBox) return { status: 'unavailable', reason: 'SVG dynamique non extractible statiquement' };
  const svg = serialized.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (typeof occurrence.fingerprint === 'string' && occurrence.fingerprint && auditCompatibleFingerprint(svg) !== occurrence.fingerprint) return { status: 'unavailable', reason: 'SVG inline introuvable' };
  return { status: 'available', svg, sourceFile: '', fingerprint: fingerprintInlineSvg(svg) };
}

export async function resolveInlineSourcePath(repositoryRoot: string, sourceFile: unknown) {
  if (typeof sourceFile !== 'string' || !/^(?:src|tools)\//.test(sourceFile) || /(?:^|[\\/])\.\.(?:[\\/]|$)|^[A-Za-z]:|^\\\\|^(?:https?|file):/i.test(sourceFile)) return undefined;
  const root = await realpath(repositoryRoot);
  const target = await realpath(resolve(root, sourceFile));
  const inside = relative(root, target);
  return inside && !inside.startsWith(`..${sep}`) && inside !== '..' ? target : undefined;
}

export async function previewInlineSvg(repositoryRoot: string, occurrence: InlineSvgOccurrence, reader: (path: string, encoding: 'utf8') => Promise<string> = readFile): Promise<InlineSvgPreview> {
  let sourcePath: string | undefined;
  try { sourcePath = await resolveInlineSourcePath(repositoryRoot, occurrence.file); } catch { return { status: 'unavailable', reason: 'Fichier source introuvable' }; }
  if (!sourcePath) return { status: 'unavailable', reason: 'Fichier source non autorisé' };
  try {
    const preview = extractInlineSvg(await reader(sourcePath, 'utf8'), occurrence);
    return preview.status === 'available' ? { ...preview, sourceFile: String(occurrence.file) } : preview;
  } catch { return { status: 'unavailable', reason: 'Fichier source introuvable' }; }
}
