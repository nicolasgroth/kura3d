/**
 * @file src/core/addons/screwBossAnalysis.ts
 * @description Análisis de una torreta antes de crearla, sobre mallas de mundo: superficie bajo el pie del poste
 * (`measureMouthSurface`, la misma del imán: en una cara convexa el poste se hunde lo que baja la superficie en su
 * borde, para unirse sin rendijas; si el pie sale por lados opuestos de la pieza, es más ancho que la zona de apoyo),
 * pared del poste, cuánto entra el agujero en la pieza y si sale por el otro lado, y choques con otras torretas o
 * imanes pendientes. Función pura, sin el motor Manifold: corre en el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import type { PocketDims } from './magnetPocket';
import { addScaled, insideMesh, rayHits } from './meshRays';
import { pocketSignedDistance } from './pocketNeighbors';
import { measureMouthSurface } from './pocketSurface';
import { BOSS_SEAT_OVERLAP_MM, bossWallMm, placeScrewBoss, type ScrewBossParams, type ScrewBossPlan } from './screwBoss';

/** Tope del hundimiento del poste (mm): una bajada mayor no es curvatura sino otra cara. */
export const MAX_BOSS_SEAT_MM = 6;
/** Bajo este piso (mm) entre el fondo del agujero y la cara opuesta, el agujero sale por el otro lado. */
export const BOSS_EXIT_FLOOR_MM = 0.2;

export interface ScrewBossReport {
  /** Pared del poste alrededor del agujero (mm). */
  wallMm: number;
  /** Cuánto baja el agujero bajo la cara, dentro de la pieza (mm; 0 si queda en el poste). */
  intoHostMm: number;
  /** El agujero atraviesa la pieza y sale por el otro lado. */
  exits: boolean;
  /** Choca con otra torreta o con un imán pendiente. */
  collides: boolean;
  /** Cuánto se hunde el poste bajo la cara (mm). */
  seatMm: number;
}

export interface ScrewBossAnalysis {
  plan: ScrewBossPlan;
  report: ScrewBossReport;
  /** El pie del poste sale de la pieza por lados opuestos: más ancho que la zona de apoyo (no se coloca). */
  spansFace: boolean;
}

/** Espesor de la pieza bajo `point` a lo largo de −`axis` (mm); Infinity si el rayo no la cruza. */
function thicknessBelow(world: MeshData, point: Vec3, axis: Vec3): number {
  const lift = 0.5;
  const hits = rayHits(world, addScaled(point, axis, lift), [-axis[0], -axis[1], -axis[2]]);
  const entry = hits.findIndex((d) => d >= lift - 0.05);
  if (entry < 0 || entry + 1 >= hits.length) return Infinity;
  return hits[entry + 1] - lift;
}

/** Medidas del poste como «hueco» analítico para la distancia con signo (de −`seat` a +`heightMm` sobre la cara). */
const postDims = (p: ScrewBossParams, seat: number): PocketDims => ({
  shape: 'round', widthMm: p.outerDiameterMm, depthMm: seat + p.heightMm, lengthMm: seat + p.heightMm, bottomMm: seat, topMm: -p.heightMm,
});

/** El poste (cilindro analítico) toca alguna de las mallas `others`. */
function collidesWith(plan: ScrewBossPlan, point: Vec3, p: ScrewBossParams, others: readonly MeshData[]): boolean {
  if (others.length === 0) return false;
  const { frame, seatMm } = plan;
  const dims = postDims(p, seatMm);
  const r = p.outerDiameterMm / 2;
  const samples: Vec3[] = [];
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const level = -seatMm + f * (seatMm + p.heightMm);
    const c = addScaled(point, frame.axis, level);
    samples.push(c);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      samples.push(addScaled(addScaled(c, frame.u, Math.cos(a) * r * 0.95), frame.w, Math.sin(a) * r * 0.95));
    }
  }
  for (const other of others) {
    if (samples.some((s) => insideMesh(other, s))) return true;
    const pos = other.positions;
    for (let i = 0; i + 2 < pos.length; i += 3) {
      if (pocketSignedDistance([pos[i], pos[i + 1], pos[i + 2]], point, frame, dims) < 0) return true;
    }
  }
  return false;
}

/**
 * Analiza la torreta con asiento en `point` y normal `normal` sobre la pieza `world` (malla de mundo, cerrada), con
 * las torretas e imanes pendientes `others` (mallas de mundo). null si la normal o el punto no sirven.
 */
export function analyzeScrewBoss(
  world: MeshData, params: ScrewBossParams, point: Vec3, normal: Vec3, others: readonly MeshData[],
): ScrewBossAnalysis | null {
  const flat = placeScrewBoss(params, point, normal);
  if (!flat) return null;
  // El pie del poste como un «imán» redondo del diámetro exterior: misma medición de superficie y de borde.
  const probeDepth = Math.min(MAX_BOSS_SEAT_MM, Math.max(2, params.outerDiameterMm / 2));
  const surface = measureMouthSurface(world, point, flat.frame, {
    shape: 'round', sizeMm: params.outerDiameterMm, heightMm: probeDepth, clearanceMm: 0, depthClearanceMm: 0, hidden: false,
  });
  const drop = Math.max(0, -Math.min(0, ...surface.rimHeights));
  const seat = Math.min(MAX_BOSS_SEAT_MM, drop) + BOSS_SEAT_OVERLAP_MM;
  const plan = placeScrewBoss(params, point, normal, seat)!;
  const intoHostMm = Math.max(0, params.holeDepthMm - params.heightMm);
  const thickness = intoHostMm > 0 ? thicknessBelow(world, point, plan.frame.axis) : Infinity;
  return {
    plan,
    spansFace: surface.spansFace,
    report: {
      wallMm: bossWallMm(params),
      intoHostMm,
      exits: intoHostMm > 0 && intoHostMm >= thickness - BOSS_EXIT_FLOOR_MM,
      collides: collidesWith(plan, point, params, others),
      seatMm: seat,
    },
  };
}
