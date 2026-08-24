/**
 * Weekhulpjes. De week begint op maandag, zoals in Nederland gebruikelijk is,
 * en alles rekent met yyyy-mm-dd in plaats van met Date-objecten: een datum is
 * hier een dag, geen tijdstip, en dan is een tekenreeks minder foutgevoelig dan
 * een tijdstempel die per tijdzone kan verspringen.
 */

export type DateKey = string;

export const toKey = (date: Date): DateKey => {
  const jaar = date.getFullYear();
  const maand = String(date.getMonth() + 1).padStart(2, '0');
  const dag = String(date.getDate()).padStart(2, '0');
  return `${jaar}-${maand}-${dag}`;
};

export const fromKey = (key: DateKey): Date => new Date(`${key}T00:00:00`);

export const addDays = (key: DateKey, days: number): DateKey => {
  const datum = fromKey(key);
  datum.setDate(datum.getDate() + days);
  return toKey(datum);
};

/** De maandag van de week waarin deze dag valt. */
export const startOfWeek = (key: DateKey): DateKey => {
  const datum = fromKey(key);
  // getDay() geeft 0 voor zondag; die hoort bij de wéék ervoor.
  const dag = datum.getDay();
  const terug = dag === 0 ? 6 : dag - 1;
  return addDays(key, -terug);
};

export const weekDays = (maandag: DateKey): DateKey[] =>
  Array.from({ length: 7 }, (_, index) => addDays(maandag, index));

/** ISO-weeknummer: de week met de eerste donderdag van het jaar is week 1. */
export const isoWeekNumber = (key: DateKey): number => {
  const datum = fromKey(key);
  const donderdag = new Date(datum);
  donderdag.setDate(datum.getDate() + 3 - ((datum.getDay() + 6) % 7));
  const eersteJanuari = new Date(donderdag.getFullYear(), 0, 1);
  const dagen = Math.round((donderdag.getTime() - eersteJanuari.getTime()) / 86_400_000);
  return Math.floor(dagen / 7) + 1;
};

const DAGNAMEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
const DAGNAMEN_KORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const MAANDEN_KORT = [
  'jan',
  'feb',
  'mrt',
  'apr',
  'mei',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];

/** 0 voor maandag, 6 voor zondag. */
export const weekdayIndex = (key: DateKey): number => (fromKey(key).getDay() + 6) % 7;

export const dayName = (key: DateKey): string => DAGNAMEN[weekdayIndex(key)] ?? '';
export const dayNameShort = (key: DateKey): string => DAGNAMEN_KORT[weekdayIndex(key)] ?? '';

/** "ma 12 mei" */
export const formatDay = (key: DateKey): string => {
  const datum = fromKey(key);
  return `${dayNameShort(key)} ${datum.getDate()} ${MAANDEN_KORT[datum.getMonth()]}`;
};

/** "12 mei" */
export const formatShort = (key: DateKey): string => {
  const datum = fromKey(key);
  return `${datum.getDate()} ${MAANDEN_KORT[datum.getMonth()]}`;
};

export const daysBetween = (van: DateKey, tot: DateKey): number =>
  Math.round((fromKey(tot).getTime() - fromKey(van).getTime()) / 86_400_000);

/** "vandaag", "gisteren", "3 dagen geleden", "vorige week". */
export const relativeDay = (key: DateKey, vandaag: DateKey): string => {
  const verschil = daysBetween(key, vandaag);
  if (verschil === 0) return 'vandaag';
  if (verschil === 1) return 'gisteren';
  if (verschil === -1) return 'morgen';
  if (verschil < 0) return `over ${Math.abs(verschil)} dagen`;
  if (verschil < 7) return `${verschil} dagen geleden`;
  if (verschil < 14) return 'vorige week';
  if (verschil < 60) return `${Math.floor(verschil / 7)} weken geleden`;
  return `${Math.floor(verschil / 30)} maanden geleden`;
};
