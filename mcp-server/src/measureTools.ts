/**
 * @file mcp-server/src/measureTools.ts
 * @description Herramientas MCP de medición, de solo lectura y en ejes del usuario (Z = altura):
 * `kura_measure_distance`, `kura_measure_object` y `kura_measure_capacity`. Con la app conectada van
 * por el Command Bus; sin interfaz usan las mismas respuestas de `src/core/operations/measureOperations`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { capacityToUser, MEASURE_LIMITS, measureDistanceUser, measureObjectUser } from '../../src/core/operations/measureOperations';
import { measureObjectCapacity } from '../../src/engine/measure';
import type { Vec3 } from '../../src/types/kura';
import { OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import { idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

const coord = z.number().finite().min(-MEASURE_LIMITS.coordMm).max(MEASURE_LIMITS.coordMm);
const pointSchema = z.tuple([coord, coord, coord]);

export function registerMeasureTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_measure_distance',
    {
      title: 'Measure distance',
      description:
        'Read-only. Straight-line distance in mm between two points given in user axes (X right, Y back, Z up), ' +
        'plus the components deltaMm = [ΔX, ΔY, ΔZ] from A to B. Does not change the scene.',
      inputSchema: {
        pointA: pointSchema.describe('First point [x, y, z] in mm.'),
        pointB: pointSchema.describe('Second point [x, y, z] in mm.'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'measure_distance', { ...args }, () => measureDistanceUser(args.pointA as Vec3, args.pointB as Vec3)),
  );

  server.registerTool(
    'kura_measure_object',
    {
      title: 'Measure object',
      description:
        'Read-only. Total surface area (mm²), volume (mm³ and mL; 1 cm³ = 1 mL), whether the mesh is closed, and the world ' +
        'bounding box and size in user axes (Z up) of one object, with its rotation and scale applied. Does not change the scene.',
      inputSchema: { objectId: idSchema.describe('ID of the object to measure.') },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'measure_object', { id: args.objectId }, () => measureObjectUser(ctx.headless.getObject(args.objectId))),
  );

  server.registerTool(
    'kura_measure_capacity',
    {
      title: 'Measure container capacity',
      description:
        'Read-only. How much liquid (or food, sand…) the object holds as a container in its CURRENT orientation: the empty space ' +
        'retained by the solid below a fill level. Returns the overflow height (the highest level before it spills, above the object ' +
        'base, Z up), the maximum capacity (mm³ and mL), what fits up to levelMm if given, every separate cavity (cavityIndex picks ' +
        'one; largest first) and closed hollows sealed inside (reported apart, not as capacity). A solid object returns capacity 0. ' +
        'Rotate the object to measure another tilt. Does not change the scene.',
      inputSchema: {
        objectId: idSchema.describe('ID of the container object.'),
        levelMm: rangeSchema(OR.measure.levelMm).optional()
          .describe('Fill level in mm above the object base (default: the overflow level). Capped at the overflow level.'),
        cavityIndex: rangeSchema(OR.measure.cavityIndex).optional().describe('Cavity to measure (0 = largest).'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'measure_capacity', { id: args.objectId, levelMm: args.levelMm, cavityIndex: args.cavityIndex }, async () => {
        const obj = ctx.headless.getObject(args.objectId);
        const result = await measureObjectCapacity(obj, { levelHeightMm: args.levelMm, basinIndex: args.cavityIndex });
        return capacityToUser(obj, result);
      }),
  );
}
