/**
 * @file src/engine/split/naturalExplicit.ts
 * @description Adaptador de «Por las partes de la figura» a planos explícitos (punto + normal en
 * mundo). La estrategia hoy entrega un plan de rejilla con `planePositions` forzadas, que es lo que
 * ejecuta el motor; esta forma neutra permite pasar los mismos planos a un flujo de cortes a mano
 * (planos explícitos, otro lote) sin depender de la rejilla. Si ese flujo define su propio tipo, basta
 * con mapear estos campos: `point` está sobre el plano, `normal` es unitaria y apunta a +eje.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Vec3 } from '../../types/kura';
import type { BedSplitPlan, SplitAxis } from './splitTypes';

/** Plano de corte explícito en mundo (mm). */
export interface ExplicitCutPlane {
  point: Vec3;
  normal: Vec3;
  /** Estrechamiento de la figura o corte recto que completa. */
  origin: 'natural' | 'straight';
  /** Área de la sección (mm²) medida por el plan. */
  sectionAreaMm2: number;
}

const AXIS_INDEX: Record<SplitAxis, number> = { x: 0, y: 1, z: 2 };

/** Planos del plan como planos explícitos, en el orden de `plan.planes`. */
export function naturalPlanAsExplicitPlanes(plan: BedSplitPlan): ExplicitCutPlane[] {
  const center = [0, 1, 2].map((a) => (plan.bounds.min[a] + plan.bounds.max[a]) / 2) as Vec3;
  return plan.planes.map((p) => {
    const a = AXIS_INDEX[p.axis];
    const point = [...center] as Vec3;
    point[a] = p.position;
    const normal: Vec3 = [0, 0, 0];
    normal[a] = 1;
    return { point, normal, origin: p.origin ?? 'straight', sectionAreaMm2: p.sectionAreaMm2 };
  });
}
