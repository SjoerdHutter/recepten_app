import { describe, expect, it } from 'vitest';
import { findTimeMentions, formatClock } from './timers';

const seconden = (tekst: string) => findTimeMentions(tekst).map((m) => m.seconds);
const teksten = (tekst: string) => findTimeMentions(tekst).map((m) => m.text);

describe('tijden in staptekst herkennen', () => {
  it('leest getallen met een eenheid', () => {
    expect(seconden('Bak 10 minuten.')).toEqual([600]);
    expect(seconden('Laat 3 uur stoven.')).toEqual([10800]);
    expect(seconden('Roer 30 seconden.')).toEqual([30]);
    expect(seconden('Wacht 20 min.')).toEqual([1200]);
  });

  it('leest tijden die als woord geschreven staan', () => {
    // Deze komen echt zo voor in de recepten en hebben geen timer-veld.
    expect(seconden('Laat het een halfuur buiten de koelkast liggen.')).toEqual([1800]);
    expect(seconden('Laat een half uur rijzen.')).toEqual([1800]);
    expect(seconden('Nog een kwartier in de oven.')).toEqual([900]);
    expect(seconden('Reken op drie kwartier.')).toEqual([2700]);
    expect(seconden('Laat anderhalf uur pruttelen.')).toEqual([5400]);
  });

  it('neemt bij een bereik de ondergrens', () => {
    // Je zet de wekker op het moment dat je moet gaan kijken.
    expect(seconden('Bak 20 tot 25 minuten.')).toEqual([1200]);
    expect(seconden('Bak 10-15 minuten.')).toEqual([600]);
    expect(teksten('Bak 20 tot 25 minuten.')).toEqual(['20 tot 25 minuten']);
  });

  it('vindt meerdere tijden in één stap', () => {
    expect(seconden('Bak 10 minuten en laat daarna 5 minuten rusten.')).toEqual([600, 300]);
  });

  it('leest kommagetallen', () => {
    expect(seconden('Laat 1,5 uur staan.')).toEqual([5400]);
  });

  it('leest uitgeschreven getallen', () => {
    // "Laat drie uur stoven" is de belangrijkste tijd van een stoofpot.
    expect(seconden('Laat drie uur stoven.')).toEqual([10800]);
    expect(seconden('Wacht twee minuten.')).toEqual([120]);
    expect(seconden('Nog een uur in de oven.')).toEqual([3600]);
  });

  it('vindt de stooftijd én het roerinterval', () => {
    // Deze zin staat echt in de runderstoof.
    expect(seconden('Laat drie uur stoven en roer elk halfuur even.')).toEqual([10800, 1800]);
  });

  it('ziet "een" als lidwoord niet aan voor een tijd', () => {
    expect(seconden('Verhit een pan met een scheut olie.')).toEqual([]);
  });

  it('trapt niet in temperaturen en maten', () => {
    expect(seconden('Verwarm de oven voor op 180 graden.')).toEqual([]);
    expect(seconden('Gebruik een springvorm van 24 cm.')).toEqual([]);
    expect(seconden('Snijd in blokken van 3 cm.')).toEqual([]);
    expect(seconden('Voeg 400 g tomatenblokjes toe.')).toEqual([]);
  });

  it('geeft de plek in de tekst terug, zodat de knop op het juiste woord staat', () => {
    const tekst = 'Breng aan de kook en laat 3 uur stoven.';
    const treffer = findTimeMentions(tekst)[0];
    expect(tekst.slice(treffer!.start, treffer!.end)).toBe('3 uur');
  });

  it('laat een stap zonder tijd met rust', () => {
    expect(seconden('Dep het vlees droog en bestrooi het met zout en peper.')).toEqual([]);
  });
});

describe('aftelklok', () => {
  it('schrijft minuten en seconden', () => {
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(5)).toBe('0:05');
  });

  it('schrijft uren erbij zodra het langer duurt', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(10800)).toBe('3:00:00');
    expect(formatClock(3725)).toBe('1:02:05');
  });

  it('gaat niet onder nul', () => {
    expect(formatClock(-10)).toBe('0:00');
  });
});
