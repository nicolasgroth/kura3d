/**
 * @file src/engine/simplify/simplifyDetailed.ts
 * @description Simplificar con verificación (función pura, corre en el Worker): ejecuta el modo pedido sobre
 * `Manifold.simplify` («Sin pérdida» a 0,001 mm, «Por tolerancia», «Por cantidad» con bisección) y mide el
 * resultado contra el original: triángulos, volumen, género y desviación muestreada. Como la tolerancia de Manifold
 * no acota la desviación real, el informe trae avisos tipados y «Sin pérdida» solo entrega la malla si pasa la
 * verificación. La tolerancia es en mm de mundo (dividida por la mayor escala en la malla local).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import type { MeshData, SceneObject } from '../../types/kura';
import { createColorRegistry, initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { EngineError, requireOperationRange } from '../engineErrors';
import { OPERATION_RANGES } from '../operationLimits';
import { bvhOf, manifoldMesh, sampledDeviation } from './simplifyDeviation';
import { bodyGenus } from './simplifyGenus';
import { destructiveReasons, findSafeAlternative, noticeReasons, partLimits, worldPartSize, type PartSize } from './simplifySafety';
import { searchTargetTolerance, throwIfAborted } from './simplifyTarget';
import {
  LOSSLESS_LIMITS,
  onDestructiveOf,
  SIMPLIFY_WARN_LIMITS,
  type SimplifyReport,
  type SimplifySafeAlternative,
  type SimplifyRequest,
  type SimplifyRunOptions,
  type SimplifyTargetInfo,
  type SimplifyWarningCode,
} from './simplifyTypes';

export interface SimplifyDetailedResult {
  /** Malla simplificada en el mismo sistema local que la original, o null si no se aplica. */
  mesh: MeshData | null;
  report: SimplifyReport;
}

const R = OPERATION_RANGES.simplify;

/** Triángulos pedidos por «Por cantidad» (`targetTriangles` manda sobre `targetPercent`). */
export function resolveTargetTriangles(request: Extract<SimplifyRequest, { mode: 'target' }>, before: number): number {
  if (request.targetTriangles !== undefined) return requireOperationRange('targetTriangles', request.targetTriangles, R.targetTriangles);
  if (request.targetPercent !== undefined) {
    const pct = requireOperationRange('targetPercent', request.targetPercent, R.targetPercent);
    return Math.max(R.targetTriangles.min, Math.round((before * pct) / 100));
  }
  throw new EngineError('INVALID_PARAMETER', { name: 'targetTriangles', value: 'undefined', min: R.targetTriangles.min, max: R.targetTriangles.max });
}

/** Medidas que deciden los avisos (desviación en mm de mundo). */
type Measured = Pick<SimplifyReport, 'genusBefore' | 'genusAfter' | 'volumeChangePct' | 'maxDeviationMm'>;

/**
 * Avisos por umbral. «Sin pérdida» usa sus límites estrictos (`LOSSLESS_LIMITS`); «Por tolerancia» y «Por cantidad»
 * los de aviso de la pieza (`SIMPLIFY_NOTICE_LIMITS`): pedir pocos triángulos cambia la forma y eso se advierte.
 */
function thresholdWarnings(r: Measured, limits: { maxVolumePct: number; maxDeviationMm: number }): SimplifyWarningCode[] {
  const out: SimplifyWarningCode[] = [];
  if (r.genusAfter !== r.genusBefore) out.push('genus_changed');
  if (Math.abs(r.volumeChangePct) > limits.maxVolumePct) out.push('volume_changed');
  if (r.maxDeviationMm > limits.maxDeviationMm) out.push('deviation_high');
  return out;
}

/** Avisos del nivel «aviso» (modos con pérdida) para una pieza de tamaño `size`. */
function noticeWarnings(r: Measured, size: PartSize): SimplifyWarningCode[] {
  const out: SimplifyWarningCode[] = r.genusAfter !== r.genusBefore ? ['genus_changed'] : [];
  return [...out, ...noticeReasons(r, size.diagMm)];
}

/**
 * Informe de la versión segura aplicada en lugar de lo pedido: las medidas pasan a ser las de la segura y lo pedido
 * queda en `requested`. Los avisos se recalculan con la segura (sin `target_not_reached`: el informe ya dice que se
 * aplicó otra cantidad y por qué).
 */
function withSafeApplied(r: SimplifyReport, safe: SimplifySafeAlternative, size: PartSize): SimplifyReport {
  const measured = {
    genusBefore: r.genusBefore,
    genusAfter: safe.genusAfter,
    volumeChangePct: safe.volumeChangePct,
    maxDeviationMm: safe.maxDeviationMm,
  };
  return {
    ...r,
    appliedVariant: 'safe',
    requested: {
      toleranceMm: r.toleranceMm, triangles: r.trianglesAfter, volumeAfterMm3: r.volumeAfterMm3,
      volumeChangePct: r.volumeChangePct, genusAfter: r.genusAfter, maxDeviationMm: r.maxDeviationMm,
    },
    toleranceMm: safe.toleranceMm,
    trianglesAfter: safe.triangles,
    volumeAfterMm3: safe.volumeAfterMm3,
    ...measured,
    warnings: noticeWarnings(measured, size),
  };
}

/**
 * Simplifica `obj` según `request` y verifica el resultado. Lanza `MESH_EMPTY` si la tolerancia vacía la pieza,
 * `INVALID_PARAMETER`/`OUT_OF_RANGE` con parámetros fuera de rango y `AbortError` si se cancela.
 */
export async function simplifyMeshDetailed(
  obj: SceneObject,
  request: SimplifyRequest,
  opts: SimplifyRunOptions = {},
): Promise<SimplifyDetailedResult> {
  const now = opts.now ?? (() => performance.now());
  const t0 = now();
  const userTol = request.mode === 'tolerance' ? requireOperationRange('toleranceMm', request.toleranceMm, R.toleranceMm) : null;
  const wasm = await initManifoldEngine();
  throwIfAborted(opts.signal);
  const registry = obj.mesh.faceColors?.length
    ? createColorRegistry(wasm, [{ color: obj.color, faceColors: obj.mesh.faceColors }])
    : null;
  // Tolerancia y desviación en mm de mundo: en la malla local se divide / multiplica por la mayor escala.
  const maxScale = Math.max(...obj.scale.map((s) => Math.abs(s))) || 1;
  // Volumen en mm³ de mundo: el de la malla local por |sx·sy·sz| (el porcentaje de cambio no depende de esto).
  const volumeScale = Math.abs(obj.scale[0] * obj.scale[1] * obj.scale[2]) || 1;
  let original: Manifold | null = null;
  let simplified: Manifold | null = null;
  try {
    original = meshDataToManifold(wasm, obj.mesh, registry?.colorToId, obj.color);
    const trianglesBefore = original.numTri();
    // Género por cuerpo: `Manifold.genus()` da 1 − n + Σ gᵢ con n cuerpos (dos esferas: −1).
    const genusBefore = bodyGenus(original);
    let toleranceMm: number;
    let target: SimplifyTargetInfo | undefined;
    if (request.mode === 'target') {
      const wanted = resolveTargetTriangles(request, trianglesBefore);
      const minTol = LOSSLESS_LIMITS.toleranceMm / maxScale;
      const maxTol = R.toleranceMm.max / maxScale;
      const found = searchTargetTolerance(original, wanted, minTol, maxTol, opts, { genus: genusBefore, of: bodyGenus });
      simplified = found.best;
      toleranceMm = found.toleranceLocal * maxScale;
      target = found.info;
    } else {
      toleranceMm = request.mode === 'lossless' ? LOSSLESS_LIMITS.toleranceMm : userTol!;
      opts.onProgress?.('simplify:1/1');
      simplified = original.simplify(toleranceMm / maxScale);
    }
    // Una tolerancia mayor que la pieza la colapsa: error tipado, el objeto queda intacto.
    if (simplified.isEmpty() || simplified.numTri() === 0 || simplified.volume() <= 0) {
      throw new EngineError('MESH_EMPTY', { operation: 'simplify_mesh' });
    }
    throwIfAborted(opts.signal);
    opts.onProgress?.('simplify:verify');
    const volumeBeforeMm3 = original.volume() * volumeScale;
    const volumeAfterMm3 = simplified.volume() * volumeScale;
    const trianglesAfter = simplified.numTri();
    const noReduction = !(trianglesAfter < trianglesBefore);
    // La malla de la original y su BVH se calculan una sola vez y sirven a la verificación y a la búsqueda segura.
    let originalMeshCache: ReturnType<typeof manifoldMesh> | undefined;
    let originalBvhCache: ReturnType<typeof bvhOf> | undefined;
    const originalMesh = () => (originalMeshCache ??= manifoldMesh(original!));
    const originalBvh = () => (originalBvhCache ??= bvhOf(originalMesh()));
    const deviation = noReduction
      ? { maxMm: 0, samples: 0 }
      : sampledDeviation(originalMesh(), manifoldMesh(simplified), SIMPLIFY_WARN_LIMITS.maxDeviationSamples, originalBvh());
    const measured = {
      genusBefore,
      genusAfter: bodyGenus(simplified),
      volumeChangePct: volumeBeforeMm3 > 0 ? (100 * (volumeAfterMm3 - volumeBeforeMm3)) / volumeBeforeMm3 : 0,
      maxDeviationMm: deviation.maxMm * maxScale,
    };
    const size = worldPartSize(original, obj.scale);
    const lossless = request.mode === 'lossless';
    const warnings = noReduction ? [] : lossless
      ? thresholdWarnings(measured, opts.losslessLimits ?? LOSSLESS_LIMITS)
      : noticeWarnings(measured, size);
    if (noReduction) warnings.push('no_reduction');
    if (target && !target.reached) warnings.push('target_not_reached');
    // «Sin pérdida»: lo que pasó sus límites es a la vez aviso y motivo de rechazo (los mismos números).
    const rejectedBy = lossless && !noReduction ? warnings.filter((c) => c !== 'target_not_reached') : [];
    // Resultado destructivo (agujeros perdidos, volumen o desviación sobre el tope severo, o menos triángulos que el
    // mínimo): según `onDestructive` se aplica la versión segura útil en su lugar (por defecto), no se aplica nada o se
    // aplica igual. Lo que solo pasa los topes de aviso se aplica tal cual, con `warnings`.
    const destructive = noReduction || lossless ? [] : destructiveReasons({ ...measured, triangles: trianglesAfter }, size);
    const limits = lossless ? undefined : partLimits(size, measured.genusAfter);
    const policy = onDestructiveOf(request);
    const force = destructive.length > 0 && policy === 'force';
    let safe: SimplifySafeAlternative | null | undefined;
    if (destructive.length > 0 && !force) {
      // La búsqueda mide en la malla local (volumen local): se pasa a mundo al recibirla.
      const found = findSafeAlternative({
        original, originalMesh: originalMesh(), originalBvh: originalBvh(), trianglesBefore, genusBefore,
        volumeBefore: volumeBeforeMm3 / volumeScale, maxScale, size, minTolMm: R.toleranceMm.min, destructiveTolMm: toleranceMm,
      }, opts);
      safe = found ? { ...found, volumeAfterMm3: found.volumeAfterMm3 * volumeScale } : found;
    }
    const useSafe = destructive.length > 0 && policy === 'safe' && safe != null;
    const blocked = destructive.length > 0 && !force && !useSafe;
    const applied = !noReduction && rejectedBy.length === 0 && !blocked;
    let report: SimplifyReport = {
      mode: request.mode,
      applied,
      appliedVariant: applied ? 'requested' : 'none',
      toleranceMm,
      trianglesBefore,
      trianglesAfter,
      volumeBeforeMm3,
      volumeAfterMm3,
      ...measured,
      deviationSamples: deviation.samples,
      warnings,
      rejectedBy,
      ...(target ? { target } : {}),
      destructive,
      ...(limits ? { limits } : {}),
      ...(destructive.length > 0 && limits ? { destructiveLimitMm: limits.destructiveDeviationMm } : {}),
      ...(safe !== undefined ? { safe } : {}),
      ...(force ? { forced: true } : {}),
      ms: 0,
    };
    if (useSafe && safe) {
      // La segura se rehace con su tolerancia (Manifold es determinista: mismos triángulos que en la búsqueda).
      // Se anula antes de rehacer: si `simplify` lanza, el `finally` no la libera dos veces.
      simplified.delete();
      simplified = null;
      simplified = original.simplify(safe.toleranceMm / maxScale);
      report = withSafeApplied(report, safe, size);
    }
    // Mismo sistema local que la original (sin recentrar ni apoyar en la cama): la pieza queda donde estaba en el
    // mundo con la misma posición, giro y escala.
    const mesh = applied ? manifoldToMeshData(simplified, registry?.idToColor) : null;
    report.ms = Math.round(now() - t0);
    return { mesh, report };
  } finally {
    original?.delete();
    simplified?.delete();
  }
}
