/**
 * @file mcp-server/src/repairTools.ts
 * @description Herramientas MCP de reparación de mallas: `kura_diagnose_mesh` (solo lectura) y
 * `kura_repair_mesh`. Con la app conectada van por el Command Bus; sin interfaz usan la misma
 * operación de `src/core/operations` (`repairObject`) y la misma forma de respuesta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import { idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

export function registerRepairTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_diagnose_mesh',
    {
      title: 'Diagnose mesh',
      description:
        'Read-only. Checks whether an object mesh is a closed printable solid: open edges grouped into holes (size and ' +
        'object-local center in user axes, Z up), edges shared by more than two faces, duplicate or degenerate faces, ' +
        'inconsistent or inverted normals and tiny loose bodies. Does not change the scene.',
      inputSchema: { objectId: idSchema.describe('ID of the object to diagnose.') },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'diagnose_mesh', { id: args.objectId }, () => ctx.headless.repairMesh(args.objectId, { dryRun: true })),
  );

  server.registerTool(
    'kura_repair_mesh',
    {
      title: 'Repair mesh',
      description:
        'Repairs an object mesh so it becomes a closed solid accepted by the geometry engine: welds nearby vertices, removes ' +
        'degenerate and duplicate faces, separates edges with more than two faces, orients normals consistently, closes holes ' +
        'by triangulating their boundary and drops tiny slivers. Returns what was done, what could not be fixed (e.g. holes ' +
        'larger than maxHoleMm) and engine warnings. Fails with MESH_REPAIR_FAILED if the result is still not a valid solid.',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to repair.'),
        maxHoleMm: rangeSchema(OR.repair.maxHoleMm).optional()
          .describe('Holes whose largest side exceeds this size (mm) are left open and reported. Default: close all.'),
        weldMm: rangeSchema(OR.repair.weldMm).optional().describe('Vertex weld tolerance in mm (default 0.001).'),
        removeTinyShells: z.boolean().optional().describe('Remove loose bodies smaller than 1 % of the model (default true).'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'repair_mesh',
        { id: args.objectId, maxHoleMm: args.maxHoleMm, weldMm: args.weldMm, removeTinyShells: args.removeTinyShells },
        () => ctx.headless.repairMesh(args.objectId, { maxHoleMm: args.maxHoleMm, weldMm: args.weldMm, removeTinyShells: args.removeTinyShells }),
      ),
  );
}
