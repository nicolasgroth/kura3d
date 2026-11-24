/**
 * @file src/utils/colorNames.ts
 * @description Nombres legibles (traducidos) de los colores de la paleta de filamentos, compartidos por la barra
 * de pintura y el inspector para que un lector de pantalla no anuncie códigos hexadecimales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';

const SWATCH_NAMES: Record<string, TranslationKey> = {
  '#38bdf8': 'viewport.paint.swatch.blue',
  '#f97316': 'viewport.paint.swatch.orange',
  '#22c55e': 'viewport.paint.swatch.green',
  '#eab308': 'viewport.paint.swatch.yellow',
  '#ef4444': 'viewport.paint.swatch.red',
  '#a855f7': 'viewport.paint.swatch.violet',
  '#f8fafc': 'viewport.paint.swatch.white',
  '#1e293b': 'viewport.paint.swatch.charcoal',
};

/** Colores de referencia fuera de la paleta, para nombrar el más cercano. */
const REFERENCE_NAMES: Record<string, TranslationKey> = {
  ...SWATCH_NAMES,
  '#94a3b8': 'viewport.paint.swatch.gray',
  '#808080': 'viewport.paint.swatch.gray',
  '#000000': 'viewport.paint.swatch.black',
  '#ffffff': 'viewport.paint.swatch.white',
  '#ff0000': 'viewport.paint.swatch.red',
  '#00ff00': 'viewport.paint.swatch.green',
  '#0000ff': 'viewport.paint.swatch.blue',
  '#ffff00': 'viewport.paint.swatch.yellow',
  '#ec4899': 'viewport.paint.swatch.pink',
  '#92400e': 'viewport.paint.swatch.brown',
};

function rgbOf(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Clave del color de referencia más cercano (distancia RGB ponderada por percepción). */
export function nearestColorKey(hex: string): { key: TranslationKey; exact: boolean } | null {
  const exact = REFERENCE_NAMES[hex.toLowerCase()];
  if (exact) return { key: exact, exact: true };
  const rgb = rgbOf(hex);
  if (!rgb) return null;
  let best: TranslationKey | null = null;
  let bestDist = Infinity;
  for (const [ref, key] of Object.entries(REFERENCE_NAMES)) {
    const c = rgbOf(ref)!;
    const dr = rgb[0] - c[0];
    const dg = rgb[1] - c[1];
    const db = rgb[2] - c[2];
    const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = key;
    }
  }
  return best ? { key: best, exact: false } : null;
}

/** Nombre corto: el de la paleta o referencia; si no coincide, "nombre aprox. · #CÓDIGO". */
export function colorName(lang: LanguageCode, hex: string): string {
  const near = nearestColorKey(hex);
  if (!near) return hex.toUpperCase();
  if (near.exact) return t(lang, near.key);
  return `${t(lang, 'viewport.paint.swatch.near', { name: t(lang, near.key) })} · ${hex.toUpperCase()}`;
}

/** Nombre con el código entre paréntesis, para tooltips ("Azul (#38BDF8)"). */
export function colorNameWithHex(lang: LanguageCode, hex: string): string {
  const near = nearestColorKey(hex);
  if (!near) return hex.toUpperCase();
  const name = near.exact ? t(lang, near.key) : t(lang, 'viewport.paint.swatch.near', { name: t(lang, near.key) });
  return `${name} (${hex.toUpperCase()})`;
}

/**
 * Nombres de una lista de colores (leyenda de filamentos): dos colores distintos no comparten nombre; al segundo
 * y siguientes de un nombre repetido se les agrega el código («Amarillo · #FFFF00»).
 */
export function distinctColorNames(lang: LanguageCode, hexes: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<string>();
  for (const hex of hexes) {
    const key = hex.toLowerCase();
    if (out.has(key)) continue;
    const base = colorName(lang, hex);
    if (!taken.has(base)) {
      taken.add(base);
      out.set(key, base);
    } else {
      out.set(key, `${base} · ${hex.toUpperCase()}`);
    }
  }
  return out;
}
