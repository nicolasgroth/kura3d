/**
 * @file src/engine/segmentation/classification.ts
 * @description Clasificación geométrica de regiones en arquetipos estructurales, tablas de etiquetas bilingües y calificativo posicional.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, StructuralArchetype, Vec3 } from '../../types/kura';
import type { MutableRegion, TriangleGraphData } from './adjacency';
import { computePrincipalAxes } from './geometryUtils';

/**
 * Clasifica geométricamente una región en su arquetipo estructural determinístico
 * y calcula su confianza heurística (0..100).
 */
export function classifyRegionArchetype(
  region: MutableRegion,
  mesh: MeshData,
  graph: TriangleGraphData,
  modelBounds: { min: Vec3; max: Vec3; center: Vec3; span: Vec3 },
  isMainBody: boolean
): {
  archetype: StructuralArchetype;
  dimensionsMm: Vec3;
  centerMm: Vec3;
  confidence: number;
} {
  const positions = mesh.positions;
  const indices = mesh.indices;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const count = region.tris.length;
  const pts = new Float64Array(count * 3);
  const weights = new Float64Array(count);

  let sumNx = 0;
  let sumNy = 0;
  let sumNz = 0;
  let totalArea = 0;

  for (let i = 0; i < count; i++) {
    const t = region.tris[i];
    const w = Math.max(graph.areas[t], 1e-6);
    weights[i] = w;
    totalArea += w;

    const cx = graph.centroids[t * 3];
    const cy = graph.centroids[t * 3 + 1];
    const cz = graph.centroids[t * 3 + 2];
    pts[i * 3] = cx;
    pts[i * 3 + 1] = cy;
    pts[i * 3 + 2] = cz;

    const nx = graph.normals[t * 3];
    const ny = graph.normals[t * 3 + 1];
    const nz = graph.normals[t * 3 + 2];
    sumNx += nx * w;
    sumNy += ny * w;
    sumNz += nz * w;

    for (let c = 0; c < 3; c++) {
      const vIdx = indices[t * 3 + c] * 3;
      const vx = positions[vIdx];
      const vy = positions[vIdx + 1];
      const vz = positions[vIdx + 2];
      if (vx < minX) minX = vx;
      if (vy < minY) minY = vy;
      if (vz < minZ) minZ = vz;
      if (vx > maxX) maxX = vx;
      if (vy > maxY) maxY = vy;
      if (vz > maxZ) maxZ = vz;
    }
  }

  const dx = Math.max(0, maxX - minX);
  const dy = Math.max(0, maxY - minY);
  const dz = Math.max(0, maxZ - minZ);
  const dimensionsMm: Vec3 = [dx, dy, dz];
  const centerMm: Vec3 = region.centerMm;

  const sorted = [dx, dy, dz].sort((a, b) => b - a);
  const d1 = sorted[0];
  const d2 = sorted[1];
  const d3 = sorted[2];
  const elongation = d1 / Math.max(d2, 0.01);
  const flatness = d3 / Math.max(d2, 0.01);

  const [u1, u2, u3] = computePrincipalAxes(pts, weights, count, centerMm);

  // Planaridad: fracción del área superficial cuyas normales están alineadas a <= 18° de algún eje principal o cartesiano.
  // Una caja o placa tiene ~1.0; un cilindro tiene ~0.40-0.52; una esfera tiene ~0.15-0.25.
  let globalAlignedArea = 0;
  let pcaAlignedArea = 0;
  for (let i = 0; i < count; i++) {
    const t = region.tris[i];
    const w = weights[i];
    const nx = graph.normals[t * 3];
    const ny = graph.normals[t * 3 + 1];
    const nz = graph.normals[t * 3 + 2];

    const gMax = Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz));
    if (gMax >= 0.95) {
      globalAlignedArea += w;
    }

    const a1 = Math.abs(nx * u1[0] + ny * u1[1] + nz * u1[2]);
    const a2 = Math.abs(nx * u2[0] + ny * u2[1] + nz * u2[2]);
    const a3 = Math.abs(nx * u3[0] + ny * u3[1] + nz * u3[2]);
    if (Math.max(a1, a2, a3) >= 0.95) {
      pcaAlignedArea += w;
    }
  }
  const planarity = Math.max(
    globalAlignedArea / Math.max(totalArea, 1e-6),
    pcaAlignedArea / Math.max(totalArea, 1e-6)
  );

  // Esfericidad: evaluamos dispersión radial y alineación normal-radial respecto a 3 centros candidatos
  const bboxCenter: Vec3 = [
    (minX + maxX) * 0.5,
    (minY + maxY) * 0.5,
    (minZ + maxZ) * 0.5,
  ];
  const meanNLen = Math.hypot(sumNx, sumNy, sumNz) || 1;
  const meanN: Vec3 = [sumNx / meanNLen, sumNy / meanNLen, sumNz / meanNLen];
  const domeCenter: Vec3 = [
    bboxCenter[0] - meanN[0] * d3 * 0.25,
    bboxCenter[1] - meanN[1] * d3 * 0.25,
    bboxCenter[2] - meanN[2] * d3 * 0.25,
  ];

  let bestSphericity = 0;
  for (const cand of [centerMm, bboxCenter, domeCenter]) {
    let meanR = 0;
    let radialDotSum = 0;
    const dists = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const t = region.tris[i];
      const rx = pts[i * 3] - cand[0];
      const ry = pts[i * 3 + 1] - cand[1];
      const rz = pts[i * 3 + 2] - cand[2];
      const dist = Math.hypot(rx, ry, rz);
      dists[i] = dist;
      meanR += dist * weights[i];
      if (dist > 1e-6) {
        const dot =
          (rx * graph.normals[t * 3] +
            ry * graph.normals[t * 3 + 1] +
            rz * graph.normals[t * 3 + 2]) /
          dist;
        radialDotSum += Math.max(0, dot) * weights[i];
      }
    }
    meanR /= Math.max(totalArea, 1e-6);
    const radialDot = radialDotSum / Math.max(totalArea, 1e-6);

    let varR = 0;
    for (let i = 0; i < count; i++) {
      const diff = dists[i] - meanR;
      varR += diff * diff * weights[i];
    }
    const stdR = Math.sqrt(varR / Math.max(totalArea, 1e-6));
    const cvR = stdR / Math.max(meanR, 1e-4);
    const score = Math.max(0, Math.min(1, (1 - cvR) * radialDot));
    if (score > bestSphericity) {
      bestSphericity = score;
    }
  }

  // Cilindricidad: ajuste analítico de centro circular (cx, cy, R) en el plano (u2, u3)
  // perpendicular al eje primario u1; funciona con precisión tanto en cilindros completos
  // como en arcos parciales de cilindros unidos a otro sólido (p. ej. tanques o tubos).
  let barrelArea = 0;
  let meanU2 = 0;
  let meanU3 = 0;
  let meanN2 = 0;
  let meanN3 = 0;
  const barrelFlag = new Uint8Array(count);
  const projU2 = new Float64Array(count);
  const projU3 = new Float64Array(count);
  const normU2 = new Float64Array(count);
  const normU3 = new Float64Array(count);

  for (let i = 0; i < count; i++) {
    const t = region.tris[i];
    const w = weights[i];
    const nx = graph.normals[t * 3];
    const ny = graph.normals[t * 3 + 1];
    const nz = graph.normals[t * 3 + 2];
    const axialAlign = Math.abs(nx * u1[0] + ny * u1[1] + nz * u1[2]);
    if (axialAlign > 0.85) continue;

    const dxp = pts[i * 3] - centerMm[0];
    const dyp = pts[i * 3 + 1] - centerMm[1];
    const dzp = pts[i * 3 + 2] - centerMm[2];
    const p2 = dxp * u2[0] + dyp * u2[1] + dzp * u2[2];
    const p3 = dxp * u3[0] + dyp * u3[1] + dzp * u3[2];

    const rawN2 = nx * u2[0] + ny * u2[1] + nz * u2[2];
    const rawN3 = nx * u3[0] + ny * u3[1] + nz * u3[2];
    const nPerpLen = Math.hypot(rawN2, rawN3);
    if (nPerpLen < 1e-4) continue;
    const n2 = rawN2 / nPerpLen;
    const n3 = rawN3 / nPerpLen;

    barrelFlag[i] = 1;
    projU2[i] = p2;
    projU3[i] = p3;
    normU2[i] = n2;
    normU3[i] = n3;
    barrelArea += w;
    meanU2 += p2 * w;
    meanU3 += p3 * w;
    meanN2 += n2 * w;
    meanN3 += n3 * w;
  }

  let cylindricality = 0;
  if (barrelArea > 0.25 * totalArea) {
    meanU2 /= barrelArea;
    meanU3 /= barrelArea;
    meanN2 /= barrelArea;
    meanN3 /= barrelArea;

    let numR = 0;
    let denR = 0;
    for (let i = 0; i < count; i++) {
      if (!barrelFlag[i]) continue;
      const w = weights[i];
      const du2 = projU2[i] - meanU2;
      const du3 = projU3[i] - meanU3;
      const dn2 = normU2[i] - meanN2;
      const dn3 = normU3[i] - meanN3;
      numR += w * (du2 * dn2 + du3 * dn3);
      denR += w * (dn2 * dn2 + dn3 * dn3);
    }

    const fittedR = denR > 1e-8 ? numR / denR : 0;
    const cx2 = meanU2 - fittedR * meanN2;
    const cy3 = meanU3 - fittedR * meanN3;

    let meanDist = 0;
    let cylDotSum = 0;
    const perpDists = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      if (!barrelFlag[i]) continue;
      const w = weights[i];
      const rx = projU2[i] - cx2;
      const ry = projU3[i] - cy3;
      const r = Math.hypot(rx, ry);
      perpDists[i] = r;
      meanDist += r * w;
      if (r > 1e-6) {
        const dot = Math.max(0, (rx * normU2[i] + ry * normU3[i]) / r);
        cylDotSum += dot * w;
      }
    }

    meanDist /= barrelArea;
    const cylDot = cylDotSum / barrelArea;
    let varPerpR = 0;
    for (let i = 0; i < count; i++) {
      if (!barrelFlag[i]) continue;
      const diff = perpDists[i] - meanDist;
      varPerpR += diff * diff * weights[i];
    }
    const stdPerpR = Math.sqrt(varPerpR / barrelArea);
    const cvPerpR = stdPerpR / Math.max(meanDist, 1e-4);
    cylindricality = Math.max(0, Math.min(1, (1 - cvPerpR * 2.0) * cylDot));
  }

  if (isMainBody) {
    return {
      archetype: 'main_body',
      dimensionsMm,
      centerMm,
      confidence: 92,
    };
  }

  const modelMaxDim = Math.max(
    modelBounds.span[0],
    modelBounds.span[1],
    modelBounds.span[2],
    1
  );
  const thinCrossSection = d2 <= modelMaxDim * 0.18;

  if (
    (elongation >= 2.6 && thinCrossSection && (cylindricality >= 0.55 || planarity <= 0.72)) ||
    (elongation >= 3.4 && cylindricality >= 0.6)
  ) {
    return {
      archetype: 'tube_conduit',
      dimensionsMm,
      centerMm,
      confidence: Math.round(78 + Math.min(20, cylindricality * 20)),
    };
  }

  if (
    cylindricality >= 0.62 &&
    elongation >= 1.25 &&
    elongation < 3.2 &&
    planarity <= 0.75
  ) {
    return {
      archetype: 'tank_cylinder',
      dimensionsMm,
      centerMm,
      confidence: Math.round(76 + Math.min(22, cylindricality * 22)),
    };
  }

  if (
    bestSphericity >= 0.65 &&
    elongation < 1.65 &&
    flatness >= 0.45 &&
    planarity <= 0.72
  ) {
    const upperBonus = centerMm[1] > modelBounds.center[1] ? 8 : 0;
    return {
      archetype: 'dome_helmet',
      dimensionsMm,
      centerMm,
      confidence: Math.min(98, Math.round(70 + bestSphericity * 20 + upperBonus)),
    };
  }

  if (planarity > 0.72 || flatness < 0.25) {
    return {
      archetype: 'block_plate',
      dimensionsMm,
      centerMm,
      confidence: Math.round(74 + planarity * 20),
    };
  }

  if (elongation >= 1.85) {
    return {
      archetype: 'appendage',
      dimensionsMm,
      centerMm,
      confidence: 75,
    };
  }

  return {
    archetype: 'detail_part',
    dimensionsMm,
    centerMm,
    confidence: 68,
  };
}

/** Tablas de nombres base en español e inglés por arquetipo estructural. */
export const ARCHETYPE_LABELS: Record<
  StructuralArchetype,
  { es: string; en: string; feminineEs: boolean }
> = {
  main_body: { es: 'Cuerpo principal', en: 'Main body', feminineEs: false },
  tank_cylinder: { es: 'Tanque / Cilindro', en: 'Tank / Cylinder', feminineEs: false },
  tube_conduit: { es: 'Tubo / Conducto', en: 'Tube / Conduit', feminineEs: false },
  dome_helmet: { es: 'Cúpula / Escafandra', en: 'Dome / Helmet', feminineEs: true },
  block_plate: { es: 'Bloque / Placa', en: 'Block / Plate', feminineEs: false },
  appendage: { es: 'Extremidad / Apéndice', en: 'Appendage / Limb', feminineEs: true },
  detail_part: { es: 'Sub-estructura', en: 'Sub-structure', feminineEs: true },
};

/**
 * Genera el calificativo posicional en español e inglés según la ubicación relativa
 * de la sub-estructura respecto al centro envolvente del modelo completo.
 */
export function computePositionalQualifier(
  center: Vec3,
  modelCenter: Vec3,
  modelSpan: Vec3,
  feminineEs: boolean
): { es: string; en: string } | null {
  const relX = (center[0] - modelCenter[0]) / Math.max(modelSpan[0], 1);
  const relY = (center[1] - modelCenter[1]) / Math.max(modelSpan[1], 1);
  const relZ = (center[2] - modelCenter[2]) / Math.max(modelSpan[2], 1);

  if (relY > 0.22) return { es: 'superior', en: 'upper' };
  if (relY < -0.22) return { es: 'inferior', en: 'lower' };
  if (relX < -0.15) return { es: feminineEs ? 'izquierda' : 'izquierdo', en: 'left' };
  if (relX > 0.15) return { es: feminineEs ? 'derecha' : 'derecho', en: 'right' };
  if (relZ < -0.18) return { es: 'posterior', en: 'rear' };
  if (relZ > 0.18) return { es: 'frontal', en: 'front' };
  return null;
}
