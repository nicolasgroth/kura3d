/**
 * @file src/core/__tests__/orientOperation.test.ts
 * @description «Orientar para imprimir» como tareas del motor: el análisis es de solo lectura y
 * serializable (clonable para el Worker); aplicar devuelve un `SceneChange` de un solo parche que
 * deja la pieza apoyada en la cama con el mismo volumen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import * as engine from '../../engine';
import { applySceneChange, type OperationContext } from '../operations';
import { runEngineTaskInProcess } from '../operations/engineTasks';
import { makeObject } from '../../engine/__tests__/geometryTestUtils';
import { tUpright } from '../../engine/__tests__/orientShapes';

const ctx = {} as OperationContext;

describe('orientForPrint (tarea)', () => {
  it('analiza sin modificar la escena y el resultado es clonable', async () => {
    const obj = makeObject('t', tUpright(), { position: [20, 0, 5] });
    const before = structuredClone(obj.position);
    const analysis = await runEngineTaskInProcess(ctx, 'orientForPrint', { obj, options: { bed: { widthMm: 220, depthMm: 220, heightMm: 250, marginMm: 5 } } });
    expect(obj.position).toEqual(before);
    expect(structuredClone(analysis)).toEqual(analysis);
    expect(analysis.candidates[0].measures.supportVolumeMm3).toBe(0);
    expect(analysis.candidates[0].measures.fitsBed).toBe(true);
    expect(analysis.currentIsBest).toBe(false);
  });

  it('aplicar la elegida: un parche, apoyada en la cama, mismo volumen', async () => {
    const obj = makeObject('t', tUpright(), { position: [20, 0, 5] });
    const analysis = await runEngineTaskInProcess(ctx, 'orientForPrint', { obj });
    const chosen = analysis.candidates[0];
    const change = await runEngineTaskInProcess(ctx, 'orientApply', { obj, quaternion: chosen.quaternion, keepXY: true });
    expect(change.patches).toHaveLength(1);
    expect(change.added).toHaveLength(0);
    const [after] = applySceneChange([obj], change);
    const world = engine.applyTransformToMesh(after.mesh, after.position, after.rotation, after.scale);
    const stats = engine.computeMeshStats(world);
    expect(stats.isManifold).toBe(true);
    expect(stats.volumeMm3).toBeCloseTo(10_000, 3);
    expect(stats.dimensionsMm[1]).toBeCloseTo(10, 4);
    let minY = Infinity;
    for (let i = 1; i < world.positions.length; i += 3) minY = Math.min(minY, world.positions[i]);
    expect(minY).toBeCloseTo(0, 4);
  });
});
