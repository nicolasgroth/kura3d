/**
 * @file mcp-server/src/tools.ts
 * @description Registro de todas las herramientas y recursos MCP de Kurra Studio.
 * Soporta ejecución dual transparente: Live Bridge WebSocket (UI viva en tiempo real)
 * y Headless Standalone (motor en memoria con exportación STL/3MF directa a disco).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { writeFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { isEngineError, type EngineWarning } from '../../src/engine/engineErrors';
import { takeImplicitWeldWarning } from '../../src/engine/manifoldKernel';
import { userWarnings } from './headlessUserAxes.js';
import { localizeEngineErrorForUser, userErrorParams } from '../../src/core/scene/userEngineMessages';
import { OPERATION_DEFAULTS, OPERATION_RANGES } from '../../src/engine/operationLimits';
import { threadDefaults } from '../../src/engine/threadDefaults';
import { READ_ONLY_COMMANDS, type KuraBridgeServer } from './bridge.js';
import { resolveExportPath } from './exportPaths.js';
import { registerParametricTools } from './parametricTools.js';
import { registerSplitTools } from './splitTools.js';
import { registerFitTools } from './fitTools.js';
import { registerMeasureTools } from './measureTools.js';
import { registerRepairTools } from './repairTools.js';
import { registerFitCheckTools } from './fitCheckTools.js';
import { registerScrewFitTools } from './screwFitTools.js';
import { registerPipeCouplingTools } from './pipeCouplingTools.js';
import { registerRoleTools, roleSchema } from './roleTools.js';
import { registerRecipeTools } from './recipeTools.js';
import { registerSmoothOrientTools } from './smoothOrientTools.js';
import { registerSimplifyTools } from './simplifyTools.js';
import { registerAddonTools } from './addonTools.js';
import { registerFaceNegativeTools } from './faceNegativeTools.js';
import { registerPlateTools } from './plateTools.js';
import { registerPatternTools } from './patternTools.js';
import { isMirrorPlaneRequest, MIRROR_PLANES } from '../../src/core/bus/patternSchema';
import { MIRROR_BASES, PATTERN_RANGES } from '../../src/core/scene/patterns';
import { registerProjectInfoTools } from './projectInfoTools.js';
import type { ObjectRole } from '../../src/types/kura';
import { HeadlessUnsupportedError, type KuraHeadlessEngine } from './headlessEngine.js';
import { HeadlessCommandError } from './headlessSupport.js';
import { CommandError } from '../../src/core/bus/commandErrors';
import { t } from '../../src/i18n/index';
import {
  exportPayloadSchema,
  hexColorSchema,
  idSchema,
  nameSchema,
  outputPathSchema,
  placementSchema,
  positionSchema,
  primitiveParamsSchema,
  profileIdSchema,
  rangeSchema,
  rotationSchema,
  scaleSchema,
  shortTextSchema,
  svgContentSchema,
} from './schemas.js';
import { READ_COMMANDS, isReadCommand, toolAccess } from '../../src/core/commands/commandPolicy';
import type { KuraCommandName } from './types.js';

export { READ_ONLY_COMMANDS };

/** Dependencias inyectadas al registrar herramientas y recursos MCP. */
export interface KuraToolContext {
  bridge: KuraBridgeServer;
  headless: KuraHeadlessEngine;
}

const OR = OPERATION_RANGES;
const OD = OPERATION_DEFAULTS;

/** Formatea una respuesta JSON legible como bloque de texto estándar MCP. */
function okJson(payload: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

/** Formatea una respuesta de error MCP marcando `isError: true`. */
function failText(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

/**
 * Valida las políticas de seguridad activas (modo Solo Lectura y Rate Limiting)
 * antes de despachar cualquier herramienta tanto en modo Live Bridge como Headless.
 */
function enforceSecurityPolicy(ctx: KuraToolContext, command: KuraCommandName): void {
  if (ctx.bridge.isReadOnly() && !isReadCommand(command)) {
    throw new Error(
      `Operation denied: Kurra Studio MCP is in Read-only mode. Only inspection commands are allowed (${READ_COMMANDS.join(', ')}).`
    );
  }
  ctx.bridge.consumeRateLimit();
}

/**
 * Escribe en disco los bytes de exportación devueltos por la UI viva, confinados al directorio
 * permitido. La carga útil se valida con esquema antes de decodificarla.
 */
async function writeLiveExport(
  targetPath: string,
  result: unknown
): Promise<{ path: string; bytesWritten: number } | null> {
  const payload = exportPayloadSchema.safeParse(result ?? {});
  if (!payload.success) {
    throw new Error('The Kurra Studio UI returned an export payload with an invalid format.');
  }
  const { bytesBase64, text } = payload.data;
  if (!bytesBase64 && !text) {
    return null;
  }
  const buffer = bytesBase64 ? Buffer.from(bytesBase64, 'base64') : Buffer.from(text ?? '', 'utf8');
  await writeFile(targetPath, buffer);
  return { path: targetPath, bytesWritten: buffer.byteLength };
}

/**
 * Exporta a un archivo en disco: con la UI conectada pide los bytes por el puente y los escribe confinados al
 * directorio permitido; sin UI usa el motor sin interfaz. Común a STL y 3MF.
 */
async function exportToFile(
  ctx: KuraToolContext,
  opts: {
    command: 'export_stl' | 'export_3mf';
    extension: '.stl' | '.3mf';
    label: 'STL' | '3MF';
    outputPath: string;
    liveParams: Record<string, unknown>;
    headless: (targetPath: string) => Promise<unknown>;
  }
): Promise<CallToolResult> {
  enforceSecurityPolicy(ctx, opts.command);
  const targetPath = await resolveExportPath(ctx.bridge.getExportDir(), opts.outputPath, opts.extension);

  if (ctx.bridge.isConnected()) {
    const response = await ctx.bridge.sendCommand(
      opts.command,
      { ...opts.liveParams, returnBytes: true },
      undefined,
      { skipRateLimit: true }
    );
    if (!response.ok) {
      return failText(response.error ?? `Error exporting ${opts.label} from the Kurra Studio UI.`);
    }
    const written = await writeLiveExport(targetPath, response.result);
    if (written) {
      return okJson({ mode: 'live-bridge', ...written });
    }
    return okJson({ mode: 'live-bridge', result: response.result });
  }

  return okJson(await opts.headless(targetPath));
}

/**
 * Envuelve `server.registerTool` para anotar cada herramienta con `readOnlyHint` desde
 * `src/core/commands/commandPolicy.ts` (misma fuente de verdad que aplica el rechazo en servidor).
 */
function createAccessAwareRegistrar(server: McpServer): McpServer['registerTool'] {
  const register = (name: string, config: { annotations?: Record<string, unknown> }, cb: unknown) => {
    const readOnly = toolAccess(name) === 'read';
    const annotated = {
      ...config,
      annotations: { ...config.annotations, readOnlyHint: readOnly, destructiveHint: !readOnly },
    };
    return (server.registerTool as unknown as (...args: unknown[]) => unknown).call(
      server,
      name,
      annotated,
      cb
    );
  };
  return register as unknown as McpServer['registerTool'];
}

/**
 * Ejecuta un comando priorizando el puente WebSocket vivo de Kurra Studio y cayendo
 * automáticamente al motor Headless cuando la interfaz gráfica no está conectada.
 */
export async function dispatchWithFallback(
  ctx: KuraToolContext,
  command: KuraCommandName,
  params: Record<string, unknown>,
  headlessHandler: () => Promise<unknown> | unknown,
  /** Da forma al resultado (p. ej. un resumen) igual en el puente vivo y en headless. */
  shape: (result: unknown) => unknown = (result) => result
): Promise<CallToolResult> {
  try {
    enforceSecurityPolicy(ctx, command);

    if (ctx.bridge.isConnected()) {
      const response = await ctx.bridge.sendCommand(command, params, undefined, {
        skipRateLimit: true,
      });
      if (!response.ok) {
        const message = response.error ?? `The command '${command}' failed in the Kurra Studio UI.`;
        const code = (response as { errorCode?: string }).errorCode;
        return code ? failCoded(code, message, {}) : failText(message);
      }
      return okJson({
        mode: 'live-bridge',
        command,
        result: shape(mergeWarnings(response.result ?? { ok: true }, (response as { warnings?: Parameters<typeof mergeWarnings>[1] }).warnings)),
      });
    }

    // Cola FIFO: dos llamadas concurrentes no se intercalan sobre la escena headless.
    const result = await ctx.headless.queue.run(async () => {
      ctx.headless.takeWarnings();
      takeImplicitWeldWarning();
      // Con placas, lo nuevo y lo movido siguen a su placa como en la app (`headlessPlates.sync`).
      const plates = ctx.headless.plates.snapshot();
      const value = await headlessHandler();
      ctx.headless.plates.sync(plates);
      const weld = takeImplicitWeldWarning();
      return withEngineWarnings(value, [...ctx.headless.takeWarnings(), ...(weld ? [weld] : [])]);
    });
    return okJson(shape(result));
  } catch (err) {
    return failError(err);
  }
}

/**
 * Agrega a la respuesta los avisos del motor que dejó la operación (sin repetir los que la respuesta ya
 * trae). Ninguna herramienta sin interfaz los pierde aunque su método no los devuelva.
 */
export function withEngineWarnings(value: unknown, pending: readonly EngineWarning[]): unknown {
  return pending.length === 0 ? value : mergeWarnings(value, userWarnings(pending));
}

/** Agrega avisos ya en forma de usuario (`code`, `params`, `message`) sin duplicar los presentes. */
export function mergeWarnings(value: unknown, extra: ReadonlyArray<{ code: string; params?: unknown; message: string }> | undefined): unknown {
  if (!extra || extra.length === 0 || value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const current = (value as { warnings?: unknown }).warnings;
  const existing: Array<{ code: string; params?: unknown }> = Array.isArray(current) ? current : [];
  const key = (w: { code: string; params?: unknown }) => `${w.code}|${JSON.stringify(w.params ?? {})}`;
  const seen = new Set(existing.map(key));
  const added = extra.filter((w) => !seen.has(key(w)));
  if (added.length === 0) return value;
  return { ...value, warnings: [...existing, ...added] };
}

/** Error MCP con código estable (mismo formato en headless y en el puente vivo). */
function failCoded(code: string, message: string, params: Record<string, unknown>): CallToolResult {
  return {
    isError: true,
    content: [
      { type: 'text', text: `[${code}] ${message}` },
      { type: 'text', text: JSON.stringify({ code, params }) },
    ],
  };
}

/**
 * Error MCP con código y causa: un `EngineError` del motor headless se devuelve como
 * `[CÓDIGO] mensaje` (en inglés, ejes del usuario) más un bloque JSON `{ code, params }` (p. ej.
 * `MESH_INVALID` con `cause: "Non-finite vertex"` o `MESH_EMPTY`), en vez de solo el texto.
 */
function failError(err: unknown): CallToolResult {
  if (isEngineError(err)) {
    // Mismo texto que la app, en inglés y con los ejes del usuario (Z = altura).
    return failCoded(err.code, localizeEngineErrorForUser('en', err), userErrorParams(err.code, err.params));
  }
  if (err instanceof HeadlessCommandError) {
    return failCoded(err.code, err.message, err.params);
  }
  // Esquemas compartidos con el bus (p. ej. `addon-blocked`): mismo código, mensaje en inglés.
  if (err instanceof CommandError) {
    return failCoded(err.code, t('en', err.key, err.params), err.params);
  }
  return failText(err instanceof Error ? err.message : String(err));
}

/**
 * Registra el catálogo completo de herramientas MCP (`kura_*`) y recursos (`kura://*`)
 * sobre la instancia `McpServer` proporcionada.
 */
export function registerKuraTools(mcpServer: McpServer, ctx: KuraToolContext): void {
  const server = { registerTool: createAccessAwareRegistrar(mcpServer) };

  // 1. Estado actual de la escena
  server.registerTool(
    'kura_get_scene_state',
    {
      title: 'Get 3D scene state',
      description:
        'Returns the current scene objects, their transforms, dimensions in mm, active units and 3D printer profile. ' +
        'Axes as in slicers: X right, Y back, Z up (height); dimensionsMm is [X, Y, Z].',
      inputSchema: {},
    },
    async () =>
      dispatchWithFallback(ctx, 'get_scene_state', {}, () => ctx.headless.getSceneState())
  );

  // 2. Creación de primitivas paramétricas
  server.registerTool(
    'kura_create_primitive',
    {
      title: 'Create parametric 3D primitive',
      description:
        'Creates a closed solid primitive (box, cylinder, tube, sphere, cone, torus, prism or text) in millimeters. ' +
        'Box, cylinder, tube and prism accept exact rounded or chamfered edges (params.edgeStyle, edgeSize, edgeScope).',
      inputSchema: {
        primitiveType: z
          .enum(['box', 'cylinder', 'tube', 'sphere', 'cone', 'torus', 'prism', 'text'])
          .describe('Type of parametric primitive to create.'),
        name: nameSchema.optional().describe('Human-readable object name.'),
        params: primitiveParamsSchema
          .optional()
          .describe('Dimensional parameters in millimeters, depending on the chosen primitive.'),
        position: positionSchema.optional(),
        rotation: rotationSchema.optional(),
        scale: scaleSchema.optional(),
        color: hexColorSchema.optional().describe('Hexadecimal color, for example #38bdf8.'),
        role: roleSchema.optional(),
        isHole: z.boolean().optional().describe("Deprecated alias of role: true = 'negative'."),
        placement: placementSchema,
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'create_primitive',
        { ...args, type: args.primitiveType },
        () =>
          ctx.headless.createPrimitive({
            primitiveType: args.primitiveType,
            name: args.name,
            params: args.params,
            position: args.position,
            rotation: args.rotation,
            scale: args.scale,
            color: args.color,
            role: args.role as ObjectRole | undefined,
            isHole: args.isHole,
            placement: args.placement,
          })
      )
  );

  registerParametricTools(server, ctx);
  registerSplitTools(server, ctx);
  registerFitTools(server, ctx);
  registerMeasureTools(server, ctx);
  registerRepairTools(server, ctx);
  registerFitCheckTools(server, ctx);
  registerScrewFitTools(server, ctx);
  registerPipeCouplingTools(server, ctx);
  registerRoleTools(server, ctx);
  registerRecipeTools(server, ctx);
  registerSmoothOrientTools(server, ctx);
  registerSimplifyTools(server, ctx);
  registerAddonTools(server, ctx);
  registerFaceNegativeTools(server, ctx);
  registerPlateTools(server, ctx);
  registerPatternTools(server, ctx);
  registerProjectInfoTools(server, ctx);

  // 3. Transformación de objetos
  server.registerTool(
    'kura_transform_object',
    {
      title: 'Transform 3D object',
      description:
        'Updates position [X, Y, Z] in mm (Z up), Euler XYZ rotation [rx, ry, rz] in radians (rz turns around the vertical), ' +
        'scale [sx, sy, sz] or metadata of an object.',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to modify.'),
        position: positionSchema.optional(),
        rotation: rotationSchema.optional(),
        scale: scaleSchema.optional(),
        name: nameSchema.optional(),
        isHole: z.boolean().optional(),
        visible: z.boolean().optional(),
        locked: z.boolean().optional(),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'transform_object',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.transformObject(args.objectId, {
            position: args.position,
            rotation: args.rotation,
            scale: args.scale,
            name: args.name,
            isHole: args.isHole,
            visible: args.visible,
            locked: args.locked,
          })
      )
  );

  // 4. Eliminación de objetos
  server.registerTool(
    'kura_delete_object',
    {
      title: 'Delete 3D object',
      description: 'Permanently deletes an object from the scene by its identifier.',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to delete.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'delete_object',
        { ...args, id: args.objectId },
        () => ctx.headless.deleteObject(args.objectId)
      )
  );

  // 5. Operaciones booleanas CSG
  server.registerTool(
    'kura_boolean_operation',
    {
      title: 'CSG boolean operation',
      description:
        'Performs union, subtraction or intersection between a target object and one or more tool objects.',
      inputSchema: {
        targetId: z.string().describe('ID of the base object the operation is applied to.'),
        toolIds: z.array(idSchema).max(256).min(1).describe('List of tool object IDs.'),
        operation: z.enum(['union', 'subtract', 'intersect']).describe('CSG operation type.'),
        keepTools: z
          .boolean()
          .optional()
          .describe('If true, keeps the original objects in the scene.'),
        resultName: nameSchema.optional().describe('Optional name of the resulting object.'),
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'boolean_operation', args, () =>
        ctx.headless.booleanOperation({
          targetId: args.targetId,
          toolIds: args.toolIds,
          operation: args.operation,
          keepTools: args.keepTools,
          resultName: args.resultName,
        })
      )
  );

  // 6. Ahuecado paramétrico (Hollow)
  server.registerTool(
    'kura_hollow_object',
    {
      title: 'Hollow 3D model',
      description:
        'Converts a solid into a hollow shell with wall thickness in millimeters and an optional drain hole.',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to hollow.'),
        wallThickness: rangeSchema(OR.hollow.wallThickness).describe('Wall thickness in millimeters.'),
        drainHole: z.boolean().optional().describe('Adds a bottom drain hole (resin).'),
        drainHoleRadius: rangeSchema(OR.hollow.drainHoleRadius).optional().describe('Drain hole radius in mm.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'hollow_object',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.hollowObject(args.objectId, {
            wallThickness: args.wallThickness,
            drainHole: args.drainHole,
            drainHoleRadius: args.drainHoleRadius,
          })
      )
  );

  // 7. Corte por plano con conectores para impresión 3D
  server.registerTool(
    'kura_plane_cut',
    {
      title: 'Cut model by plane',
      description:
        'Splits an object with a plane normal to X, Y or Z (Z = horizontal plane, the default), optionally generating mechanical connectors (dowel, peg, dovetail).',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to cut.'),
        axis: z.enum(['x', 'y', 'z']).default('z').describe('Normal axis of the cut plane (z = horizontal cut).'),
        offset: rangeSchema(OR.cut.offset).default(0).describe('Plane offset in mm from the center along that axis (+Z = up, +Y = back).'),
        connectorType: z
          .enum(['none', 'dowel', 'peg', 'dovetail'])
          .default(OPERATION_DEFAULTS.cut.connectorType)
          .describe('Automatic connector type between halves (none = plain cut).'),
        connectorSize: rangeSchema(OR.cut.connectorSize).default(OPERATION_DEFAULTS.cut.connectorSize).describe('Connector radius/width in mm.'),
        connectorDepth: rangeSchema(OR.cut.connectorDepth).default(OPERATION_DEFAULTS.cut.connectorDepth).describe('Connector depth in mm.'),
        tolerance: rangeSchema(OR.cut.tolerance).default(OPERATION_DEFAULTS.cut.tolerance).describe('Fit clearance in mm.'),
        connectorCount: rangeSchema(OR.cut.connectorCount).default(OPERATION_DEFAULTS.cut.connectorCount),
        keepMode: z.enum(['both', 'positive', 'negative']).default('both')
          .describe('Halves to keep: positive = the +axis side (top for z, back for y), negative = the other one.'),
        keptHalfPlacement: z.enum(['inPlace', 'dropToBed', 'freeSpot']).default('inPlace')
          .describe('Only when a single half is kept and it would not rest on the bed (e.g. the upper half of a horizontal cut). inPlace = leave it where it is (may float), dropToBed = lower it onto the bed in the same X/Y place, freeSpot = rest it on a free spot of the bed. Ignored when both halves are kept or the kept half already rests on the bed.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'plane_cut',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.planeCut(args.objectId, {
            axis: args.axis,
            offset: args.offset,
            connectorType: args.connectorType,
            connectorSize: args.connectorSize,
            connectorDepth: args.connectorDepth,
            tolerance: args.tolerance,
            connectorCount: args.connectorCount,
            keepMode: args.keepMode,
            keptHalfPlacement: args.keptHalfPlacement,
          })
      )
  );

  // 8. Separar islas desconectadas
  server.registerTool(
    'kura_split_disconnected',
    {
      title: 'Split disconnected islands',
      description: 'Splits a mesh made of several separate bodies into independent objects.',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to analyze and split.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'split_disconnected',
        { ...args, id: args.objectId },
        () => ctx.headless.splitDisconnected(args.objectId)
      )
  );

  // 8b. Organizar: grupos y combinar (requieren la app abierta; el modo sin interfaz no guarda grupos)
  const needsApp = (what: string) => () => {
    throw new Error(`${what} needs the Kurra Studio app connected through the local bridge (headless mode has no groups).`);
  };
  server.registerTool(
    'kura_group_objects',
    {
      title: 'Group objects',
      description:
        'Groups objects so they are selected, moved, rotated and scaled together as one set. The objects stay ' +
        'independent (nothing is merged). Groups can be nested. Use kura_ungroup to undo.',
      inputSchema: {
        objectIds: z.array(idSchema).max(256).min(1).describe('IDs of the objects to group.'),
        name: z.string().max(80).optional().describe('Group name (optional).'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'group_objects', { ids: args.objectIds, name: args.name }, needsApp('Grouping'))
  );
  server.registerTool(
    'kura_ungroup',
    {
      title: 'Ungroup',
      description: 'Removes a group; its objects (and subgroups) move to the parent group. The objects are not changed.',
      inputSchema: { groupId: idSchema.describe('ID of the group (from kura_get_scene_state.groups).') },
    },
    async (args) => dispatchWithFallback(ctx, 'ungroup', { groupId: args.groupId }, needsApp('Ungrouping'))
  );
  server.registerTool(
    'kura_combine_objects',
    {
      title: 'Combine into one object',
      description:
        'Combines 2 or more objects into ONE object with several bodies, without boolean operations: the geometry ' +
        'is not merged and the total volume is the sum. Exports as a single STL. Use kura_separate_bodies to split it ' +
        'again, or kura_boolean_operation (union) to really merge geometry.',
      inputSchema: {
        objectIds: z.array(idSchema).max(256).min(2).describe('IDs of the objects to combine.'),
        name: z.string().max(80).optional().describe('Name of the combined object (optional).'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'combine_objects', { ids: args.objectIds, name: args.name }, needsApp('Combining'))
  );
  server.registerTool(
    'kura_separate_bodies',
    {
      title: 'Separate bodies',
      description: 'Splits an object made of several loose bodies (for example a combined object) into separate objects.',
      inputSchema: { objectId: idSchema.describe('ID of the object to separate.') },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'separate_bodies', { id: args.objectId }, () => ctx.headless.splitDisconnected(args.objectId))
  );

  // 9. Separar por colores pintados
  server.registerTool(
    'kura_split_by_color',
    {
      title: 'Split by color',
      description:
        'Splits a multicolor painted model into one closed, printable solid per color for multi-material printing. ' +
        'Each non-base color takes a layer of depthMm inward from its painted surface; the base color keeps the rest. ' +
        'The parts do not overlap and their volumes add up to the original.',
      inputSchema: {
        objectId: idSchema.describe('ID of the multicolor object to split.'),
        depthMm: rangeSchema(OR.colorSplit.depthMm)
          .optional()
          .describe('Color depth in mm: how far each painted color reaches inward (default 1).'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'split_by_color',
        { ...args, id: args.objectId },
        () => ctx.headless.splitByColor(args.objectId, args.depthMm)
      )
  );

  // 10. Aplicar textura procedural
  server.registerTool(
    'kura_apply_texture',
    {
      title: 'Apply procedural surface texture',
      description:
        'Applies procedural surface displacement (fuzzy skin, knurling, waves, honeycomb, grid or none).',
      inputSchema: {
        objectId: idSchema.describe('Object ID.'),
        pattern: z.enum(['none', 'fuzzy', 'knurling', 'waves', 'honeycomb', 'grid']),
        depth: rangeSchema(OR.texture.depth).default(0.4).describe('Relief depth in mm.'),
        scale: rangeSchema(OR.texture.scale).default(3).describe('Pattern scale/frequency in mm.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'apply_texture',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.applyTexture(args.objectId, {
            pattern: args.pattern,
            depth: args.depth,
            scale: args.scale,
          })
      )
  );

  // 11. Pintar objeto
  server.registerTool(
    'kura_paint_object',
    {
      title: 'Paint 3D object',
      description:
        'Paints the whole object with a hexadecimal color (#rrggbb), or only a brush stroke around `localPoint`.',
      inputSchema: {
        objectId: idSchema.describe('Object ID.'),
        color: hexColorSchema.describe('Hex color in #rrggbb format.'),
        localPoint: positionSchema
          .optional()
          .describe('Brush center [X, Y, Z] in mm in object-local coordinates (Z up). Omit to paint the whole object.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'paint_object',
        { ...args, id: args.objectId },
        () => ctx.headless.paintObject(args.objectId, args.color, args.localPoint)
      )
  );

  // 12. Importar y extruir SVG
  server.registerTool(
    'kura_import_svg',
    {
      title: 'Import and extrude SVG to 3D',
      description: 'Converts SVG vector strokes into an extruded 3D solid.',
      inputSchema: {
        svgContent: svgContentSchema.describe('Full XML content of the SVG file.'),
        name: nameSchema.optional().describe('Name of the generated object.'),
        depth: rangeSchema(OR.svg.depth).default(4).describe('Extrusion height in mm.'),
        targetWidth: rangeSchema(OR.svg.targetWidth).default(50).describe('Target width in mm.'),
        curveSegments: rangeSchema(OR.svg.curveSegments).default(16),
        placement: placementSchema,
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'import_svg', args, () =>
        ctx.headless.importSvg({
          svgContent: args.svgContent,
          name: args.name,
          depth: args.depth,
          targetWidth: args.targetWidth,
          curveSegments: args.curveSegments,
          placement: args.placement,
        })
      )
  );

  // 13. Configurar sistema de unidades
  server.registerTool(
    'kura_set_units',
    {
      title: 'Set unit system',
      description: 'Changes the Kurra Studio display unit (mm, cm, m, in, ft).',
      inputSchema: {
        units: z.enum(['mm', 'cm', 'm', 'in', 'ft']).describe('Desired unit of measure.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'set_unit_system',
        { unit: args.units, unitSystem: args.units, units: args.units },
        () => ctx.headless.setUnits(args.units)
      )
  );

  // 14. Configurar perfil de impresora 3D
  server.registerTool(
    'kura_set_printer_profile',
    {
      title: 'Select 3D printer profile',
      description:
        'Sets the bed volume and active profile from the 12 multi-brand presets (elegoo-centauri-carbon-2, elegoo-centauri-carbon-1, bambu-p1s-x1c-a1, bambu-a1-mini, bambu-h2d, snapmaker-artisan, snapmaker-j1s, flashforge-ad5m, flashforge-ad5x, generic-220, generic-300 or free-studio).',
      inputSchema: {
        profileId: profileIdSchema.describe('ID of the printer profile to activate.'),
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'set_printer_profile', args, () =>
        ctx.headless.setPrinterProfile(args.profileId)
      )
  );

  // 15. Exportar STL
  server.registerTool(
    'kura_export_stl',
    {
      title: 'Export scene to STL file',
      description:
        'Exports the indicated objects (or the whole visible scene) as binary or ASCII STL directly to disk. With print ' +
        'plates, each part is written relative to the bed of its own plate; parts without a plate are skipped ' +
        '(`skippedUnplaced`). An STL has no plates: when the parts are on two or more plates, pass `plateId` to export ' +
        'one plate (call once per plate), or use kura_export_3mf for one file with all plates.',
      inputSchema: {
        outputPath: outputPathSchema.describe('Destination path of the .stl file on disk.'),
        objectIds: z.array(idSchema).max(256).optional().describe('Specific IDs to export (optional).'),
        binary: z.boolean().default(true).describe('true for binary STL (recommended), false for ASCII.'),
        plateId: idSchema.optional().describe('Only the parts of this print plate, relative to its bed (from kura_list_plates).'),
      },
    },
    async (args) => {
      try {
        return await exportToFile(ctx, {
          command: 'export_stl',
          extension: '.stl',
          label: 'STL',
          outputPath: args.outputPath,
          liveParams: { objectIds: args.objectIds, binary: args.binary, plateId: args.plateId },
          headless: (targetPath) =>
            ctx.headless.exportStl({ outputPath: targetPath, objectIds: args.objectIds, binary: args.binary, plateId: args.plateId }),
        });
      } catch (err) {
        return failError(err);
      }
    }
  );

  // 16. Exportar 3MF (un único 3MF estándar)
  server.registerTool(
    'kura_export_3mf',
    {
      title: 'Export scene to 3MF file',
      description:
        'Exports the indicated objects (or the whole visible scene) as one standard 3MF with per-triangle colors, readable by ' +
        'OrcaSlicer, Bambu Studio, PrusaSlicer and Cura. The former `slicerTarget` argument is obsolete and ignored. With ' +
        'parts on two or more print plates, the file carries every plate (Bambu Studio and OrcaSlicer show each one; ' +
        'PrusaSlicer and Cura see all parts on one bed), each part relative to the bed of its plate; parts without a ' +
        'plate are skipped (`skippedUnplaced`). Each part is placed where Bambu Studio / OrcaSlicer expect its plate (bed ' +
        'corner as origin, plates in a grid sized by the project bed); those slicers assume one bed for every plate, so a ' +
        'plate with its own bed of another size goes centered in a project-bed cell and is listed in `otherBedPlates`. ' +
        '`plateId` exports a single plate.',
      inputSchema: {
        outputPath: outputPathSchema.describe('Destination path of the .3mf file on disk.'),
        objectIds: z.array(idSchema).max(256).optional().describe('Specific IDs to export (optional).'),
        plateId: idSchema.optional().describe('Only the parts of this print plate, relative to its bed (from kura_list_plates).'),
      },
    },
    async (args) => {
      try {
        return await exportToFile(ctx, {
          command: 'export_3mf',
          extension: '.3mf',
          label: '3MF',
          outputPath: args.outputPath,
          liveParams: { objectIds: args.objectIds, plateId: args.plateId },
          headless: (targetPath) => ctx.headless.export3mf({ outputPath: targetPath, objectIds: args.objectIds, plateId: args.plateId }),
        });
      } catch (err) {
        return failError(err);
      }
    }
  );

  // 17. Capturar captura PNG del viewport 3D vivo
  server.registerTool(
    'kura_capture_viewport',
    {
      title: 'Capture 3D viewport view',
      description:
        'Captures a PNG image of the 3D viewport when the Kurra Studio graphical app is connected via Live Bridge.',
      inputSchema: {
        width: rangeSchema(OR.capture.sizePx).optional(),
        height: rangeSchema(OR.capture.sizePx).optional(),
      },
    },
    async (args) => {
      try {
        enforceSecurityPolicy(ctx, 'capture_viewport');

        if (!ctx.bridge.isConnected()) {
          throw new HeadlessUnsupportedError(
            'capture_viewport',
            'capturing the viewport needs the UI WebGL renderer, which does not exist in Node.'
          );
        }

        const response = await ctx.bridge.sendCommand('capture_viewport', args, undefined, {
          skipRateLimit: true,
        });
        if (!response.ok) {
          return failText(response.error ?? 'Could not capture the Kurra Studio viewport.');
        }

        const payload = (response.result ?? {}) as {
          imageBase64?: string;
          dataUrl?: string;
          mimeType?: string;
        };
        const raw = payload.imageBase64 ?? payload.dataUrl ?? '';
        const cleanBase64 = raw.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

        if (!cleanBase64) {
          return failText('The Kurra Studio UI did not return valid PNG data for the capture.');
        }

        return {
          content: [
            {
              type: 'image',
              data: cleanBase64,
              mimeType: payload.mimeType ?? 'image/png',
            },
            {
              type: 'text',
              text: '3D viewport capture obtained successfully from Kurra Studio Live Bridge.',
            },
          ],
        };
      } catch (err) {
        return failError(err);
      }
    }
  );

  // 18. Generador automático de moldes y contra-moldes
  server.registerTool(
    'kura_generate_mold',
    {
      title: 'Generate 3D mold or counter-mold',
      description:
        'Automatically generates a mold or counter-mold (1 part, 2 parts with keys, master box for silicone, or core-cavity) from a master object.',
      inputSchema: {
        objectId: idSchema.describe('ID of the master object the mold is generated from.'),
        mode: z
          .enum(['direct_1part', 'direct_2part', 'silicone_master', 'core_cavity'])
          .describe('Mold generation mode.'),
        wallMarginMm: rangeSchema(OR.mold.wallMarginMm)
          .default(OD.mold.wallMarginMm)
          .describe('Outer wall margin of the mold in mm (or silicone thickness).'),
        boxWallMm: rangeSchema(OR.mold.boxWallMm)
          .default(OD.mold.boxWallMm)
          .describe('Wall thickness of the containing master box in mm.'),
        splitAxis: z
          .enum(['x', 'y'])
          .default('x')
          .describe('Horizontal parting axis for two-half molds (x = left/right halves, y = front/back halves).'),
        pourSpout: z
          .boolean()
          .default(true)
          .describe('If true, adds a pour funnel on top (+Z).'),
        pourSpoutRadiusMm: rangeSchema(OR.mold.pourSpoutRadiusMm)
          .default(OD.mold.pourSpoutRadiusMm)
          .optional()
          .describe('Pour funnel radius in mm.'),
        keyToleranceMm: rangeSchema(OR.mold.keyToleranceMm)
          .default(OD.mold.keyToleranceMm)
          .describe('Fit clearance for registration keys in mm.'),
        cavityWallMm: rangeSchema(OR.mold.cavityWallMm)
          .default(OD.mold.cavityWallMm)
          .describe('Wall thickness of the cast part in core_cavity mode (mm).'),
        placement: placementSchema,
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'generate_mold',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.generateMold(args.objectId, {
            mode: args.mode,
            wallMarginMm: args.wallMarginMm,
            boxWallMm: args.boxWallMm,
            splitAxis: args.splitAxis,
            pourSpout: args.pourSpout,
            pourSpoutRadiusMm: args.pourSpoutRadiusMm,
            keyToleranceMm: args.keyToleranceMm,
            cavityWallMm: args.cavityWallMm,
          }, args.placement)
      )
  );

  // 19. Proyección conformal de texto o SVG sobre superficie 3D
  server.registerTool(
    'kura_project_on_surface',
    {
      title: 'Project text or SVG onto 3D surface',
      description:
        'Projects text or SVG graphics onto a face or cylinder of the object as raised relief (emboss), engraving (deboss) or flush multicolor inlay (flush_inlay).',
      inputSchema: {
        objectId: idSchema.describe('Target object ID.'),
        kind: z.enum(['text', 'svg']).describe('Type of graphic to project.'),
        text: shortTextSchema.optional().describe('Text to project when kind === "text".'),
        svgContent: svgContentSchema.optional().describe('SVG XML content when kind === "svg".'),
        mode: z
          .enum(['emboss', 'deboss', 'flush_inlay'])
          .describe('Surface application mode.'),
        axis: z
          .enum(['+z', '-z', '+x', '-x', '+y', '-y', 'cylindrical'])
          .default('-y')
          .describe('Face to project onto (Z up): -y = front (default), +z = top, -z = bottom, +y = back, ±x = sides; or cylindrical wrap.'),
        widthMm: rangeSchema(OR.projection.widthMm).default(24).describe('Projected width in mm.'),
        depthMm: rangeSchema(OR.projection.depthMm).default(1.2).describe('Relief/engraving depth in mm.'),
        colorHex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default('#f97316')
          .describe('Hexadecimal color (#rrggbb) for the projection or inlay.'),
        offsetU: rangeSchema(OR.projection.offsetU).optional().describe('Local horizontal offset in mm.'),
        offsetV: rangeSchema(OR.projection.offsetV).optional().describe('Local vertical offset in mm.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'project_on_surface',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.projectOnSurface(args.objectId, {
            kind: args.kind,
            text: args.text,
            svgContent: args.svgContent,
            mode: args.mode,
            axis: args.axis,
            widthMm: args.widthMm,
            depthMm: args.depthMm,
            colorHex: args.colorHex,
            offsetU: args.offsetU,
            offsetV: args.offsetV,
          })
      )
  );

  // 20. Validador estructural de imprimibilidad 3D (permitido en modo Solo Lectura)
  server.registerTool(
    'kura_analyze_printability',
    {
      title: 'Analyze 3D printability',
      description:
        'Checks fit on the active bed, contact with the bed plane (Z=0), critical overhangs, volume, estimated weight and printing ' +
        'warnings (`warnings` in English and `issues` with code and parameters). Weight and filament are a very rough estimate ' +
        '(`approximate: true`; the real value depends on the slicer) and do not affect the score. Safe in Read-only mode.',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to inspect.'),
        materialPreset: z
          .enum([
            'pla_matte',
            'pla_silk',
            'petg_clear',
            'abs',
            'carbon_fiber',
            'silicone',
            'wax_candle',
            'metallic',
          ])
          .optional()
          .describe('Material for the weight calculation (default: the material assigned to the object, or pla_matte).'),
        infillPercent: rangeSchema(OR.printability.infillPercent)
          .default(OD.printability.infillPercent)
          .describe('Estimated infill percentage (0 to 100).'),
        overhangAngleDeg: rangeSchema(OR.printability.overhangAngleDeg)
          .default(OD.printability.overhangAngleDeg)
          .describe('Maximum unsupported overhang angle in degrees.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'analyze_printability',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.analyzePrintability(args.objectId, {
            materialPreset: args.materialPreset,
            infillPercent: args.infillPercent,
            overhangAngleDeg: args.overhangAngleDeg,
          })
      )
  );

  // 21. Simplificar con verificación: en `simplifyTools.ts`.

  // 22. Refinamiento / subdivisión de malla
  server.registerTool(
    'kura_refine_mesh',
    {
      title: 'Refine 3D mesh',
      description: 'Subdivides and optionally smooths the mesh down to the target edge length in mm.',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to refine.'),
        targetEdgeLengthMm: rangeSchema(OR.refine.targetEdgeLengthMm)
          .default(1.5)
          .describe('Maximum target edge length in millimeters.'),
        smooth: z.boolean().default(true).describe('Enables surface smoothing during refinement.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'refine_mesh',
        { ...args, id: args.objectId },
        () => ctx.headless.refineMesh(args.objectId, args.targetEdgeLengthMm, args.smooth)
      )
  );

  // 23. Generador paramétrico de roscas métricas ISO
  server.registerTool(
    'kura_create_thread',
    {
      title: 'Create ISO metric thread 3D',
      description:
        'Generates a threaded bolt, hexagonal nut or negative threaded cavity with calibrated clearance for 3D printing.',
      inputSchema: {
        kind: z.enum(['bolt', 'nut', 'hole']).describe('Threaded element type.'),
        diameterMm: rangeSchema(OR.thread.diameterMm).default(8).describe('Nominal metric diameter in mm (e.g. 8 for M8; M3–M64).'),
        pitchMm: rangeSchema(OR.thread.pitchMm).optional().describe('Thread pitch in mm (maximum d/4). If omitted, ISO coarse pitch for the diameter.'),
        lengthMm: rangeSchema(OR.thread.lengthMm).optional().describe('Threaded length in mm (nut: height). If omitted: nut 0.8·d (≈ ISO 4032), bolt/hole 2.5·d.'),
        clearanceMm: rangeSchema(OR.thread.clearanceMm).optional().describe('Radial print clearance in mm. If omitted, it is calculated from the pitch.'),
        includeHead: z.boolean().optional().describe('Include hexagonal head when kind === "bolt".'),
        targetId: z.string().optional().describe('kind === "hole" only: object to drill. The cavity is centered on its top face, going down, and grouped with it (app only).'),
        name: nameSchema.optional().describe('Optional name of the generated part.'),
        placement: placementSchema,
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'create_thread', args, () =>
        ctx.headless.createThread({
          kind: args.kind,
          diameterMm: args.diameterMm,
          pitchMm: args.pitchMm ?? threadDefaults(args.diameterMm, args.kind).pitchMm,
          lengthMm: args.lengthMm ?? threadDefaults(args.diameterMm, args.kind).lengthMm,
          clearanceMm: args.clearanceMm,
          includeHead: args.includeHead,
          name: args.name,
        }, args.placement)
      )
  );

  // 24. Envolvente convexa (Convex Hull)
  server.registerTool(
    'kura_convex_hull',
    {
      title: 'Generate convex hull',
      description: 'Creates a closed solid that convexly wraps one or more selected objects.',
      inputSchema: {
        objectIds: z.array(idSchema).max(256).min(1).describe('List of IDs of the objects to wrap.'),
        name: nameSchema.optional().describe('Optional name of the resulting object.'),
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'convex_hull', args, () =>
        ctx.headless.convexHull(args.objectIds, args.name)
      )
  );

  // 25. Alineación inteligente y distribución en cama
  server.registerTool(
    'kura_align_objects',
    {
      title: 'Align or distribute objects on bed',
      description:
        'Aligns multiple objects by edges or centers (min/center/max on X/Y/Z; minZ = bottom, maxZ = top, minY = front) ' +
        'or automatically distributes them in a grid on the bed.',
      inputSchema: {
        objectIds: z.array(idSchema).max(256).min(1).describe('IDs of the objects to align or distribute.'),
        mode: z
          .enum([
            'minX',
            'centerX',
            'maxX',
            'minY',
            'centerY',
            'maxY',
            'minZ',
            'centerZ',
            'maxZ',
            'arrange_grid',
          ])
          .describe('Alignment or grid distribution mode.'),
        spacingMm: rangeSchema(OR.align.spacingMm)
          .optional()
          .describe(
            'Spacing in mm between parts when mode === "arrange_grid". The engine uses a fixed 8 mm: with arrange_grid any other value is rejected. Other modes ignore it (the result lists it in ignoredParams).'
          ),
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'align_objects', args, () =>
        ctx.headless.alignObjects(args.objectIds, args.mode, args.spacingMm)
      )
  );

  // 26. Asignación de preset de material PBR físico/visual
  server.registerTool(
    'kura_set_material',
    {
      title: 'Assign PBR material to object',
      description:
        'Sets the physical/visual material preset of the object (pla_matte, pla_silk, petg_clear, abs, carbon_fiber, silicone, wax_candle, metallic).',
      inputSchema: {
        objectId: idSchema.describe('Object ID.'),
        materialPreset: z
          .enum([
            'pla_matte',
            'pla_silk',
            'petg_clear',
            'abs',
            'carbon_fiber',
            'silicone',
            'wax_candle',
            'metallic',
          ])
          .describe('Identifier of the PBR material preset.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'set_material',
        { ...args, id: args.objectId },
        () => ctx.headless.setMaterial(args.objectId, args.materialPreset)
      )
  );

  // 27. Detección determinística de sub-estructuras geométricas (Solo Lectura)
  server.registerTool(
    'kura_detect_structures',
    {
      title: 'Detect sub-structures of 3D model',
      description:
        'Analyzes disconnected islands, dihedral folds and proportions of the object to detect geometric sub-structures (tanks, tubes, domes, blocks, main body). Safe in Read-only mode.',
      inputSchema: {
        objectId: idSchema.describe('ID of the 3D object to analyze.'),
        creaseAngleDeg: rangeSchema(OR.detect.creaseAngleDeg)
          .optional()
          .describe(`Dihedral threshold angle in degrees (${OR.detect.creaseAngleDeg.min} to ${OR.detect.creaseAngleDeg.max}, default 28). Lower values detect more regions.`),
        minRegionPercent: rangeSchema(OR.detect.minRegionPercent)
          .optional()
          .describe(`Minimum percentage of triangles to keep a region (${OR.detect.minRegionPercent.min} to ${OR.detect.minRegionPercent.max}, default 1.5).`),
        maxRegions: rangeSchema(OR.detect.maxRegions)
          .optional()
          .describe(`Maximum number of highlighted regions to return (${OR.detect.maxRegions.min} to ${OR.detect.maxRegions.max}, default 12).`),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'detect_structures',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.detectStructures(args.objectId, {
            creaseAngleDeg: args.creaseAngleDeg,
            minRegionPercent: args.minRegionPercent,
            maxRegions: args.maxRegions,
          })
      )
  );

  // 28. Coloreado por sub-estructuras detectadas
  server.registerTool(
    'kura_colorize_structures',
    {
      title: 'Color detected sub-structures',
      description:
        'Detects the structural regions of the model and assigns distinct colors per sub-structure for visual inspection or multicolor printing.',
      inputSchema: {
        objectId: idSchema.describe('ID of the 3D object to color by structure.'),
        creaseAngleDeg: rangeSchema(OR.detect.creaseAngleDeg)
          .optional()
          .describe(`Dihedral threshold angle in degrees (${OR.detect.creaseAngleDeg.min} to ${OR.detect.creaseAngleDeg.max}, default 28).`),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'colorize_structures',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.colorizeStructures(args.objectId, {
            creaseAngleDeg: args.creaseAngleDeg,
          })
      )
  );

  // 29. Extracción de una sub-estructura a objeto independiente
  server.registerTool(
    'kura_extract_structure',
    {
      title: 'Extract sub-structure as independent part',
      description:
        'Extracts a previously detected structural region (`regionId`) as a new independent 3D object, optionally removing those faces from the source object.',
      inputSchema: {
        objectId: idSchema.describe('Source object ID.'),
        regionId: idSchema.describe('ID of the structural region returned by kura_detect_structures.'),
        removeFromSource: z
          .boolean()
          .optional()
          .describe('If true, removes the extracted faces from the source object (default false).'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'extract_structure',
        { ...args, id: args.objectId },
        () =>
          ctx.headless.extractStructure(
            args.objectId,
            args.regionId,
            args.removeFromSource ?? false
          )
      )
  );

  // 30. Simetría / Espejo geométrico (Mirror)
  server.registerTool(
    'kura_mirror_object',
    {
      title: 'Mirror object on X, Y or Z axis, or across a plane with a copy',
      description:
        'Mirror image of a part (inverted coordinates and triangle winding so outward normals stay valid). With only axis (x, y or z; Z = upside down) it ' +
        'mirrors the mesh in place. With plane (yz, xz or xy, perpendicular to X, Y or Z), at (object: the part center, or bed: the bed center), ' +
        'offsetMm (shift of the plane along its axis, user axes) or keepOriginal, it reflects the part across that world plane: keepOriginal true (default) ' +
        'adds the reflection and keeps the part (in the app both go in a named group, one undo step), false replaces the part (it must be unlocked). ' +
        'union: true merges part and reflection. dryRun: true returns the plane without changing anything.',
      inputSchema: {
        objectId: idSchema.optional().describe('ID of the 3D object to mirror (plane mode also accepts ids).'),
        ids: z.array(idSchema).min(1).max(256).optional().describe('Parts to mirror across the plane.'),
        axis: z.enum(['x', 'y', 'z']).optional().describe('Mirror symmetry axis (x, y or z); with plane it must agree.'),
        plane: z.enum(MIRROR_PLANES as unknown as [string, ...string[]]).optional().describe('Mirror plane: yz (mirrors along X), xz (along Y) or xy (along Z).'),
        at: z.enum(MIRROR_BASES as unknown as [string, ...string[]]).optional().describe('The plane goes through the part center (object, default) or the bed center (bed).'),
        offsetMm: rangeSchema(PATTERN_RANGES.offsetMm).optional().describe('Shift of the plane along its axis in mm (default 0).'),
        keepOriginal: z.boolean().optional().describe('Keep the original and add the reflection (default true in plane mode).'),
        union: z.boolean().optional().describe('Merge part and reflection into one piece.'),
        dryRun: z.boolean().optional().describe('true = only the plane, nothing changes.'),
      },
    },
    async (args) => {
      const planeMode = isMirrorPlaneRequest(args as Record<string, unknown>);
      if (!planeMode && !args.axis) return failCoded('invalid-params', 'Give axis (x, y or z) or plane (yz, xz or xy).', {});
      return dispatchWithFallback(
        ctx,
        'mirror_object',
        { ...args, ...(args.objectId ? { id: args.objectId } : {}) },
        () => (planeMode
          ? ctx.headless.pattern('mirror_plane', { ...args })
          : ctx.headless.mirrorObject(args.objectId ?? '', args.axis as 'x' | 'y' | 'z'))
      );
    }
  );

  /* ------------------------------------------------------------------------ */
  /* Recursos MCP de solo lectura (`kura://scene/state` y `kura://info/about`)*/
  /* ------------------------------------------------------------------------ */

  mcpServer.registerResource(
    'scene-state',
    'kura://scene/state',
    {
      title: 'Current Kurra Studio scene state',
      description: 'JSON snapshot of the objects, units and active printer profile.',
      mimeType: 'application/json',
    },
    async (uri) => {
      let state: unknown;
      if (ctx.bridge.isConnected()) {
        try {
          const resp = await ctx.bridge.sendCommand('get_scene_state', {});
          state = resp.ok ? { mode: 'live-bridge', ...(resp.result as object) } : ctx.headless.getSceneState();
        } catch {
          state = ctx.headless.getSceneState();
        }
      } else {
        state = ctx.headless.getSceneState();
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(state, null, 2),
          },
        ],
      };
    }
  );

  mcpServer.registerResource(
    'about-kura3d',
    'kura://info/about',
    {
      title: 'Kurra Studio MCP information',
      description: 'Authorship metadata, AGPL-3.0-or-later license and WebSocket bridge connection status.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              name: 'Kurra Studio MCP Server',
              version: '0.5.0',
              author: 'Nicolás Groth <ngroth@gmail.com>',
              organization: 'ISGROTH — Innovación y Soluciones GROTH',
              license: 'AGPL-3.0-or-later',
              port: ctx.bridge.getPort(),
              bridgePort: ctx.bridge.getPort(),
              bridgeListening: ctx.bridge.isListening(),
              liveUiConnected: ctx.bridge.isConnected(),
              authEnabled: ctx.bridge.hasAuthToken(),
              bridgeStartupError: ctx.bridge.getStartupError(),
              readOnly: ctx.bridge.isReadOnly(),
              serverReadOnly: ctx.bridge.isServerReadOnly(),
              readCommands: READ_COMMANDS,
              rotationPersistent: ctx.bridge.isRotationPersistent(),
              exportDir: ctx.bridge.getExportDir(),
              maxMessageBytes: ctx.bridge.getMaxMessageBytes(),
              rateLimitPerMin: ctx.bridge.getRateLimitPerMin(),
            },
            null,
            2
          ),
        },
      ],
    })
  );
}
