/**
 * @file src/core/commands/validateAssemblySchema.ts
 * @description Esquema del comando de solo lectura `validate_assembly` (compartido por el bus de la
 * app y el MCP headless): resuelve las piezas a revalidar, por `groupId` (todas las piezas de un grupo
 * dividido) o por `ids` (una selección de piezas del mismo grupo; se validan sus uniones internas).
 * Los fallos llevan un motivo estable que cada lado traduce a su error.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Forma mínima de un objeto de escena que mira el esquema (sin depender de los tipos de la escena). */
export interface AssemblyTargetLike {
  id: string;
  metadata?: { split?: { groupId: string; joints?: unknown[] } };
}

/** Motivo estable de rechazo. */
export type ValidateAssemblyReject = 'no-target' | 'not-found' | 'not-split-part' | 'mixed-groups' | 'no-joint-data';

export class ValidateAssemblyTargetError extends Error {
  constructor(public readonly reason: ValidateAssemblyReject, public readonly detail = '') {
    super(`${reason}${detail ? `: ${detail}` : ''}`);
    this.name = 'ValidateAssemblyTargetError';
  }
}

/** Parámetros ya leídos del comando. */
export interface ValidateAssemblyParams {
  groupId?: string;
  ids?: string[];
}

/** Piezas divididas a revalidar (todas del mismo grupo y con uniones guardadas). */
export function resolveAssemblyTargets<T extends AssemblyTargetLike>(objects: T[], p: ValidateAssemblyParams): T[] {
  let targets: T[];
  if (p.ids && p.ids.length > 0) {
    targets = p.ids.map((id) => {
      const o = objects.find((x) => x.id === id);
      if (!o) throw new ValidateAssemblyTargetError('not-found', id);
      return o;
    });
  } else if (p.groupId) {
    targets = objects.filter((o) => o.metadata?.split?.groupId === p.groupId);
    if (targets.length === 0) throw new ValidateAssemblyTargetError('not-found', p.groupId);
  } else {
    throw new ValidateAssemblyTargetError('no-target');
  }
  const bad = targets.find((o) => !o.metadata?.split);
  if (bad) throw new ValidateAssemblyTargetError('not-split-part', bad.id);
  const group = targets[0].metadata!.split!.groupId;
  if (targets.some((o) => o.metadata!.split!.groupId !== group)) throw new ValidateAssemblyTargetError('mixed-groups');
  if (targets.every((o) => !o.metadata!.split!.joints)) throw new ValidateAssemblyTargetError('no-joint-data');
  return targets;
}
