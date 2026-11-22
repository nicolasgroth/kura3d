/**
 * @file src/core/operations/splitOperations.ts
 * @description Operaciones puras de "dividir para imprimir": plan (solo lectura) y ejecución, que
 * reemplaza el objeto por sus piezas armadas en su lugar (`assembly`), con nombre por código de
 * rejilla (`ResultNaming.splitPart`), y deja en `metadata.split` la transformación de armado, la de
 * impresión con su placa virtual (`layoutSplitParts`) y las etiquetas de sus uniones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type { SceneObject, SplitDowelMetadata, SplitPartMetadata } from '../../types/kura';
import { buildWith, change, type OperationContext, type SceneChange } from './operationTypes';

/** Opciones de la ejecución en la escena. */
export interface ExecuteBedSplitOptions extends Omit<engine.BedSplitExecuteOptions, 'onProgress'> {
  /** Cama para la disposición de impresión (placas virtuales). */
  bed: engine.SplitBed;
  layout?: engine.SplitLayoutOptions;
}

/** Resultado de la ejecución (además del `SceneChange`). */
export interface ExecuteBedSplitResult {
  parts: SceneObject[];
  joints: engine.SplitJoint[];
  /** Lotes de tarugos sueltos (objetos aparte en la escena, nombrados con `ResultNaming.looseDowel`). */
  looseDowels: Array<{ id: string; name: string; diameterMm: number; lengthMm: number; count: number }>;
  plateCount: number;
  sourceVolumeMm3: number;
  clearanceVolumeMm3: number;
  engravedVolumeMm3: number;
  /** Resumen de la validación de armado (orden, bloqueos, choques, firmeza, uniones pegadas por el arreglo). */
  assembly?: engine.AssemblySummary;
  elapsedMs: number;
}

/** Plan de división (no cambia la escena). */
export function planSplitForBed(
  _ctx: OperationContext,
  obj: SceneObject,
  bed: engine.SplitBed,
  options: engine.BedSplitPlanOptions = {},
): Promise<engine.BedSplitPlan> {
  return engine.planBedSplit(obj, bed, options);
}

/**
 * Divide `obj` según `plan`. Las piezas quedan armadas en su lugar; su ubicación de impresión va en
 * `metadata.split.print`. Avisa el avance por corte con `ctx.onProgress('cut:i/n')`.
 */
export async function executeBedSplit(
  ctx: OperationContext,
  obj: SceneObject,
  plan: engine.BedSplitPlan,
  options: ExecuteBedSplitOptions,
): Promise<{ result: ExecuteBedSplitResult; change: SceneChange }> {
  const { bed, layout: layoutOptions, ...exec } = options;
  const res = await engine.executeBedSplitGeometry(obj, plan, {
    ...exec,
    onProgress: (done, total) => ctx.onProgress?.(`cut:${done}/${total}`),
  });
  const layout = engine.layoutSplitParts(res.parts, bed, layoutOptions);
  const parts = res.parts.map((part, i) => {
    const print = layout.placements[i];
    const split: SplitPartMetadata = {
      groupId: obj.id,
      code: part.code,
      cell: part.cell,
      assembly: part.assembly,
      print: { position: print.position, rotation: print.rotation, plate: print.plate, downFace: print.downFace },
      jointLabels: part.jointLabels,
      jointPartners: res.joints
        .filter((j) => j.a.code === part.code || j.b.code === part.code)
        .map((j) => ({ label: j.label, code: j.a.code === part.code ? j.b.code : j.a.code })),
      ...(part.assemblyStep !== undefined ? { assemblyStep: part.assemblyStep, insertDirection: part.insertDirection } : {}),
      joints: res.joints.filter((j) => j.a.code === part.code || j.b.code === part.code).map(engine.jointRecord),
    };
    const built = buildWith(ctx, {
      name: ctx.naming.splitPart(obj, part.code),
      source: 'cut_part',
      mesh: part.mesh,
      position: part.assembly.position,
      rotation: part.assembly.rotation,
      color: obj.color,
      materialPreset: obj.materialPreset,
    });
    return { ...built, metadata: { split } };
  });
  // Tarugos sueltos: un objeto por medida, de pie y al costado del modelo armado
  let x = Math.max(...res.parts.map((p) => p.bounds.max[0]), obj.position[0]) + 10;
  const dowels = res.looseDowels.map((d) => {
    const built = buildWith(ctx, {
      name: ctx.naming.looseDowel(d.diameterMm, d.lengthMm, d.count),
      source: 'cut_part',
      mesh: d.mesh,
      position: [x + Math.sqrt(d.count) * (d.diameterMm + 3) / 2, Math.min(...res.parts.map((p) => p.bounds.min[1])), obj.position[2]],
      rotation: [0, 0, 0],
      color: obj.color,
      materialPreset: obj.materialPreset,
    });
    x += Math.sqrt(d.count) * (d.diameterMm + 3) + 10;
    const splitDowel: SplitDowelMetadata = { groupId: obj.id, diameterMm: d.diameterMm, lengthMm: d.lengthMm, count: d.count };
    return { ...built, metadata: { splitDowel } };
  });
  return {
    result: {
      parts,
      joints: res.joints,
      looseDowels: dowels.map((o) => ({ id: o.id, name: o.name, ...o.metadata.splitDowel })),
      plateCount: layout.plateCount,
      sourceVolumeMm3: res.sourceVolumeMm3,
      clearanceVolumeMm3: res.clearanceVolumeMm3,
      engravedVolumeMm3: res.engravedVolumeMm3,
      assembly: res.assembly ? engine.summarizeAssembly(res.assembly) : undefined,
      elapsedMs: res.elapsedMs,
    },
    change: change({ added: [...parts, ...dowels], removedIds: parts.length > 0 ? [obj.id] : [], warnings: [...(plan.warnings ?? []), ...res.warnings] }),
  };
}
