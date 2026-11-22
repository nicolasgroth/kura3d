/**
 * @file src/engine/text/fontRegistry.ts
 * @description Registro de fuentes tipográficas del texto 3D. Carga diferida (solo al crear el primer
 * texto) de opentype.js y de la fuente embebida, con caché por id. Funciona igual en navegador,
 * Worker del motor y Node: la fuente viaja dentro del paquete como base64, sin `document`, canvas
 * ni red. Punto de extensión: `registerTextFont` agrega fuentes (p. ej. CJK o devanagari) sin tocar
 * el generador de contornos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Font } from 'opentype.js';
import { EngineError } from '../engineErrors';

/** Fuente cargada y lista para maquetar texto. */
export interface TextFontFace {
  id: string;
  font: Font;
  unitsPerEm: number;
  /** Alto de mayúscula en unidades de fuente (OS/2 `sCapHeight`, o el alto de la "H"). */
  capHeight: number;
  /** Distancia entre líneas base en unidades de fuente (ascendente − descendente + interlineado). */
  lineHeight: number;
}

/** Devuelve los bytes de una fuente TrueType/OpenType/WOFF. */
export type TextFontLoader = () => Promise<ArrayBuffer>;

/** Fuente por defecto: Roboto Bold (subconjunto Latin, SIL OFL 1.1). */
export const DEFAULT_TEXT_FONT_ID = 'roboto-bold';

/** Decodifica base64 a `ArrayBuffer` (`atob` existe en navegador, Worker y Node ≥ 16). */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

const loaders = new Map<string, TextFontLoader>([
  [
    DEFAULT_TEXT_FONT_ID,
    async () => base64ToArrayBuffer((await import('./fonts/robotoBoldLatin')).ROBOTO_BOLD_LATIN_WOFF_BASE64),
  ],
]);
const cache = new Map<string, Promise<TextFontFace>>();

/**
 * Registra (o reemplaza) una fuente. Las fuentes extra quedan disponibles para `loadTextFont(id)`;
 * la carga real ocurre la primera vez que se piden.
 */
export function registerTextFont(id: string, loader: TextFontLoader): void {
  loaders.set(id, loader);
  cache.delete(id);
}

/** Ids de las fuentes registradas. */
export function registeredTextFonts(): string[] {
  return [...loaders.keys()];
}

type OpentypeModule = { parse: (buffer: ArrayBuffer) => Font };

/** opentype.js es UMD: en Node llega como `default`, con bundler como exportaciones con nombre. */
async function importOpentype(): Promise<OpentypeModule> {
  const mod = (await import('opentype.js')) as unknown as Partial<OpentypeModule> & { default?: OpentypeModule };
  return typeof mod.parse === 'function' ? (mod as OpentypeModule) : (mod.default as OpentypeModule);
}

async function buildFace(id: string, loader: TextFontLoader): Promise<TextFontFace> {
  const [opentype, bytes] = await Promise.all([importOpentype(), loader()]);
  const font = opentype.parse(bytes);
  const os2 = font.tables.os2 as { sCapHeight?: number } | undefined;
  const hhea = font.tables.hhea as { lineGap?: number } | undefined;
  let capHeight = os2?.sCapHeight ?? 0;
  if (!(capHeight > 0)) {
    const box = font.charToGlyph('H').getBoundingBox();
    capHeight = box.y2 - box.y1;
  }
  if (!(capHeight > 0)) capHeight = font.unitsPerEm * 0.7;
  const lineHeight = Math.max(font.unitsPerEm, font.ascender - font.descender + (hhea?.lineGap ?? 0));
  return { id, font, unitsPerEm: font.unitsPerEm, capHeight, lineHeight };
}

/** Carga (una sola vez) y devuelve la fuente `id`. */
export function loadTextFont(id: string = DEFAULT_TEXT_FONT_ID): Promise<TextFontFace> {
  const cached = cache.get(id);
  if (cached) return cached;
  const loader = loaders.get(id);
  if (!loader) return Promise.reject(new EngineError('INVALID_PARAMETER', { name: 'font', value: id, min: 0, max: 0 }));
  const pending = buildFace(id, loader);
  // Si falla, no dejamos la promesa rechazada en caché: el siguiente intento vuelve a cargar.
  pending.catch(() => cache.delete(id));
  cache.set(id, pending);
  return pending;
}
