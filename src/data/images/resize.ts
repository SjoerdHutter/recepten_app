/**
 * Een foto van een telefoon is al gauw vier megabyte. Die gaat niet ongewijzigd
 * de repo in: verkleinen naar maximaal 1200 pixels aan de lange zijde en
 * comprimeren naar webp scheelt een factor twintig, en op een receptkaart zie je
 * het verschil niet.
 */

export interface ResizedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  /** Om de foto te tonen voordat hij gecommit is. */
  previewUrl: string;
}

const MAX_ZIJDE = 1200;
const KWALITEIT = 0.82;

const laadBitmap = async (file: File): Promise<ImageBitmap> => {
  try {
    // Zo komt de foto rechtop te staan, ook als de telefoon gedraaid was.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(file);
  }
};

const naarBlob = (canvas: HTMLCanvasElement, type: string, kwaliteit: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('De foto kon niet omgezet worden.'))),
      type,
      kwaliteit,
    );
  });

export const resizeToWebp = async (file: File): Promise<ResizedImage> => {
  const bitmap = await laadBitmap(file);
  const schaal = Math.min(1, MAX_ZIJDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * schaal);
  const height = Math.round(bitmap.height * schaal);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Deze browser kan geen afbeeldingen bewerken.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await naarBlob(canvas, 'image/webp', KWALITEIT);
  // Oudere browsers negeren het type en leveren een PNG; dan maar jpeg.
  if (!blob.type.includes('webp')) blob = await naarBlob(canvas, 'image/jpeg', KWALITEIT);

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width,
    height,
    previewUrl: URL.createObjectURL(blob),
  };
};

export const formatBytes = (aantal: number): string =>
  aantal >= 1024 * 1024
    ? `${(aantal / (1024 * 1024)).toFixed(1)} MB`.replace('.', ',')
    : `${Math.round(aantal / 1024)} kB`;
