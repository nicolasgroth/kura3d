/**
 * @file src/utils/paletteRank.ts
 * @description Puntuación de relevancia pura para la paleta Ctrl+K: título exacto/prefijo >
 * palabra completa en el título > subcadena en el título > palabras clave > nombre de sección.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export interface RankableItem {
  label: string;
  category: string;
  keywords: string;
}

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const splitWords = (s: string): string[] => s.split(/[^a-z0-9]+/).filter(Boolean);

/** Puntaje mayor = más relevante; 0 = sin coincidencia. */
export function scorePaletteItem(item: RankableItem, rawQuery: string): number {
  const q = fold(rawQuery.trim());
  if (!q) return 1;
  const label = fold(item.label);
  if (label === q) return 600;
  if (label.startsWith(q)) return 500;
  const words = splitWords(label);
  if (words.includes(q)) return 400;
  if (words.some((w) => w.startsWith(q))) return 350;
  if (label.includes(q)) return 300;
  const kw = fold(item.keywords);
  if (splitWords(kw).includes(q)) return 220;
  if (kw.includes(q)) return 200;
  if (fold(item.category).includes(q)) return 100;
  return 0;
}

/** Filtra y ordena por relevancia (estable: a igual puntaje conserva el orden original). */
export function rankPaletteItems<T extends RankableItem>(items: T[], query: string): T[] {
  if (!query.trim()) return items;
  return items
    .map((item, index) => ({ item, index, score: scorePaletteItem(item, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}
