/**
 * @file src/engine/smooth/smoothMesh.ts
 * @description «Suavizar malla»: función pura que quita facetado y ruido con Taubin λ/μ sin encoger,
 * sin cambiar la topología (mismos vértices y triángulos) y sin agrandar la caja envolvente. Puede
 * proteger aristas vivas y bordes abiertos y limitarse a una zona con atenuación. Tras suavizar
 * comprueba daño (triángulos invertidos, autointersecciones nuevas): baja la fuerza a la mitad hasta
 * `SMOOTH_DAMAGE_RETRIES` veces y avisa, o falla con `SMOOTH_DAMAGE`; nunca entrega una malla peor
 * en silencio.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { EngineError, engineWarning, type EngineWarning } from '../engineErrors';
import { detectSmoothDamage, type SmoothDamage } from './smoothDamage';
import { buildSmoothGraph } from './smoothGraph';
import { resolveSmoothOptions, SMOOTH_DAMAGE_RETRIES, SMOOTH_DEFAULTS, type SmoothOptions } from './smoothOptions';
import { taubinSmooth } from './taubin';

/** Medidas del suavizado aplicado (volumen en coordenadas locales de la malla). */
export interface SmoothReport {
  iterations: number;
  requestedStrength: number;
  appliedStrength: number;
  /** Vértices originales cuya posición cambió. */
  movedVertices: number;
  /** Vértices soldados fijados por arista viva, borde abierto o arista no manifold. */
  lockedVertices: number;
  volumeBeforeMm3: number;
  volumeAfterMm3: number;
  /** Cambio de volumen en % (positivo = creció). */
  volumeChangePct: number;
  /** Mayor desplazamiento de un vértice (mm locales). */
  maxDisplacementMm: number;
  /** Daño hallado en cada intento (el último es el del resultado entregado: 0 y 0). */
  attempts: Array<{ strength: number } & SmoothDamage>;
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

/** Suaviza `mesh` con Taubin λ/μ. Lanza `MESH_EMPTY`, `INVALID_PARAMETER` o `SMOOTH_DAMAGE`. */
export function smoothMesh(mesh: MeshData, options: SmoothOptions = {}): SmoothResult {
  const opts = resolveSmoothOptions(options);
  if (mesh.indices.length < 3) throw new EngineError('MESH_EMPTY', { operation: 'smooth' });
  const P = mesh.positions, I = mesh.indices;
  const graph = buildSmoothGraph(mesh, opts);
  const volumeBefore = signedVolume(P, I);
  const warnings: EngineWarning[] = [];
  const report: SmoothReport = {
    iterations: opts.iterations,
    requestedStrength: opts.strength,
    appliedStrength: 0,
    movedVertices: 0,
    lockedVertices: graph.lockedCount,
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
  const totalAttempts = opts.onDamage === 'reduce' ? SMOOTH_DAMAGE_RETRIES + 1 : 1;
  let strength = opts.strength;
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const out = taubinSmooth(P, graph, strength, opts.iterations, (done) => {
      progress?.(`smooth:${done}/${opts.iterations}`);
    });
    const moved = new Uint8Array(P.length / 3);
    let movedCount = 0, maxD2 = 0;
    for (let v = 0; v < moved.length; v++) {
      const dx = out[v * 3] - P[v * 3], dy = out[v * 3 + 1] - P[v * 3 + 1], dz = out[v * 3 + 2] - P[v * 3 + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 0) {
        moved[v] = 1;
        movedCount++;
        if (d2 > maxD2) maxD2 = d2;
      }
    }
    progress?.('smooth:check');
    const damage = detectSmoothDamage(P, out, I, graph.weld, moved);
    report.attempts.push({ strength, ...damage });
    if (damage.invertedTriangles === 0 && damage.newIntersections === 0) {
      const volumeAfter = signedVolume(out, I);
      const pct = volumeBefore !== 0 ? (100 * (volumeAfter - volumeBefore)) / Math.abs(volumeBefore) : 0;
      Object.assign(report, {
        appliedStrength: strength,
        movedVertices: movedCount,
        volumeAfterMm3: volumeAfter,
        volumeChangePct: pct,
        maxDisplacementMm: Math.sqrt(maxD2),
      });
      if (strength < opts.strength) {
        warnings.push(engineWarning('SMOOTH_STRENGTH_REDUCED', { requested: opts.strength, applied: strength }));
      }
      if (Math.abs(pct) > SMOOTH_DEFAULTS.volumeWarnPct) {
        warnings.push(engineWarning('SMOOTH_VOLUME_CHANGED', { pct: Math.round(pct * 10) / 10 }));
      }
      return { mesh: copyMesh(mesh, out), report, warnings };
    }
    strength /= 2;
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
