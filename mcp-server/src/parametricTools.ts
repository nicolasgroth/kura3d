/**
 * @file mcp-server/src/parametricTools.ts
 * @description Herramienta MCP `kura_update_primitive_params`: edita los parámetros de una
 * primitiva o rosca paramétrica (misma operación que el inspector), por el puente vivo o headless.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import { idSchema, primitiveParamsSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

/** Parámetros de rosca editables (mismos rangos que `operationLimits.thread`). */
const threadEditSchema = z.object({
  diameterMm: rangeSchema(OR.thread.diameterMm).optional(),
  pitchMm: rangeSchema(OR.thread.pitchMm).optional(),
  lengthMm: rangeSchema(OR.thread.lengthMm).optional(),
  clearanceMm: rangeSchema(OR.thread.clearanceMm).optional(),
  includeHead: z.boolean().optional(),
});

export function registerParametricTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_update_primitive_params',
    {
      title: 'Edit parameters of a primitive or thread',
      description:
        'Regenerates a primitive (radius, height, segments, text…) or a thread (diameter, pitch, length, clearance) with new parameters, ' +
        'keeping id, name, position, rotation, scale, color and material. Fails if an operation has already changed the mesh. ' +
        'If the part had painted faces, the paint is lost.',
      inputSchema: {
        objectId: idSchema.describe('ID of the parametric object.'),
        params: primitiveParamsSchema.merge(threadEditSchema).describe('Only the parameters that change, in millimeters.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'update_primitive_params',
        { id: args.objectId, params: args.params },
        () => ctx.headless.updatePrimitiveParams(args.objectId, args.params),
      ),
  );
}
