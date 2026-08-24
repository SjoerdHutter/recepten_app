/**
 * De databestanden worden bij het bouwen meegebakken als startpunt, zodat de
 * app bij de allereerste keer openen meteen gevuld is in plaats van tweehonderd
 * losse bestanden te moeten ophalen. Zodra de sync draait wint de repo: alles
 * wat na de laatste deploy is toegevoegd komt daar gewoon bij.
 */
const modules = import.meta.glob('/data/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface BundledFile {
  path: string;
  text: string;
}

export const bundledFiles: BundledFile[] = Object.entries(modules)
  .map(([path, text]) => ({ path: path.replace(/^\//, ''), text }))
  .sort((a, b) => a.path.localeCompare(b.path));
