/**
 * @file mcp-server/src/tools.ts
 * @description Registro de todas las herramientas y recursos MCP de Kura3D.
 * Soporta ejecución dual transparente: Live Bridge WebSocket (UI viva en tiempo real)
 * y Headless Standalone (motor en memoria con exportación STL/3MF directa a disco).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { writeFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { isEngineError } from '../../src/engine/engineErrors';
import { OPERATION_RANGES } from '../../src/engine/operationLimits';
import { READ_ONLY_COMMANDS, type KuraBridgeServer } from './bridge.js';
import { resolveExportPath } from './exportPaths.js';
import { HeadlessUnsupportedError, type KuraHeadlessEngine } from './headlessEngine.js';
import { HeadlessCommandError } from './headlessSupport.js';
import {
  exportPayloadSchema,
  hexColorSchema,
  idSchema,
  nameSchema,
  outputPathSchema,
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
      `Operación denegada: Kura3D MCP está en modo de seguridad Solo Lectura. Solo se permiten comandos de inspección (${READ_COMMANDS.join(', ')}).`
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
    throw new Error('La UI de Kura3D devolvió una carga de exportación con formato inválido.');
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
 * Envuelve `server.registerTool` para anotar cada herramienta con `readOnlyHint` desde
 * `toolPolicy.ts` (misma fuente de verdad que aplica el rechazo en servidor).
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
 * Ejecuta un comando priorizando el puente WebSocket vivo de Kura3D y cayendo
 * automáticamente al motor Headless cuando la interfaz gráfica no está conectada.
 */
async function dispatchWithFallback(
  ctx: KuraToolContext,
  command: KuraCommandName,
  params: Record<string, unknown>,
  headlessHandler: () => Promise<unknown> | unknown
): Promise<CallToolResult> {
  try {
    enforceSecurityPolicy(ctx, command);

    if (ctx.bridge.isConnected()) {
      const response = await ctx.bridge.sendCommand(command, params, undefined, {
        skipRateLimit: true,
      });
      if (!response.ok) {
        const message = response.error ?? `El comando '${command}' falló en la UI de Kura3D.`;
        const code = (response as { errorCode?: string }).errorCode;
        return code ? failCoded(code, message, {}) : failText(message);
      }
      return okJson({
        mode: 'live-bridge',
        command,
        result: response.result ?? { ok: true },
      });
    }

    const result = await headlessHandler();
    return okJson(result);
  } catch (err) {
    return failError(err);
  }
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
 * `[CÓDIGO] mensaje` más un bloque JSON `{ code, params }` (p. ej. `MESH_INVALID` con
 * `cause: "Non-finite vertex"` o `MESH_EMPTY`), en vez de solo el texto.
 */
function failError(err: unknown): CallToolResult {
  if (isEngineError(err) || err instanceof HeadlessCommandError) {
    return failCoded(err.code, err.message, err.params);
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
      title: 'Obtener estado de la escena 3D',
      description:
        'Devuelve los objetos actuales de la escena, sus transformaciones, dimensiones en mm, unidades activas y perfil de impresora 3D.',
      inputSchema: {},
    },
    async () =>
      dispatchWithFallback(ctx, 'get_scene_state', {}, () => ctx.headless.getSceneState())
  );

  // 2. Creación de primitivas paramétricas
  server.registerTool(
    'kura_create_primitive',
    {
      title: 'Crear primitiva 3D paramétrica',
      description:
        'Crea una primitiva sólida cerrada (box, cylinder, tube, sphere, cone, torus, prism o text) en milímetros.',
      inputSchema: {
        primitiveType: z
          .enum(['box', 'cylinder', 'tube', 'sphere', 'cone', 'torus', 'prism', 'text'])
          .describe('Tipo de primitiva paramétrica a crear.'),
        name: nameSchema.optional().describe('Nombre legible del objeto.'),
        params: primitiveParamsSchema
          .optional()
          .describe('Parámetros dimensionales en milímetros según la primitiva elegida.'),
        position: positionSchema.optional(),
        rotation: rotationSchema.optional(),
        scale: scaleSchema.optional(),
        color: hexColorSchema.optional().describe('Color hexadecimal, por ejemplo #38bdf8.'),
        isHole: z.boolean().optional().describe('Si es true, marca la pieza como volumen de resta.'),
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
            isHole: args.isHole,
          })
      )
  );

  // 3. Transformación de objetos
  server.registerTool(
    'kura_transform_object',
    {
      title: 'Transformar objeto 3D',
      description:
        'Actualiza posición [x, y, z] en mm, rotación Euler [rx, ry, rz] en radianes, escala [sx, sy, sz] o metadatos de un objeto.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto a modificar.'),
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
      title: 'Eliminar objeto 3D',
      description: 'Elimina permanentemente un objeto de la escena por su identificador.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto a eliminar.'),
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
      title: 'Operación booleana CSG',
      description:
        'Ejecuta unión, resta o intersección entre un objeto objetivo y uno o más objetos herramienta.',
      inputSchema: {
        targetId: z.string().describe('ID del objeto base sobre el que se aplica la operación.'),
        toolIds: z.array(idSchema).max(256).min(1).describe('Lista de IDs de objetos herramienta.'),
        operation: z.enum(['union', 'subtract', 'intersect']).describe('Tipo de operación CSG.'),
        keepTools: z
          .boolean()
          .optional()
          .describe('Si es true, conserva los objetos originales en la escena.'),
        resultName: nameSchema.optional().describe('Nombre opcional del objeto resultante.'),
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
      title: 'Ahuecar modelo 3D (Hollow)',
      description:
        'Convierte un sólido en una carcasa hueca con grosor de pared en milímetros y orificio de drenaje opcional.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto a ahuecar.'),
        wallThickness: rangeSchema(OR.hollow.wallThickness).describe('Espesor de pared en milímetros.'),
        drainHole: z.boolean().optional().describe('Agrega orificio inferior de drenaje (resina).'),
        drainHoleRadius: rangeSchema(OR.hollow.drainHoleRadius).optional().describe('Radio del orificio de drenaje en mm.'),
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
      title: 'Cortar modelo por plano',
      description:
        'Divide un objeto mediante un plano en el eje X, Y o Z generando conectores mecánicos opcionales (dowel, peg, dovetail).',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto a cortar.'),
        axis: z.enum(['x', 'y', 'z']).describe('Eje normal del plano de corte.'),
        offset: rangeSchema(OR.cut.offset).default(0).describe('Desplazamiento del plano en mm respecto al centro.'),
        connectorType: z
          .enum(['none', 'dowel', 'peg', 'dovetail'])
          .default('none')
          .describe('Tipo de conector automático entre mitades.'),
        connectorSize: rangeSchema(OR.cut.connectorSize).default(4).describe('Radio/ancho del conector en mm.'),
        connectorDepth: rangeSchema(OR.cut.connectorDepth).default(5).describe('Profundidad del conector en mm.'),
        tolerance: rangeSchema(OR.cut.tolerance).default(0.25).describe('Holgura de encaje en mm.'),
        connectorCount: rangeSchema(OR.cut.connectorCount).default(2),
        keepMode: z.enum(['both', 'positive', 'negative']).default('both'),
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
          })
      )
  );

  // 8. Separar islas desconectadas
  server.registerTool(
    'kura_split_disconnected',
    {
      title: 'Separar islas desconectadas',
      description: 'Divide una malla compuesta por múltiples cuerpos separados en objetos independientes.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto a analizar y separar.'),
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

  // 9. Separar por colores pintados
  server.registerTool(
    'kura_split_by_color',
    {
      title: 'Separar por color',
      description: 'Separa un modelo pintado multicolor en piezas individuales por cada color para impresión multimaterial.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto multicolor a separar.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'split_by_color',
        { ...args, id: args.objectId },
        () => ctx.headless.splitByColor(args.objectId)
      )
  );

  // 10. Aplicar textura procedural
  server.registerTool(
    'kura_apply_texture',
    {
      title: 'Aplicar textura superficial procedural',
      description:
        'Aplica desplazamiento superficial procedural (fuzzy skin, knurling, waves, honeycomb, grid o none).',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto.'),
        pattern: z.enum(['none', 'fuzzy', 'knurling', 'waves', 'honeycomb', 'grid']),
        depth: rangeSchema(OR.texture.depth).default(0.4).describe('Profundidad del relieve en mm.'),
        scale: rangeSchema(OR.texture.scale).default(3).describe('Escala/frecuencia del patrón en mm.'),
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
      title: 'Pintar objeto 3D',
      description: 'Asigna un color hexadecimal (#rrggbb) al material del objeto seleccionado.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto.'),
        color: hexColorSchema.describe('Color hex en formato #rrggbb.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'paint_object',
        { ...args, id: args.objectId },
        () => ctx.headless.paintObject(args.objectId, args.color)
      )
  );

  // 12. Importar y extruir SVG
  server.registerTool(
    'kura_import_svg',
    {
      title: 'Importar y extruir SVG a 3D',
      description: 'Convierte trazos vectoriales SVG en un sólido 3D extruido.',
      inputSchema: {
        svgContent: svgContentSchema.describe('Contenido XML completo del archivo SVG.'),
        name: nameSchema.optional().describe('Nombre del objeto generado.'),
        depth: rangeSchema(OR.svg.depth).default(4).describe('Altura de extrusión en mm.'),
        targetWidth: rangeSchema(OR.svg.targetWidth).default(50).describe('Ancho objetivo en mm.'),
        curveSegments: rangeSchema(OR.svg.curveSegments).default(16),
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
        })
      )
  );

  // 13. Configurar sistema de unidades
  server.registerTool(
    'kura_set_units',
    {
      title: 'Configurar sistema de unidades',
      description: 'Cambia la unidad de visualización de Kura3D (mm, cm, m, in, ft).',
      inputSchema: {
        units: z.enum(['mm', 'cm', 'm', 'in', 'ft']).describe('Unidad de medida deseada.'),
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
      title: 'Seleccionar perfil de impresora 3D',
      description:
        'Establece el volumen de cama y perfil activo entre los 12 presets multi-marca (elegoo-centauri-carbon-2, elegoo-centauri-carbon-1, bambu-p1s-x1c-a1, bambu-a1-mini, bambu-h2d, snapmaker-artisan, snapmaker-j1s, flashforge-ad5m, flashforge-ad5x, generic-220, generic-300 o free-studio).',
      inputSchema: {
        profileId: profileIdSchema.describe('ID del perfil de impresora a activar.'),
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
      title: 'Exportar escena a archivo STL',
      description:
        'Exporta los objetos indicados (o toda la escena visible) en formato STL binario o ASCII directamente en disco.',
      inputSchema: {
        outputPath: outputPathSchema.describe('Ruta destino del archivo .stl en disco.'),
        objectIds: z.array(idSchema).max(256).optional().describe('IDs específicos a exportar (opcional).'),
        binary: z.boolean().default(true).describe('true para STL binario (recomendado), false para ASCII.'),
      },
    },
    async (args) => {
      try {
        enforceSecurityPolicy(ctx, 'export_stl');
        const targetPath = await resolveExportPath(ctx.bridge.getExportDir(), args.outputPath, '.stl');

        if (ctx.bridge.isConnected()) {
          const response = await ctx.bridge.sendCommand(
            'export_stl',
            { objectIds: args.objectIds, binary: args.binary, returnBytes: true },
            undefined,
            { skipRateLimit: true }
          );
          if (!response.ok) {
            return failText(response.error ?? 'Error al exportar STL desde la UI de Kura3D.');
          }
          const written = await writeLiveExport(targetPath, response.result);
          if (written) {
            return okJson({ mode: 'live-bridge', ...written });
          }
          return okJson({ mode: 'live-bridge', result: response.result });
        }

        const result = await ctx.headless.exportStl({
          outputPath: targetPath,
          objectIds: args.objectIds,
          binary: args.binary,
        });
        return okJson(result);
      } catch (err) {
        return failError(err);
      }
    }
  );

  // 16. Exportar 3MF Multi-Slicer
  server.registerTool(
    'kura_export_3mf',
    {
      title: 'Exportar escena a archivo 3MF Multi-Slicer',
      description:
        'Exporta los objetos indicados (o toda la escena visible) en formato estándar 3MF con Metadata/model_settings.config para el laminador destino (generic, elegoo, bambu, snapmaker, flashforge).',
      inputSchema: {
        outputPath: outputPathSchema.describe('Ruta destino del archivo .3mf en disco.'),
        objectIds: z.array(idSchema).max(256).optional().describe('IDs específicos a exportar (opcional).'),
        slicerTarget: z
          .enum(['generic', 'elegoo', 'bambu', 'snapmaker', 'flashforge'])
          .optional()
          .describe('Laminador destino para metadatos 3MF (generic, elegoo, bambu, snapmaker, flashforge).'),
      },
    },
    async (args) => {
      try {
        enforceSecurityPolicy(ctx, 'export_3mf');
        const targetPath = await resolveExportPath(ctx.bridge.getExportDir(), args.outputPath, '.3mf');

        if (ctx.bridge.isConnected()) {
          const response = await ctx.bridge.sendCommand(
            'export_3mf',
            { objectIds: args.objectIds, slicerTarget: args.slicerTarget, returnBytes: true },
            undefined,
            { skipRateLimit: true }
          );
          if (!response.ok) {
            return failText(response.error ?? 'Error al exportar 3MF desde la UI de Kura3D.');
          }
          const written = await writeLiveExport(targetPath, response.result);
          if (written) {
            return okJson({
              mode: 'live-bridge',
              ...written,
              slicerTarget: args.slicerTarget ?? 'generic',
            });
          }
          return okJson({ mode: 'live-bridge', result: response.result });
        }

        const result = await ctx.headless.export3mf({
          outputPath: targetPath,
          objectIds: args.objectIds,
          slicerTarget: args.slicerTarget,
        });
        return okJson(result);
      } catch (err) {
        return failError(err);
      }
    }
  );

  // 17. Capturar captura PNG del viewport 3D vivo
  server.registerTool(
    'kura_capture_viewport',
    {
      title: 'Capturar vista del viewport 3D',
      description:
        'Captura una imagen PNG del viewport 3D cuando la aplicación gráfica Kura3D está conectada vía Live Bridge.',
      inputSchema: {
        width: z.number().int().min(128).max(2048).optional(),
        height: z.number().int().min(128).max(2048).optional(),
      },
    },
    async (args) => {
      try {
        enforceSecurityPolicy(ctx, 'capture_viewport');

        if (!ctx.bridge.isConnected()) {
          throw new HeadlessUnsupportedError(
            'capture_viewport',
            'la captura del viewport necesita el renderizador WebGL de la UI, que no existe en Node.'
          );
        }

        const response = await ctx.bridge.sendCommand('capture_viewport', args, undefined, {
          skipRateLimit: true,
        });
        if (!response.ok) {
          return failText(response.error ?? 'No se pudo capturar el viewport de Kura3D.');
        }

        const payload = (response.result ?? {}) as {
          imageBase64?: string;
          dataUrl?: string;
          mimeType?: string;
        };
        const raw = payload.imageBase64 ?? payload.dataUrl ?? '';
        const cleanBase64 = raw.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

        if (!cleanBase64) {
          return failText('La UI de Kura3D no devolvió datos PNG válidos para la captura.');
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
              text: 'Captura del viewport 3D obtenida correctamente desde Kura3D Live Bridge.',
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
      title: 'Generar molde o contra-molde 3D',
      description:
        'Genera automáticamente un molde o contra-molde de 1 parte, 2 partes con llaves, caja maestra para silicona o núcleo-cavidad a partir de un objeto maestro.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto maestro a partir del cual se genera el molde.'),
        mode: z
          .enum(['direct_1part', 'direct_2part', 'silicone_master', 'core_cavity'])
          .describe('Modo de generación del molde.'),
        wallMarginMm: rangeSchema(OR.mold.wallMarginMm)
          .default(6)
          .describe('Margen de pared exterior del molde en mm (o espesor de silicona).'),
        boxWallMm: rangeSchema(OR.mold.boxWallMm)
          .default(3)
          .describe('Grosor de pared de la caja madre contenedora en mm.'),
        splitAxis: z
          .enum(['x', 'z'])
          .default('x')
          .describe('Eje de partición para moldes de dos mitades.'),
        pourSpout: z
          .boolean()
          .default(true)
          .describe('Si es true, agrega embudo/canal de vertido superior.'),
        pourSpoutRadiusMm: rangeSchema(OR.mold.pourSpoutRadiusMm)
          .default(5)
          .optional()
          .describe('Radio del embudo de vertido en mm.'),
        keyToleranceMm: rangeSchema(OR.mold.keyToleranceMm)
          .default(0.25)
          .describe('Holgura de encaje para llaves de registro en mm.'),
        cavityWallMm: rangeSchema(OR.mold.cavityWallMm)
          .default(3)
          .describe('Espesor de pared de la pieza colada en modo core_cavity (mm).'),
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
          })
      )
  );

  // 19. Proyección conformal de texto o SVG sobre superficie 3D
  server.registerTool(
    'kura_project_on_surface',
    {
      title: 'Proyectar texto o SVG sobre superficie 3D',
      description:
        'Proyecta texto o gráficos SVG sobre una cara o cilindro del objeto en modo relieve (emboss), grabado (deboss) o incrustación multicolor a ras (flush_inlay).',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto objetivo.'),
        kind: z.enum(['text', 'svg']).describe('Tipo de gráfico a proyectar.'),
        text: shortTextSchema.optional().describe('Texto a proyectar cuando kind === "text".'),
        svgContent: svgContentSchema.optional().describe('Contenido XML SVG cuando kind === "svg".'),
        mode: z
          .enum(['emboss', 'deboss', 'flush_inlay'])
          .describe('Modo de aplicación superficial.'),
        axis: z
          .enum(['+z', '-z', '+x', '-x', '+y', '-y', 'cylindrical'])
          .default('+z')
          .describe('Dirección o envoltura cilíndrica de proyección.'),
        widthMm: rangeSchema(OR.projection.widthMm).default(24).describe('Ancho proyectado en mm.'),
        depthMm: rangeSchema(OR.projection.depthMm).default(1.2).describe('Profundidad de relieve/grabado en mm.'),
        colorHex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default('#f97316')
          .describe('Color hexadecimal (#rrggbb) para la proyección o incrustación.'),
        offsetU: rangeSchema(OR.projection.offsetU).optional().describe('Desplazamiento horizontal local en mm.'),
        offsetV: rangeSchema(OR.projection.offsetV).optional().describe('Desplazamiento vertical local en mm.'),
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
      title: 'Analizar imprimibilidad 3D',
      description:
        'Evalúa encaje en la cama activa, contacto con el plano Y=0, voladizos críticos, volumen, peso estimado y advertencias de impresión. Seguro en modo Solo Lectura.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto a inspeccionar.'),
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
          .describe('Material para el cálculo de peso (por defecto el asignado al objeto o pla_matte).'),
        infillPercent: rangeSchema(OR.printability.infillPercent)
          .default(20)
          .describe('Porcentaje de relleno estimado (0 a 100).'),
        overhangAngleDeg: rangeSchema(OR.printability.overhangAngleDeg)
          .default(45)
          .describe('Ángulo máximo de voladizo sin soporte en grados.'),
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

  // 21. Simplificación adaptativa de malla
  server.registerTool(
    'kura_simplify_mesh',
    {
      title: 'Simplificar malla 3D',
      description: 'Reduce la densidad de triángulos respetando la tolerancia geométrica en mm.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto a simplificar.'),
        toleranceMm: rangeSchema(OR.simplify.toleranceMm)
          .default(0.1)
          .describe('Tolerancia máxima de desviación geométrica en mm.'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'simplify_mesh',
        { ...args, id: args.objectId },
        () => ctx.headless.simplifyMesh(args.objectId, args.toleranceMm)
      )
  );

  // 22. Refinamiento / subdivisión de malla
  server.registerTool(
    'kura_refine_mesh',
    {
      title: 'Refinar malla 3D',
      description: 'Subdivide y suaviza opcionalmente la malla hasta la longitud de arista objetivo en mm.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto a refinar.'),
        targetEdgeLengthMm: rangeSchema(OR.refine.targetEdgeLengthMm)
          .default(1.5)
          .describe('Longitud máxima de arista objetivo en milímetros.'),
        smooth: z.boolean().default(true).describe('Activa suavizado superficial durante el refinado.'),
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
      title: 'Crear rosca métrica ISO 3D',
      description:
        'Genera un perno roscado, tuerca hexagonal o cavidad roscada negativa con holgura calibrada para impresión 3D.',
      inputSchema: {
        kind: z.enum(['bolt', 'nut', 'hole']).describe('Tipo de elemento roscado.'),
        diameterMm: rangeSchema(OR.thread.diameterMm).default(8).describe('Diámetro nominal métrico en mm (ej. 8 para M8; M2–M64).'),
        pitchMm: rangeSchema(OR.thread.pitchMm).default(1.25).describe('Paso de rosca en mm (máximo d/4).'),
        lengthMm: rangeSchema(OR.thread.lengthMm).default(20).describe('Longitud roscada en mm.'),
        clearanceMm: rangeSchema(OR.thread.clearanceMm).optional().describe('Holgura radial de impresión en mm. Si se omite, se calcula según el paso.'),
        includeHead: z.boolean().optional().describe('Incluir cabeza hexagonal cuando kind === "bolt".'),
        name: nameSchema.optional().describe('Nombre opcional de la pieza generada.'),
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'create_thread', args, () =>
        ctx.headless.createThread({
          kind: args.kind,
          diameterMm: args.diameterMm,
          pitchMm: args.pitchMm,
          lengthMm: args.lengthMm,
          clearanceMm: args.clearanceMm,
          includeHead: args.includeHead,
          name: args.name,
        })
      )
  );

  // 24. Envolvente convexa (Convex Hull)
  server.registerTool(
    'kura_convex_hull',
    {
      title: 'Generar envolvente convexa (Convex Hull)',
      description: 'Crea un sólido cerrado que envuelve convexamente a uno o varios objetos seleccionados.',
      inputSchema: {
        objectIds: z.array(idSchema).max(256).min(1).describe('Lista de IDs de objetos a envolver.'),
        name: nameSchema.optional().describe('Nombre opcional del objeto resultante.'),
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
      title: 'Alinear o distribuir objetos en cama',
      description:
        'Alinea múltiples objetos según bordes o centros (min/center/max en X/Y/Z) o los distribuye automáticamente en grilla sobre la cama.',
      inputSchema: {
        objectIds: z.array(idSchema).max(256).min(1).describe('IDs de los objetos a alinear o distribuir.'),
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
          .describe('Modo de alineación o distribución en grilla.'),
        spacingMm: z
          .number()
          .min(0)
          .optional()
          .describe(
            'Separación en mm entre piezas cuando mode === "arrange_grid". El motor usa 8 mm fijos; en modo headless otro valor se rechaza.'
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
      title: 'Asignar material PBR al objeto',
      description:
        'Establece el preset de material físico/visual del objeto (pla_matte, pla_silk, petg_clear, abs, carbon_fiber, silicone, wax_candle, metallic).',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto.'),
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
          .describe('Identificador del preset de material PBR.'),
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
      title: 'Detectar sub-estructuras del modelo 3D',
      description:
        'Analiza islas desconectadas, pliegues diedros y proporciones del objeto para detectar sub-estructuras geométricas (tanques, tubos, cúpulas, bloques, cuerpo principal). Seguro en modo Solo Lectura.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto 3D a analizar.'),
        creaseAngleDeg: z
          .number()
          .min(5)
          .max(85)
          .optional()
          .describe('Ángulo diedro umbral en grados (5 a 85, por defecto 28). Menor valor detecta más regiones.'),
        minRegionPercent: z
          .number()
          .min(0.1)
          .max(100)
          .optional()
          .describe('Porcentaje mínimo de triángulos para conservar una región (por defecto 1.5).'),
        maxRegions: z
          .number()
          .int()
          .min(1)
          .max(64)
          .optional()
          .describe('Cantidad máxima de regiones destacadas a devolver (por defecto 12).'),
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
      title: 'Colorear sub-estructuras detectadas',
      description:
        'Detecta las regiones estructurales del modelo y asigna colores diferenciados por sub-estructura para inspección visual o impresión multicolor.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto 3D a colorear por estructuras.'),
        creaseAngleDeg: z
          .number()
          .min(5)
          .max(85)
          .optional()
          .describe('Ángulo diedro umbral en grados (5 a 85, por defecto 28).'),
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
      title: 'Extraer sub-estructura como pieza independiente',
      description:
        'Extrae una región estructural previamente detectada (`regionId`) como un nuevo objeto 3D independiente, con opción de remover esas caras del objeto origen.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto origen.'),
        regionId: idSchema.describe('ID de la región estructural devuelta por kura_detect_structures.'),
        removeFromSource: z
          .boolean()
          .optional()
          .describe('Si es true, elimina las caras extraídas del objeto origen (por defecto false).'),
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
      title: 'Reflejar objeto (Mirror) en eje X, Y o Z',
      description:
        'Genera un reflejo especular exacto de la malla a lo largo del eje X, Y o Z invirtiendo coordenadas y orientación (winding) de triángulos para mantener normales salientes válidas.',
      inputSchema: {
        objectId: idSchema.describe('ID del objeto 3D a reflejar.'),
        axis: z.enum(['x', 'y', 'z']).describe('Eje de simetría especular (x, y o z).'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'mirror_object',
        { ...args, id: args.objectId },
        () => ctx.headless.mirrorObject(args.objectId, args.axis)
      )
  );

  /* ------------------------------------------------------------------------ */
  /* Recursos MCP de solo lectura (`kura://scene/state` y `kura://info/about`)*/
  /* ------------------------------------------------------------------------ */

  mcpServer.registerResource(
    'scene-state',
    'kura://scene/state',
    {
      title: 'Estado actual de la escena Kura3D',
      description: 'Instantánea JSON de los objetos, unidades y perfil de impresora activos.',
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
      title: 'Información de Kura3D MCP',
      description: 'Metadatos de autoría, licencia MIT y estado de conexión del puente WebSocket.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              name: 'Kura3D MCP Server',
              version: '0.5.0',
              author: 'Nicolás Groth <ngroth@gmail.com>',
              organization: 'ISGROTH — Innovación y Soluciones GROTH',
              license: 'MIT',
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
