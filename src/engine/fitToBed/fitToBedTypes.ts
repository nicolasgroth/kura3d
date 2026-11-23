/**
 * @file src/engine/fitToBed/fitToBedTypes.ts
 * @description Tipos de "Ajustar a la impresora" (`fit_to_bed`): cama con margen, alternativas
 * (escalar, girar, girar y escalar, dividir) y partes con medida funcional que el escalado rompe.
 * Medidas y ejes del resultado en ejes del usuario: X derecha, Y fondo, Z altura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Vec3 } from '../../types/kura';

/** Cama de destino: ancho X, fondo Y y alto Z del usuario, margen por lado (mm). */
export interface FitBed {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  marginMm: number;
}

/** Lo mínimo de un objeto para medirlo: malla local y transformación (ejes internos, Y arriba). */
export interface FitBodyInput {
  id: string;
  mesh: { positions: ArrayLike<number> };
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

/** Cara del bloque (en su orientación actual, ejes del usuario) que queda apoyada en la cama. */
export type FitDownFace = '-z' | '+z' | '-x' | '+x' | '-y' | '+y';

/** Giro de un paso sobre un eje del usuario, en grados (positivo = regla de la mano derecha). */
export interface FitRotationStep {
  axis: 'x' | 'y' | 'z';
  deg: 90 | -90 | 180;
}

/** Una de las 24 orientaciones ortogonales: primero se apoya `downFace`, luego se gira sobre Z. */
export interface FitOrientation {
  /** 0..23; 0 = orientación actual. */
  index: number;
  downFace: FitDownFace;
  /** Giro sobre Z tras apoyar la cara (0, 90, 180 o 270). */
  turnZDeg: 0 | 90 | 180 | 270;
  /** Pasos para el usuario, en orden; vacío = sin giro. */
  steps: FitRotationStep[];
}

export type FitWarningCode =
  /** La escala reduce paredes y detalles: `factor`, `wallMm` (pared de 1,2 mm resultante). */
  | 'FIT_THIN_WALLS'
  /** La escala baja de la mínima aceptable (`factor`, `minFactor`): conviene dividir. */
  | 'FIT_BELOW_MIN_SCALE'
  /** Cambia la cara apoyada: voladizos y estabilidad cambian. */
  | 'FIT_DOWN_FACE_CHANGED'
  /** Una parte con medida funcional deja de ser estándar al escalar (`objectId`, `feature`, `factor`). */
  | 'FIT_FUNCTIONAL_SCALED';

export interface FitWarning {
  code: FitWarningCode;
  params: Record<string, string | number>;
}

export type FitAlternativeKind = 'scale' | 'rotate' | 'rotateScale' | 'split';

/** Motivo por el que una alternativa no está disponible. */
export type FitUnavailableReason =
  /** Ya cabe sin cambios. */
  | 'alreadyFits'
  /** Ninguna de las 24 orientaciones cabe a tamaño real. */
  | 'noOrientationFits'
  /** Girar sin escalar ya cabe: girar y escalar daría lo mismo. */
  | 'sameAsRotate'
  /** Cabe a tamaño real (girando): no hace falta dividir. */
  | 'fitsWithoutSplit';

/** Una alternativa comparable con las demás. */
export interface FitAlternative {
  kind: FitAlternativeKind;
  available: boolean;
  reason?: FitUnavailableReason;
  /** Factor uniforme (1 = sin escalar). En `split`, 1: las piezas se imprimen a tamaño real. */
  factor: number;
  /** Tamaño del bloque resultante (X, Y, Z del usuario, mm). En `split`, el tamaño real. */
  sizeMm: Vec3;
  orientation: FitOrientation;
  changesDownFace: boolean;
  /** Sugerida por las reglas (la única marca: el usuario elige). */
  recommended: boolean;
  warnings: FitWarning[];
}

/** Medida funcional reconocida hoy en un objeto. */
export type FunctionalFeatureKind = 'thread' | 'splitConnector' | 'splitDowel' | 'parametricPrimitive';

/**
 * Parte con medida funcional que el escalado cambia. Gancho para los agregados futuros
 * (`addon: {kind, params}`): se agregan nuevos `kind` sin cambiar la forma.
 */
export interface FunctionalFeature {
  objectId: string;
  kind: FunctionalFeatureKind;
  /** Rótulo corto e independiente del idioma, p. ej. `M8x1.25`, `dowel r4`, `box 20x20x20`. */
  label: string;
  /** Medida nominal principal en mm (diámetro de rosca, radio de conector…). */
  nominalMm?: number;
  /**
   * "Mantener aparte" (no escalar este objeto) solo es posible si es un objeto separado dentro de
   * un bloque de varios; si está fundido en la malla, no hay cómo separarlo hoy.
   */
  keepApart: { available: boolean; reason?: 'onlyObject' | 'mergedInMesh' };
}

export interface FitToBedOptions {
  /** Escala mínima aceptable (por defecto 0,5). */
  minScale?: number;
  /** Por debajo de este factor se avisa de paredes finas (por defecto 0,8). */
  thinWallFactor?: number;
}

export interface FitToBedAnalysis {
  /** Tamaño actual del bloque (X, Y, Z del usuario, mm). */
  sizeMm: Vec3;
  /** Espacio útil de la cama (cama − 2·margen por eje). */
  usableMm: Vec3;
  fitsAsIs: boolean;
  /** Siempre en orden: scale, rotate, rotateScale, split. */
  alternatives: FitAlternative[];
}

/** Transformación nueva de un objeto (ejes internos, como `SceneObject`). */
export interface FitTransform {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}
