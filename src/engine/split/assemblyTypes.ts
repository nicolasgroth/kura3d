/**
 * @file src/engine/split/assemblyTypes.ts
 * @description Tipos de la validación de armado (`validateAssembly`): entrada mínima de piezas y
 * uniones (la cumplen `SplitPart`/`SplitJoint` y las piezas del corte por plano), opciones e informe
 * con cierre, choques de conectores, direcciones de inserción, orden de montaje, bloqueos, arreglo
 * sugerido (uniones que pasan a "para pegar") y firmeza de cada unión con conector.
 * Direcciones: `SplitFace` como vector de MOVIMIENTO de la pieza al entrar ('-y' = baja desde arriba).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import type { EngineWarning } from '../engineErrors';
import type { SplitAxis, SplitConnectorOptions, SplitFace, SplitJointKind, SplitTransform } from './splitTypes';

/** Dirección de inserción (eje y signo del movimiento). */
export type AssemblyDirection = SplitFace;

/** Pieza a validar: malla local y su transformación de armado (la cumple `SplitPart`). */
export interface AssemblyPartInput {
  code: string;
  mesh: MeshData;
  assembly: SplitTransform;
  volumeMm3?: number;
}

/** Unión a validar (la cumple `SplitJoint`). `a` = lado negativo del eje, `b` = lado positivo. */
export interface AssemblyJointInput {
  label: string;
  axis: SplitAxis;
  position: number;
  a: { part: number; code: string };
  b: { part: number; code: string };
  kind: SplitJointKind;
  connector: SplitConnectorOptions | null;
  connectorCenters: [number, number, number][];
  contactAreaMm2: number;
}

/** Opciones de la validación. */
export interface ValidateAssemblyOptions {
  /** Convierte en "para pegar" el mínimo de uniones que destraba el montaje (por defecto `false`). */
  autoFix?: boolean;
  /** Volumen del original y lo quitado a propósito (holgura, grabado) para el cierre por volumen. */
  sourceVolumeMm3?: number;
  clearanceVolumeMm3?: number;
  engravedVolumeMm3?: number;
  /** Lado del vóxel (mm); por defecto la medida mayor / `ASSEMBLY_LIMITS.voxelsPerSide`. */
  voxelMm?: number;
  /** Pared mínima entre conectores y hasta la superficie (mm, por defecto `ASSEMBLY_LIMITS.minWallMm`). */
  minWallMm?: number;
  /** Mide la pared de cada conector hasta la superficie exterior (por defecto `true`). */
  checkExterior?: boolean;
}

/** Par de piezas que se interfieren rearmadas. */
export interface AssemblyInterference {
  a: string;
  b: string;
  volumeMm3: number;
}

/** Hueco entre las caras de una unión mayor que la holgura. */
export interface AssemblyGap {
  joint: string;
  gapMm: number;
}

/** Cierre: rearmadas, las piezas reconstruyen el original. */
export interface AssemblyClosure {
  ok: boolean;
  /** (piezas + holgura + grabado) − original, mm³ y %; `null` sin `sourceVolumeMm3`. */
  volumeErrorMm3: number | null;
  volumeErrorPct: number | null;
  interference: AssemblyInterference[];
  gaps: AssemblyGap[];
}

/** Conector que choca con otro o queda sin pared suficiente. `other: null` = la superficie exterior. */
export interface ConnectorClash {
  joint: string;
  index: number;
  other: { joint: string; index: number } | null;
  /** Distancia libre medida (mm; negativa = se intersectan) y la pared exigida. */
  distanceMm: number;
  requiredMm: number;
}

/** Paso del orden de montaje. */
export interface AssemblyStep {
  part: number;
  code: string;
  direction: AssemblyDirection;
  /** 1 = primera pieza (la base). */
  step: number;
}

/** Pieza que no puede entrar con ninguna dirección. */
export interface AssemblyBlocked {
  part: number;
  code: string;
  /** `directions`: sus conectores exigen direcciones incompatibles; `sweep`: el recorrido topa con piezas puestas. */
  reason: 'directions' | 'sweep';
  conflictingJoints: string[];
  /** Piezas ya puestas con las que topa el recorrido (códigos). */
  blockingParts: string[];
}

/** Unión con conector que no cumple la regla de firmeza. */
export interface WeakJoint {
  joint: string;
  /** Radio (o semiancho) del conector medido y recomendado (mm). */
  measuredMm: number;
  recommendedMm: number;
  /** Fracción del área de contacto cubierta por los conectores. */
  areaFraction: number;
}

/** Informe de la validación de armado. */
export interface AssemblyReport {
  ok: boolean;
  closure: AssemblyClosure;
  clashes: ConnectorClash[];
  /** Orden de montaje completo, o el tramo que se pudo armar si hay bloqueos. */
  order: AssemblyStep[];
  blocked: AssemblyBlocked[];
  /** Uniones que conviene (o ya se hizo, `applied`) pasar a "para pegar" para destrabar el montaje. */
  fix: { glueJoints: string[]; applied: boolean };
  weak: WeakJoint[];
  warnings: EngineWarning[];
  /** Lado del vóxel usado (mm) y tiempo. */
  voxelMm: number;
  elapsedMs: number;
}

/** Resumen corto del informe (para `split_for_bed` y la herramienta MCP). */
export interface AssemblySummary {
  ok: boolean;
  steps: number;
  blocked: string[];
  clashes: number;
  weakJoints: string[];
  gluedByFix: string[];
  volumeErrorPct: number | null;
}
