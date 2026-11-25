/**
 * @file src/engine/threadIsoTables.ts
 * @description Tablas ISO de roscas métricas M3–M64 (rango único de Kurra Studio, igual en interfaz,
 * límites y motor): paso grueso ISO 261, entrecaras s y altura de cabeza k de ISO 4017 / ISO 4032,
 * tolerancia TD1 grado 6 del diámetro menor interior (ISO 965-1, posición H ⇒ D1 máx = D1 + TD1)
 * y la holgura radial por defecto para impresión FDM, escalada con el paso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Tabla ISO 261 de paso grueso (diámetro nominal → paso en mm), M3–M64: serie preferente + segunda elección habitual. */
export const ISO_COARSE_THREADS: ReadonlyArray<{ diameterMm: number; pitchMm: number }> = [
  { diameterMm: 3, pitchMm: 0.5 },
  { diameterMm: 3.5, pitchMm: 0.6 },
  { diameterMm: 4, pitchMm: 0.7 },
  { diameterMm: 5, pitchMm: 0.8 },
  { diameterMm: 6, pitchMm: 1.0 },
  { diameterMm: 7, pitchMm: 1.0 },
  { diameterMm: 8, pitchMm: 1.25 },
  { diameterMm: 10, pitchMm: 1.5 },
  { diameterMm: 12, pitchMm: 1.75 },
  { diameterMm: 14, pitchMm: 2.0 },
  { diameterMm: 16, pitchMm: 2.0 },
  { diameterMm: 18, pitchMm: 2.5 },
  { diameterMm: 20, pitchMm: 2.5 },
  { diameterMm: 22, pitchMm: 2.5 },
  { diameterMm: 24, pitchMm: 3.0 },
  { diameterMm: 27, pitchMm: 3.0 },
  { diameterMm: 30, pitchMm: 3.5 },
  { diameterMm: 33, pitchMm: 3.5 },
  { diameterMm: 36, pitchMm: 4.0 },
  { diameterMm: 39, pitchMm: 4.0 },
  { diameterMm: 42, pitchMm: 4.5 },
  { diameterMm: 45, pitchMm: 4.5 },
  { diameterMm: 48, pitchMm: 5.0 },
  { diameterMm: 52, pitchMm: 5.0 },
  { diameterMm: 56, pitchMm: 5.5 },
  { diameterMm: 60, pitchMm: 5.5 },
  { diameterMm: 64, pitchMm: 6.0 },
];

/**
 * Entrecaras s (mm) de cabezas y tuercas hexagonales ISO 4017 / ISO 4032 (M3.5 y M7 según DIN 933).
 * Valores de M22 a M64: pendiente de contrastar con la norma (tomados de memoria, sin acceso a ISO 4017/4032).
 */
export const ISO_HEX_ACROSS_FLATS: Readonly<Record<number, number>> = {
  3: 5.5, 3.5: 6, 4: 7, 5: 8, 6: 10, 7: 11, 8: 13, 10: 16, 12: 18, 14: 21, 16: 24, 18: 27, 20: 30,
  22: 34, 24: 36, 27: 41, 30: 46, 33: 50, 36: 55, 39: 60, 42: 65, 45: 70, 48: 75, 52: 80, 56: 85, 60: 90, 64: 95,
};

/**
 * Altura nominal de cabeza k (mm) de ISO 4017 (M3.5 y M7 según DIN 933). Valores de M22 a M64: pendiente de
 * contrastar con la norma (de memoria). La altura de tuerca ISO 4032 (m) no se usa: la tuerca se genera con el largo pedido.
 */
export const ISO_HEAD_HEIGHT: Readonly<Record<number, number>> = {
  3: 2.0, 3.5: 2.4, 4: 2.8, 5: 3.5, 6: 4.0, 7: 4.8, 8: 5.3, 10: 6.4, 12: 7.5, 14: 8.8, 16: 10, 18: 11.5, 20: 12.5,
  22: 14, 24: 15, 27: 17, 30: 18.7, 33: 21, 36: 22.5, 39: 25, 42: 26, 45: 28, 48: 30, 52: 33, 56: 35, 60: 38, 64: 40,
};

/** Tolerancia TD1 grado 6 del diámetro menor interior por paso (ISO 965-1), en mm. */
const TD1_GRADE6: ReadonlyArray<readonly [number, number]> = [
  [0.2, 0.056], [0.25, 0.071], [0.3, 0.085], [0.35, 0.1], [0.4, 0.112], [0.45, 0.125], [0.5, 0.14],
  [0.6, 0.16], [0.7, 0.18], [0.75, 0.19], [0.8, 0.2], [1.0, 0.236], [1.25, 0.265], [1.5, 0.3],
  [1.75, 0.335], [2.0, 0.375], [2.5, 0.45], [3.0, 0.5], [3.5, 0.56], [4.0, 0.6], [4.5, 0.67], [5.0, 0.71],
  // P 5.5 y 6.0: pendiente de contrastar con ISO 965-1 (extrapolación de la progresión de la tabla)
  [5.5, 0.75], [6.0, 0.8],
];

/** Interpolación lineal por tramos sobre una tabla ordenada (extremos constantes). */
function interpolate(table: ReadonlyArray<readonly [number, number]>, x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1 + 1e-9) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

const HEAD_TABLE = Object.entries(ISO_HEAD_HEIGHT)
  .map(([d, k]) => [Number(d), k] as const)
  .sort((a, b) => a[0] - b[0]);

/** Entrecaras del hexágono para `diameterMm`: tabla ISO si es nominal; si no, 1.55·d. */
export function hexAcrossFlats(diameterMm: number): number {
  return ISO_HEX_ACROSS_FLATS[diameterMm] ?? 1.55 * diameterMm;
}

/** Altura de cabeza k (ISO 4017) para `diameterMm`; entre nominales se interpola. */
export function isoHeadHeight(diameterMm: number): number {
  return ISO_HEAD_HEIGHT[diameterMm] ?? Math.round(interpolate(HEAD_TABLE, diameterMm) * 100) / 100;
}

/** Diámetro menor interior máximo de la clase 6H: D1 + TD1 (ISO 965-1), con D1 = d − 1.0825·P. */
export function isoMinorDiameterMax6H(diameterMm: number, pitchMm: number): number {
  const d1 = diameterMm - (5 / 4) * (Math.sqrt(3) / 2) * pitchMm;
  return d1 + interpolate(TD1_GRADE6, pitchMm);
}

/** Holgura radial por defecto para FDM: 0.3·P acotada a [0.15, 0.35] mm (M3 0.15, M6 0.30, M8+ 0.35). */
export const DEFAULT_CLEARANCE_FRACTION_OF_PITCH = 0.3;
export const DEFAULT_CLEARANCE_MIN_MM = 0.15;
export const DEFAULT_CLEARANCE_MAX_MM = 0.35;

/** Holgura radial por defecto (mm) para el paso `pitchMm`, redondeada a centésimas. */
export function defaultThreadClearance(pitchMm: number): number {
  const raw = DEFAULT_CLEARANCE_FRACTION_OF_PITCH * pitchMm;
  const clamped = Math.min(DEFAULT_CLEARANCE_MAX_MM, Math.max(DEFAULT_CLEARANCE_MIN_MM, raw));
  return Math.round(clamped * 100) / 100;
}
