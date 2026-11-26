/**
 * @file src/components/assistants/galleryModel.ts
 * @description Modelo puro de la galería de Asistentes: categoría saneada de cada receta (`category` desconocida o
 * mal formada cae en «otros»), filtro por categoría y búsqueda por texto (sin tildes ni mayúsculas) y movimiento por la
 * cuadrícula con las flechas. Sin React ni estado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Categorías con texto propio en la interfaz; el resto se agrupa en `otros`. */
export const GALLERY_CATEGORIES = ['cajas', 'regalos', 'hogar', 'otros'] as const;
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];
export type GalleryFilter = GalleryCategory | 'all';

/** Saneada: solo una categoría conocida (en minúsculas) pasa; cualquier otra cosa es `otros`. */
export function galleryCategory(raw: unknown): GalleryCategory {
  if (typeof raw !== 'string') return 'otros';
  const key = raw.trim().toLowerCase();
  return (GALLERY_CATEGORIES as readonly string[]).includes(key) ? (key as GalleryCategory) : 'otros';
}

export interface GalleryItem {
  readonly id: string;
  readonly category: GalleryCategory;
  /** Texto en el que busca la búsqueda: título, descripción y etiquetas. */
  readonly haystack: string;
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function galleryHaystack(...parts: ReadonlyArray<string | undefined>): string {
  return fold(parts.filter(Boolean).join(' '));
}

/** Elementos que cumplen la categoría y la búsqueda (todas las palabras de la búsqueda deben aparecer). */
export function filterGallery<T extends GalleryItem>(items: readonly T[], category: GalleryFilter, query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return items.filter((it) => (category === 'all' || it.category === category) && words.every((w) => it.haystack.includes(w)));
}

/** Categorías que tienen al menos una receta, en el orden fijo de `GALLERY_CATEGORIES`. */
export function usedCategories(items: readonly GalleryItem[]): GalleryCategory[] {
  return GALLERY_CATEGORIES.filter((c) => items.some((it) => it.category === c));
}

/**
 * Índice al que lleva una tecla de navegación desde `index` en una cuadrícula de `columns` columnas y `count`
 * elementos (sin dar la vuelta: en el borde se queda). `null` si la tecla no navega.
 */
export function gridMove(key: string, index: number, count: number, columns: number): number | null {
  if (count <= 0) return null;
  const cols = Math.max(1, columns);
  const last = count - 1;
  switch (key) {
    case 'ArrowRight': return Math.min(last, index + 1);
    case 'ArrowLeft': return Math.max(0, index - 1);
    case 'ArrowDown': return index + cols <= last ? index + cols : index;
    case 'ArrowUp': return index - cols >= 0 ? index - cols : index;
    case 'Home': return 0;
    case 'End': return last;
    default: return null;
  }
}
