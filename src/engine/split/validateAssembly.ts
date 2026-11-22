/**
 * @file src/engine/split/validateAssembly.ts
 * @description Validación de armado de piezas divididas (`validateAssembly`), pura y sin Manifold:
 * (a) cierre: volumen, interferencia por par (vóxeles ocupados por dos piezas) y hueco entre caras de
 * unión; (b) choques entre conectores y pared hasta la superficie; (c, d) direcciones de inserción y
 * orden de montaje con barrido (`assemblyOrder.ts`); (e) arreglo mínimo: uniones que pasan a "para
 * pegar" (con `autoFix` el informe ya las da por pegadas; quitar la geometría del conector es tarea del
 * llamador, como hace `executeBedSplitGeometry`); (f) firmeza por regla geométrica.
 * Sirve para el resultado de `split_for_bed` y para piezas cortadas a mano con el corte por plano.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { engineWarning, type EngineWarning } from '../engineErrors';
import { ASSEMBLY_LIMITS } from '../operationLimits';
import { connectorClashes, connectorRadius, recommendedConnectorRadius } from './assemblyConnectors';
import { findOrder, greedyFix } from './assemblyOrder';
import type {
  AssemblyClosure, AssemblyFix, AssemblyGap, AssemblySuggestion, AssemblyJointInput, AssemblyPartInput, AssemblyReport, AssemblySummary,
  ValidateAssemblyOptions, WeakJoint,
} from './assemblyTypes';
import { sweepShadows, voxelize, worldPositions } from './assemblyVoxels';

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

function signedVolume(w: Float64Array, mesh: MeshData): number {
  let v = 0;
  const idx = mesh.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    v += w[a] * (w[b + 1] * w[c + 2] - w[b + 2] * w[c + 1]) - w[a + 1] * (w[b] * w[c + 2] - w[b + 2] * w[c]) + w[a + 2] * (w[b] * w[c + 1] - w[b + 1] * w[c]);
  }
  return v / 6;
}

function extent(w: Float64Array, a: number): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = a; i < w.length; i += 3) {
    if (w[i] < lo) lo = w[i];
    if (w[i] > hi) hi = w[i];
  }
  return [lo, hi];
}

/** Hueco entre la cara alta de `a` (sin sus conectores) y la cara baja de `b` en el plano de la unión. */
function jointGap(j: AssemblyJointInput, world: Float64Array[]): number | null {
  if (j.kind === 'lap') return null;
  const a = AXIS_INDEX[j.axis];
  const r = j.connector && j.kind === 'connector' ? connectorRadius(j.connector) + 0.35 : 0;
  const wa = world[j.a.part], wb = world[j.b.part];
  if (!wa || !wb) return null;
  let top = -Infinity;
  for (let i = 0; i < wa.length; i += 3) {
    if (r > 0 && j.connectorCenters.some((c) => Math.hypot(...[0, 1, 2].filter((k) => k !== a).map((k) => wa[i + k] - c[k])) <= r)) continue;
    top = Math.max(top, wa[i + a]);
  }
  const [bottom] = extent(wb, a);
  return Number.isFinite(top) ? bottom - top : null;
}

/** Valida que las piezas cierren, que los conectores no choquen, que exista un orden de montaje y que las uniones sean firmes. */
export function validateAssembly(
  parts: AssemblyPartInput[],
  joints: AssemblyJointInput[],
  options: ValidateAssemblyOptions = {},
): AssemblyReport {
  const t0 = performance.now();
  const L = ASSEMBLY_LIMITS;
  const wall = options.minWallMm ?? L.minWallMm;
  const warnings: EngineWarning[] = [];
  const meshes = parts.map((p) => p.mesh);
  const world = parts.map((p) => worldPositions(p.mesh, p.assembly.position, p.assembly.rotation));
  const codes = parts.map((p) => p.code);
  const volumes = parts.map((p, i) => p.volumeMm3 ?? signedVolume(world[i], p.mesh));
  const ext = world.map((w) => [0, 1, 2].map((a) => extent(w, a)));
  let maxDim = 0;
  for (let a = 0; a < 3; a++) {
    const lo = Math.min(...ext.map((e) => e[a][0])), hi = Math.max(...ext.map((e) => e[a][1]));
    maxDim = Math.max(maxDim, hi - lo);
  }
  const h = options.voxelMm ?? Math.max(maxDim / L.voxelsPerSide, 0.05);
  const grid = parts.length > 0 ? voxelize(world, meshes, h) : null;

  // (a) Cierre
  const interference = grid
    ? [...grid.overlaps].map(([k, c]) => {
        const [a, b] = k.split('|').map(Number);
        return { a: codes[a], b: codes[b], volumeMm3: c * h ** 3 };
      })
    : [];
  const gaps: AssemblyGap[] = [];
  for (const j of joints) {
    const g = jointGap(j, world);
    if (g !== null && g > L.gapToleranceMm) gaps.push({ joint: j.label, gapMm: g });
  }
  let volumeErrorMm3: number | null = null;
  let volumeErrorPct: number | null = null;
  if (options.sourceVolumeMm3 && options.sourceVolumeMm3 > 0) {
    const total = volumes.reduce((s, v) => s + v, 0) + (options.clearanceVolumeMm3 ?? 0) + (options.engravedVolumeMm3 ?? 0);
    volumeErrorMm3 = total - options.sourceVolumeMm3;
    volumeErrorPct = (100 * volumeErrorMm3) / options.sourceVolumeMm3;
  }
  const volumeOk = volumeErrorPct === null || Math.abs(volumeErrorPct) <= L.volumeTolerancePct;
  const closure: AssemblyClosure = { ok: volumeOk && interference.length === 0 && gaps.length === 0, volumeErrorMm3, volumeErrorPct, interference, gaps };
  if (!volumeOk) warnings.push(engineWarning('ASSEMBLY_VOLUME_MISMATCH', { pct: volumeErrorPct ?? 0 }));
  for (const it of interference) warnings.push(engineWarning('ASSEMBLY_INTERFERENCE', { a: it.a, b: it.b, volume: it.volumeMm3 }));
  for (const g of gaps) warnings.push(engineWarning('ASSEMBLY_GAP', { label: g.joint, gap: g.gapMm }));

  // (b) Choques entre conectores y pared exterior
  const clashes = connectorClashes(joints, options.checkExterior === false ? null : world, meshes, wall);
  for (const c of clashes) {
    warnings.push(engineWarning('ASSEMBLY_CONNECTOR_CLASH', { label: c.joint, other: c.other?.joint ?? '-', distance: c.distanceMm, required: c.requiredMm }));
  }

  // (c, d, e) Direcciones, orden de montaje y arreglo mínimo
  const minY = ext.map((e) => e[1][0]);
  let base = 0;
  for (let p = 1; p < parts.length; p++) {
    if (minY[p] < minY[base] - 1e-6 || (Math.abs(minY[p] - minY[base]) <= 1e-6 && volumes[p] > volumes[base])) base = p;
  }
  const input = { codes, minY, joints, base, shadows: grid ? sweepShadows(grid, parts.length) : [] };
  let outcome = findOrder(input);
  let fix: AssemblyFix = { glueJoints: [], changeType: [], applied: false };
  const suggestions: AssemblySuggestion[] = [];
  if (outcome.blocked.length > 0) {
    // Dos arreglos: solo pegar, o pegar/cambiar de tipo; gana el que conserva más uniones con conector
    const glueOnly = greedyFix(input);
    const withChange = options.allowTypeChange === false ? glueOnly : greedyFix(input, true);
    const useChange = withChange.blocked.length <= glueOnly.blocked.length && withChange.glued.size < glueOnly.glued.size;
    const repair = useChange ? withChange : glueOnly;
    for (const label of new Set([...glueOnly.glued, ...withChange.glued, ...withChange.changed.keys()])) {
      const t = withChange.changed.get(label);
      suggestions.push({ joint: label, options: t ? ['glue', `change-type:${t}`] : ['glue'] });
    }
    suggestions.sort((x, y) => Number(x.joint) - Number(y.joint) || x.joint.localeCompare(y.joint));
    fix = {
      glueJoints: [...repair.glued],
      changeType: useChange ? [...withChange.changed].map(([joint, type]) => ({ joint, type })) : [],
      applied: options.autoFix === true,
    };
    if (fix.applied) {
      outcome = { order: repair.order, blocked: repair.blocked };
      for (const label of repair.glued) {
        const j = joints.find((x) => x.label === label)!;
        warnings.push(engineWarning('ASSEMBLY_JOINT_GLUED_FOR_ORDER', { label, a: j.a.code, b: j.b.code }));
      }
      for (const c of fix.changeType) {
        const j = joints.find((x) => x.label === c.joint)!;
        warnings.push(engineWarning('ASSEMBLY_JOINT_TYPE_CHANGED', { label: c.joint, a: j.a.code, b: j.b.code, from: j.connector?.type ?? '-', to: c.type }));
      }
    }
  }
  for (const b of outcome.blocked) {
    warnings.push(engineWarning('ASSEMBLY_BLOCKED', { code: b.code, joints: b.conflictingJoints.join(', ') || '-', parts: b.blockingParts.join(', ') || '-' }));
  }

  // (f) Firmeza
  const glued = new Set(fix.applied ? fix.glueJoints : []);
  const weak: WeakJoint[] = [];
  for (const j of joints) {
    if (j.kind !== 'connector' || !j.connector || j.connector.type === 'lap' || glued.has(j.label)) continue;
    const small = volumes[j.a.part] <= volumes[j.b.part] ? j.a.part : j.b.part;
    const dim = Math.max(...ext[small].map(([lo, hi]) => hi - lo));
    const n = Math.max(1, j.connectorCenters.length);
    const recommended = recommendedConnectorRadius(j.contactAreaMm2, n, dim);
    const measured = j.connector.size;
    const areaFraction = j.contactAreaMm2 > 0 ? (n * Math.PI * measured ** 2) / j.contactAreaMm2 : 0;
    if (measured < recommended - 1e-6) {
      weak.push({ joint: j.label, measuredMm: measured, recommendedMm: recommended, areaFraction });
      warnings.push(engineWarning('ASSEMBLY_WEAK_JOINT', { label: j.label, measured, recommended }));
    }
  }

  return {
    ok: closure.ok && clashes.length === 0 && outcome.blocked.length === 0,
    closure,
    clashes,
    order: outcome.order,
    blocked: outcome.blocked,
    fix,
    suggestions,
    weak,
    warnings,
    voxelMm: h,
    elapsedMs: performance.now() - t0,
  };
}

/** Resumen corto para respuestas de comandos y MCP. */
export function summarizeAssembly(r: AssemblyReport): AssemblySummary {
  return {
    ok: r.ok,
    steps: r.order.length,
    blocked: r.blocked.map((b) => b.code),
    clashes: r.clashes.length,
    weakJoints: r.weak.map((w) => w.joint),
    gluedByFix: r.fix.applied ? r.fix.glueJoints : [],
    changedByFix: r.fix.applied ? r.fix.changeType.map((c) => `${c.joint}:${c.type}`) : [],
    suggestions: r.suggestions,
    volumeErrorPct: r.closure.volumeErrorPct,
  };
}
