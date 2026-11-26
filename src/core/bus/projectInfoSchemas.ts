/**
 * @file src/core/bus/projectInfoSchemas.ts
 * @description Validación de `set_project_info` del Command Bus y forma de la respuesta de `get_project_info`
 * (puro, sin store). Solo `description`, `notes` y `author`; cada uno es un texto plano con su tope, sin
 * caracteres de control (las notas admiten saltos de línea y tabulaciones). Un valor vacío borra el campo. Las
 * fechas y el tiempo de trabajo no se escriben desde fuera: los lleva la app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isCleanInfoText, PROJECT_INFO_LIMITS, type ProjectInfo } from '../../project/projectInfo';
import { CommandError } from './commandErrors';
import type { RawParams } from './commandValidation';

const WRITABLE = ['description', 'notes', 'author'] as const;
type WritableField = (typeof WRITABLE)[number];

const invalid = (param: string, expected: string) => new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });

/** Al menos un campo; solo los tres conocidos; texto limpio y dentro del tope. Un texto vacío borra el campo. */
export function parseSetProjectInfo(p: RawParams): Partial<Record<WritableField, string>> {
  for (const key of Object.keys(p)) {
    if (!(WRITABLE as readonly string[]).includes(key)) throw invalid(key, `one of ${WRITABLE.join(', ')}`);
  }
  const out: Partial<Record<WritableField, string>> = {};
  for (const field of WRITABLE) {
    const value = p[field];
    if (value === undefined) continue;
    if (!isCleanInfoText(value, field)) {
      const multi = field === 'notes' ? 'string' : 'single-line string';
      throw invalid(field, `${multi} (≤ ${PROJECT_INFO_LIMITS[field]}) without control characters`);
    }
    out[field] = value;
  }
  if (Object.keys(out).length === 0) throw invalid('params', `at least one of ${WRITABLE.join(', ')}`);
  return out;
}

/** Respuesta de `get_project_info` y de `set_project_info`: los campos que no existen vienen vacíos o nulos. */
export function projectInfoToUser(name: string | null, info: Omit<ProjectInfo, 'workSeconds'>, workSeconds: number) {
  return {
    name,
    description: info.description ?? '',
    notes: info.notes ?? '',
    author: info.author ?? '',
    createdAt: info.createdAt ?? null,
    modifiedAt: info.modifiedAt ?? null,
    workSeconds: Math.floor(workSeconds),
  };
}
