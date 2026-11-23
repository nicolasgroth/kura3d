/**
 * @file src/engine/printability.ts
 * @description Informe de imprimibilidad de un objeto en espacio de mundo: cierre manifold,
 * normales invertidas, encaje en la cama (bajo la cama y fuera del volumen por separado),
 * flotación, voladizo ponderado por área, paredes delgadas por muestreo, facetado de curvas,
 * peso y filamento con sus supuestos. Los avisos son códigos con parámetros (`PrintWarning`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../i18n';
import {
  MATERIAL_PRESETS,
  type MaterialPresetId,
  type PrintabilityReport,
  type PrintWarning,
  type PrintWarningCode,
  type PrinterProfile,
  type SceneObject,
} from '../types/kura';
import { requireOperationRange } from './engineErrors';
import { signedVolumeMm3 } from './meshOrientation';
import { OPERATION_DEFAULTS, OPERATION_RANGES } from './operationLimits';
import { applyTransformToMesh, computeMeshStats } from './primitives';
import { measureSealedCavities } from './printabilityCavities';
import { faceGeometry, hasFacetedCurvature, measureOverhang, sampleWallThickness } from './printabilityChecks';

/** Sobre este conteo no se busca faceteado (malla ya fina y la comprobación sería cara). */
const FACETED_CHECK_MAX_TRIANGLES = 50_000;

/** Fracción sólida asumida por perímetros y tapas en la estimación de peso. */
export const PRINT_SHELL_FRACTION = 0.22;
/** Diámetro de filamento asumido (mm). */
export const PRINT_FILAMENT_DIAMETER_MM = 1.75;
/** Porcentaje de área con pared delgada a partir del cual se avisa. */
const THIN_WALL_MIN_AREA_PERCENT = 1;

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Crea un aviso de imprimibilidad con números redondeados a 2 decimales. */
function printWarning(code: PrintWarningCode, params: Record<string, string | number> = {}): PrintWarning {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) out[k] = typeof v === 'number' ? round2(v) : v;
  return { code, params: out };
}

/** Texto del aviso en un idioma (`printWarning.<código>`). */
export function localizePrintWarning(lang: Parameters<typeof t>[0], warning: PrintWarning): string {
  return t(lang, `printWarning.${warning.code}` as TranslationKey, warning.params);
}

/**
 * Analiza la imprimibilidad de `obj` frente a la cama `bed`.
 *
 * @param materialId Material para la densidad (por defecto `'pla_matte'`).
 * @param infillPercent Relleno 0..100 (por defecto 20).
 * @param overhangAngleDeg Ángulo de voladizo desde la vertical (por defecto 45°).
 * @param minWallMm Espesor mínimo de pared en mm (por defecto 0,8; 0 desactiva la medición).
 */
export function analyzePrintability(
  obj: SceneObject,
  bed: PrinterProfile,
  materialId: MaterialPresetId = 'pla_matte',
  infillPercent: number = OPERATION_DEFAULTS.printability.infillPercent,
  overhangAngleDeg: number = OPERATION_DEFAULTS.printability.overhangAngleDeg,
  minWallMm: number = OPERATION_DEFAULTS.printability.minWallMm,
): PrintabilityReport {
  const limits = OPERATION_RANGES.printability;
  const infill = requireOperationRange('infillPercent', infillPercent, limits.infillPercent);
  const angle = requireOperationRange('overhangAngleDeg', overhangAngleDeg, limits.overhangAngleDeg);
  const minWall = requireOperationRange('minWallMm', minWallMm, limits.minWallMm);

  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const stats = computeMeshStats(world);
  const vertCount = Math.floor(world.positions.length / 3);
  const triCount = Math.floor(world.indices.length / 3);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertCount; i++) {
    const x = world.positions[i * 3], y = world.positions[i * 3 + 1], z = world.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  if (vertCount === 0) minX = minY = minZ = maxX = maxY = maxZ = 0;

  const eps = 0.05;
  const halfW = bed.bedWidthMm * 0.5;
  const halfD = bed.bedDepthMm * 0.5;
  const isBelowBed = minY < -eps;
  const exceedsVolume =
    minX < -halfW - eps || maxX > halfW + eps || minZ < -halfD - eps || maxZ > halfD + eps ||
    maxY > bed.maxHeightMm + eps || maxY - minY > bed.maxHeightMm + eps;
  const fitsInBed = !isBelowBed && !exceedsVolume;
  const isFloating = minY > 0.25;

  const signedVolume = signedVolumeMm3(world);
  const normalsInverted = stats.isManifold && signedVolume < 0;
  // Con normales invertidas se mide con la orientación corregida para no confundir techo y piso.
  const geo = faceGeometry(world, normalsInverted ? -1 : 1);
  const overhang = measureOverhang(world, geo, angle, minY);
  const overhangPercent = geo.totalArea > 0 ? (overhang.areaMm2 / geo.totalArea) * 100 : 0;
  const thickness = stats.isManifold ? sampleWallThickness(world, geo, minWall) : null;

  const preset = MATERIAL_PRESETS[materialId] ?? MATERIAL_PRESETS.pla_matte;
  const fillRatio = Math.min(1, PRINT_SHELL_FRACTION + (1 - PRINT_SHELL_FRACTION) * (infill / 100));
  const volumeCm3 = Math.abs(signedVolume) / 1000;
  const effectiveVolumeCm3 = volumeCm3 * fillRatio;
  const estimatedWeightGrams = effectiveVolumeCm3 * preset.densityGCm3;
  const filamentRadius = PRINT_FILAMENT_DIAMETER_MM / 2;
  const estimatedFilamentMeters = (effectiveVolumeCm3 * 1000) / (Math.PI * filamentRadius * filamentRadius) / 1000;

  // Faceteado: solo se busca en mallas livianas (la comprobación recorre la curvatura).
  const faceted = triCount > 0 && triCount <= FACETED_CHECK_MAX_TRIANGLES && hasFacetedCurvature(world, geo);
  // Densa: la misma fuente que el aviso al importar (`OPERATION_DEFAULTS.heavyMesh`).
  const densityQuality: PrintabilityReport['densityQuality'] = faceted ? 'low' : triCount >= OPERATION_DEFAULTS.heavyMesh.warnTriangles ? 'high' : 'optimal';

  const issues: PrintWarning[] = [];
  let score = 100;
  if (!stats.isManifold) {
    issues.push(printWarning('NOT_MANIFOLD'));
    // Sin malla cerrada no hay interior: la pared no se mide, y se dice en vez de informar 0 %.
    issues.push(printWarning('WALL_NOT_MEASURED'));
    score -= 35;
  }
  if (normalsInverted) {
    issues.push(printWarning('INVERTED_NORMALS', { volume: signedVolume }));
    score -= 25;
  }
  if (isBelowBed) {
    issues.push(printWarning('BELOW_BED', { depth: -minY }));
    score -= 20;
  }
  if (exceedsVolume) {
    issues.push(printWarning('EXCEEDS_BED', { width: bed.bedWidthMm, depth: bed.bedDepthMm, height: bed.maxHeightMm }));
    score -= 25;
  }
  if (isFloating) {
    issues.push(printWarning('FLOATING', { gap: minY }));
    score -= 20;
  }
  if (thickness && thickness.thinAreaPercent >= THIN_WALL_MIN_AREA_PERCENT) {
    issues.push(printWarning('THIN_WALL', { thickness: thickness.minThicknessMm, min: minWall }));
    score -= Math.min(30, 10 + Math.round(thickness.thinAreaPercent * 0.4));
  }
  if (overhangPercent > 5) {
    issues.push(printWarning('OVERHANG', { percent: Math.round(overhangPercent * 10) / 10, angle }));
  }
  score -= Math.min(25, Math.round(overhangPercent * 0.55));
  // Cavidad cerrada sin salida (pieza ahuecada sin orificio): hecho geométrico, sin restar nota.
  const cavities = measureSealedCavities(world);
  if (cavities.count > 0) {
    issues.push(printWarning('SEALED_CAVITY', { count: cavities.count, volume: Math.round(cavities.volumeMm3 / 10) / 100 }));
  }
  if (densityQuality === 'low') issues.push(printWarning('LOW_DENSITY'));
  else if (densityQuality === 'high') issues.push(printWarning('HIGH_DENSITY'));
  score = Math.max(0, Math.min(100, score));

  const minThickness = thickness && Number.isFinite(thickness.minThicknessMm) ? round2(thickness.minThicknessMm) : null;
  return {
    objectId: obj.id,
    isManifold: stats.isManifold,
    fitsInBed,
    isFloating,
    isBelowBed,
    normalsInverted,
    minYWorldMm: minY,
    overhangFaceCount: overhang.faceIndices.length,
    overhangPercent,
    overhangFaceIndices: overhang.faceIndices,
    overhangAngleDeg: angle,
    overhangAreaMm2: overhang.areaMm2,
    surfaceAreaMm2: geo.totalArea,
    minWallMm: minWall,
    minWallThicknessMm: minThickness,
    wallMeasured: thickness !== null,
    thinWallAreaPercent: thickness?.thinAreaPercent ?? 0,
    volumeCm3,
    estimatedWeightGrams,
    estimatedFilamentMeters,
    weightAssumptions: {
      materialId: preset.id,
      densityGCm3: preset.densityGCm3,
      infillPercent: infill,
      shellFraction: PRINT_SHELL_FRACTION,
      filamentDiameterMm: PRINT_FILAMENT_DIAMETER_MM,
    },
    triangleCount: triCount,
    densityQuality,
    issues,
    warnings: issues.map((w) => localizePrintWarning('es', w)),
    score,
  };
}
