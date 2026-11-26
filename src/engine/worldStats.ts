/**
 * @file src/engine/worldStats.ts
 * @description Estadísticas de un objeto en dimensiones de mundo (rotación y escala aplicadas, sin
 * traslación). Es la semántica única de `stats` que exponen el Command Bus y el MCP headless.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, SceneObject, Vec3 } from '../types/kura';
import { applyTransformToMesh, computeMeshStats } from './primitives';

const isIdentity = (rotation: Vec3, scale: Vec3) =>
  rotation.every((r) => r === 0) && scale.every((s) => s === 1);

/** Estadísticas de `mesh` tras aplicar `rotation` (radianes) y `scale`. */
export function computeWorldStats(mesh: MeshData, rotation: Vec3, scale: Vec3): SceneObject['stats'] {
  return computeMeshStats(
    isIdentity(rotation, scale) ? mesh : applyTransformToMesh(mesh, [0, 0, 0], rotation, scale),
  );
}
