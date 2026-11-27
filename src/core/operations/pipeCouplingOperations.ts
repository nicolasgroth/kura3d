/**
 * @file src/core/operations/pipeCouplingOperations.ts
 * @description Operación pura (Worker, MCP sin interfaz, recetas) del acople de tubería: una mitad (macho o hembra)
 * como objeto nuevo apoyado en la cama. La receta pide las dos mitades en pasos seguidos con las mismas medidas: el
 * último par generado se reutiliza para no construir dos veces la misma geometría.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { createPipeCoupling } from '../../engine/pipeCoupling';
import type { PipeCouplingOptions } from '../../engine/pipeCouplingLayout';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import type { PipeCouplingPart } from '../bus/pipeCouplingSchema';
import { buildWith, type OperationContext } from './operationTypes';

const MALE_COLOR = '#0ea5e9';
const FEMALE_COLOR = '#0369a1';

let lastBuild: { key: string; male: MeshData; female: MeshData; spec: PipeCouplingOptions } | null = null;
const copyMesh = (m: MeshData): MeshData => ({ positions: m.positions.slice(), indices: m.indices.slice() });

async function buildCoupling(options: Partial<PipeCouplingOptions>) {
  const key = JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)));
  if (lastBuild?.key !== key) {
    const built = await createPipeCoupling(options);
    lastBuild = { key, male: built.male, female: built.female, spec: built.spec };
  }
  return { male: copyMesh(lastBuild.male), female: copyMesh(lastBuild.female), spec: lastBuild.spec };
}

/** Una mitad del acople como objeto nuevo, apoyada en la cama con su eje en `position`. */
export async function createPipeCouplingPart(
  ctx: OperationContext,
  options: Partial<PipeCouplingOptions>,
  part: PipeCouplingPart,
  placement: { name: string; position?: Vec3 },
): Promise<{ object: SceneObject; spec: PipeCouplingOptions }> {
  const { male, female, spec } = await buildCoupling(options);
  const object = buildWith(ctx, {
    name: placement.name,
    source: 'thread',
    mesh: part === 'male' ? male : female,
    position: placement.position,
    color: part === 'male' ? MALE_COLOR : FEMALE_COLOR,
    materialPreset: 'pla_matte',
    role: 'solid',
  });
  return { object, spec };
}
