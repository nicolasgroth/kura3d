/**
 * @file src/core/addons/cablePass.ts
 * @description Paso de cable: parámetros (redondo o ranura, medidas, chaflán de las bocas, giro, profundidad medida o
 * a mano), rangos, validación y saneo, y la geometría pura del negativo pasante en coordenadas locales (origen en el
 * punto de la cara, +Y hacia afuera, +X a lo largo del lado largo): un estadio extruido hacia adentro con chaflán a
 * 45° en la boca de entrada y, si atraviesa, en la de salida, que sigue abriendo un margen más allá de cada boca para
 * que la resta abra limpio. El lado largo va horizontal en la cara (giro 0). Funciones puras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CablePassParams, MeshData, Vec3 } from '../../types/kura';
import { uprightFrame, type UprightFrame } from './faceFrame';
import { MIN_WALL_MM } from './magnetPocket';
import { stadiumLoftMesh, stadiumSectionArea, type StadiumRing } from './stadiumMesh';

export type { CablePassParams };
export type CablePassShape = CablePassParams['shape'];

/** Cuánto sigue el negativo más allá de cada boca (mm), abriendo a 45° si hay chaflán. */
export const CABLE_MARGIN_MM = 0.5;
/** Tope de la medición automática: una pared más gruesa no se atraviesa sola (se elige la profundidad a mano). */
export const CABLE_MAX_AUTO_MM = 40;
/** Distancia mínima al borde de la cara y a otro agregado (3 perímetros de 0,4 mm). */
export const CABLE_MIN_GAP_MM = MIN_WALL_MM;

export const CABLE_PASS_RANGES = {
  widthMm: { min: 1, max: 40 },
  lengthMm: { min: 1, max: 80 },
  chamferMm: { min: 0, max: 3 },
  angleDeg: { min: -180, max: 180 },
  depthMm: { min: 0.5, max: 100 },
} as const;

export type CablePassNumericField = keyof typeof CABLE_PASS_RANGES;

/** Campos fuera de rango; en la ranura, el lado largo no puede ser menor que el corto. */
export function invalidCablePassFields(p: CablePassParams): CablePassNumericField[] {
  const bad = (Object.keys(CABLE_PASS_RANGES) as CablePassNumericField[]).filter((field) => {
    const v = p[field];
    const r = CABLE_PASS_RANGES[field];
    return !(Number.isFinite(v) && v >= r.min && v <= r.max);
  });
  if (p.shape === 'slot' && !bad.includes('lengthMm') && !bad.includes('widthMm') && !(p.lengthMm >= p.widthMm)) bad.push('lengthMm');
  return bad;
}

/** Parámetros válidos a partir de datos no confiables (preferencias, `.kura`); null si no sirven. */
export function sanitizeCablePassParams(raw: unknown): CablePassParams | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.shape !== 'round' && r.shape !== 'slot') return null;
  if (typeof r.autoDepth !== 'boolean') return null;
  const num = (v: unknown, fallback?: number) => (v === undefined && fallback !== undefined ? fallback : typeof v === 'number' ? v : NaN);
  const p: CablePassParams = {
    shape: r.shape,
    widthMm: num(r.widthMm),
    lengthMm: num(r.lengthMm),
    chamferMm: num(r.chamferMm),
    angleDeg: num(r.angleDeg, 0),
    autoDepth: r.autoDepth,
    depthMm: num(r.depthMm),
  };
  return invalidCablePassFields(p).length === 0 ? p : null;
}

export function sameCablePass(a: CablePassParams, b: CablePassParams): boolean {
  return a.shape === b.shape && a.widthMm === b.widthMm && (a.shape === 'round' || a.lengthMm === b.lengthMm)
    && a.chamferMm === b.chamferMm && a.angleDeg === b.angleDeg && a.autoDepth === b.autoDepth && a.depthMm === b.depthMm;
}

/** Radio y medio tramo recto de la sección. */
export function cableSection(p: Pick<CablePassParams, 'shape' | 'widthMm' | 'lengthMm'>): { radius: number; halfStraight: number } {
  const radius = p.widthMm / 2;
  return { radius, halfStraight: p.shape === 'slot' ? Math.max(0, p.lengthMm - p.widthMm) / 2 : 0 };
}

/** Área libre de la sección (la del polígono real). */
export const cableSectionArea = (p: Pick<CablePassParams, 'shape' | 'widthMm' | 'lengthMm'>) => {
  const { radius, halfStraight } = cableSection(p);
  return stadiumSectionArea(radius, 2 * halfStraight);
};

/**
 * Negativo de `boreMm` de largo entre bocas (de y = 0 a y = −`boreMm`). Con `through` la boca de salida también
 * lleva chaflán y el negativo sigue `CABLE_MARGIN_MM` más allá; si no, termina en el fondo (agujero ciego).
 */
export function cablePassMesh(p: CablePassParams, boreMm: number, through: boolean): MeshData {
  const { radius: r, halfStraight } = cableSection(p);
  const m = CABLE_MARGIN_MM;
  const c = Math.min(p.chamferMm, boreMm / 2 - 0.01, r);
  const rings: StadiumRing[] = [];
  if (c > 1e-6) {
    if (through) rings.push({ y: -boreMm - m, radius: r + c + m }, { y: -boreMm, radius: r + c }, { y: -boreMm + c, radius: r });
    else rings.push({ y: -boreMm, radius: r });
    rings.push({ y: -c, radius: r }, { y: 0, radius: r + c }, { y: m, radius: r + c + m });
  } else {
    rings.push({ y: through ? -boreMm - m : -boreMm, radius: r }, { y: m, radius: r });
  }
  return stadiumLoftMesh({ straightMm: 2 * halfStraight, x0: -halfStraight, rings });
}

/** Base del paso: lado largo horizontal en la cara (giro 0), girado `angleDeg`. */
export const cablePassFrame = (normal: Vec3, angleDeg: number): UprightFrame | null => uprightFrame(normal, angleDeg + 90);
