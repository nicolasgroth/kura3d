/**
 * @file src/core/addons/keyholeAnalysis.ts
 * @description Análisis de un ojo de cerradura antes de crearlo, sobre la malla de mundo de la pieza: pared que queda
 * detrás de la cámara (espesor medido con rayos en la entrada, a mitad y al final de la ranura, menos labio y cámara;
 * ≤ 0 = atraviesa), si la figura es más ancha que la cara (sale por lados opuestos: no se coloca) o se asoma por un
 * borde, y si la cara es vertical (lo normal para colgar). La diferencia de altura con otros ojos de la misma cara la
 * agrega el store (depende de la escena). Función pura, sin el motor Manifold: corre en el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { fromLocal } from './faceFrame';
import { footprintOff, spansOpposite } from './footprintProbe';
import { keyholeDepthMm, placeKeyhole, type KeyholeParams, type KeyholePlan } from './keyhole';
import { thicknessBelow } from './wallThickness';

export interface KeyholeReport {
  /** Menor material detrás de la cámara (mm); ≤ 0 si el ojo atraviesa la pieza. */
  wallBehindMm: number;
  /** La cámara sale por el otro lado de la pieza. */
  through: boolean;
  /** La figura se asoma por un borde de la cara. */
  edge: boolean;
  /** La cara es vertical (normal casi horizontal). */
  vertical: boolean;
  /** Mayor diferencia de altura con otros ojos de la misma cara (mm); null si es el único. Lo completa el store. */
  levelOffsetMm: number | null;
  /** Material del labio que sujeta la cabeza en el extremo de la ranura (mm³); lo mide la operación con Manifold. */
  retentionMm3?: number;
  /** El mismo volumen en una pared infinita (mm³). */
  retentionIdealMm3?: number;
}

export interface KeyholeAnalysis {
  plan: KeyholePlan;
  report: KeyholeReport;
  /** La figura sale de la pieza por lados opuestos: más ancha que la cara (no se coloca). */
  spansFace: boolean;
}

export function analyzeKeyhole(world: MeshData, params: KeyholeParams, point: Vec3, normal: Vec3): KeyholeAnalysis | null {
  const plan = placeKeyhole(params, point, normal);
  if (!plan) return null;
  const { frame } = plan;
  const depth = keyholeDepthMm(params);
  const rh = params.headDiameterMm / 2;
  const L = params.slotLengthMm;
  const thicknesses: number[] = [];
  for (const x of [0, L / 2, L]) {
    for (const z of [0, -rh * 0.9, rh * 0.9]) {
      const t = thicknessBelow(world, fromLocal(frame, point, [x, 0, z]), frame.axis);
      if (Number.isFinite(t)) thicknesses.push(t);
    }
  }
  const minThickness = thicknesses.length > 0 ? Math.min(...thicknesses) : Infinity;
  const wallBehindMm = Number.isFinite(minThickness) ? minThickness - depth : Infinity;
  const probeDepth = Math.min(depth, Number.isFinite(minThickness) ? minThickness * 0.9 : depth);
  const off = footprintOff(world, { center: fromLocal(frame, point, [L / 2, 0, 0]), frame, radius: rh, halfStraight: L / 2 }, 0, probeDepth);
  return {
    plan,
    spansFace: spansOpposite(off),
    report: {
      wallBehindMm,
      through: wallBehindMm <= 0,
      edge: off.some(Boolean),
      vertical: frame.vertical,
      levelOffsetMm: null,
    },
  };
}
