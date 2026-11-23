/**
 * @file mcp-server/src/roleTools.ts
 * @description Herramienta MCP `kura_set_object_role`: fija el rol de uno o varios objetos (sólido se
 * imprime; negativo se resta; referencia se ve y se mide pero nunca se imprime, exporta ni resta) y la
 * opacidad propia de una referencia. Con la app conectada va por el Command Bus; sin interfaz, por el
 * motor headless con el mismo resultado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OBJECT_ROLES, REFERENCE_OPACITY } from '../../src/core/scene/objectRole';
import { idSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

export const roleSchema = z
  .enum(OBJECT_ROLES as unknown as [string, ...string[]])
  .describe("Object role: 'solid' is printed, 'negative' is subtracted from solids it touches, 'reference' is only shown and measured (never printed, exported, subtracted or used in booleans).");

export const referenceOpacitySchema = z
  .number()
  .min(REFERENCE_OPACITY.min)
  .max(REFERENCE_OPACITY.max)
  .describe(`Own opacity of a reference (${REFERENCE_OPACITY.min}–${REFERENCE_OPACITY.max}); without it the global default from Settings is used.`);

export function registerRoleTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_set_object_role',
    {
      title: 'Set object role',
      description:
        "Sets the role of one or more objects in one undo step: 'solid', 'negative' or 'reference'. A reference " +
        '(e.g. an imported board or screw to check fit) stays visible and measurable but is never printed, exported, ' +
        'subtracted, combined or split. Optionally sets the reference opacity.',
      inputSchema: {
        objectIds: z.array(idSchema).min(1).max(1000).describe('IDs of the objects to change.'),
        role: roleSchema.optional(),
        referenceOpacity: referenceOpacitySchema.optional(),
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'set_object_role', { ...args }, () =>
        args.objectIds.map((id) =>
          ctx.headless.transformObject(id, {
            role: args.role as (typeof OBJECT_ROLES)[number] | undefined,
            referenceOpacity: args.referenceOpacity,
          }),
        ),
      ),
  );
}
