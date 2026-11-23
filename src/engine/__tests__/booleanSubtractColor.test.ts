/**
 * @file src/engine/__tests__/booleanSubtractColor.test.ts
 * @description Restar una pieza negativa de otro color NO pinta de ese color las caras nuevas: el vaso
 * (cubo menos cilindro) queda del color del sólido, sin rastro del color del negativo, y la unión sigue
 * conservando los dos colores. Si el sólido tenía pintura por cara, se conserva y tampoco entra el color
 * del negativo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, SceneObject } from '../../types/kura';
import { computeMeshStats, createPrimitiveMesh, runBooleanOperation } from '../index';

const BLUE = '#38bdf8';
const ORANGE = '#f97316';
const GREEN = '#22c55e';

function obj(id: string, mesh: MeshData, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id, name: id, source: 'primitive', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: BLUE, isHole: false, visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
    ...overrides,
  } as SceneObject;
}

const colorsOf = (mesh: MeshData) => new Set((mesh.faceColors ?? []).map((c) => c.toLowerCase()));

describe('resta con pieza negativa de otro color', () => {
  it('el interior del vaso toma el color del sólido', async () => {
    const box = await createPrimitiveMesh('box', { width: 30, height: 30, depth: 30 });
    const cyl = await createPrimitiveMesh('cylinder', { radius: 8, height: 20 });
    const solid = obj('solido', box, { color: BLUE });
    const negative = obj('negativo', cyl, { color: ORANGE, isHole: true, position: [0, 15, 0] });

    const res = await runBooleanOperation(solid, negative, 'subtract');
    expect(computeMeshStats(res.mesh).isManifold).toBe(true);
    expect(colorsOf(res.mesh).has(ORANGE)).toBe(false);
    // Sin pintura por cara o todo del color del sólido: el único filamento es el del sólido.
    expect([...colorsOf(res.mesh)].every((c) => c === BLUE)).toBe(true);
  });

  it('un negativo pintado con varios colores tampoco aporta colores; la pintura del sólido se conserva', async () => {
    const box = await createPrimitiveMesh('box', { width: 30, height: 30, depth: 30 });
    const cyl = await createPrimitiveMesh('cylinder', { radius: 8, height: 20 });
    const triangles = box.indices.length / 3;
    const painted: MeshData = { ...box, faceColors: Array.from({ length: triangles }, (_, i) => (i < 2 ? GREEN : BLUE)) };
    const cylPainted: MeshData = { ...cyl, faceColors: Array.from({ length: cyl.indices.length / 3 }, () => ORANGE) };
    const res = await runBooleanOperation(obj('s', painted, { color: BLUE }), obj('n', cylPainted, { color: ORANGE, isHole: true, position: [0, 15, 0] }), 'subtract');
    const colors = colorsOf(res.mesh);
    expect(colors.has(ORANGE)).toBe(false);
    expect(colors.has(GREEN)).toBe(true);
    expect(colors.has(BLUE)).toBe(true);
  });

  it('la unión de dos colores conserva ambos', async () => {
    const a = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const res = await runBooleanOperation(obj('a', a, { color: BLUE }), obj('b', a, { color: ORANGE, position: [10, 0, 0] }), 'union');
    expect(colorsOf(res.mesh)).toEqual(new Set([BLUE, ORANGE]));
  });
});
