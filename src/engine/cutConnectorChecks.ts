/**
 * @file src/engine/cutConnectorChecks.ts
 * @description Validación de conectores del corte por plano contra la cara de corte real:
 * parámetros finitos y en rango (sin correcciones silenciosas), cada alojamiento hembra más una
 * pared mínima debe quedar dentro de la mitad que lo recibe (no perfora la superficie ni la
 * atraviesa en profundidad) y los conectores no pueden solaparse entre sí.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { PlaneCutOptions, Vec3 } from '../types/kura';
import { EngineError, requireIntegerInRange, requireNumberInRange } from './engineErrors';

/** Pared mínima (mm) que debe rodear al alojamiento hembra dentro de la pieza. */
export const CONNECTOR_MIN_WALL_MM = 0.8;

/** Parámetros de conector validados. */
export interface ValidatedConnectorParams {
  size: number;
  depth: number;
  tolerance: number;
  count: number;
}

/** Valida tamaño, profundidad, holgura y cantidad (errores tipados en vez de recortes). */
export function validateConnectorParams(options: PlaneCutOptions): ValidatedConnectorParams {
  return {
    size: requireNumberInRange('connectorSize', options.connectorSize, 0.5, 200),
    depth: requireNumberInRange('connectorDepth', options.connectorDepth, 1, 400),
    tolerance: requireNumberInRange('tolerance', options.tolerance, 0, 2),
    count: requireIntegerInRange('connectorCount', options.connectorCount, 1, 4),
  };
}

/**
 * Verifica que los alojamientos (`shells`: hembra + pared mínima) quepan en `receiver`
 * (la mitad positiva antes de perforarla) y que los `spacers` (hembra + media pared) no se
 * solapen, es decir, que entre dos alojamientos quede al menos la pared mínima.
 *
 * @param normal Normal del plano de corte (apunta hacia `receiver`).
 * @param cutCoord Coordenada del plano a lo largo de la normal.
 * @param depthWithWall Profundidad hembra + holgura + pared.
 */
export function assertConnectorsFit(
  receiver: Manifold,
  shells: Manifold[],
  spacers: Manifold[],
  normal: Vec3,
  cutCoord: number,
  depthWithWall: number,
  size: number
): void {
  const axis = normal[0] ? 0 : normal[1] ? 1 : 2;
  const recvBox = receiver.boundingBox();
  const available = recvBox.max[axis] - cutCoord;
  if (depthWithWall > available) {
    throw new EngineError('CUT_CONNECTOR_TOO_DEEP', { depth: depthWithWall, available });
  }

  const trimmed: Manifold[] = [];
  const trimmedSpacers: Manifold[] = [];
  try {
    for (const shell of shells) {
      trimmed.push(shell.trimByPlane(normal, cutCoord + 1e-3));
    }
    for (const spacer of spacers) {
      trimmedSpacers.push(spacer.trimByPlane(normal, cutCoord + 1e-3));
    }
    for (const t of trimmed) {
      const outside = t.subtract(receiver);
      const v = outside.volume();
      outside.delete();
      if (v > 1e-3 * Math.max(1, t.volume())) {
        throw new EngineError('CUT_CONNECTOR_TOO_LARGE', {
          size,
          count: shells.length,
          wall: CONNECTOR_MIN_WALL_MM,
        });
      }
    }
    for (let i = 0; i < trimmedSpacers.length; i++) {
      for (let j = i + 1; j < trimmedSpacers.length; j++) {
        const inter = trimmedSpacers[i].intersect(trimmedSpacers[j]);
        const v = inter.volume();
        inter.delete();
        if (v > 1e-6) {
          throw new EngineError('CUT_CONNECTORS_OVERLAP', { size, count: shells.length });
        }
      }
    }
  } finally {
    for (const t of trimmed) t.delete();
    for (const t of trimmedSpacers) t.delete();
  }
}
