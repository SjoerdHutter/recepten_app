import type { Ingredient } from '../schema/ingredient';

/**
 * Namen worden vergeleken zonder hoofdletters, accenten en dubbele spaties.
 * "Ui", "ui" en "ÙI" zijn hetzelfde ingrediënt.
 */
export const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Meervoudsvormen die niet in de synoniemen staan. Onregelmatige gevallen
 * ("tomaat" / "tomaten") horen in het synoniemenveld van de bibliotheek; dit
 * vangt alleen de voor de hand liggende vormen af.
 */
export const nameVariants = (name: string): string[] => {
  const base = normalizeName(name);
  const variants = new Set<string>([base]);
  if (base.endsWith('en')) variants.add(base.slice(0, -2));
  if (base.endsWith('s')) variants.add(base.slice(0, -1));
  if (base.endsWith("'s")) variants.add(base.slice(0, -2));
  variants.add(`${base}en`);
  variants.add(`${base}s`);
  return [...variants].filter(Boolean);
};

export interface IngredientLibrary {
  all: Ingredient[];
  get(id: string | undefined): Ingredient | undefined;
  /** Zoekt een ingrediënt bij een vrij ingetypte naam. */
  match(name: string): Ingredient | undefined;
  /** Suggesties voor de autocomplete, beste match eerst. */
  search(query: string, limit?: number): Ingredient[];
  /** Naam zoals die in de app getoond wordt, eventueel in het meervoud. */
  label(id: string | undefined, fallback?: string, plural?: boolean): string;
}

export const createLibrary = (ingredients: Ingredient[]): IngredientLibrary => {
  const byId = new Map<string, Ingredient>();
  const byName = new Map<string, Ingredient>();

  for (const ingredient of ingredients) {
    byId.set(ingredient.id, ingredient);
    const namen = [
      ingredient.name,
      ingredient.plural,
      ingredient.nameEn,
      ingredient.id.replace(/-/g, ' '),
      ...ingredient.synonyms,
    ].filter((n): n is string => Boolean(n));

    for (const naam of namen) {
      for (const variant of nameVariants(naam)) {
        // De eerste die een variant claimt wint, zodat een canonieke naam niet
        // door het meervoud van een ander ingrediënt overschreven wordt.
        if (!byName.has(variant)) byName.set(variant, ingredient);
      }
      byName.set(normalizeName(naam), ingredient);
    }
  }

  const sorted = [...ingredients].sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  return {
    all: sorted,
    get: (id) => (id ? byId.get(id) : undefined),
    match(name) {
      const genormaliseerd = normalizeName(name);
      const direct = byId.get(genormaliseerd) ?? byName.get(genormaliseerd);
      if (direct) return direct;
      for (const variant of nameVariants(name)) {
        const treffer = byName.get(variant);
        if (treffer) return treffer;
      }
      return undefined;
    },
    search(query, limit = 8) {
      const q = normalizeName(query);
      if (!q) return sorted.slice(0, limit);
      const scored: Array<{ ingredient: Ingredient; score: number }> = [];
      for (const ingredient of sorted) {
        const namen = [ingredient.name, ingredient.plural ?? '', ...ingredient.synonyms].map(
          normalizeName,
        );
        let score = Infinity;
        for (const naam of namen) {
          if (!naam) continue;
          if (naam === q) score = Math.min(score, 0);
          else if (naam.split(' ').some((woord) => woord.startsWith(q))) score = Math.min(score, 1);
          // Middenin een woord matchen is nuttig bij samenstellingen ("olie"
          // vindt olijfolie), maar bij twee letters levert het vooral onzin op:
          // "ui" zit ook in kruimige, bouillon en bruine.
          else if (q.length >= 3 && naam.includes(q)) score = Math.min(score, 2);
        }
        if (score < Infinity) scored.push({ ingredient, score });
      }
      return scored
        .sort(
          (a, b) => a.score - b.score || a.ingredient.name.localeCompare(b.ingredient.name, 'nl'),
        )
        .slice(0, limit)
        .map((s) => s.ingredient);
    },
    label(id, fallback, plural = false) {
      const ingredient = id ? byId.get(id) : undefined;
      if (!ingredient) return fallback ?? id ?? '';
      return plural ? (ingredient.plural ?? ingredient.name) : ingredient.name;
    },
  };
};

export const emptyLibrary = (): IngredientLibrary => createLibrary([]);
