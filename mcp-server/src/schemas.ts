/**
 * @file mcp-server/src/schemas.ts
 * @description Esquemas Zod para tratar como datos todo texto que llega del cliente MCP o de la UI
 * (nombres, IDs, textos, SVG, mensajes del puente): límites de longitud, sin caracteres de control
 * y formas estrictas. Ningún valor validado aquí se evalúa ni se interpola en comandos del sistema.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { z } from 'zod';

/** Caracteres de control C0/C1 (excepto ninguno: los nombres son de una línea). */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/** Nombre legible de objeto: 1–128 caracteres, una línea, sin caracteres de control. */
export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((v) => !CONTROL_CHARS.test(v), 'El nombre no puede contener caracteres de control.');

/** Identificador de objeto o región: 1–128 caracteres imprimibles sin espacios. */
export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^\s\u0000-\u001f\u007f-\u009f]+$/, 'ID inválido.');

/** Texto corto para primitivas de texto o proyección (permite saltos de línea, no otros controles). */
export const shortTextSchema = z
  .string()
  .max(500)
  .refine((v) => !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v), 'Texto con caracteres de control.');

/** Contenido SVG acotado a 2 MB (se parsea como datos, nunca se ejecuta). */
export const svgContentSchema = z.string().min(1).max(2_000_000);

/** Color hexadecimal `#rrggbb`. */
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** ID de perfil de impresora (slug). */
export const profileIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

/** Ruta de exportación solicitada (se confina luego con `resolveExportPath`). */
export const outputPathSchema = z.string().min(1).max(1024);

/** Respuesta de la UI de Kura3D a un comando del Command Bus. */
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
