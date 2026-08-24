import { parse, stringify } from 'yaml';

/**
 * De databestanden zijn YAML omdat je ze op github.com met de hand moet kunnen
 * aanpassen, ook vanaf een telefoon: geen aanhalingstekens, geen komma's.
 */
export const parseYaml = (text: string): unknown => parse(text);

/** Vaste veldvolgorde, zodat een wijziging een kleine diff geeft. */
export const orderKeys = <T extends Record<string, unknown>>(
  value: T,
  order: readonly string[],
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const key of order) {
    if (value[key] !== undefined) result[key] = value[key];
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!(key in result) && entry !== undefined) result[key] = entry;
  }
  return result;
};

export const toYaml = (value: unknown): string =>
  stringify(value, {
    // Geen automatische regelafbreking: dat maakt diffs onleesbaar.
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
    nullStr: '',
  });
