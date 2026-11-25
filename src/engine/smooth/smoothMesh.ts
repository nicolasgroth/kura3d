/**
 * @file src/engine/smooth/smoothMesh.ts
 * @description «Suavizar malla»: función pura que quita facetado y ruido con Taubin λ/μ sin encoger,
 * sin cambiar la topología (mismos vértices y triángulos) y sin agrandar la caja envolvente. Puede
 * proteger aristas vivas y bordes abiertos y limitarse a una zona con atenuación. Tras suavizar
 * comprueba daño (triángulos invertidos, autointersecciones nuevas). Ante daño protege primero solo los
 * vértices dañados y sus anillos (`smoothGuard.ts`) y vuelve a suavizar el resto con la intensidad pedida,
 * hasta `SMOOTH_LOCAL_ROUNDS` rondas; como último recurso baja la fuerza a la mitad hasta
 * `SMOOTH_DAMAGE_RETRIES` veces y avisa, o falla con `SMOOTH_DAMAGE`; nunca entrega una malla peor en silencio.
 * Las medidas del informe (volumen, desplazamiento) van en coordenadas de mundo con `options.scale`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { EngineError, engineWarning, type EngineWarning } from '../engineErrors';
import { findSmoothDamage, type SmoothDamage } from './smoothDamage';
import { buildSmoothGraph } from './smoothGraph';
import { dampedGraph, protectAround, SMOOTH_LOCAL_MAX_FRACTION, SMOOTH_LOCAL_ROUNDS, strengthCoverage } from './smoothGuard';
import { resolveSmoothOptions, SMOOTH_DAMAGE_RETRIES, SMOOTH_DEFAULTS, type SmoothOptions } from './smoothOptions';
import { taubinSmooth } from './taubin';

/** Medidas del suavizado aplicado (volumen y desplazamiento en coordenadas de mundo si se pasó `scale`). */
export interface SmoothReport {
  iterations: number;
  requestedStrength: number;
  /** Intensidad global aplicada (igual a la pedida salvo el último recurso de bajarla a la mitad). */
  appliedStrength: number;
  /** Vértices originales cuya posición cambió. */
  movedVertices: number;
  /** Vértices soldados fijados por arista viva, borde abierto o arista no manifold. */
  lockedVertices: number;
  /** Vértices soldados del grafo (base del porcentaje de `lockedVertices`). */
  weldedVertices: number;
  /** Vértices soldados que las opciones dejan mover (zona incluida, sin aristas vivas ni bordes). */
  movableVertices: number;
  /** De los movibles, los fijados o amortiguados por la protección local ante daño. */
  damageProtectedVertices: number;
  /** Fracción (0–1) de los movibles suavizados con al menos el 80 % de la intensidad pedida. */
  strengthCoverage: number;
  volumeBeforeMm3: number;
  volumeAfterMm3: number;
  /** Cambio de volumen en % (positivo = creció). */
  volumeChangePct: number;
  /** Mayor desplazamiento de un vértice (mm). */
  maxDisplacementMm: number;
  /** Daño hallado en cada ronda (la última es la del resultado entregado: 0 y 0). */
  attempts: Array<{ strength: number; protectedVertices: number } & SmoothDamage>;
}

export interface SmoothResult {
  mesh: MeshData;
  report: SmoothReport;
  warnings: EngineWarning[];
}

/** Volumen con signo (mm³) por triple producto; exacto en mallas cerradas. */
export function signedVolume(P: Float32Array, I: Uint32Array): number {
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1])
      - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c])
      + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v / 6;
}

/** Triángulos cuyo color por cara es `color` (para usar una zona pintada como máscara). */
export function trianglesWithColor(mesh: MeshData, color: string): Uint32Array {
  const fc = mesh.faceColors ?? [];
  const want = color.toLowerCase();
  const out: number[] = [];
  for (let t = 0; t < fc.length; t++) if (fc[t]?.toLowerCase() === want) out.push(t);
  return new Uint32Array(out);
}

/** Marca los vértices cuya posición difiere entre `a` y `b`; devuelve cuántos y el mayor desplazamiento² escalado. */
function diffMask(a: Float32Array, b: Float32Array, scale: readonly number[], mask: Uint8Array): { count: number; maxD2: number } {
  let count = 0, maxD2 = 0;
  const [sx, sy, sz] = scale;
  for (let v = 0; v < mask.length; v++) {
    const dx = b[v * 3] - a[v * 3], dy = b[v * 3 + 1] - a[v * 3 + 1], dz = b[v * 3 + 2] - a[v * 3 + 2];
    if (dx === 0 && dy === 0 && dz === 0) {
      mask[v] = 0;
      continue;
    }
    mask[v] = 1;
    count++;
    const d2 = (dx * sx) ** 2 + (dy * sy) ** 2 + (dz * sz) ** 2;
    if (d2 > maxD2) maxD2 = d2;
  }
  return { count, maxD2 };
}

/** Suaviza `mesh` con Taubin λ/μ. Lanza `MESH_EMPTY`, `INVALID_PARAMETER` o `SMOOTH_DAMAGE`. */
export function smoothMesh(mesh: MeshData, options: SmoothOptions = {}): SmoothResult {
  const opts = resolveSmoothOptions(options);
  if (mesh.indices.length < 3) throw new EngineError('MESH_EMPTY', { operation: 'smooth' });
  const P = mesh.positions, I = mesh.indices;
  const graph = buildSmoothGraph(mesh, opts);
  const det = Math.abs(opts.scale[0] * opts.scale[1] * opts.scale[2]);
  const volumeBefore = signedVolume(P, I) * det;
  const warnings: EngineWarning[] = [];
  const damp = new Float32Array(graph.weldedCount).fill(1);
  const initial = strengthCoverage(graph, damp, opts.strength, opts.strength);
  const report: SmoothReport = {
    iterations: opts.iterations,
    requestedStrength: opts.strength,
    appliedStrength: 0,
    movedVertices: 0,
    lockedVertices: graph.lockedCount,
    weldedVertices: graph.weldedCount,
    movableVertices: initial.movable,
    damageProtectedVertices: 0,
    strengthCoverage: 0,
    volumeBeforeMm3: volumeBefore,
    volumeAfterMm3: volumeBefore,
    volumeChangePct: 0,
    maxDisplacementMm: 0,
    attempts: [],
  };
  if (graph.active.length === 0) {
    warnings.push(engineWarning('SMOOTH_NO_EFFECT', { locked: graph.lockedCount }));
    return { mesh: copyMesh(mesh, P.slice()), report, warnings };
  }

  const progress = options.onProgress;
  const reduce = opts.onDamage === 'reduce';
  const vertCount = P.length / 3;
  const movedMask = new Uint8Array(vertCount);
  const changedMask = new Uint8Array(vertCount);
  let strength = opts.strength;
  let localRounds = 0, globalReductions = 0;
  let prev: Float32Array | null = null;
  let fullCheck = true;
  for (;;) {
    const g = report.attempts.length === 0 ? graph : dampedGraph(graph, damp);
    const out = taubinSmooth(P, g, strength, opts.iterations, (done) => {
      progress?.(`smooth:${done}/${opts.iterations}`);
    });
    const moved = diffMask(P, out, opts.scale, movedMask);
    // Un triángulo que no cambió desde la ronda anterior conserva su estado (sano): basta revisar los que cambiaron.
    const check = fullCheck || !prev ? movedMask : (diffMask(prev, out, opts.scale, changedMask), changedMask);
    progress?.('smooth:check');
    const damage = findSmoothDamage(P, out, I, graph.weld, check, graph.weldedCount);
    const cov = strengthCoverage(graph, damp, strength, opts.strength);
    report.attempts.push({
      strength,
      protectedVertices: cov.protected,
      invertedTriangles: damage.invertedTriangles,
      newIntersections: damage.newIntersections,
    });
    if (damage.invertedTriangles === 0 && damage.newIntersections === 0) {
      const volumeAfter = signedVolume(out, I) * det;
      const pct = volumeBefore !== 0 ? (100 * (volumeAfter - volumeBefore)) / Math.abs(volumeBefore) : 0;
      Object.assign(report, {
        appliedStrength: strength,
        movedVertices: moved.count,
        damageProtectedVertices: cov.protected,
        strengthCoverage: cov.coverage,
        volumeAfterMm3: volumeAfter,
        volumeChangePct: pct,
        maxDisplacementMm: Math.sqrt(moved.maxD2),
      });
      if (strength < opts.strength) {
        warnings.push(engineWarning('SMOOTH_STRENGTH_REDUCED', { requested: opts.strength, applied: strength }));
      }
      if (Math.abs(pct) > SMOOTH_DEFAULTS.volumeWarnPct) {
        warnings.push(engineWarning('SMOOTH_VOLUME_CHANGED', { pct: Math.round(pct * 10) / 10 }));
      }
      return { mesh: copyMesh(mesh, out), report, warnings };
    }
    if (!reduce) break;
    prev = out;
    // Con el tope de pares alcanzado puede haber daño sin listar: la ronda siguiente revisa todo.
    fullCheck = damage.capped;
    if (localRounds < SMOOTH_LOCAL_ROUNDS && cov.protected <= cov.movable * SMOOTH_LOCAL_MAX_FRACTION) {
      protectAround(damp, damage.vertices, graph);
      localRounds++;
    } else if (globalReductions < SMOOTH_DAMAGE_RETRIES) {
      // Último recurso: la protección ya no es local (o no converge). Se conserva la máscara y se baja la fuerza.
      protectAround(damp, damage.vertices, graph);
      strength /= 2;
      globalReductions++;
      fullCheck = true;
    } else break;
  }
  const last = report.attempts[report.attempts.length - 1];
  throw new EngineError('SMOOTH_DAMAGE', {
    inverted: last.invertedTriangles,
    intersections: last.newIntersections,
    strength: last.strength,
  });
}

function copyMesh(mesh: MeshData, positions: Float32Array): MeshData {
  return {
    positions,
    indices: mesh.indices.slice(),
    ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
  };
}
