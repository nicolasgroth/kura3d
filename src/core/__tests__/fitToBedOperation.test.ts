/**
 * @file src/core/__tests__/fitToBedOperation.test.ts
 * @description "Ajustar a la impresora" como tarea del motor: chequeo de medidas funcionales (rosca
 * ISO generada, conectores de Dividir), aviso al escalar, "mantener aparte" y cambio aplicable.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import * as engine from '../../engine';
import { applySceneChange, type OperationContext } from '../operations';
import { runEngineTaskInProcess } from '../operations/engineTasks';
import { parametricOrigin } from '../scene/parametric';
import type { SceneObject } from '../../types/kura';

const ctx = {} as OperationContext;

async function box(id: string, w: number, h: number, d: number, extra: Partial<SceneObject> = {}): Promise<SceneObject> {
  const mesh = await engine.createPrimitiveMesh('box', { width: w, height: h, depth: d });
  return {
    id, name: id, source: 'primitive', primitiveType: 'box', position: [0, h / 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: '#ffffff', role: 'solid', visible: true, locked: false, mesh, stats: engine.computeMeshStats(mesh), ...extra,
  };
}

const bed = { widthMm: 256, depthMm: 256, heightMm: 256, marginMm: 5 };

describe('fitToBed (tarea)', () => {
  it('advierte la rosca ISO al escalar y ofrece mantenerla aparte en un bloque', async () => {
    const thread = { kind: 'bolt' as const, diameterMm: 8, pitchMm: 1.25, lengthMm: 20 };
    const big = await box('big', 300, 40, 40);
    const bolt = await box('bolt', 10, 20, 10);
    bolt.parametric = parametricOrigin('thread', bolt.mesh, thread);
    const { analysis } = await runEngineTaskInProcess(ctx, 'fitToBed', { objects: [big, bolt], bed });
    expect(analysis.functional).toEqual([
      expect.objectContaining({ objectId: 'bolt', kind: 'thread', label: 'M8x1.25', nominalMm: 8, keepApart: { available: true } }),
    ]);
    const scale = analysis.alternatives.find((a) => a.kind === 'scale')!;
    const w = scale.warnings.find((x) => x.code === 'FIT_FUNCTIONAL_SCALED')!;
    expect(w.params).toMatchObject({ label: 'M8x1.25', factor: scale.factor });
    expect(w.params.scaledMm).toBeCloseTo(8 * scale.factor, 2);
  });

  it('un conector de Dividir no se puede mantener aparte (está fundido en la pieza)', async () => {
    const part = await box('p', 300, 40, 40, {
      metadata: { split: {
        groupId: 'g', code: 'A1', cell: [0, 0, 0], assembly: { position: [0, 0, 0], rotation: [0, 0, 0] },
        print: { position: [0, 0, 0], rotation: [0, 0, 0], plate: 1, downFace: '-y' }, jointLabels: ['1'],
        joints: [{ label: '1', axis: 'x', position: 0, a: 'A1', b: 'B1', kind: 'connector', connector: { type: 'dowel', size: 4, depth: 6, tolerance: 0.25 } } as never],
      } },
    });
    const { analysis } = await runEngineTaskInProcess(ctx, 'fitToBed', { objects: [part], bed });
    expect(analysis.functional[0]).toMatchObject({ kind: 'splitConnector', keepApart: { available: false, reason: 'mergedInMesh' } });
  });

  it('primitiva modificada por otra operación deja de contar como paramétrica', async () => {
    const b = await box('b', 300, 40, 40);
    b.parametric = parametricOrigin('primitive', await engine.createPrimitiveMesh('box', { width: 1, height: 1, depth: 1 }));
    const { analysis } = await runEngineTaskInProcess(ctx, 'fitToBed', { objects: [b], bed });
    expect(analysis.functional).toEqual([]);
  });

  it('aplicar devuelve parches de transformación que dejan el bloque dentro de la cama', async () => {
    const b = await box('b', 300, 40, 40);
    const { change, applied } = await runEngineTaskInProcess(ctx, 'fitToBed', { objects: [b], bed, apply: 'scale' });
    expect(applied!.factor).toBeCloseTo(0.82, 4);
    const [after] = applySceneChange([b], change!);
    const stats = engine.computeWorldStats(after.mesh, after.rotation, after.scale);
    expect(stats.dimensionsMm[0]).toBeLessThanOrEqual(246 + 1e-6);
    const placed = engine.applyTransformToMesh(after.mesh, after.position, after.rotation, after.scale);
    let minY = Infinity;
    for (let i = 1; i < placed.positions.length; i += 3) minY = Math.min(minY, placed.positions[i]);
    expect(minY).toBeCloseTo(0, 4);
    expect(engine.computeMeshStats(placed).volumeMm3).toBeCloseTo(300 * 40 * 40 * applied!.factor ** 3, -1);
  });

  it('no aplica una alternativa no disponible ni Dividir', async () => {
    const b = await box('b', 50, 40, 40);
    await expect((async () => runEngineTaskInProcess(ctx, 'fitToBed', { objects: [b], bed, apply: 'scale' }))()).rejects.toHaveProperty('code', 'FIT_ALTERNATIVE_UNAVAILABLE');
    await expect((async () => runEngineTaskInProcess(ctx, 'fitToBed', { objects: [await box('c', 900, 9, 9)], bed, apply: 'split' }))()).rejects.toHaveProperty('code', 'FIT_ALTERNATIVE_UNAVAILABLE');
  });
});
