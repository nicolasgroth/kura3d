/**
 * @file src/store/slices/fitToBedSlice.ts
 * @description "Ajustar a la impresora": abre el diálogo con los objetos a ajustar (como bloque),
 * analiza las alternativas en el Worker sin tomar el bloqueo, guarda la vista previa (fantasma) de la
 * alternativa elegida y aplica la elegida como UN paso de deshacer. Nada se aplica solo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { plateFrameFor, shiftChangeXZ } from '../../core/scene/plateFrame';
import type { PlateBedSource } from '../../core/scene/activePlateBed';
import type { FitAlternative, FitAlternativeKind, FitBed, FitTransform } from '../../engine/fitToBed';
import { fitBedOf, type FitAnalysisResult } from '../../core/operations/fitOperations';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import type { SceneObject } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export interface FitToBedSliceState {
  /** Objetos del diálogo abierto (null = cerrado). */
  fitToBedIds: string[] | null;
  /** Transformaciones de la alternativa elegida para el fantasma del visor. */
  fitPreview: Record<string, FitTransform> | null;
  openFitToBed: (ids?: string[]) => boolean;
  closeFitToBed: () => void;
  setFitPreview: (preview: Record<string, FitTransform> | null) => void;
  /** Analiza sin cambiar la escena; null si no hay objetos válidos (el error ya se avisó). */
  analyzeFitToBed: (ids: string[], bed?: FitBed) => Promise<FitAnalysisResult | null>;
  /** Aplica una alternativa (no `split`) en un paso de deshacer. */
  applyFitToBed: (ids: string[], kind: FitAlternativeKind, bed?: FitBed) => Promise<{ analysis: FitAnalysisResult; applied: FitAlternative } | null>;
}

/** Cama activa (perfil o medidas propias) con su margen. */
export function activeFitBed(
  s: PlateBedSource,
  targets?: ReadonlyArray<Pick<SceneObject, 'plateRef'>>,
): FitBed {
  if (!s.plates?.length) return fitBedOf(s.printerProfile, s.customBedDimensions);
  // Con placas, la cama es la de la placa de las piezas (o la activa).
  const { bed } = plateFrameFor(s, targets);
  // El margen de una cama propia (otra impresora) manda sobre el del perfil del proyecto.
  return fitBedOf(s.printerProfile, { width: bed.widthMm, depth: bed.depthMm, height: bed.heightMm }, bed.marginMm);
}

/** Objetos ajustables: existentes, desbloqueados y con malla (los negativos viajan con el bloque). */
export function fitTargets(objects: readonly SceneObject[], ids: readonly string[]): SceneObject[] {
  const set = new Set(ids);
  return objects.filter((o) => set.has(o.id) && !o.locked && o.mesh.positions.length >= 9);
}

export function createFitToBedSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, runExclusive, runEngine, runEngineDetached, assertCurrent, commitChange, reportOperationError } = ctx;
  return {
    fitToBedIds: null,
    fitPreview: null,
    openFitToBed: (ids) => {
      const targets = fitTargets(get().objects, ids ?? get().selectedIds);
      if (targets.length === 0) {
        get().addToast(tr('fit.noTargets'), 'info');
        return false;
      }
      set({ fitToBedIds: targets.map((o) => o.id), fitPreview: null, commandPaletteOpen: false });
      return true;
    },
    closeFitToBed: () => set({ fitToBedIds: null, fitPreview: null }),
    setFitPreview: (fitPreview) => set({ fitPreview }),
    analyzeFitToBed: async (ids, bed) => {
      const targets = fitTargets(get().objects, ids);
      if (targets.length === 0) return null;
      try {
        await get().initEngine();
        const { analysis } = await runEngineDetached('fitToBed', { objects: targets, bed: bed ?? activeFitBed(get(), targets) });
        return analysis;
      } catch (err) {
        reportOperationError(err);
        return null;
      }
    },
    applyFitToBed: async (ids, kind, bed) => {
      const targets = fitTargets(get().objects, ids);
      if (targets.length === 0) {
        get().addToast(tr('fit.noTargets'), 'info');
        return null;
      }
      return runExclusive('fit_to_bed', null, async () => {
        await get().initEngine();
        const { analysis, change, applied } = await runEngine('fitToBed', { objects: targets, bed: bed ?? activeFitBed(get(), targets), apply: kind });
        assertCurrent(targets);
        if (!change || !applied) return null;
        // Con placas, el bloque queda centrado en la placa de las piezas (sin placas: el origen, como siempre).
        const placed = shiftChangeXZ(change, plateFrameFor(get(), targets).origin);
        commitChange(placed, { select: targets.map((o) => o.id), extra: { fitPreview: null } });
        const pct = formatLocaleNumber(get().language, applied.factor * 100, { maxFrac: 1 });
        const summary = kind === 'rotate' ? tr('fit.alt.rotate') : tr(kind === 'scale' ? 'fit.alt.scale' : 'fit.alt.rotateScale', { pct });
        get().addToast(tr('fit.applied', { summary }), 'success');
        get().requestCameraPreset('ensure', targets.map((o) => o.id));
        return { analysis, applied };
      });
    },
  };
}
