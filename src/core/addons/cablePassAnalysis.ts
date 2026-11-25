/**
 * @file src/core/addons/cablePassAnalysis.ts
 * @description Análisis de un paso de cable antes de crearlo, sobre la malla de mundo de la pieza: espesor de la
 * pared con rayos en el centro y alrededor del borde de la boca (el largo del agujero es el mayor espesor medido, así
 * atraviesa en toda la sección); si el rayo del centro no sale dentro de `CABLE_MAX_AUTO_MM`, no atraviesa sola y se
 * usa la profundidad a mano. También si la boca es más ancha que la cara (sale por lados opuestos: no se coloca), si
 * queda a menos de 1,2 mm del borde de la cara y si queda a menos de 1,2 mm de otro agregado pendiente. Función pura,
 * sin el motor Manifold: corre en el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { CABLE_MAX_AUTO_MM, CABLE_MIN_GAP_MM, cablePassFrame, cableSection, type CablePassParams } from './cablePass';
import { fromLocal, type UprightFrame } from './faceFrame';
import { footprintOff, nearOtherMeshes, spansOpposite, type StadiumFootprint } from './footprintProbe';
import { stadiumReach } from './stadiumMesh';
import { thicknessBelow } from './wallThickness';

export interface CablePassReport {
  /** Espesor medido en el centro (mm); null si no sale dentro del tope. */
  thicknessMm: number | null;
  /** Largo del agujero entre bocas (mm). */
  boreMm: number;
  /** Atraviesa la pared (agujero pasante). */
  through: boolean;
  /** Se pidió medir solo, pero la pared es demasiado gruesa: se usó la profundidad a mano. */
  noExit: boolean;
  /** A menos de 1,2 mm del borde de la cara (o se asoma). */
  nearEdge: boolean;
  /** A menos de 1,2 mm de otro agregado pendiente. */
  nearAddon: boolean;
}

export interface CablePassAnalysis {
  frame: UprightFrame;
  report: CablePassReport;
  /** La boca sale de la pieza por lados opuestos: más ancha que la cara (no se coloca). */
  spansFace: boolean;
}

export function analyzeCablePass(
  world: MeshData, params: CablePassParams, point: Vec3, normal: Vec3, others: readonly MeshData[],
): CablePassAnalysis | null {
  const frame = cablePassFrame(normal, params.angleDeg);
  if (!frame || !point.every(Number.isFinite)) return null;
  const { radius, halfStraight } = cableSection(params);
  const center = thicknessBelow(world, point, frame.axis);
  const measured = Number.isFinite(center) && center <= CABLE_MAX_AUTO_MM ? center : null;
  // Alrededor del borde: la pared puede variar dentro de la boca; el agujero debe atravesar en toda la sección.
  let maxThickness = measured ?? 0;
  if (measured !== null) {
    for (let k = 0; k < 8; k++) {
      const angle = (k * Math.PI) / 4;
      const reach = stadiumReach(radius * 0.9, halfStraight, angle);
      const t = thicknessBelow(world, fromLocal(frame, point, [Math.cos(angle) * reach, 0, Math.sin(angle) * reach]), frame.axis);
      if (Number.isFinite(t) && t <= CABLE_MAX_AUTO_MM) maxThickness = Math.max(maxThickness, t);
    }
  }
  const auto = params.autoDepth && measured !== null;
  const boreMm = auto ? maxThickness : params.depthMm;
  const through = auto || (measured !== null && params.depthMm >= maxThickness);
  const probeDepth = Math.min(boreMm, measured ?? boreMm) * 0.9;
  const fp: StadiumFootprint = { center: point, frame, radius, halfStraight };
  const off = footprintOff(world, fp, 0, probeDepth);
  const offNear = footprintOff(world, fp, CABLE_MIN_GAP_MM, probeDepth);
  return {
    frame,
    spansFace: spansOpposite(off),
    report: {
      thicknessMm: measured,
      boreMm,
      through,
      noExit: params.autoDepth && measured === null,
      nearEdge: offNear.some(Boolean),
      nearAddon: nearOtherMeshes(fp, -boreMm, 0, CABLE_MIN_GAP_MM, others),
    },
  };
}
