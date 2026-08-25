import { describe, expect, it } from 'vitest';
// @ts-expect-error — de proxy is losse JavaScript zonder types; hij draait op de
// rand van Cloudflare of Netlify en heeft daarom geen build en geen tsconfig.
import { ProxyError, checkTarget, corsHeaders } from '../../../proxy/shared.js';
import { normalizeRecipeUrl, ImportError } from './fetchPage';

/**
 * De proxy is het enige stukje van dit project dat op een server draait, en
 * daarmee het enige stukje dat door iemand anders misbruikt kan worden. Een
 * proxy die adressen in een privénetwerk ophaalt is een gat (SSRF), en dat gat
 * zat er ook echt in: één regex met `^…$` eromheen liet `192.168.1.1` gewoon
 * door, want `192\.168\.` matcht die string niet in zijn geheel.
 */

describe('checkTarget', () => {
  it('laat een gewoon adres door', () => {
    expect(checkTarget('https://www.allrecipes.com/recipe/123').hostname).toBe(
      'www.allrecipes.com',
    );
  });

  it('weigert een adres in een privénetwerk', () => {
    for (const adres of [
      'http://192.168.1.1/',
      'http://10.0.0.5/admin',
      'http://172.16.0.1/',
      'http://127.0.0.1:8080/',
      'http://169.254.169.254/latest/meta-data/',
      'http://100.64.0.1/',
      'http://localhost:3000/',
      'http://iets.internal/',
      'http://printer.local/',
      'http://[::1]/',
    ]) {
      expect(() => checkTarget(adres), adres).toThrow(ProxyError);
    }
  });

  it('weigert een ander protocol', () => {
    expect(() => checkTarget('ftp://example.com/')).toThrow(ProxyError);
    expect(() => checkTarget('file:///etc/passwd')).toThrow(ProxyError);
    expect(() => checkTarget('javascript:alert(1)')).toThrow(ProxyError);
  });

  it('weigert een leeg of onleesbaar adres', () => {
    expect(() => checkTarget('')).toThrow(ProxyError);
    expect(() => checkTarget(null)).toThrow(ProxyError);
    expect(() => checkTarget('zomaar wat')).toThrow(ProxyError);
  });

  it('laat een publiek adres door dat toevallig met een cijfer begint', () => {
    // 172.15 valt buiten het privébereik 172.16 tot en met 172.31, en
    // 1.1.1.1 is de resolver van Cloudflare.
    expect(() => checkTarget('http://172.15.0.1/')).not.toThrow();
    expect(() => checkTarget('https://1.1.1.1/')).not.toThrow();
  });
});

describe('corsHeaders', () => {
  it('zet de opgegeven oorsprong', () => {
    expect(corsHeaders('https://sjoerdhutter.github.io')['Access-Control-Allow-Origin']).toBe(
      'https://sjoerdhutter.github.io',
    );
  });

  it('valt terug op alles als er niets ingesteld is', () => {
    expect(corsHeaders(undefined)['Access-Control-Allow-Origin']).toBe('*');
  });
});

describe('normalizeRecipeUrl', () => {
  it('zet https ervoor als je dat vergeet', () => {
    expect(normalizeRecipeUrl('ah.nl/allerhande/recept/R-123')).toBe(
      'https://ah.nl/allerhande/recept/R-123',
    );
  });

  it('laat een compleet adres staan', () => {
    expect(normalizeRecipeUrl(' https://ah.nl/recept ')).toBe('https://ah.nl/recept');
  });

  it('klaagt over iets wat geen adres is', () => {
    expect(() => normalizeRecipeUrl('')).toThrow(ImportError);
    expect(() => normalizeRecipeUrl('zoek dit eens op')).toThrow(ImportError);
  });
});
