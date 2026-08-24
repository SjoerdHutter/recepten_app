import { describe, expect, it } from 'vitest';
import {
  entriesForDay,
  isLeftoverDay,
  mealDays,
  moveEntry,
  planToSelections,
  planToText,
  totalServings,
  type Plan,
} from './plan';
import {
  addDays,
  daysBetween,
  formatDay,
  isoWeekNumber,
  relativeDay,
  startOfWeek,
  weekDays,
  weekdayIndex,
} from './week';
import { makeRecipe } from '../testing/fixtures';

const stoof = makeRecipe({ id: 'stoof', title: 'Stoofpot', servings: 4 });
const soep = makeRecipe({ id: 'soep', title: 'Soep', servings: 2 });
const recepten = [stoof, soep];

// Woensdag 13 mei 2026.
const WOENSDAG = '2026-05-13';

const plan: Plan = [
  {
    id: 'a',
    recipeId: 'stoof',
    date: '2026-05-12',
    servings: 2,
    // Kook 2x: eet dinsdag en donderdag.
    alsoEatenOn: ['2026-05-14'],
  },
  { id: 'b', recipeId: 'soep', date: '2026-05-13', servings: 3, alsoEatenOn: [] },
];

describe('weekhulpjes', () => {
  it('begint de week op maandag', () => {
    expect(startOfWeek(WOENSDAG)).toBe('2026-05-11');
    // Zondag hoort bij de week ervoor, niet bij de volgende.
    expect(startOfWeek('2026-05-17')).toBe('2026-05-11');
    expect(startOfWeek('2026-05-18')).toBe('2026-05-18');
  });

  it('geeft zeven dagen vanaf maandag', () => {
    const dagen = weekDays('2026-05-11');
    expect(dagen).toHaveLength(7);
    expect(dagen[0]).toBe('2026-05-11');
    expect(dagen[6]).toBe('2026-05-17');
  });

  it('nummert dagen vanaf maandag', () => {
    expect(weekdayIndex('2026-05-11')).toBe(0);
    expect(weekdayIndex('2026-05-17')).toBe(6);
  });

  it('rekent met dagen', () => {
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-05-11', '2026-05-13')).toBe(2);
  });

  it('kent het ISO-weeknummer', () => {
    expect(isoWeekNumber('2026-01-01')).toBe(1);
    expect(isoWeekNumber(WOENSDAG)).toBe(20);
  });

  it('schrijft een dag leesbaar op', () => {
    expect(formatDay('2026-05-13')).toBe('wo 13 mei');
  });

  it('zegt hoe lang geleden iets was', () => {
    expect(relativeDay('2026-05-13', '2026-05-13')).toBe('vandaag');
    expect(relativeDay('2026-05-12', '2026-05-13')).toBe('gisteren');
    expect(relativeDay('2026-05-14', '2026-05-13')).toBe('morgen');
    expect(relativeDay('2026-05-10', '2026-05-13')).toBe('3 dagen geleden');
    expect(relativeDay('2026-05-05', '2026-05-13')).toBe('vorige week');
  });
});

describe('dubbele porties', () => {
  it('telt de porties op over alle dagen dat je ervan eet', () => {
    // 2 personen op twee dagen betekent koken voor 4.
    expect(totalServings(plan[0]!)).toBe(4);
    expect(totalServings(plan[1]!)).toBe(3);
  });

  it('zet het gerecht op elke dag dat het op tafel komt', () => {
    expect(mealDays(plan[0]!)).toEqual(['2026-05-12', '2026-05-14']);
    expect(entriesForDay(plan, '2026-05-14').map((e) => e.id)).toEqual(['a']);
    expect(entriesForDay(plan, '2026-05-13').map((e) => e.id)).toEqual(['b']);
  });

  it('weet op welke dag je kookt en op welke je restjes eet', () => {
    expect(isLeftoverDay(plan[0]!, '2026-05-12')).toBe(false);
    expect(isLeftoverDay(plan[0]!, '2026-05-14')).toBe(true);
  });

  it('zet het gerecht één keer op de boodschappenlijst, met alle porties', () => {
    const selecties = planToSelections(plan, recepten, weekDays('2026-05-11'));
    expect(selecties).toHaveLength(2);
    const stoofSelectie = selecties.find((s) => s.recipe.id === 'stoof');
    expect(stoofSelectie?.servings).toBe(4);
  });

  it('telt hetzelfde gerecht op als het twee keer los ingepland staat', () => {
    const tweemaal: Plan = [
      { id: 'a', recipeId: 'soep', date: '2026-05-12', servings: 2, alsoEatenOn: [] },
      { id: 'b', recipeId: 'soep', date: '2026-05-15', servings: 3, alsoEatenOn: [] },
    ];
    const selecties = planToSelections(tweemaal, recepten, weekDays('2026-05-11'));
    expect(selecties).toHaveLength(1);
    expect(selecties[0]?.servings).toBe(5);
  });

  it('laat gerechten buiten de week weg', () => {
    const selecties = planToSelections(plan, recepten, weekDays('2026-05-18'));
    expect(selecties).toEqual([]);
  });
});

describe('verplaatsen', () => {
  it('neemt de eetdagen mee als je de kookdag verschuift', () => {
    const verplaatst = moveEntry(plan, 'a', '2026-05-13');
    const entry = verplaatst.find((e) => e.id === 'a');
    expect(entry?.date).toBe('2026-05-13');
    // Een dag opgeschoven, dus de tweede eetdag schuift mee.
    expect(entry?.alsoEatenOn).toEqual(['2026-05-15']);
  });

  it('laat de rest van het plan met rust', () => {
    const verplaatst = moveEntry(plan, 'a', '2026-05-13');
    expect(verplaatst.find((e) => e.id === 'b')?.date).toBe('2026-05-13');
  });
});

describe('weekmenu als tekst', () => {
  it('zet per dag wat er op tafel komt', () => {
    const tekst = planToText(plan, recepten, weekDays('2026-05-11'));
    expect(tekst).toContain('di 12 mei: Stoofpot');
    expect(tekst).toContain('wo 13 mei: Soep');
    // De tweede dag vermeldt waar het vandaan komt.
    expect(tekst).toContain('do 14 mei: Stoofpot (van di)');
  });

  it('slaat lege dagen over', () => {
    const tekst = planToText(plan, recepten, weekDays('2026-05-11'));
    expect(tekst).not.toContain('ma 11 mei');
  });

  it('zegt het netjes als er niets staat', () => {
    expect(planToText([], recepten, weekDays('2026-05-11'))).toContain('Nog niets ingepland');
  });
});
