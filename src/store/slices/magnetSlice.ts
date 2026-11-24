/**
 * @file src/store/slices/magnetSlice.ts
 * @description Alojamiento de imán en el store: pide al Worker el negativo orientado por la cara y la pared medida,
 * lo agrega como UN paso de deshacer (agrupado con su pieza, como el macho de una rosca) y avisa; si la pared queda
 * bajo el mínimo o el hueco atraviesa la pieza, lo dice (no bloquea). La resta llega con «Aplicar restas».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MIN_WALL_MM, type MagnetParams } from '../../core/addons/magnetPocket';
import { magnetSizeLabel } from '../../core/addons/magnetPresets';
import type { PocketWallReport } from '../../core/addons/pocketWall';
import { attachToTarget } from '../../core/scene/attachPiece';
import { isSolid } from '../../core/scene/objectRole';
import type { SceneObject, Vec3 } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export interface MagnetPocketRequest {
  hostId: string;
  params: MagnetParams;
  /** Punto de mundo sobre la cara y normal de mundo hacia afuera. */
  point: Vec3;
  normal: Vec3;
}

export interface MagnetSliceState {
  /** Agrega el negativo del alojamiento; null si la pieza no sirve, el motor estaba ocupado o falló (ya se avisó). */
  addMagnetPocket: (request: MagnetPocketRequest) => Promise<{ obj: SceneObject; wall: PocketWallReport } | null>;
}

/** El aviso de pared: null si está bien. */
export function wallWarningKey(wall: PocketWallReport): 'magnet.warn.through' | 'magnet.warn.wall' | null {
  if (wall.through) return 'magnet.warn.through';
  return wall.minWallMm < MIN_WALL_MM ? 'magnet.warn.wall' : null;
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
        const name = tr('magnet.objectName', { size: magnetSizeLabel(request.params, get().language) });
        const made = await ctx.runEngine('magnetPocket', { host, params: request.params, point: request.point, normal: request.normal, name });
        ctx.assertCurrent([host]);
        const obj = made.obj;
        pushHistory();
        set((s) => {
          const next = attachToTarget(s, obj, host.id);
          return { objects: next.objects, groups: next.groups, spawnedAtById: { ...s.spawnedAtById, [obj.id]: Date.now() } };
        });
        return made;
      });
      if (!result) return null;
      get().addToast(tr('magnet.created', { name: result.obj.name }), 'success');
      const warn = wallWarningKey(result.wall);
      if (warn) {
        const wall = result.wall.minWallMm.toLocaleString(get().language, { maximumFractionDigits: 1 });
        get().addToast(tr(warn, { wall, min: MIN_WALL_MM.toLocaleString(get().language) }), 'info');
      }
      return result;
    },
  };
}
