/**
 * @file mcp-server/src/splitTools.ts
 * @description Herramienta MCP `kura_split_for_bed` ("dividir para imprimir"): plan por cama y, salvo
 * `dryRun`, ejecución con conectores por unión, nombres por rejilla y marcas de pareja opcionales.
 * Mismo comando `split_for_bed` que la app (puente vivo) o el motor headless.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OPERATION_DEFAULTS, OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import { idSchema, rangeSchema } from './schemas.js';
import { summarizeSplitResult } from './splitSummary.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

export function registerSplitTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  const d = OPERATION_DEFAULTS.split;
  server.registerTool(
    'kura_split_for_bed',
    {
      title: 'Split for printing',
      description:
        'Splits a large object into pieces that fit on the bed (by default the active profile bed), with connectors at each joint, ' +
        'grid-based name ("Object · A1": letter = X column, number = Z level (height), lowercase = Y row) and optional engraved mating marks. ' +
        'Cut planes shift toward the simplest section. With dryRun=true it only returns the plan (planes and estimated pieces) ' +
        'without changing the scene. Returns a short summary; detail=true adds the full plan. ' +
        'Error SPLIT_TOO_MANY_PIECES (with needed = pieces required) if more than maxPieces would be needed; ' +
        'maxPieces="auto" raises the limit to 400. A section thinner than minWallForConnectorMm becomes a flat cut to glue ' +
        '(kind="glue", with a warning); connectorType="lap" (edge overlap, changes the joint shape) uses it on all joints.',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to split.'),
        dryRun: z.boolean().default(false).describe('true = plan only, no cutting.'),
        detail: z.boolean().default(false).describe('true = returns the full plan; by default a summary (pieces, plates, joints with/without connector, warnings).'),
        bedWidthMm: rangeSchema(OR.split.bedMm).optional().describe('Bed width along X (default: active profile).'),
        bedDepthMm: rangeSchema(OR.split.bedMm).optional().describe('Bed depth along Y.'),
        bedHeightMm: rangeSchema(OR.split.bedMm).optional().describe('Usable printing height along Z.'),
        marginMm: rangeSchema(OR.split.marginMm).default(d.marginMm).describe('Margin per side subtracted from the bed.'),
        axes: z.array(z.enum(['x', 'y', 'z'])).min(1).max(3).optional().describe('Axes where cutting is allowed (z = horizontal cuts; default: all three). Planes and joints come back with the same axes.'),
        maxPieces: z.union([rangeSchema(OR.split.maxPieces), z.literal('auto')]).default(d.maxPieces),
        allowRotation: z.boolean().default(true).describe('Allows rotating a part 90° so it fits.'),
        allowDiagonal: z.boolean().default(false).describe('Allows resting the part diagonally on the bed if it fits that way without cutting.'),
        connectorType: z.enum(['none', 'dowel', 'peg', 'dovetail', 'lap', 'loose-dowel']).default('dowel')
          .describe('dowel = fixed peg on one part; loose-dowel = blind holes in both parts plus separate printed dowels (no protrusions).'),
        minWallForConnectorMm: rangeSchema(OR.split.minWallForConnectorMm).default(d.minWallForConnectorMm).describe('Minimum section thickness to place a connector; thinner sections are left for gluing.'),
        lapHeightMm: rangeSchema(OR.split.lapHeightMm).default(d.lapHeightMm).describe('Edge overlap height in mm.'),
        connectorSize: rangeSchema(OR.cut.connectorSize).default(4).describe('Connector radius/half-width in mm.'),
        connectorDepth: rangeSchema(OR.cut.connectorDepth).default(6),
        tolerance: rangeSchema(OR.cut.tolerance).default(0.25).describe('Fit clearance in mm.'),
        connectorCount: rangeSchema(OR.cut.connectorCount).default(2),
        labels: z.enum(['none', 'engraved']).default('none').describe('Engraved mating marks on the joint faces.'),
        labelDepthMm: rangeSchema(OR.split.labelDepthMm).default(d.labelDepthMm),
        labelMinHeightMm: rangeSchema(OR.split.labelMinHeightMm).default(d.labelMinHeightMm),
        labelPlacement: z.enum(['auto', 'joint', 'outside']).default('auto').describe('Mark on the joint face, outside next to the edge, or automatic.'),
        reinforceWeakJoints: z.boolean().default(d.reinforceWeakJoints).describe('true = enlarges or adds connectors when a joint would be weak for its size (changes the radius you asked for). Off by default: weak joints are only reported.'),
        minFragmentMm3: rangeSchema(OR.split.minFragmentMm3).default(d.minFragmentMm3).describe('Smaller loose bodies are merged into the neighboring part.'),
      },
    },
    async ({ detail, ...args }) => {
      const connector =
        args.connectorType === 'none'
          ? null
          : {
              type: args.connectorType, size: args.connectorSize, depth: args.connectorDepth, tolerance: args.tolerance,
              count: Math.max(1, args.connectorCount), minWallForConnectorMm: args.minWallForConnectorMm, lapHeightMm: args.lapHeightMm,
            };
      return dispatchWithFallback(ctx, 'split_for_bed', { ...args, id: args.objectId }, () =>
        ctx.headless.splitForBed(args.objectId, {
          // Medidas omitidas: las del perfil activo
          bed: Object.fromEntries(
            Object.entries({ widthMm: args.bedWidthMm, depthMm: args.bedDepthMm, heightMm: args.bedHeightMm }).filter(([, v]) => v !== undefined),
          ),
          plan: { marginMm: args.marginMm, axes: args.axes, maxPieces: args.maxPieces, allowRotation: args.allowRotation, allowDiagonal: args.allowDiagonal, connector },
          execute: {
            connector, labels: args.labels, labelDepthMm: args.labelDepthMm, labelMinHeightMm: args.labelMinHeightMm,
            labelPlacement: args.labelPlacement, minFragmentMm3: args.minFragmentMm3, reinforceWeakJoints: args.reinforceWeakJoints,
          },
          dryRun: args.dryRun,
        }),
        detail ? undefined : summarizeSplitResult,
      );
    },
  );

  server.registerTool(
    'kura_validate_assembly',
    {
      title: 'Validate assembly',
      description:
        'Read-only. Revalidates the assembly of a split group (parts from kura_split_for_bed) using the joints saved in each part: ' +
        'closure (volume, interference, gaps), connector clashes, an assembly order with insertion directions, blocked parts and, per ' +
        'blocking joint, the options (`glue` or `change-type:<type>`), plus weak joints (measured vs recommended radius). ' +
        'Pass groupId (the id of the original object) for the whole group, or ids for a selection of parts of the same group ' +
        '(only joints between selected parts are checked). Does not change the scene.',
      inputSchema: {
        groupId: idSchema.optional().describe('Split group id (the id of the object that was split).'),
        ids: z.array(idSchema).min(1).max(4096).optional().describe('Ids of parts of one split group.'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'validate_assembly', { ...args }, () => ctx.headless.validateAssembly(args)),
  );
}
