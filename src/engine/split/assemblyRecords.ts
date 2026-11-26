/**
 * @file src/engine/split/assemblyRecords.ts
 * @description Revalidar el armado de un grupo dividido ya guardado: cada pieza lleva en
 * `metadata.split.joints` sus uniones (`SplitJointRecord`, de `jointRecord`) y su transformación de
 * armado; `validateStoredAssembly` reúne las piezas pedidas (todas del mismo grupo), toma las uniones
 * cuyas dos piezas están en la selección y corre `validateAssembly` (solo lectura, sin `autoFix`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject, SplitJointRecord, Vec3 } from '../../types/kura';
import type { AssemblyJointInput, AssemblyPartInput, AssemblyReport } from './assemblyTypes';
import type { SplitJoint } from './splitTypes';
import { summarizeAssembly, validateAssembly } from './validateAssembly';

/** Unión del motor → registro guardable en el proyecto (piezas por código). */
export function jointRecord(j: SplitJoint): SplitJointRecord {
  // Las marcas de pedido (`sizeAuto`, `countAuto`) no se guardan: el conector aplicado lleva lo real
  const { sizeAuto: _s, countAuto: _c, magnet, ...connector } = j.connector ?? ({} as NonNullable<SplitJoint['connector']>);
  return {
    label: j.label, axis: j.axis, position: j.position, a: j.a.code, b: j.b.code, kind: j.kind,
    connector: j.connector ? { ...connector, ...(magnet ? { magnet: { ...magnet } } : {}) } : null,
    connectorCenters: j.connectorCenters.map((c) => [c[0], c[1], c[2]]), contactAreaMm2: j.contactAreaMm2,
    labelPlacement: j.labelPlacement,
    ...(j.normal ? { normal: [j.normal[0], j.normal[1], j.normal[2]] as Vec3 } : {}),
    ...(j.strength ? { strength: structuredClone(j.strength) } : {}),
    ...(j.magnets ? { magnets: { ...j.magnets, magnet: { ...j.magnets.magnet } } } : {}),
  };
}

/** Motivo por el que no se puede revalidar (códigos estables para el bus y el MCP). */
export type StoredAssemblyError = 'NOT_SPLIT_PART' | 'MIXED_GROUPS' | 'NO_JOINT_DATA';

export class StoredAssemblyInputError extends Error {
  constructor(public readonly reason: StoredAssemblyError) {
    super(reason);
    this.name = 'StoredAssemblyInputError';
  }
}

/** Piezas y uniones de entrada para `validateAssembly` a partir de objetos de escena divididos. */
export function storedAssemblyInput(objects: SceneObject[]): { parts: AssemblyPartInput[]; joints: AssemblyJointInput[]; groupId: string } {
  const split = objects.map((o) => o.metadata?.split);
  if (objects.length === 0 || split.some((s) => !s)) throw new StoredAssemblyInputError('NOT_SPLIT_PART');
  const groupId = split[0]!.groupId;
  if (split.some((s) => s!.groupId !== groupId)) throw new StoredAssemblyInputError('MIXED_GROUPS');
  if (split.every((s) => !s!.joints)) throw new StoredAssemblyInputError('NO_JOINT_DATA');
  const index = new Map(split.map((s, i) => [s!.code, i]));
  const parts: AssemblyPartInput[] = objects.map((o, i) => ({
    code: split[i]!.code, mesh: o.mesh, assembly: { position: split[i]!.assembly.position, rotation: split[i]!.assembly.rotation },
  }));
  const seen = new Set<string>();
  const joints: AssemblyJointInput[] = [];
  for (const s of split) {
    for (const r of s!.joints ?? []) {
      if (seen.has(r.label) || !index.has(r.a) || !index.has(r.b)) continue;
      seen.add(r.label);
      joints.push({
        label: r.label, axis: r.axis, position: r.position, kind: r.kind, connector: r.connector,
        connectorCenters: r.connectorCenters, contactAreaMm2: r.contactAreaMm2, ...(r.normal ? { normal: r.normal } : {}),
        a: { part: index.get(r.a)!, code: r.a }, b: { part: index.get(r.b)!, code: r.b },
      });
    }
  }
  joints.sort((x, y) => Number(x.label) - Number(y.label) || x.label.localeCompare(y.label));
  return { parts, joints, groupId };
}

/** Revalida el armado de piezas divididas guardadas (solo lectura: el informe sugiere, no aplica). */
export function validateStoredAssembly(objects: SceneObject[]): AssemblyReport & { groupId: string; joints: number } {
  const { parts, joints, groupId } = storedAssemblyInput(objects);
  return { ...validateAssembly(parts, joints, { autoFix: false }), groupId, joints: joints.length };
}

/** Respuesta compacta del comando `validate_assembly` (bus y MCP): resumen más el detalle útil. */
export function storedAssemblyResponse(objects: SceneObject[]) {
  const r = validateStoredAssembly(objects);
  return {
    groupId: r.groupId,
    parts: objects.length,
    joints: r.joints,
    ...summarizeAssembly(r),
    order: r.order.map((s) => ({ step: s.step, code: s.code, direction: s.direction })),
    blockedDetail: r.blocked,
    weak: r.weak,
    fix: r.fix,
    closure: { ok: r.closure.ok, interference: r.closure.interference, gaps: r.closure.gaps },
    warnings: r.warnings,
  };
}
