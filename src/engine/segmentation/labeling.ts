/**
 * @file src/engine/segmentation/labeling.ts
 * @description Etapa final de la detección: elige el cuerpo principal, clasifica cada región, la etiqueta (con numeración de duplicados) y le asigna color. Código movido tal cual desde `detectStructuralRegions`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type {
  DetectedStructureRegion,
  MeshData,
  SceneObject,
  StructuralArchetype,
  Vec3,
} from '../../types/kura';
import type { MutableRegion, TriangleGraphData } from './adjacency';
import {
  ARCHETYPE_LABELS,
  classifyRegionArchetype,
  computePositionalQualifier,
} from './classification';
import { STRUCTURAL_COLOR_PALETTE } from './constants';

/** Caja envolvente global del modelo. */
export interface ModelBounds {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  span: Vec3;
}

/**
 * Clasifica, etiqueta y colorea las regiones finales de una malla ya segmentada.
 *
 * @param shellCount Cantidad de cáscaras topológicas desconectadas de la malla.
 */
export function labelStructuralRegions(
  obj: SceneObject,
  mesh: MeshData,
  graph: TriangleGraphData,
  modelBounds: ModelBounds,
  regionsMap: Map<number, MutableRegion>,
  shellCount: number,
  totalTriangles: number
): DetectedStructureRegion[] {
  // Determinar si cada cáscara tiene una única región (isla física completa)
  const regionsPerShell = new Map<number, number>();
  for (const reg of regionsMap.values()) {
    regionsPerShell.set(reg.shellId, (regionsPerShell.get(reg.shellId) ?? 0) + 1);
  }

  // Elegir el cuerpo principal por mayor área superficial (evitando placas base muy planas si hay alternativas)
  const regionList = Array.from(regionsMap.values()).sort((a, b) => b.area - a.area);
  let mainBodyRegionId = regionList[0]?.id ?? -1;
  if (regionList.length > 1) {
    for (const candidate of regionList) {
      const prelim = classifyRegionArchetype(
        candidate,
        mesh,
        graph,
        modelBounds,
        false
      );
      const sortedExt = [...prelim.dimensionsMm].sort((a, b) => b - a);
      const flat = sortedExt[2] / Math.max(sortedExt[1], 0.01);
      const isFlatBase =
        flat < 0.22 && prelim.centerMm[1] < modelBounds.min[1] + 0.25 * modelBounds.span[1];
      if (!isFlatBase) {
        mainBodyRegionId = candidate.id;
        break;
      }
    }
  }

  // 5. Clasificar todas las regiones, etiquetar y asignar colores de alto contraste
  interface RawClassified {
    reg: MutableRegion;
    archetype: StructuralArchetype;
    dimensionsMm: Vec3;
    centerMm: Vec3;
    confidence: number;
    baseEs: string;
    baseEn: string;
    isDisconnectedShell: boolean;
  }

  const classified: RawClassified[] = regionList.map((reg) => {
    const isMain = reg.id === mainBodyRegionId;
    const info = classifyRegionArchetype(reg, mesh, graph, modelBounds, isMain);
    const meta = ARCHETYPE_LABELS[info.archetype];
    const qualifier =
      info.archetype === 'main_body'
        ? null
        : computePositionalQualifier(
            info.centerMm,
            modelBounds.center,
            modelBounds.span,
            meta.feminineEs
          );

    const baseEs = qualifier ? `${meta.es} ${qualifier.es}` : meta.es;
    const baseEn = qualifier ? `${meta.en} (${qualifier.en})` : meta.en;

    return {
      reg,
      archetype: info.archetype,
      dimensionsMm: info.dimensionsMm,
      centerMm: info.centerMm,
      confidence: info.confidence,
      baseEs,
      baseEn,
      isDisconnectedShell: (regionsPerShell.get(reg.shellId) ?? 1) === 1 && shellCount > 1,
    };
  });

  // Numerar duplicados de forma limpia (ej. "Tanque / Cilindro 1", "Tanque / Cilindro 2")
  const labelCounts = new Map<string, number>();
  for (const item of classified) {
    labelCounts.set(item.baseEs, (labelCounts.get(item.baseEs) ?? 0) + 1);
  }
  const labelSeen = new Map<string, number>();

  const finalRegions: DetectedStructureRegion[] = classified.map((item, idx) => {
    const totalSame = labelCounts.get(item.baseEs) ?? 1;
    let labelEs = item.baseEs;
    let labelEn = item.baseEn;
    if (totalSame > 1) {
      const seq = (labelSeen.get(item.baseEs) ?? 0) + 1;
      labelSeen.set(item.baseEs, seq);
      labelEs = `${item.baseEs} ${seq}`;
      labelEn = `${item.baseEn} ${seq}`;
    }

    const triIndices = [...item.reg.tris].sort((a, b) => a - b);
    const color = STRUCTURAL_COLOR_PALETTE[idx % STRUCTURAL_COLOR_PALETTE.length];

    return {
      id: `${obj.id}_region_${idx + 1}`,
      labelEs,
      labelEn,
      archetype: item.archetype,
      color,
      faceIndices: triIndices,
      triangleCount: triIndices.length,
      percentOfModel: Number(((triIndices.length / totalTriangles) * 100).toFixed(2)),
      dimensionsMm: item.dimensionsMm,
      centerMm: item.centerMm,
      confidence: item.confidence,
      isDisconnectedShell: item.isDisconnectedShell,
    };
  });

  return finalRegions;
}
