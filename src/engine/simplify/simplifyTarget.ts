/**
 * @file src/engine/simplify/simplifyTarget.ts
 * @description «Por cantidad»: busca la tolerancia de `Manifold.simplify` que deja la malla en N triángulos o
 * apenas debajo. Crece la tolerancia ×4 desde la mínima hasta pasar el objetivo y luego biseca en escala
 * logarítmica; para al quedar dentro de `targetSlackRel` bajo el objetivo, al agotar iteraciones o tiempo, o al
 * llegar al tope de tolerancia. Conserva un solo candidato vivo (el mejor) para no duplicar memoria. Cancelable
 * con `AbortSignal` entre llamadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import { EngineError } from '../engineErrors';
import { SIMPLIFY_WARN_LIMITS, type SimplifyRunOptions, type SimplifyTargetInfo, type SimplifyTargetStop } from './simplifyTypes';

export interface TargetSearchResult {
  /** Mejor resultado (el que más triángulos tiene sin pasarse; si ninguno llega, el de menos). Lo libera quien llama. */
  best: Manifold;
  /** Tolerancia local (unidades de la malla) del mejor. */
  toleranceLocal: number;
  info: SimplifyTargetInfo;
}

interface Candidate { m: Manifold; tol: number; tris: number }

/** Lanza `AbortError` si la señal ya se abortó. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Simplify cancelled', 'AbortError');
}

const valid = (m: Manifold) => !m.isEmpty() && m.numTri() > 0 && m.volume() > 0;

/** true si `c` mejora a `best` para el objetivo `target`. */
function improves(c: Candidate, best: Candidate | null, target: number): boolean {
  if (!best) return true;
  if (c.tris <= target) return best.tris > target || c.tris > best.tris;
  return best.tris > target && c.tris < best.tris;
}

/**
 * @param original Sólido de partida (no se libera aquí).
 * @param target Triángulos pedidos (≥ 4).
 * @param minTol Tolerancia local inicial.
 * @param maxTol Tope de tolerancia local (más allá la pieza colapsa).
 */
export function searchTargetTolerance(
  original: Manifold,
  target: number,
  minTol: number,
  maxTol: number,
  opts: SimplifyRunOptions = {},
): TargetSearchResult {
  const L = SIMPLIFY_WARN_LIMITS;
  const now = opts.now ?? (() => performance.now());
  const t0 = now();
  const floor = Math.floor(target * (1 - L.targetSlackRel));
  const s: { best: Candidate | null } = { best: null };
  let iterations = 0;
  let below = -Infinity; // mayor tolerancia que dejó más triángulos que el objetivo
  let above = Infinity; // menor tolerancia que alcanzó el objetivo (o vació la pieza)

  const step = (tol: number): void => {
    throwIfAborted(opts.signal);
    opts.onProgress?.(`simplify:${iterations + 1}/${L.targetMaxIterations}`);
    const m = original.simplify(tol);
    iterations++;
    const ok = valid(m);
    const c = { m, tol, tris: ok ? m.numTri() : 0 };
    if (ok && improves(c, s.best, target)) {
      s.best?.m.delete();
      s.best = c;
    } else {
      m.delete();
    }
    if (!ok || c.tris <= target) above = Math.min(above, tol);
    else below = Math.max(below, tol);
  };
  const close = () => s.best !== null && s.best.tris <= target && s.best.tris >= floor;
  const stopReason = (): SimplifyTargetStop | null => {
    if (iterations >= L.targetMaxIterations) return 'iterations';
    if (now() - t0 > L.targetMaxMs) return 'time';
    return null;
  };

  let stoppedBy: SimplifyTargetStop = 'reached';
  try {
    // 1) Crecer ×4 hasta alcanzar el objetivo.
    let tol = minTol;
    step(tol);
    while (above === Infinity) {
      if (tol >= maxTol) { stoppedBy = 'range'; break; }
      const reason = stopReason();
      if (reason) { stoppedBy = reason; break; }
      tol = Math.min(maxTol, tol * 4);
      step(tol);
    }
    // 2) Bisección logarítmica entre la última que sobra y la primera que alcanza.
    if (Number.isFinite(below) && Number.isFinite(above)) {
      while (!close()) {
        const reason = stopReason() ?? (above / below < 1.001 ? 'range' : null);
        if (reason) { stoppedBy = reason; break; }
        step(Math.sqrt(below * above));
      }
    }
  } catch (e) {
    s.best?.m.delete();
    throw e;
  }
  const best = s.best as Candidate | null;
  if (!best) throw new EngineError('MESH_EMPTY', { operation: 'simplify_mesh' });
  // Alcanzado: dentro de la holgura, o ya debajo a la tolerancia mínima (no hay nada más fino que probar).
  const reached = best.tris <= target;
  if (reached && (close() || !Number.isFinite(below))) stoppedBy = 'reached';
  return { best: best.m, toleranceLocal: best.tol, info: { triangles: target, reached, iterations, stoppedBy } };
}
