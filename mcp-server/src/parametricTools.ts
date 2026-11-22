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
      title: 'Editar parámetros de una primitiva o rosca',
      description:
        'Regenera una primitiva (radio, alto, segmentos, texto…) o una rosca (diámetro, paso, largo, holgura) con parámetros nuevos, ' +
        'conservando id, nombre, posición, rotación, escala, color y material. Falla si una operación ya cambió la malla. ' +
        'Si la pieza tenía caras pintadas, la pintura se pierde.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto paramétrico.'),
        params: primitiveParamsSchema.merge(threadEditSchema).describe('Solo los parámetros que cambian, en milímetros.'),
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
