import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { extractInlineSvg, resolveInlineSourcePath, type InlineSvgPreview } from './inlineSvgPreview';

export type ReactIconOccurrence = { name?: unknown; file?: unknown; fingerprint?: unknown; format?: unknown; kind?: unknown };
export type ReactIconPreview = InlineSvgPreview | { status: 'unavailable'; reason: 'composant introuvable' | 'composant React ambigu' | 'rendu dépendant des propriétés React' };

const nameOf = (node: ts.JsxTagNameExpression) => node.getText().toLowerCase();

function declarationName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node)) return node.name?.text;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) return node.name.text;
  return undefined;
}

function hasDynamicRender(node: ts.Node) {
  let dynamic = false;
  const visit = (current: ts.Node) => {
    if (ts.isConditionalExpression(current) || ts.isIfStatement(current) || ts.isForStatement(current) || ts.isForOfStatement(current) || ts.isForInStatement(current)) dynamic = true;
    if (ts.isCallExpression(current) && current.expression.getText() !== 'String') dynamic = true;
    ts.forEachChild(current, visit);
  };
  visit(node);
  return dynamic;
}

function firstSvg(node: ts.Node): ts.JsxElement | undefined {
  let found: ts.JsxElement | undefined;
  const visit = (current: ts.Node) => { if (!found && ts.isJsxElement(current) && nameOf(current.openingElement.tagName) === 'svg') found = current; if (!found) ts.forEachChild(current, visit); };
  visit(node); return found;
}

function localLiterals(node: ts.Node) {
  const values = new Map<string, string>();
  const visit = (current: ts.Node) => { if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name) && current.initializer && (ts.isStringLiteral(current.initializer) || ts.isNumericLiteral(current.initializer))) values.set(current.name.text, current.initializer.getText()); ts.forEachChild(current, visit); };
  visit(node); return values;
}

export function extractReactIcon(source: string, occurrence: ReactIconOccurrence): ReactIconPreview {
  if (typeof occurrence.name !== 'string' || !occurrence.name.endsWith('Icon')) return { status: 'unavailable', reason: 'composant introuvable' };
  const sourceFile = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations: ts.Node[] = [];
  const visit = (node: ts.Node) => { if (declarationName(node) === occurrence.name) declarations.push(node); ts.forEachChild(node, visit); };
  visit(sourceFile);
  if (!declarations.length) return { status: 'unavailable', reason: 'composant introuvable' };
  if (declarations.length > 1) return { status: 'unavailable', reason: 'composant React ambigu' };
  const component = declarations[0];
  if (hasDynamicRender(component)) return { status: 'unavailable', reason: 'rendu dépendant des propriétés React' };
  const svg = firstSvg(component);
  if (!svg) return { status: 'unavailable', reason: 'rendu dépendant des propriétés React' };
  const literals = localLiterals(component);
  let svgText = svg.getText(sourceFile).replace(/\{\s*\.\.\.props\s*\}/g, '');
  for (const [name, literal] of literals) svgText = svgText.replace(new RegExp(`\\{\\s*${name}\\s*\\}`, 'g'), literal);
  const line = 1;
  const preview = extractInlineSvg(`const Preview = () => ${svgText};`, { line, fingerprint: undefined });
  if (preview.status !== 'available') return { status: 'unavailable', reason: 'rendu dépendant des propriétés React' };
  return preview;
}

export async function previewReactIcon(repositoryRoot: string, occurrence: ReactIconOccurrence, reader: (path: string, encoding: 'utf8') => Promise<string> = readFile): Promise<ReactIconPreview> {
  let file: string | undefined;
  try { file = await resolveInlineSourcePath(repositoryRoot, occurrence.file); } catch { return { status: 'unavailable', reason: 'Fichier source introuvable' }; }
  if (!file) return { status: 'unavailable', reason: 'Fichier source non autorisé' };
  try { const preview = extractReactIcon(await reader(file, 'utf8'), occurrence); return preview.status === 'available' ? { ...preview, sourceFile: String(occurrence.file) } : preview; } catch { return { status: 'unavailable', reason: 'Fichier source introuvable' }; }
}
