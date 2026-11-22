/**
 * @file src/core/__tests__/operations.test.ts
 * @description Pruebas de las operaciones puras de `src/core/operations`: aplicación de un
 * `SceneChange`, booleanas y cortes con resultados cerrados (manifold) y volúmenes esperados,
 * políticas de construcción (app frente a headless) y nombres por adaptador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import * as engine from '../../engine';
import * as ops from '../operations';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, HEADLESS_BUILD_POLICY, buildSceneObject } from '../scene/sceneObjects';
import { inputsAreCurrent, resolveBooleanInputs } from '../scene/sceneRules';
import type { SceneObject } from '../../types/kura';

let counter = 0;
const naming = createKeyedNaming((key, params) => `${key}${params ? JSON.stringify(params) : ''}`, {
  color: (hex) => hex,
  structure: (_r, id) => id,
});
const ctx: ops.OperationContext = { policy: APP_BUILD_POLICY, newId: () => `t_${++counter}`, naming };

async function box(size: number, name = 'Caja'): Promise<SceneObject> {
  return ops.createPrimitive(ctx, { type: 'box', params: { width: size, height: size, depth: size }, name, color: '#ffffff' });
}

beforeAll(async () => {
  await engine.initManifoldEngine();
});

describe('applySceneChange', () => {
  it('parcha en su lugar, quita y agrega al final', () => {
    const mk = (id: string) => ({ id, name: id }) as SceneObject;
    const out = ops.applySceneChange([mk('a'), mk('b'), mk('c')], ops.change({
      patches: [{ id: 'c', patch: { name: 'C' } }],
      removedIds: ['a'],
      added: [mk('d')],
    }));
    expect(out.map((o) => `${o.id}:${o.name}`)).toEqual(['b:b', 'c:C', 'd:d']);
  });
});

describe('Operaciones CSG', () => {
  it('resta de cajas: resultado manifold con el volumen esperado y entradas consumidas', async () => {
    const a = await box(20, 'A');
    const b = { ...(await box(10, 'B')), position: [5, 5, 5] as [number, number, number] };
    const { result: res, change } = await ops.booleanOperation(ctx, { target: a, tools: [b], op: 'subtract' });
    const result = res!;
    expect(result.stats.isManifold).toBe(true);
    // A ocupa x,z ∈ [-10, 10], y ∈ [0, 20]; B (apoyada en cama y movida a [5, 5, 5]) ocupa
    // x,z ∈ [0, 10], y ∈ [5, 15]: queda entera dentro de A.
    const overlap = 10 * 10 * 10;
    expect(result.stats.volumeMm3).toBeCloseTo(8000 - overlap, 0);
    expect(change.removedIds).toEqual([a.id, b.id]);
    expect(result.name).toBe('A − B');
  });

  it('resolveBooleanInputs sigue el orden pedido y nombra en orden de escena', async () => {
    const [a, b, c, d] = await Promise.all([box(5, 'a'), box(5, 'b'), box(5, 'c'), box(5, 'd')]);
    const inputs = resolveBooleanInputs([a, b, c, d], [a.id, b.id, d.id, c.id]);
    expect(inputs?.extras.map((o) => o.name)).toEqual(['d', 'c']);
    expect(inputs?.extrasInSceneOrder.map((o) => o.name)).toEqual(['c', 'd']);
  });
});

describe('Corte por plano', () => {
  it('dos mitades cerradas cuyo volumen suma el original', async () => {
    const a = await box(20);
    const { parts, change } = await ops.planeCut(ctx, a, {
      axis: 'y', offset: 0, connectorType: 'none', connectorSize: 4, connectorDepth: 6, connectorCount: 0,
      tolerance: 0.25, keepMode: 'both',
    });
    expect(parts).toHaveLength(2);
    for (const p of parts) expect(p.stats.isManifold).toBe(true);
    const total = parts.reduce((acc, p) => acc + p.stats.volumeMm3, 0);
    expect(total).toBeCloseTo(8000, 0);
    expect(change.removedIds).toEqual([a.id]);
  });
});

describe('Políticas de construcción', () => {
  it('la app apoya en la cama y usa estadísticas locales; headless parte del origen con estadísticas de mundo', async () => {
    const a = await box(10);
    const app = buildSceneObject({ name: 'x', source: 'primitive', mesh: a.mesh, scale: [2, 1, 1] }, APP_BUILD_POLICY);
    const headless = buildSceneObject({ id: 'h', name: 'x', source: 'primitive', mesh: a.mesh, scale: [2, 1, 1] }, HEADLESS_BUILD_POLICY);
    expect(app.stats.dimensionsMm[0]).toBeCloseTo(10);
    expect(headless.stats.dimensionsMm[0]).toBeCloseTo(20);
    expect(headless.position).toEqual([0, 0, 0]);
  });

  it('headless rechaza una malla vacía', () => {
    const empty = { positions: new Float32Array(), indices: new Uint32Array() } as unknown as SceneObject['mesh'];
    expect(() => buildSceneObject({ id: 'e', name: 'e', source: 'primitive', mesh: empty }, HEADLESS_BUILD_POLICY)).toThrow();
  });
});

describe('Reglas de vigencia', () => {
  it('una entrada con malla reemplazada deja de estar vigente', async () => {
    const a = await box(10);
    expect(inputsAreCurrent([a], [a])).toBe(true);
    expect(inputsAreCurrent([{ ...a, mesh: { ...a.mesh } }], [a])).toBe(false);
    expect(inputsAreCurrent([], [a])).toBe(false);
  });
});
