/**
 * @file mcp-server/src/patternTools.ts
 * @description Herramientas MCP del «Patrón»: `kura_pattern_linear` (fila o rejilla) y `kura_pattern_circular` (alrededor
 * de un eje). Con la app conectada van por el Command Bus (copias en un grupo con nombre, un paso de deshacer); sin
 * interfaz, por los mismos esquemas y el mismo plan (`headlessPattern.ts`). Con `dryRun: true` devuelven las posiciones
 * sin crear nada. Ejes y puntos del usuario (X derecha, Y fondo, Z arriba), mm y grados. Errores tipados: `invalid-params`,
 * `not-found`, `locked`, `precondition`, `read-only`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MAX_PATTERN_COPIES, MAX_PATTERN_UNION_PIECES, PATTERN_AXES, PATTERN_CENTERS, PATTERN_DISTANCE_MODES, PATTERN_RANGES } from '../../src/core/scene/patterns';
import { idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

const ids = z.array(idSchema).min(1).max(256).optional().describe('Parts to repeat (default: the current selection; without the app, ids are required).');
const axis = z.enum(PATTERN_AXES as unknown as [string, ...string[]]);
const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

export function registerPatternTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_pattern_linear',
    {
      title: 'Repeat parts in a row or grid',
      description:
        'Repeats the parts along an axis (X right, Y depth, Z up; or a free direction vector) with a step in mm, or spreads ' +
        'them over a total distance (mode "total"). rows > 1 adds a second direction to make a grid. count includes the original ' +
        `(max ${MAX_PATTERN_COPIES} new pieces and a triangle cap). The copies share color, material, role (solid or negative) and plate ` +
        'of the original; in the app they land in a named group, in one undo step; locked originals are copied but never moved, ' +
        `removed or regrouped. union: true merges original and copies with a boolean union (needs unlocked solid parts, up to ${MAX_PATTERN_UNION_PIECES} pieces). ` +
        'dryRun: true returns the positions without creating anything. Reports overlapCells when copies may overlap. Write tool even with dryRun.',
      inputSchema: {
        ids,
        count: rangeSchema(PATTERN_RANGES.count).optional().describe('Pieces along the main direction, original included (default 3).'),
        axis: axis.optional().describe('Main direction axis (default x).'),
        direction: vec3.optional().describe('Free direction [x, y, z] in user axes; replaces axis.'),
        mode: z.enum(PATTERN_DISTANCE_MODES as unknown as [string, ...string[]]).optional().describe('step (default): distance between copies; total: first to last.'),
        distanceMm: rangeSchema(PATTERN_RANGES.distanceMm).optional().describe('Signed distance in mm (required when count > 1, not zero).'),
        rows: rangeSchema(PATTERN_RANGES.count).optional().describe('Pieces along the second direction (default 1 = a single row).'),
        rowAxis: axis.optional().describe('Second direction axis (default y, or x when axis is y).'),
        rowDistanceMm: rangeSchema(PATTERN_RANGES.distanceMm).optional().describe('Distance of the second direction in mm (required when rows > 1).'),
        union: z.boolean().optional().describe('Merge original and copies into one piece.'),
        dryRun: z.boolean().optional().describe('true = only the positions, nothing changes.'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'pattern_linear', { ...args }, () => ctx.headless.pattern('pattern_linear', { ...args })),
  );

  server.registerTool(
    'kura_pattern_circular',
    {
      title: 'Repeat parts around an axis',
      description:
        'Repeats the parts around an axis (X, Y or Z of the user; default Z, vertical) through a center: the bed center (default), ' +
        'the selection center or a point [x, y, z] in mm. totalAngleDeg 360 (default) spreads count pieces over the full circle; ' +
        'less than 360 spreads them over an arc with the last at the end; negative reverses the direction. rotateCopies (default ' +
        'true) turns each copy with the pattern; false keeps every orientation. count includes the original (min 2, ' +
        `max ${MAX_PATTERN_COPIES} new pieces). Same result, grouping, locking, union and dryRun rules as kura_pattern_linear. ` +
        'Fails with precondition when the center is the part itself and copies do not rotate (they would coincide).',
      inputSchema: {
        ids,
        count: rangeSchema(PATTERN_RANGES.count).optional().describe('Pieces around the axis, original included (default 3, min 2).'),
        axis: axis.optional().describe('Rotation axis (default z).'),
        center: z.enum(PATTERN_CENTERS as unknown as [string, ...string[]]).optional().describe('bed (default), selection or point.'),
        pointMm: vec3.optional().describe('Center point [x, y, z] in mm (user axes); only with center "point".'),
        totalAngleDeg: rangeSchema(PATTERN_RANGES.angleDeg).optional().describe('Total angle in degrees (default 360, not zero).'),
        rotateCopies: z.boolean().optional().describe('Copies turn with the pattern (default true).'),
        union: z.boolean().optional().describe('Merge original and copies into one piece.'),
        dryRun: z.boolean().optional().describe('true = only the positions, nothing changes.'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'pattern_circular', { ...args }, () => ctx.headless.pattern('pattern_circular', { ...args })),
  );
}
