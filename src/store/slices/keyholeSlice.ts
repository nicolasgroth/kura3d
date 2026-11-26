/**
 * @file src/store/slices/keyholeSlice.ts
 * @description Ojo de cerradura en el store: pide al Worker el negativo orientado por la cara (ranura hacia el
 * «arriba» de la pieza) y su informe, y lo agrega como UN paso de deshacer agrupado con su pieza
 * (`placeNegativeAddon`). Si la figura es más ancha que la cara, o el labio que queda no retiene la cabeza, no se coloca; la pared detrás de la cámara, el borde,
 * la cara no vertical y la diferencia de altura con otros ojos de la misma cara se avisan sin bloquear.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { keyholeLevelOffsetMm, type KeyholeParams } from '../../core/addons/keyhole';
import type { KeyholeReport } from '../../core/addons/keyholeAnalysis';
import { formatMm } from '../../core/addons/screwBossPresets';
import type { SceneObject, Vec3 } from '../../types/kura';
import { keyholeWarnings, keyholeWarningText } from '../keyholeWarnings';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { freeName, placedMeshOf, placeNegativeAddon, type NegativeAddonBlock } from './negativeAddonPlace';

export interface KeyholeRequest {
  hostId: string;
  params: KeyholeParams;
  /** Punto de mundo sobre la cara y normal de mundo hacia afuera. */
  point: Vec3;
  normal: Vec3;
  /** No emite avisos de «agregado» ni de advertencias: quien llama publica el suyo (los errores sí se avisan). */
  silent?: boolean;
  /** Si viene, recibe el bloqueo (`spansFace`, `notRetained`) en vez del aviso de error. */
  onBlocked?: (reason: NegativeAddonBlock) => void;
}

export interface KeyholePlaced {
  object: SceneObject;
  report: KeyholeReport;
}

export interface KeyholeSliceState {
  /** Agrega el ojo; null si la pieza no sirve, no cabe, el motor estaba ocupado o falló (ya se avisó). */
  addKeyhole: (request: KeyholeRequest) => Promise<KeyholePlaced | null>;
}

export function createKeyholeSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { get, tr } = ctx;
  return {
    addKeyhole: async (request) => {
      const placed = await placeNegativeAddon(ctx, {
        hostId: request.hostId,
        busyName: 'keyhole',
        needSolidKey: 'keyhole.needSolid',
        tooWideKey: 'keyhole.error.tooWide',
        notRetainedKey: 'keyhole.error.notRetained',
        onBlocked: request.onBlocked,
        build: (host, taken) => ctx.runEngine('keyhole', {
          host: { id: host.id, ...placedMeshOf(host) },
          params: request.params, point: request.point, normal: request.normal,
          name: freeName(taken, tr('keyhole.objectName', { size: formatMm(request.params.screwMm, get().language) })),
        }),
      });
      if (!placed) return null;
      // Con otros ojos en la misma cara: ¿cuelgan a la misma altura?
      const report: KeyholeReport = { ...placed.report, levelOffsetMm: keyholeLevelOffsetMm(get().objects, placed.object) };
      const result = { object: placed.object, report };
      if (request.silent) return result;
      get().addToast(tr('keyhole.created', { name: result.object.name }), 'success');
      for (const w of keyholeWarnings(report, get().language)) get().addToast(keyholeWarningText(w, get().language), 'info');
      return result;
    },
  };
}
