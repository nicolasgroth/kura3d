/**
 * @file mcp-server/src/addonTools.ts
 * @description Herramientas MCP de agregados sobre una cara: `kura_add_magnet_pocket` (alojamiento de imán, un
 * negativo pendiente) y `kura_add_screw_boss` (torreta: poste sólido + agujero negativo). El lugar es un punto y una
 * normal de mundo (ejes del usuario) o una cara por nombre con desplazamiento. Con la app conectada van por el Command
 * Bus (`add_magnet_pocket`, `add_screw_boss`); sin interfaz, por los mismos esquemas y operaciones del motor. Un
 * bloqueo es el error tipado `addon-blocked` con su motivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ADDON_FACES } from '../../src/core/addons/addonPlacement';
import { MAGNET_DEFAULTS as MD, MAGNET_RANGES as MR } from '../../src/core/addons/magnetPocket';
import { SCREW_BOSS_RANGES as BR } from '../../src/core/addons/screwBoss';
import { TRANSFORM_RANGES } from '../../src/engine/operationLimits';
import { idSchema, positionSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

const coord = rangeSchema(TRANSFORM_RANGES.position);

/** Lugar del agregado: punto + normal o cara + desplazamiento (mismos nombres en el bus). */
export const placementInputs = {
  point: positionSchema.optional().describe('World point on the part surface [X, Y, Z] in mm (user axes: Z up). Give it with normal, or use face.'),
  normal: z.tuple([coord, coord, coord]).optional().describe('Outward surface normal at point [X, Y, Z] (normalized).'),
  face: z.enum(ADDON_FACES).optional()
    .describe('Face of the part by name instead of point: a ray from outside its bounding box finds the surface and its normal.'),
  faceOffsetMm: z.tuple([coord, coord]).optional()
    .describe('Offset [u, v] in mm from the face center: top/bottom use [X, Y], front/back [X, Z], left/right [Y, Z].'),
};

export function registerAddonTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_add_magnet_pocket',
    {
      title: 'Add magnet pocket',
      description:
        'Adds a magnet pocket on a face of a solid part: a pending negative (cylinder or box) sized magnet + clearance, axis along ' +
        'the face normal, open and flush with the face or hidden under 0.6 mm of material (pause the print to insert it). One undo ' +
        'step; in the app it is grouped with its part. It keeps its real size and follows the part when the part is moved, turned ' +
        'or scaled. Returns the negative, pocket size, the measured wall (minimum wall, through, protrusion on curved faces, cover ' +
        'of a hidden magnet, nearby pockets) and warnings (MAGNET_WALL, MAGNET_THROUGH, MAGNET_PROTRUDE, MAGNET_NEAR…). Fails with ' +
        'addon-blocked (reason tooBig or spansFace) when the pocket would take most of the part or is wider than the part there.',
      inputSchema: {
        hostId: idSchema.describe('ID of the solid part that receives the pocket.'),
        ...placementInputs,
        shape: z.enum(['round', 'square', 'rect']).optional().describe(`Magnet shape (default ${MD.shape}); "rect" = rectangular block (length × width × height).`),
        sizeMm: rangeSchema(MR.sizeMm).optional().describe(`Diameter (round), side (square) or length (rect) of the magnet in mm (default ${MD.sizeMm}).`),
        widthMm: rangeSchema(MR.widthMm).optional().describe('shape="rect" only, required there: magnet width in mm.'),
        turn90: z.boolean().optional().describe('shape="rect" only: the length points up the face by default; true turns it 90° around the face normal.'),
        heightMm: rangeSchema(MR.heightMm).optional().describe(`Magnet height in mm (default ${MD.heightMm}).`),
        clearanceMm: rangeSchema(MR.clearanceMm).optional().describe(`Clearance added to the diameter, side, or length and width (default ${MD.clearanceMm}).`),
        depthClearanceMm: rangeSchema(MR.depthClearanceMm).optional().describe(`Clearance added to the depth (default ${MD.depthClearanceMm}).`),
        hidden: z.boolean().optional().describe('Hidden under the face (default false = open pocket).'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'add_magnet_pocket', { ...args }, () => ctx.headless.addMagnetPocket({ ...args })),
  );

  server.registerTool(
    'kura_add_screw_boss',
    {
      title: 'Add screw boss',
      description:
        'Adds a screw boss on a face of a solid part: a solid post (merged with the part when subtractions are applied) and a ' +
        'coaxial blind hole negative with a 0.5 mm entry chamfer. type "screw" = self-tapping pilot hole, "insert" = heat-set ' +
        'threaded insert. With type and nominalMm (M2–M5) the built-in table gives the hole; explicit sizes win. Default height = ' +
        'hole depth + 2 mm, default outer diameter = 2.5 × nominal (at least hole + 2 minimum walls). One undo step; it keeps its ' +
        'size and follows the part. Returns both objects, the report (post wall, hole depth into the part, exits the other side, ' +
        'collides with another addon) and warnings. Fails with addon-blocked (reason tooWide) when the post foot is wider than the face.',
      inputSchema: {
        hostId: idSchema.describe('ID of the solid part that receives the boss.'),
        ...placementInputs,
        type: z.enum(['screw', 'insert']).optional().describe('Fastening: screw (default) or heat-set insert.'),
        nominalMm: rangeSchema(BR.nominalMm).optional().describe('Metric nominal size in mm (default 3 = M3).'),
        holeDiameterMm: rangeSchema(BR.holeDiameterMm).optional().describe('Hole diameter in mm (default: table for type and nominal size).'),
        holeDepthMm: rangeSchema(BR.holeDepthMm).optional().describe('Hole depth from the post top in mm (default: table).'),
        heightMm: rangeSchema(BR.heightMm).optional().describe('Post height above the face in mm (default: hole depth + 2).'),
        outerDiameterMm: rangeSchema(BR.outerDiameterMm).optional().describe('Post outer diameter in mm (default: 2.5 × nominal).'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'add_screw_boss', { ...args }, () => ctx.headless.addScrewBoss({ ...args })),
  );
}
