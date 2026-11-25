/**
 * @file src/store/slices/screwBossSlice.ts
 * @description Torreta para tornillo en el store: pide al Worker el poste y el agujero orientados por la cara y su
 * informe, y los agrega como UN paso de deshacer, agrupados con su pieza (como el imán). El poste es un sólido que
 * se une a la pieza al aplicar las restas; el agujero, un negativo que se resta del poste y de la pieza. Si el pie
 * del poste es más ancho que la zona de apoyo, no se coloca; el resto de los problemas (pared, agujero que atraviesa,
 * choque) se avisan sin bloquear. Al Worker viaja solo la malla y la transformación de la pieza y de los agregados
 * cercanos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AddonBlockReason } from '../../core/addons/addonBlock';
import { screwBossNames } from '../../core/addons/addonNames';
import { nearbyAddons, placedMeshOf as placed } from '../../core/addons/addonNeighbors';
import type { ScrewBossParams } from '../../core/addons/screwBoss';
import type { ScrewBossReport } from '../../core/addons/screwBossAnalysis';
import { attachToTarget } from '../../core/scene/attachPiece';
import { isSolid } from '../../core/scene/objectRole';
import type { SceneObject, Vec3 } from '../../types/kura';
import { screwBossWarnings, screwBossWarningText } from '../screwBossWarnings';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export interface ScrewBossRequest {
  hostId: string;
  params: ScrewBossParams;
  /** Punto de mundo sobre la cara y normal de mundo hacia afuera. */
  point: Vec3;
  normal: Vec3;
  /** No emite avisos de «agregada» ni de advertencias: quien llama publica el suyo (los errores sí se avisan). */
  silent?: boolean;
  /** Si la torreta no se puede colocar (más ancha que la zona), se llama en vez de mostrar el error (Command Bus). */
  onBlocked?: (reason: AddonBlockReason) => void;
}

export interface ScrewBossPlaced {
  post: SceneObject;
  hole: SceneObject;
  report: ScrewBossReport;
}

export interface ScrewBossSliceState {
  /** Agrega poste y agujero; null si la pieza no sirve, no cabe, el motor estaba ocupado o falló (ya se avisó). */
  addScrewBoss: (request: ScrewBossRequest) => Promise<ScrewBossPlaced | null>;
}

export { nearbyAddons } from '../../core/addons/addonNeighbors';

export function createScrewBossSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive } = ctx;
  return {
    addScrewBoss: async (request) => {
      const host = get().objects.find((o) => o.id === request.hostId);
      if (!host || !isSolid(host) || host.locked) {
        get().addToast(tr('turret.needSolid'), 'error');
        return null;
      }
      const result = await runExclusive('screw_boss', null, async () => {
        await get().initEngine();
        const names = screwBossNames(request.params, get().language, new Set(get().objects.map((o) => o.name)));
        const made = await ctx.runEngine('screwBoss', {
          host: { id: host.id, color: host.color, ...placed(host) },
          params: request.params, point: request.point, normal: request.normal, names,
          nearbyAddons: nearbyAddons(get().objects, host).map(placed),
        });
        ctx.assertCurrent([host]);
        if (made.spansFace) {
          if (request.onBlocked) request.onBlocked('tooWide');
          else get().addToast(tr('turret.error.tooWide'), 'error');
          return null;
        }
        const { post, hole } = made;
        pushHistory();
        set((s) => {
          const withPost = attachToTarget(s, post, host.id);
          const next = attachToTarget({ objects: withPost.objects, groups: withPost.groups }, hole, host.id);
          const now = Date.now();
          return { objects: next.objects, groups: next.groups, spawnedAtById: { ...s.spawnedAtById, [post.id]: now, [hole.id]: now } };
        });
        return { post, hole, report: made.report };
      });
      if (!result) return null;
      if (request.silent) return result;
      get().addToast(tr('turret.created', { name: result.post.name }), 'success');
      for (const w of screwBossWarnings(result.report, get().language)) get().addToast(screwBossWarningText(w, get().language), 'info');
      return result;
    },
  };
}
