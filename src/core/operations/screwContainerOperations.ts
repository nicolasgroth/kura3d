/**
 * @file src/core/operations/screwContainerOperations.ts
 * @description Operaciones puras (Worker, MCP sin interfaz, recetas) del recipiente con tapa roscada y de las roscas
 * emparejadas: generar una pieza del recipiente como objeto, generar la pareja ISO (perno + tuerca o agujero + perno)
 * lado a lado con su verificación de enroscado, y comprobar el enroscado entre dos objetos de la escena (eje en ejes
 * del usuario, armados donde están).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { worldMeshOf } from '../../engine/measure/objectMeasure';
import { createScrewContainer, type ScrewContainerOptions } from '../../engine/screwContainer';
import { checkScrewFitMeshes, type ScrewFitReport } from '../../engine/screwFit';
import { isoThreadPairFit } from '../../engine/threadPairFit';
import { threadDefaults } from '../../engine/threadDefaults';
import type { MeshData, SceneObject, ThreadOptions, Vec3 } from '../../types/kura';
import type { ScrewContainerPart, ScrewFitInput, THREAD_PAIRS } from '../bus/screwContainerSchema';
import { worldBox } from '../scene/overlap';
import { createThread } from './creationOperations';
import { buildWith, type OperationContext } from './operationTypes';

const BODY_COLOR = '#94a3b8';
const LID_COLOR = '#64748b';

/** Último recipiente generado: la receta pide cuerpo y tapa en dos pasos seguidos con las mismas medidas. */
let lastBuild: { key: string; body: MeshData; lid: MeshData; spec: ScrewContainerOptions } | null = null;
const copyMesh = (m: MeshData): MeshData => ({ positions: m.positions.slice(), indices: m.indices.slice() });

async function buildContainer(options: Partial<ScrewContainerOptions>) {
  const key = JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)));
  if (lastBuild?.key !== key) lastBuild = { key, ...(await createScrewContainer(options)) };
  return { body: copyMesh(lastBuild.body), lid: copyMesh(lastBuild.lid), spec: lastBuild.spec };
}

/** Una pieza del recipiente (cuerpo o tapa) como objeto nuevo, apoyado en la cama con su eje en `position`. */
export async function createScrewContainerPart(
  ctx: OperationContext,
  options: Partial<ScrewContainerOptions>,
  part: ScrewContainerPart,
  placement: { name: string; position?: Vec3 },
): Promise<{ object: SceneObject; spec: ScrewContainerOptions }> {
  const { body, lid, spec } = await buildContainer(options);
  const object = buildWith(ctx, {
    name: placement.name,
    source: 'thread',
    mesh: part === 'body' ? body : lid,
    position: placement.position,
    color: part === 'body' ? BODY_COLOR : LID_COLOR,
    materialPreset: 'pla_matte',
    role: 'solid',
  });
  return { object, spec };
}

export type ThreadPairKind = (typeof THREAD_PAIRS)[number];

export interface ThreadPairArgs {
  pair: ThreadPairKind;
  diameterMm: number;
  pitchMm: number;
  /** Largo roscado del perno y del agujero. La tuerca usa su alto por defecto (≈ ISO 4032). */
  lengthMm: number;
  clearanceMm?: number;
  /** Separación en X entre las dos piezas (mm). */
  gapMm?: number;
}

/** Las dos piezas de la pareja, una al lado de la otra en X, y la verificación de que enroscan. */
export async function createThreadPair(ctx: OperationContext, a: ThreadPairArgs): Promise<{ objects: SceneObject[]; fit: ScrewFitReport }> {
  const common = { diameterMm: a.diameterMm, pitchMm: a.pitchMm, clearanceMm: a.clearanceMm };
  const bolt: ThreadOptions = { ...common, kind: 'bolt', lengthMm: a.lengthMm, includeHead: true };
  const female: ThreadOptions = a.pair === 'bolt-nut'
    ? { ...common, kind: 'nut', lengthMm: threadDefaults(a.diameterMm, 'nut').lengthMm }
    : { ...common, kind: 'hole', lengthMm: a.lengthMm };
  const first = await createThread(ctx, a.pair === 'bolt-nut' ? bolt : female, { position: [0, 0, 0] });
  const second = await createThread(ctx, a.pair === 'bolt-nut' ? female : bolt, { position: [0, 0, 0] });
  const w = (o: SceneObject) => o.stats.dimensionsMm[0];
  const dx = (w(first) + w(second)) / 2 + (a.gapMm ?? 6);
  const placedSecond = { ...second, position: [dx, second.position[1], 0] as Vec3 };
  const engaged = Math.min(a.lengthMm, female.lengthMm);
  const fit = await isoThreadPairFit({ ...common, lengthMm: engaged });
  return { objects: [first, placedSecond], fit };
}

const USER_AXIS_TO_INTERNAL: Record<ScrewFitInput['axis'], 0 | 1 | 2> = { x: 0, y: 2, z: 1 };

/** Enroscado entre dos objetos tal como están (la hembra en su posición final). Solo lectura. */
export async function checkScrewFitObjects(
  male: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>,
  female: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>,
  input: ScrewFitInput,
): Promise<ScrewFitReport> {
  const box = worldBox(male);
  const center: [number, number, number] = box
    ? [(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2]
    : [0, 0, 0];
  return checkScrewFitMeshes(worldMeshOf(male), worldMeshOf(female), {
    axis: USER_AXIS_TO_INTERNAL[input.axis],
    center,
    leadMm: input.leadMm,
    turns: input.turns ?? 1,
    ...(input.samples !== undefined ? { samples: input.samples } : {}),
  });
}
