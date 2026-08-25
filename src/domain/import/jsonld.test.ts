import { describe, expect, it } from 'vitest';
import { createLibrary } from '../ingredients/library';
import { ingredientSchema, type Ingredient } from '../schema/ingredient';
import {
  decodeEntities,
  extractJsonLd,
  findRecipeNode,
  flattenInstructions,
  importFromHtml,
  isoDurationToMinutes,
  parseYield,
  stripHtml,
} from './jsonld';

const ingredient = (deel: Record<string, unknown> & { id: string; name: string }): Ingredient =>
  ingredientSchema.parse({
    synonyms: [],
    category: 'houdbaar',
    defaultUnit: 'g',
    allergens: [],
    ...deel,
  });

const library = createLibrary([
  ingredient({ id: 'bloem', name: 'bloem', nameEn: 'flour' }),
  ingredient({ id: 'ui', name: 'ui', plural: 'uien', nameEn: 'onion', defaultUnit: 'stuks' }),
  ingredient({ id: 'boter', name: 'boter', nameEn: 'butter' }),
  ingredient({ id: 'suiker', name: 'suiker', nameEn: 'sugar' }),
  ingredient({ id: 'ei', name: 'ei', plural: 'eieren', nameEn: 'egg', defaultUnit: 'stuks' }),
  ingredient({ id: 'zout', name: 'zout', nameEn: 'salt' }),
]);

/** Zoals een Amerikaanse receptensite het in de paginabron zet. */
const pagina = (recept: unknown, extra = ''): string => `<!doctype html>
<html><head>
<title>Iets</title>
${extra}
<script type="application/ld+json">${JSON.stringify(recept)}</script>
</head><body><h1>Iets</h1></body></html>`;

describe('extractJsonLd', () => {
  it('haalt elk blok uit de pagina', () => {
    const html = pagina(
      { '@type': 'Recipe', name: 'A' },
      '<script type="application/ld+json">{"@type":"Organization"}</script>',
    );
    expect(extractJsonLd(html)).toHaveLength(2);
  });

  it('slaat een blok over dat geen geldige JSON is', () => {
    const html = `<script type="application/ld+json">{kapot</script>
<script type="application/ld+json">{"@type":"Recipe"}</script>`;
    expect(extractJsonLd(html)).toHaveLength(1);
  });

  it('geeft een lege lijst bij een pagina zonder JSON-LD', () => {
    expect(extractJsonLd('<html><body>niets</body></html>')).toEqual([]);
  });
});

describe('findRecipeNode', () => {
  it('vindt het recept in een @graph', () => {
    const blok = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Site' },
        { '@type': ['Recipe', 'NewsArticle'], name: 'Appeltaart' },
      ],
    };
    expect(findRecipeNode([blok])?.['name']).toBe('Appeltaart');
  });

  it('vindt het recept in een lijst op het hoogste niveau', () => {
    expect(findRecipeNode([[{ '@type': 'Recipe', name: 'Soep' }]])?.['name']).toBe('Soep');
  });

  it('geeft niets terug als er geen recept in staat', () => {
    expect(findRecipeNode([{ '@type': 'Article', name: 'Iets' }])).toBeNull();
  });
});

describe('isoDurationToMinutes', () => {
  it('leest uren en minuten', () => {
    expect(isoDurationToMinutes('PT1H30M')).toBe(90);
    expect(isoDurationToMinutes('PT45M')).toBe(45);
    expect(isoDurationToMinutes('P0DT2H0M')).toBe(120);
  });

  it('geeft niets terug bij nul of bij onzin', () => {
    expect(isoDurationToMinutes('PT0M')).toBeUndefined();
    expect(isoDurationToMinutes('een half uur')).toBeUndefined();
    expect(isoDurationToMinutes(undefined)).toBeUndefined();
  });
});

describe('parseYield', () => {
  it('haalt het aantal uit alle gebruikelijke vormen', () => {
    expect(parseYield('4 servings')).toEqual({ servings: 4, zeker: true });
    expect(parseYield(['6', '6 servings'])).toEqual({ servings: 6, zeker: true });
    expect(parseYield('Serves 4-6')).toEqual({ servings: 4, zeker: true });
    expect(parseYield('4 personen')).toEqual({ servings: 4, zeker: true });
    expect(parseYield(8)).toEqual({ servings: 8, zeker: true });
  });

  it('twijfelt bij een opbrengst die geen porties telt', () => {
    // "24 cookies" zijn 24 koekjes, geen 24 personen. Het getal is nog steeds
    // het beste dat er is, maar de app hoort het niet als zekerheid te brengen.
    expect(parseYield('24 cookies')).toEqual({ servings: 24, zeker: false });
    expect(parseYield('1 taart van 24 cm')).toEqual({ servings: 1, zeker: false });
  });

  it('negeert een onmogelijk aantal', () => {
    expect(parseYield('1200 koekjes')).toBeUndefined();
    expect(parseYield('naar smaak')).toBeUndefined();
  });
});

describe('stripHtml en decodeEntities', () => {
  it('maakt van lijstopmaak losse regels', () => {
    expect(stripHtml('<ol><li>Snijd de ui.</li><li>Bak hem.</li></ol>')).toBe(
      'Snijd de ui.\nBak hem.',
    );
  });

  it('leest entiteiten terug', () => {
    expect(decodeEntities('cr&egrave;me fra&icirc;che &amp; ei')).toBe('crème fra&icirc;che & ei');
    expect(decodeEntities('180&#176;C')).toBe('180°C');
  });
});

describe('flattenInstructions', () => {
  it('leest een lap HTML', () => {
    expect(flattenInstructions('<p>Snijd de ui.</p><p>Bak hem goudbruin.</p>')).toEqual([
      'Snijd de ui.',
      'Bak hem goudbruin.',
    ]);
  });

  it('leest HowToStep-objecten', () => {
    expect(
      flattenInstructions([
        { '@type': 'HowToStep', text: 'Verwarm de oven voor.' },
        { '@type': 'HowToStep', text: 'Meng alles.' },
      ]),
    ).toEqual(['Verwarm de oven voor.', 'Meng alles.']);
  });

  it('loopt door een HowToSection heen', () => {
    expect(
      flattenInstructions([
        {
          '@type': 'HowToSection',
          name: 'Het deeg',
          itemListElement: [{ '@type': 'HowToStep', text: 'Kneed het deeg.' }],
        },
      ]),
    ).toEqual(['Kneed het deeg.']);
  });

  it('haalt de nummering voor de stap weg', () => {
    expect(flattenInstructions('1. Snijd de ui.\n2. Bak hem.')).toEqual([
      'Snijd de ui.',
      'Bak hem.',
    ]);
  });
});

describe('importFromHtml', () => {
  const amerikaans = pagina({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Butter Cookies',
    description: 'Simple &amp; buttery.',
    author: { '@type': 'Person', name: 'Jane Doe' },
    image: ['https://example.com/koek.jpg'],
    recipeYield: '24 cookies',
    prepTime: 'PT20M',
    cookTime: 'PT12M',
    totalTime: 'PT1H32M',
    recipeIngredient: [
      '2 cups all-purpose flour',
      '1 stick butter, softened',
      '3/4 cup sugar',
      '1 large egg',
      'Salt to taste',
    ],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Preheat the oven to 350°F (175°C).' },
      { '@type': 'HowToStep', text: 'Cream the butter and sugar.' },
    ],
    keywords: 'cookies, baking, dessert',
    suitableForDiet: 'https://schema.org/VegetarianDiet',
  });

  it('leest een Amerikaanse pagina helemaal uit', () => {
    const uit = importFromHtml(amerikaans, { url: 'https://example.com/koek', library });
    expect(uit).not.toBeNull();
    expect(uit?.title).toBe('Butter Cookies');
    expect(uit?.description).toBe('Simple & buttery.');
    expect(uit?.servings).toBe(24);
    expect(uit?.warnings).toContain(
      'Op de pagina staat "24 cookies". Dat is als 24 personen overgenomen; kijk even of dat klopt.',
    );
    expect(uit?.image).toBe('https://example.com/koek.jpg');
    expect(uit?.source).toEqual({
      type: 'url',
      url: 'https://example.com/koek',
      title: 'Jane Doe',
    });
  });

  it('rekent de maten om naar metrisch', () => {
    const uit = importFromHtml(amerikaans, { url: 'https://example.com/koek', library });
    expect(uit?.ingredients[0]).toEqual({
      amount: 480,
      unit: 'ml',
      ingredientId: 'bloem',
      name: 'bloem',
    });
    expect(uit?.ingredients[1]).toMatchObject({ amount: 113, unit: 'g', ingredientId: 'boter' });
    expect(uit?.ingredients[4]).toEqual({ ingredientId: 'zout', name: 'zout', scales: 'taste' });
  });

  it('zet de oven in graden Celsius', () => {
    const uit = importFromHtml(amerikaans, { url: 'https://example.com/koek', library });
    expect(uit?.steps[0]).toBe('Preheat the oven to 175 °C.');
    expect(uit?.ovenTemps?.[0]).toBe(175);
    expect(uit?.ovenTemps?.[1]).toBeUndefined();
  });

  it('haalt de wachttijd uit het verschil met de totale tijd', () => {
    // 92 minuten totaal, 20 voorbereiden en 12 bakken: dan staat het deeg
    // een uur koud te worden, en dat is passieve tijd.
    const uit = importFromHtml(amerikaans, { url: 'https://example.com/koek', library });
    expect(uit?.times).toEqual({ prep: 20, active: 12, passive: 60 });
  });

  it('neemt de tags over en vertaalt het dieet', () => {
    const uit = importFromHtml(amerikaans, { url: 'https://example.com/koek', library });
    expect(uit?.tags).toContain('vegetarisch');
    expect(uit?.tags).toContain('cookies');
  });

  it('meldt hoeveel ingrediënten nog niet gekoppeld zijn', () => {
    const html = pagina({
      '@type': 'Recipe',
      name: 'Test',
      recipeIngredient: ['1 tbsp gochujang', '2 onions'],
      recipeInstructions: 'Meng alles.',
    });
    const uit = importFromHtml(html, { url: 'https://example.com', library });
    expect(uit?.warnings).toContain('1 ingrediënt staat nog niet in de bibliotheek.');
  });

  it('waarschuwt als er geen ingrediënten of stappen in staan', () => {
    const html = pagina({ '@type': 'Recipe', name: 'Leeg' });
    const uit = importFromHtml(html, { url: 'https://example.com', library });
    expect(uit?.warnings).toEqual([
      'Er zijn geen ingrediënten gevonden op deze pagina.',
      'Er zijn geen stappen gevonden op deze pagina.',
    ]);
  });

  it('geeft null terug bij een pagina zonder receptgegevens', () => {
    expect(importFromHtml('<html><body>blog</body></html>', { url: 'x', library })).toBeNull();
  });

  it('laat een Nederlandse pagina met rust waar niets om te rekenen valt', () => {
    const html = pagina({
      '@type': 'Recipe',
      name: 'Uiensoep',
      recipeYield: '4 personen',
      totalTime: 'PT45M',
      recipeIngredient: ['3 uien, in ringen', '200 g bloem'],
      recipeInstructions: '<ol><li>Snipper de uien.</li><li>Bak ze 20 minuten.</li></ol>',
    });
    const uit = importFromHtml(html, { url: 'https://nl.example/soep', library });
    expect(uit?.servings).toBe(4);
    expect(uit?.times).toEqual({ prep: 0, active: 45, passive: 0 });
    expect(uit?.ingredients).toEqual([
      { amount: 3, unit: 'stuks', ingredientId: 'ui', name: 'ui', note: 'in ringen' },
      { amount: 200, unit: 'g', ingredientId: 'bloem', name: 'bloem' },
    ]);
    expect(uit?.steps).toEqual(['Snipper de uien.', 'Bak ze 20 minuten.']);
  });
});
