/**
 * @file src/store/slices/negativeAddonPlace.ts
 * @description Colocación común de un agregado de una sola pieza negativa (ojo de cerradura, paso de cable): exige
 * una pieza sólida visible y sin bloquear, corre la tarea del Worker en exclusiva (solo viaja la malla y la
 * transformación de la pieza y, si hace falta, de los agregados cercanos), descarta el resultado si la escena cambió,
 * no coloca si la figura es más ancha que la cara (o, en el ojo, si el labio no retiene la cabeza) y agrega el negativo agrupado con su pieza en UN paso de deshacer.
 * También el nombre libre y la forma mínima de una pieza para el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PlacedMesh } from '../../core/operations/magnetOperations';
import { attachToTarget } from '../../core/scene/attachPiece';
import { isSolid } from '../../core/scene/objectRole';
import type { TranslationKey } from '../../i18n';
import type { SceneObject } from '../../types/kura';
import type { StoreContext } from '../storeContext';

/** El menor nombre libre: «base», «base (2)», «base (3)»… */
export function freeName(taken: ReadonlySet<string>, base: string): string {
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base} (${n})`;
  return name;
}

/** Malla y transformación de una pieza: lo único que viaja al Worker. */
export const placedMeshOf = (o: SceneObject): PlacedMesh => ({
  mesh: { positions: o.mesh.positions, indices: o.mesh.indices }, position: o.position, rotation: o.rotation, scale: o.scale,
});

const reachOf = (o: SceneObject) => Math.hypot(...o.stats.dimensionsMm) * Math.max(...o.scale.map(Math.abs));

/** Agregados pendientes (de cualquier tipo) cerca de la pieza: con ellos se mide la distancia mínima. */
export function nearbyAddonObjects(objects: readonly SceneObject[], host: SceneObject, marginMm: number): SceneObject[] {
  const hr = reachOf(host);
  return objects.filter((o) => {
    if (o.id === host.id || !o.metadata?.addon) return false;
    const d = Math.hypot(o.position[0] - host.position[0], o.position[1] - host.position[1], o.position[2] - host.position[2]);
    return d <= hr + reachOf(o) + marginMm;
  });
}

export interface NegativeAddonMade<R> {
  object: SceneObject;
  report: R;
  spansFace: boolean;
  /** Ojo de cerradura: el labio no retiene la cabeza (no se coloca). */
  notRetained?: boolean;
}

/** Bloqueos de un negativo de una pieza: más ancho que la cara, o (ojo) sin labio que retenga. */
export type NegativeAddonBlock = 'spansFace' | 'notRetained';

export interface NegativeAddonPlaceOptions<R> {
  hostId: string;
  /** Nombre de la operación en curso (barra de estado y exclusión). */
  busyName: string;
  needSolidKey: TranslationKey;
  tooWideKey: TranslationKey;
  /** Texto del bloqueo `notRetained` (solo el ojo de cerradura lo produce). */
  notRetainedKey?: TranslationKey;
  /** Si viene, recibe el bloqueo en vez del aviso (el Command Bus lo devuelve como error tipado). */
  onBlocked?: (reason: NegativeAddonBlock) => void;
  /** Construye el negativo en el Worker; recibe la pieza y los nombres ya usados. */
  build: (host: SceneObject, taken: ReadonlySet<string>) => Promise<NegativeAddonMade<R>>;
}

/** Coloca el negativo; null si la pieza no sirve, no cabe, el motor estaba ocupado o falló (ya se avisó). */
export async function placeNegativeAddon<R>(ctx: StoreContext, options: NegativeAddonPlaceOptions<R>): Promise<{ object: SceneObject; report: R } | null> {
  const { set, get, tr, pushHistory, runExclusive } = ctx;
  const host = get().objects.find((o) => o.id === options.hostId);
  if (!host || !isSolid(host) || host.locked || !host.visible) {
    get().addToast(tr(options.needSolidKey), 'error');
    return null;
  }
  return runExclusive(options.busyName, null, async () => {
    await get().initEngine();
    const made = await options.build(host, new Set(get().objects.map((o) => o.name)));
    ctx.assertCurrent([host]);
    const blocked: NegativeAddonBlock | null = made.spansFace ? 'spansFace' : made.notRetained ? 'notRetained' : null;
    if (blocked) {
      if (options.onBlocked) options.onBlocked(blocked);
      else get().addToast(tr(blocked === 'spansFace' ? options.tooWideKey : (options.notRetainedKey ?? options.tooWideKey)), 'error');
      return null;
    }
    pushHistory();
    set((s) => {
      const next = attachToTarget(s, made.object, host.id);
      return { objects: next.objects, groups: next.groups, spawnedAtById: { ...s.spawnedAtById, [made.object.id]: Date.now() } };
    });
    return { object: made.object, report: made.report };
  });
}
