/**
 * @file src/core/scene/objectRole.ts
 * @description Rol de un objeto de escena (sólido, negativo o referencia) y sus predicados. Ningún
 * sitio compara el rol a mano: una referencia se ve y se mide, pero nunca se imprime, se exporta, se
 * resta ni entra en booleanas. `isHole` queda como alias obsoleto de entrada (bus, MCP, importadores).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ObjectRole } from '../../types/kura';
import { OPERATION_RANGES } from '../../engine/operationLimits';

export type { ObjectRole };

export const OBJECT_ROLES: readonly ObjectRole[] = ['solid', 'negative', 'reference'];

/** Opacidad de una referencia: límites del deslizador y valor inicial del ajuste global. */
export const REFERENCE_OPACITY = {
  min: OPERATION_RANGES.reference.opacity.min,
  max: OPERATION_RANGES.reference.opacity.max,
  default: 0.35,
} as const;

interface HasRole { role: ObjectRole }
interface HasRoleAndVisibility extends HasRole { visible: boolean }

export const isSolid = (o: HasRole): boolean => o.role === 'solid';
export const isNegative = (o: HasRole): boolean => o.role === 'negative';
export const isReference = (o: HasRole): boolean => o.role === 'reference';

/** Se imprime y se exporta: sólido visible. */
export const isPrintable = (o: HasRoleAndVisibility): boolean => o.visible && o.role === 'solid';

/** Puede ser objetivo o herramienta de booleanas, restas, combinar o envolvente. */
export const participatesInBooleans = (o: HasRole): boolean => o.role !== 'reference';

/** Ocupa cama para colocar lo nuevo y cuenta en avisos de impresión (fuera de cama, malla abierta). */
export const occupiesBed = (o: HasRole): boolean => o.role !== 'reference';

export const isObjectRole = (v: unknown): v is ObjectRole =>
  typeof v === 'string' && (OBJECT_ROLES as readonly string[]).includes(v);

/** Traduce el antiguo `isHole` (formatos v1/v2, 3MF y API obsoleta). */
export const roleFromLegacy = (isHole: boolean | undefined): ObjectRole => (isHole ? 'negative' : 'solid');

/**
 * Rol pedido en una entrada externa: `role` válido gana; si no, el alias obsoleto `isHole`;
 * `undefined` si no pide nada (para parches).
 */
export function readRoleInput(input: { role?: unknown; isHole?: unknown }): ObjectRole | undefined {
  if (isObjectRole(input.role)) return input.role;
  if (typeof input.isHole === 'boolean') return roleFromLegacy(input.isHole);
  return undefined;
}

export function clampReferenceOpacity(v: number): number {
  if (!Number.isFinite(v)) return REFERENCE_OPACITY.default;
  return Math.min(REFERENCE_OPACITY.max, Math.max(REFERENCE_OPACITY.min, v));
}
