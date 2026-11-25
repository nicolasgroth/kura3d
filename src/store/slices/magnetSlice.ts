/**
 * @file src/store/slices/magnetSlice.ts
 * @description Alojamiento de imán en el store: pide al Worker el negativo orientado por la cara y su informe (pared,
 * curvatura, huecos vecinos), lo agrega como UN paso de deshacer (agrupado con su pieza, como el macho de una rosca)
 * y avisa; si la pared queda bajo el mínimo, el hueco atraviesa, el imán sobresale o queda pegado a otro hueco, lo
 * dice (no bloquea). Un imán que ocuparía casi toda la pieza (la resta la eliminaría) no se coloca. Al Worker viaja solo la malla y la transformación de la pieza y de los negativos cercanos.
 * La resta llega con «Aplicar restas».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { magnetPocketName } from '../../core/addons/addonNames';
import { nearbyNegatives, placedMeshOf as placed } from '../../core/addons/addonNeighbors';
import type { MagnetParams } from '../../core/addons/magnetPocket';
import { magnetBlockReason, type AddonBlockReason } from '../../core/addons/addonBlock';
import type { PocketWallReport } from '../../core/addons/pocketWall';
import { attachToTarget } from '../../core/scene/attachPiece';
import { isSolid } from '../../core/scene/objectRole';
import type { SceneObject, Vec3 } from '../../types/kura';
import { magnetWarnings, magnetWarningText } from '../magnetWarnings';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export { wallWarningKey } from '../magnetWarnings';
export { nearbyNegatives } from '../../core/addons/addonNeighbors';

export interface MagnetPocketRequest {
  hostId: string;
  params: MagnetParams;
  /** Punto de mundo sobre la cara y normal de mundo hacia afuera. */
  point: Vec3;
  normal: Vec3;
  /** No emite avisos de «agregado» ni de advertencias: quien llama publica el suyo (los errores sí se avisan). */
  silent?: boolean;
  /** Si el hueco no se puede colocar (ocuparía casi toda la pieza), se llama en vez de mostrar el error (Command Bus). */
  onBlocked?: (reason: AddonBlockReason) => void;
}

export interface MagnetSliceState {
  /** Agrega el negativo del alojamiento; null si la pieza no sirve, el motor estaba ocupado o falló (ya se avisó). */
  addMagnetPocket: (request: MagnetPocketRequest) => Promise<{ obj: SceneObject; wall: PocketWallReport; fill: number; spansFace: boolean } | null>;
}

export function createMagnetSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive } = ctx;
  return {
    addMagnetPocket: async (request) => {
      const host = get().objects.find((o) => o.id === request.hostId);
      if (!host || !isSolid(host) || host.locked) {
        get().addToast(tr('magnet.needSolid'), 'error');
        return null;
      }
      const result = await runExclusive('magnet_pocket', null, async () => {
        await get().initEngine();
        // Los repetidos se numeran («Imán 5 × 2», «Imán 5 × 2 (2)»…) con el menor número libre, para distinguirlos en el árbol.
        const name = magnetPocketName(request.params, get().language, new Set(get().objects.map((o) => o.name)));
        const pendingNegatives = nearbyNegatives(get().objects, host).map(placed);
        const made = await ctx.runEngine('magnetPocket', {
          host: { id: host.id, ...placed(host) }, params: request.params, point: request.point, normal: request.normal, name, pendingNegatives,
        });
        ctx.assertCurrent([host]);
        // Un hueco que ocupa casi toda la pieza la haría desaparecer al restar: no se coloca.
        const blocked = magnetBlockReason(made);
        if (blocked) {
          if (request.onBlocked) request.onBlocked(blocked);
          else get().addToast(tr('magnet.error.tooBig'), 'error');
          return null;
        }
        const obj = made.obj;
        pushHistory();
        set((s) => {
          const next = attachToTarget(s, obj, host.id);
          return { objects: next.objects, groups: next.groups, spawnedAtById: { ...s.spawnedAtById, [obj.id]: Date.now() } };
        });
        return made;
      });
      if (!result) return null;
      if (request.silent) return result;
      get().addToast(tr('magnet.created', { name: result.obj.name }), 'success');
      for (const w of magnetWarnings(result.wall, get().language)) get().addToast(magnetWarningText(w, get().language), 'info');
      return result;
    },
  };
}
