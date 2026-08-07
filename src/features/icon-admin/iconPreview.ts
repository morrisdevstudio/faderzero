import type { IconOccurrence } from './iconCatalogService';

function kebabIconName(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').replace(/([A-Za-z])(\d)/g, '$1-$2').toLowerCase();
}

export function legacySvgUrl(source: string) {
  if (!source.trim().startsWith('<svg')) return null;
  let svg = source.trim()
    .replace(/\{\.\.\.props\}/g, '')
    .replace(/strokeWidth=/g, 'stroke-width=')
    .replace(/strokeLinecap=/g, 'stroke-linecap=')
    .replace(/strokeLinejoin=/g, 'stroke-linejoin=')
    .replace(/className=/g, 'class=')
    .replace(/currentColor/g, '#f4f4f5');
  if (!/^<svg\b[^>]*\bxmlns=/.test(svg)) svg = svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/^<svg\b[^>]*\b(?:fill|stroke)=/.test(svg)) {
    svg = svg.replace(/^<svg\b([^>]*)>/, '<svg$1 fill="none" stroke="#f4f4f5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">');
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function publicIconUrl(source: string, file = '') {
  const sourceValue = source.trim();
  if (/^\/(?!\/)[^?#]+\.(?:avif|gif|ico|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(sourceValue)) return sourceValue;
  const normalizedFile = file.replace(/\\/g, '/');
  return /^public\/[^?#]+\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(normalizedFile)
    ? `/${normalizedFile.slice('public/'.length)}`
    : null;
}

export function lucideNameCandidates(name: string, source: string) {
  const values = new Set<string>();
  const fzIconName = source.match(/<FzIcon\b[^>]*\bname=["']([^"']+)["']/)?.[1];
  if (fzIconName) values.add(fzIconName);

  const componentName = name.replace(/^Lucide/, '').replace(/Icon$/, '');
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(componentName)) values.add(kebabIconName(componentName));
  return [...values];
}

export function occurrenceLocation(occurrence: IconOccurrence) {
  const page = occurrence.pageName.trim();
  const route = occurrence.route.trim();
  if (page && route) return `${page} · ${route}`;
  if (page || route) return page || route;
  const file = occurrence.file.replace(/\\/g, '/').split('/').pop();
  if (!file) return 'Emplacement inconnu';
  return occurrence.line > 0 ? `${file} · ligne ${occurrence.line}` : file;
}

export function occurrenceFormatLabel(format: string) {
  const labels: Record<string, string> = {
    png: 'Image PNG',
    svg: 'Fichier SVG',
    'svg-file': 'Fichier SVG',
    'inline-svg': 'SVG intégré',
    'react-component': 'Composant React',
    'lucide-react': 'Icône Lucide',
  };
  return labels[format] ?? (format.replace(/-/g, ' ') || 'Format inconnu');
}
