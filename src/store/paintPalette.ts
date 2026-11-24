/**
 * @file src/store/paintPalette.ts
 * @description Paleta de pintura personalizable: paletas predefinidas (la original, vivos, sobrios, pastel y escala
 * de grises), cambiar, agregar y quitar muestras, usar los colores del proyecto y volver a la original. Es una
 * preferencia del usuario (navegador, vía `preferencesStorage`), no del proyecto; solo guarda códigos de color.
 * Las reglas son funciones puras; `usePaintPalette` las aplica y persiste.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import { isSolid } from '../core/scene/objectRole';
import { PRINT_COLOR_PALETTE, type SceneObject } from '../types/kura';
import { readStorage, writeStorage } from './preferencesStorage';

export const STORAGE_PAINT_PALETTE_KEY = 'kura3d-paint-palette';

/**
 * Límites de la paleta: siempre al menos una muestra; el tope es amplio (proyectos de impresoras que mezclan
 * pueden traer cientos de colores) y solo protege el almacenamiento. La interfaz dibuja las primeras
 * `PALETTE_VISIBLE` y el resto bajo «N más», en una zona desplazable.
 */
export const PALETTE_MIN = 1;
export const PALETTE_MAX = 256;
export const PALETTE_VISIBLE = 24;

export type PalettePresetId = 'original' | 'vivid' | 'sober' | 'pastel' | 'grays';

export const PALETTE_PRESETS: Record<PalettePresetId, readonly string[]> = {
  original: PRINT_COLOR_PALETTE.map((c) => c.toLowerCase()),
  vivid: ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#00b0ff', '#2979ff', '#d500f9', '#ff4081'],
  sober: ['#1f2937', '#4b5563', '#6b7280', '#7c2d12', '#365314', '#1e3a8a', '#78716c', '#e7e5e4'],
  pastel: ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bae6fd', '#c7d2fe', '#f5d0fe', '#fbcfe8'],
  grays: ['#ffffff', '#e5e5e5', '#bdbdbd', '#9e9e9e', '#757575', '#525252', '#262626', '#000000'],
};

export const PALETTE_PRESET_IDS = Object.keys(PALETTE_PRESETS) as PalettePresetId[];

/** Estado guardado: de qué paleta partió (`custom` tras editarla o tomar los colores del proyecto) y sus muestras. */
export interface PaintPaletteState {
  preset: PalettePresetId | 'custom';
  colors: string[];
}

const HEX = /^#[0-9a-f]{6}$/;

/** Normaliza un color a `#rrggbb` en minúsculas; `null` si no es válido. */
export function normalizeHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (HEX.test(v)) return v;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : null;
}

/** Sin repetidos, válidos y dentro del límite. */
function cleanColors(colors: readonly string[]): string[] {
  const out: string[] = [];
  for (const c of colors) {
    const hex = typeof c === 'string' ? normalizeHex(c) : null;
    if (hex && !out.includes(hex)) out.push(hex);
    if (out.length >= PALETTE_MAX) break;
  }
  return out;
}

export const DEFAULT_PALETTE: PaintPaletteState = { preset: 'original', colors: [...PALETTE_PRESETS.original] };

/** Lee la paleta guardada; cualquier dato roto vuelve a la original. */
export function parsePalette(raw: string | null): PaintPaletteState {
  if (!raw) return DEFAULT_PALETTE;
  try {
    const data = JSON.parse(raw) as Partial<PaintPaletteState>;
    const colors = Array.isArray(data.colors) ? cleanColors(data.colors) : [];
    if (colors.length < PALETTE_MIN) return DEFAULT_PALETTE;
    const preset = data.preset === 'custom' || PALETTE_PRESET_IDS.includes(data.preset as PalettePresetId) ? data.preset! : 'custom';
    return { preset, colors };
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function applyPreset(id: PalettePresetId): PaintPaletteState {
  return { preset: id, colors: [...PALETTE_PRESETS[id]] };
}

/** Cambia la muestra `index`; si el color ya está en otra muestra, la paleta no cambia. */
export function replaceColor(state: PaintPaletteState, index: number, hex: string): PaintPaletteState {
  const color = normalizeHex(hex);
  if (!color || index < 0 || index >= state.colors.length) return state;
  if (state.colors[index] === color) return state;
  if (state.colors.includes(color)) return state;
  const colors = [...state.colors];
  colors[index] = color;
  return { preset: 'custom', colors };
}

export function canAddColor(state: PaintPaletteState, hex: string): boolean {
  const color = normalizeHex(hex);
  return Boolean(color) && state.colors.length < PALETTE_MAX && !state.colors.includes(color!);
}

export function addColor(state: PaintPaletteState, hex: string): PaintPaletteState {
  if (!canAddColor(state, hex)) return state;
  return { preset: 'custom', colors: [...state.colors, normalizeHex(hex)!] };
}

export function removeColorAt(state: PaintPaletteState, index: number): PaintPaletteState {
  if (state.colors.length <= PALETTE_MIN || index < 0 || index >= state.colors.length) return state;
  return { preset: 'custom', colors: state.colors.filter((_, i) => i !== index) };
}

/**
 * Colores que ya usa el proyecto (caras pintadas de cada sólido, o su color base si no tiene caras pintadas),
 * ordenados por cantidad de caras; como mucho `PALETTE_MAX` (los más usados).
 */
export function projectPaintColors(objects: readonly SceneObject[]): string[] {
  const raw = new Map<string, number>();
  const bump = (c: string, n: number) => raw.set(c, (raw.get(c) ?? 0) + n);
  for (const obj of objects) {
    if (!isSolid(obj)) continue;
    const faces = obj.mesh.faceColors;
    if (faces && faces.length > 0) for (const c of faces) bump(c, 1);
    else bump(obj.color, Math.max(1, Math.floor(obj.mesh.indices.length / 3)));
  }
  // Se normaliza una vez por color distinto, no por cara.
  const count = new Map<string, number>();
  for (const [c, n] of raw) {
    const hex = normalizeHex(c);
    if (hex) count.set(hex, (count.get(hex) ?? 0) + n);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, PALETTE_MAX);
}

/** La paleta con los colores del proyecto; sin colores, no cambia. */
export function fromProjectColors(state: PaintPaletteState, objects: readonly SceneObject[]): PaintPaletteState {
  const colors = projectPaintColors(objects);
  return colors.length >= PALETTE_MIN ? { preset: 'custom', colors } : state;
}

interface PaintPaletteStore extends PaintPaletteState {
  setPalette: (next: PaintPaletteState) => void;
}

export const usePaintPalette = create<PaintPaletteStore>((set) => ({
  ...parsePalette(readStorage(STORAGE_PAINT_PALETTE_KEY)),
  setPalette: (next) => {
    const isDefault = next.preset === 'original' && next.colors.join() === DEFAULT_PALETTE.colors.join();
    writeStorage(STORAGE_PAINT_PALETTE_KEY, isDefault ? null : JSON.stringify({ preset: next.preset, colors: next.colors }));
    set({ preset: next.preset, colors: [...next.colors] });
  },
}));

/** Aplica una regla pura a la paleta actual y la guarda. */
export function updatePaintPalette(rule: (state: PaintPaletteState) => PaintPaletteState): void {
  const store = usePaintPalette.getState();
  const next = rule({ preset: store.preset, colors: store.colors });
  if (next.preset !== store.preset || next.colors.join() !== store.colors.join()) store.setPalette(next);
}
