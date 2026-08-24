import type { Plan } from '../../domain/planner/plan';
import { entriesForDay, isLeftoverDay } from '../../domain/planner/plan';
import { dayName, dayNameShort, formatShort, type DateKey } from '../../domain/planner/week';
import type { Recipe } from '../../domain/schema/recipe';

/**
 * Het weekmenu als plaatje, om in een gesprek te plakken. Getekend op een
 * canvas in plaats van met een bibliotheek die HTML omzet: het is een lijstje
 * met zeven regels, daar hoeft geen 200 kB aan afhankelijkheid voor mee.
 */

const BREEDTE = 1080;
const MARGE = 72;

export const renderWeekImage = (
  plan: Plan,
  recipes: Recipe[],
  dagen: DateKey[],
  titel: string,
  donker: boolean,
): HTMLCanvasElement => {
  const regels = dagen.map((dag) => {
    const vandaag = entriesForDay(plan, dag);
    return {
      dag,
      gerechten: vandaag.map((entry) => {
        const naam = recipes.find((item) => item.id === entry.recipeId)?.title ?? entry.recipeId;
        return isLeftoverDay(entry, dag) ? `${naam} (van ${dayNameShort(entry.date)})` : naam;
      }),
    };
  });

  const regelHoogte = 96;
  const hoogte = MARGE * 2 + 140 + regels.length * regelHoogte;

  const canvas = document.createElement('canvas');
  canvas.width = BREEDTE;
  canvas.height = hoogte;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const achtergrond = donker ? '#0c1420' : '#f2f4f8';
  const kaart = donker ? '#121c2b' : '#ffffff';
  const inkt = donker ? '#e6edf6' : '#10192a';
  const inktZacht = donker ? '#7b8ca6' : '#6e7e98';
  const accent = donker ? '#86acea' : '#1f4e9c';

  ctx.fillStyle = achtergrond;
  ctx.fillRect(0, 0, BREEDTE, hoogte);

  ctx.fillStyle = accent;
  ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
  ctx.fillText(titel, MARGE, MARGE + 56);

  ctx.fillStyle = inktZacht;
  ctx.font = '30px system-ui, -apple-system, sans-serif';
  const eerste = dagen[0];
  const laatste = dagen[dagen.length - 1];
  if (eerste && laatste) {
    ctx.fillText(`${formatShort(eerste)} tot ${formatShort(laatste)}`, MARGE, MARGE + 104);
  }

  let y = MARGE + 150;
  for (const regel of regels) {
    ctx.fillStyle = kaart;
    // Afgeronde kaart per dag.
    const hoek = 20;
    const x = MARGE;
    const w = BREEDTE - MARGE * 2;
    const h = regelHoogte - 16;
    ctx.beginPath();
    ctx.moveTo(x + hoek, y);
    ctx.arcTo(x + w, y, x + w, y + h, hoek);
    ctx.arcTo(x + w, y + h, x, y + h, hoek);
    ctx.arcTo(x, y + h, x, y, hoek);
    ctx.arcTo(x, y, x + w, y, hoek);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = inktZacht;
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(dayName(regel.dag), x + 32, y + 36);

    ctx.fillStyle = regel.gerechten.length > 0 ? inkt : inktZacht;
    ctx.font =
      regel.gerechten.length > 0
        ? '34px system-ui, -apple-system, sans-serif'
        : 'italic 30px system-ui, -apple-system, sans-serif';
    const tekst = regel.gerechten.length > 0 ? regel.gerechten.join(' · ') : 'nog niets';
    // Afkappen wat niet past, zodat er niets buiten de kaart valt.
    let weergave = tekst;
    while (ctx.measureText(weergave).width > w - 64 && weergave.length > 4) {
      weergave = `${weergave.slice(0, -5)}…`;
    }
    ctx.fillText(weergave, x + 32, y + 72);

    y += regelHoogte;
  }

  return canvas;
};

export const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
