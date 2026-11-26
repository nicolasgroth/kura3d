/**
 * @file mcp-server/src/schemas.ts
 * @description Esquemas Zod para tratar como datos todo texto que llega del cliente MCP o de la UI
 * (nombres, IDs, textos, SVG, mensajes del puente): límites de longitud, sin caracteres de control
 * y formas estrictas. Ningún valor validado aquí se evalúa ni se interpola en comandos del sistema.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { z } from 'zod';
import {
  EDGE_SCOPES,
  EDGE_STYLES,
  PRIMITIVE_LIMITS,
  PRIMITIVE_PARAM_RANGES,
  TEXT_ALIGN_OPTIONS,
  type ParamRange,
} from '../../src/engine/primitiveLimits';
import { TRANSFORM_RANGES, type OperationRange } from '../../src/engine/operationLimits';

/** Caracteres de control C0/C1 (excepto ninguno: los nombres son de una línea). */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/** Nombre legible de objeto: 1–128 caracteres, una línea, sin caracteres de control. */
export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((v) => !CONTROL_CHARS.test(v), 'Name cannot contain control characters.');

/** Identificador de objeto o región: 1–128 caracteres imprimibles sin espacios. */
export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^\s\u0000-\u001f\u007f-\u009f]+$/, 'Invalid ID.');

/** Texto corto para primitivas de texto o proyección (permite saltos de línea, no otros controles). */
export const shortTextSchema = z
  .string()
  .max(500)
  .refine((v) => !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v), 'Text contains control characters.');

const ranged = (range: ParamRange) => {
  const base = z.number().min(range.min).max(range.max);
  return (range.integer ? base.int() : base).optional();
};

/**
 * Parámetros de primitiva con los mismos rangos que el motor (`src/engine/primitiveLimits.ts`):
 * un valor aceptado aquí no puede ser rechazado después por rango (las restricciones cruzadas
 * como radio interior < exterior las sigue validando el motor con un error tipado).
 */
export const primitiveParamsSchema = z.object({
  width: ranged(PRIMITIVE_PARAM_RANGES.width),
  height: ranged(PRIMITIVE_PARAM_RANGES.height),
  depth: ranged(PRIMITIVE_PARAM_RANGES.depth),
  radius: ranged(PRIMITIVE_PARAM_RANGES.radius),
  outerRadius: ranged(PRIMITIVE_PARAM_RANGES.outerRadius),
  innerRadius: ranged(PRIMITIVE_PARAM_RANGES.innerRadius),
  tubeRadius: ranged(PRIMITIVE_PARAM_RANGES.tubeRadius),
  segments: ranged(PRIMITIVE_PARAM_RANGES.segments),
  sides: ranged(PRIMITIVE_PARAM_RANGES.sides),
  text: shortTextSchema.pipe(z.string().max(PRIMITIVE_LIMITS.maxTextLength)).optional(),
  fontSize: ranged(PRIMITIVE_PARAM_RANGES.fontSize),
  letterSpacing: ranged(PRIMITIVE_PARAM_RANGES.letterSpacing),
  textAlign: z.enum(TEXT_ALIGN_OPTIONS).optional(),
  bevel: ranged(PRIMITIVE_PARAM_RANGES.bevel),
  edgeStyle: z
    .enum(EDGE_STYLES)
    .optional()
    .describe("Edges of box, cylinder, tube and prism: 'sharp' (default), 'round' (radius) or 'chamfer' (45°). Outer size does not change."),
  edgeSize: ranged(PRIMITIVE_PARAM_RANGES.edgeSize).describe(
    'Edge radius or chamfer in mm (default 2). Above half the smallest affected size it is clamped; the response reports edgeSizeApplied, edgeSizeMax and edgeSizeClamped.'
  ),
  edgeScope: z
    .enum(EDGE_SCOPES)
    .optional()
    .describe("Which edges: 'all'; 'vertical' (plan corners only, box and prism, default there: no overhang at the base); 'top' (top rim only, default for cylinder and tube). Cylinder and tube accept 'all' and 'top'."),
});

/** Contenido SVG acotado a 2 MB (se parsea como datos, nunca se ejecuta). */
export const svgContentSchema = z.string().min(1).max(2_000_000);

/** Color hexadecimal `#rrggbb`. */
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** ID de perfil de impresora (slug). */
export const profileIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

/** Ruta de exportación solicitada (se confina luego con `resolveExportPath`). */
export const outputPathSchema = z.string().min(1).max(1024);

/** Respuesta de la UI de Kurra Studio a un comando del Command Bus. */
export const uiCommandResponseSchema = z.object({
  id: z.string().min(1).max(128),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().max(4000).optional(),
});

/** Mensajes de control que la UI puede enviar al puente. */
export const uiControlMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rotate_token'), token: z.string().max(512) }),
  z.object({ type: z.literal('pong'), ts: z.number().optional() }),
]);

/** Carga útil binaria devuelta por la UI al exportar (base64 o texto ASCII). */
export const exportPayloadSchema = z
  .object({
    bytesBase64: z.string().regex(/^[A-Za-z0-9+/=\s]*$/).optional(),
    text: z.string().optional(),
  })
  .passthrough();

/** Número con el rango de la fuente única (`src/engine/operationLimits.ts`). */
export function rangeSchema(range: OperationRange) {
  const low = range.exclusiveMin ? z.number().gt(range.min) : z.number().min(range.min);
  const ranged = low.max(range.max);
  return range.integer ? ranged.int() : ranged;
}

const vec3Of = (range: OperationRange, what: string) =>
  z.tuple([rangeSchema(range), rangeSchema(range), rangeSchema(range)]).describe(what);

/** Posición [x, y, z] en mm (±100000). */
export const positionSchema = vec3Of(TRANSFORM_RANGES.position, 'Position [X, Y, Z] in millimeters (X right, Y back, Z up).');
/** Rotación Euler [rx, ry, rz] en radianes, acotada. */
export const rotationSchema = vec3Of(TRANSFORM_RANGES.rotation, 'Euler XYZ rotation [rx, ry, rz] in radians (rz turns around the vertical Z axis).');
/** Escala [sx, sy, sz], cada factor en [0.001, 1000]. */
export const scaleSchema = vec3Of(TRANSFORM_RANGES.scale, 'Scale [sx, sy, sz]; each factor in [0.001, 1000].');
/** Colocación de piezas nuevas: `free` (por defecto) busca un hueco libre; `origin` las deja en el centro. */
export const placementSchema = z
  .enum(['free', 'origin'])
  .optional()
  .describe(
    "'free' (default): first free spot on the bed without overlapping other parts; 'origin': center of the scene. An explicit `position` overrides both. Returns the final position."
  );
