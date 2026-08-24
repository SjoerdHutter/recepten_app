import { CATEGORIES, type Category } from '../schema/enums';
import type { ShoppingGroup } from '../shopping/aggregate';

/**
 * Winkelprofielen: jouw looproute door een supermarkt.
 *
 * De standaardvolgorde van de categorieën is een redelijke gok, maar elke winkel
 * is anders ingedeeld en je loopt er altijd hetzelfde rondje. Door de volgorde
 * eenmalig goed te zetten, staat de lijst voortaan in de volgorde waarin je
 * langs de schappen komt, en hoef je niet terug te lopen voor de melk.
 */

export interface StoreProfile {
  id: string;
  name: string;
  /** De categorieën in looprichting. */
  order: Category[];
}

export const DEFAULT_PROFILE_ID = 'standaard';

export const defaultProfile = (): StoreProfile => ({
  id: DEFAULT_PROFILE_ID,
  name: 'Standaard',
  order: [...CATEGORIES],
});

/**
 * Vult ontbrekende categorieën aan en gooit onbekende weg, zodat een profiel dat
 * ooit is opgeslagen blijft werken als er later een categorie bijkomt.
 */
export const normalizeOrder = (order: Category[]): Category[] => {
  const bekend = order.filter((categorie) => CATEGORIES.includes(categorie));
  const ontbreekt = CATEGORIES.filter((categorie) => !bekend.includes(categorie));
  return [...bekend, ...ontbreekt];
};

export const moveInOrder = (order: Category[], from: number, to: number): Category[] => {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order;
  const kopie = [...order];
  const [verplaatst] = kopie.splice(from, 1);
  if (verplaatst) kopie.splice(to, 0, verplaatst);
  return kopie;
};

/** Zet de groepen in de volgorde van dit winkelprofiel. */
export const sortGroupsByStore = (
  groups: ShoppingGroup[],
  profile: StoreProfile | undefined,
): ShoppingGroup[] => {
  if (!profile) return groups;
  const volgorde = normalizeOrder(profile.order);
  const positie = new Map(volgorde.map((categorie, index) => [categorie, index]));
  return [...groups].sort(
    (a, b) => (positie.get(a.category) ?? 99) - (positie.get(b.category) ?? 99),
  );
};

export const nextProfileId = (): string =>
  `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
