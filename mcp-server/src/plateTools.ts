/**
 * @file mcp-server/src/plateTools.ts
 * @description Herramientas MCP de placas de impresión (lote P8): listar, crear, renombrar, borrar, fijar la activa,
 * mover piezas (también a una placa nueva), una placa por objeto, «Repartir en placas» (con `dryRun`) y cambiar entre
 * los modos imprimir y armado. Con la app conectada van por el Command Bus (mismos comandos, un paso de deshacer por
 * escritura salvo placa activa y modo); sin interfaz, por los mismos esquemas y funciones puras
 * (`headlessPlates.ts`), con el mismo resultado. Errores tipados: `not-found`, `invalid-params`, `locked`,
 * `precondition`, `read-only`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ARRANGE_CRITERIA, ARRANGE_ORIENTS, ARRANGE_RANGES } from '../../src/core/scene/plateArrangeTypes';
import { MAX_PLATE_NAME, MAX_PLATES } from '../../src/core/scene/plates';
import { idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

const plateId = idSchema.describe('ID of the print plate (from kura_list_plates).');
const objectIds = z.array(idSchema).min(1).max(256);
const plateName = z.string().min(1).max(MAX_PLATE_NAME).describe(`Plate name (1–${MAX_PLATE_NAME} characters, no control characters).`);

export function registerPlateTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  const h = () => ctx.headless.plates;

  server.registerTool(
    'kura_list_plates',
    {
      title: 'List print plates',
      description:
        'Lists the print plates of the scene: id, name, origin [X, Y] of the bed center in mm (user axes), bed (width, depth, ' +
        'height; own = a bed different from the project printer), locked (Arrange on plates skips it), number of parts, status ' +
        '(empty, ok, outOfBounds with the ids of the parts outside the bed, measured in print pose) and which one is active ' +
        '(where new parts land). Also the view mode (layout: print | assembly) and unplacedIds (solid parts without plate). ' +
        `Without plates there is one implicit plate at the origin (implicit: true, empty list). At most ${MAX_PLATES} plates.`,
      inputSchema: {},
    },
    async () => dispatchWithFallback(ctx, 'list_plates', {}, () => h().list()),
  );

  server.registerTool(
    'kura_create_plate',
    {
      title: 'Create print plate',
      description:
        'Adds a print plate (a bed of the project printer) in the first free spot of the plate grid and makes it active. When ' +
        'the scene had no plates, the implicit plate at the origin becomes "Plate 1" and keeps the existing solid parts. ' +
        'One undo step. Fails with precondition when the plate limit is reached.',
      inputSchema: { name: plateName.optional().describe('Name (default "Plate N").') },
    },
    async (args) => dispatchWithFallback(ctx, 'create_plate', { ...args }, () => h().create({ ...args })),
  );

  server.registerTool(
    'kura_rename_plate',
    {
      title: 'Rename print plate',
      description: 'Renames a print plate (trimmed). One undo step; changed: false when the name is the same.',
      inputSchema: { plateId, name: plateName },
    },
    async (args) => dispatchWithFallback(ctx, 'rename_plate', { ...args }, () => h().rename({ ...args })),
  );

  server.registerTool(
    'kura_delete_plate',
    {
      title: 'Delete print plate',
      description:
        'Deletes a print plate. Its parts move to targetPlateId (default: the first remaining plate), shifted to the equivalent ' +
        'spot of that bed; locked parts keep their place and are reassigned. The only plate cannot be deleted. One undo step. ' +
        'Returns the reassigned parts and the active plate.',
      inputSchema: {
        plateId,
        targetPlateId: idSchema.optional().describe('Plate that receives the parts (default: the first remaining one).'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'delete_plate', { ...args }, () => h().remove({ ...args })),
  );

  server.registerTool(
    'kura_set_active_plate',
    {
      title: 'Set active print plate',
      description: 'Makes a plate the active one (new parts land on it). View state: not an undo step.',
      inputSchema: { plateId },
    },
    async (args) => dispatchWithFallback(ctx, 'set_active_plate', { ...args }, () => h().setActive({ ...args })),
  );

  server.registerTool(
    'kura_move_to_plate',
    {
      title: 'Move parts to a plate',
      description:
        'Moves solid parts to a print plate, shifted to the equivalent spot of its bed (to the first free spot if that one is ' +
        'taken); their magnets, bosses and other addons follow them. plateId "new" creates a plate to receive them (and makes ' +
        'it active). One undo step. Fails with locked for a locked part and precondition when nothing would move.',
      inputSchema: {
        ids: objectIds.describe('IDs of the parts to move.'),
        plateId: idSchema.describe('Destination plate ID, or "new" to create one.'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'move_to_plate', { ...args }, () => h().moveTo({ ...args })),
  );

  server.registerTool(
    'kura_spread_one_plate_per_object',
    {
      title: 'One plate per object',
      description:
        'Puts each solid part on its own print plate, centered on the bed; creates the plates that are missing and reuses empty ' +
        'ones. Without ids, every unlocked solid part (addons go with their part). Needs at least two parts. One undo step.',
      inputSchema: { ids: objectIds.optional().describe('Parts to spread (default: all unlocked solid parts).') },
    },
    async (args) => dispatchWithFallback(ctx, 'spread_one_plate_per_object', { ...args }, () => h().spread({ ...args })),
  );

  server.registerTool(
    'kura_arrange_on_plates',
    {
      title: 'Arrange parts on plates',
      description:
        'Packs the parts on as few print plates as possible (MaxRects), creating plates as needed; locked plates and locked ' +
        'parts are not touched; the parts of a split group stay together when they fit. With dryRun: true returns the plan ' +
        '(destination of each part: existing plate id, "implicit" or "new:N") without changing anything. Applying is one undo ' +
        'step and keeps the view mode (in assembly it moves the print poses). Returns placed, moved, unplaced (with reason), ' +
        'skipped, platesUsed and platesCreated. Write tool even with dryRun (blocked in read-only mode). byGroup needs the app ' +
        'open: without the UI the scene has no groups and it answers a precondition error.',
      inputSchema: {
        ids: objectIds.optional().describe('Parts to arrange (default: all).'),
        criterion: z.enum(ARRANGE_CRITERIA as [string, ...string[]]).optional()
          .describe('compact (default), byColor (one block per color) or byGroup (one block per root group).'),
        spacingMm: rangeSchema(ARRANGE_RANGES.spacingMm).optional().describe(`Gap between parts in mm (default ${ARRANGE_RANGES.spacingMm.default}).`),
        marginMm: rangeSchema(ARRANGE_RANGES.marginMm).optional().describe(`Margin to the bed edge in mm (default ${ARRANGE_RANGES.marginMm.default}).`),
        orient: z.enum(ARRANGE_ORIENTS as [string, ...string[]]).optional()
          .describe('keep (default) keeps the orientation; flatDown lays each part on its largest flat face.'),
        plateIds: z.array(idSchema).min(1).max(MAX_PLATES).optional().describe('Only these existing plates (default: all unlocked).'),
        dryRun: z.boolean().optional().describe('true = only the plan, nothing changes.'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'arrange_on_plates', { ...args }, () => h().arrange({ ...args })),
  );

  server.registerTool(
    'kura_set_layout',
    {
      title: 'Set view mode (print / assembly)',
      description:
        'Switches the scene between print (parts laid out on their plates) and assembly (the figure put together). Each part ' +
        'swaps its live pose with its saved one; exports always use the print pose. View state: not an undo step.',
      inputSchema: { layout: z.enum(['print', 'assembly']).describe('print or assembly.') },
    },
    async (args) => dispatchWithFallback(ctx, 'set_layout', { ...args }, () => h().setLayout({ ...args })),
  );
}
