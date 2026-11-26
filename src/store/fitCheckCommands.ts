/**
 * @file src/store/fitCheckCommands.ts
 * @description Comando del Command Bus `check_fit` ("Comprobar encaje", solo lectura): objetos (`ids`, o
 * la selección, o todo lo visible), restas pendientes, holgura deseada, tope de búsqueda y de pares.
 * Responde el informe en ejes del usuario con el texto de cada recomendación en inglés (misma forma que
 * el MCP sin interfaz), y lo deja en el store para el panel de resultados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { fitReportWithText } from '../core/scene/fitCheckText';
import type { FitCheckOptions } from '../engine/fitCheck';
import { OPERATION_RANGES as OR } from '../engine/operationLimits';
import { CommandError } from './commandErrors';
import { resolveObjects } from './commandTargets';
import { readBoolean, readIds, readRange, type RawParams } from './commandValidation';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

/** Opciones de `check_fit` (compartido con las pruebas de paridad y el MCP). */
export function parseCheckFitOptions(p: RawParams): FitCheckOptions {
  const out: FitCheckOptions = {
    applyPendingSubtractions: readBoolean(p, 'applyPendingSubtractions'),
    clearanceTargetMm: readRange(p, OR.fitCheck.clearanceTargetMm, 'clearanceTargetMm'),
    searchMm: readRange(p, OR.fitCheck.searchMm, 'searchMm'),
    maxPairs: readRange(p, OR.fitCheck.maxPairs, 'maxPairs'),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as FitCheckOptions;
}

export const FIT_CHECK_HANDLERS = {
  check_fit: async (p: RawParams, { get }: Deps) => {
    const ids = readIds(p, 'ids', 'objectIds');
    // Ids desconocidos fallan con su error tipado antes de calcular nada.
    if (ids) resolveObjects(get(), ids);
    const report = await get().checkFit({ ...(ids ? { ids } : {}), options: parseCheckFitOptions(p) });
    if (!report) throw new CommandError('failed', 'bus.error.failed', { command: 'check_fit' });
    return { dryRun: true, ...fitReportWithText(report, 'en') };
  },
};
