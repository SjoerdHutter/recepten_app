import { formatQuantity } from '../units/format';
import type { ShoppingGroup, ShoppingLine } from './aggregate';

export const lineToText = (line: ShoppingLine): string => {
  const hoeveelheid = line.quantity ? `${formatQuantity(line.quantity)} ` : '';
  const optioneel = line.optional ? ' (optioneel)' : '';
  return `${hoeveelheid}${line.label}${optioneel}`.trim();
};

/** Platte tekst om te kopiëren of via het deelvenster te versturen. */
export const shoppingListToText = (
  groups: ShoppingGroup[],
  options: { withSources?: boolean } = {},
): string => {
  const regels: string[] = ['Boodschappen', ''];
  for (const group of groups) {
    regels.push(group.label.toUpperCase());
    for (const line of group.lines) {
      const herkomst =
        options.withSources && line.sources.length > 0
          ? `  [${[...new Set(line.sources.map((s) => s.title))].join(', ')}]`
          : '';
      regels.push(`- ${lineToText(line)}${herkomst}`);
    }
    regels.push('');
  }
  return regels.join('\n').trim();
};
