/**
 * @file src/components/dialogs/dialogPresets.ts
 * @description Presets compartidos por los diálogos: SVG vectoriales de ejemplo y roscas métricas ISO.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ISO_COARSE_THREADS } from '../../engine/threads';

/** Presets SVG vectoriales incorporados para probar extrusión y proyección 3D al instante. */
export const SVG_PRESETS: Record<'star' | 'badge' | 'gear', string> = {
  star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="50,6 63,36 96,38 71,60 79,92 50,74 21,92 29,60 4,38 37,36" fill="#38bdf8"/>
</svg>`,
  badge: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M50 6 L90 28 L90 72 L50 94 L10 72 L10 28 Z M50 26 L70 38 L70 62 L50 74 L30 62 L30 38 Z" fill="#38bdf8" fill-rule="evenodd"/>
</svg>`,
  gear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M44 6 H56 L58 18 A34 34 0 0 1 68 22 L78 14 L86 22 L78 32 A34 34 0 0 1 82 42 L94 44 V56 L82 58 A34 34 0 0 1 78 68 L86 78 L78 86 L68 78 A34 34 0 0 1 58 82 L56 94 H44 L42 82 A34 34 0 0 1 32 78 L22 86 L14 78 L22 68 A34 34 0 0 1 18 58 L6 56 V44 L18 42 A34 34 0 0 1 22 32 L14 22 L22 14 L32 22 A34 34 0 0 1 42 18 Z M50 34 A16 16 0 1 0 50 66 A16 16 0 1 0 50 34 Z" fill="#f97316" fill-rule="evenodd"/>
</svg>`,
};

/** Presets métricos ISO estándar (diámetro mm y paso grueso estándar en mm). */
export const ISO_THREAD_PRESETS: Array<{ label: string; diameterMm: number; pitchMm: number }> =
  ISO_COARSE_THREADS.filter((row) => Number.isInteger(row.diameterMm) && row.diameterMm !== 7).map((row) => ({ label: `M${row.diameterMm}`, ...row }));

/** Diámetro máximo (mm) del grupo de presets habituales; por encima van los grandes. */
export const ISO_THREAD_COMMON_MAX_MM = 20;

/** Presets en dos grupos: habituales (M3–M20) y grandes (M22–M64). */
export const ISO_THREAD_PRESET_GROUPS = {
  common: ISO_THREAD_PRESETS.filter((p) => p.diameterMm <= ISO_THREAD_COMMON_MAX_MM),
  large: ISO_THREAD_PRESETS.filter((p) => p.diameterMm > ISO_THREAD_COMMON_MAX_MM),
};
