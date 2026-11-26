/**
 * @file src/core/operations/fitOperations.ts
 * @description "Ajustar a la impresora" como operación pura (app, Worker y MCP sin interfaz): analiza
 * el bloque de objetos contra una cama, suma el chequeo de medidas funcionales y, al aplicar una
 * alternativa, devuelve un `SceneChange` de parches de transformación (un solo paso de deshacer).
 * Dividir no se aplica aquí: deriva a Dividir para imprimir con la misma cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import {
  analyzeFitToBed, planFitTransforms, FIT_DEFAULTS,
  type FitAlternative, type FitAlternativeKind, type FitBed, type FitToBedAnalysis, type FitToBedOptions, type FunctionalFeature,
} from '../../engine/fitToBed';
import { EngineError } from '../../engine/engineErrors';
import type { PrinterProfile, SceneObject } from '../../types/kura';
import { detectFunctionalFeatures, functionalWarnings } from '../scene/fitFunctional';
import { change, type SceneChange } from './operationTypes';

export interface FitAnalysisResult extends FitToBedAnalysis {
  bed: FitBed;
  objectIds: string[];
  functional: FunctionalFeature[];
}

/** Cama de un perfil (o de medidas propias) con su margen; por defecto 5 mm por lado. */
export function fitBedOf(
  profile: Pick<PrinterProfile, 'bedWidthMm' | 'bedDepthMm' | 'maxHeightMm'> & { marginMm?: number },
  custom?: { width: number; depth: number; height: number } | null,
  marginMm?: number,
): FitBed {
  return {
    widthMm: custom?.width ?? profile.bedWidthMm,
    depthMm: custom?.depth ?? profile.bedDepthMm,
    heightMm: custom?.height ?? profile.maxHeightMm,
    marginMm: marginMm ?? profile.marginMm ?? FIT_DEFAULTS.marginMm,
  };
}

/** Analiza `targets` como un bloque. Lanza `MESH_EMPTY` si no hay geometría. */
export function analyzeFit(targets: readonly SceneObject[], bed: FitBed, options: FitToBedOptions = {}): FitAnalysisResult {
  const analysis = analyzeFitToBed(targets, bed, options);
  const functional = detectFunctionalFeatures(targets);
  for (const alt of analysis.alternatives) {
    if (alt.available) alt.warnings.push(...functionalWarnings(functional, alt.factor));
  }
  return { ...analysis, bed, objectIds: targets.map((o) => o.id), functional };
}

/** Alternativa aplicable (no `split`) de un análisis, o error tipado si no está disponible. */
export function pickFitAlternative(analysis: FitToBedAnalysis, kind: FitAlternativeKind): FitAlternative {
  const alt = analysis.alternatives.find((a) => a.kind === kind);
  if (!alt || !alt.available || kind === 'split') {
    throw new EngineError('FIT_ALTERNATIVE_UNAVAILABLE', { alternative: kind, reason: kind === 'split' ? 'useSplit' : (alt?.reason ?? 'unknown') });
  }
  return alt;
}

/** Parches de posición, rotación y escala que aplican la alternativa elegida. */
export function fitToBedChange(targets: readonly SceneObject[], alt: Pick<FitAlternative, 'factor' | 'orientation'>): SceneChange {
  const transforms = planFitTransforms(targets, { orientationIndex: alt.orientation.index, factor: alt.factor });
  const patches = targets.map((o) => ({ id: o.id, patch: { ...transforms[o.id] } as Partial<SceneObject> }));
  return change({ patches });
}

export interface FitToBedTaskArgs {
  objects: SceneObject[];
  bed: FitBed;
  options?: FitToBedOptions;
  /** Alternativa a aplicar; sin ella solo analiza. */
  apply?: FitAlternativeKind;
}

/** Tarea del motor: analiza y, si se pide, calcula el cambio de la alternativa elegida. */
export function runFitToBed(a: FitToBedTaskArgs): { analysis: FitAnalysisResult; change: SceneChange | null; applied: FitAlternative | null } {
  const analysis = analyzeFit(a.objects, a.bed, a.options);
  if (!a.apply) return { analysis, change: null, applied: null };
  const applied = pickFitAlternative(analysis, a.apply);
  return { analysis, change: fitToBedChange(a.objects, applied), applied };
}
