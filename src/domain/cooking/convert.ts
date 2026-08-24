/**
 * Het omrekenhulpje in de kookmodus: ovenschalen, blik naar vers, en wat dat
 * betekent voor de baktijd.
 *
 * Alles hier is een vuistregel en wordt in de app ook zo genoemd. Een taart is
 * geen natuurkundeopgave: wat de app kan doen is je het rekenwerk uit handen
 * nemen en zeggen vanaf wanneer je moet gaan kijken.
 */

export type TinShape = 'rond' | 'rechthoekig';

export interface Tin {
  shape: TinShape;
  /** Bij rond: de doorsnede in cm. */
  diameter?: number;
  /** Bij rechthoekig: lengte en breedte in cm. */
  length?: number;
  width?: number;
}

/** Bodemoppervlak in cm². Daar gaat het om, niet om de doorsnede. */
export const tinArea = (tin: Tin): number => {
  if (tin.shape === 'rond') {
    const d = tin.diameter ?? 0;
    return Math.PI * (d / 2) ** 2;
  }
  return (tin.length ?? 0) * (tin.width ?? 0);
};

export const describeTin = (tin: Tin): string =>
  tin.shape === 'rond' ? `rond, ${tin.diameter} cm` : `${tin.length} × ${tin.width} cm`;

export interface TinAdvice {
  /** Hoeveel groter de nieuwe vorm is; 1,4 betekent 40% meer bodem. */
  ratio: number;
  fromArea: number;
  toArea: number;
  /** Met hoeveel je de hoeveelheden vermenigvuldigt om dezelfde dikte te houden. */
  scaleBy: number;
  /**
   * Houd je de hoeveelheden gelijk, dan wordt het dunner of dikker. Vanaf hier
   * moet je gaan kijken, in minuten. Ontbreekt als er geen baktijd bekend is.
   */
  checkFromMinutes: number | undefined;
}

/**
 * De bruikbaarste raad is niet "pas de baktijd aan" maar "pas de hoeveelheden
 * aan": dan blijft de laag even dik en klopt de baktijd vanzelf. Het aanpassen
 * van de tijd is het alternatief voor als je nu eenmaal dit beslag hebt.
 */
export const compareTins = (from: Tin, to: Tin, bakeMinutes?: number): TinAdvice => {
  const fromArea = tinArea(from);
  const toArea = tinArea(to);
  const ratio = fromArea > 0 ? toArea / fromArea : 1;

  // Zelfde hoeveelheid in een grotere vorm wordt evenredig dunner, en dunner
  // beslag is eerder gaar. Lineair meeschalen is grof maar eerlijker dan een
  // precieze formule suggereren die er niet is.
  const checkFromMinutes =
    bakeMinutes !== undefined && ratio > 0
      ? Math.max(5, Math.round((bakeMinutes / ratio) * 0.9))
      : undefined;

  return {
    ratio,
    fromArea,
    toArea,
    scaleBy: ratio,
    checkFromMinutes,
  };
};

/** Veelgebruikte vormen, zodat je niet hoeft te meten. */
export const GANGBARE_VORMEN: Tin[] = [
  { shape: 'rond', diameter: 18 },
  { shape: 'rond', diameter: 20 },
  { shape: 'rond', diameter: 22 },
  { shape: 'rond', diameter: 24 },
  { shape: 'rond', diameter: 26 },
  { shape: 'rond', diameter: 28 },
  { shape: 'rechthoekig', length: 30, width: 20 },
  { shape: 'rechthoekig', length: 35, width: 25 },
  { shape: 'rechthoekig', length: 25, width: 11 },
];

export interface CanConversion {
  /** Wat er op het blik staat. */
  can: string;
  /** Het netto gewicht van het blik. */
  canAmount: string;
  /** Waar het ongeveer mee overeenkomt. */
  fresh: string;
  note?: string;
}

/**
 * Blik naar vers en omgekeerd. Uitlekgewicht is wat overblijft na afgieten, en
 * dat is bij peulvruchten ongeveer 60% van het netto gewicht.
 */
export const BLIK_TABEL: CanConversion[] = [
  {
    can: 'tomatenblokjes',
    canAmount: '400 g',
    fresh: '500 g verse tomaten, ongeveer 6 middelgrote',
    note: 'Vers bevat meer vocht; laat iets langer inkoken.',
  },
  {
    can: 'kikkererwten',
    canAmount: '400 g (240 g uitgelekt)',
    fresh: '120 g gedroogd',
    note: 'Een nacht weken en ongeveer een uur koken.',
  },
  {
    can: 'witte bonen of kidneybonen',
    canAmount: '400 g (240 g uitgelekt)',
    fresh: '120 g gedroogd',
    note: 'Een nacht weken en ongeveer een uur koken.',
  },
  {
    can: 'linzen',
    canAmount: '400 g (240 g uitgelekt)',
    fresh: '100 g gedroogd',
    note: 'Linzen hoeven niet geweekt; 20 tot 30 minuten koken.',
  },
  {
    can: 'mais',
    canAmount: '300 g (285 g uitgelekt)',
    fresh: '2 verse kolven',
  },
  {
    can: 'kokosmelk',
    canAmount: '400 ml',
    fresh: '100 g kokosrasp met 400 ml heet water, uitgeperst',
  },
];

export interface DryCooked {
  naam: string;
  droog: string;
  gekookt: string;
}

/** Gedroogd naar gekookt, voor als een recept het ene noemt en jij het andere hebt. */
export const DROOG_GEKOOKT: DryCooked[] = [
  { naam: 'rijst', droog: '100 g', gekookt: '260 g' },
  { naam: 'pasta', droog: '100 g', gekookt: '220 g' },
  { naam: 'linzen', droog: '100 g', gekookt: '240 g' },
  { naam: 'couscous', droog: '100 g', gekookt: '250 g' },
  { naam: 'havermout', droog: '100 g', gekookt: '300 g' },
];
