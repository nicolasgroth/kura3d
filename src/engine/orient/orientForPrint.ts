/**
 * @file src/engine/orient/orientForPrint.ts
 * @description «Orientar para imprimir», función pura: propone orientaciones estables que reducen
 * o eliminan los soportes (candidatos = actual, 6 de ejes y caras del casco convexo agrupadas por
 * normal), mide cada una apoyada en la cama, las ordena por costo ponderado y las compara con la
 * actual. `planOrientTransform` calcula la transformación que aplica una orientación elegida
 * (gira, apoya en Y = 0 y centra o conserva X/Z). Sin IA: geometría y reglas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { Vec3 } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { directionCandidates, groupHullFaces } from './orientCandidates';
import { baseQuaternion, hasRealBase, measureOrientation, type MeasureSettings, type MeasuredOrientation } from './orientMeasure';
import { ORIENT_EQUIVALENCE, ORIENT_WEIGHTS, orientCost, orientOrder, reasonsFor, vsCurrentOf, type ScoreContext } from './orientScore';
import type { OrientAnalysis, OrientCandidate, OrientInput, OrientOptions } from './orientTypes';
import { prepareOrientWorld } from './orientWorld';

export const ORIENT_DEFAULTS = Object.freeze({
  overhangAngleDeg: 45,
  maxHullCandidates: 16,
  minTipAngleDeg: 10,
  gridCells: 160,
  /** Área mínima del polígono de apoyo: fracción del área total de la pieza (y al menos 1 mm²). */
  minSupportAreaFraction: 0.001,
});

/** Rango del umbral de voladizo que ofrecen la interfaz y los comandos (grados; el motor acepta 1–89). */
export const ORIENT_RANGES = Object.freeze({
  overhangAngleDeg: Object.freeze({ min: 30, max: 70, default: ORIENT_DEFAULTS.overhangAngleDeg }),
});

function settingsOf(o: OrientOptions, totalArea: number): MeasureSettings {
  const angle = o.overhangAngleDeg ?? ORIENT_DEFAULTS.overhangAngleDeg;
  if (!(Number.isFinite(angle) && angle > 0 && angle < 90)) {
    throw new EngineError('INVALID_PARAMETER', { name: 'overhangAngleDeg', value: String(angle), min: 1, max: 89 });
  }
  const bed = o.bed ?? null;
  if (bed) {
    for (const [name, v] of [['widthMm', bed.widthMm], ['depthMm', bed.depthMm], ['heightMm', bed.heightMm]] as const) {
      if (!(Number.isFinite(v) && v > 0)) throw new EngineError('INVALID_PARAMETER', { name, value: String(v), min: 0, max: 10_000 });
    }
  }
  return {
    overhangAngleDeg: angle,
    minTipAngleDeg: o.minTipAngleDeg ?? ORIENT_DEFAULTS.minTipAngleDeg,
    minSupportAreaMm2: Math.max(1, ORIENT_DEFAULTS.minSupportAreaFraction * totalArea),
    gridCells: Math.round(o.gridCells ?? ORIENT_DEFAULTS.gridCells),
    bed,
  };
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;

/** Analiza las orientaciones de la pieza y las devuelve ordenadas (la primera es la recomendada). */
export function analyzeOrientations(input: OrientInput, options: OrientOptions = {}): OrientAnalysis {
  const world = prepareOrientWorld(input);
  const s = settingsOf(options, world.totalArea);
  const maxHull = Math.max(0, Math.round(options.maxHullCandidates ?? ORIENT_DEFAULTS.maxHullCandidates));
  const dirs = directionCandidates(groupHullFaces(world.hullFaces, world.com), maxHull, s.minSupportAreaMm2, s.minTipAngleDeg);
  const scratch = new Float64Array(world.positions.length);
  const measured: Array<{ dir: (typeof dirs)[number]; m: MeasuredOrientation }> = [];
  let cellMm = 0;
  for (const dir of dirs) {
    const q = dir.source === 'current' ? new THREE.Quaternion() : baseQuaternion(dir.down);
    const m = measureOrientation(world, q, s, scratch);
    // Del casco solo quedan los apoyos estables; la actual y los ejes se muestran siempre (marcados).
    if (dir.source === 'hull' && !m.measures.stable) continue;
    if (dir.source === 'current') cellMm = m.supportCellMm;
    measured.push({ dir, m });
  }

  const ctx: ScoreContext = {
    partVolumeMm3: world.volume,
    totalAreaMm2: world.totalArea,
    maxDimensionMm: world.diag,
    maxContactMm2: Math.max(...measured.map((x) => x.m.measures.contactAreaMm2)),
    minBaseMm2: s.minSupportAreaMm2,
  };
  const cur = measured[0].m.measures;
  const costs = measured.map((x) => orientCost(x.m.measures, ctx));
  const { order, equivalent } = orientOrder(costs, measured.map((x) => hasRealBase(x.m.measures.contactAreaMm2, s.minSupportAreaMm2)));

  const candidates: OrientCandidate[] = order.map((i, rank) => {
    const { dir, m } = measured[i];
    const q = m.quaternion;
    const eq = equivalent(i);
    return {
      id: dir.id, source: dir.source, down: dir.down.map(r4) as Vec3,
      quaternion: [q.x, q.y, q.z, q.w], measures: m.measures, cost: costs[i], rank, equivalentToBest: eq,
      vsCurrent: vsCurrentOf(m.measures, cur),
      reasons: reasonsFor(m.measures, cur, ctx, { isCurrent: i === 0, equivalentToBest: eq && order.length > 1 }),
    };
  });
  return {
    candidates, currentId: 'current', currentIsBest: equivalent(0),
    allEquivalent: candidates.length > 1 && candidates.every((c) => c.equivalentToBest),
    overhangAngleDeg: s.overhangAngleDeg, weights: { ...ORIENT_WEIGHTS }, equivalenceTolerance: ORIENT_EQUIVALENCE,
    supportCellMm: cellMm, partVolumeMm3: world.volume, triangleCount: world.areas.length,
  };
}

/** Ajusta a múltiplos exactos de 90° los ángulos que ya casi lo son (evita 1.5707963 ± ruido). */
const snap = (v: number) => {
  const k = Math.round(v / (Math.PI / 2));
  return (Math.abs(v - k * (Math.PI / 2)) < 1e-9 ? k * (Math.PI / 2) : v) + 0;
};

/**
 * Transformación que aplica el giro `quaternion` (mundo, sobre la pieza tal como está): rota, apoya
 * en la cama (mínimo Y = 0) y centra en X/Z = 0, o conserva el centro X/Z actual con `keepXY`.
 */
export function planOrientTransform(
  input: OrientInput,
  quaternion: readonly [number, number, number, number],
  opts: { keepXY?: boolean } = {},
): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  if (!quaternion.every(Number.isFinite)) throw new EngineError('INVALID_PARAMETER', { name: 'quaternion', value: quaternion.join(','), min: -1, max: 1 });
  const r = new THREE.Quaternion(...quaternion).normalize();
  const obj = new THREE.Quaternion().setFromEuler(new THREE.Euler(input.rotation[0], input.rotation[1], input.rotation[2], 'XYZ'));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...input.position), obj, new THREE.Vector3(...input.scale));
  const p = input.mesh.positions;
  const before = new THREE.Box3(), after = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; i + 2 < p.length; i += 3) {
    v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(m);
    before.expandByPoint(v);
    after.expandByPoint(v.applyQuaternion(r));
  }
  if (before.isEmpty()) throw new EngineError('MESH_EMPTY');
  const target = opts.keepXY ? before.getCenter(new THREE.Vector3()) : new THREE.Vector3();
  const center = after.getCenter(new THREE.Vector3());
  const pos = new THREE.Vector3(...input.position).applyQuaternion(r);
  pos.x += target.x - center.x;
  pos.z += target.z - center.z;
  pos.y -= after.min.y;
  const e = new THREE.Euler().setFromQuaternion(r.clone().multiply(obj), 'XYZ');
  return {
    position: [pos.x + 0, pos.y + 0, pos.z + 0],
    rotation: [snap(e.x), snap(e.y), snap(e.z)],
    scale: [...input.scale] as Vec3,
  };
}
