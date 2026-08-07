import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { extractInlineSvg, previewInlineSvg } from '../inlineSvgPreview';

const temporaryDirectories: string[] = [];
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

const staticSvg = `const Icon = () => <svg viewBox="0 0 24 24" width="20" height="20" className="icon" fill="none" stroke="currentColor"><g><path d="M2 3" strokeWidth="2"/><rect x="1" y="2" width="3" height="4" fill="#fff"/></g></svg>;`;

describe('inline SVG preview generator', () => {
  it('sérialise un SVG statique autonome', () => {
    const preview = extractInlineSvg(staticSvg, { line: 1 });
    expect(preview).toMatchObject({ status: 'available' });
    if (preview.status === 'available') {
      expect(preview.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(preview.svg).toContain('viewBox="0 0 24 24"');
      expect(preview.svg).toContain('stroke="currentColor"');
      expect(preview.svg).toContain('stroke-width="2"');
      expect(preview.svg).toContain('fill="#fff"');
      expect(preview.svg).not.toContain('className');
      expect(preview.svg).not.toContain('width="20"');
      expect(preview.svg).not.toContain('height="20"');
    }
  });

  it.each([
    ['<svg viewBox="0 0 1 1"><path d={path}/></svg>'],
    ['<svg viewBox="0 0 1 1" {...props}><path d="M1 1"/></svg>'],
    ['<svg viewBox="0 0 1 1" onClick={onClick}><path d="M1 1"/></svg>'],
    ['<svg viewBox="0 0 1 1"><foreignObject/></svg>'],
    ['<svg viewBox="0 0 1 1"><use href="https://example.test/a.svg"/></svg>'],
    ['<svg viewBox="0 0 1 1">{active && <path d="M1 1"/>}</svg>'],
  ])('refuse les SVG non statiques : %s', (svg) => expect(extractInlineSvg(`const X = () => ${svg};`, { line: 1 })).toEqual({ status: 'unavailable', reason: 'SVG dynamique non extractible statiquement' }));

  it('détecte une occurrence ambiguë', () => expect(extractInlineSvg('const X = () => <><svg viewBox="0 0 1 1"></svg><svg viewBox="0 0 1 1"></svg></>;', { line: 1 })).toEqual({ status: 'unavailable', reason: 'occurrence SVG ambiguë' }));
  it('refuse une ligne ou une empreinte qui ne correspond pas', () => {
    expect(extractInlineSvg(staticSvg, { line: 3 })).toEqual({ status: 'unavailable', reason: 'SVG inline introuvable' });
    expect(extractInlineSvg(staticSvg, { line: 1, fingerprint: 'not-the-fingerprint' })).toEqual({ status: 'unavailable', reason: 'SVG inline introuvable' });
  });

  it('résout un fichier temporaire autorisé sans lire le dépôt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fz-inline-preview-')); temporaryDirectories.push(root);
    await mkdir(join(root, 'src')); await writeFile(join(root, 'src', 'Static.tsx'), staticSvg);
    await expect(previewInlineSvg(root, { file: 'src/Static.tsx', line: 1 })).resolves.toMatchObject({ status: 'available', sourceFile: 'src/Static.tsx' });
    await expect(previewInlineSvg(root, { file: 'src/Missing.tsx', line: 1 })).resolves.toEqual({ status: 'unavailable', reason: 'Fichier source introuvable' });
    await expect(previewInlineSvg(root, { file: '../outside.tsx', line: 1 })).resolves.toEqual({ status: 'unavailable', reason: 'Fichier source non autorisé' });
  });
});
