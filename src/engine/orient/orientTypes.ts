/**
 * @file src/engine/orient/orientTypes.ts
 * @description Tipos de «Orientar para imprimir»: entrada (una pieza con su transformación), opciones,
 * medidas por orientación candidata, motivos legibles como datos (clave + parámetros) y el análisis
 * completo comparado contra la orientación actual. Ejes internos: Y arriba, cama en Y = 0.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';

/** Pieza a orientar: malla local y su transformación (Euler XYZ en radianes, como `SceneObject`). */
export interface OrientInput {
  mesh: Pick<MeshData, 'positions' | 'indices'>;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

/** Cama opcional para decir si cabe; el margen se aplica solo en X/Y del usuario (plano de la cama). */
export interface OrientBed {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  marginMm?: number;
}

export interface OrientOptions {
  /** Ángulo de voladizo respecto de la vertical (grados). Por defecto 45. */
  overhangAngleDeg?: number;
  bed?: OrientBed | null;
  /** Máximo de candidatos del casco convexo que se puntúan (además de la actual y las 6 de ejes). */
  maxHullCandidates?: number;
  /** Ángulo mínimo de vuelco (grados) para considerar estable un apoyo. Por defecto 10. */
  minTipAngleDeg?: number;
  /** Celdas por lado de la grilla de proyección que aproxima el volumen de soporte. Por defecto 160. */
  gridCells?: number;
}

/** Peso de cada término del costo (menor es mejor). Ver `docs/diseno/ORIENTAR.md`. */
export interface OrientWeights {
  /** Volumen de soporte / volumen de la pieza. */
  support: number;
  /** Área en voladizo / área total. */
  overhang: number;
  /** Altura / mayor dimensión de la pieza. */
  height: number;
  /** 1 − (contacto / mayor contacto entre candidatos). */
  base: number;
  /** Penalización fija si el apoyo es inestable. */
  unstable: number;
  /** Penalización fija si no cabe en la cama indicada. */
  noFit: number;
}

export type OrientSource = 'current' | 'axis' | 'hull';

/** Motivo legible como dato: la interfaz lo traduce con i18n. */
export type OrientReason =
  | { key: 'current' }
  | { key: 'noOverhangs' }
  | { key: 'supportVsCurrent'; params: { percent: number } }
  | { key: 'supportAdded'; params: { volumeMm3: number } }
  | { key: 'baseVsCurrent'; params: { factor: number } }
  | { key: 'lowerVsCurrent'; params: { percent: number } }
  | { key: 'equivalentToBest' }
  | { key: 'unstable'; params: { tipAngleDeg: number } }
  | { key: 'doesNotFit' };

export interface OrientMeasures {
  /** Área (mm²) de triángulos en voladizo más allá del umbral, sin contar los que tocan la cama. */
  overhangAreaMm2: number;
  /** Volumen aproximado (mm³) de las columnas de soporte bajo el voladizo (grilla de proyección). */
  supportVolumeMm3: number;
  /** Área (mm²) de caras planas apoyadas en la cama. */
  contactAreaMm2: number;
  /** Área (mm²) del polígono de apoyo (casco 2D de los puntos que tocan la cama). */
  supportPolygonMm2: number;
  /** Ángulo (grados) que hay que inclinar la pieza para que vuelque; 0 si el centro de masa cae fuera. */
  tipAngleDeg: number;
  stable: boolean;
  heightMm: number;
  /** Huella en la cama (ancho X, fondo Y del usuario) con el giro sobre la vertical elegido. */
  footprintMm: [number, number];
  /** `null` si no se indicó cama. */
  fitsBed: boolean | null;
}

export interface OrientCandidate {
  id: string;
  source: OrientSource;
  /** Dirección (mundo, ejes internos) que queda hacia la cama. */
  down: Vec3;
  /** Giro a aplicar sobre la pieza tal como está (cuaternión x, y, z, w en ejes internos). */
  quaternion: [number, number, number, number];
  measures: OrientMeasures;
  /** Costo ponderado (menor es mejor). */
  cost: number;
  /** Puesto en la lista (0 = mejor). */
  rank: number;
  /** Costo dentro de la tolerancia de la mejor: indistinguible para imprimir. */
  equivalentToBest: boolean;
  /** Diferencias frente a la orientación actual (porcentajes con signo; `null` si la actual es 0). */
  vsCurrent: {
    supportVolumePct: number | null;
    overhangAreaPct: number | null;
    heightPct: number;
    contactFactor: number | null;
  };
  reasons: OrientReason[];
}

export interface OrientAnalysis {
  /** Ordenada de mejor a peor. */
  candidates: OrientCandidate[];
  currentId: string;
  /** La actual ya está entre las mejores (equivalente a la primera). */
  currentIsBest: boolean;
  /** Todas las orientaciones son equivalentes (p. ej. una esfera): no hay ganadora. */
  allEquivalent: boolean;
  overhangAngleDeg: number;
  weights: OrientWeights;
  equivalenceTolerance: number;
  /** Tamaño de celda (mm) de la grilla del volumen de soporte: el volumen es aproximado. */
  supportCellMm: number;
  partVolumeMm3: number;
  triangleCount: number;
}
