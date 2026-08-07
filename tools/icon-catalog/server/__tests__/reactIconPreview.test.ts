import { describe, expect, it } from 'vitest';
import { extractReactIcon } from '../reactIconPreview';

describe('react icon preview', () => {
  it.each([
    ['function CalendarIcon(){ return <svg viewBox="0 0 24 24" className={"x"} {...props}><path d="M1 2" stroke="currentColor"/></svg>; }', 'CalendarIcon'],
    ['const PlayIcon = () => (<svg viewBox="0 0 24 24"><path fill="#fff" d="M1 2"/></svg>);', 'PlayIcon'],
    ['const PathIcon = () => { const d = "M1 2"; return <svg viewBox="0 0 24 24"><path d={d}/></svg>; };', 'PathIcon'],
  ])('extrait un composant statique', (source, name) => {
    const preview = extractReactIcon(source, { name });
    expect(preview).toMatchObject({ status: 'available' });
    if (preview.status === 'available') expect(preview.svg).toContain('viewBox="0 0 24 24"');
  });
  it.each([
    ['function EyeIcon({ crossed }) { return <svg viewBox="0 0 24 24">{crossed ? <path d="M1"/> : null}</svg>; }', 'EyeIcon'],
    ['const MapIcon = () => <svg viewBox="0 0 24 24">{items.map(x => <path d={x}/>)}</svg>;', 'MapIcon'],
    ['const ChildIcon = () => <svg viewBox="0 0 24 24"><Child/></svg>;', 'ChildIcon'],
  ])('refuse un rendu dynamique', (source, name) => expect(extractReactIcon(source, { name })).toEqual({ status: 'unavailable', reason: 'rendu dépendant des propriétés React' }));
  it('signale un composant absent', () => expect(extractReactIcon('const A = () => null;', { name: 'MissingIcon' })).toEqual({ status: 'unavailable', reason: 'composant introuvable' }));
  it('signale les déclarations ambiguës', () => expect(extractReactIcon('function SameIcon(){return <svg viewBox="0 0 1 1"/>} const SameIcon=()=> <svg viewBox="0 0 1 1"/>;', { name: 'SameIcon' })).toEqual({ status: 'unavailable', reason: 'composant React ambigu' }));
});
