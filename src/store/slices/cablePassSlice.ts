/**
 * @file src/store/slices/cablePassSlice.ts
 * @description Paso de cable en el store: pide al Worker el negativo pasante (largo medido con rayos para atravesar
 * la pared, o la profundidad a mano) y su informe, y lo agrega como UN paso de deshacer agrupado con su pieza
 * (`placeNegativeAddon`). Si la boca es más ancha que la cara no se coloca; la pared demasiado gruesa para medir, la
 * cercanía al borde y a otro agregado pendiente se avisan sin bloquear.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { CABLE_MIN_GAP_MM, type CablePassParams } from '../../core/addons/cablePass';
import type { CablePassReport } from '../../core/addons/cablePassAnalysis';
import { formatMm } from '../../core/addons/screwBossPresets';
import type { SceneObject, Vec3 } from '../../types/kura';
import { cablePassWarnings, cablePassWarningText } from '../cablePassWarnings';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { freeName, nearbyAddonObjects, placedMeshOf, placeNegativeAddon, type NegativeAddonBlock } from './negativeAddonPlace';

export interface CablePassRequest {
  hostId: string;
  params: CablePassParams;
  point: Vec3;
  normal: Vec3;
  silent?: boolean;
  /** Si viene, recibe el bloqueo (`spansFace`) en vez del aviso de error. */
  onBlocked?: (reason: NegativeAddonBlock) => void;
}

export interface CablePassPlaced {
  object: SceneObject;
  report: CablePassReport;
}

export interface CablePassSliceState {
  /** Agrega el paso; null si la pieza no sirve, no cabe, el motor estaba ocupado o falló (ya se avisó). */
  addCablePass: (request: CablePassRequest) => Promise<CablePassPlaced | null>;
}

export function createCablePassSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { get, tr } = ctx;
  return {
    addCablePass: async (request) => {
      const lang = get().language;
      const p = request.params;
      const size = p.shape === 'slot' ? `${formatMm(p.lengthMm, lang)} × ${formatMm(p.widthMm, lang)}` : `Ø ${formatMm(p.widthMm, lang)}`;
      const result = await placeNegativeAddon(ctx, {
        hostId: request.hostId,
        busyName: 'cable_pass',
        needSolidKey: 'cable.needSolid',
        tooWideKey: 'cable.error.tooWide',
        onBlocked: request.onBlocked,
        build: (host, taken) => ctx.runEngine('cablePass', {
          host: { id: host.id, ...placedMeshOf(host) },
          params: p, point: request.point, normal: request.normal,
          name: freeName(taken, tr('cable.objectName', { size })),
          nearbyAddons: nearbyAddonObjects(get().objects, host, CABLE_MIN_GAP_MM).map(placedMeshOf),
        }),
      });
      if (!result || request.silent) return result;
      get().addToast(tr('cable.created', { name: result.object.name }), 'success');
      for (const w of cablePassWarnings(result.report, get().language)) get().addToast(cablePassWarningText(w, get().language), 'info');
      return result;
    },
  };
}
