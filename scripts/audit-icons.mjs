import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = process.cwd();
const INVENTORY_PATH = join(ROOT, 'docs', 'icon-audit', 'icon-inventory.json');
const GEOMETRY_ATTRIBUTES = {
  path: ['d'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], circle: ['cx', 'cy', 'r'],
  line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'], polygon: ['points'],
};
const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico']);
const ICON_LIBRARY = /(?:lucide|heroicons|react-icons|iconify|material(?:-ui)?|fontawesome|phosphor|tabler)/i;

function posixPath(filePath) { return relative(ROOT, filePath).replaceAll('\\', '/'); }
function walk(directory, predicate) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(directory, entry.name);
    return entry.isDirectory() ? walk(filePath, predicate) : predicate(filePath) ? [filePath] : [];
  });
}
function stableId(parts) { return createHash('sha1').update(parts.join('\u0000')).digest('hex').slice(0, 16); }

function parseAttributes(text) {
  const attributes = new Map();
  const expression = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of text.matchAll(expression)) {
    const name = match[1];
    if (['className', 'class', 'aria-label', 'title', 'width', 'height'].includes(name)) continue;
    attributes.set(name, (match[2] ?? match[3] ?? match[4] ?? '').trim().replace(/\s+/g, ' '));
  }
  return attributes;
}

/** Shape-only serialization: see docs/icon-audit/README.md for the exact contract. */
export function normalizeSvg(svg) {
  const tokens = [];
  const tagPattern = /<\/?([A-Za-z][\w:-]*)(?:\s+([^>]*?))?\s*\/?\s*>/g;
  for (const match of svg.replace(/<!--[^]*?-->/g, '').matchAll(tagPattern)) {
    const tag = match[1].split(':').at(-1).toLowerCase();
    const closing = match[0].startsWith('</');
    if (tag === 'svg' && !closing) {
      const viewBox = parseAttributes(match[2] ?? '').get('viewBox');
      tokens.push(`<svg${viewBox === undefined ? '' : ` viewBox="${viewBox}"`}>`);
    } else if (tag === 'svg' && closing) tokens.push('</svg>');
    else if (!closing && Object.hasOwn(GEOMETRY_ATTRIBUTES, tag)) {
      const attrs = parseAttributes(match[2] ?? '');
      const geometric = GEOMETRY_ATTRIBUTES[tag].filter((name) => attrs.has(name)).map((name) => `${name}="${attrs.get(name)}"`).join(' ');
      tokens.push(`<${tag}${geometric ? ` ${geometric}` : ''}/>`);
    }
  }
  return tokens.join('');
}
export function svgFingerprint(svg) { return createHash('sha256').update(normalizeSvg(svg)).digest('hex'); }

function jsxName(node) { return ts.isJsxNamespacedName(node) ? `${node.namespace.text}:${node.name.text}` : node.getText(); }
function findFirstSvg(node, sourceFile) {
  let found;
  function visit(current) {
    if (!found && ts.isJsxElement(current) && jsxName(current.openingElement.tagName).toLowerCase() === 'svg') found = current;
    if (!found) ts.forEachChild(current, visit);
  }
  ts.forEachChild(node, visit);
  return found ? found.getText(sourceFile) : '';
}
function componentDeclarations(sourceFile) {
  const declarations = new Map();
  function add(name, node) {
    if (!name.endsWith('Icon')) return;
    const svg = findFirstSvg(node, sourceFile);
    declarations.set(name, svg ? { svg, fingerprint: svgFingerprint(svg) } : null);
  }
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) add(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return declarations;
}
function isInIconDeclaration(node, sourceFile) {
  for (let current = node.parent; current && current !== sourceFile; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name?.text.endsWith('Icon')) return true;
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name) && current.name.text.endsWith('Icon')) return true;
  }
  return false;
}
function isInteractive(node) {
  for (let current = node.parent; current && !ts.isSourceFile(current); current = current.parent) {
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
      const tag = jsxName(current.tagName ?? current.openingElement.tagName).toLowerCase();
      if (['button', 'a', 'nav', 'input', 'select', 'textarea'].includes(tag)) return true;
      const attrs = current.attributes ?? current.openingElement.attributes;
      if (attrs.properties.some((item) => ts.isJsxAttribute(item) && item.name.text === 'role' && item.initializer?.getText().includes('button'))) return true;
    }
  }
  return false;
}
function attributeValue(attributes, name) {
  const attribute = attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.text === name);
  if (!attribute?.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  return ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression?.getText() : undefined;
}
function makeOccurrence({ file, route = '', kind, name, line, column, fingerprint = '', source = '', format }) {
  return { occurrenceId: stableId([file, kind, name, String(line), String(column)]), route, file, line, column, kind, name, format, fingerprint, source, status: 'discovered' };
}

export function collectOccurrencesFromSource(source, file = 'src/example.tsx', route = '') {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const components = componentDeclarations(sourceFile);
  const importedIcons = new Set();
  const occurrences = [];
  sourceFile.forEachChild((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !ICON_LIBRARY.test(statement.moduleSpecifier.text)) return;
    const importedFromStatement = [];
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach((item) => { importedIcons.add(item.name.text); importedFromStatement.push(item.name.text); });
    if (statement.importClause?.name) { importedIcons.add(statement.importClause.name.text); importedFromStatement.push(statement.importClause.name.text); }
    const position = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
    for (const name of importedFromStatement.sort()) {
      occurrences.push(makeOccurrence({ file, route, kind: 'icon-library-import', name, line: position.line + 1, column: position.character + 1, format: 'icon-library', source: statement.moduleSpecifier.text }));
    }
  });
  function visit(node) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const line = position.line + 1, column = position.character + 1;
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const name = jsxName(node.tagName);
      if (name.endsWith('Icon') || importedIcons.has(name)) {
        const component = components.get(name);
        occurrences.push(makeOccurrence({ file, route, kind: importedIcons.has(name) ? 'icon-library' : 'react-icon-component', name, line, column, fingerprint: component?.fingerprint ?? '', source: component?.svg ?? '', format: importedIcons.has(name) ? 'icon-library' : 'react-component' }));
      }
      if (name.toLowerCase() === 'svg' && !isInIconDeclaration(node, sourceFile)) {
        const text = node.parent && ts.isJsxElement(node.parent) ? node.parent.getText(sourceFile) : node.getText(sourceFile);
        const sprite = /<use\b[^>]*(?:href|xlink:href)\s*=\s*["']?([^\s"'>]+)/i.exec(text)?.[1];
        occurrences.push(makeOccurrence({ file, route, kind: sprite ? 'svg-sprite-reference' : 'inline-svg', name: sprite ?? 'svg', line, column, fingerprint: svgFingerprint(text), source: normalizeSvg(text), format: sprite ? 'svg-sprite' : 'inline-svg' }));
      }
      if (name.toLowerCase() === 'img' && isInteractive(node)) {
        const src = attributeValue(node.attributes, 'src');
        if (src && IMAGE_EXTENSIONS.has(extname(src.split('?')[0]).toLowerCase())) occurrences.push(makeOccurrence({ file, route, kind: 'interactive-image', name: src, line, column, format: extname(src).slice(1).toLowerCase(), source: src }));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return occurrences;
}
function routesByFile() {
  const routerPath = join(ROOT, 'src', 'app', 'router.tsx');
  if (!existsSync(routerPath)) return new Map();
  const text = readFileSync(routerPath, 'utf8'), result = new Map(), routes = new Map();
  for (const match of text.matchAll(/const\s+(\w+)\s*=\s*lazy[\s\S]*?import\(['"]([^'"]+)['"]\)/g)) result.set(match[1], resolve(dirname(routerPath), match[2]));
  for (const match of text.matchAll(/<Route(?:\s+path=["']([^"']+)["'])?[^>]*element=\{<(\w+)/g)) {
    const target = result.get(match[2]); if (target) routes.set(`${target}.tsx`, match[1] ?? '/');
  }
  return routes;
}
function readInventory() {
  if (!existsSync(INVENTORY_PATH)) return { schemaVersion: 1, icons: [] };
  const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'));
  return { schemaVersion: inventory.schemaVersion ?? 1, icons: Array.isArray(inventory.icons) ? inventory.icons : [] };
}
function compareOccurrences(left, right) { return left.route.localeCompare(right.route) || left.file.localeCompare(right.file) || left.occurrenceId.localeCompare(right.occurrenceId); }
export function mergeInventory(existing, discovered) {
  const byId = new Map(existing.icons.map((icon) => [icon.occurrenceId, icon]));
  const icons = discovered.map((icon) => {
    const manual = byId.get(icon.occurrenceId) ?? {};
    const { proposal, decision, notes, captures, status } = manual;
    return {
      ...manual,
      ...icon,
      ...(proposal === undefined ? {} : { proposal }),
      ...(decision === undefined ? {} : { decision }),
      ...(notes === undefined ? {} : { notes }),
      ...(captures === undefined ? {} : { captures }),
      ...(status === undefined ? {} : { status }),
    };
  }).sort(compareOccurrences);
  return { schemaVersion: existing.schemaVersion ?? 1, icons };
}
function collectPublicSvgOccurrences() {
  return walk(join(ROOT, 'public'), (file) => extname(file).toLowerCase() === '.svg').map((file) => {
    const content = readFileSync(file, 'utf8'), relativeFile = posixPath(file);
    return makeOccurrence({ file: relativeFile, kind: 'svg-file', name: relativeFile, line: 1, column: 1, fingerprint: svgFingerprint(content), source: normalizeSvg(content), format: 'svg-file' });
  });
}
function collectReferencedPublicImages() {
  const occurrences = [];
  const manifestPath = join(ROOT, 'public', 'manifest.webmanifest');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const source of manifest.icons?.map((icon) => icon.src).filter(Boolean) ?? []) {
      const extension = extname(source).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) continue;
      occurrences.push(makeOccurrence({ file: 'public/manifest.webmanifest', kind: 'manifest-icon', name: source, line: 1, column: 1, format: extension.slice(1), source }));
    }
  }
  const indexPath = join(ROOT, 'index.html');
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf8');
    for (const match of html.matchAll(/<link\b(?=[^>]*\brel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi)) {
      const source = match[1], extension = extname(source).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) continue;
      const prefix = html.slice(0, match.index);
      const line = prefix.split('\n').length;
      const column = prefix.length - prefix.lastIndexOf('\n');
      occurrences.push(makeOccurrence({ file: 'index.html', kind: 'html-icon-link', name: source, line, column, format: extension.slice(1), source }));
    }
  }
  return occurrences;
}
export function auditProject(root = ROOT) {
  if (root !== ROOT) throw new Error('auditProject runs from the repository root.');
  const routes = routesByFile();
  const sourceFiles = walk(join(ROOT, 'src'), (file) => ['.ts', '.tsx'].includes(extname(file)) && !file.includes('.test.'));
  return [...sourceFiles.flatMap((file) => collectOccurrencesFromSource(readFileSync(file, 'utf8'), posixPath(file), routes.get(file) ?? '')), ...collectPublicSvgOccurrences(), ...collectReferencedPublicImages()].sort(compareOccurrences);
}
export function summarizeOccurrences(occurrences) {
  const fingerprints = occurrences.map((item) => item.fingerprint).filter(Boolean), unique = new Set(fingerprints);
  return { occurrences: occurrences.length, uniqueForms: unique.size, exactDuplicates: fingerprints.length - unique.size, formats: [...new Set(occurrences.map((item) => item.format))].sort() };
}
export function runAudit() {
  const inventory = mergeInventory(readInventory(), auditProject());
  writeFileSync(INVENTORY_PATH, `${JSON.stringify(inventory, null, 2)}\n`);
  const summary = summarizeOccurrences(inventory.icons);
  console.log(`Icon audit: ${summary.occurrences} occurrences, ${summary.uniqueForms} unique forms, ${summary.exactDuplicates} exact duplicates.`);
  console.log(`Formats: ${summary.formats.join(', ') || 'none'}.`);
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runAudit();
