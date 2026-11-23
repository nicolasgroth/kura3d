/**
 * @file src/engine/fitCheck/fitCheckTypes.ts
 * @description Tipos de "Comprobar encaje" (`check_fit`): entrada (objetos de escena, negativos a
 * aplicar y opciones), resultado por par (choque, holgura, puntos más cercanos, recomendación) e
 * informe serializable. Todo lo que sale en el informe está en ejes del usuario (X derecha, Y fondo,
 * Z altura); el cálculo interno usa los ejes de three.js (Y arriba).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AxisDirection } from '../../core/scene/displayAxes';
import type { ObjectRole, SceneObject, Vec3 } from '../../types/kura';

/** Lo mínimo de un objeto para comprobar el encaje (malla local + transformación interna). */
export type FitCheckBody = Pick<SceneObject, 'id' | 'name' | 'role' | 'mesh' | 'position' | 'rotation' | 'scale'>;

export interface FitCheckOptions {
  /** Aplica (en copia) las restas pendientes de cada sólido antes de comparar. Por defecto `true`. */
  applyPendingSubtractions?: boolean;
  /** Holgura deseada en mm (por defecto 0,25, la tolerancia de encaje del proyecto). */
  clearanceTargetMm?: number;
  /** Tope de búsqueda de la holgura (mm). Por defecto max(4 · holgura deseada, 2 mm). */
  searchMm?: number;
  /** Máximo de pares que pasan a la fase fina (por defecto 1000); el resto se informa como no revisado. */
  maxPairs?: number;
  /** Triángulos sumados de un par sobre los que se simplifica una copia solo para el cálculo. */
  maxTrianglesPerPair?: number;
  /** Tope de tiempo de la fase fina en ms; los pares que no alcanzan se informan como no revisados. */
  timeBudgetMs?: number;
}

/** Opciones con sus valores por defecto ya resueltos (viajan en el informe). */
export type ResolvedFitCheckOptions = Required<FitCheckOptions>;

export interface FitCheckInput {
  /** Objetos a comprobar: sólidos y referencias (los negativos de esta lista se ignoran). */
  objects: readonly FitCheckBody[];
  /** Negativos visibles de la escena que se restan de los sólidos que tocan (por caja). */
  negatives?: readonly FitCheckBody[];
  options?: FitCheckOptions;
}

export interface FitCheckHooks {
  /** Avance legible por máquina: `prepare:i/n`, `pair:i/n`. */
  onProgress?: (phase: string) => void;
  /** Cancelación cooperativa (en proceso); en el Worker se cancela terminándolo. */
  shouldCancel?: () => boolean;
}

/** Estado de un par: se cruzan, holgura menor que la deseada, holgura suficiente, lejos (fuera de búsqueda). */
export type FitPairStatus = 'interferes' | 'tight' | 'ok' | 'far';
export type FitPairKind = 'reference-solid' | 'solid-solid';

/** Texto por regla: clave i18n y parámetros (números en mm, direcciones `+x`… del usuario). */
export interface FitMessage {
  key: string;
  params: Record<string, string | number>;
  /** La cifra o dirección es una estimación (no un valor exacto). */
  estimate?: boolean;
}

/** Caja alineada en ejes del usuario (mm). */
export interface FitBox {
  min: Vec3;
  max: Vec3;
}

export interface FitInterference {
  /** Volumen que se cruza (mm³). Exacto con Manifold; estimado por muestreo si alguna malla no cierra. */
  volumeMm3: number;
  /** Caja de la zona que se cruza (ejes del usuario). */
  zoneBox: FitBox;
  /** Punto representativo de la zona (centro de su caja, ejes del usuario). */
  point: Vec3;
  approximate: boolean;
  /** Solo en el método aproximado: pares de triángulos que se cortan. */
  crossingTriangles?: number;
  /** Profundidad estimada del cruce (mm): menor espesor de la zona. */
  depthMm: number;
}

export interface FitPairResult {
  /** Primer objeto del par: la referencia, si la hay; si no, el primero en la entrada. */
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  kind: FitPairKind;
  status: FitPairStatus;
  /** Algún cálculo del par fue aproximado (malla abierta). */
  approximate: boolean;
  interference: FitInterference | null;
  /** Distancia mínima entre superficies (mm); 0 si se cruzan; `null` si supera el tope de búsqueda. */
  clearanceMm: number | null;
  /** Puntos más cercanos sobre A y sobre B (ejes del usuario), si están dentro del tope de búsqueda. */
  closest: { onA: Vec3; onB: Vec3 } | null;
  /** Se usó una copia simplificada para el cálculo (malla muy densa). */
  simplified: boolean;
  recommendation: FitMessage | null;
}

export interface FitCheckSummary {
  objects: number;
  /** Pares posibles (sin referencia–referencia). */
  possiblePairs: number;
  /** Pares que pasaron la fase ancha (cajas agrandadas en `searchMm` que se tocan). */
  broadPhaseCandidates: number;
  /** Pares calculados en la fase fina. */
  evaluatedPairs: number;
  interferes: number;
  tight: number;
  ok: number;
  /** Lejos: descartados por la fase ancha o con holgura mayor que el tope de búsqueda. */
  far: number;
  /** Candidatos sin revisar por `maxPairs` o por el tope de tiempo. */
  skipped: number;
  /** Peor par: mayor choque o, si no hay, menor holgura justa. */
  worst: { aId: string; bId: string; status: FitPairStatus; volumeMm3?: number; clearanceMm?: number } | null;
  /** Frase de resumen general. */
  message: FitMessage;
}

export interface FitCheckReport {
  version: 1;
  /** Objetos comprobados (sólidos y referencias). */
  objectIds: string[];
  options: ResolvedFitCheckOptions;
  /** Pares calculados (orden: choques por volumen, justos por holgura, luego el resto). */
  pairs: FitPairResult[];
  summary: FitCheckSummary;
  /** Restas pendientes: aplicadas en copia, ignoradas a pedido o que no se pudieron aplicar (sólido abierto). */
  subtractions: { applied: number; ignored: number; failed: string[] };
  /** Corte por `maxPairs` o por el tope de tiempo. */
  truncated: boolean;
  /** Notas generales (mallas abiertas, simplificación, restas ignoradas, corte). */
  notes: FitMessage[];
  durationMs: number;
}

/** Dirección del usuario en la que conviene mover A (estimada). */
export type FitShiftDirection = AxisDirection;
