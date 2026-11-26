/**
 * @file mcp-server/src/fitCheckTools.ts
 * @description Herramienta MCP `kura_check_fit` ("Comprobar encaje", solo lectura): choques y holguras
 * entre piezas imprimibles y referencias, con las restas pendientes aplicadas en copia y recomendaciones
 * por regla. Con la app conectada va por el Command Bus (`check_fit`); sin interfaz usa la misma
 * operación (`runFitCheck`) y la misma forma de respuesta, en ejes del usuario (X derecha, Y fondo, Z arriba).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import { runFitCheck, type FitCheckOptions } from '../../src/engine/fitCheck';
import { fitCheckScope } from '../../src/core/operations/fitCheckOperations';
import { fitReportWithText } from '../../src/core/scene/fitCheckText';
import type { SceneObject } from '../../src/types/kura';
import { idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

interface CheckFitArgs extends FitCheckOptions {
  objectIds?: string[];
}

/** Comprobación sin interfaz: `objectIds` o todo lo visible (headless no tiene selección). */
export async function headlessCheckFit(ctx: KuraToolContext, args: CheckFitArgs) {
  const { objectIds, ...options } = args;
  // Ids desconocidos fallan antes de calcular (mismo criterio que el bus).
  for (const id of objectIds ?? []) ctx.headless.getObject(id);
  const scene = ctx.headless.readonlyObjects() as readonly SceneObject[];
  const scope = fitCheckScope(scene, [], objectIds);
  const defined = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) as FitCheckOptions;
  const report = await runFitCheck({ ...scope, options: defined });
  return { dryRun: true, ...fitReportWithText(report, 'en') };
}

export function registerFitCheckTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_check_fit',
    {
      title: 'Check fit',
      description:
        'Read-only. Checks whether parts collide or how much clearance is left between them: printable solids against each other ' +
        'and reference objects (real parts such as a board, screw or magnet) against solids; reference–reference pairs are skipped ' +
        'and loose negatives are not parts. By default each solid first gets its pending negatives subtracted (in a copy) so holes ' +
        'not yet applied are honored. Per pair: status interferes | tight (clearance below clearanceTargetMm) | ok | far, overlap ' +
        'volume in mm³ with its zone box and a representative point, minimum clearance with the two closest points, approximate=true ' +
        'when a mesh is not closed, and a rule-based recommendation with numbers and a user direction (+x right, +y back, +z up), ' +
        'marked as estimate. Also a summary (pairs checked, overlapping, tight, worst pair) and notes. Iterate: move with ' +
        'kura_transform_object, then check again. Default objects: the app selection, else all visible.',
      inputSchema: {
        objectIds: z.array(idSchema).min(1).max(4096).optional().describe('Objects to check (default: selection in the app, else all visible).'),
        applyPendingSubtractions: z.boolean().optional().describe('Subtract pending negatives from each solid before comparing (default true).'),
        clearanceTargetMm: rangeSchema(OR.fitCheck.clearanceTargetMm).optional().describe('Desired clearance in mm (default 0.25).'),
        searchMm: rangeSchema(OR.fitCheck.searchMm).optional().describe('Clearance search limit in mm (default max(4 × target, 2)).'),
        maxPairs: rangeSchema(OR.fitCheck.maxPairs).optional().describe('Max nearby pairs to compute (default 1000).'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'check_fit',
        {
          ids: args.objectIds, applyPendingSubtractions: args.applyPendingSubtractions,
          clearanceTargetMm: args.clearanceTargetMm, searchMm: args.searchMm, maxPairs: args.maxPairs,
        },
        () => headlessCheckFit(ctx, args),
      ),
  );
}
