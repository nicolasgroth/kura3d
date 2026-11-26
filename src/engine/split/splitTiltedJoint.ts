/**
 * @file src/engine/split/splitTiltedJoint.ts
 * @description Uniones en planos a mano inclinados de "dividir para imprimir". La unión se arma en un marco
 * girado donde la cara del corte queda recta (la rotación lleva la normal del plano a su eje base): ahí corre
 * el mismo `buildJoint` de siempre (conectores, imanes, solape, marca de pareja, firmeza) y sus sólidos y
 * centros vuelven al mundo con la rotación inversa, así los conectores quedan perpendiculares a la cara
 * inclinada. Las uniones de una misma familia de planos paralelos comparten registro de conectores.
 *
 * Regla de armado (`tiltNeedsGlue`, `demoteCrossedTilts`): una espiga, pasador, cola de milano, tarugo o solape
 * en una cara inclinada solo entra moviendo la pieza a lo largo de la normal de ESA cara. Si una pieza tiene
 * además uniones con conector en caras de otra dirección (otro plano inclinado o recto que se cruza), no hay
 * una dirección de entrada que sirva para todas: esas uniones inclinadas pasan a "para pegar" con el aviso
 * `SPLIT_MANUAL_TILT_GLUED` (en el plan, antes: `SPLIT_MANUAL_TILT_GLUE`), en vez de dejar piezas que no arman. Los imanes no restringen la dirección (quedan al ras).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { engineWarning, type EngineWarning } from '../engineErrors';
import { contactSection, MIN_CONTACT_MM2, SectionCache, type Cell, type SplitBody } from './splitBodies';
import { buildJoint, type JointInput } from './splitJoints';
import { ConnectorRoom } from './splitConnectorRoom';
import { applyRot, mat4Of, rotationToAxis, transpose } from './splitManualCuts';
import { demoteToGlue, type PendingJoint } from './splitAssembly';
import { AXIS_INDEX } from './splitSections';
import type { SplitAxis, SplitConnectorOptions, SplitPlane } from './splitTypes';

type JointOutcome = Awaited<ReturnType<typeof buildJoint>>;

/** Coseno sobre el que dos normales se consideran paralelas. */
const PARALLEL_COS = 0.99995;

export const axisNormal = (axis: SplitAxis): Vec3 => {
  const n: Vec3 = [0, 0, 0];
  n[AXIS_INDEX[axis]] = 1;
  return n;
};
const parallel = (p: Vec3, q: Vec3) => Math.abs(p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) >= PARALLEL_COS;
/** Normal del plano (recto: su eje). */
export const planeNormal = (p: Pick<SplitPlane, 'axis' | 'normal'>): Vec3 => p.normal ?? axisNormal(p.axis);

/** Conector que obliga a entrar a lo largo de la normal (todo menos imanes). */
export const directionBound = (c: SplitConnectorOptions | null): boolean => Boolean(c) && c!.type !== 'magnet';

/** Aviso previo del plan: este plano inclinado se cruza con cortes de otra dirección y sus uniones irán para pegar. */
export function tiltNeedsGlue(plane: SplitPlane, planes: SplitPlane[], connector: SplitConnectorOptions | null): boolean {
  if (!plane.normal || !directionBound(connector)) return false;
  return planes.some((q) => q !== plane && !parallel(planeNormal(q), plane.normal!));
}

/** Registros de conectores por familia de planos paralelos (cada una en su propio marco girado). */
export class TiltRooms {
  private rooms: Array<{ normal: Vec3; room: ConnectorRoom }> = [];
  for(normal: Vec3): ConnectorRoom {
    let r = this.rooms.find((x) => parallel(x.normal, normal));
    if (!r) {
      r = { normal, room: new ConnectorRoom() };
      this.rooms.push(r);
    }
    return r.room;
  }
}

/** Datos de la unión como en `JointInput`, sin lo que depende del marco (contacto, caja, tramo, coordenada). */
export type TiltedJointInput = Omit<JointInput, 'contact' | 'bounds' | 'span' | 'coord' | 'room'>;

/**
 * Arma la unión de `low` y `high` sobre el plano inclinado `plane` (normal · x = offset). Devuelve `null` si no hay
 * contacto real; si no, el resultado de `buildJoint` en mundo y el área de contacto. Agrega a `low` y `high` sus
 * sólidos (ya en mundo) en el mismo orden que `buildJoint`, con la marca al final.
 */
export async function buildTiltedJoint(
  wasm: ManifoldToplevel, j: TiltedJointInput, plane: { normal: Vec3; offset: number }, rooms: TiltRooms, warnings: EngineWarning[],
): Promise<{ out: JointOutcome; area: number } | null> {
  const a = AXIS_INDEX[j.axis];
  const rot = rotationToAxis(plane.normal, j.axis);
  const back = mat4Of(transpose(rot));
  const lowM = j.low.m.transform(mat4Of(rot));
  const highM = j.high.m.transform(mat4Of(rot));
  const lowCell = [0, 0, 0] as Cell;
  const highCell = [0, 0, 0] as Cell;
  highCell[a] = 1;
  const tl: SplitBody = { id: -1, cell: lowCell, code: j.low.code, m: lowM, adds: [], subs: [], labels: [] };
  const th: SplitBody = { id: -2, cell: highCell, code: j.high.code, m: highM, adds: [], subs: [], labels: [] };
  const cache = new SectionCache(new Map([[-1, tl], [-2, th]]));
  const lb = lowM.boundingBox();
  const hb = highM.boundingBox();
  const bounds = [0, 1, 2].map((i) => (i === a ? [lb.min[i], plane.offset, hb.max[i]] : [Math.min(lb.min[i], hb.min[i]), Math.max(lb.max[i], hb.max[i])]));
  const contact = contactSection(cache, -1, -2, j.axis, plane.offset);
  const made: Manifold[] = [];
  try {
    const area = contact.area();
    if (area <= MIN_CONTACT_MM2) return null;
    const out = await buildJoint(wasm, {
      ...j, low: tl, high: th, coord: plane.offset, span: hb.max[a] - plane.offset, contact, bounds, room: rooms.for(plane.normal),
    }, warnings);
    const toWorld = (list: Manifold[]) => list.map((h) => {
      const w = h.transform(back);
      made.push(h);
      return w;
    });
    j.low.adds.push(...toWorld(tl.adds));
    j.low.subs.push(...toWorld(tl.subs));
    j.high.adds.push(...toWorld(th.adds));
    j.high.subs.push(...toWorld(th.subs));
    const inv = transpose(rot);
    return { out: { ...out, centers: out.centers.map((c) => applyRot(inv, c)) }, area };
  } finally {
    contact.delete();
    cache.dispose();
    for (const h of made) h.delete();
    lowM.delete();
    highM.delete();
  }
}

/**
 * Aplica la regla de armado de los planos inclinados: en cada pieza con uniones con conector (o solape) en caras de
 * direcciones distintas, las que están en caras inclinadas pasan a pegar. Devuelve la holgura que dejó de quitarse.
 */
export function demoteCrossedTilts(
  joints: Array<PendingJoint & { normal?: Vec3 }>, bodies: Map<number, SplitBody>, warnings: EngineWarning[],
): number {
  const bound = (j: PendingJoint) => j.kind !== 'glue' && directionBound(j.connector);
  const byBody = new Map<number, Array<PendingJoint & { normal?: Vec3 }>>();
  for (const j of joints) {
    if (!bound(j)) continue;
    for (const id of [j.low, j.high]) byBody.set(id, [...(byBody.get(id) ?? []), j]);
  }
  const demote = new Set<PendingJoint & { normal?: Vec3 }>();
  for (const list of byBody.values()) {
    if (!list.some((j) => j.normal)) continue;
    const n0 = list[0].normal ?? axisNormal(list[0].axis);
    if (list.every((j) => parallel(j.normal ?? axisNormal(j.axis), n0))) continue;
    for (const j of list) if (j.normal) demote.add(j);
  }
  let removed = 0;
  for (const j of demote) removed += demoteToGlue(j, bodies.get(j.low)!, bodies.get(j.high)!);
  if (demote.size > 0) {
    const pairs = [...demote].map((j) => `${bodies.get(j.low)!.code}–${bodies.get(j.high)!.code}`).join(', ');
    warnings.push(engineWarning('SPLIT_MANUAL_TILT_GLUED', { count: demote.size, pairs }));
  }
  return removed;
}
