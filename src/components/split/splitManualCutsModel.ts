/**
 * @file src/components/split/splitManualCutsModel.ts
 * @description Modelo de la lista de cortes a mano del panel "Dividir para imprimir" (funciones puras, en ejes del
 * usuario): agregar (en el centro del modelo, en el eje más largo), quitar, duplicar (desplazado un 10 % del tramo),
 * cambiar eje, posición o ángulos (acotados al modelo y a ±`SPLIT_MANUAL_MAX_TILT_DEG`), partir desde los planos de
 * la rejilla automática y pasar la lista a los cortes del motor (`BedSplitPlanOptions.manualCuts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { BedSplitPlan, SplitManualCut } from '../../engine';
import { SPLIT_MANUAL_MAX_CUTS, SPLIT_MANUAL_MAX_TILT_DEG } from '../../engine/split/splitManualCuts';
import { toUserBox, type AxisName } from '../../core/scene/displayAxes';
import { internalCutToUser, userCutToInternal, type UserManualCut } from '../../core/scene/splitManualCutAxes';
import { poseBounds } from '../../core/scene/plateArrange';
import type { SceneObject, Vec3 } from '../../types/kura';

export type ManualCut = UserManualCut & { id: string };
/** Caja del modelo en ejes del usuario. */
export type UserBox = { min: Vec3; max: Vec3 };

const INDEX: Record<AxisName, number> = { x: 0, y: 1, z: 2 };
let seq = 0;
export const newCutId = (): string => `cut-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Caja del plan en ejes del usuario. */
export const userBoxOfPlan = (plan: Pick<BedSplitPlan, 'bounds'>): UserBox => toUserBox(plan.bounds);

/** Caja en mundo del objeto (vértices transformados) en ejes del usuario; null sin geometría. */
export function userBoxOfObject(obj: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>): UserBox | null {
  const b = poseBounds(obj.mesh, obj.position, obj.rotation, obj.scale);
  return b ? toUserBox({ min: [b.minX, b.minY, b.minZ], max: [b.maxX, b.maxY, b.maxZ] }) : null;
}

/** Rango de posición de un eje (estrictamente dentro del modelo: 0,1 mm de margen). */
export function positionRange(box: UserBox, axis: AxisName): { min: number; max: number } {
  const a = INDEX[axis];
  return { min: Math.round((box.min[a] + 0.1) * 10) / 10, max: Math.round((box.max[a] - 0.1) * 10) / 10 };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const center = (box: UserBox, axis: AxisName) => Math.round(((box.min[INDEX[axis]] + box.max[INDEX[axis]]) / 2) * 10) / 10;

/** Agrega un plano recto en el centro, en el eje más largo del modelo (o en `axis`). */
export function addCut(cuts: ManualCut[], box: UserBox, axis?: AxisName): ManualCut[] {
  if (cuts.length >= SPLIT_MANUAL_MAX_CUTS) return cuts;
  const size = [0, 1, 2].map((i) => box.max[i] - box.min[i]);
  const longest = (['x', 'y', 'z'] as AxisName[])[size.indexOf(Math.max(...size))];
  const a = axis ?? longest;
  return [...cuts, { id: newCutId(), axis: a, positionMm: center(box, a), tiltDeg: [0, 0] }];
}

export const removeCut = (cuts: ManualCut[], id: string): ManualCut[] => cuts.filter((c) => c.id !== id);

/** Copia del plano, desplazada un 10 % del largo del modelo en su eje (dentro del modelo), justo debajo del original. */
export function duplicateCut(cuts: ManualCut[], id: string, box: UserBox): ManualCut[] {
  const i = cuts.findIndex((c) => c.id === id);
  if (i < 0 || cuts.length >= SPLIT_MANUAL_MAX_CUTS) return cuts;
  const c = cuts[i];
  const r = positionRange(box, c.axis);
  const step = (r.max - r.min) * 0.1;
  const pos = c.positionMm + step <= r.max ? c.positionMm + step : c.positionMm - step;
  const copy: ManualCut = { ...c, id: newCutId(), positionMm: Math.round(clamp(pos, r.min, r.max) * 10) / 10, tiltDeg: [...c.tiltDeg] };
  return [...cuts.slice(0, i + 1), copy, ...cuts.slice(i + 1)];
}

/** Cambia campos de un plano: al cambiar de eje vuelve al centro de ese eje; posición y ángulos se acotan. */
export function updateCut(cuts: ManualCut[], id: string, patch: Partial<Omit<ManualCut, 'id'>>, box: UserBox): ManualCut[] {
  return cuts.map((c) => {
    if (c.id !== id) return c;
    const axis = patch.axis ?? c.axis;
    const r = positionRange(box, axis);
    const pos = patch.axis && patch.axis !== c.axis && patch.positionMm === undefined ? center(box, axis) : (patch.positionMm ?? c.positionMm);
    const tilt = (patch.tiltDeg ?? c.tiltDeg).map((v) => clamp(v, -SPLIT_MANUAL_MAX_TILT_DEG, SPLIT_MANUAL_MAX_TILT_DEG)) as [number, number];
    return { ...c, axis, positionMm: clamp(pos, r.min, r.max), tiltDeg: tilt };
  });
}

/** Lista a mano a partir de los planos de un plan (p. ej. la rejilla automática), en ejes del usuario. */
export function cutsFromPlan(plan: Pick<BedSplitPlan, 'planes'>): ManualCut[] {
  return plan.planes.slice(0, SPLIT_MANUAL_MAX_CUTS).map((p) => ({
    ...internalCutToUser({ axis: p.axis, positionMm: Math.round(p.position * 10) / 10, tiltDeg: p.tiltDeg }),
    id: p.cutId ?? newCutId(),
  }));
}

/** Cortes del motor (`manualCuts`) con su id, para que el plan devuelva `SplitPlane.cutId`. */
export const engineCuts = (cuts: ManualCut[]): SplitManualCut[] => cuts.map((c) => ({ ...userCutToInternal(c), id: c.id }));
