/**
 * @file src/core/operations/partOperations.ts
 * @description Operaciones puras que dividen un objeto en piezas nuevas: corte por plano, islas
 * desconectadas, separación por color, moldes, extracción y división por estructuras detectadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type {
  DetectedStructureRegion,
  MeshData,
  MoldOptions,
  PlaneCutOptions,
  SceneObject,
  StructuralSegmentationResult,
} from '../../types/kura';
import { userAxisOfInternal } from '../scene/displayAxes';
import { worldBaked } from '../scene/sceneObjects';
import { buildWith, change, meshPatch, type OperationContext, type SceneChange } from './operationTypes';

/** Corta por plano con conectores. Sin piezas (el plano no corta) devuelve `parts` vacío. */
export async function planeCut(
  ctx: OperationContext,
  obj: SceneObject,
  options: PlaneCutOptions,
): Promise<{ parts: SceneObject[]; change: SceneChange }> {
  const result = await engine.planeCutWithConnectors(obj, options);
  const warnings = [...(result.warnings ?? [])];
  // Mitad A = lado negativo del eje que ve el usuario; B = lado positivo (Z = altura, Y = fondo). El
  // lado positivo del motor en Z es el negativo del usuario en Y.
  const positiveIsUserPositive = userAxisOfInternal(options.axis).sign > 0;
  const halves = [
    { part: result.positive, half: positiveIsUserPositive ? ('b' as const) : ('a' as const) },
    { part: result.negative, half: positiveIsUserPositive ? ('a' as const) : ('b' as const) },
  ].filter((h) => h.part !== null);
  const parts = halves.map(({ part, half }) => buildWith(ctx, {
    name: ctx.naming.cutHalf(obj, half),
    source: 'cut_part',
    mesh: part!.mesh,
    position: part!.position,
    color: obj.color,
    materialPreset: obj.materialPreset,
  }));
  return { parts, change: change({ added: parts, removedIds: parts.length > 0 ? [obj.id] : [], warnings }) };
}

/**
 * Colores de una pieza separada: si todas sus caras tienen el mismo color, ese pasa a ser el color base
 * y la malla queda sin `faceColors`; si no, conserva la pintura por cara y el color base de origen.
 */
export function pieceColors(mesh: MeshData, fallback: string): { mesh: MeshData; color: string } {
  const fc = mesh.faceColors;
  if (!fc?.length) return { mesh, color: fallback };
  const first = fc[0];
  if (fc.every((c) => c === first)) {
    const { faceColors: _drop, ...rest } = mesh;
    return { mesh: rest as MeshData, color: first };
  }
  return { mesh, color: fallback };
}

/** Separa islas desconectadas. Con una sola isla (o ninguna) no cambia la escena. */
export async function splitDisconnected(
  ctx: OperationContext,
  obj: SceneObject,
): Promise<{ pieceCount: number; parts: SceneObject[]; change: SceneChange }> {
  const pieces = await engine.splitDisconnectedParts(obj);
  if (pieces.length <= 1) return { pieceCount: pieces.length, parts: [], change: change({}) };
  const parts = pieces.map((piece, idx) => {
    const colored = pieceColors(piece.mesh, obj.color);
    return buildWith(ctx, {
      name: ctx.naming.piece(obj, idx),
      source: 'cut_part',
      mesh: colored.mesh,
      position: piece.position,
      color: colored.color,
      materialPreset: obj.materialPreset,
    });
  });
  return { pieceCount: pieces.length, parts, change: change({ added: parts, removedIds: [obj.id] }) };
}

/**
 * Separa por color de cara en sólidos cerrados (`splitMeshByColorSolid`): cada color no base toma una
 * capa de `depthMm` hacia el interior. Con menos de `minParts` piezas no construye nada ni cambia la
 * escena (la app separa desde 1 pieza; el MCP headless exige 2).
 */
export async function splitByColor(
  ctx: OperationContext,
  obj: SceneObject,
  minParts = 1,
  options: engine.ColorSplitOptions = {},
): Promise<{ pieceCount: number; parts: SceneObject[]; change: SceneChange }> {
  const { parts: pieces, warnings } = await engine.splitMeshByColorSolid(obj, options);
  if (pieces.length < minParts) return { pieceCount: pieces.length, parts: [], change: change({ warnings: [...warnings] }) };
  const parts = pieces.map((piece, idx) => buildWith(ctx, {
    name: ctx.naming.colorPart(obj, piece.color, idx),
    source: 'color_split',
    mesh: piece.mesh,
    position: piece.position,
    color: piece.color,
    materialPreset: obj.materialPreset,
  }));
  return {
    pieceCount: pieces.length,
    parts,
    change: change({ added: parts, removedIds: parts.length > 0 ? [obj.id] : [], warnings: [...warnings] }),
  };
}

/** Genera las piezas de molde (el maestro se conserva). */
export async function generateMold(
  ctx: OperationContext,
  obj: SceneObject,
  options: MoldOptions,
): Promise<{ parts: SceneObject[]; change: SceneChange }> {
  const { parts: generated, warnings } = await engine.generateMoldDetailed(obj, options);
  const parts = generated.map((part) => buildWith(ctx, {
    name: ctx.naming.moldPart(obj, part),
    source: 'mold',
    mesh: part.mesh,
    position: part.position,
    color: part.color,
    materialPreset: part.materialPreset,
  }));
  return { parts, change: change({ added: parts, warnings }) };
}

/**
 * Extrae una región como pieza cerrada. Con `removeFromSource`, el origen queda como remanente
 * (en espacio mundial) o sale de la escena si no queda material.
 */
export async function extractStructure(
  ctx: OperationContext,
  obj: SceneObject,
  segmentation: StructuralSegmentationResult,
  region: DetectedStructureRegion,
  removeFromSource: boolean,
  extra: { isHole?: boolean } = {},
): Promise<{ extracted: SceneObject; sourceDeleted: boolean; change: SceneChange }> {
  const res = await engine.extractStructuralRegion(obj, region, removeFromSource);
  const extracted = buildWith(ctx, {
    name: ctx.naming.structurePart(obj, segmentation.regions, region),
    source: 'segmented_part',
    mesh: res.extracted.mesh,
    position: res.extracted.position,
    color: region.color,
    materialPreset: obj.materialPreset,
    isHole: extra.isHole,
  });
  if (!removeFromSource) return { extracted, sourceDeleted: false, change: change({ added: [extracted] }) };
  if (!res.remainder) {
    return { extracted, sourceDeleted: true, change: change({ added: [extracted], removedIds: [obj.id] }) };
  }
  const patch = meshPatch(ctx, obj, res.remainder.mesh, { ...worldBaked(), position: res.remainder.position });
  return { extracted, sourceDeleted: false, change: change({ added: [extracted], patches: [{ id: obj.id, patch }] }) };
}

/** Divide el objeto en todas sus estructuras detectadas (el origen sale de la escena). */
export async function splitStructures(
  ctx: OperationContext,
  obj: SceneObject,
  segmentation: StructuralSegmentationResult,
): Promise<{ parts: SceneObject[]; change: SceneChange }> {
  const pieces = await engine.splitAllDetectedStructures(obj, segmentation);
  const byId = new Map(segmentation.regions.map((r) => [r.id, r]));
  const parts = pieces.map((part) => buildWith(ctx, {
    name: ctx.naming.structurePart(obj, segmentation.regions, byId.get(part.regionId) ?? ({ id: part.regionId } as DetectedStructureRegion)),
    source: 'segmented_part',
    mesh: part.mesh,
    position: part.position,
    color: part.color,
    materialPreset: obj.materialPreset,
  }));
  return { parts, change: change({ added: parts, removedIds: parts.length > 0 ? [obj.id] : [] }) };
}
