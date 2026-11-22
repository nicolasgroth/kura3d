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
      title: 'Dividir para imprimir',
      description:
        'Divide un objeto grande en piezas que caben en la cama (por defecto la del perfil activo), con conectores en cada unión, ' +
        'nombre por rejilla ("Objeto · A1": letra = columna X, número = nivel Y, minúscula = fila Z) y marcas de pareja grabadas ' +
        'opcionales. Los planos se desplazan hacia la sección más simple. Con dryRun=true solo devuelve el plan (planos y piezas estimadas) ' +
        'sin cambiar la escena. Devuelve un resumen corto; detail=true agrega el plan completo. ' +
        'Error SPLIT_TOO_MANY_PIECES (con needed = piezas necesarias) si harían falta más de maxPieces; ' +
        'maxPieces="auto" sube el tope hasta 400. Una sección más delgada que minWallForConnectorMm queda como corte liso para pegar ' +
        '(kind="glue", con aviso); connectorType="lap" (solape de borde, modifica la forma en la unión) lo usa en todas las uniones.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto a dividir.'),
        dryRun: z.boolean().default(false).describe('true = solo plan, sin cortar.'),
        detail: z.boolean().default(false).describe('true = devuelve el plan completo; por defecto un resumen (piezas, placas, uniones con/sin conector, avisos).'),
        bedWidthMm: rangeSchema(OR.split.bedMm).optional().describe('Ancho X de la cama (por defecto el perfil activo).'),
        bedDepthMm: rangeSchema(OR.split.bedMm).optional().describe('Fondo Z de la cama.'),
        bedHeightMm: rangeSchema(OR.split.bedMm).optional().describe('Alto Y útil de impresión.'),
        marginMm: rangeSchema(OR.split.marginMm).default(d.marginMm).describe('Margen por lado que se descuenta de la cama.'),
        axes: z.array(z.enum(['x', 'y', 'z'])).min(1).max(3).optional().describe('Ejes donde se permite cortar (por defecto los tres).'),
        maxPieces: z.union([rangeSchema(OR.split.maxPieces), z.literal('auto')]).default(d.maxPieces),
        allowRotation: z.boolean().default(true).describe('Permite girar 90° una pieza para que quepa.'),
        allowDiagonal: z.boolean().default(false).describe('Permite apoyar la pieza en diagonal sobre la cama si así cabe sin cortar.'),
        connectorType: z.enum(['none', 'dowel', 'peg', 'dovetail', 'lap']).default('dowel'),
        minWallForConnectorMm: rangeSchema(OR.split.minWallForConnectorMm).default(d.minWallForConnectorMm).describe('Espesor mínimo de la sección para poner conector; más delgada queda para pegar.'),
        lapHeightMm: rangeSchema(OR.split.lapHeightMm).default(d.lapHeightMm).describe('Alto del solape de borde en mm.'),
        connectorSize: rangeSchema(OR.cut.connectorSize).default(4).describe('Radio/semiancho del conector en mm.'),
        connectorDepth: rangeSchema(OR.cut.connectorDepth).default(6),
        tolerance: rangeSchema(OR.cut.tolerance).default(0.25).describe('Holgura de encaje en mm.'),
        connectorCount: rangeSchema(OR.cut.connectorCount).default(2),
        labels: z.enum(['none', 'engraved']).default('none').describe('Marcas de pareja grabadas en las caras de unión.'),
        labelDepthMm: rangeSchema(OR.split.labelDepthMm).default(d.labelDepthMm),
        labelMinHeightMm: rangeSchema(OR.split.labelMinHeightMm).default(d.labelMinHeightMm),
        labelPlacement: z.enum(['auto', 'joint', 'outside']).default('auto').describe('Marca en la cara de unión, por fuera junto al borde o automática.'),
        minFragmentMm3: rangeSchema(OR.split.minFragmentMm3).default(d.minFragmentMm3).describe('Cuerpos sueltos menores se funden con la pieza vecina.'),
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
            labelPlacement: args.labelPlacement, minFragmentMm3: args.minFragmentMm3,
          },
          dryRun: args.dryRun,
        }),
        detail ? undefined : summarizeSplitResult,
      );
    },
  );
}
