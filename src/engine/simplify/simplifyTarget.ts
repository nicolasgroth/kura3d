/**
 * @file src/engine/simplify/simplifyTarget.ts
 * @description «Por cantidad»: busca la tolerancia de `Manifold.simplify` que deja la malla en N triángulos o
 * apenas debajo. Crece la tolerancia ×4 desde la mínima hasta pasar el objetivo y luego biseca en escala
 * logarítmica; para al quedar dentro de `targetSlackRel` bajo el objetivo, al agotar iteraciones o tiempo, o al
 * llegar al tope de tolerancia. Si se pasa el género original, también guarda el mejor candidato que conserva los
 * agujeros pasantes (hasta `genusSlackRel` sobre el objetivo) y, si el más cercano los pierde, busca unas
 * tolerancias más en el borde donde cambia el género y lo prefiere. A lo más dos candidatos vivos. Cancelable con
 * `AbortSignal` entre llamadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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

interface Candidate { m: Manifold; tol: number; tris: number; genus: number }

/** Género original y cómo medirlo (suma por cuerpo). */
export interface GenusGuard { genus: number; of: (m: Manifold) => number }

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
  guard?: GenusGuard,
): TargetSearchResult {
  const L = SIMPLIFY_WARN_LIMITS;
  const now = opts.now ?? (() => performance.now());
  const t0 = now();
  const floor = Math.floor(target * (1 - L.targetSlackRel));
  const keepCeil = Math.ceil(target * (1 + L.genusSlackRel));
  const s: { best: Candidate | null; keep: Candidate | null } = { best: null, keep: null };
  const release = (c: Candidate | null) => { if (c && c !== s.best && c !== s.keep) c.m.delete(); };
  let iterations = 0;
  let keptTol = -Infinity; // mayor tolerancia que conservó el género
  let lostTol = Infinity; // menor tolerancia que lo cambió
  let below = -Infinity; // mayor tolerancia que dejó más triángulos que el objetivo
  let above = Infinity; // menor tolerancia que alcanzó el objetivo (o vació la pieza)

  const step = (tol: number): void => {
    throwIfAborted(opts.signal);
    opts.onProgress?.(`simplify:${iterations + 1}/${L.targetMaxIterations}`);
    const m = original.simplify(tol);
    iterations++;
    let ok: boolean, c: Candidate;
    try {
      ok = valid(m);
      c = { m, tol, tris: ok ? m.numTri() : 0, genus: ok && guard ? guard.of(m) : NaN };
    } catch (e) {
      // Aún no es candidato (ni mejor ni conservado): nadie más lo libera.
      m.delete();
      throw e;
    }
    if (ok && guard) {
      if (c.genus === guard.genus) keptTol = Math.max(keptTol, tol);
      else lostTol = Math.min(lostTol, tol);
    }
    if (ok && improves(c, s.best, target)) {
      const old = s.best;
      s.best = c;
      release(old);
    }
    if (ok && guard && c.genus === guard.genus && c.tris <= keepCeil && improves(c, s.keep, target)) {
      const old = s.keep;
      s.keep = c;
      release(old);
    }
    release(c);
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
    // 3) El más cercano pierde agujeros: unas tolerancias más en el borde del género para hallar uno que los
    //    conserve con la menor cantidad de triángulos posible (dentro de la holgura).
    const losesHoles = () => guard !== undefined && s.best !== null && s.best.genus !== guard.genus;
    let extra = 0;
    while (losesHoles() && Number.isFinite(keptTol) && Number.isFinite(lostTol) && extra < L.genusExtraIterations) {
      if (lostTol / keptTol < 1.001 || (s.keep && s.keep.tris <= target)) break;
      extra++;
      step(Math.sqrt(keptTol * lostTol));
    }
  } catch (e) {
    const { best, keep } = s;
    s.best = null; s.keep = null;
    best?.m.delete();
    if (keep !== best) keep?.m.delete();
    throw e;
  }
  const preferKeep = s.keep !== null && s.best !== null && guard !== undefined && s.best.genus !== guard.genus;
  const chosen = preferKeep ? s.keep : s.best;
  const other = preferKeep ? s.best : s.keep;
  if (other && other !== chosen) other.m.delete();
  if (!chosen) throw new EngineError('MESH_EMPTY', { operation: 'simplify_mesh' });
  // Alcanzado: dentro de la holgura, o ya debajo a la tolerancia mínima (no hay nada más fino que probar).
  const reached = chosen.tris <= target;
  if (reached && (close() || !Number.isFinite(below))) stoppedBy = 'reached';
  if (preferKeep && !reached) stoppedBy = 'genus';
  const info: SimplifyTargetInfo = { triangles: target, reached, iterations, stoppedBy, ...(preferKeep ? { genusPreserved: true } : {}) };
  return { best: chosen.m, toleranceLocal: chosen.tol, info };
}
