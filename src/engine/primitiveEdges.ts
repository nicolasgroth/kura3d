/**
 * @file src/engine/primitiveEdges.ts
 * @description Bordes de las primitivas (Caja, Cilindro, Tubo, Prisma): valida `edgeStyle`,
 * `edgeScope` y `edgeSize`, y calcula el tope que permiten las medidas de la pieza (la mitad de la
 * menor medida afectada menos un margen). Un tamaño por encima del tope se acota y se informa
 * (`clamped`); uno fuera del rango global o un alcance que la primitiva no admite es un error tipado.
 * Sin WASM: lo usan el motor, la interfaz y las validaciones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PrimitiveParams, PrimitiveType } from '../types/kura';
import { EngineError, requireNumberInRange } from './engineErrors';
import {
  EDGE_SCOPES, EDGE_SCOPES_BY_TYPE, EDGE_STYLES, PRIMITIVE_PARAM_RANGES, type EdgeScope, type EdgeStyle,
} from './primitiveLimits';
import { resolveBox, resolveCylinder, resolvePrism, resolveTube } from './primitiveParams';

/** Margen bajo el tope geométrico (mm): evita caras degeneradas cuando el radio llena la medida. */
export const EDGE_SIZE_MARGIN_MM = 0.005;
/** Tamaño por defecto cuando se pide borde sin tamaño (mm). */
export const DEFAULT_EDGE_SIZE_MM = 2;

/** Bordes ya resueltos de una primitiva con borde no recto. */
export interface ResolvedEdges {
  style: Exclude<EdgeStyle, 'sharp'>;
  scope: EdgeScope;
  /** Tamaño efectivo (mm), ya acotado. */
  size: number;
  /** Tamaño pedido (mm). */
  requested: number;
  /** Tope para estas medidas (mm). */
  max: number;
  clamped: boolean;
}

/** true si la primitiva admite bordes. */
export function supportsEdges(type: PrimitiveType): boolean {
  return Object.hasOwn(EDGE_SCOPES_BY_TYPE, type);
}

/** Alcance por defecto: verticales en piezas con planta poligonal (sin voladizo en la base); arriba en cilindros. */
export function defaultEdgeScope(type: PrimitiveType): EdgeScope {
  return type === 'cylinder' || type === 'tube' ? 'top' : 'vertical';
}

function invalid(name: string, value: unknown, options: readonly string[]): EngineError {
  return new EngineError('INVALID_PARAMETER', { name, value: String(value), min: 0, max: options.length - 1 });
}

function readStyle(value: unknown): EdgeStyle {
  if (value === undefined) return 'sharp';
  if (typeof value === 'string' && (EDGE_STYLES as readonly string[]).includes(value)) return value as EdgeStyle;
  throw invalid('edgeStyle', value, EDGE_STYLES);
}

function readScope(type: PrimitiveType, value: unknown): EdgeScope {
  if (value === undefined) return defaultEdgeScope(type);
  const allowed = EDGE_SCOPES_BY_TYPE[type] ?? [];
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as EdgeScope;
  throw invalid('edgeScope', value, allowed.length ? allowed : EDGE_SCOPES);
}

/** Tope geométrico (sin margen) del tamaño de borde para estas medidas. */
function geometricMax(type: PrimitiveType, params: PrimitiveParams, style: EdgeStyle, scope: EdgeScope): number {
  switch (type) {
    case 'box': {
      const { w, h, d } = resolveBox(params);
      const plan = Math.min(w, d) / 2;
      if (scope === 'vertical') return plan;
      if (scope === 'top') return Math.min(plan, h);
      return Math.min(plan, h / 2);
    }
    case 'prism': {
      const { sides, r, h } = resolvePrism(params);
      const apothem = r * Math.cos(Math.PI / sides);
      const halfSide = r * Math.sin(Math.PI / sides);
      // Redondeo: el contorno interior desplazado no puede invertirse (apotema). Chaflán: el corte cabe en el lado.
      const plan = style === 'chamfer' ? Math.min(apothem, halfSide) : apothem;
      if (scope === 'vertical') return plan;
      if (scope === 'top') return Math.min(apothem, h);
      return Math.min(plan, h / 2);
    }
    case 'cylinder': {
      const { r, h } = resolveCylinder(params);
      return scope === 'top' ? Math.min(r, h) : Math.min(r, h / 2);
    }
    case 'tube': {
      const { outerR, innerR, h } = resolveTube(params);
      const wall = (outerR - innerR) / 2;
      return scope === 'top' ? Math.min(wall, h) : Math.min(wall, h / 2);
    }
    default:
      return 0;
  }
}

/** Tope del tamaño de borde (mm) para las medidas, estilo y alcance de `params` (≥ 0). */
export function maxEdgeSize(type: PrimitiveType, params: PrimitiveParams): number {
  if (!supportsEdges(type)) return 0;
  const style = readStyle(params.edgeStyle);
  const scope = readScope(type, params.edgeScope);
  return Math.max(0, geometricMax(type, params, style, scope) - EDGE_SIZE_MARGIN_MM);
}

/** Resumen para respuestas del bus y del MCP: tamaño aplicado, tope y si se acotó (o `undefined` si son rectos). */
export function edgeReport(type: PrimitiveType | undefined, params: PrimitiveParams | undefined) {
  if (!type || !params) return undefined;
  try {
    const edges = resolveEdges(type, params);
    return edges ? { edgeSizeApplied: edges.size, edgeSizeMax: edges.max, edgeSizeClamped: edges.clamped } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Bordes de `params` para `type`, o `null` si son rectos (sin campos, `sharp` o tamaño efectivo 0).
 * Lanza `INVALID_PARAMETER` si el estilo, el alcance o el tamaño no son válidos para la primitiva.
 */
export function resolveEdges(type: PrimitiveType, params: PrimitiveParams): ResolvedEdges | null {
  const style = readStyle(params.edgeStyle);
  if (style === 'sharp') return null;
  if (!supportsEdges(type)) throw invalid('edgeStyle', `${style} (${type})`, ['sharp']);
  const scope = readScope(type, params.edgeScope);
  const range = PRIMITIVE_PARAM_RANGES.edgeSize;
  const requested = requireNumberInRange('edgeSize', params.edgeSize, range.min, range.max, DEFAULT_EDGE_SIZE_MM);
  const max = Math.max(0, geometricMax(type, params, style, scope) - EDGE_SIZE_MARGIN_MM);
  const size = Math.min(requested, max);
  if (size <= 0) return null;
  return { style, scope, size, requested, max, clamped: requested > max };
}
