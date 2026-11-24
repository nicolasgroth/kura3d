/**
 * @file src/engine/fitCheck/runFitCheck.ts
 * @description "Comprobar encaje" de punta a punta (solo lectura): cuerpos efectivos con las restas
 * pendientes aplicadas en copia, fase ancha por cajas, fase fina por par (choque exacto con Manifold o
 * aproximado por BVH si una malla no cierra; holgura por distancia mínima acotada), clasificación,
 * recomendaciones e informe en ejes del usuario. Cancelable (cooperativo en proceso; en el Worker se
 * termina el Worker) y con progreso. Nunca modifica los objetos de entrada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type * as THREE from 'three';
import { toUserBox, toUserVector } from '../../core/scene/displayAxes';
import type { Vec3 } from '../../types/kura';
import { initManifoldEngine } from '../manifoldKernel';
import { requireOperationRange } from '../engineErrors';
import { OPERATION_DEFAULTS, OPERATION_RANGES } from '../operationLimits';
import { broadPhasePairs, possiblePairCount } from './broadPhase';
import { areCutJointPartners, CUT_JOINT_MAX_OVERLAP_MM } from './cutJoint';
import { disposeBodies, FIT_SIMPLIFY_TOLERANCE_MM, manifoldForPair, prepareBodies, type PreparedBody } from './fitBodies';
import type {
  FitCheckHooks, FitCheckInput, FitCheckOptions, FitCheckReport, FitMessage, FitPairResult, FitPairStatus, ResolvedFitCheckOptions,
} from './fitCheckTypes';
import { interferenceRecommendation, r2, summaryMessage, tightRecommendation, worstPair } from './fitRecommendations';
import { dominantDirection, estimateResolution } from './fitResolution';
import { approximateInterference } from './pairApprox';
import { closestPoints, exactInterference, type InternalInterference } from './pairGeometry';

/** Cancelación de una comprobación en proceso. */
export class FitCheckCancelledError extends Error {
  readonly code = 'cancelled' as const;
  constructor() {
    super('Fit check cancelled');
    this.name = 'FitCheckCancelledError';
  }
}

const D = OPERATION_DEFAULTS.fitCheck;
const R = OPERATION_RANGES.fitCheck;

/** Opciones con defaults y rangos de la fuente única (`operationLimits`). */
export function resolveFitCheckOptions(o: FitCheckOptions = {}): ResolvedFitCheckOptions {
  const clearanceTargetMm = requireOperationRange('clearanceTargetMm', o.clearanceTargetMm, R.clearanceTargetMm, D.clearanceTargetMm);
  return {
    applyPendingSubtractions: o.applyPendingSubtractions ?? true,
    clearanceTargetMm,
    searchMm: requireOperationRange('searchMm', o.searchMm, R.searchMm, Math.max(D.searchFactor * clearanceTargetMm, D.minSearchMm)),
    maxPairs: requireOperationRange('maxPairs', o.maxPairs, R.maxPairs, D.maxPairs),
    maxTrianglesPerPair: requireOperationRange('maxTrianglesPerPair', o.maxTrianglesPerPair, R.maxTrianglesPerPair, D.maxTrianglesPerPair),
    timeBudgetMs: requireOperationRange('timeBudgetMs', o.timeBudgetMs, R.timeBudgetMs, D.timeBudgetMs),
  };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
const vec = (v: THREE.Vector3): Vec3 => toUserVector([v.x, v.y, v.z]).map(r2) as Vec3;
const userBox = (b: THREE.Box3) => {
  const u = toUserBox({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] });
  return { min: u.min.map(r2) as Vec3, max: u.max.map(r2) as Vec3 };
};

function evaluatePair(a: PreparedBody, b: PreparedBody, opts: ResolvedFitCheckOptions, notes: FitMessage[]): FitPairResult {
  const names = { a: a.name, b: b.name };
  const exact = Boolean(a.manifold && b.manifold);
  const simplify = exact && a.triangles + b.triangles > opts.maxTrianglesPerPair;
  let inter: InternalInterference | null;
  if (exact) {
    inter = exactInterference(manifoldForPair(a, simplify)!, manifoldForPair(b, simplify)!);
    if (simplify) notes.push({ key: 'fitCheck.note.simplified', params: { a: a.name, b: b.name, toleranceMm: FIT_SIMPLIFY_TOLERANCE_MM } });
  } else {
    inter = approximateInterference(a, b);
  }
  const base = {
    aId: a.id, bId: b.id, aName: a.name, bName: b.name,
    kind: a.reference || b.reference ? 'reference-solid' as const : 'solid-solid' as const,
    approximate: !exact, simplified: simplify,
  };
  const partners = areCutJointPartners(a.cut, b.cut);
  const zoneSize = inter ? inter.zone.getSize(inter.zone.min.clone()) : null;
  const faceContact = partners && zoneSize !== null && Math.min(zoneSize.x, zoneSize.y, zoneSize.z) <= CUT_JOINT_MAX_OVERLAP_MM;
  if (inter && !faceContact) {
    const size = inter.zone.getSize(inter.zone.min.clone());
    const center = inter.zone.getCenter(inter.zone.min.clone());
    const point = vec(center);
    const resolution = estimateResolution(a, b, inter.zone, opts.clearanceTargetMm);
    return {
      ...base, status: 'interferes', clearanceMm: 0, closest: null,
      interference: {
        volumeMm3: r3(inter.volumeMm3), zoneBox: userBox(inter.zone), point, approximate: inter.approximate,
        ...(inter.crossingTriangles !== undefined ? { crossingTriangles: inter.crossingTriangles } : {}),
        depthMm: r2(Math.min(size.x, size.y, size.z)),
      },
      recommendation: interferenceRecommendation(names, inter.volumeMm3, point, resolution),
    };
  }
  const near = closestPoints(a, b, opts.searchMm);
  if (faceContact) return { ...base, status: 'cutJoint', interference: null, clearanceMm: 0, closest: null, recommendation: null };
  if (!near) return { ...base, status: 'far', interference: null, clearanceMm: null, closest: null, recommendation: null };
  // Pareja del mismo corte en posición de armado: se tocan a propósito, no es un problema de holgura.
  const status: FitPairStatus = near.distance < opts.clearanceTargetMm ? (partners ? 'cutJoint' : 'tight') : 'ok';
  const mid = near.onA.clone().add(near.onB).multiplyScalar(0.5);
  return {
    ...base, status, interference: null, clearanceMm: r3(near.distance),
    closest: { onA: vec(near.onA), onB: vec(near.onB) },
    recommendation: status === 'tight'
      ? tightRecommendation(names, near.distance, opts.clearanceTargetMm, vec(mid), dominantDirection(near.onA.clone().sub(near.onB)))
      : null,
  };
}

const RANK: Record<FitPairStatus, number> = { interferes: 0, tight: 1, cutJoint: 2, ok: 3, far: 4 };
function comparePairs(p: FitPairResult, q: FitPairResult): number {
  if (RANK[p.status] !== RANK[q.status]) return RANK[p.status] - RANK[q.status];
  if (p.status === 'interferes') return q.interference!.volumeMm3 - p.interference!.volumeMm3;
  return (p.clearanceMm ?? Infinity) - (q.clearanceMm ?? Infinity);
}

/** Comprueba el encaje de `input.objects` (solo lectura). */
export async function runFitCheck(input: FitCheckInput, hooks: FitCheckHooks = {}): Promise<FitCheckReport> {
  const started = Date.now();
  const opts = resolveFitCheckOptions(input.options);
  const step = (phase: string) => {
    hooks.onProgress?.(phase);
    if (hooks.shouldCancel?.()) throw new FitCheckCancelledError();
  };
  const wasm = await initManifoldEngine();
  const notes: FitMessage[] = [];
  const { bodies, subtractions } = prepareBodies(
    wasm, input.objects, input.negatives ?? [], opts.applyPendingSubtractions, notes, (i, n) => step(`prepare:${i + 1}/${n}`),
  );
  try {
    const possiblePairs = possiblePairCount(bodies);
    const candidates = broadPhasePairs(bodies, opts.searchMm);
    const pairs: FitPairResult[] = [];
    const limit = Math.min(candidates.length, opts.maxPairs);
    let timedOut = false;
    for (let c = 0; c < limit; c++) {
      step(`pair:${c + 1}/${limit}`);
      if (Date.now() - started > opts.timeBudgetMs) {
        timedOut = true;
        break;
      }
      const [i, j] = candidates[c];
      // A es la referencia si la hay; si no, el primero de la entrada.
      const [a, b] = bodies[j].reference && !bodies[i].reference ? [bodies[j], bodies[i]] : [bodies[i], bodies[j]];
      pairs.push(evaluatePair(a, b, opts, notes));
    }
    const evaluated = pairs.length;
    const skipped = candidates.length - evaluated;
    if (skipped > 0 && !timedOut) notes.push({ key: 'fitCheck.note.truncated', params: { evaluated, candidates: candidates.length } });
    if (timedOut) notes.push({ key: 'fitCheck.note.timeBudget', params: { evaluated, candidates: candidates.length, seconds: r2(opts.timeBudgetMs / 1000) } });
    pairs.sort(comparePairs);
    const count = (s: FitPairStatus) => pairs.filter((p) => p.status === s).length;
    return {
      version: 1,
      objectIds: bodies.map((b) => b.id),
      options: opts,
      pairs,
      summary: {
        objects: bodies.length,
        possiblePairs,
        broadPhaseCandidates: candidates.length,
        evaluatedPairs: evaluated,
        interferes: count('interferes'),
        tight: count('tight'),
        ok: count('ok'),
        cutJoints: count('cutJoint'),
        far: possiblePairs - candidates.length + count('far'),
        skipped,
        worst: worstPair(pairs),
        message: summaryMessage(bodies.length, possiblePairs, evaluated, pairs),
      },
      subtractions,
      truncated: skipped > 0,
      notes: dedupeNotes(notes),
      durationMs: Date.now() - started,
    };
  } finally {
    disposeBodies(bodies);
  }
}

function dedupeNotes(notes: FitMessage[]): FitMessage[] {
  const seen = new Set<string>();
  return notes.filter((n) => {
    const k = `${n.key}|${JSON.stringify(n.params)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
