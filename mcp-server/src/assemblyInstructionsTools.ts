/**
 * @file mcp-server/src/assemblyInstructionsTools.ts
 * @description Herramienta MCP de solo lectura `kura_get_assembly_instructions`: instrucciones de armado de un grupo
 * dividido (orden de pasos desde la pieza base, uniones por cara con conector, imanes o pegamento, dirección de
 * entrada, avisos y lista de materiales), en ejes del usuario. Con la app conectada va por el Command Bus
 * (`get_assembly_instructions`); sin interfaz, el mismo cálculo (`core/assembly`) sobre la escena headless.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { assemblyInstructionsResponse } from '../../src/core/assembly/assemblyInstructionsScene';
import { resolveAssemblyTargets, ValidateAssemblyTargetError } from '../../src/core/commands/validateAssemblySchema';
import { HeadlessCommandError } from './headlessSupport.js';
import { idSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

/** Instrucciones sobre la escena headless, con los mismos errores que `kura_validate_assembly`. */
function headlessInstructions(ctx: KuraToolContext, input: { groupId?: string; ids?: string[] }) {
  const objects = ctx.headless.readonlyObjects();
  try {
    return assemblyInstructionsResponse(objects, resolveAssemblyTargets([...objects], input));
  } catch (err) {
    if (!(err instanceof ValidateAssemblyTargetError)) throw err;
    if (err.reason === 'not-found') throw new HeadlessCommandError('not-found', `Part or split group "${err.detail}" not found.`, { reason: err.reason });
    if (err.reason === 'no-target') throw new HeadlessCommandError('invalid-params', 'Give groupId or the ids of the split parts.', { reason: err.reason });
    throw new HeadlessCommandError(
      'precondition',
      `No assembly instructions for these parts (${err.reason}): they must belong to one split group with their joints saved.`,
      { reason: err.reason },
    );
  }
}

export function registerAssemblyInstructionsTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_get_assembly_instructions',
    {
      title: 'Get assembly instructions',
      description:
        'Read-only. Assembly instructions for a split group (parts from kura_split_for_bed), computed from the joints saved in ' +
        'each part: ordered steps starting from the base part (the one resting on the table, largest volume), each adding one part ' +
        'already joined to what is assembled, with the joins (partner, face, method: dowel | loose-dowel | peg | dovetail | lap | ' +
        'magnet | glue, count, diameter or magnet size), the entry direction (user axes, Z up; vector differs from axis on tilted ' +
        'joints), warnings (weak-joint, hold-piece, magnet-polarity, not-connected, blocked) and a one-sentence English text; plus ' +
        'materials (printed parts, loose dowels, magnets by size counting one magnet per part at each position, glue joints). ' +
        'Pass groupId (id of the object that was split) or ids of parts of one group. Does not change the scene.',
      inputSchema: {
        groupId: idSchema.optional().describe('Split group id (the id of the object that was split).'),
        ids: z.array(idSchema).min(1).max(4096).optional().describe('Ids of parts of one split group (only joints between them).'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => dispatchWithFallback(ctx, 'get_assembly_instructions', { ...args }, () => headlessInstructions(ctx, args)),
  );
}
