/**
 * @file mcp-server/src/fitTools.ts
 * @description Herramienta MCP `kura_fit_to_bed` ("Ajustar a la impresora"): analiza con `dryRun` las
 * alternativas para que uno o varios objetos (como bloque) quepan en la cama y aplica la elegida en
 * un paso de deshacer. Mismo comando `fit_to_bed` que la app (puente vivo) o el motor headless.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import { idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

export function registerFitTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_fit_to_bed',
    {
      title: 'Fit to printer',
      description:
        'Makes one or more objects (as a block) fit the bed. With dryRun=true (default when no alternative is given) it only returns the ' +
        'alternatives without changing the scene: "scale" (largest uniform factor in the current orientation), "rotate" (first of the 24 ' +
        'orthogonal orientations that fits at real size, preferring the current resting face, then turns about Z), "rotateScale" (orientation ' +
        'with the largest factor) and "split" (when nothing fits at real size: use kura_split_for_bed with the same bed). Each one has factor, ' +
        'resulting size [X, Y, Z] in mm (X right, Y back, Z up), orientation (downFace, steps), whether the resting face changes, warnings ' +
        '(thin walls, below minimum scale, functional parts such as ISO threads or split connectors that stop being standard) and one ' +
        'suggested option. Factor per axis = (bed − 2·margin) / size; it only shrinks. Apply with dryRun=false and alternative: one undo step; ' +
        'the block ends centered on the bed and resting at Z = 0.',
      inputSchema: {
        objectIds: z.array(idSchema).min(1).max(4096).optional().describe('Objects to fit as one block (default: the selection in the app).'),
        dryRun: z.boolean().optional().describe('true = only analyze. Default: true unless alternative is given.'),
        alternative: z.enum(['scale', 'rotate', 'rotateScale']).optional().describe('Alternative to apply (must be available in the analysis).'),
        bedWidthMm: rangeSchema(OR.split.bedMm).optional().describe('Bed width along X (default: active profile).'),
        bedDepthMm: rangeSchema(OR.split.bedMm).optional().describe('Bed depth along Y.'),
        bedHeightMm: rangeSchema(OR.split.bedMm).optional().describe('Usable printing height along Z.'),
        marginMm: rangeSchema(OR.split.marginMm).optional().describe('Margin per side subtracted from the bed (default: profile margin or 5).'),
      },
    },
    async (args) => {
      const dryRun = args.dryRun ?? args.alternative === undefined;
      return dispatchWithFallback(ctx, 'fit_to_bed', { ...args, ids: args.objectIds, dryRun }, () =>
        ctx.headless.fitToBed(args.objectIds ?? [], {
          bed: { widthMm: args.bedWidthMm, depthMm: args.bedDepthMm, heightMm: args.bedHeightMm, marginMm: args.marginMm },
          dryRun,
          ...(args.alternative ? { alternative: args.alternative } : {}),
        }),
      );
    },
  );
}
