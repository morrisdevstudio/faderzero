import { getSongStatusLabel, getSongStatusTone } from './songPresentation';

describe('song status presentation', () => {
  it.each([
    ['Idee', 'Idée', 'default'],
    ['En cours', 'En cours', 'accent'],
    ['Pret', 'Prêt', 'success'],
  ] as const)('maps %s to its visible label and tone', (status, label, tone) => {
    expect(getSongStatusLabel(status)).toBe(label);
    expect(getSongStatusTone(status)).toBe(tone);
  });
});
