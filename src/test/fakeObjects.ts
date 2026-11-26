/**
 * @file src/test/fakeObjects.ts
 * @description Objetos de escena mínimos para pruebas de componentes (sin motor Manifold ni WebGL).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../types/kura';

/** Cubo falso de `size` mm con malla vacía: basta para listas, diálogos e inspector. */
export function fakeBox(id: string, name: string, size = 20): SceneObject {
  return {
    id,
    name,
    source: 'primitive',
    primitiveType: 'box',
    primitiveParams: { width: size, height: size, depth: size },
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#38bdf8',
    role: 'solid',
    visible: true,
    locked: false,
    mesh: { positions: new Float32Array(), indices: new Uint32Array() },
    stats: { triangles: 12, vertices: 8, isManifold: true, volumeMm3: size ** 3, dimensionsMm: [size, size, size] },
  } as unknown as SceneObject;
}
