/**
 * @file src/engine/fitCheck/cutJoint.ts
 * @description «Unión del corte» de Comprobar encaje: dos piezas que salen del mismo corte de Dividir, son
 * pareja (cada una nombra a la otra en sus uniones) y están en posición de armado se tocan a propósito por su
 * cara de corte y por sus conectores; no son un problema de holgura. Usa solo los metadatos que Dividir ya
 * guarda de cada pieza (`metadata.split`). La posición de armado se mide en relación con el grupo: si todo el
 * conjunto se movió junto, el desfase de cada pieza respecto de su posición de armado es el mismo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject, Vec3 } from '../../types/kura';

/** Lo que Comprobar encaje recuerda de una pieza de Dividir. */
export interface CutPartInfo {
  groupId: string;
  code: string;
  /** Códigos de las piezas con las que se une. */
  partners: ReadonlySet<string>;
  /** Posición y rotación actuales menos las de armado. */
  positionOffset: Vec3;
  rotationOffset: Vec3;
}

/** Desfase máximo (mm) entre dos piezas para considerarlas en su sitio de armado. */
export const CUT_JOINT_POSITION_TOLERANCE_MM = 0.5;
/** Desfase máximo (rad) de rotación. */
export const CUT_JOINT_ROTATION_TOLERANCE_RAD = 0.02;
/** Un cruce más hondo que esto (mm) es un choque real aunque las piezas sean pareja. */
export const CUT_JOINT_MAX_OVERLAP_MM = 0.05;

export function cutPartInfoOf(obj: Pick<SceneObject, 'position' | 'rotation' | 'metadata'>): CutPartInfo | undefined {
  const split = obj.metadata?.split;
  if (!split?.assembly || !split.groupId) return undefined;
  const partners = new Set<string>(split.jointPartners?.map((p) => p.code) ?? []);
  for (const j of split.joints ?? []) {
    if (j.a === split.code) partners.add(j.b);
    if (j.b === split.code) partners.add(j.a);
  }
  const diff = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return {
    groupId: split.groupId,
    code: split.code,
    partners,
    positionOffset: diff(obj.position, split.assembly.position),
    rotationOffset: diff(obj.rotation, split.assembly.rotation),
  };
}

/** Pareja del mismo corte y en posición de armado (ambas, entre sí). */
export function areCutJointPartners(a: CutPartInfo | undefined, b: CutPartInfo | undefined): boolean {
  if (!a || !b || a.groupId !== b.groupId || a.code === b.code) return false;
  if (!a.partners.has(b.code) && !b.partners.has(a.code)) return false;
  const dist = Math.hypot(...a.positionOffset.map((v, i) => v - b.positionOffset[i]));
  const turn = Math.max(...a.rotationOffset.map((v, i) => Math.abs(v - b.rotationOffset[i])));
  return dist <= CUT_JOINT_POSITION_TOLERANCE_MM && turn <= CUT_JOINT_ROTATION_TOLERANCE_RAD;
}
