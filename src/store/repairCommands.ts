/**
 * @file src/store/repairCommands.ts
 * @description Comandos del Command Bus de "Reparar malla": `diagnose_mesh` (solo lectura) y
 * `repair_mesh` (un paso de deshacer). Respuestas de `core/operations/repairReport`, con la misma
 * forma que el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { diagnosisToUser, repairReportToUser } from '../core/operations/repairReport';
import { CommandError } from './commandErrors';
import { resolveTarget } from './commandTargets';
import { readBoolean, readNumber, type RawParams } from './commandValidation';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

/** Lee las opciones de `repair_mesh` (compartido con las pruebas de paridad). */
export function parseRepairMesh(p: RawParams) {
  return {
    maxHoleMm: readNumber(p, { gt: 0, max: 100000 }, 'maxHoleMm'),
    weldMm: readNumber(p, { min: 1e-6, max: 1 }, 'weldMm'),
    removeTinyShells: readBoolean(p, 'removeTinyShells'),
  };
}

const stripUndefined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export const REPAIR_HANDLERS = {
  diagnose_mesh: async (p: RawParams, { get }: Deps) => {
    const target = resolveTarget(get(), p);
    const diagnosis = await get().diagnoseObjectMesh(target.id);
    if (!diagnosis) throw new CommandError('failed', 'bus.error.failed', { command: 'diagnose_mesh' });
    return { dryRun: true, diagnosis: diagnosisToUser(diagnosis) };
  },

  repair_mesh: async (p: RawParams, { get }: Deps) => {
    const target = resolveTarget(get(), p);
    const report = await get().repairObjectMesh(target.id, stripUndefined(parseRepairMesh(p)));
    if (!report) throw new CommandError('failed', 'bus.error.failed', { command: 'repair_mesh' });
    return { dryRun: false, id: target.id, ...repairReportToUser(report) };
  },
};
