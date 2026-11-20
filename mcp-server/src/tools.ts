/**
 * @file mcp-server/src/tools.ts
 * @description Registro de todas las herramientas y recursos MCP de Kura3D.
 * Soporta ejecución dual transparente: Live Bridge WebSocket (UI viva en tiempo real)
 * y Headless Standalone (motor en memoria con exportación STL/3MF directa a disco).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { READ_ONLY_COMMANDS, type KuraBridgeServer } from './bridge.js';
import type { KuraHeadlessEngine } from './headlessEngine.js';
import type { KuraCommandName } from './types.js';

export { READ_ONLY_COMMANDS };

/** Dependencias inyectadas al registrar herramientas y recursos MCP. */
export interface KuraToolContext {
  bridge: KuraBridgeServer;
  headless: KuraHeadlessEngine;
}

const vec3Schema = z
  .tuple([z.number(), z.number(), z.number()])
  .describe('Vector 3D [X, Y, Z] en milímetros (o radianes en rotación / factor en escala).');

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
  if (ctx.bridge.isReadOnly() && !READ_ONLY_COMMANDS.has(command)) {
    throw new Error(
      `Operación denegada: Kura3D MCP está ejecutándose en modo de seguridad Solo Lectura (KURA_BRIDGE_READ_ONLY=true). Solo se permiten comandos de inspección (${Array.from(READ_ONLY_COMMANDS).join(', ')}).`
    );
  }
  ctx.bridge.consumeRateLimit();
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
        return failText(response.error ?? `El comando '${command}' falló en la UI de Kura3D.`);
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
    const message = err instanceof Error ? err.message : String(err);
    return failText(message);
  }
}

/**
 * Registra el catálogo completo de herramientas MCP (`kura_*`) y recursos (`kura://*`)
 * sobre la instancia `McpServer` proporcionada.
 */
export function registerKuraTools(server: McpServer, ctx: KuraToolContext): void {
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
        name: z.string().optional().describe('Nombre legible del objeto.'),
        params: z
          .object({
            width: z.number().positive().optional(),
            height: z.number().positive().optional(),
            depth: z.number().positive().optional(),
            radius: z.number().positive().optional(),
            outerRadius: z.number().positive().optional(),
            innerRadius: z.number().positive().optional(),
            tubeRadius: z.number().positive().optional(),
            segments: z.number().int().min(3).max(128).optional(),
            sides: z.number().int().min(3).max(64).optional(),
            text: z.string().optional(),
            fontSize: z.number().positive().optional(),
            bevel: z.number().min(0).optional(),
          })
          .optional()
          .describe('Parámetros dimensionales en milímetros según la primitiva elegida.'),
        position: vec3Schema.optional(),
        rotation: vec3Schema.optional(),
        scale: vec3Schema.optional(),
        color: z.string().optional().describe('Color hexadecimal, por ejemplo #38bdf8.'),
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
        objectId: z.string().describe('ID del objeto a modificar.'),
        position: vec3Schema.optional(),
        rotation: vec3Schema.optional(),
        scale: vec3Schema.optional(),
        name: z.string().optional(),
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
        objectId: z.string().describe('ID del objeto a eliminar.'),
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
        toolIds: z.array(z.string()).min(1).describe('Lista de IDs de objetos herramienta.'),
        operation: z.enum(['union', 'subtract', 'intersect']).describe('Tipo de operación CSG.'),
        keepTools: z
          .boolean()
          .optional()
          .describe('Si es true, conserva los objetos originales en la escena.'),
        resultName: z.string().optional().describe('Nombre opcional del objeto resultante.'),
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
        objectId: z.string().describe('ID del objeto a ahuecar.'),
        wallThickness: z.number().positive().describe('Espesor de pared en milímetros.'),
        drainHole: z.boolean().optional().describe('Agrega orificio inferior de drenaje (resina).'),
        drainHoleRadius: z.number().positive().optional().describe('Radio del orificio de drenaje en mm.'),
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
        objectId: z.string().describe('ID del objeto a cortar.'),
        axis: z.enum(['x', 'y', 'z']).describe('Eje normal del plano de corte.'),
        offset: z.number().default(0).describe('Desplazamiento del plano en mm respecto al centro.'),
        connectorType: z
          .enum(['none', 'dowel', 'peg', 'dovetail'])
          .default('none')
          .describe('Tipo de conector automático entre mitades.'),
        connectorSize: z.number().positive().default(4).describe('Radio/ancho del conector en mm.'),
        connectorDepth: z.number().positive().default(5).describe('Profundidad del conector en mm.'),
        tolerance: z.number().min(0).default(0.25).describe('Holgura de encaje en mm.'),
        connectorCount: z.number().int().min(1).max(4).default(2),
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
        objectId: z.string().describe('ID del objeto a analizar y separar.'),
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
        objectId: z.string().describe('ID del objeto multicolor a separar.'),
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
        objectId: z.string().describe('ID del objeto.'),
        pattern: z.enum(['none', 'fuzzy', 'knurling', 'waves', 'honeycomb', 'grid']),
        depth: z.number().min(0).default(0.4).describe('Profundidad del relieve en mm.'),
        scale: z.number().positive().default(3).describe('Escala/frecuencia del patrón en mm.'),
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
        objectId: z.string().describe('ID del objeto.'),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).describe('Color hex en formato #rrggbb.'),
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
        svgContent: z.string().min(1).describe('Contenido XML completo del archivo SVG.'),
        name: z.string().optional().describe('Nombre del objeto generado.'),
        depth: z.number().positive().default(4).describe('Altura de extrusión en mm.'),
        targetWidth: z.number().positive().default(50).describe('Ancho objetivo en mm.'),
        curveSegments: z.number().int().min(4).max(64).default(16),
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'import_svg', args, () =>
        ctx.headless.importSvg({
          svgContent: args.svgContent,
          name: args.name,
          depth: args.depth,
          targetWidth: args.targetWidth,
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
        'Establece el volumen de cama y perfil activo (elegoo-centauri-carbon-2, generic-220, generic-300 o free-studio).',
      inputSchema: {
        profileId: z.string().describe('ID del perfil de impresora a activar.'),
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
        outputPath: z.string().describe('Ruta destino del archivo .stl en disco.'),
        objectIds: z.array(z.string()).optional().describe('IDs específicos a exportar (opcional).'),
        binary: z.boolean().default(true).describe('true para STL binario (recomendado), false para ASCII.'),
      },
    },
    async (args) => {
      try {
        enforceSecurityPolicy(ctx, 'export_stl');

        if (ctx.bridge.isConnected()) {
          const response = await ctx.bridge.sendCommand(
            'export_stl',
            {
              ...args,
              returnBytes: true,
            },
            undefined,
            { skipRateLimit: true }
          );
          if (!response.ok) {
            return failText(response.error ?? 'Error al exportar STL desde la UI de Kura3D.');
          }
          const payload = (response.result ?? {}) as { bytesBase64?: string; text?: string };
          if (payload.bytesBase64 || payload.text) {
            const resolved = resolve(args.outputPath);
            await mkdir(dirname(resolved), { recursive: true });
            const buffer = payload.bytesBase64
              ? Buffer.from(payload.bytesBase64, 'base64')
              : Buffer.from(payload.text ?? '', 'utf8');
            await writeFile(resolved, buffer);
            return okJson({
              mode: 'live-bridge',
              path: resolved,
              bytesWritten: buffer.byteLength,
            });
          }
          return okJson({ mode: 'live-bridge', result: response.result });
        }

        const result = await ctx.headless.exportStl({
          outputPath: args.outputPath,
          objectIds: args.objectIds,
          binary: args.binary,
        });
        return okJson(result);
      } catch (err) {
        return failText(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // 16. Exportar 3MF
  server.registerTool(
    'kura_export_3mf',
    {
      title: 'Exportar escena a archivo 3MF',
      description:
        'Exporta los objetos indicados (o toda la escena visible) en formato estándar 3MF para laminadores modernos.',
      inputSchema: {
        outputPath: z.string().describe('Ruta destino del archivo .3mf en disco.'),
        objectIds: z.array(z.string()).optional().describe('IDs específicos a exportar (opcional).'),
      },
    },
    async (args) => {
      try {
        enforceSecurityPolicy(ctx, 'export_3mf');

        if (ctx.bridge.isConnected()) {
          const response = await ctx.bridge.sendCommand(
            'export_3mf',
            {
              ...args,
              returnBytes: true,
            },
            undefined,
            { skipRateLimit: true }
          );
          if (!response.ok) {
            return failText(response.error ?? 'Error al exportar 3MF desde la UI de Kura3D.');
          }
          const payload = (response.result ?? {}) as { bytesBase64?: string };
          if (payload.bytesBase64) {
            const resolved = resolve(args.outputPath);
            await mkdir(dirname(resolved), { recursive: true });
            const buffer = Buffer.from(payload.bytesBase64, 'base64');
            await writeFile(resolved, buffer);
            return okJson({
              mode: 'live-bridge',
              path: resolved,
              bytesWritten: buffer.byteLength,
            });
          }
          return okJson({ mode: 'live-bridge', result: response.result });
        }

        const result = await ctx.headless.export3mf({
          outputPath: args.outputPath,
          objectIds: args.objectIds,
        });
        return okJson(result);
      } catch (err) {
        return failText(err instanceof Error ? err.message : String(err));
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
          return okJson({
            mode: 'headless',
            captured: false,
            message:
              'La captura visual requiere la interfaz gráfica de Kura3D abierta y conectada al puente WebSocket.',
          });
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
        return failText(err instanceof Error ? err.message : String(err));
      }
    }
  );

  /* ------------------------------------------------------------------------ */
  /* Recursos MCP de solo lectura (`kura://scene/state` y `kura://info/about`)*/
  /* ------------------------------------------------------------------------ */

  server.registerResource(
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

  server.registerResource(
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
              version: '1.0.0',
              author: 'Nicolás Groth <ngroth@gmail.com>',
              organization: 'ISGROTH — Innovación y Soluciones GROTH',
              license: 'MIT',
              port: ctx.bridge.getPort(),
              bridgePort: ctx.bridge.getPort(),
              bridgeListening: ctx.bridge.isListening(),
              liveUiConnected: ctx.bridge.isConnected(),
              authEnabled: ctx.bridge.hasAuthToken(),
              readOnly: ctx.bridge.isReadOnly(),
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
