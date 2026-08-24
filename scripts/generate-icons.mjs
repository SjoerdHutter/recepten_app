/**
 * Genereert de PWA-iconen zonder externe afhankelijkheden: het tekenwerk
 * gebeurt met de hand in een RGBA-buffer, die daarna als PNG wordt weggeschreven.
 * De uitkomst staat in de repo, dus dit script hoeft alleen te draaien als het
 * icoon verandert:  node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BLAUW = [0x1f, 0x4e, 0x9c];
const WIT = [0xff, 0xff, 0xff];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const head = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head, data])), 0);
  return Buffer.concat([len, head, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bitdiepte
  ihdr[9] = 6; // kleurtype RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filtertype "none"
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Alles hieronder rekent in het 64x64-raster van favicon.svg. */
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

const inPan = (x, y) => {
  if (inRoundRect(x, y, 10, 22, 54, 27, 2.5)) return true; // rand
  if (inRoundRect(x, y, 6, 30, 13, 35, 2.5)) return true; // handvat links
  if (inRoundRect(x, y, 51, 30, 58, 35, 2.5)) return true; // handvat rechts
  if (x >= 14 && x <= 50 && y >= 27 && y <= 31) return true; // schouder
  return y > 31 && (x - 32) ** 2 + (y - 31) ** 2 <= 18 * 18; // bolle bodem
};

function render(size, { rond, glyphSchaal }) {
  const SS = 4; // supersampling, anders zijn de randen kartelig
  const buf = Buffer.alloc(size * size * 4);
  const radius = rond ? 14 : 0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let dekking = 0;
      let glyph = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * 64;
          const y = ((py + (sy + 0.5) / SS) / size) * 64;
          if (inRoundRect(x, y, 0, 0, 64, 64, radius)) dekking++;
          const gx = (x - 32) / glyphSchaal + 32;
          const gy = (y - 32) / glyphSchaal + 32;
          if (inPan(gx, gy)) glyph++;
        }
      }
      const totaal = SS * SS;
      const a = dekking / totaal;
      const g = Math.min(glyph / totaal, a);
      const i = (py * size + px) * 4;
      for (let k = 0; k < 3; k++) {
        buf[i + k] = Math.round(BLAUW[k] * (1 - g / (a || 1)) + WIT[k] * (g / (a || 1)));
      }
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return buf;
}

mkdirSync('public/icons', { recursive: true });
const bestanden = [
  ['public/icons/icon-192.png', 192, { rond: true, glyphSchaal: 1 }],
  ['public/icons/icon-512.png', 512, { rond: true, glyphSchaal: 1 }],
  ['public/icons/icon-maskable-512.png', 512, { rond: false, glyphSchaal: 0.72 }],
  ['public/icons/apple-touch-icon.png', 180, { rond: false, glyphSchaal: 0.86 }],
];
for (const [pad, size, opties] of bestanden) {
  writeFileSync(pad, encodePng(size, render(size, opties)));
  console.log(`geschreven: ${pad} (${size}px)`);
}
